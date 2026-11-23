import { assertEquals } from "jsr:@std/assert@1.0.13";
import { applyCompletionEffects } from "./apply.ts";
import { noopNotifier } from "./filing-alerts.ts";
import { FakeEffectsStore } from "./testing/fake_store.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";
import type { EffectsDeps } from "./types.ts";

const fixedNow = new Date("2026-11-20T13:00:00.000Z");

function deps(store: FakeEffectsStore, latestClose: EffectsDeps["latestClose"] = () => Promise.resolve(190)) {
  return {
    store,
    latestClose,
    notifier: noopNotifier,
    readReport: () => Promise.resolve(undefined),
    now: () => fixedNow,
  } satisfies EffectsDeps;
}

const base = { requestId: "req_1", route: "/internal/jobs/job_1/complete" };

Deno.test("applyCompletionEffects runs every effect in handler order for a PRO follower", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["AAPL"]);
  store.tiers.set("u1", "PRO");
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: true,
  });

  assertEquals(store.calls, [
    "anchor",
    "audit:contrarian.anchor_created",
    "kill_switch.deactivate",
    "kill_switch.create",
    "kill_switch.create",
    "kill_switch.create",
    "audit:kill_switch.rules_created",
    "name_relationship",
    "audit:name_relationships.upserted",
    "watchlist",
    "snapshot",
    "audit:monitor.snapshot_upserted",
    "journal",
  ]);

  const anchor = store.anchors[0];
  assertEquals(anchor.ticker, "AAPL");
  assertEquals(anchor.anchorPrice, 190);
  assertEquals(anchor.anchoredAt, fixedNow.toISOString());
  assertEquals(anchor.expiresAt, "2027-02-18T13:00:00.000Z");

  assertEquals(store.killSwitchRules.map((rule) => [rule.conditionId, rule.signalType, rule.anchorPrice]), [
    ["ks_a", "price_move_pct", 190],
    ["ks_2", "guidance_revision", 190],
    ["ks_3", "management_change", 190],
  ]);
  assertEquals(store.killSwitchRules[0].signalValue, "positive");
  assertEquals(store.killSwitchRules[0].promptVersion, "unknown");

  const snapshot = store.snapshots.get("u1|AAPL")!;
  assertEquals(snapshot.state, "improved");
  assertEquals(snapshot.freshnessState, "current");
  assertEquals(snapshot.reportId, "rpt_1");
  assertEquals(store.audits.at(-1)?.payload, {
    request_id: "req_1",
    route: base.route,
    ticker: "AAPL",
    state: "improved",
    score: 0.7,
  });

  const entry = store.journal[0];
  assertEquals(entry.ticker, "AAPL");
  assertEquals(entry.eventType, "deep_dive_generated");
  assertEquals(entry.sourceId, "rpt_1");
  assertEquals(entry.title, "AAPL thesis recorded");
  assertEquals(entry.summary, "Services growth carries margins.");
  assertEquals(entry.eventAt, "2026-11-20T12:00:00.000Z");
  assertEquals(entry.thesisSnapshot.monitor_state, "improved");
  assertEquals(entry.evidenceRefs.map((ref) => ref.ref_id), ["rpt_1", "ev_0", "ev_1"]);
});

Deno.test("applyCompletionEffects reuse path skips the monitor snapshot; FREE users get no journal", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["AAPL"]);
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: false,
  });
  assertEquals(store.calls.includes("watchlist"), false);
  assertEquals(store.snapshots.size, 0);
  assertEquals(store.journal.length, 0);
  assertEquals(store.anchors.length, 1);
});

Deno.test("applyCompletionEffects skips the snapshot when the ticker is not followed", async () => {
  const store = new FakeEffectsStore();
  store.watchlists.set("u1", ["MSFT"]);
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: true,
  });
  assertEquals(store.calls.includes("watchlist"), true);
  assertEquals(store.snapshots.size, 0);
});

Deno.test("applyCompletionEffects does nothing without a user or for market pulse", async () => {
  const store = new FakeEffectsStore();
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture(),
    includeMonitorSnapshot: true,
  });
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture({ type: "market_pulse" }),
    userId: "u1",
    includeMonitorSnapshot: true,
  });
  assertEquals(store.calls, []);
});

Deno.test("missing price: anchor skipped with audit, rules created without anchor price", async () => {
  const store = new FakeEffectsStore();
  await applyCompletionEffects(deps(store, () => Promise.resolve(undefined)), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: false,
  });
  assertEquals(store.anchors.length, 0);
  assertEquals(store.audits[0].eventType, "contrarian.anchor_skipped");
  assertEquals(store.audits[0].payload.reason, "anchor_price_unavailable");
  assertEquals(store.killSwitchRules.length, 3);
  assertEquals(store.killSwitchRules[0].anchorPrice, undefined);

  const throwing = new FakeEffectsStore();
  await applyCompletionEffects(deps(throwing, () => Promise.reject(new Error("down"))), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: false,
  });
  assertEquals(throwing.audits[0].payload.reason, "anchor_price_unavailable");

  const invalid = new FakeEffectsStore();
  await applyCompletionEffects(deps(invalid, () => Promise.resolve(-1)), {
    ...base,
    report: deepDiveFixture(),
    userId: "u1",
    includeMonitorSnapshot: false,
  });
  assertEquals(invalid.audits[0].payload.reason, "anchor_price_invalid");
  assertEquals(invalid.killSwitchRules[0].anchorPrice, -1);
});

Deno.test("too few kill-switch conditions: rules skipped with audit, old rules kept", async () => {
  const store = new FakeEffectsStore();
  await applyCompletionEffects(deps(store), {
    ...base,
    report: deepDiveFixture({
      signal: { value: "no_signal" },
      kill_switch_conditions: [{ condition_text: "x", rationale: "y" }],
      name_relationships: [],
    }),
    userId: "u1",
    includeMonitorSnapshot: false,
  });
  assertEquals(store.calls, ["audit:kill_switch.rules_skipped"]);
  assertEquals(store.audits[0].payload, {
    request_id: "req_1",
    route: base.route,
    report_id: "rpt_1",
    ticker: "aapl",
    condition_count: 1,
    reason: "insufficient_conditions",
  });
});
