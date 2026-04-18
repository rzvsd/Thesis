import type { EvidenceRightsMetadata } from "./evidence-rights";
import { evidenceRightsMetadataSchema } from "./evidence-rights";

export const analysisReportSourceStates = [
  "official",
  "bounded_context",
  "partial",
  "missing"
] as const;

export type AnalysisReportSourceState = (typeof analysisReportSourceStates)[number];

export interface AnalysisReportOmission {
  omission_code: string;
  omission_text: string;
  affects_sections: string[];
}

export interface AnalysisReportEvidenceContext {
  source_state: AnalysisReportSourceState;
  generated_at: string;
  rights: EvidenceRightsMetadata[];
  omissions: AnalysisReportOmission[];
}

export const analysisReportOmissionSchema = {
  $id: "AnalysisReportOmission",
  type: "object",
  additionalProperties: false,
  required: ["omission_code", "omission_text", "affects_sections"],
  properties: {
    omission_code: { type: "string", minLength: 1 },
    omission_text: { type: "string", minLength: 1 },
    affects_sections: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  }
} as const;

export const analysisReportEvidenceContextSchema = {
  $id: "AnalysisReportEvidenceContext",
  type: "object",
  additionalProperties: false,
  required: ["source_state", "generated_at", "rights", "omissions"],
  properties: {
    source_state: {
      type: "string",
      enum: analysisReportSourceStates
    },
    generated_at: {
      type: "string",
      format: "date-time"
    },
    rights: {
      type: "array",
      items: evidenceRightsMetadataSchema
    },
    omissions: {
      type: "array",
      items: analysisReportOmissionSchema
    }
  }
} as const;
