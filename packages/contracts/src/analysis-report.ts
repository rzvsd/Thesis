import type { EvidenceItem } from "./evidence-item";
import type { ReportSection } from "./report-section";
import { evidenceItemSchema } from "./evidence-item";
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

export interface AnalysisReport {
  report_id: string;
  job_id: string;
  schema_version: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  generated_at: string;
  confidence: ConfidenceBlock;
  signal?: ReportSignal;
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
