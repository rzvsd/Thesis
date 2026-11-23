// Relationships, earnings state, war room and monitor snapshots.
// Behaviour from apps/product-api/tests/ph5-m5-cross-name, ph6-m4-earnings-state and ph5-m4-war-room.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { call, memoryDeps, OTHER_USER, USER } from "../../../_lib/research/testing.ts";
import type { CalendarEventRecord, NameRelationshipRecord } from "../../../_lib/research/types.ts";
import {
  earningsStateHandler,
  monitorSnapshotsHandler,
  nameRelationshipsHandler,
  warRoomHandler,
} from "./names.ts";

function rel(id: string, target: string, state: NameRelationshipRecord["state"], confidence: number) {
  return {
    relationshipId: id,
    userId: USER,
    sourceTicker: "AAPL",
    targetTicker: target,
    relationshipType: "supplier" as const,
    confidence,
    state,
    sourceReportId: "rep",
    promptVersion: "v1",
    evidenceText: "e",
    rationale: "r",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: `2026-11-0${id.length}T00:00:00.000Z`,
  };
}

Deno.test("name relationships filter by state and confidence", async () => {
  const deps = memoryDeps();
  deps.store.relationships.push(rel("a", "TSM", "active", 0.9), rel("bb", "QCOM", "suppressed", 0.5));
  const h = nameRelationshipsHandler(deps);
  const all = await call(h, { path: "/v1/names/relationships" });
  assertEquals(all.status, 200);
  assertEquals(all.body.data.length, 2);
  assertEquals(all.body.data[0].relationship_id, "bb");
  const active = await call(h, { path: "/v1/names/relationships?state=active&min_confidence=0.8" });
  assertEquals(active.body.data.map((r: { target_ticker: string }) => r.target_ticker), ["TSM"]);
});

Deno.test("name relationships 422s", async () => {
  const h = nameRelationshipsHandler(memoryDeps());
  for (const q of ["state=bogus", "min_confidence=2", "min_confidence=x", "limit=251"]) {
    const res = await call(h, { path: `/v1/names/relationships?${q}` });
    assertEquals(res.status, 422, q);
    assertEquals(res.body.error, "validation_failed");
  }
});

function calendarEvent(overrides: Partial<CalendarEventRecord>): CalendarEventRecord {
  return {
    id: "ev-1",
    ticker: "AAPL",
    eventType: "earnings",
    eventDate: "2026-11-25",
    eventTime: "after_market",
    provider: "issuer_ir",
    retrievedAt: "2026-11-20T00:00:00.000Z",
    timingState: "confirmed",
    sourceState: "first_party",
    sourceRef: {},
    reasonText: "",
    ...overrides,
  };
}

Deno.test("earnings state defaults to the watchlist and honours the window", async () => {
  const deps = memoryDeps();
  deps.store.watchlists.set(USER, ["AAPL"]);
  deps.store.calendarEvents.push(calendarEvent({}), calendarEvent({ id: "ev-far", eventDate: "2027-06-01" }));
  const h = earningsStateHandler(deps);
  const res = await call(h, { path: "/v1/research/earnings/state?as_of=2026-11-20" });
  assertEquals(res.status, 200);
  assertEquals(res.body.data.as_of, "2026-11-20");
  assertEquals(res.body.data.window_start, "2026-11-13");
  assertEquals(res.body.data.window_end, "2026-12-20");
  assertEquals(res.body.data.states.length, 1);
  assertEquals(res.body.data.states[0].timing_state, "confirmed");

  const other = await call(h, { path: "/v1/research/earnings/state?as_of=2026-11-20&tickers=msft" });
  assertEquals(other.body.data.states, []);
  assertEquals((await call(h, { path: "/x?window_past_days=31" })).status, 422);
  assertEquals((await call(h, { path: "/x?window_ahead_days=0" })).status, 422);
});

Deno.test("war room: Pro only, 404 for unknown or foreign rooms, full shape", async () => {
  const deps = memoryDeps();
  const h = warRoomHandler(deps);
  const free = await call(h, { path: "/v1/research/war-room/w1", params: { id: "w1" } });
  assertEquals(free.status, 403);
  assertEquals(free.body.feature, "earnings_war_room");

  deps.store.tiers.set(USER, "PRO");
  deps.store.tiers.set(OTHER_USER, "PRO");
  const missing = await call(h, { path: "/v1/research/war-room/w1", params: { id: "w1" } });
  assertEquals(missing.status, 404);
  assertEquals(missing.body.error, "war_room_not_found");

  deps.store.warRooms.push({
    warRoomId: "w1",
    userId: USER,
    ticker: "AAPL",
    earningsEventId: "ev-1",
    eventDate: "2026-11-25",
    state: "pre",
    currentCadenceMin: 15,
    preparedAt: "2026-11-23T00:00:00.000Z",
    createdAt: "2026-11-23T00:00:00.000Z",
    updatedAt: "2026-11-23T00:00:00.000Z",
    lastCycleAt: "2026-11-23T00:00:00.000Z",
  });
  deps.store.warRoomEvents.push({
    id: "te-1",
    warRoomId: "w1",
    phase: "pre",
    eventType: "prepared",
    reasonText: "Prepared.",
    sourceRefs: [{ kind: "report", ref_id: "rep-1", label: "Baseline" }],
    metadata: {},
    createdAt: "2026-11-23T00:00:00.000Z",
  });
  deps.store.calendarEvents.push(calendarEvent({}));
  const ok = await call(h, { path: "/v1/research/war-room/w1", params: { id: "w1" } });
  assertEquals(ok.status, 200);
  const d = ok.body.data;
  assertEquals(d.war_room_id, "w1");
  assertEquals(d.earnings_state.earnings_event_id, "ev-1");
  assertEquals(d.evidence_pack.baseline.ref_id, "rep-1");
  assertEquals(d.reason_path.latest_timeline_reason, "Prepared.");
  assertEquals(d.timeline[0].war_room_event_id, "te-1");
  assert("transcript" in d.evidence_pack);

  const foreign = await call(h, {
    path: "/v1/research/war-room/w1",
    params: { id: "w1" },
    userId: OTHER_USER,
  });
  assertEquals(foreign.status, 404);
});

Deno.test("monitor snapshots list the user's rows", async () => {
  const deps = memoryDeps();
  deps.store.monitorSnapshots.push({
    userId: USER,
    ticker: "AAPL",
    state: "intact",
    reason: "ok",
    score: 0.8,
    materialEventsCount: 1,
    unreviewedEventsCount: 0,
    freshnessState: "current",
    freshnessScore: 0.9,
    freshnessReason: "fresh",
    updatedAt: "2026-11-20T00:00:00.000Z",
  });
  const res = await call(monitorSnapshotsHandler(deps), { path: "/v1/user/monitor-snapshots" });
  assertEquals(res.status, 200);
  assertEquals(res.body.data[0].ticker, "AAPL");
  assertEquals(res.body.data[0].freshness_state, "current");
  const none = await call(monitorSnapshotsHandler(deps), {
    path: "/v1/user/monitor-snapshots",
    userId: OTHER_USER,
  });
  assertEquals(none.body.data, []);
});
