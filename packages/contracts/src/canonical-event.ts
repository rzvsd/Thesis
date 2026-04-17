import type {
  OfficialMissingFieldState,
  OfficialRetrievalMetadata
} from "./official-source";
import {
  officialMissingFieldStateSchema,
  officialRetrievalMetadataSchema
} from "./official-source";

export const canonicalEventFamilies = [
  "filing_posted",
  "macro_release_published"
] as const;

export type CanonicalEventFamily = (typeof canonicalEventFamilies)[number];

export const canonicalEventSourceStates = [
  "official",
  "partial",
  "missing"
] as const;

export type CanonicalEventSourceState = (typeof canonicalEventSourceStates)[number];

export interface CanonicalEvent {
  id: string;
  family: CanonicalEventFamily;
  subject_type: "ticker" | "macro_series";
  subject_id: string;
  title: string;
  occurred_at: string;
  source_state: CanonicalEventSourceState;
  source: OfficialRetrievalMetadata;
  retrieved_at: string;
  missing_fields: OfficialMissingFieldState[];
  metadata: Record<string, unknown>;
}

export const canonicalEventSchema = {
  $id: "CanonicalEvent",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "family",
    "subject_type",
    "subject_id",
    "title",
    "occurred_at",
    "source_state",
    "source",
    "retrieved_at",
    "missing_fields",
    "metadata"
  ],
  properties: {
    id: { type: "string" },
    family: {
      type: "string",
      enum: canonicalEventFamilies
    },
    subject_type: {
      type: "string",
      enum: ["ticker", "macro_series"]
    },
    subject_id: { type: "string" },
    title: { type: "string" },
    occurred_at: { type: "string", format: "date-time" },
    source_state: {
      type: "string",
      enum: canonicalEventSourceStates
    },
    source: officialRetrievalMetadataSchema,
    retrieved_at: { type: "string", format: "date-time" },
    missing_fields: {
      type: "array",
      items: officialMissingFieldStateSchema
    },
    metadata: {
      type: "object",
      additionalProperties: true
    }
  }
} as const;
