// War room, coherence, monitor recompute and research-state routes.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import type { ReportBodyReader } from "../../../_lib/evaluators/report_port.ts";
import { computeWarRoomCadence } from "../../../_lib/evaluators/war_room.ts";
import { addUser, earnings, post, rule, setup, snapshot } from "./test_support.ts";

const WR = "/internal/notifications/earnings-war-room";

Deno.test("war room cadence falls back after two failures and recovers after three healthy cycles", () => {
  const base = {
    currentCadenceMin: 15,
    failureStreak: 0,
    lagBreachStreak: 0,
    runtimeBreachStreak: 0,
    healthyStreak: 0,
  };
  const fail = { status: "failure" as const, lagMinutes: 0, runtimeMinutes: 0 };
  const one = computeWarRoomCadence(base, fail);
  assertEquals([one.nextCadenceMin, one.transitioned], [15, false]);
  const two = computeWarRoomCadence({ ...base, failureStreak: one.failureStreak }, fail);
  assertEquals([two.nextCadenceMin, two.triggerType], [30, "failures"]);
  const ok = { status: "success" as const, lagMinutes: 1, runtimeMinutes: 1 };
  const slow = { ...base, currentCadenceMin: 30, healthyStreak: 2 };
  const back = computeWarRoomCadence(slow, ok);
  assertEquals([back.nextCadenceMin, back.triggerType, back.failureStreak], [15, "healthy_recovery", 0]);
});

Deno.test("war room pre: prepares once, writes the inbox row, rerun adds nothing", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  addUser(store, "free", { tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-21"));
  const res = await post(WR, { as_of: "2026-11-20", phase: "pre" });
  assertEquals(res.status, 200);
  assertEquals([res.body.prepared, res.body.attempted], [1, 0]);
  assertEquals(res.body.fallback_user_ids, []);
  assertEquals(res.body.next_cursor, null);
  assertEquals(store.warRooms.length, 1);
  assertEquals(store.warRooms[0].state, "ready");
  assertEquals(store.alerts.length, 1);
  assertEquals(store.alerts[0].context.war_room_phase, "pre");
  assertEquals(store.timeline.map((t) => t.eventType), ["prepared", "alert_emitted"]);

  const again = await post(WR, { as_of: "2026-11-20", phase: "pre" });
  assertEquals(again.body.prepared, 0);
  assertEquals(store.warRooms.length, 1);
  assertEquals(store.alerts.length, 1);
});

const enabledQueue = {
  enabled: true,
  queueRefresh: () => Promise.resolve({ id: "job-1", reportId: "rep-1" }),
};

Deno.test("war room post stays open while the Deep Dive queue is disabled", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-20"));
  store.rules.push(rule("r1", "pro", "AAPL"));
  const res = await post(WR, { as_of: "2026-11-20" });
  assertEquals([res.body.post_closed, res.body.post_deferred], [0, 1]);
  assertEquals(store.warRooms[0].state === "closed", false);
  assertEquals(store.evaluations.length, 0);
  assertEquals(store.alerts.some((a) => a.context.war_room_phase === "post"), false);
});

Deno.test("war room auto on event day: live cycle then post closure, rerun does nothing", async () => {
  const { store } = setup({ deepDiveQueue: enabledQueue });
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-20"));
  store.rules.push(rule("r1", "pro", "AAPL"));
  store.snapshots.push(snapshot("pro", "AAPL", { freshnessState: "stale", freshnessScore: 0.2 }));
  const res = await post(WR, { as_of: "2026-11-20" });
  assertEquals([res.body.prepared, res.body.live_updated, res.body.post_closed], [1, 1, 1]);
  assertEquals(store.warRooms[0].state, "closed");
  assertEquals(store.evaluations.length, 1);
  assertEquals(store.evaluations[0].reasonCode, "war_room_post_recheck");
  assertEquals(store.snapshots[0].freshnessState, "current");
  assertEquals(store.alerts.map((a) => a.context.war_room_phase).sort(), ["post", "pre"]);

  const again = await post(WR, { as_of: "2026-11-20" });
  assertEquals([again.body.prepared, again.body.live_updated, again.body.post_closed], [0, 0, 0]);
  assertEquals(store.alerts.length, 2);
  assertEquals(store.evaluations.length, 1);
});

