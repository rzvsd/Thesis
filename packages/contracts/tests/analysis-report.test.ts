import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisReport } from "../src/analysis-report";
import { analysisReportSchema } from "../src/analysis-report";

type JsonSchema = {
  type?: string;
  enum?: readonly unknown[];
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWithSchema(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (schema.type === "string" && typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  if (schema.type === "number" && typeof value !== "number") {
    errors.push(`${path} must be a number`);
    return;
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return;
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((entry, index) => {
        validateWithSchema(entry, schema.items as JsonSchema, `${path}[${index}]`, errors);
      });
    }
    return;
  }

  if (schema.type === "object" || schema.properties || schema.required) {
    if (!isObject(value)) {
      errors.push(`${path} must be an object`);
      return;
    }

    const required = schema.required ?? [];
    for (const key of required) {
      if (value[key] === undefined) {
        errors.push(`${path}.${key} is required`);
      }
    }

    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) {
        validateWithSchema(value[key], childSchema, `${path}.${key}`, errors);
      }
    }
  }
}

function schemaErrors(report: AnalysisReport): string[] {
  const errors: string[] = [];
  validateWithSchema(report, analysisReportSchema as JsonSchema, "report", errors);
  return errors;
}

function legacyReportFixture(): AnalysisReport {
  return {
    report_id: "legacy-rpt-1",
    job_id: "job-legacy-1",
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-20T10:00:00.000Z",
    confidence: {
      score: 0.6,
      label: "medium",
      limiting_factors: []
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Legacy report body still valid.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

function fullReportFixture(): AnalysisReport {
  return {
    ...legacyReportFixture(),
    report_id: "full-rpt-1",
    schema_version: "2.0",
    signal: {
      value: "neutral",
      reasons: ["Signal is balanced."],
      evidence: []
    },
    story_header: {
      headline: "AAPL: quality and valuation in balance",
      thesis_summary: "Quality remains strong, valuation still needs discipline.",
      why_now: "Recent updates changed conviction and timing.",
      reader_takeaway: "Review the change stack, then validate in proof sections.",
      stance_label: "neutral"
    },
    change_summary: {
      previous_view: "Prior report leaned positive on operating leverage.",
      current_view: "Current report remains constructive with tighter risk framing.",
      top_changes: [
        {
          title: "Cash flow durability improved",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Operating cash flow grew above expected trend.",
          why_it_matters: "The thesis depends on quality earnings converting to cash."
        }
      ]
    },
    visual_panels: [
      {
        type: "trust_scorecard",
        title: "Trust scorecard",
        freshness_state: "fresh",
        contradiction_state: "none",
        valuation_state: "available",
        evidence_count: 4
      },
      {
        type: "metric_delta",
        title: "Financial deltas",
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
      signal: "Signal reflects directional read of current evidence.",
      confidence: "Confidence reflects data completeness and contradiction state.",
      freshness: "Freshness reflects recency of reviewed material events.",
      valuation: "Valuation reflects deterministic assumptions and scenario range.",
      omissions: "Omissions define what the model could not assert."
    },
    watch_items: ["Watch gross margin trend versus consensus expectations."],
    coverage_truth: {
      summary: "Full fixture covers all primary report layers.",
      covered: [
        "investment thesis",
        "what changed",
        "business quality",
        "financial statement analysis",
        "value discipline",
        "valuation",
        "risks and kill switches",
        "evidence book",
        "appendix"
      ],
      missing: []
    },
    financial_analysis: {
      annual_history: [
        {
          period: "2025-FY",
          period_type: "annual",
          fiscal_year: 2025,
          revenue: 390000000000,
          gross_margin: 44.1,
          operating_margin: 32.4,
          net_income: 98000000000,
          free_cash_flow: 108000000000,
          debt_total: 110000000000,
          cash_and_equivalents: 71000000000,
          shares_outstanding: 15400000000
        },
        {
          period: "2024-FY",
          period_type: "annual",
          fiscal_year: 2024,
          revenue: 372000000000,
          gross_margin: 43.6,
          operating_margin: 31.9,
          net_income: 96000000000,
          free_cash_flow: 103000000000,
          debt_total: 114000000000,
          cash_and_equivalents: 69000000000,
          shares_outstanding: 15500000000
        },
        {
          period: "2023-FY",
          period_type: "annual",
          fiscal_year: 2023,
          revenue: 354000000000,
          gross_margin: 42.8,
          operating_margin: 31.1,
          net_income: 91000000000,
          free_cash_flow: 98000000000,
          debt_total: 119000000000,
          cash_and_equivalents: 65000000000,
          shares_outstanding: 15600000000
        }
      ],
      quarterly_history: [
        {
          period: "2025-Q4",
          period_type: "quarterly",
          fiscal_year: 2025,
          fiscal_quarter: 4,
          revenue: 99000000000,
          gross_margin: 44.4,
          operating_margin: 33.0,
          net_income: 25500000000,
          free_cash_flow: 26200000000,
          debt_total: 110000000000,
          cash_and_equivalents: 74000000000,
          shares_outstanding: 15400000000
        }
      ],
      trend_metrics: [
        {
          key: "revenue_cagr_3y_pct",
          label: "Revenue CAGR (3y)",
          value: 4.9,
          unit: "pct",
          status: "available",
          direction: "improving"
        }
      ],
      quality_metrics: [
        {
          key: "cash_conversion_latest",
          label: "Cash conversion (latest)",
          value: 1.09,
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
        },
        {
          key: "share_count_not_diluting",
          label: "Share count discipline",
          family: "capital_discipline",
          status: "pass",
          reason: "Share count did not dilute.",
          value: -0.8
        }
      ],
      value_trap_warning: {
        triggered: false,
        summary: "No active value-trap warning based on current inputs.",
        reason_codes: []
      }
    },
    sections: [
      {
        section_id: "investment_thesis",
        title: "Investment Thesis",
        body: "The core thesis and market expectation under test.",
        status: "complete",
        evidence: []
      },
      {
        section_id: "what_changed",
        title: "What Changed",
        body: "What changed and why it matters for conviction.",
        status: "complete",
        evidence: []
      }
    ]
  };
}

function sparseReportFixture(): AnalysisReport {
  return {
    ...legacyReportFixture(),
    report_id: "sparse-rpt-1",
    schema_version: "2.0",
    story_header: {
      headline: "Sparse coverage report",
      thesis_summary: "Sparse data means conviction is constrained.",
      why_now: "A limited-data review is still better than silence.",
      reader_takeaway: "Use this as a watchlist checkpoint, not a full thesis reset.",
      stance_label: "watch"
    },
    explainers: {
      signal: "Signal is limited by sparse evidence.",
      confidence: "Confidence remains low due to missing financial history.",
      freshness: "Freshness is uncertain where source recency is incomplete.",
      valuation: "Valuation is degraded because key assumptions are missing.",
      omissions: "Multiple core inputs are missing and explicitly listed."
    },
    coverage_truth: {
      summary: "Sparse fixture intentionally marks missing layers.",
      covered: ["investment thesis", "what changed"],
      missing: [
        "business quality",
        "financial statement analysis",
        "value discipline",
        "valuation",
        "evidence book",
        "appendix"
      ]
    },
    sections: [
      {
        section_id: "investment_thesis",
        title: "Investment Thesis",
        body: "Limited but explicit thesis framing.",
        status: "data_incomplete",
        evidence: []
      }
    ]
  };
}

function degradedReportFixture(): AnalysisReport {
  return {
    ...fullReportFixture(),
    report_id: "degraded-rpt-1",
    valuation: {
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.02,
        wacc: 0.1
      },
      degraded_reason: "spot_price_missing"
    },
    coverage_truth: {
      summary: "Valuation degraded fixture.",
      covered: ["investment thesis", "what changed", "financial statement analysis"],
      missing: ["valuation range precision"]
    }
  };
}

function noPriorThesisReportFixture(): AnalysisReport {
  return {
    ...fullReportFixture(),
    report_id: "no-prior-rpt-1",
    change_summary: {
      previous_view: "No prior thesis available for this name.",
      current_view: "This is the first structured thesis baseline.",
      top_changes: [
        {
          title: "Baseline established",
          direction: "watch",
          impact_level: "medium",
          why_it_changed: "No earlier Deep Dive exists for comparison.",
          why_it_matters: "Future reports can now measure thesis drift clearly."
        }
      ]
    }
  };
}

test("M1 contract accepts full fixture", () => {
  const errors = schemaErrors(fullReportFixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract accepts partial fixture", () => {
  const partial: AnalysisReport = {
    ...legacyReportFixture(),
    report_id: "partial-rpt-1",
    schema_version: "2.0",
    story_header: {
      headline: "Partial fixture headline",
      thesis_summary: "Partial fixture thesis summary.",
      why_now: "Partial fixture why now.",
      reader_takeaway: "Partial fixture takeaway.",
      stance_label: "neutral"
    }
  };
  const errors = schemaErrors(partial);
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract accepts sparse fixture", () => {
  const errors = schemaErrors(sparseReportFixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract accepts degraded valuation fixture", () => {
  const errors = schemaErrors(degradedReportFixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract accepts no-prior-thesis fixture", () => {
  const errors = schemaErrors(noPriorThesisReportFixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract keeps legacy fixtures valid", () => {
  const errors = schemaErrors(legacyReportFixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M1 contract rejects invalid visual panel type", () => {
  const invalid = {
    ...fullReportFixture(),
    visual_panels: [
      {
        type: "unknown_panel",
        title: "Bad panel"
      }
    ]
  } as unknown as AnalysisReport;

  const errors = schemaErrors(invalid);
  assert.ok(errors.some((entry) => entry.includes("visual_panels[0].type")));
});

test("M2 contract rejects invalid financial metric status", () => {
  const base = fullReportFixture();
  const baseFinancialAnalysis =
    (base.financial_analysis as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    financial_analysis: {
      ...baseFinancialAnalysis,
      trend_metrics: [
        {
          key: "revenue_cagr_3y_pct",
          label: "Revenue CAGR (3y)",
          value: 4.9,
          unit: "pct",
          status: "unsupported_status",
          direction: "improving"
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = schemaErrors(invalid);
  assert.ok(errors.some((entry) => entry.includes("financial_analysis.trend_metrics[0].status")));
});

test("M3 contract rejects invalid value-discipline signal status", () => {
  const base = fullReportFixture();
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
          status: "unknown_status",
          reason: "Invalid test status."
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = schemaErrors(invalid);
  assert.ok(errors.some((entry) => entry.includes("value_discipline.signals[0].status")));
});
