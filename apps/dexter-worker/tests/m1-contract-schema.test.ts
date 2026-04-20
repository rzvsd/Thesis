import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisReport } from "../../../packages/contracts/src";
import { validateAnalysisReport } from "../src/schema-validation";

function legacyFixture(): AnalysisReport {
  return {
    report_id: "legacy-rpt-dx-1",
    job_id: "job-legacy-dx-1",
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-20T11:00:00.000Z",
    confidence: {
      score: 0.55,
      label: "medium",
      limiting_factors: []
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Legacy payload for backward compatibility.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

function fullFixture(): AnalysisReport {
  return {
    ...legacyFixture(),
    report_id: "full-rpt-dx-1",
    schema_version: "2.0",
    story_header: {
      headline: "AAPL full fixture",
      thesis_summary: "Full fixture summary.",
      why_now: "Full fixture why now.",
      reader_takeaway: "Full fixture takeaway.",
      stance_label: "neutral"
    },
    change_summary: {
      previous_view: "Previous view from prior report.",
      current_view: "Current view after latest evidence.",
      top_changes: [
        {
          title: "Cash conversion improved",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Cash flow improved versus prior period.",
          why_it_matters: "Thesis quality depends on durable cash conversion."
        }
      ]
    },
    visual_panels: [
      {
        type: "metric_delta",
        title: "Metric deltas",
        metrics: [
          {
            label: "Revenue",
            current_value: 120,
            reference_value: 110,
            delta_pct: 9.1,
            basis: "yoy",
            direction: "up"
          }
        ]
      }
    ],
    explainers: {
      signal: "Signal explainer",
      confidence: "Confidence explainer",
      freshness: "Freshness explainer",
      valuation: "Valuation explainer",
      omissions: "Omissions explainer"
    },
    watch_items: ["Watch margin durability."],
    coverage_truth: {
      summary: "Full fixture coverage summary",
      covered: ["investment thesis", "what changed"],
      missing: []
    },
    investment_memo: {
      prompt_version: "m4-synthesizer-fixture-v1",
      generation_mode: "deterministic_fixture",
      company_angle: "installed-base monetization and ecosystem pricing power",
      decision_question:
        "Does AAPL still justify confidence on installed-base monetization and ecosystem pricing power?",
      sections: [
        {
          section_id: "investment_thesis",
          title: "Investment Thesis",
          narrative: "AAPL remains a constructive thesis with explicit valuation discipline.",
          key_points: [
            "Signal is neutral with stable quality.",
            "Confidence depends on durable cash conversion."
          ]
        },
        {
          section_id: "what_changed",
          title: "What Changed",
          narrative: "Recent quarters improved cash conversion and margin stability.",
          key_points: ["Revenue improved versus baseline."]
        },
        {
          section_id: "business_quality",
          title: "Business Quality",
          narrative: "Quality is anchored on pricing power and recurring ecosystem demand.",
          key_points: ["Business quality remains durable."]
        },
        {
          section_id: "valuation",
          title: "Valuation",
          narrative: "Valuation range remains explicit and assumption-led.",
          key_points: ["Valuation is deterministic."]
        },
        {
          section_id: "risks",
          title: "Risks",
          narrative: "Primary risks are omission visibility and multiple compression.",
          key_points: ["Missing-data controls remain explicit."]
        }
      ],
      material_claims: [
        {
          claim_id: "claim-thesis-direction",
          section_id: "investment_thesis",
          statement: "AAPL remains a constructive thesis with explicit valuation discipline.",
          materiality: "material",
          supports: [
            {
              support_type: "metric",
              ref_id: "qoq:revenue",
              summary: "Revenue moved up quarter-over-quarter."
            }
          ]
        }
      ],
      unsupported_claims: [],
      sparse_data_honesty_note:
        "Sparse-data handling is inactive for this fixture because core inputs are present."
    },
    financial_analysis: {
      annual_history: [
        {
          period: "2025-FY",
          period_type: "annual",
          fiscal_year: 2025,
          revenue: 389000000000,
          gross_margin: 44.0,
          operating_margin: 32.2,
          net_income: 97000000000,
          free_cash_flow: 107000000000,
          debt_total: 111000000000,
          cash_and_equivalents: 72000000000,
          shares_outstanding: 15450000000
        },
        {
          period: "2024-FY",
          period_type: "annual",
          fiscal_year: 2024,
          revenue: 372000000000,
          gross_margin: 43.5,
          operating_margin: 31.8,
          net_income: 95000000000,
          free_cash_flow: 102000000000,
          debt_total: 115000000000,
          cash_and_equivalents: 70000000000,
          shares_outstanding: 15530000000
        },
        {
          period: "2023-FY",
          period_type: "annual",
          fiscal_year: 2023,
          revenue: 355000000000,
          gross_margin: 42.8,
          operating_margin: 31.0,
          net_income: 91000000000,
          free_cash_flow: 98000000000,
          debt_total: 119000000000,
          cash_and_equivalents: 66000000000,
          shares_outstanding: 15610000000
        }
      ],
      quarterly_history: [
        {
          period: "2025-Q4",
          period_type: "quarterly",
          fiscal_year: 2025,
          fiscal_quarter: 4,
          revenue: 99000000000,
          net_income: 25500000000
        }
      ],
      trend_metrics: [
        {
          key: "revenue_cagr_3y_pct",
          label: "Revenue CAGR (3y)",
          value: 4.8,
          unit: "pct",
          status: "available",
          direction: "improving"
        }
      ],
      quality_metrics: [
        {
          key: "cash_conversion_latest",
          label: "Cash conversion (latest)",
          value: 1.08,
          unit: "ratio",
          status: "available",
          direction: "improving"
        }
      ],
      omissions: []
    },
    value_discipline: {
      score: 7,
      max_score: 9,
      available_signals: 9,
      completeness: "complete",
      context_label: "quality_mega_cap",
      interpretation:
        "AAPL scores 7/9 on value-discipline signals with quality-mega-cap context.",
      missing_signals: [],
      does_not_prove:
        "This score is a structured checkpoint, not a buy/sell recommendation.",
      signals: [
        {
          key: "roa_positive",
          label: "Positive return on assets",
          family: "profitability",
          status: "pass",
          reason: "ROA is positive.",
          value: 0.24
        }
      ],
      value_trap_warning: {
        triggered: false,
        summary: "No active value-trap warning based on current inputs.",
        reason_codes: []
      }
    }
  };
}

function sparseFixture(): AnalysisReport {
  return {
    ...legacyFixture(),
    report_id: "sparse-rpt-dx-1",
    schema_version: "2.0",
    story_header: {
      headline: "Sparse fixture",
      thesis_summary: "Sparse fixture summary.",
      why_now: "Sparse fixture why now.",
      reader_takeaway: "Sparse fixture takeaway.",
      stance_label: "watch"
    },
    coverage_truth: {
      summary: "Sparse fixture with omission-forward coverage.",
      covered: ["investment thesis"],
      missing: ["valuation", "financial statement analysis", "appendix"]
    },
    sections: [
      {
        section_id: "investment_thesis",
        title: "Investment Thesis",
        body: "Sparse thesis statement.",
        status: "data_incomplete",
        evidence: []
      }
    ]
  };
}

test("M1 dexter schema validator accepts full fixture", () => {
  const errors = validateAnalysisReport(fullFixture());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("M1 dexter schema validator accepts sparse fixture", () => {
  const errors = validateAnalysisReport(sparseFixture());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("M1 dexter schema validator accepts legacy fixture", () => {
  const errors = validateAnalysisReport(legacyFixture());
  assert.equal(errors.length, 0, errors.join("; "));
});

test("M1 dexter schema validator rejects unsupported panel types", () => {
  const invalid = {
    ...fullFixture(),
    visual_panels: [{ type: "unsupported_type", title: "Invalid panel" }]
  } as unknown as AnalysisReport;

  const errors = validateAnalysisReport(invalid);
  assert.ok(errors.some((entry) => entry.includes("visual_panels[0].type")));
});

test("M2 dexter schema validator rejects malformed financial-analysis status", () => {
  const base = fullFixture();
  const baseFinancialAnalysis =
    (base.financial_analysis as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    financial_analysis: {
      ...baseFinancialAnalysis,
      quality_metrics: [
        {
          key: "cash_conversion_latest",
          label: "Cash conversion (latest)",
          value: 1.08,
          unit: "ratio",
          status: "bad_status",
          direction: "improving"
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = validateAnalysisReport(invalid);
  assert.ok(errors.some((entry) => entry.includes("financial_analysis.quality_metrics[0].status")));
});

test("M3 dexter schema validator rejects malformed value-discipline status", () => {
  const base = fullFixture();
  const baseValueDiscipline =
    (base.value_discipline as Record<string, unknown> | undefined) ?? {};
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
          reason: "Invalid test status."
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = validateAnalysisReport(invalid);
  assert.ok(errors.some((entry) => entry.includes("value_discipline.signals[0].status")));
});

test("M4 dexter schema validator rejects malformed investment-memo support type", () => {
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
              summary: "Revenue moved up quarter-over-quarter."
            }
          ]
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = validateAnalysisReport(invalid);
  assert.ok(errors.some((entry) =>
    entry.includes("investment_memo.material_claims[0].supports[0].support_type")
  ));
});
