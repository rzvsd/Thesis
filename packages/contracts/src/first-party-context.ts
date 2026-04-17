import type { EvidenceRightsMetadata } from "./evidence-rights";
import { evidenceRightsMetadataSchema } from "./evidence-rights";

export const firstPartyPageTypes = [
  "investor_relations",
  "earnings_release",
  "press_release",
  "presentation",
  "webcast",
  "sec_filing_reference",
  "supplemental_material",
  "newsroom"
] as const;

export type FirstPartyPageType = (typeof firstPartyPageTypes)[number];

export const firstPartyFetchStates = [
  "fetched",
  "rejected_unapproved_domain",
  "rejected_undefined_rights",
  "source_unavailable",
  "parser_unsupported",
  "skipped_outside_policy"
] as const;

export type FirstPartyContextFetchState = (typeof firstPartyFetchStates)[number];

export interface FirstPartySourceRegistryEntry {
  registry_entry_id: string;
  ticker: string;
  issuer_name: string;
  domain: string;
  allowed_paths: string[];
  page_types: FirstPartyPageType[];
  default_rights: EvidenceRightsMetadata;
  owner: string;
  reviewed_at: string;
  review_expires_at?: string;
  active: boolean;
}

export interface FirstPartyContextItem {
  context_id: string;
  ticker: string;
  event_id?: string;
  registry_entry_id: string;
  source_url: string;
  source_domain: string;
  page_type: FirstPartyPageType;
  title: string;
  summary: string;
  excerpt?: string;
  retrieved_at: string;
  published_at?: string;
  content_hash: string;
  fetch_state: FirstPartyContextFetchState;
  rights: EvidenceRightsMetadata;
  artifact_ids: string[];
  metadata: Record<string, unknown>;
}

export const firstPartySourceRegistryEntrySchema = {
  $id: "FirstPartySourceRegistryEntry",
  type: "object",
  additionalProperties: false,
  required: [
    "registry_entry_id",
    "ticker",
    "issuer_name",
    "domain",
    "allowed_paths",
    "page_types",
    "default_rights",
    "owner",
    "reviewed_at",
    "active"
  ],
  properties: {
    registry_entry_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    issuer_name: { type: "string", minLength: 1 },
    domain: { type: "string", minLength: 1 },
    allowed_paths: {
      type: "array",
      items: { type: "string" }
    },
    page_types: {
      type: "array",
      items: {
        type: "string",
        enum: firstPartyPageTypes
      }
    },
    default_rights: evidenceRightsMetadataSchema,
    owner: { type: "string", minLength: 1 },
    reviewed_at: { type: "string", format: "date-time" },
    review_expires_at: { type: "string", format: "date-time" },
    active: { type: "boolean" }
  }
} as const;

export const firstPartyContextItemSchema = {
  $id: "FirstPartyContextItem",
  type: "object",
  additionalProperties: false,
  required: [
    "context_id",
    "ticker",
    "registry_entry_id",
    "source_url",
    "source_domain",
    "page_type",
    "title",
    "summary",
    "retrieved_at",
    "content_hash",
    "fetch_state",
    "rights",
    "artifact_ids",
    "metadata"
  ],
  properties: {
    context_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    event_id: { type: "string", minLength: 1 },
    registry_entry_id: { type: "string", minLength: 1 },
    source_url: { type: "string", minLength: 1 },
    source_domain: { type: "string", minLength: 1 },
    page_type: {
      type: "string",
      enum: firstPartyPageTypes
    },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    excerpt: { type: "string" },
    retrieved_at: { type: "string", format: "date-time" },
    published_at: { type: "string", format: "date-time" },
    content_hash: { type: "string", minLength: 1 },
    fetch_state: {
      type: "string",
      enum: firstPartyFetchStates
    },
    rights: evidenceRightsMetadataSchema,
    artifact_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    metadata: { type: "object" }
  }
} as const;
