export const evidenceRightsClasses = [
  "official_public",
  "first_party_public",
  "licensed",
  "user_provided",
  "unknown",
  "prohibited"
] as const;

export type EvidenceRightsClass = (typeof evidenceRightsClasses)[number];

export const evidenceDisplayModes = [
  "full_text_allowed",
  "excerpt_only",
  "headline_only",
  "link_only",
  "internal_only_not_user_visible"
] as const;

export type EvidenceDisplayMode = (typeof evidenceDisplayModes)[number];

export const evidenceSourceRanks = [
  "official",
  "first_party",
  "allowlisted_context",
  "third_party",
  "unknown"
] as const;

export type EvidenceSourceRank = (typeof evidenceSourceRanks)[number];

export interface EvidenceRightsMetadata {
  rights_class: EvidenceRightsClass;
  display_mode: EvidenceDisplayMode;
  source_rank: EvidenceSourceRank;
  source_type: string;
  can_store_full_text: boolean;
  can_display_excerpt: boolean;
  can_display_link: boolean;
  policy_reason: string;
  reviewed_at: string;
  review_expires_at?: string;
}

export const evidenceRightsMetadataSchema = {
  $id: "EvidenceRightsMetadata",
  type: "object",
  additionalProperties: false,
  required: [
    "rights_class",
    "display_mode",
    "source_rank",
    "source_type",
    "can_store_full_text",
    "can_display_excerpt",
    "can_display_link",
    "policy_reason",
    "reviewed_at"
  ],
  properties: {
    rights_class: {
      type: "string",
      enum: evidenceRightsClasses
    },
    display_mode: {
      type: "string",
      enum: evidenceDisplayModes
    },
    source_rank: {
      type: "string",
      enum: evidenceSourceRanks
    },
    source_type: { type: "string", minLength: 1 },
    can_store_full_text: { type: "boolean" },
    can_display_excerpt: { type: "boolean" },
    can_display_link: { type: "boolean" },
    policy_reason: { type: "string", minLength: 1 },
    reviewed_at: { type: "string", format: "date-time" },
    review_expires_at: { type: "string", format: "date-time" }
  }
} as const;
