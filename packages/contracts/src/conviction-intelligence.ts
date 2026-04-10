import type { ConfidenceLabel, SignalValue } from "./analysis-report";
import type { ThesisFreshnessState, ThesisMonitorState } from "./thesis-monitor-snapshot";

export const convictionJournalEventTypes = [
  "deep_dive_generated",
  "kill_switch_alert_fired",
  "freshness_decay_alert_fired",
  "earnings_war_room_closed",
  "cross_name_alert_fired",
  "alert_feedback_recorded",
  "opposite_case_generated"
] as const;

export type ConvictionJournalEventType =
  (typeof convictionJournalEventTypes)[number];

export const convictionJournalSourceTypes = [
  "report",
  "alert_ledger",
  "war_room",
  "monitor_snapshot",
  "opposite_case"
] as const;

export type ConvictionJournalSourceType =
  (typeof convictionJournalSourceTypes)[number];

export const convictionEvidenceRefKinds = [
  "report",
  "journal_entry",
  "alert_ledger",
  "war_room",
  "monitor_snapshot",
  "name_relationship",
  "evidence_item"
] as const;

export type ConvictionEvidenceRefKind =
  (typeof convictionEvidenceRefKinds)[number];

export const convictionInsightTypes = ["monthly_coherence"] as const;

export type ConvictionInsightType = (typeof convictionInsightTypes)[number];

export const convictionInsightFindingTypes = [
  "overlap",
  "contradiction",
  "mismatch"
] as const;

export type ConvictionInsightFindingType =
  (typeof convictionInsightFindingTypes)[number];

export const convictionInsightStatuses = [
  "generated",
  "degraded",
  "failed"
] as const;

export type ConvictionInsightStatus =
  (typeof convictionInsightStatuses)[number];

export interface ConvictionEvidenceRef {
  kind: ConvictionEvidenceRefKind;
  ref_id: string;
  label?: string;
  ticker?: string;
  captured_at?: string;
}

export interface ConvictionThesisSnapshot {
  ticker?: string;
  report_id?: string;
  report_generated_at?: string;
  report_schema_version?: string;
  signal_value?: SignalValue;
  signal_reasons?: string[];
  confidence_score?: number;
  confidence_label?: ConfidenceLabel;
  thesis_summary?: string;
  monitor_state?: ThesisMonitorState;
  monitor_reason?: string;
  monitor_score?: number;
  freshness_state?: ThesisFreshnessState;
  freshness_score?: number;
}