Deno.test("war room live: cadence change sends one alert per room, date and cadence", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-20"));
  await post(WR, { as_of: "2026-11-20", phase: "pre" });
  const fixtures = [{ ticker: "AAPL", status: "failed" }];
  await post(WR, { as_of: "2026-11-20", phase: "live", live_fixtures: fixtures });
  const second = await post(WR, { as_of: "2026-11-20", phase: "live", live_fixtures: fixtures });
  assertEquals(second.body.live_updated, 1);
  assertEquals(store.warRooms[0].currentCadenceMin, 30);
  const cadenceAlerts = () => store.alerts.filter((a) => a.reasonCode === "war_room_cadence_fallback").length;
  assertEquals(cadenceAlerts(), 1);
  assertEquals(store.timeline.filter((t) => t.eventType === "cadence_changed").length, 1);
});

Deno.test("war room: Free users are not in the audience; paging returns next_cursor", async () => {
  const { store } = setup();
  addUser(store, "p1", { tier: "PRO", tickers: ["AAPL"] });
  addUser(store, "p2", { tier: "PRO", tickers: ["AAPL"] });
  store.calendar.push(earnings("e1", "AAPL", "2026-11-21"));
  const p1 = await post(WR, { as_of: "2026-11-20", phase: "pre", limit: 1 });
  assertEquals([p1.body.prepared, p1.body.next_cursor], [1, "p1"]);
  const p2 = await post(WR, { as_of: "2026-11-20", phase: "pre", limit: 1, cursor: "p1" });
  assertEquals([p2.body.prepared, p2.body.next_cursor], [1, "p2"]);
  const p3 = await post(WR, { as_of: "2026-11-20", phase: "pre", limit: 1, cursor: "p2" });
  assertEquals([p3.body.prepared, p3.body.next_cursor], [0, null]);
});

Deno.test("coherence: Pro card per period, rerun updates the same card, 422 on bad dates", async () => {
  const { store } = setup();
  addUser(store, "pro", { tier: "PRO", tickers: ["AAPL"] });
  addUser(store, "free", { tickers: ["AAPL"] });
  const entry = (id: string, ticker: string, signal: "positive" | "negative") => ({
    id,
    userId: "pro",
    ticker,
    eventType: "kill_switch_alert_fired" as const,
    sourceType: "alert_ledger" as const,
    sourceId: id,
    eventAt: "2026-10-10T00:00:00Z",
    title: `${ticker} entry`,
    summary: "Datacenter demand accelerates margins",
    thesisSnapshot: { signal_value: signal, thesis_summary: "datacenter demand accelerates" },
    evidenceRefs: [],
    createdAt: "2026-10-10T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
  });
  store.journal.push(entry("j1", "AAPL", "positive"), entry("j2", "MSFT", "negative"));
  const url = "/internal/conviction/coherence/evaluate";
  const res = await post(url, {});
  assertEquals(res.status, 200);
  assertEquals([res.body.period_start, res.body.period_end], ["2026-10-01", "2026-10-31"]);
  assertEquals([res.body.evaluated_users, res.body.generated], [1, 1]);
  const types = store.insightCards[0].findings.map((f) => f.finding_type).sort();
  assertEquals(types, ["contradiction", "overlap"]);
  await post(url, {});
  assertEquals(store.insightCards.length, 1);

  assertEquals((await post(url, { period_start: "2026-10" })).status, 422);
  assertEquals((await post(url, { period_start: "2026-10-31", period_end: "2026-10-01" })).status, 422);
  const paged = await post(url, { user_ids: ["free", "pro"], limit: 1 });
  assertEquals([paged.body.evaluated_users, paged.body.next_cursor], [0, "free"]);
});

