// Deep Dive fixtures from apps/product-api/tests/deepdive-m1-contract.test.ts (copied unchanged). Test data only.

type JsonObject = Record<string, unknown>;

export function legacyFixture(): JsonObject {
  return {
    report_id: "legacy-report-1",
    job_id: "job-legacy-1",
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-20T10:30:00.000Z",
    confidence: {
      score: 0.62,
      label: "medium",
      limiting_factors: [],
    },
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

export function fullFixture(): JsonObject {
  return {
    ...legacyFixture(),
    report_id: "full-report-1",
    schema_version: "2.0",
    story_header: {
      headline: "AAPL: quality holds while valuation discipline remains key",
      thesis_summary: "The thesis remains intact with disciplined upside.",
      why_now: "Recent deltas changed confidence and risk framing.",
      reader_takeaway: "Read the change stack first, then validate the proof layer.",
      stance_label: "neutral",
    },
    change_summary: {
      previous_view: "Prior view leaned more aggressive on growth acceleration.",
      current_view: "Current view is constructive with tighter risk controls.",
      top_changes: [
        {
          title: "Cash conversion improved",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Operating cash flow outpaced earnings growth.",
          why_it_matters: "Higher cash conversion supports thesis durability.",
        },
      ],
    },
    visual_panels: [
      {
        type: "trust_scorecard",
        title: "Trust scorecard",
        freshness_state: "fresh",
        contradiction_state: "none",
        valuation_state: "available",
        evidence_count: 3,
      },
      {
        type: "metric_delta",
        title: "Financial deltas",
        metrics: [
          {
            label: "Revenue",
            current_value: 120,
            reference_value: 112,
            delta_pct: 7.1,
            basis: "yoy",
            direction: "up",
          },
        ],
      },
    ],
    explainers: {
      signal: "Signal shows directional evidence balance.",
      confidence: "Confidence reflects evidence depth and data quality.",
      freshness: "Freshness reflects recency of reviewed material events.",
      valuation: "Valuation reflects deterministic scenario assumptions.",
      omissions: "Omissions show where precision is not supported.",
    },
    watch_items: ["Watch gross-margin trend in the next quarter."],
    coverage_truth: {
      summary: "Full fixture covers every required template area.",
      covered: [
        "investment thesis",
        "what changed",
        "business quality",
        "financial statement analysis",
        "value discipline",
        "valuation",
        "risks and kill switches",
        "evidence book",
        "appendix",
      ],
      missing: [],
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
            "Confidence depends on durable cash conversion.",
          ],
        },
        {
          section_id: "what_changed",
          title: "What Changed",
          narrative: "Recent quarters improved cash conversion and margin stability.",
          key_points: ["Revenue improved versus baseline."],
        },
        {
          section_id: "business_quality",
          title: "Business Quality",
          narrative: "Quality is anchored on pricing power and recurring ecosystem demand.",
          key_points: ["Business quality remains durable."],
        },
        {
          section_id: "valuation",
          title: "Valuation",
          narrative: "Valuation range remains explicit and assumption-led.",
          key_points: ["Valuation is deterministic."],
        },
        {
          section_id: "risks",
          title: "Risks",
          narrative: "Primary risks are omission visibility and multiple compression.",
          key_points: ["Missing-data controls remain explicit."],
        },
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
              summary: "Revenue moved up quarter-over-quarter.",
            },
          ],
        },
      ],
      unsupported_claims: [],
      sparse_data_honesty_note:
        "Sparse-data handling is inactive for this fixture because core inputs are present.",
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
            "Where annual history is complete enough, the report turns those trends into a more durable financial read rather than a quarter-only reaction.",
          ],
          key_points: ["Revenue trend remains constructive.", "Cash conversion still matters."],
          evidence_refs: ["section:revenue_margin_analysis", "metric:revenue_cagr_3y_pct"],
          omissions: [],
          coverage_state: "full",
        },
        {
          section_id: "competitive_positioning",
          title: "Competitive Positioning",
          summary: "Competitive read stays grounded in approved evidence only.",
          narrative_paragraphs: [
            "The report uses segment mix and approved context to discuss where the business still looks durable.",
            "It does not claim unsupported market-share precision when the source set is thinner than that.",
          ],
          key_points: ["Segment mix remains relevant."],
          evidence_refs: ["section:management_commentary"],
          omissions: ["Exact market-share evidence is not part of this fixture."],
          coverage_state: "partial",
        },
        {
          section_id: "management_and_governance",
          title: "Management and Governance",
          summary: "Management commentary is usable, governance remains intentionally constrained.",
          narrative_paragraphs: [
            "Management tone is interpreted through approved transcript and filing evidence rather than impressionistic commentary.",
            "Governance detail is limited unless proxy-grade materials are explicitly available in the run.",
          ],
          key_points: ["Management commentary is available."],
          evidence_refs: ["section:management_commentary"],
          omissions: ["Proxy-grade governance detail unavailable in this fixture."],
          coverage_state: "partial",
        },
        {
          section_id: "risks_and_challenges",
          title: "Risks and Challenges",
          summary: "Risks remain falsifiable through explicit break conditions.",
          narrative_paragraphs: [
            "The risk section uses explicit kill switches and omission notes rather than generic warnings.",
            "That keeps the report accountable to conditions that could actually change the stance.",
          ],
          key_points: ["Risk review is falsifiable."],
          evidence_refs: ["section:management_commentary", "kill_switch:guidance"],
          omissions: [],
          coverage_state: "full",
        },
        {
          section_id: "growth_opportunities_and_outlook",
          title: "Growth Opportunities and Outlook",
          summary: "Outlook is discussed conservatively and only where approved evidence supports it.",
          narrative_paragraphs: [
            "Growth opportunities are framed around visible business drivers and management commentary.",
            "The report avoids stretching the source plane into unsupported long-range forecasts.",
          ],
          key_points: ["Growth outlook stays evidence-aware."],
          evidence_refs: ["section:quarter_over_quarter_changes"],
          omissions: [],
          coverage_state: "full",
        },
        {
          section_id: "valuation_and_thesis_stance",
          title: "Valuation and Thesis Stance",
          summary:
            "Valuation stays deterministic and tied to stance language rather than buy or sell labels.",
          narrative_paragraphs: [
            "The valuation section keeps fair-value framing inside a deterministic scenario framework.",
            "It also explains what would change the current stance instead of treating price targets as the thesis itself.",
          ],
          key_points: ["Valuation is deterministic."],
          evidence_refs: ["section:valuation", "valuation:fair_value_mid"],
          omissions: [],
          coverage_state: "full",
        },
      ],
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
          shares_outstanding: 15450000000,
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
          shares_outstanding: 15530000000,
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
          shares_outstanding: 15610000000,
        },
      ],
      quarterly_history: [
        {
          period: "2025-Q4",
          period_type: "quarterly",
          fiscal_year: 2025,
          fiscal_quarter: 4,
          revenue: 99000000000,
          net_income: 25500000000,
        },
      ],
      trend_metrics: [
        {
          key: "revenue_cagr_3y_pct",
          label: "Revenue CAGR (3y)",
          value: 4.8,
          unit: "pct",
          status: "available",
          direction: "improving",
        },
      ],
      quality_metrics: [
        {
          key: "cash_conversion_latest",
          label: "Cash conversion (latest)",
          value: 1.08,
          unit: "ratio",
          status: "available",
          direction: "improving",
        },
      ],
      omissions: [],
    },
    value_discipline: {
      score: 7,
      max_score: 9,
      available_signals: 9,
      completeness: "complete",
      context_label: "quality_mega_cap",
      interpretation: "AAPL scores 7/9 on value-discipline signals with quality-mega-cap context.",
      missing_signals: [],
      does_not_prove: "This score is a structured checkpoint, not a buy/sell recommendation.",
      signals: [
        {
          key: "roa_positive",
          label: "Positive return on assets",
          family: "profitability",
          status: "pass",
          reason: "ROA is positive.",
          value: 0.24,
        },
      ],
      value_trap_warning: {
        triggered: false,
        summary: "No active value-trap warning based on current inputs.",
        reason_codes: [],
      },
    },
    sections: [
      {
        section_id: "investment_thesis",
        title: "Investment Thesis",
        body: "Core thesis and market expectation under test.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "what_changed",
        title: "What Changed",
        body: "Key deltas since prior report and why they matter.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "business_quality",
        title: "Business Quality",
        body: "Business durability and competitive position review.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "financial_statement_analysis",
        title: "Financial Statement Analysis",
        body: "Financial trend review across core metrics.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "value_discipline",
        title: "Value Discipline",
        body: "Value signals and context-aware interpretation.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "valuation",
        title: "Valuation",
        body: "Deterministic valuation range and assumptions.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "risks_kill_switches",
        title: "Risks and Kill Switches",
        body: "Falsifiable break conditions and watch items.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "evidence_book",
        title: "Evidence Book",
        body: "Evidence coverage and freshness.",
        status: "complete",
        evidence: [],
      },
      {
        section_id: "appendix",
        title: "Appendix",
        body: "Assumptions, omissions, and raw tables.",
        status: "complete",
        evidence: [],
      },
    ],
  };
}

