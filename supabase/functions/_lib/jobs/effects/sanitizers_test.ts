import { assertEquals } from "jsr:@std/assert@1.0.13";
import { normalizeKillSwitchSignalType, sanitizeKillSwitchConditionDrafts } from "./kill-switch.ts";
import { sanitizeNameRelationshipDrafts, stableNameRelationshipId } from "./name-relationships.ts";
import { deepDiveFixture } from "./testing/report_fixture.ts";
import type { NameRelationshipDraft } from "./types.ts";

Deno.test("sanitizeKillSwitchConditionDrafts trims, defaults ids and normalizes types", () => {
  const drafts = sanitizeKillSwitchConditionDrafts(deepDiveFixture({
    kill_switch_conditions: [
      {
        condition_id: " ks_x ",
        condition_text: " Price falls ",
        rationale: " r ",
        signal_type: "PRICE_MOVE",
        threshold_value: 7.5,
        threshold_unit: "pct",
        direction: "below",
        prompt_version: " v2 ",
      },
      { condition_text: "No rationale", rationale: "  " },
      {
        condition_text: "Odd",
        rationale: "x",
        signal_type: "weather",
        threshold_value: Number.NaN,
        direction: "up",
      },
      null,
    ],
  }));
  assertEquals(drafts, [
    {
      condition_id: "ks_x",
      condition_text: "Price falls",
      signal_type: "price_move_pct",
      rationale: "r",
      threshold_value: 7.5,
      threshold_unit: "pct",
      direction: "below",
      prompt_version: "v2",
    },
    { condition_id: "ks_3", condition_text: "Odd", signal_type: "custom", rationale: "x" },
  ]);
});

Deno.test("sanitizeKillSwitchConditionDrafts keeps at most five and handles missing input", () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ condition_text: `c${i}`, rationale: "r" }));
  assertEquals(
    sanitizeKillSwitchConditionDrafts(deepDiveFixture({ kill_switch_conditions: many })).length,
    5,
  );
  assertEquals(sanitizeKillSwitchConditionDrafts(deepDiveFixture({ kill_switch_conditions: undefined })), []);
});

Deno.test("normalizeKillSwitchSignalType maps aliases", () => {
  assertEquals(normalizeKillSwitchSignalType("thesis_drift"), "thesis_state");
  assertEquals(normalizeKillSwitchSignalType(" Filing "), "sec_filing");
  assertEquals(normalizeKillSwitchSignalType("sentiment"), "news_sentiment");
  assertEquals(normalizeKillSwitchSignalType(undefined), "custom");
});

Deno.test("sanitizeNameRelationshipDrafts swaps, filters, clamps and dedupes", () => {
  const base = { relationship_type: "supplier", confidence: 0.5, evidence_text: "e", rationale: "r" };
  const relationships: NameRelationshipDraft[] = [
    { ...base, source_ticker: "aapl", target_ticker: "tsm", confidence: 1.7 }, // swapped, clamped
    { ...base, source_ticker: "TSM", target_ticker: "AAPL" }, // same id as above, dropped
    { ...base, source_ticker: "MSFT", target_ticker: "GOOG" }, // not about AAPL
    { ...base, source_ticker: "QCOM", target_ticker: "AAPL", relationship_type: "friend" },
    { ...base, source_ticker: "AVGO", target_ticker: "AAPL", evidence_text: " " },
    { ...base, source_ticker: "AAPL", target_ticker: "AAPL" },
    {
      ...base,
      source_ticker: "INTC",
      target_ticker: "AAPL",
      relationship_id: " custom ",
      prompt_version: " p1 ",
    },
  ];
  const result = sanitizeNameRelationshipDrafts({
    relationships,
    userId: "u1",
    reportId: "rpt_1",
    reportTicker: "aapl",
    nowIso: "2026-11-20T00:00:00.000Z",
  });
  assertEquals(result.length, 2);
  assertEquals(result[0], {
    relationshipId: stableNameRelationshipId({
      userId: "u1",
      sourceTicker: "TSM",
      targetTicker: "AAPL",
      relationshipType: "supplier",
    }),
    userId: "u1",
    sourceTicker: "TSM",
    targetTicker: "AAPL",
    relationshipType: "supplier",
    confidence: 1,
    state: "active",
    sourceReportId: "rpt_1",
    promptVersion: "unknown",
    evidenceText: "e",
    rationale: "r",
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  });
  assertEquals(result[0].relationshipId.startsWith("nr_"), true);
  assertEquals(result[0].relationshipId.length, 27);
  assertEquals(result[1].relationshipId, "custom");
  assertEquals(result[1].promptVersion, "p1");
});
