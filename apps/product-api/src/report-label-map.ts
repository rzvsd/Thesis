const explicitLabelMap: Record<string, string> = {
  asset_turnover_delta: "Asset turnover trend",
  basic_financial_snapshot: "Basic financial snapshot",
  capital_discipline: "Capital discipline",
  comparable_history: "Comparable history",
  deterministic_dcf: "DCF-based scenario framework",
  earnings_quality: "Earnings quality",
  financial: "Financial profile",
  financial_statements: "Financial statement coverage",
  fresh_transcript_excerpt: "Transcript freshness is limited",
  guidance_revision: "Guidance revision",
  kill_switch_rules: "Risk rule coverage",
  legacy_fixture: "Legacy fixture reference",
  leverage_liquidity: "Balance-sheet resilience",
  limited_context: "Context depth is limited",
  limited_history: "Historical depth is limited",
  macro_regime: "Macro regime",
  management_change: "Management change",
  missing_valuation_inputs: "Valuation inputs are incomplete",
  news_sentiment: "News flow",
  operating_efficiency: "Operating efficiency",
  price_move_pct: "Price move",
  profitability: "Profitability",
  quality_mega_cap: "Large-cap quality context",
  sec_filing: "SEC filing",
  sparse_data: "Sparse data context",
  sparse_fixture: "Sparse fixture reference",
  thesis_state: "Thesis state",
  transcript_delay: "Transcript timing is delayed",
  valuation_assumptions: "Valuation assumptions",
  valuation_inputs: "Valuation inputs",
  value_cyclical: "Cyclical value context"
};

const explicitSentenceMap: Record<string, string> = {
  asset_turnover_delta: "Asset turnover trend was not available for this run.",
  basic_financial_snapshot: "Coverage relies on a basic financial snapshot rather than a full history.",
  comparable_history: "A comparable historical baseline is not available for this run.",
  fresh_transcript_excerpt: "Transcript freshness is limited for this run.",
  kill_switch_rules: "Risk-rule coverage is not fully configured for this name.",
  limited_context: "Context depth is limited in the available dataset.",
  limited_history: "Historical depth is limited in the available dataset.",
  missing_valuation_inputs: "Valuation inputs are incomplete for this run.",
  sparse_fixture: "This sample is intentionally sparse to prove omission-aware rendering.",
  transcript_delay: "Transcript timing is delayed relative to the latest financials.",
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
    return "Coverage is limited in this run.";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "Coverage is limited in this run.";
  }
  return explicitSentenceMap[normalized] ?? `${reportLabelMap(normalized)} is limited in this run.`;
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
