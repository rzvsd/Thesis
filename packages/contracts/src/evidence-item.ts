export type EvidenceSourceType =
  | "filing"
  | "article"
  | "financial_data"
  | "macro_data";

export interface EvidenceItem {
  evidence_id: string;
  source_type: EvidenceSourceType;
  source_name: string;
  excerpt: string;
  retrieved_at: string;
  url?: string;
}

export const evidenceItemSchema = {
  $id: "EvidenceItem",
  type: "object",
  additionalProperties: false,
  required: [
    "evidence_id",
    "source_type",
    "source_name",
    "excerpt",
    "retrieved_at"
  ],
  properties: {
    evidence_id: { type: "string" },
    source_type: {
      type: "string",
      enum: ["filing", "article", "financial_data", "macro_data"]
    },
    source_name: { type: "string" },
    excerpt: { type: "string" },
    retrieved_at: { type: "string" },
    url: { type: "string" }
  }
} as const;