export function sparseFixture(): JsonObject {
  return {
    ...legacyFixture(),
    report_id: "sparse-report-1",
    schema_version: "2.0",
    story_header: {
      headline: "Sparse-data checkpoint",
      thesis_summary: "This report is omission-forward due to missing inputs.",
      why_now: "Material updates still require a transparent checkpoint.",
      reader_takeaway: "Use this as a watchlist checkpoint, not a full reset.",
      stance_label: "watch",
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
            "The report preserves the available financial read but avoids presenting a stronger trend case than the sparse evidence allows.",
          ],
          key_points: ["Sparse-data checkpoint only."],
          evidence_refs: [],
          omissions: ["Annual history is insufficient for a stronger financial read."],
          coverage_state: "limited",
        },
      ],
    },
    coverage_truth: {
      summary: "Sparse fixture intentionally omits unavailable report layers.",
      covered: ["investment thesis", "what changed"],
      missing: [
        "business quality",
        "financial statement analysis",
        "value discipline",
        "valuation",
        "risks and kill switches",
        "evidence book",
        "appendix",
      ],
    },
    sections: [
      {
        section_id: "investment_thesis",
        title: "Investment Thesis",
        body: "Sparse but explicit thesis framing.",
        status: "data_incomplete",
        evidence: [],
      },
      {
        section_id: "what_changed",
        title: "What Changed",
        body: "Limited deltas due to sparse available history.",
        status: "data_incomplete",
        evidence: [],
      },
    ],
  };
}