const deepDiveMeta = {
  id: "r1",
  jobId: "j1",
  type: "deep_dive" as const,
  ticker: "AAPL",
  schemaVersion: "1",
  artifactKey: "reports/r1.json",
  createdAt: "2026-11-18T00:00:00.000Z",
  userId: "u1",
};

Deno.test("monitor: no Deep Dive is unresolved; disabled reader keeps the stored state", async () => {
  const { store } = setup();
  addUser(store, "u1", { tickers: ["AAPL", "MSFT"] });
  store.reports.push(deepDiveMeta);
  store.snapshots.push(snapshot("u1", "AAPL", { state: "improved", reason: "Kept.", reportId: "r1" }));
  const url = "/internal/monitor/recompute";
  const res = await post(url, { as_of: "2026-11-20" });
  assertEquals(res.status, 200);
  assertEquals([res.body.users, res.body.names, res.body.unresolved, res.body.updated], [1, 2, 1, 2]);
  assertEquals(res.body.kept_state, 1);
  const aapl = store.snapshots.find((s) => s.ticker === "AAPL");
  assertEquals([aapl?.state, aapl?.reason, aapl?.freshnessState], ["improved", "Kept.", "current"]);
  assertEquals(store.snapshots.find((s) => s.ticker === "MSFT")?.state, "unresolved");
  await post(url, { as_of: "2026-11-20" });
  assertEquals(store.snapshots.length, 2);
  const none = await post(url, { as_of: "2026-11-20", user_ids: [] });
  assertEquals(none.body.users, 0);
});

Deno.test("monitor: enabled reader summarizes the report", async () => {
  const reports: ReportBodyReader = {
    enabled: true,
    read: () =>
      Promise.resolve({
        report_id: "r1",
        type: "deep_dive",
        generated_at: "2026-11-18T00:00:00.000Z",
        sections: [],
        signal: { value: "negative" },
        confidence: { score: 0.7 },
      }),
  };
  const { store } = setup({ reports });
  addUser(store, "u1", { tickers: ["AAPL"] });
  store.reports.push(deepDiveMeta);
  const res = await post("/internal/monitor/recompute", { as_of: "2026-11-20" });
  assertEquals(res.body.unresolved, 0);
  assertEquals(store.snapshots[0].state, "weakened");
  assertEquals(store.snapshots[0].reportId, "r1");
});

Deno.test("research state: one row per user and date, dry run stores nothing, paging", async () => {
  const { store } = setup();
  addUser(store, "u1", { tickers: ["AAPL"] });
  addUser(store, "u2", { tickers: ["MSFT"] });
  store.reports.push(deepDiveMeta);
  const url = "/internal/research-state/refresh";
  const dry = await post(url, { as_of: "2026-11-20", dry_run: true });
  assertEquals([dry.body.users, dry.body.created, dry.body.dry_run], [2, 0, true]);
  assert(Array.isArray(dry.body.states));
  assertEquals(store.researchStates.length, 0);

  const res = await post(url, { as_of: "2026-11-20" });
  assertEquals([res.body.created, res.body.updated], [2, 0]);
  assertEquals(res.body.states, undefined);
  const firstId = store.researchStates[0].stateId;
  const again = await post(url, { as_of: "2026-11-20" });
  assertEquals([again.body.created, again.body.updated], [0, 2]);
  assertEquals(store.researchStates.length, 2);
  assertEquals(store.researchStates[0].stateId, firstId);
  const codes = store.researchStates[0].state.names[0].omissions.map((o) => o.code);
  assert(codes.includes("deep_dive_artifact_unavailable"));

  const page = await post(url, { as_of: "2026-11-20", limit: 1 });
  assertEquals([page.body.users, page.body.next_cursor], [1, "u1"]);
});
