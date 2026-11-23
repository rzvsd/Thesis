// Unit tests for the copied logic: what-if DCF, scenario stress scoring and the row mappers.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { mapCalendarEvent, mapFearGreedSnapshot, mapNameRelationship, mapWarRoomRecord } from "./rows.ts";
import {
  runScenarioStressEvaluation,
  scenarioStressImpactLevelFromScore,
  scenarioStressScoreForTicker,
} from "./scenario_stress.ts";
import { MemoryResearchStore } from "./memory_store.ts";
import { computeScenarioResponse } from "./what_if.ts";

const valuation = {
  fair_value_mid: 100,
  fair_value_low: 80,
  fair_value_high: 120,
  spot_price: 90,
  assumptions: {
    methodology: "deterministic_dcf" as const,
    projection_years: 5,
    terminal_growth_rate: 0.02,
    wacc: 0.09,
    beta: 1.1,
  },
};

Deno.test("what-if keeps the base, drops beta and rescales the fair value", () => {
  const res = computeScenarioResponse("r1", valuation, { wacc: 0.1 });
  assertEquals(res.deterministic_model, "phase6_deterministic_v1");
  assertEquals(res.base.fair_value_mid, 100);
  assertEquals("beta" in res.base.assumptions, false);
  assert(res.scenario.fair_value_mid! < 100);
  assertEquals(res.scenario.assumptions.wacc, 0.1);
  assertEquals(res.omissions.map((o) => o.omission_code), ["market_beta_omitted", "legacy_beta_ignored"]);
  // Same assumptions give the same value.
  assertEquals(computeScenarioResponse("r1", valuation, {}).scenario.fair_value_mid, 100);
});

Deno.test("what-if without a base mid is degraded", () => {
  const res = computeScenarioResponse("r1", { ...valuation, fair_value_mid: undefined, spot_price: undefined }, {});
  assertEquals(res.scenario.fair_value_mid, undefined);
  assert(res.scenario.degraded_reason);
  assert(res.omissions.some((o) => o.omission_code === "spot_reference_unavailable"));
});

Deno.test("scenario stress score is deterministic and bounded", () => {
  const a = scenarioStressScoreForTicker({ scenarioId: "ai_hype_burst", ticker: "NVDA", asOf: "2026-11-20" });
  const b = scenarioStressScoreForTicker({ scenarioId: "ai_hype_burst", ticker: "nvda", asOf: "2026-11-20" });
  assertEquals(a, b);
  assert(a >= 0 && a <= 1);
  assertEquals(scenarioStressImpactLevelFromScore(0.9), "critical");
  assertEquals(scenarioStressImpactLevelFromScore(0.1), "none");
});

Deno.test("scenario run stores impacts linked to the run", async () => {
  const store = new MemoryResearchStore();
  store.watchlists.set("u", ["NVDA", "AMD", "KO"]);
  const res = await runScenarioStressEvaluation(store, {
    userId: "u",
    scenarioId: "ai_hype_burst",
    asOf: "2026-11-20",
    nowIso: "2026-11-20T12:00:00.000Z",
  });
  assertEquals(res.run.totalNames, 3);
  assertEquals(res.run.impactedNames, res.impacts.length);
  assert(res.impacts.every((i) => i.scenarioRunId === res.run.id));
  assertEquals(store.runs.length, 1);
});

Deno.test("row mappers turn postgres.js Dates and numeric strings into the old values", () => {
  const fg = mapFearGreedSnapshot({
    id: "fg1",
    market_date: new Date("2026-11-20T00:00:00.000Z"),
    score: "42.50",
    label: "fear",
    sub_scores: [],
    missing_inputs: ["x"],
    calculated_at: new Date("2026-11-21T11:30:00.000Z"),
  });
  assertEquals(fg.market_date, "2026-11-20");
  assertEquals(fg.score, 42.5);
  assertEquals(fg.calculated_at, "2026-11-21T11:30:00.000Z");

  const rel = mapNameRelationship({
    relationship_id: "r",
    user_id: "u",
    source_ticker: "AAPL",
    target_ticker: "TSM",
    relationship_type: "supplier",
    confidence: "0.8",
    state: "active",
    source_report_id: "rep",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    suppressed_at: null,
  });
  assertEquals(rel.confidence, 0.8);
  assertEquals(rel.suppressedAt, undefined);

  const ev = mapCalendarEvent({
    id: "e",
    ticker: "AAPL",
    event_type: "earnings",
    event_date: new Date("2026-08-01T00:00:00.000Z"),
    provider: "p",
    retrieved_at: new Date("2026-07-31T00:00:00.000Z"),
    timing_state: "confirmed",
    source_state: null,
    reason_text: null,
  });
  assertEquals(ev.eventDate, "2026-08-01");
  assertEquals(ev.sourceState, "derived");

  const room = mapWarRoomRecord({
    id: "w",
    user_id: "u",
    ticker: "AAPL",
    earnings_event_id: "e",
    event_date: new Date("2026-08-01T00:00:00.000Z"),
    state: "preparing",
    current_cadence_min: 30,
    cadence_state: { latest_cycle_status: "timeout", latest_runtime_min: 3, updated_at: "2026-08-01T10:00:00.000Z" },
    prepared_at: new Date("2026-07-30T00:00:00.000Z"),
    updated_at: new Date("2026-08-01T10:00:00.000Z"),
  });
  assertEquals(room.eventDate, "2026-08-01");
  assertEquals(room.state, "pre");
  assertEquals(room.currentCadenceMin, 30);
  assertEquals(room.lastCycleStatus, "timeout");
  assertEquals(room.lastRuntimeMin, 3);
  assertEquals(room.lastLagMin, undefined);
});
