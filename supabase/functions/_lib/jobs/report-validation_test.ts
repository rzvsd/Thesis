// Ported from apps/product-api/tests/deepdive-m1-contract.test.ts.
// testdata/report-valid.json is the output of that file's fullFixture().
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";

import { assertIncomingAnalysisReport, validateIncomingAnalysisReport } from "./report-validation.ts";
import fullReport from "./testdata/report-valid.json" with { type: "json" };

type JsonObject = Record<string, unknown>;

const fullJson = JSON.stringify(fullReport);

function fullFixture(): JsonObject {
  return JSON.parse(fullJson) as JsonObject;
}

function legacyFixture(): JsonObject {
  return {
    report_id: "legacy-report-1",
    job_id: "job-legacy-1",
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-20T10:30:00.000Z",
    confidence: { score: 0.62, label: "medium", limiting_factors: [] },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Legacy report still parses after M1 additive contract changes.",
        status: "complete",
        evidence: [],
      },
    ],
    flags: [],
    data_sources: ["fixture-legacy"],
  };
}

Deno.test("full and legacy fixtures validate", () => {
  for (const [name, fixture] of [["full", fullFixture()], ["legacy", legacyFixture()]] as const) {
    const errors = validateIncomingAnalysisReport(fixture);
    assertEquals(errors, [], `${name} failed validation: ${errors.join("; ")}`);
    const parsed = assertIncomingAnalysisReport(fixture);
    assertEquals(parsed.type, "deep_dive");
  }
});

Deno.test("legacy payload stays valid without additive fields", () => {
  const legacy = assertIncomingAnalysisReport(legacyFixture());
  assertEquals(legacy.story_header, undefined);
  assertEquals(legacy.visual_panels, undefined);
});

Deno.test("non-object report is rejected", () => {
  assertEquals(validateIncomingAnalysisReport(null), ["report must be an object"]);
  assertThrows(() => assertIncomingAnalysisReport([]), Error, "report must be an object");
});

Deno.test("assert joins all errors with '; '", () => {
  const broken = { ...legacyFixture(), report_id: "", type: "market_pulse", flags: "nope" };
  const err = assertThrows(() => assertIncomingAnalysisReport(broken), Error);
  assertEquals(
    err.message,
    "report_id must be a non-empty string; type must be deep_dive; flags must be an array of strings",
  );
});

Deno.test("missing core fields produce the expected messages", () => {
  const errors = validateIncomingAnalysisReport({ ...legacyFixture(), sections: [], confidence: undefined });
  assertEquals(errors, ["confidence must be an object", "sections must be a non-empty array"]);
});

Deno.test("rejects unsupported visual panel type", () => {
  const invalid = { ...fullFixture(), visual_panels: [{ type: "not_supported", title: "Invalid panel" }] };
  const errors = validateIncomingAnalysisReport(invalid);
  assert(errors.some((entry) => entry.includes("visual_panels[0].type")));
});

Deno.test("rejects due-diligence sections without evidence refs or omissions", () => {
  const invalid = {
    ...fullFixture(),
    due_diligence: {
      prompt_version: "m8-due-diligence-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "financial_analysis",
          title: "Financial Analysis",
          summary: "Invalid section",
          narrative_paragraphs: ["Paragraph one."],
          key_points: [],
          evidence_refs: [],
          omissions: [],
          coverage_state: "full",
        },
      ],
    },
  };
  const errors = validateIncomingAnalysisReport(invalid);
  assert(errors.some((entry) => entry.includes("must include evidence_refs or omissions")));
});

Deno.test("rejects malformed financial-analysis and value-discipline payloads", () => {
  const base = fullFixture();
  const invalid = {
    ...base,
    financial_analysis: {
      ...(base.financial_analysis as JsonObject),
      trend_metrics: [
        {
          key: "revenue_cagr_3y_pct",
          label: "Revenue CAGR (3y)",
          value: 4.8,
          unit: "pct",
          status: "invalid_status",
          direction: "improving",
        },
      ],
    },
    value_discipline: {
      ...(base.value_discipline as JsonObject),
      signals: [
        {
          key: "roa_positive",
          label: "Positive return on assets",
          family: "profitability",
          status: "invalid_status",
          reason: "Invalid test status.",
        },
      ],
    },
  };
  const errors = validateIncomingAnalysisReport(invalid);
  assert(errors.some((entry) => entry.includes("financial_analysis.trend_metrics[0].status")));
  assert(errors.some((entry) => entry.includes("value_discipline.signals[0].status")));
});

Deno.test("rejects malformed investment-memo support type", () => {
  const base = fullFixture();
  const invalid = {
    ...base,
    investment_memo: {
      ...(base.investment_memo as JsonObject),
      material_claims: [
        {
          claim_id: "claim-thesis-direction",
          section_id: "investment_thesis",
          statement: "Invalid support type claim.",
          materiality: "material",
          supports: [{ support_type: "invalid_support", ref_id: "qoq:revenue", summary: "Revenue up." }],
        },
      ],
    },
  };
  const errors = validateIncomingAnalysisReport(invalid);
  assert(
    errors.some((entry) => entry.includes("investment_memo.material_claims[0].supports[0].support_type")),
  );
});
