import {
  killSwitchSignalTypes,
  type KillSwitchSignalType
} from "./kill-switch-rule";

export const nameRelationshipTypes = [
  "supplier",
  "competitor",
  "partner",
  "sector"
] as const;

export type NameRelationshipType = (typeof nameRelationshipTypes)[number];

export const nameRelationshipStates = [
  "active",
  "suppressed",
  "inactive"
] as const;

export type NameRelationshipState = (typeof nameRelationshipStates)[number];

export const crossNamePropagationSignalSources = ["daily", "event"] as const;

export type CrossNamePropagationSignalSource =
  (typeof crossNamePropagationSignalSources)[number];

export type CrossNamePropagationSignalType = KillSwitchSignalType;

export const crossNamePropagationEventCategories = [
  "thesis_drift",
  "macro"
] as const;

export type CrossNamePropagationEventCategory =
  (typeof crossNamePropagationEventCategories)[number];

export interface NameRelationshipDraft {
  relationship_id?: string;
  source_ticker: string;
  target_ticker: string;
  relationship_type: NameRelationshipType;
  confidence: number;
  evidence_text: string;
  rationale: string;
  prompt_version?: string;
}

export interface NameRelationshipItem {
  relationship_id: string;
  user_id: string;
  source_ticker: string;
  target_ticker: string;
  relationship_type: NameRelationshipType;
  confidence: number;
  state: NameRelationshipState;
  source_report_id: string;
  prompt_version: string;
  evidence_text: string;
  rationale: string;
  created_at: string;
  updated_at: string;
  suppressed_at?: string;
}

export interface NameRelationshipListResponse {
  data: NameRelationshipItem[];
}

export interface NameRelationshipIngestRequest {
  user_id: string;
  report_id: string;
  relationships: NameRelationshipDraft[];
}

export interface NameRelationshipIngestResponse {
  status: "ok";
  upserted: number;
}

export interface CrossNamePropagationEventFixture {
  source_ticker: string;
  signal_type: CrossNamePropagationSignalType;
  event_category?: CrossNamePropagationEventCategory;
  event_id?: string;
  source_report_id?: string;
  reason_text?: string;
  occurred_at?: string;
  metadata?: Record<string, string>;
}

export interface CrossNamePropagationEvaluationRequest {
  as_of?: string;
  signal_source?: CrossNamePropagationSignalSource;
  trigger_key?: string;
  confidence_threshold?: number;
  fixtures?: CrossNamePropagationEventFixture[];
}

export interface CrossNamePropagationEvaluationResponse {
  status: "ok";
  as_of: string;
  signal_source: CrossNamePropagationSignalSource;
  trigger_key: string;
  confidence_threshold: number;
  evaluated: number;
  matched: number;
  suppressed: number;
  attempted: number;
  delivered: number;
  failed: number;
}

export const nameRelationshipDraftSchema = {
  $id: "NameRelationshipDraft",
  type: "object",
  additionalProperties: false,
  required: [
    "source_ticker",
    "target_ticker",
    "relationship_type",
    "confidence",
    "evidence_text",
    "rationale"
  ],
  properties: {
    relationship_id: { type: "string", minLength: 1 },
    source_ticker: { type: "string", minLength: 1 },
    target_ticker: { type: "string", minLength: 1 },
    relationship_type: { type: "string", enum: nameRelationshipTypes },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence_text: { type: "string", minLength: 1 },
    rationale: { type: "string", minLength: 1 },
    prompt_version: { type: "string", minLength: 1 }
  }
} as const;

export const nameRelationshipItemSchema = {
  $id: "NameRelationshipItem",
  type: "object",
  additionalProperties: false,
  required: [
    "relationship_id",
    "user_id",
    "source_ticker",
    "target_ticker",
    "relationship_type",
    "confidence",
    "state",
    "source_report_id",
    "prompt_version",
    "evidence_text",
    "rationale",
    "created_at",
    "updated_at"
  ],
  properties: {
    relationship_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    source_ticker: { type: "string", minLength: 1 },
    target_ticker: { type: "string", minLength: 1 },
    relationship_type: { type: "string", enum: nameRelationshipTypes },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    state: { type: "string", enum: nameRelationshipStates },
    source_report_id: { type: "string", minLength: 1 },
    prompt_version: { type: "string", minLength: 1 },
    evidence_text: { type: "string", minLength: 1 },
    rationale: { type: "string", minLength: 1 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    suppressed_at: { type: "string", format: "date-time" }
  }
} as const;

export const nameRelationshipIngestRequestSchema = {
  $id: "NameRelationshipIngestRequest",
  type: "object",
  additionalProperties: false,
  required: ["user_id", "report_id", "relationships"],
  properties: {
    user_id: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    relationships: {
      type: "array",
      items: nameRelationshipDraftSchema
    }
  }
} as const;

export const crossNamePropagationEventFixtureSchema = {
  $id: "CrossNamePropagationEventFixture",
  type: "object",
  additionalProperties: false,
  required: ["source_ticker", "signal_type"],
  properties: {
    source_ticker: { type: "string", minLength: 1 },
    signal_type: { type: "string", enum: killSwitchSignalTypes },
    event_category: {
      type: "string",
      enum: crossNamePropagationEventCategories
    },
    event_id: { type: "string", minLength: 1 },
    source_report_id: { type: "string", minLength: 1 },
    reason_text: { type: "string", minLength: 1 },
    occurred_at: { type: "string", format: "date-time" },
    metadata: {
      type: "object",
      additionalProperties: { type: "string" }
    }
  }
} as const;

export const crossNamePropagationEvaluationRequestSchema = {
  $id: "CrossNamePropagationEvaluationRequest",
  type: "object",
  additionalProperties: false,
  properties: {
    as_of: { type: "string", format: "date" },
    signal_source: {
      type: "string",
      enum: crossNamePropagationSignalSources
    },
    trigger_key: { type: "string", minLength: 1 },
    confidence_threshold: { type: "number", minimum: 0, maximum: 1 },
    fixtures: {
      type: "array",
      items: crossNamePropagationEventFixtureSchema
    }
  }
} as const;
