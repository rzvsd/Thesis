export const officialSourceFamilies = [
  "sec_edgar",
  "treasury",
  "bls",
  "bea",
  "eia"
] as const;

export type OfficialSourceFamily = (typeof officialSourceFamilies)[number];

export const officialRetrievalStatuses = [
  "fresh",
  "partial",
  "stale",
  "unavailable"
] as const;

export type OfficialRetrievalStatus = (typeof officialRetrievalStatuses)[number];

export const officialMissingFieldReasons = [
  "not_reported",
  "not_applicable",
  "source_unavailable",
  "parser_unsupported",
  "outside_seed_scope"
] as const;

export type OfficialMissingFieldReason = (typeof officialMissingFieldReasons)[number];

export interface OfficialSourceReference {
  source_id: string;
  source_family: OfficialSourceFamily;
  source_name: string;
  source_url: string;
  agency: string;
  agency_series_id?: string;
}

export interface OfficialRetrievalMetadata {
  source: OfficialSourceReference;
  retrieved_at: string;
  retrieval_status: OfficialRetrievalStatus;
  source_period?: string;
  source_revision?: string;
}

export interface OfficialMissingFieldState {
  field: string;
  reason: OfficialMissingFieldReason;
  source_id?: string;
  message: string;
}

export const officialSourceReferenceSchema = {
  $id: "OfficialSourceReference",
  type: "object",
  additionalProperties: false,
  required: ["source_id", "source_family", "source_name", "source_url", "agency"],
  properties: {
    source_id: { type: "string" },
    source_family: {
      type: "string",
      enum: officialSourceFamilies
    },
    source_name: { type: "string" },
    source_url: { type: "string" },
    agency: { type: "string" },
    agency_series_id: { type: "string" }
  }
} as const;

export const officialRetrievalMetadataSchema = {
  $id: "OfficialRetrievalMetadata",
  type: "object",
  additionalProperties: false,
  required: ["source", "retrieved_at", "retrieval_status"],
  properties: {
    source: officialSourceReferenceSchema,
    retrieved_at: { type: "string", format: "date-time" },
    retrieval_status: {
      type: "string",
      enum: officialRetrievalStatuses
    },
    source_period: { type: "string" },
    source_revision: { type: "string" }
  }
} as const;

export const officialMissingFieldStateSchema = {
  $id: "OfficialMissingFieldState",
  type: "object",
  additionalProperties: false,
  required: ["field", "reason", "message"],
  properties: {
    field: { type: "string" },
    reason: {
      type: "string",
      enum: officialMissingFieldReasons
    },
    source_id: { type: "string" },
    message: { type: "string" }
  }
} as const;
