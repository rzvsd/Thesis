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
  anyOf?: readonly JsonSchema[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWithSchema(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (schema.anyOf && schema.anyOf.length > 0) {
    const branchMatched = schema.anyOf.some((branch) => {
      const branchErrors: string[] = [];
      validateWithSchema(value, branch, path, branchErrors);
      return branchErrors.length === 0;
    });
    if (!branchMatched) {
      errors.push(`${path} must satisfy at least one conditional schema branch`);
    }
  }

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
    issuer: {
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      domicile_country: "US",
      region: "North America",
      sector: "Technology",
      industry: "Consumer Electronics"
    },
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
    due_diligence: {
      prompt_version: "m8-due-diligence-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "financial_analysis",
          title: "Financial Analysis",
          summary: "Financial performance remains constructive with explicit omission handling.",
          narrative_paragraphs: [
            "Revenue, margin, and free-cash-flow trends are discussed together so the report does not over-index on a single headline metric.",
            "Where annual history is complete enough, the report turns those trends into a more durable financial read rather than a quarter-only reaction."
          ],
          key_points: ["Revenue trend remains constructive.", "Cash conversion still matters."],
          evidence_refs: ["section:revenue_margin_analysis", "metric:revenue_cagr_3y_pct"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "competitive_positioning",
          title: "Competitive Positioning",
          summary: "Competitive read stays grounded in approved evidence only.",
          narrative_paragraphs: [
            "The report uses segment mix and approved context to discuss where the business still looks durable.",
            "It does not claim unsupported market-share precision when the source set is thinner than that."
          ],
          key_points: ["Segment mix remains relevant."],
          evidence_refs: ["section:management_commentary"],
          omissions: ["Exact market-share evidence is not part of this fixture."],
          coverage_state: "partial"
        },
        {
          section_id: "management_and_governance",
          title: "Management and Governance",
          summary: "Management commentary is usable, governance remains intentionally constrained.",
          narrative_paragraphs: [
            "Management tone is interpreted through approved transcript and filing evidence rather than impressionistic commentary.",
            "Governance detail is limited unless proxy-grade materials are explicitly available in the run."
          ],
          key_points: ["Management commentary is available."],
          evidence_refs: ["section:management_commentary"],
          omissions: ["Proxy-grade governance detail unavailable in this fixture."],
          coverage_state: "partial"
        },
        {
          section_id: "risks_and_challenges",
          title: "Risks and Challenges",
          summary: "Risks remain falsifiable through explicit break conditions.",
          narrative_paragraphs: [
            "The risk section uses explicit kill switches and omission notes rather than generic warnings.",
            "That keeps the report accountable to conditions that could actually change the stance."
          ],
          key_points: ["Risk review is falsifiable."],
          evidence_refs: ["section:management_commentary", "kill_switch:guidance"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "growth_opportunities_and_outlook",
          title: "Growth Opportunities and Outlook",
          summary: "Outlook is discussed conservatively and only where approved evidence supports it.",
          narrative_paragraphs: [
            "Growth opportunities are framed around visible business drivers and management commentary.",
            "The report avoids stretching the source plane into unsupported long-range forecasts."
          ],
          key_points: ["Growth outlook stays evidence-aware."],
          evidence_refs: ["section:quarter_over_quarter_changes"],
          omissions: [],
          coverage_state: "full"
        },
        {
          section_id: "valuation_and_thesis_stance",
          title: "Valuation and Thesis Stance",
          summary: "Valuation stays deterministic and tied to stance language rather than buy or sell labels.",
          narrative_paragraphs: [
            "The valuation section keeps fair-value framing inside a deterministic scenario framework.",
            "It also explains what would change the current stance instead of treating price targets as the thesis itself."
          ],
          key_points: ["Valuation is deterministic."],
          evidence_refs: ["section:valuation", "valuation:fair_value_mid"],
          omissions: [],
          coverage_state: "full"
        }
      ]
    },
    filing_intelligence: {
      prompt_version: "ph7-m11-filing-intelligence-v1",
      generation_mode: "deterministic_fixture",
      latest_filing: {
        form: "10-Q",
        period: "2025-Q4",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        filing_date: "2026-01-30"
      },
      comparison_filings: [
        {
          form: "10-Q",
          period: "2025-Q3",
          fiscal_year: 2025,
          fiscal_quarter: 3
        },
        {
          form: "10-Q",
          period: "2024-Q4",
          fiscal_year: 2024,
          fiscal_quarter: 4
        },
        {
          form: "10-K",
          period: "2025-FY",
          fiscal_year: 2025
        }
      ],
      metric_deltas: [
        {
          metric: "revenue",
          label: "Revenue",
          basis: "yoy",
          current_period: "2025-Q4",
          reference_period: "2024-Q4",
          current_value: 99000000000,
          reference_value: 94000000000,
          delta: 5000000000,
          delta_pct: 5.3,
          unit: "currency",
          direction: "improved",
          plain_english: "Revenue increased versus the same quarter last year.",
          why_it_matters: "Revenue shows whether demand is expanding before margin effects.",
          evidence_refs: ["sec-xbrl-aapl-latest-2025-q4"]
        }
      ],
      language_deltas: [
        {
          section: "management_commentary",
          current_excerpt: "Management highlighted durable services revenue and margin discipline.",
          change_type: "new",
          plain_english: "Management commentary is available, but numbers still own the memo.",
          evidence_refs: ["management-commentary-aapl-2025-q4"]
        }
      ],
      segment_deltas: [],
      memo: {
        the_filing_read: "The latest filing read is centered on revenue, margin, and cash conversion rather than generic company description.",
        what_changed: "Revenue improved year over year, while the memo keeps timeframe-specific comparisons separate.",
        the_good: "The good side is that at least one core filing line improved with SEC-backed evidence.",
        the_bad: "The bad side is that segment-level evidence is not complete enough for a stronger mix claim.",
        the_interesting: "The interesting question is whether the numbers and management language keep agreeing.",
        management_tone: "Management tone is treated as context and tested against the filing numbers.",
        risk_watch: "The next filing should confirm whether revenue keeps converting into margin and cash flow.",
        plain_english_takeaway: "Plain English: the memo reads the filing as a business update, not a quote screen.",
        what_to_watch_next: "Watch revenue, margins, free cash flow, debt, share count, and risk language in the next filing."
      },
      top_changes: ["Revenue improved on a YOY basis."],
      good: ["Revenue improved on a YOY basis."],
      bad: [],
      interesting: ["Management language and filing numbers should be compared together."],
      omissions: [
        {
          family: "segments",
          reason_code: "missing_segment_data",
          reason: "Segment data was unavailable in the fixture.",
          blocking: false
        }
      ],
      evidence: [
        {
          evidence_id: "sec-xbrl-aapl-latest-2025-q4",
          source_type: "filing",
          source_name: "SEC companyfacts/XBRL quarterly snapshot",
          excerpt: "AAPL 2025-Q4 SEC-backed financial snapshot.",
          retrieved_at: "2026-04-22T10:00:00.000Z"
        }
      ]
    },
    structural_context: {
      subject_type: "issuer",
      subject_id: "AAPL",
      as_of: "2026-04-22",
      coverage_state: "partial",
      summary:
        "U.S. structural context remains supportive for premium-device demand, while debt and inflation keep the backdrop disciplined.",
      issuer_metadata: {
        currency: "USD",
        domicile_country: "US",
        region: "North America",
        sector: "Technology",
        industry: "Consumer Electronics"
      },
      observations: [
        {
          observation_id: "world-bank-us-gdp-per-capita",
          family: "gdp_per_capita",
          label: "GDP per capita",
          summary: "High disposable-income context supports premium hardware and services spend.",
          geography: "United States",
          period: "2025",
          source_family: "world_bank",
          retrieval: {
            source: {
              source_id: "WB_NY_GDP_PCAP_CD",
              source_family: "world_bank",
              source_name: "World Bank GDP per capita",
              source_url: "https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.PCAP.CD",
              agency: "World Bank",
              agency_series_id: "NY.GDP.PCAP.CD"
            },
            retrieved_at: "2026-04-22T10:00:00.000Z",
            retrieval_status: "fresh",
            source_period: "2025"
          },
          missing_fields: [],
          value: 82500,
          unit: "usd"
        }
      ],
      omissions: [
        {
          omission_id: "imf-fx-reserves-unavailable",
          family: "fx_reserves",
          source_family: "imf",
          reason_code: "source_unavailable",
          reason_text: "IMF reserves feed was unavailable in this fixture run.",
          blocking: false
        }
      ],
      retrievals: [
        {
          source: {
            source_id: "WB_NY_GDP_PCAP_CD",
            source_family: "world_bank",
            source_name: "World Bank GDP per capita",
            source_url: "https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.PCAP.CD",
            agency: "World Bank",
            agency_series_id: "NY.GDP.PCAP.CD"
          },
          retrieved_at: "2026-04-22T10:00:00.000Z",
          retrieval_status: "fresh",
          source_period: "2025"
        }
      ]
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
    due_diligence: {
      prompt_version: "m8-due-diligence-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "financial_analysis",
          title: "Financial Analysis",
          summary: "Financial coverage is limited because core history is missing.",
          narrative_paragraphs: [
            "The report preserves the available financial read but avoids presenting a stronger trend case than the sparse evidence allows."
          ],
          key_points: ["Sparse-data checkpoint only."],
          evidence_refs: [],
          omissions: ["Annual history is insufficient for a stronger financial read."],
          coverage_state: "limited"
        }
      ]
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

test("M1 contract accepts issuer metadata when present", () => {
  const report: AnalysisReport = {
    ...legacyReportFixture(),
    schema_version: "2.0",
    issuer: {
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      domicile_country: "US"
    }
  };

  const errors = schemaErrors(report);
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("M6 contract accepts structural context pack", () => {
  const report = fullReportFixture();
  const errors = schemaErrors(report);
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(report.structural_context?.subject_type, "issuer");
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

test("M1 contract rejects due-diligence sections without evidence refs or omissions", () => {
  const invalid = {
    ...fullReportFixture(),
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
          coverage_state: "full"
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = schemaErrors(invalid);
  assert.ok(errors.some((entry) => entry.includes("must satisfy at least one conditional schema branch")));
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

test("M4 contract rejects invalid investment-memo support type", () => {
  const base = fullReportFixture();
  const baseMemo = (base.investment_memo as Record<string, unknown> | undefined) ?? {};
  const invalid = {
    ...base,
    investment_memo: {
      ...baseMemo,
      material_claims: [
        {
          claim_id: "claim-1",
          section_id: "investment_thesis",
          statement: "Invalid support type claim.",
          materiality: "material",
          supports: [
            {
              support_type: "invalid_support",
              ref_id: "x",
              summary: "bad"
            }
          ]
        }
      ]
    }
  } as unknown as AnalysisReport;

  const errors = schemaErrors(invalid);
  assert.ok(errors.some((entry) =>
    entry.includes("investment_memo.material_claims[0].supports[0].support_type")
  ));
});
