// Port of apps/product-api/tests/deepdive-m1-contract.test.ts (validation of incoming Deep Dive reports).
import assert from "node:assert/strict";

import { assertIncomingAnalysisReport, validateIncomingAnalysisReport } from "./validation.ts";
import {
  degradedFixture,
  fullFixture,
  hasTemplateCoverage,
  legacyFixture,
  noPriorThesisFixture,
  partialFixture,
  sparseFixture,
} from "./testdata/contract_fixtures.ts";

type JsonObject = Record<string, unknown>;
const test = Deno.test;

function assertFixtureValid(name: string, fixture: JsonObject): void {
  const errors = validateIncomingAnalysisReport(fixture);
  assert.equal(errors.length, 0, `${name} failed validation: ${errors.join("; ")}`);
}

test("M1 fixtures validate for full/partial/sparse/degraded/no-prior/legacy", () => {
  const fixtures: Array<[string, JsonObject]> = [
    ["full", fullFixture()],
    ["partial", partialFixture()],
    ["sparse", sparseFixture()],
    ["degraded", degradedFixture()],
    ["no-prior", noPriorThesisFixture()],
    ["legacy", legacyFixture()],
  ];

  fixtures.forEach(([name, fixture]) => {
    assertFixtureValid(name, fixture);
    const parsed = assertIncomingAnalysisReport(fixture);
    assert.equal(parsed.type, "deep_dive");
  });
});

test("M1 fixtures represent template areas via sections or explicit omissions", () => {
  const fixtures: Array<[string, JsonObject]> = [
    ["full", fullFixture()],
    ["sparse", sparseFixture()],
    ["degraded", degradedFixture()],
    ["no-prior", noPriorThesisFixture()],
  ];

  fixtures.forEach(([name, fixture]) => {
    assert.ok(hasTemplateCoverage(fixture), `${name} fixture does not satisfy template coverage`);
  });
});

test("M1 keeps legacy payloads valid without new additive fields", () => {
  const legacy = assertIncomingAnalysisReport(legacyFixture());
  assert.equal(legacy.story_header, undefined);
  assert.equal(legacy.change_summary, undefined);
  assert.equal(legacy.visual_panels, undefined);
  assert.equal(legacy.coverage_truth, undefined);
});

test("M1 rejects unsupported additive payload shape", () => {
  const invalid = {
    ...fullFixture(),
    visual_panels: [{ type: "not_supported", title: "Invalid panel" }],
  };
  const errors = validateIncomingAnalysisReport(invalid);
  assert.ok(errors.some((entry) => entry.includes("visual_panels[0].type")));
});

test("M1 rejects due-diligence sections without evidence refs or omissions", () => {
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
  assert.ok(errors.some((entry) => entry.includes("must include evidence_refs or omissions")));
});

test("M2 rejects malformed financial-analysis payloads", () => {
  const base = fullFixture();
  const baseFinancialAnalysis = (base.financial_analysis as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    financial_analysis: {
      ...baseFinancialAnalysis,
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
  };

  const errors = validateIncomingAnalysisReport(invalid);
  assert.ok(errors.some((entry) => entry.includes("financial_analysis.trend_metrics[0].status")));
});

test("M3 rejects malformed value-discipline payloads", () => {
  const base = fullFixture();
  const baseValueDiscipline = (base.value_discipline as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    value_discipline: {
      ...baseValueDiscipline,
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
  assert.ok(errors.some((entry) => entry.includes("value_discipline.signals[0].status")));
});

test("M4 rejects malformed investment-memo support type", () => {
  const base = fullFixture();
  const baseMemo = (base.investment_memo as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    investment_memo: {
      ...baseMemo,
      material_claims: [
        {
          claim_id: "claim-thesis-direction",
          section_id: "investment_thesis",
          statement: "Invalid support type claim.",
          materiality: "material",
          supports: [
            {
              support_type: "invalid_support",
              ref_id: "qoq:revenue",
              summary: "Revenue moved up quarter-over-quarter.",
            },
          ],
        },
      ],
    },
  };

  const errors = validateIncomingAnalysisReport(invalid);
  assert.ok(
    errors.some((entry) => entry.includes("investment_memo.material_claims[0].supports[0].support_type")),
  );
});
