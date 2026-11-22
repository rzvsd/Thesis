import { evidenceItemSchema, type EvidenceItem } from "./evidence-item";

export type FilingIntelligenceComparisonBasis = "qoq" | "yoy" | "annual";
export type FilingIntelligenceDirection = "improved" | "weakened" | "mixed" | "unchanged" | "unavailable";
export type FilingIntelligenceTone = "positive" | "negative" | "mixed" | "neutral" | "watch";
export type FilingIntelligenceGenerationMode = "deterministic_fixture" | "live_prompt" | "fallback";

export interface FilingIntelligenceFilingRef {
  form: "10-Q" | "10-K" | "10-Q/A" | "10-K/A" | "unknown";
  period: string;
  fiscal_year?: number;
  fiscal_quarter?: number;
  filing_date?: string;
  accession_number?: string;
  source_url?: string;
}

export interface FilingIntelligenceMetricDelta {
  metric: string;
  label: string;
  basis: FilingIntelligenceComparisonBasis;
  current_period: string;
  reference_period?: string;
  current_value?: number;
  reference_value?: number;
  delta?: number;
  delta_pct?: number;
  unit: "currency" | "pct" | "ratio" | "count";
  direction: FilingIntelligenceDirection;
  plain_english: string;
  why_it_matters: string;
  evidence_refs: string[];
}

export interface FilingIntelligenceLanguageDelta {
  section: "mda" | "risk_factors" | "liquidity" | "segments" | "management_commentary";
  current_excerpt?: string;
  prior_excerpt?: string;
  change_type: "new" | "removed" | "intensified" | "softened" | "revised" | "unchanged" | "unavailable";
  plain_english: string;
  evidence_refs: string[];
}

export interface FilingIntelligenceMemo {
  the_filing_read: string;
  what_changed: string;
  the_good: string;
  the_bad: string;
  the_interesting: string;
  management_tone: string;
  risk_watch: string;
  plain_english_takeaway: string;
  what_to_watch_next: string;
}

export interface FilingIntelligenceOmission {
  family: string;
  reason_code:
    | "missing_latest_filing"
    | "missing_prior_quarter"
    | "missing_year_ago"
    | "missing_annual_history"
    | "missing_filing_text"
    | "missing_segment_data"
    | "provider_unavailable"
    | "llm_unavailable";
  reason: string;
  blocking: boolean;
}

export interface FilingIntelligenceBlock {
  prompt_version: string;
  generation_mode: FilingIntelligenceGenerationMode;
  latest_filing?: FilingIntelligenceFilingRef;
  comparison_filings: FilingIntelligenceFilingRef[];
  metric_deltas: FilingIntelligenceMetricDelta[];
  language_deltas: FilingIntelligenceLanguageDelta[];
  segment_deltas: FilingIntelligenceMetricDelta[];
  memo: FilingIntelligenceMemo;
  top_changes: string[];
  good: string[];
  bad: string[];
  interesting: string[];
  omissions: FilingIntelligenceOmission[];
  evidence: EvidenceItem[];
}

export const filingIntelligenceFilingRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["form", "period"],
  properties: {
    form: { type: "string", enum: ["10-Q", "10-K", "10-Q/A", "10-K/A", "unknown"] },
    period: { type: "string" },
    fiscal_year: { type: "number" },
    fiscal_quarter: { type: "number" },
    filing_date: { type: "string" },
    accession_number: { type: "string" },
    source_url: { type: "string" }
  }
} as const;

export const filingIntelligenceMetricDeltaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "metric",
    "label",
    "basis",
    "current_period",
    "unit",
    "direction",
    "plain_english",
    "why_it_matters",
    "evidence_refs"
  ],
  properties: {
    metric: { type: "string" },
    label: { type: "string" },
    basis: { type: "string", enum: ["qoq", "yoy", "annual"] },
    current_period: { type: "string" },
    reference_period: { type: "string" },
    current_value: { type: "number" },
    reference_value: { type: "number" },
    delta: { type: "number" },
    delta_pct: { type: "number" },
    unit: { type: "string", enum: ["currency", "pct", "ratio", "count"] },
    direction: { type: "string", enum: ["improved", "weakened", "mixed", "unchanged", "unavailable"] },
    plain_english: { type: "string" },
    why_it_matters: { type: "string" },
    evidence_refs: { type: "array", items: { type: "string" } }
  }
} as const;

export const filingIntelligenceLanguageDeltaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["section", "change_type", "plain_english", "evidence_refs"],
  properties: {
    section: {
      type: "string",
      enum: ["mda", "risk_factors", "liquidity", "segments", "management_commentary"]
    },
    current_excerpt: { type: "string" },
    prior_excerpt: { type: "string" },
    change_type: {
      type: "string",
      enum: ["new", "removed", "intensified", "softened", "revised", "unchanged", "unavailable"]
    },
    plain_english: { type: "string" },
    evidence_refs: { type: "array", items: { type: "string" } }
  }
} as const;

export const filingIntelligenceMemoSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "the_filing_read",
    "what_changed",
    "the_good",
    "the_bad",
    "the_interesting",
    "management_tone",
    "risk_watch",
    "plain_english_takeaway",
    "what_to_watch_next"
  ],
  properties: {
    the_filing_read: { type: "string" },
    what_changed: { type: "string" },
    the_good: { type: "string" },
    the_bad: { type: "string" },
    the_interesting: { type: "string" },
    management_tone: { type: "string" },
    risk_watch: { type: "string" },
    plain_english_takeaway: { type: "string" },
    what_to_watch_next: { type: "string" }
  }
} as const;

export const filingIntelligenceOmissionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["family", "reason_code", "reason", "blocking"],
  properties: {
    family: { type: "string" },
    reason_code: {
      type: "string",
      enum: [
        "missing_latest_filing",
        "missing_prior_quarter",
        "missing_year_ago",
        "missing_annual_history",
        "missing_filing_text",
        "missing_segment_data",
        "provider_unavailable",
        "llm_unavailable"
      ]
    },
    reason: { type: "string" },
    blocking: { type: "boolean" }
  }
} as const;

export const filingIntelligenceBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "prompt_version",
    "generation_mode",
    "comparison_filings",
    "metric_deltas",
    "language_deltas",
    "segment_deltas",
    "memo",
    "top_changes",
    "good",
    "bad",
    "interesting",
    "omissions",
    "evidence"
  ],
  properties: {
    prompt_version: { type: "string" },
    generation_mode: { type: "string", enum: ["deterministic_fixture", "live_prompt", "fallback"] },
    latest_filing: filingIntelligenceFilingRefSchema,
    comparison_filings: {
      type: "array",
      items: filingIntelligenceFilingRefSchema
    },
    metric_deltas: {
      type: "array",
      items: filingIntelligenceMetricDeltaSchema
    },
    language_deltas: {
      type: "array",
      items: filingIntelligenceLanguageDeltaSchema
    },
    segment_deltas: {
      type: "array",
      items: filingIntelligenceMetricDeltaSchema
    },
    memo: filingIntelligenceMemoSchema,
    top_changes: { type: "array", items: { type: "string" } },
    good: { type: "array", items: { type: "string" } },
    bad: { type: "array", items: { type: "string" } },
    interesting: { type: "array", items: { type: "string" } },
    omissions: {
      type: "array",
      items: filingIntelligenceOmissionSchema
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;
