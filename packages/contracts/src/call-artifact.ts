import type { EvidenceRightsMetadata } from "./evidence-rights";
import { evidenceRightsMetadataSchema } from "./evidence-rights";

export const callArtifactTypes = [
  "earnings_release",
  "presentation",
  "webcast",
  "transcript",
  "supplemental_material",
  "sec_exhibit"
] as const;

export type CallArtifactType = (typeof callArtifactTypes)[number];

export const callArtifactCompletenessStates = [
  "complete",
  "partial",
  "metadata_only",
  "unavailable",
  "blocked_by_rights"
] as const;

export type CallArtifactCompletenessState =
  (typeof callArtifactCompletenessStates)[number];

export interface CallArtifact {
  artifact_id: string;
  ticker: string;
  event_id?: string;
  context_id?: string;
  artifact_type: CallArtifactType;
  title: string;
  source_url: string;
  source_domain: string;
  published_at?: string;
  retrieved_at: string;
  completeness_state: CallArtifactCompletenessState;
  rights: EvidenceRightsMetadata;
  content_hash?: string;
  metadata: Record<string, unknown>;
}

export const callArtifactSchema = {
  $id: "CallArtifact",
  type: "object",
  additionalProperties: false,
  required: [
    "artifact_id",
    "ticker",
    "artifact_type",
    "title",
    "source_url",
    "source_domain",
    "retrieved_at",
    "completeness_state",
    "rights",
    "metadata"
  ],
  properties: {
    artifact_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    event_id: { type: "string", minLength: 1 },
    context_id: { type: "string", minLength: 1 },
    artifact_type: {
      type: "string",
      enum: callArtifactTypes
    },
    title: { type: "string", minLength: 1 },
    source_url: { type: "string", minLength: 1 },
    source_domain: { type: "string", minLength: 1 },
    published_at: { type: "string", format: "date-time" },
    retrieved_at: { type: "string", format: "date-time" },
    completeness_state: {
      type: "string",
      enum: callArtifactCompletenessStates
    },
    rights: evidenceRightsMetadataSchema,
    content_hash: { type: "string", minLength: 1 },
    metadata: { type: "object" }
  }
} as const;
