import type { EvidenceItem } from "./evidence-item";
import type { KillSwitchConditionDraft } from "./kill-switch-rule";
import type { NameRelationshipDraft } from "./name-relationship";
import type { ReportSection } from "./report-section";
import { evidenceItemSchema } from "./evidence-item";
import { killSwitchConditionDraftSchema } from "./kill-switch-rule";
import { nameRelationshipDraftSchema } from "./name-relationship";
import { reportSectionSchema } from "./report-section";

export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient_data";
export type SignalValue = "positive" | "neutral" | "negative" | "no_signal";

export interface ConfidenceBlock {
  score: number;
  label: ConfidenceLabel;
  limiting_factors: string[];
}

export interface ReportSignal {
  value: SignalValue;
  reasons: string[];
  evidence: EvidenceItem[];
}

export interface HistoricalContextBlock {
  latest_period?: string;
  prior_quarter_period?: string;
  year_ago_period?: string;
  transcript_period?: string;
  financial_snapshot_count: number;
  transcript_count: number;
  transcript_available: boolean;
  missing_reasons: string[];
}

export interface ValuationAssumptions {
  methodology: "deterministic_dcf";
  projection_years: number;
  terminal_growth_rate: number;
  wacc: number;
  beta?: number;
  effective_tax_rate?: number;
  shares_outstanding?: number;
}

export interface ValuationBlock {
  fair_value_mid?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  spot_price?: number;
  implied_upside_pct?: number;
  assumptions: ValuationAssumptions;
  degraded_reason?: string;
}

export type TrustFreshnessState = "fresh" | "degraded" | "stale";
export type TrustContradictionState = "none" | "present";
export type TrustValuationState = "available" | "degraded" | "omitted";
export type TrustThesisDriftStatus = "available" | "unavailable";

export interface TrustQuoteProvenance {
  quote: string;
  source_name: string;
  source_type: EvidenceItem["source_type"];
  source_period?: string;
  transcript_id?: string;
  source_url?: string;
  retrieved_at?: string;
}

