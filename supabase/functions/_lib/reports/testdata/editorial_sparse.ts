// Sparse and legacy Deep Dive fixtures from apps/product-api/tests/deepdive-m5-pdf-export.test.ts (unchanged).

type JsonObject = Record<string, unknown>;

export function sampleSparseReport(jobId: string, reportId: string): JsonObject {
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
    generated_at: "2026-04-20T10:15:00.000Z",
    confidence: {
      score: 0.32,
      label: "low",
      limiting_factors: ["limited_history", "missing_valuation_inputs"],
    },
    story_header: {
      headline: "Coverage is too thin for a full conviction call.",
      thesis_summary: "Sparse financial history supports observation, not a strong investment stance.",
      why_now: "The name is interesting, but the evidence set is incomplete.",
      reader_takeaway: "Review again only when cleaner financial history and valuation inputs arrive.",
      stance_label: "watch",
    },
    investment_memo: {
      prompt_version: "m4-synthesizer-fixture-v1",
      generation_mode: "deterministic_fixture",
      company_angle: "sparse_watchlist",
      decision_question: "Is there enough information to move beyond watchlist status?",
      sections: [
        {
          section_id: "investment_thesis",
          title: "Investment Thesis",
          narrative:
            "The current thesis is intentionally limited by missing comparables and incomplete history.",
          key_points: ["Do not force conviction from a thin dataset."],
        },
        {
          section_id: "what_changed",
          title: "What Changed",
          narrative: "No prior report exists for a comparable change stack.",
          key_points: [],
        },
        {
          section_id: "business_quality",
          title: "Business Quality",
          narrative: "There are early signs of product-market fit, but not enough durable evidence.",
          key_points: ["Business model evidence remains partial."],
        },
        {
          section_id: "valuation",
          title: "Valuation",
          narrative: "Valuation is intentionally omitted because the required inputs are not available.",
          key_points: [],
        },
        {
          section_id: "risks",
          title: "Risks",
          narrative: "The main risk is false precision from sparse evidence.",
          key_points: ["Sparse history makes comparative analysis unstable."],
        },
      ],
      material_claims: [],
      unsupported_claims: [],
      sparse_data_honesty_note: "Sparse report fixture used to prove omission-aware rendering.",
    },
    financial_analysis: {
      annual_history: [
        {
          period: "FY-2025",
          period_type: "annual",
          fiscal_year: 2025,
          revenue: 210,
          free_cash_flow: -28,
        },
      ],
      quarterly_history: [],
      trend_metrics: [],
      quality_metrics: [],
      omissions: [
        {
          code: "valuation_inputs_missing",
          label: "Valuation inputs missing",
          reason: "No reliable spot price and no stable base-year assumptions are available.",
          impacts: ["valuation", "confidence"],
        },
      ],
    },
    coverage_truth: {
      summary: "Coverage is intentionally limited and omission-forward.",
      covered: ["basic_financial_snapshot"],
      missing: ["valuation_inputs", "comparable_history", "kill_switch_rules"],
    },
    due_diligence: {
      prompt_version: "dd-v2-fixture-v1",
      generation_mode: "deterministic_fixture",
      sections: [
        {
          section_id: "competitive_positioning",
          title: "Competitive Positioning",
          summary: "Limited reporting history keeps the competitive-positioning read tentative.",
          narrative:
            "Early signs may be encouraging, but the evidence base is still too thin to turn the memo into a full conviction call.",
          narrative_paragraphs: [
            "Early signs may be encouraging, but the evidence base is still too thin to turn the memo into a full conviction call.",
          ],
          key_points: [
            "Do not confuse early promise with durable quality.",
            "Business-model evidence remains partial.",
          ],
          evidence_refs: [],
          omissions: ["limited_history", "comparable_history"],
          coverage_state: "limited",
        },
        {
          section_id: "financial_analysis",
          title: "Financial Statement Analysis",
          summary: "Only one annual period is available, so trend conclusions stay modest.",
          narrative:
            "Sparse reporting history means the report can highlight the latest numbers but should not imply a reliable multi-year pattern.",
          narrative_paragraphs: [
            "Sparse reporting history means the report can highlight the latest numbers but should not imply a reliable multi-year pattern.",
          ],
          key_points: [
            "Only one reported annual period is available.",
            "Cash flow remains negative in the latest snapshot.",
          ],
          evidence_refs: [],
          omissions: ["valuation_inputs", "comparable_history"],
          coverage_state: "limited",
        },
        {
          section_id: "management_and_governance",
          title: "Management and Governance",
          summary: "Management assessment remains limited because the evidence base is still thin.",
          narrative:
            "The governance layer is still useful because it prevents the report from overstating what a thin dataset can prove.",
          narrative_paragraphs: [
            "The governance layer is still useful because it prevents the report from overstating what a thin dataset can prove.",
          ],
          key_points: [
            "Partial evidence should stay partial in the output.",
          ],
          evidence_refs: [],
          omissions: ["limited_history"],
          coverage_state: "limited",
        },
        {
          section_id: "growth_opportunities_and_outlook",
          title: "Growth Opportunities and Outlook",
          summary: "The outlook stays preliminary because the reporting base is still too small.",
          narrative:
            "The report can name what might matter next, but it should not imply a durable growth path from a single period of evidence.",
          narrative_paragraphs: [
            "The report can name what might matter next, but it should not imply a durable growth path from a single period of evidence.",
          ],
          key_points: ["Future upside still depends on evidence that does not exist yet."],
          evidence_refs: [],
          omissions: ["limited_history"],
          coverage_state: "limited",
        },
        {
          section_id: "risks_and_challenges",
          title: "Risks and Challenges",
          summary: "False precision is the biggest risk when evidence is this thin.",
          narrative:
            "The next review should focus on building a cleaner financial history before making a stronger thesis call.",
          narrative_paragraphs: [
            "The next review should focus on building a cleaner financial history before making a stronger thesis call.",
          ],
          key_points: [
            "Sparse history makes comparative analysis unstable.",
          ],
          evidence_refs: [],
          omissions: ["limited_history"],
          coverage_state: "limited",
        },
        {
          section_id: "valuation_and_thesis_stance",
          title: "Valuation and Thesis Stance",
          summary: "Valuation remains omitted because the minimum inputs are not available.",
          narrative:
            "The report stays honest by showing a degraded valuation state rather than inventing scenario precision.",
          narrative_paragraphs: [
            "The report stays honest by showing a degraded valuation state rather than inventing scenario precision.",
          ],
          key_points: [
            "Coverage is intentionally omission-forward.",
          ],
          evidence_refs: [],
          omissions: ["valuation_inputs"],
          coverage_state: "limited",
        },
      ],
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "Sparse report used to validate omission-aware export behavior.",
        status: "complete",
        evidence: [],
      },
    ],
    flags: ["sparse_fixture"],
    data_sources: ["fixture-sparse"],
  };
}

export function sampleLegacyReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "1.0",
    type: "deep_dive",
    ticker: "MSFT",
    issuer: {
      name: "Microsoft Corporation",
      exchange: "NASDAQ",
    },
    generated_at: "2026-04-20T09:00:00.000Z",
    confidence: {
      score: 0.58,
      label: "medium",
      limiting_factors: ["limited_context"],
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "Legacy report with partial context.",
        status: "complete",
        evidence: [],
      },
    ],
    flags: ["legacy_fixture"],
    data_sources: ["legacy-fixture"],
  };
}
