import type { EvidenceItem } from "./evidence-item";
import { evidenceItemSchema } from "./evidence-item";

export type ReportSectionStatus =
  | "complete"
  | "data_incomplete"
  | "data_unavailable"
  | "failed";

export interface ReportSection {
  section_id: string;
  title: string;
  body: string;
  status: ReportSectionStatus;
  evidence: EvidenceItem[];
}

export const reportSectionSchema = {
  $id: "ReportSection",
  type: "object",
  additionalProperties: false,
  required: ["section_id", "title", "body", "status", "evidence"],
  properties: {
    section_id: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    status: {
      type: "string",
      enum: ["complete", "data_incomplete", "data_unavailable", "failed"]
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;