export interface ConvictionJournalEntry {
  journal_entry_id: string;
  user_id: string;
  ticker: string;
  event_type: ConvictionJournalEventType;
  source_type: ConvictionJournalSourceType;
  source_id: string;
  event_at: string;
  title: string;
  summary: string;
  thesis_snapshot: ConvictionThesisSnapshot;
  evidence_refs: ConvictionEvidenceRef[];
  report_id?: string;
  alert_ledger_id?: string;
  war_room_id?: string;
  monitor_snapshot_key?: string;
  opposite_case_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ConvictionTimelineResponse {
  data: ConvictionJournalEntry[];
}

export interface ConvictionInsightFinding {
  finding_type: ConvictionInsightFindingType;
  title: string;
  summary: string;
  tickers: string[];
  evidence_refs: ConvictionEvidenceRef[];
  confidence: number;
}

export interface ConvictionInsightCard {
  insight_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  insight_type: ConvictionInsightType;
  status: ConvictionInsightStatus;
  title: string;
  summary: string;
  findings: ConvictionInsightFinding[];
  source_journal_entry_ids: string[];
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConvictionInsightListResponse {
  data: ConvictionInsightCard[];
}

export interface OppositeCasePoint {
  title: string;
  summary: string;
  evidence_refs: ConvictionEvidenceRef[];
}

export interface OppositeCaseReport {
  opposite_case_id: string;
  user_id: string;
  source_report_id: string;
  ticker: string;
  prompt_version: string;
  thesis_summary: string;
  opposite_case_summary: string;
  key_points: OppositeCasePoint[];
  shared_evidence_refs: ConvictionEvidenceRef[];
  decisive_factors: string[];
  generated_at: string;
  created_at: string;
}

export interface OppositeCaseResponse {
  data: OppositeCaseReport;
}

export interface CoherenceEvaluationRequest {
  period_start?: string;
  period_end?: string;
  user_ids?: string[];
}

export interface CoherenceEvaluationResponse {
  status: "ok";
  period_start: string;
  period_end: string;
  evaluated_users: number;
  generated: number;
  degraded: number;
  failed: number;
}

export const convictionEvidenceRefSchema = {
  $id: "ConvictionEvidenceRef",
  type: "object",
  additionalProperties: false,
  required: ["kind", "ref_id"],
  properties: {
    kind: { type: "string", enum: convictionEvidenceRefKinds },
    ref_id: { type: "string", minLength: 1 },
    label: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    captured_at: { type: "string", format: "date-time" }
  }
} as const;

export const convictionThesisSnapshotSchema = {
  $id: "ConvictionThesisSnapshot",
  type: "object",
  additionalProperties: false,
  properties: {
    ticker: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    report_generated_at: { type: "string", format: "date-time" },
    report_schema_version: { type: "string", minLength: 1 },
    signal_value: {
      type: "string",
      enum: ["positive", "neutral", "negative", "no_signal"]
    },
    signal_reasons: {
      type: "array",
      items: { type: "string" }
    },
    confidence_score: { type: "number" },
    confidence_label: {
      type: "string",
      enum: ["high", "medium", "low", "insufficient_data"]
    },
    thesis_summary: { type: "string" },
    monitor_state: {
      type: "string",
      enum: ["intact", "improved", "weakened", "unresolved"]
    },
    monitor_reason: { type: "string" },
    monitor_score: { type: "number" },
    freshness_state: {
      type: "string",
      enum: ["current", "aging", "stale", "triggered"]
    },
    freshness_score: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

export const convictionJournalEntrySchema = {
  $id: "ConvictionJournalEntry",
  type: "object",
  additionalProperties: false,
  required: [
    "journal_entry_id",
    "user_id",
    "ticker",
    "event_type",
    "source_type",
    "source_id",
    "event_at",
    "title",
    "summary",
    "thesis_snapshot",
    "evidence_refs",
    "created_at",
    "updated_at"
  ],
  properties: {
    journal_entry_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    event_type: { type: "string", enum: convictionJournalEventTypes },
    source_type: { type: "string", enum: convictionJournalSourceTypes },
    source_id: { type: "string", minLength: 1 },
    event_at: { type: "string", format: "date-time" },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    thesis_snapshot: { $ref: "ConvictionThesisSnapshot" },
    evidence_refs: {
      type: "array",
      items: { $ref: "ConvictionEvidenceRef" }
    },
    report_id: { type: "string", minLength: 1 },
    alert_ledger_id: { type: "string", minLength: 1 },
    war_room_id: { type: "string", minLength: 1 },
    monitor_snapshot_key: { type: "string", minLength: 1 },
    opposite_case_id: { type: "string", minLength: 1 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const convictionInsightFindingSchema = {
  $id: "ConvictionInsightFinding",
  type: "object",
  additionalProperties: false,
  required: [
    "finding_type",
    "title",
    "summary",
    "tickers",
    "evidence_refs",
    "confidence"
  ],
  properties: {
    finding_type: { type: "string", enum: convictionInsightFindingTypes },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    tickers: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    evidence_refs: {
      type: "array",
      items: { $ref: "ConvictionEvidenceRef" }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

export const convictionInsightCardSchema = {
  $id: "ConvictionInsightCard",
  type: "object",
  additionalProperties: false,
  required: [
    "insight_id",
    "user_id",
    "period_start",
    "period_end",
    "insight_type",
    "status",
    "title",
    "summary",
    "findings",
    "source_journal_entry_ids",
    "generated_at",
    "created_at",
    "updated_at"
  ],
  properties: {
    insight_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    period_start: { type: "string", format: "date" },
    period_end: { type: "string", format: "date" },
    insight_type: { type: "string", enum: convictionInsightTypes },
    status: { type: "string", enum: convictionInsightStatuses },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    findings: {
      type: "array",
      items: { $ref: "ConvictionInsightFinding" }
    },
    source_journal_entry_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    generated_at: { type: "string", format: "date-time" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const oppositeCasePointSchema = {
  $id: "OppositeCasePoint",
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "evidence_refs"],
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    evidence_refs: {
      type: "array",
      items: { $ref: "ConvictionEvidenceRef" }
    }
  }
} as const;

export const oppositeCaseReportSchema = {
  $id: "OppositeCaseReport",
  type: "object",
  additionalProperties: false,
  required: [
    "opposite_case_id",
    "user_id",
    "source_report_id",
    "ticker",
    "prompt_version",
    "thesis_summary",
    "opposite_case_summary",
    "key_points",
    "shared_evidence_refs",
    "decisive_factors",
    "generated_at",
    "created_at"
  ],
  properties: {
    opposite_case_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    source_report_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    prompt_version: { type: "string", minLength: 1 },
    thesis_summary: { type: "string", minLength: 1 },
    opposite_case_summary: { type: "string", minLength: 1 },
    key_points: {
      type: "array",
      items: { $ref: "OppositeCasePoint" }
    },
    shared_evidence_refs: {
      type: "array",
      items: { $ref: "ConvictionEvidenceRef" }
    },
    decisive_factors: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    generated_at: { type: "string", format: "date-time" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;

export const coherenceEvaluationRequestSchema = {
  $id: "CoherenceEvaluationRequest",
  type: "object",
  additionalProperties: false,
  properties: {
    period_start: { type: "string", format: "date" },
    period_end: { type: "string", format: "date" },
    user_ids: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  }
} as const;