export function degradedFixture(): JsonObject {
  return {
    ...fullFixture(),
    report_id: "degraded-report-1",
    valuation: {
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.02,
        wacc: 0.1,
      },
      degraded_reason: "spot_price_missing",
    },
    coverage_truth: {
      summary: "Degraded fixture with explicit valuation limits.",
      covered: [
        "investment thesis",
        "what changed",
        "business quality",
        "financial statement analysis",
        "value discipline",
        "risks and kill switches",
        "evidence book",
        "appendix",
      ],
      missing: ["valuation"],
    },
  };
}

export function noPriorThesisFixture(): JsonObject {
  return {
    ...fullFixture(),
    report_id: "no-prior-thesis-report-1",
    change_summary: {
      previous_view: "No prior thesis available for this ticker.",
      current_view: "This report establishes the first baseline thesis.",
      top_changes: [
        {
          title: "Baseline initialized",
          direction: "watch",
          impact_level: "medium",
          why_it_changed: "No historical thesis record existed.",
          why_it_matters: "Future runs can now track thesis drift deterministically.",
        },
      ],
    },
  };
}

export function partialFixture(): JsonObject {
  return {
    ...legacyFixture(),
    report_id: "partial-report-1",
    schema_version: "2.0",
    story_header: {
      headline: "Partial additive fixture",
      thesis_summary: "Only story header is present for compatibility testing.",
      why_now: "Ensures optional additive fields are truly optional.",
      reader_takeaway: "Compatibility remains intact when only one new block exists.",
      stance_label: "neutral",
    },
  };
}

export function hasTemplateCoverage(fixture: JsonObject): boolean {
  const sectionIds = Array.isArray(fixture.sections)
    ? fixture.sections
      .filter((entry): entry is JsonObject => typeof entry === "object" && entry !== null)
      .map((entry) => String(entry.section_id ?? "").toLowerCase())
    : [];

  const coverageTruth = fixture.coverage_truth;
  const missing = coverageTruth && typeof coverageTruth === "object" && !Array.isArray(coverageTruth)
    ? Array.isArray((coverageTruth as JsonObject).missing)
      ? ((coverageTruth as JsonObject).missing as unknown[])
        .map((entry) => String(entry).toLowerCase())
      : []
    : [];

  const requirements: Record<string, string[]> = {
    investment_thesis: ["investment_thesis", "investment thesis"],
    what_changed: ["what_changed", "what changed"],
    business_quality: ["business_quality", "business quality"],
    financial_statement_analysis: ["financial_statement_analysis", "financial statement analysis"],
    value_discipline: ["value_discipline", "value discipline"],
    valuation: ["valuation"],
    risks_kill_switches: ["risks_kill_switches", "risks and kill switches", "risks"],
    evidence_book: ["evidence_book", "evidence book"],
    appendix: ["appendix"],
  };

  return Object.values(requirements).every((aliases) =>
    aliases.some(
      (alias) =>
        sectionIds.some((sectionId) => sectionId.includes(alias)) ||
        missing.some((missingItem) => missingItem.includes(alias)),
    )
  );
}