export interface TrustContradiction {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface TrustThesisDriftSummary {
  status: TrustThesisDriftStatus;
  summary: string;
  reasons: string[];
  comparable_report_id?: string;
  comparable_generated_at?: string;
  comparable_schema_version?: string;
}

export interface TrustMetadata {
  generated_at: string;
  freshness_state: TrustFreshnessState;
  evidence_count: number;
  contradiction_state: TrustContradictionState;
  contradictions: TrustContradiction[];
  valuation_state: TrustValuationState;
  missing_data_notes: string[];
  quote_provenance: TrustQuoteProvenance[];
  thesis_drift: TrustThesisDriftSummary;
}

export interface AnalysisReport {
  report_id: string;
  job_id: string;
  schema_version: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  generated_at: string;
  confidence: ConfidenceBlock;
  signal?: ReportSignal;
  historical_context?: HistoricalContextBlock;
  valuation?: ValuationBlock;
  trust_metadata?: TrustMetadata;
  kill_switch_conditions?: KillSwitchConditionDraft[];
  name_relationships?: NameRelationshipDraft[];
  sections: ReportSection[];
  flags: string[];
  data_sources: string[];
}

export const confidenceBlockSchema = {
  $id: "ConfidenceBlock",
  type: "object",
  additionalProperties: false,
  required: ["score", "label", "limiting_factors"],
  properties: {
    score: { type: "number" },
    label: {
      type: "string",
      enum: ["high", "medium", "low", "insufficient_data"]
    },
    limiting_factors: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export const reportSignalSchema = {
  $id: "ReportSignal",
  type: "object",
  additionalProperties: false,
  required: ["value", "reasons", "evidence"],
  properties: {
    value: {
      type: "string",
      enum: ["positive", "neutral", "negative", "no_signal"]
    },
    reasons: {
      type: "array",
      items: { type: "string" }
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const analysisReportSchema = {
  $id: "AnalysisReport",
  type: "object",
  additionalProperties: false,
  required: [
    "report_id",
    "job_id",
    "schema_version",
    "type",
    "generated_at",
    "confidence",
    "sections",
    "flags",
    "data_sources"
  ],
  properties: {
    report_id: { type: "string" },
    job_id: { type: "string" },
    schema_version: { type: "string" },
    type: { type: "string", enum: ["deep_dive", "market_pulse"] },
    ticker: { type: "string" },
    generated_at: { type: "string" },
    confidence: confidenceBlockSchema,
    signal: reportSignalSchema,
    historical_context: {
      type: "object",
      additionalProperties: false,
      required: [
        "financial_snapshot_count",
        "transcript_count",
        "transcript_available",
        "missing_reasons"
      ],
      properties: {
        latest_period: { type: "string" },
        prior_quarter_period: { type: "string" },
        year_ago_period: { type: "string" },
        transcript_period: { type: "string" },
        financial_snapshot_count: { type: "number" },
        transcript_count: { type: "number" },
        transcript_available: { type: "boolean" },
        missing_reasons: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    valuation: {
      type: "object",
      additionalProperties: false,
      required: ["assumptions"],
      properties: {
        fair_value_mid: { type: "number" },
        fair_value_low: { type: "number" },
        fair_value_high: { type: "number" },
        spot_price: { type: "number" },
        implied_upside_pct: { type: "number" },
        degraded_reason: { type: "string" },
        assumptions: {
          type: "object",
          additionalProperties: false,
          required: [
            "methodology",
            "projection_years",
            "terminal_growth_rate",
            "wacc"
          ],
          properties: {
            methodology: {
              type: "string",
              enum: ["deterministic_dcf"]
            },
            projection_years: { type: "number" },
            terminal_growth_rate: { type: "number" },
            wacc: { type: "number" },
            beta: { type: "number" },
            effective_tax_rate: { type: "number" },
            shares_outstanding: { type: "number" }
          }
        }
      }
    },
    trust_metadata: {
      type: "object",
      additionalProperties: false,
      required: [
        "generated_at",
        "freshness_state",
        "evidence_count",
        "contradiction_state",
        "contradictions",
        "valuation_state",
        "missing_data_notes",
        "quote_provenance",
        "thesis_drift"
      ],
      properties: {
        generated_at: { type: "string" },
        freshness_state: {
          type: "string",
          enum: ["fresh", "degraded", "stale"]
        },
        evidence_count: { type: "number" },
        contradiction_state: {
          type: "string",
          enum: ["none", "present"]
        },
        contradictions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "description", "severity"],
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              severity: {
                type: "string",
                enum: ["low", "medium", "high"]
              }
            }
          }
        },
        valuation_state: {
          type: "string",
          enum: ["available", "degraded", "omitted"]
        },
        missing_data_notes: {
          type: "array",
          items: { type: "string" }
        },
        quote_provenance: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["quote", "source_name", "source_type"],
            properties: {
              quote: { type: "string" },
              source_name: { type: "string" },
              source_type: {
                type: "string",
                enum: ["filing", "article", "financial_data", "macro_data"]
              },
              source_period: { type: "string" },
              transcript_id: { type: "string" },
              source_url: { type: "string" },
              retrieved_at: { type: "string" }
            }
          }
        },
        thesis_drift: {
          type: "object",
          additionalProperties: false,
          required: ["status", "summary", "reasons"],
          properties: {
            status: {
              type: "string",
              enum: ["available", "unavailable"]
            },
            summary: { type: "string" },
            reasons: {
              type: "array",
              items: { type: "string" }
            },
            comparable_report_id: { type: "string" },
            comparable_generated_at: { type: "string" },
            comparable_schema_version: { type: "string" }
          }
        }
      }
    },
    kill_switch_conditions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: killSwitchConditionDraftSchema
    },
    name_relationships: {
      type: "array",
      items: nameRelationshipDraftSchema
    },
    sections: {
      type: "array",
      items: reportSectionSchema
    },
    flags: {
      type: "array",
      items: { type: "string" }
    },
    data_sources: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
