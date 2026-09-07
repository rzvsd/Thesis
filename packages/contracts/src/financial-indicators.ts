import { evidenceItemSchema, type EvidenceItem } from "./evidence-item";

export type FinancialIndicatorGroup =
  | "valuation"
  | "profitability"
  | "growth"
  | "balance_sheet"
  | "cash_flow_quality"
  | "capital_allocation";

export type FinancialIndicatorUnit = "currency" | "pct" | "ratio" | "multiple" | "count";
export type FinancialIndicatorState = "available" | "missing" | "invalid";
export type FinancialIndicatorPriceKind = "live" | "delayed" | "close" | "fixture" | "manual";
export type FinancialIndicatorTrendDirection =
  | "improving"
  | "weakening"
  | "mixed"
  | "unchanged"
  | "unavailable";
export type FinancialIndicatorBenchmarkComparison = "below" | "near" | "above" | "unavailable";
export type InvestorEducationTopic =
  | "classification"
  | "value_trap"
  | "valuation_multiple"
  | "cash_flow_quality"
  | "debt_risk"
  | "roic";

export type ValueClassification =
  | "classic_value"
  | "quality_value"
  | "quality_growth"
  | "expensive_growth"
  | "turnaround"
  | "distressed"
  | "value_trap_risk"
  | "insufficient_data";

export interface FinancialIndicator {
  indicator_id: string;
  label: string;
  value?: number;
  unit: FinancialIndicatorUnit;
  period: string;
  state: FinancialIndicatorState;
  interpretation: string;
  evidence_refs: string[];
}

export interface FinancialIndicatorTrend {
  indicator_id: string;
  label: string;
  unit: FinancialIndicatorUnit;
  current?: number;
  one_year_ago?: number;
  three_years_ago?: number;
  five_years_ago?: number;
  direction: FinancialIndicatorTrendDirection;
  plain_english: string;
  evidence_refs: string[];
}

export interface FinancialIndicatorPriceReference {
  source_name: string;
  source_url?: string;
  retrieved_at: string;
  price_date: string;
  currency: string;
  price_kind: FinancialIndicatorPriceKind;
  value: number;
  provenance_note: string;
}

export interface FinancialIndicatorCalculationBasis {
  ttm_periods: string[];
  latest_balance_sheet_period?: string;
  annual_fallback_period?: string;
  note: string;
}

export interface FinancialIndicatorBenchmark {
  indicator_id: string;
  label: string;
  cohort: string;
  median?: number;
  low?: number;
  high?: number;
  unit: FinancialIndicatorUnit;
  comparison: FinancialIndicatorBenchmarkComparison;
  plain_english: string;
}

export interface InvestorEducationBox {
  topic: InvestorEducationTopic;
  title: string;
  body: string;
  example?: string;
  evidence_refs: string[];
}

export interface ValueClassificationBlock {
  classification: ValueClassification;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  trap_warnings: string[];
}

export interface FinancialIndicatorsMemo {
  value_lens: string;
  business_quality: string;
  balance_sheet_read: string;
  cash_flow_read: string;
  five_year_read: string;
  plain_english_takeaway: string;
  what_to_watch_next: string;
}

export interface IndicatorOmission {
  family: FinancialIndicatorGroup | "price_source" | "annual_history" | "quarterly_history" | "benchmark";
  reason_code:
    | "missing_price"
    | "missing_market_cap_inputs"
    | "missing_snapshot"
    | "missing_history"
    | "missing_denominator"
    | "insufficient_periods"
    | "insufficient_ttm_quarters"
    | "benchmark_unavailable"
    | "price_provenance_incomplete"
    | "provider_unavailable"
    | "llm_unavailable";
  reason: string;
  blocking: boolean;
}

export interface FinancialIndicatorsBlock {
  prompt_version: string;
  period: string;
  basis: "ttm" | "annual" | "mixed";
  calculation_basis?: FinancialIndicatorCalculationBasis;
  price_reference?: FinancialIndicatorPriceReference;
  valuation: FinancialIndicator[];
  profitability: FinancialIndicator[];
  growth: FinancialIndicator[];
  balance_sheet: FinancialIndicator[];
  cash_flow_quality: FinancialIndicator[];
  capital_allocation: FinancialIndicator[];
  five_year_trends: FinancialIndicatorTrend[];
  benchmarks?: FinancialIndicatorBenchmark[];
  education?: InvestorEducationBox[];
  value_classification: ValueClassificationBlock;
  plain_english: FinancialIndicatorsMemo;
  omissions: IndicatorOmission[];
  evidence: EvidenceItem[];
}

export const financialIndicatorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indicator_id", "label", "unit", "period", "state", "interpretation", "evidence_refs"],
  properties: {
    indicator_id: { type: "string" },
    label: { type: "string" },
    value: { type: "number" },
    unit: { type: "string", enum: ["currency", "pct", "ratio", "multiple", "count"] },
    period: { type: "string" },
    state: { type: "string", enum: ["available", "missing", "invalid"] },
    interpretation: { type: "string" },
    evidence_refs: { type: "array", items: { type: "string" } }
  }
} as const;

export const financialIndicatorTrendSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indicator_id", "label", "unit", "direction", "plain_english", "evidence_refs"],
  properties: {
    indicator_id: { type: "string" },
    label: { type: "string" },
    unit: { type: "string", enum: ["currency", "pct", "ratio", "multiple", "count"] },
    current: { type: "number" },
    one_year_ago: { type: "number" },
    three_years_ago: { type: "number" },
    five_years_ago: { type: "number" },
    direction: {
      type: "string",
      enum: ["improving", "weakening", "mixed", "unchanged", "unavailable"]
    },
    plain_english: { type: "string" },
    evidence_refs: { type: "array", items: { type: "string" } }
  }
} as const;

export const financialIndicatorPriceReferenceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source_name",
    "retrieved_at",
    "price_date",
    "currency",
    "price_kind",
    "value",
    "provenance_note"
  ],
  properties: {
    source_name: { type: "string" },
    source_url: { type: "string" },
    retrieved_at: { type: "string" },
    price_date: { type: "string" },
    currency: { type: "string" },
    price_kind: { type: "string", enum: ["live", "delayed", "close", "fixture", "manual"] },
    value: { type: "number" },
    provenance_note: { type: "string" }
  }
} as const;

export const financialIndicatorCalculationBasisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ttm_periods", "note"],
  properties: {
    ttm_periods: { type: "array", items: { type: "string" } },
    latest_balance_sheet_period: { type: "string" },
    annual_fallback_period: { type: "string" },
    note: { type: "string" }
  }
} as const;

export const financialIndicatorBenchmarkSchema = {
  type: "object",
  additionalProperties: false,
  required: ["indicator_id", "label", "cohort", "unit", "comparison", "plain_english"],
  properties: {
    indicator_id: { type: "string" },
    label: { type: "string" },
    cohort: { type: "string" },
    median: { type: "number" },
    low: { type: "number" },
    high: { type: "number" },
    unit: { type: "string", enum: ["currency", "pct", "ratio", "multiple", "count"] },
    comparison: { type: "string", enum: ["below", "near", "above", "unavailable"] },
    plain_english: { type: "string" }
  }
} as const;

export const investorEducationBoxSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "title", "body", "evidence_refs"],
  properties: {
    topic: {
      type: "string",
      enum: ["classification", "value_trap", "valuation_multiple", "cash_flow_quality", "debt_risk", "roic"]
    },
    title: { type: "string" },
    body: { type: "string" },
    example: { type: "string" },
    evidence_refs: { type: "array", items: { type: "string" } }
  }
} as const;

export const valueClassificationBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "confidence", "reasons", "trap_warnings"],
  properties: {
    classification: {
      type: "string",
      enum: [
        "classic_value",
        "quality_value",
        "quality_growth",
        "expensive_growth",
        "turnaround",
        "distressed",
        "value_trap_risk",
        "insufficient_data"
      ]
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasons: { type: "array", items: { type: "string" } },
    trap_warnings: { type: "array", items: { type: "string" } }
  }
} as const;

export const financialIndicatorsMemoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "value_lens",
    "business_quality",
    "balance_sheet_read",
    "cash_flow_read",
    "five_year_read",
    "plain_english_takeaway",
    "what_to_watch_next"
  ],
  properties: {
    value_lens: { type: "string" },
    business_quality: { type: "string" },
    balance_sheet_read: { type: "string" },
    cash_flow_read: { type: "string" },
    five_year_read: { type: "string" },
    plain_english_takeaway: { type: "string" },
    what_to_watch_next: { type: "string" }
  }
} as const;

export const indicatorOmissionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["family", "reason_code", "reason", "blocking"],
  properties: {
    family: {
      type: "string",
      enum: [
        "valuation",
        "profitability",
        "growth",
        "balance_sheet",
        "cash_flow_quality",
        "capital_allocation",
        "price_source",
        "annual_history",
        "quarterly_history",
        "benchmark"
      ]
    },
    reason_code: {
      type: "string",
      enum: [
        "missing_price",
        "missing_market_cap_inputs",
        "missing_snapshot",
        "missing_history",
        "missing_denominator",
        "insufficient_periods",
        "insufficient_ttm_quarters",
        "benchmark_unavailable",
        "price_provenance_incomplete",
        "provider_unavailable",
        "llm_unavailable"
      ]
    },
    reason: { type: "string" },
    blocking: { type: "boolean" }
  }
} as const;

export const financialIndicatorsBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "prompt_version",
    "period",
    "basis",
    "valuation",
    "profitability",
    "growth",
    "balance_sheet",
    "cash_flow_quality",
    "capital_allocation",
    "five_year_trends",
    "value_classification",
    "plain_english",
    "omissions",
    "evidence"
  ],
  properties: {
    prompt_version: { type: "string" },
    period: { type: "string" },
    basis: { type: "string", enum: ["ttm", "annual", "mixed"] },
    calculation_basis: financialIndicatorCalculationBasisSchema,
    price_reference: financialIndicatorPriceReferenceSchema,
    valuation: { type: "array", items: financialIndicatorSchema },
    profitability: { type: "array", items: financialIndicatorSchema },
    growth: { type: "array", items: financialIndicatorSchema },
    balance_sheet: { type: "array", items: financialIndicatorSchema },
    cash_flow_quality: { type: "array", items: financialIndicatorSchema },
    capital_allocation: { type: "array", items: financialIndicatorSchema },
    five_year_trends: { type: "array", items: financialIndicatorTrendSchema },
    benchmarks: { type: "array", items: financialIndicatorBenchmarkSchema },
    education: { type: "array", items: investorEducationBoxSchema },
    value_classification: valueClassificationBlockSchema,
    plain_english: financialIndicatorsMemoSchema,
    omissions: { type: "array", items: indicatorOmissionSchema },
    evidence: { type: "array", items: evidenceItemSchema }
  }
} as const;
