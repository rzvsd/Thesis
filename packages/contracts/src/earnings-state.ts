import type { CallArtifactType } from "./call-artifact";

export const earningsEventTimingStates = ["estimated", "confirmed", "actual"] as const;

export type EarningsEventTimingState = (typeof earningsEventTimingStates)[number];

export const earningsEventSourceStates = [
  "official",
  "first_party",
  "derived",
  "mixed",
  "conflicting"
] as const;

export type EarningsEventSourceState = (typeof earningsEventSourceStates)[number];

export const earningsEventEvidenceStates = [
  "calendar_only",
  "release_artifact",
  "release_with_followup",
  "release_with_transcript"
] as const;

export type EarningsEventEvidenceState = (typeof earningsEventEvidenceStates)[number];

export interface EarningsEventTimingCandidate {
  event_id: string;
  event_date: string;
  event_time?: "before_market" | "after_market" | "during_market";
  timing_state: EarningsEventTimingState;
  source_state: EarningsEventSourceState;
  provider: string;
  retrieved_at: string;
  reason_text: string;
}

export interface EarningsEventConflictState {
  has_conflict: boolean;
  primary_source_state: EarningsEventSourceState;
  conflicting_dates: string[];
  conflicting_event_ids: string[];
  reason_text?: string;
}

export interface EarningsReleaseArtifactSummary {
  artifact_id: string;
  artifact_type: CallArtifactType;
  source_url: string;
  source_domain: string;
  published_at?: string;
  retrieved_at: string;
}

export interface EarningsEventState {
  ticker: string;
  earnings_event_id: string;
  event_date: string;
  event_time?: "before_market" | "after_market" | "during_market";
  timing_state: EarningsEventTimingState;
  source_state: EarningsEventSourceState;
  evidence_state: EarningsEventEvidenceState;
  reason_text: string;
  primary_candidate: EarningsEventTimingCandidate;
  candidates: EarningsEventTimingCandidate[];
  conflict: EarningsEventConflictState;
  release_artifact?: EarningsReleaseArtifactSummary;
  has_transcript: boolean;
  updated_at: string;
}

export interface EarningsEventStateListResponse {
  as_of: string;
  window_start: string;
  window_end: string;
  states: EarningsEventState[];
}

export const earningsEventTimingCandidateSchema = {
  $id: "EarningsEventTimingCandidate",
  type: "object",
  additionalProperties: false,
  required: [
    "event_id",
    "event_date",
    "timing_state",
    "source_state",
    "provider",
    "retrieved_at",
    "reason_text"
  ],
  properties: {
    event_id: { type: "string", minLength: 1 },
    event_date: { type: "string", format: "date" },
    event_time: {
      type: "string",
      enum: ["before_market", "after_market", "during_market"]
    },
    timing_state: {
      type: "string",
      enum: earningsEventTimingStates
    },
    source_state: {
      type: "string",
      enum: earningsEventSourceStates
    },
    provider: { type: "string", minLength: 1 },
    retrieved_at: { type: "string", format: "date-time" },
    reason_text: { type: "string", minLength: 1 }
  }
} as const;

export const earningsEventConflictStateSchema = {
  $id: "EarningsEventConflictState",
  type: "object",
  additionalProperties: false,
  required: ["has_conflict", "primary_source_state", "conflicting_dates", "conflicting_event_ids"],
  properties: {
    has_conflict: { type: "boolean" },
    primary_source_state: {
      type: "string",
      enum: earningsEventSourceStates
    },
    conflicting_dates: {
      type: "array",
      items: { type: "string", format: "date" }
    },
    conflicting_event_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    reason_text: { type: "string", minLength: 1 }
  }
} as const;

export const earningsReleaseArtifactSummarySchema = {
  $id: "EarningsReleaseArtifactSummary",
  type: "object",
  additionalProperties: false,
  required: ["artifact_id", "artifact_type", "source_url", "source_domain", "retrieved_at"],
  properties: {
    artifact_id: { type: "string", minLength: 1 },
    artifact_type: { type: "string", minLength: 1 },
    source_url: { type: "string", minLength: 1 },
    source_domain: { type: "string", minLength: 1 },
    published_at: { type: "string", format: "date-time" },
    retrieved_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsEventStateSchema = {
  $id: "EarningsEventState",
  type: "object",
  additionalProperties: false,
  required: [
    "ticker",
    "earnings_event_id",
    "event_date",
    "timing_state",
    "source_state",
    "evidence_state",
    "reason_text",
    "primary_candidate",
    "candidates",
    "conflict",
    "has_transcript",
    "updated_at"
  ],
  properties: {
    ticker: { type: "string", minLength: 1 },
    earnings_event_id: { type: "string", minLength: 1 },
    event_date: { type: "string", format: "date" },
    event_time: {
      type: "string",
      enum: ["before_market", "after_market", "during_market"]
    },
    timing_state: { type: "string", enum: earningsEventTimingStates },
    source_state: { type: "string", enum: earningsEventSourceStates },
    evidence_state: { type: "string", enum: earningsEventEvidenceStates },
    reason_text: { type: "string", minLength: 1 },
    primary_candidate: { $ref: "EarningsEventTimingCandidate" },
    candidates: {
      type: "array",
      items: { $ref: "EarningsEventTimingCandidate" }
    },
    conflict: { $ref: "EarningsEventConflictState" },
    release_artifact: { $ref: "EarningsReleaseArtifactSummary" },
    has_transcript: { type: "boolean" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsEventStateListResponseSchema = {
  $id: "EarningsEventStateListResponse",
  type: "object",
  additionalProperties: false,
  required: ["as_of", "window_start", "window_end", "states"],
  properties: {
    as_of: { type: "string", format: "date" },
    window_start: { type: "string", format: "date" },
    window_end: { type: "string", format: "date" },
    states: {
      type: "array",
      items: { $ref: "EarningsEventState" }
    }
  }
} as const;
