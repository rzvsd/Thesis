// Institutional Deep Dive fixture from apps/product-api/tests/deepdive-m5-pdf-export.test.ts (copied unchanged).

type JsonObject = Record<string, unknown>;

export function sampleInstitutionalReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "AAPL",
    issuer: {
      name: "Apple Inc.",
      exchange: "NASDAQ",
    },
    generated_at: "2026-04-20T08:00:00.000Z",
    confidence: {
      score: 0.74,
      label: "medium",
      limiting_factors: ["transcript_delay"],
    },
    signal: {
      value: "positive",
      reasons: ["Cash conversion remains resilient."],
      evidence: [],
    },
    story_header: {
      headline: "Cash resilience is outpacing market skepticism.",
      thesis_summary: "AAPL keeps converting demand into durable cash generation.",
      why_now: "The next review window centers on margin resilience and buyback pacing.",
      reader_takeaway: "Base thesis remains intact with moderate upside and clear risk controls.",
      stance_label: "positive",
    },
    change_summary: {
      previous_view: "Margin pressure risk dominated.",
      current_view: "Margin pressure eased while free cash flow remained durable.",
      top_changes: [
        {
          title: "Operating margin stabilized",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Cost controls offset slower top-line momentum.",
          why_it_matters: "Thesis depends on growth converting into durable operating profit.",
        },
      ],
    },
    valuation: {
      fair_value_mid: 208.0,
      fair_value_low: 178.0,
      fair_value_high: 236.0,
      spot_price: 191.0,
      implied_upside_pct: 0.089,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.095,
      },
    },
    investment_memo: {
      prompt_version: "m4-synthesizer-fixture-v1",
      generation_mode: "deterministic_fixture",
      company_angle: "durable_cash_compounder",
      decision_question: "Does margin stability support a durable free-cash-flow compounding case?",
      sections: [
        {
          section_id: "investment_thesis",
          title: "Investment Thesis",
          narrative: "Cash conversion remains the central driver of the thesis.",
          key_points: ["Cash conversion stayed resilient.", "Capital returns remain disciplined."],
        },
        {
          section_id: "what_changed",
          title: "What Changed",
          narrative: "Cost discipline improved operating margin resilience.",
          key_points: ["Operating leverage improved year over year."],
        },
        {
          section_id: "business_quality",
          title: "Business Quality",
          narrative: "Ecosystem durability continues to support margin quality.",
          key_points: ["Recurring revenue mix supports resilience."],
        },
        {
          section_id: "valuation",
          title: "Valuation",
          narrative: "Base valuation remains sensitive to WACC and terminal growth.",
          key_points: ["Range remains wide enough to require risk controls."],
        },
        {
          section_id: "risks",
          title: "Risks",
          narrative: "Execution risk and demand normalization remain key watch points.",
          key_points: ["Demand normalization could pressure margin durability."],
        },
      ],
      material_claims: [
        {
          claim_id: "claim-1",
          section_id: "investment_thesis",
          statement: "Cash conversion is still supporting thesis durability.",
          materiality: "material",
          supports: [
            {
              support_type: "metric",
              ref_id: "fcf_trend",
              summary: "Free cash flow remained positive through the latest annual snapshots.",
            },
          ],
        },
      ],
      unsupported_claims: [],
      sparse_data_honesty_note: "No major sparse-data blockers were detected in this fixture.",
    },
    filing_intelligence: {
      prompt_version: "ph7-m11-filing-intelligence-v1",
      generation_mode: "deterministic_fixture",
      latest_filing: {
        form: "10-Q",
        period: "2025-Q4",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        filing_date: "2026-01-30",
      },
      comparison_filings: [
        {
          form: "10-Q",
          period: "2025-Q3",
          fiscal_year: 2025,
          fiscal_quarter: 3,
        },
        {
          form: "10-Q",
          period: "2024-Q4",
          fiscal_year: 2024,
          fiscal_quarter: 4,
        },
      ],
      metric_deltas: [
        {
          metric: "revenue",
          label: "Revenue",
          basis: "yoy",
          current_period: "2025-Q4",
          reference_period: "2024-Q4",
          current_value: 124300,
          reference_value: 119600,
          delta: 4700,
          delta_pct: 3.9,
          unit: "currency",
          direction: "improved",
          plain_english:
            "Revenue increased versus the same quarter last year, so the filing shows more top-line demand before margins do any work.",
          why_it_matters:
            "Revenue is the first check on whether the business grew before cost control and capital returns enter the picture.",
          evidence_refs: ["sec-xbrl-aapl-latest-2025-q4"],
        },
        {
          metric: "operating_margin",
          label: "Operating margin",
          basis: "qoq",
          current_period: "2025-Q4",
          reference_period: "2025-Q3",
          current_value: 31.0,
          reference_value: 30.4,
          delta: 0.6,
          unit: "pct",
          direction: "improved",
          plain_english:
            "Operating margin improved versus the prior quarter, which means more of each dollar reached operating profit.",
          why_it_matters: "Margin follow-through is what separates healthy revenue from expensive revenue.",
          evidence_refs: ["sec-xbrl-aapl-latest-2025-q4", "sec-xbrl-aapl-prior-2025-q3"],
        },
      ],
      language_deltas: [
        {
          section: "management_commentary",
          current_excerpt: "Management highlighted durable services revenue and margin discipline.",
          change_type: "new",
          plain_english:
            "Management commentary supports the margin discussion, but the numbers still own the memo.",
          evidence_refs: ["management-commentary-aapl-2025-q4"],
        },
      ],
      segment_deltas: [],
      memo: {
        the_filing_read:
          "The filing read starts with a simple business question: did Apple become a better operating business, or did the quarter merely look cleaner on the surface? The reviewed numbers point to better revenue and firmer margin follow-through, which is useful because the top line and profit line are moving together. That does not make the filing a thesis reset by itself, but it gives the memo a cleaner base than a one-metric story.",
        what_changed:
          "Revenue improved year over year and operating margin improved versus the prior quarter. The important part is the combination. More sales are useful, but more sales with better operating conversion are more informative. The memo keeps the timeframes separate so a quarter-over-quarter margin improvement is not confused with a full annual trend.",
        the_good:
          "The good side is that the filing has measurable support in both revenue and operating margin. For a non-technical reader, that means the company did not need to rely on only cost cutting or only demand. The filing has at least two lines pointing in the same direction.",
        the_bad:
          "The weak side is coverage depth. Segment-level detail is not strong enough in this report run to say which business line carried the change. Without that layer, the memo can say the company improved, but it should be careful about explaining exactly where the improvement came from.",
        the_interesting:
          "The interesting point is agreement. When revenue, margin, and management language all lean the same way, the filing becomes easier to read. When one of those disagrees, the memo should slow down. Here the available evidence is cleaner, but still not complete enough for a sweeping claim.",
        management_tone:
          "Management commentary is useful because it tells us what leadership wants readers to notice. Thesis treats that as context, not proof. The proof remains in the filing math: revenue, margin, cash flow, debt, and share count.",
        risk_watch:
          "The next watch item is whether margin improvement repeats. One good quarter can be timing. Repetition across filing cycles is what would make the business read more durable.",
        plain_english_takeaway:
          "Plain English: this was a cleaner filing, not a victory lap. The company showed better revenue and margin follow-through, but the memo still needs segment confirmation before it can explain the full source of the improvement.",
        what_to_watch_next:
          "Next filing, watch whether revenue keeps converting into operating profit, whether free cash flow follows, and whether segment detail confirms where the improvement came from.",
      },
      top_changes: [
        "Revenue improved on a YOY basis.",
        "Operating margin improved on a QOQ basis.",
      ],
      good: ["Revenue improved on a YOY basis.", "Operating margin improved on a QOQ basis."],
      bad: ["Segment evidence is incomplete."],
      interesting: ["Revenue, margin, and management language should be tested together."],
      omissions: [
        {
          family: "segments",
          reason_code: "missing_segment_data",
          reason: "Segment data was unavailable in this report run.",
          blocking: false,
        },
      ],
      evidence: [
        {
          evidence_id: "sec-xbrl-aapl-latest-2025-q4",
          source_type: "filing",
          source_name: "SEC companyfacts/XBRL quarterly snapshot",
          excerpt: "AAPL 2025-Q4 SEC-backed financial snapshot includes revenue and operating margin.",
          retrieved_at: "2026-04-20T08:00:00.000Z",
        },
        {
          evidence_id: "management-commentary-aapl-2025-q4",
          source_type: "article",
          source_name: "Reviewed management commentary",
          excerpt: "Management highlighted durable services revenue and margin discipline.",
          retrieved_at: "2026-04-20T08:00:00.000Z",
        },
      ],
    },
    financial_indicators: {
      prompt_version: "ph7-m12-financial-indicators-v1",
      period: "FY-2025",
      basis: "mixed",
      valuation: [
        {
          indicator_id: "pe_ratio",
          label: "P/E",
          value: 34.2,
          unit: "multiple",
          period: "FY-2025",
          state: "available",
          interpretation:
            "P/E is above a classic value range, so the stock needs durable earnings quality to justify the multiple.",
          evidence_refs: ["financial-indicators-aapl-fy-2025", "financial-indicators-aapl-spot-price"],
        },
        {
          indicator_id: "ps_ratio",
          label: "P/S",
          value: 8.8,
          unit: "multiple",
          period: "FY-2025",
          state: "available",
          interpretation: "P/S is high, which means the market is paying a premium for each dollar of sales.",
          evidence_refs: ["financial-indicators-aapl-fy-2025", "financial-indicators-aapl-spot-price"],
        },
        {
          indicator_id: "fcf_yield",
          label: "FCF yield",
          value: 2.8,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation:
            "FCF yield is low for classic value, which means the stock is priced for quality or growth.",
          evidence_refs: ["financial-indicators-aapl-fy-2025", "financial-indicators-aapl-spot-price"],
        },
      ],
      profitability: [
        {
          indicator_id: "gross_margin",
          label: "Gross margin",
          value: 45,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation: "Gross margin shows how much sales value survives direct costs.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
        {
          indicator_id: "operating_margin",
          label: "Operating margin",
          value: 31,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation:
            "Operating margin is strong; the business keeps a lot of profit after operating costs.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
        {
          indicator_id: "roe",
          label: "ROE",
          value: 35,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation: "ROE is strong, suggesting the company earns a high return on shareholder capital.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      growth: [
        {
          indicator_id: "revenue_cagr_5y",
          label: "Revenue CAGR",
          value: 8,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation: "Revenue CAGR shows whether the company has actually been getting larger.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      balance_sheet: [
        {
          indicator_id: "debt_to_equity",
          label: "Debt / equity",
          value: 0.4,
          unit: "ratio",
          period: "FY-2025",
          state: "available",
          interpretation: "Debt/equity is manageable; leverage is not the main story.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      cash_flow_quality: [
        {
          indicator_id: "fcf_margin",
          label: "FCF margin",
          value: 28,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation: "FCF margin is strong; revenue is converting into real cash.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
        {
          indicator_id: "cash_conversion",
          label: "Cash conversion",
          value: 0.94,
          unit: "ratio",
          period: "FY-2025",
          state: "available",
          interpretation: "Cash conversion is healthy; reported profit is backed by cash.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      capital_allocation: [
        {
          indicator_id: "share_count_change_5y",
          label: "Share count change",
          value: -6.4,
          unit: "pct",
          period: "FY-2025",
          state: "available",
          interpretation: "Share count declined, which means buybacks or retirements helped owners.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      five_year_trends: [
        {
          indicator_id: "revenue",
          label: "Revenue",
          unit: "currency",
          current: 390000,
          one_year_ago: 381500,
          three_years_ago: 365800,
          five_years_ago: 274500,
          direction: "improving",
          plain_english: "Revenue improved over the reviewed history.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
        {
          indicator_id: "free_cash_flow",
          label: "Free cash flow",
          unit: "currency",
          current: 110000,
          one_year_ago: 107300,
          three_years_ago: 99500,
          five_years_ago: 73300,
          direction: "improving",
          plain_english: "Free cash flow improved over the reviewed history.",
          evidence_refs: ["financial-indicators-aapl-fy-2025"],
        },
      ],
      value_classification: {
        classification: "quality_growth",
        confidence: "medium",
        reasons: ["Margins, cash conversion, and long-term cash generation support a quality-growth read."],
        trap_warnings: [],
      },
      plain_english: {
        value_lens:
          "Apple is not a classic value stock. The company screens closer to quality growth: margins are high, cash conversion is strong, and debt is manageable, but the valuation multiple is above what a traditional value investor would usually call cheap.",
        business_quality:
          "Business quality is the cleaner part of the read. Profitability and cash conversion show that the company is not merely selling more; it is keeping a meaningful portion of sales as profit and cash.",
        balance_sheet_read:
          "The balance sheet does not look like the main risk in this read. Debt is manageable relative to equity, so the bigger question is valuation versus business quality.",
        cash_flow_read:
          "Cash conversion is healthy, which means reported earnings are backed by cash rather than just accounting profit.",
        five_year_read:
          "Over five years, margins stayed strong and free cash flow improved, but valuation also expanded. That means the business quality improved, but the stock did not become cheaper.",
        plain_english_takeaway:
          "Plain English: this is a quality-growth read at a premium valuation. The key question is whether earnings and free cash flow can keep growing fast enough to justify the current multiple.",
        what_to_watch_next:
          "Watch margin durability, free cash flow, share count, and whether valuation changes because earnings improve or because the market pays more for each dollar of earnings.",
      },
      omissions: [],
      evidence: [
        {
          evidence_id: "financial-indicators-aapl-fy-2025",
          source_type: "financial_data",
          source_name: "SEC companyfacts/XBRL annual snapshot",
          excerpt: "AAPL FY-2025 financial snapshot used for value-lens ratios.",
          retrieved_at: "2026-04-20T08:00:00.000Z",
        },
        {
          evidence_id: "financial-indicators-aapl-spot-price",
          source_type: "financial_data",
          source_name: "Approved Deep Dive spot/reference price",
          excerpt: "AAPL spot/reference price available to Deep Dive context.",
          retrieved_at: "2026-04-20T08:00:00.000Z",
        },
      ],
    },
    financial_analysis: {
      annual_history: [
        {
          period: "FY-2022",
          period_type: "annual",
          fiscal_year: 2022,
          revenue: 365800,
          gross_margin: 0.43,
          operating_margin: 0.298,
          free_cash_flow: 99500,
        },
        {
          period: "FY-2023",
          period_type: "annual",
          fiscal_year: 2023,
          revenue: 372100,
          gross_margin: 0.438,
          operating_margin: 0.304,
          free_cash_flow: 102400,
        },
        {
          period: "FY-2024",
          period_type: "annual",
          fiscal_year: 2024,
          revenue: 381500,
          gross_margin: 0.445,
          operating_margin: 0.309,
          free_cash_flow: 107300,
        },
        {
          period: "FY-2025",
          period_type: "annual",
          fiscal_year: 2025,
          revenue: 390000,
          gross_margin: 0.45,
          operating_margin: 0.31,
          free_cash_flow: 110000,
        },
      ],
      quarterly_history: [],
      trend_metrics: [
        {
          key: "revenue_growth",
          label: "Revenue Growth",
          value: 0.08,
          unit: "pct",
          status: "available",
          direction: "improving",
        },
      ],
      quality_metrics: [],
      omissions: [],
    },
    value_discipline: {
      score: 6,
      max_score: 9,
      available_signals: 7,
      completeness: "partial",
      context_label: "quality_mega_cap",
      interpretation: "Signals indicate durable quality, but valuation discipline still matters.",
      missing_signals: ["asset_turnover_delta"],
      does_not_prove: "This score does not replace full competitive and valuation analysis.",
      signals: [
        {
          key: "roa_positive",
          label: "ROA positive",
          family: "profitability",
          status: "pass",
          reason: "ROA remained positive in the latest annual period.",
        },
        {
          key: "operating_margin_up",
          label: "Operating margin up",
          family: "operating_efficiency",
          status: "pass",
          reason: "Operating margin improved from the prior fiscal year.",
        },
        {
          key: "share_count_discipline",
          label: "Share count discipline",
          family: "capital_discipline",
          status: "pass",
          reason: "Dilution remained contained while buybacks stayed active.",
        },
        {
          key: "cash_conversion_consistent",
          label: "Cash conversion consistent",
          family: "earnings_quality",
          status: "pass",
          reason: "Free cash flow remained aligned with operating profit.",
        },
      ],
      value_trap_warning: {
        triggered: false,
        summary: "No immediate value-trap profile in current evidence.",
        reason_codes: [],
      },
    },
    kill_switch_conditions: [
      {
        condition_id: "ks-1",
        condition_text: "Operating margin deteriorates below the recent base case.",
        signal_type: "sec_filing",
        rationale: "Margin compression would directly weaken the durable-cash thesis.",
        direction: "below",
        threshold_value: 0.03,
        threshold_unit: "pct",
      },
      {
        condition_id: "ks-2",
        condition_text: "Management guides materially below prior free-cash-flow expectations.",
        signal_type: "guidance_revision",
        rationale: "Guidance deterioration would weaken confidence in the base valuation case.",
        direction: "against_signal",
      },
      {
        condition_id: "ks-3",
        condition_text: "A material supply-chain disruption changes shipment cadence.",
        signal_type: "news_sentiment",
        rationale: "Material disruption headlines would challenge near-term execution assumptions.",
        direction: "against_signal",
      },
    ],
    watch_items: ["Re-check margin stability after the next earnings release."],
    coverage_truth: {
      summary: "Coverage is strong on financials, with moderate transcript freshness limits.",
      covered: ["financial_statements", "valuation_assumptions"],
      missing: ["fresh_transcript_excerpt"],
    },
    due_diligence: {
      prompt_version: "dd-v2-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "competitive_positioning",
          title: "Competitive Positioning",
          subtitle: "Installed-base durability and pricing power remain central.",
          summary: "Installed-base loyalty and pricing power still anchor the competitive case.",
          narrative:
            "The business remains durable because repeat engagement, ecosystem stickiness, and disciplined capital returns reinforce margin stability.",
          narrative_paragraphs: [
            "The business remains durable because repeat engagement, ecosystem stickiness, and disciplined capital returns reinforce margin stability.",
            "Competitive advantage still looks strongest where recurring ecosystem demand supports margin quality without requiring heroic assumptions.",
          ],
          key_points: [
            "Recurring ecosystem demand continues to support margin quality.",
            "Capital allocation remains disciplined rather than promotional.",
            "The next debate is durability, not basic business viability.",
          ],
          evidence_refs: ["ev-1", "fcf_trend"],
          metrics: [
            {
              label: "Positioning context",
              value: "Large-cap quality context",
            },
          ],
          omissions: ["fresh_transcript_excerpt"],
          coverage_state: "partial",
        },
        {
          section_id: "financial_analysis",
          title: "Financial Statement Analysis",
          subtitle: "Revenue, margins, and free cash flow stay supportive.",
          summary: "Four reported years show rising free cash flow with stable margins.",
          narrative:
            "The latest annual history still shows the thesis being financed by real cash generation rather than narrative alone.",
          narrative_paragraphs: [
            "The latest annual history still shows the thesis being financed by real cash generation rather than narrative alone.",
            "The trend still matters because the core debate is whether revenue keeps converting into durable operating profit and free cash flow.",
          ],
          key_points: [
            "Revenue continued to compound through the latest annual period.",
            "Operating margin stabilized rather than deteriorated.",
            "Free cash flow continued to cover capital returns.",
          ],
          evidence_refs: ["ev-1", "fcf_trend"],
          omissions: [],
          coverage_state: "full",
        },
        {
          section_id: "management_and_governance",
          title: "Management and Governance",
          subtitle: "Capital allocation and operating discipline remain important.",
          summary:
            "Capital allocation remains disciplined, but execution still has to validate the quality case.",
          narrative:
            "Management still looks strongest where cost control, buyback pacing, and operating discipline stay aligned with the long-term thesis.",
          narrative_paragraphs: [
            "Management still looks strongest where cost control, buyback pacing, and operating discipline stay aligned with the long-term thesis.",
            "Governance quality still needs to be judged through consistent execution rather than management rhetoric alone.",
          ],
          key_points: [
            "Share count discipline still supports the quality case.",
            "Operating discipline improved rather than weakened.",
            "Governance quality still has to be confirmed through the next reporting window.",
          ],
          evidence_refs: ["share_count_discipline"],
          omissions: [],
          coverage_state: "partial",
        },
        {
          section_id: "growth_opportunities_and_outlook",
          title: "Growth Opportunities and Outlook",
          subtitle:
            "Future upside still depends on conversion from demand into durable margin and cash flow.",
          summary:
            "The outlook remains constructive, but it still hinges on operating leverage showing up in cash terms.",
          narrative:
            "The best upside path comes from steadier margins and cleaner free-cash-flow follow-through rather than from a heroic change in the demand story.",
          narrative_paragraphs: [
            "The best upside path comes from steadier margins and cleaner free-cash-flow follow-through rather than from a heroic change in the demand story.",
            "The next review window should focus on whether margin resilience keeps funding the thesis.",
          ],
          key_points: [
            "Base case requires margin stability rather than heroic acceleration.",
            "Bull case needs cleaner operating leverage.",
            "The next review window should focus on whether margin resilience keeps funding the thesis.",
          ],
          evidence_refs: ["operating_margin_up"],
          omissions: [],
          coverage_state: "partial",
        },
        {
          section_id: "risks_and_challenges",
          title: "Risks and Challenges",
          subtitle: "The key question is whether execution keeps validating the cash case.",
          summary: "Execution risk and demand normalization remain the primary thesis breakers.",
          narrative:
            "The monitoring burden is straightforward: if margin durability slips or guidance weakens, the quality case needs to be revisited quickly.",
          narrative_paragraphs: [
            "The monitoring burden is straightforward: if margin durability slips or guidance weakens, the quality case needs to be revisited quickly.",
            "The report stays explicit about challenge points so risk framing remains falsifiable rather than generic.",
          ],
          key_points: [
            "Demand normalization could pressure margin durability.",
            "Guidance deterioration would weaken the base case.",
            "Supply-chain disruption would challenge near-term execution.",
          ],
          evidence_refs: ["ks-1", "ks-2", "ks-3"],
          omissions: [],
          coverage_state: "full",
        },
        {
          section_id: "valuation_and_thesis_stance",
          title: "Valuation and Thesis Stance",
          subtitle:
            "A deterministic range still supports the thesis, but only with explicit execution discipline.",
          summary:
            "Base valuation remains above spot, but the spread is not wide enough to ignore execution risk.",
          narrative:
            "The range remains sensitive to WACC and terminal growth, so the report treats valuation as a decision framework rather than a point estimate.",
          narrative_paragraphs: [
            "The range remains sensitive to WACC and terminal growth, so the report treats valuation as a decision framework rather than a point estimate.",
            "The stance stays constructive only while margin resilience and cash conversion continue to support the base case.",
          ],
          key_points: [
            "Base case requires margin stability rather than heroic acceleration.",
            "Bull case needs cleaner operating leverage.",
            "Bear case assumes weaker conversion from demand into cash flow.",
          ],
          evidence_refs: ["deterministic_dcf", "ev-1"],
          omissions: [],
          coverage_state: "full",
        },
      ],
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL remains a cash-resilient thesis with moderate upside and explicit risk controls.",
        status: "complete",
        evidence: [
          {
            evidence_id: "ev-1",
            source_type: "financial_data",
            source_name: "Annual statement snapshot",
            excerpt: "Free cash flow remained positive and stable in the latest annual period.",
            retrieved_at: "2026-04-20T08:00:00.000Z",
          },
        ],
      },
    ],
    flags: [],
    data_sources: ["fixture-financials", "fixture-dexter"],
  };
}
