const explicitLabelMap: Record<string, string> = {
  asset_turnover_delta: "Asset turnover trend",
  basic_financial_snapshot: "Basic financial snapshot",
  business_quality: "Business quality",
  capital_discipline: "Capital discipline",
  competitive_positioning: "Competitive positioning",
  comparable_history: "Comparable history",
  deterministic_dcf: "DCF-based scenario framework",
  due_diligence: "Due diligence",
  earnings_quality: "Earnings quality",
  evidence_book: "Evidence book",
  financial: "Financial profile",
  financial_analysis: "Financial statement analysis",
  financial_statement_analysis: "Financial statement analysis",
  financial_statements: "Financial statement coverage",
  "fixture-dexter": "Research authoring record",
  "fixture-financials": "Structured financial dataset",
  "fixture-sparse": "Sparse-data research sample",
  fresh_transcript_excerpt: "Transcript freshness is limited",
  general: "General context",
  growth_opportunities_and_outlook: "Growth opportunities and outlook",
  guidance_revision: "Guidance revision",
  kill_switch_rules: "Risk rule coverage",
  "legacy-fixture": "Archived report record",
  legacy_fixture: "Legacy fixture reference",
  leverage_liquidity: "Balance-sheet resilience",
  limited_context: "Context depth is limited",
  limited_history: "Historical depth is limited",
  macro_regime: "Macro regime",
  management_and_governance: "Management and governance",
  management_change: "Management change",
  missing_valuation_inputs: "Valuation inputs are incomplete",
  news_sentiment: "News flow",
  operating_efficiency: "Operating efficiency",
  price_move_pct: "Price move",
  profitability: "Profitability",
  quality_mega_cap: "Large-cap quality context",
  risks_and_challenges: "Risks and challenges",
  sec_filing: "SEC filing",
  sparse_data: "Sparse data context",
  sparse_fixture: "Sparse fixture reference",
  thesis_state: "Thesis state",
  transcript_delay: "Transcript timing is delayed",
  value_discipline: "Value discipline",
  valuation_assumptions: "Valuation assumptions",
  valuation_and_thesis_stance: "Valuation and thesis stance",
  valuation_inputs: "Valuation inputs",
  value_cyclical: "Cyclical value context"
};

const explicitSentenceMap: Record<string, string> = {
  asset_turnover_delta: "Asset turnover trend was not available for this report.",
  basic_financial_snapshot: "Coverage relies on a basic financial snapshot rather than a full history.",
  business_quality: "Business-quality detail is limited in this report.",
  competitive_positioning: "Competitive-positioning detail is limited in this report.",
  comparable_history: "A comparable historical baseline is not available for this report.",
  evidence_book: "Evidence-book support is limited in this report.",
  financial_analysis: "Financial-analysis detail is limited in this report.",
  financial_statement_analysis: "Financial-analysis detail is limited in this report.",
  fresh_transcript_excerpt: "Transcript freshness is limited in this report.",
  growth_opportunities_and_outlook: "Growth-outlook detail is limited in this report.",
  management_and_governance: "Management-and-governance detail is limited in this report.",
  risks_and_challenges: "Risk-and-challenge detail is limited in this report.",
  valuation_and_thesis_stance: "Valuation-and-thesis detail is limited in this report.",
  kill_switch_rules: "Risk-rule coverage is not fully configured for this name.",
  limited_context: "Context depth is limited in the available dataset.",
  limited_history: "Historical depth is limited in the available dataset.",
  missing_valuation_inputs: "Valuation inputs are incomplete for this report.",
  sparse_fixture: "This sample is intentionally sparse to prove omission-aware rendering.",
  transcript_delay: "Transcript timing is delayed relative to the latest financials.",
  value_discipline: "Value-discipline support is limited in this report.",
  valuation_inputs: "Valuation inputs were not complete enough for a full scenario view."
};

export function reportLabelMap(value: string | undefined): string {
  if (!value) {
    return "Not available";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "Not available";
  }
  return explicitLabelMap[normalized] ?? titleCaseIdentifier(normalized);
}

export function reportSentenceMap(value: string | undefined): string {
  if (!value) {
    return "Coverage is limited in this report.";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "Coverage is limited in this report.";
  }
  return explicitSentenceMap[normalized] ?? `${reportLabelMap(normalized)} is limited in this report.`;
}

function titleCaseIdentifier(value: string): string {
  const tokens = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return "Not available";
  }

  return tokens
    .map((token) => {
      const upper = token.toUpperCase();
      if (upper.length <= 4 && upper === token) {
        return upper;
      }
      if (/^[A-Z0-9]{2,}$/.test(token)) {
        return token;
      }
      return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");
}
