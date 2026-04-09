export const earningsWarRoomPhases = ["pre", "live", "post"] as const;

export type EarningsWarRoomPhase = (typeof earningsWarRoomPhases)[number];

export const earningsWarRoomStates = [
  "preparing",
  "ready",
  "live",
  "post",
  "closed",
  "degraded",
  "failed"
] as const;

export type EarningsWarRoomState = (typeof earningsWarRoomStates)[number];

export const earningsWarRoomCadenceMinutes = [15, 30] as const;

export type EarningsWarRoomCadenceMinute = (typeof earningsWarRoomCadenceMinutes)[number];

export const earningsWarRoomCycleStatuses = ["success", "timeout", "failure"] as const;

export type EarningsWarRoomCycleStatus = (typeof earningsWarRoomCycleStatuses)[number];

export const earningsWarRoomTimelineEventTypes = [
  "prepared",
  "playbook_updated",
  "live_cycle_completed",
  "cadence_changed",
  "alert_emitted",
  "deep_dive_queued",
  "post_event_closed",
  "failed"
] as const;

export type EarningsWarRoomTimelineEventType =
  (typeof earningsWarRoomTimelineEventTypes)[number];

export interface EarningsWarRoomSourceRef {
  kind: string;
  ref_id: string;
  label?: string;
  url?: string;
  captured_at?: string;
}

export interface EarningsWarRoomCadenceState {
  current_cadence_min: EarningsWarRoomCadenceMinute;
  default_cadence_min: EarningsWarRoomCadenceMinute;
  fallback_cadence_min: EarningsWarRoomCadenceMinute;
  consecutive_failures: number;
  consecutive_lag_breaches: number;
  consecutive_runtime_breaches: number;
  consecutive_healthy_cycles: number;
  latest_cycle_status?: EarningsWarRoomCycleStatus;
  latest_source_freshness_lag_min?: number;
  latest_runtime_min?: number;
  degraded_reason?: string;
  next_cycle_at?: string;
  updated_at: string;
}

export interface EarningsWarRoomHeader {
  war_room_id: string;
  user_id: string;
  ticker: string;
  earnings_event_id: string;
  event_date: string;
  state: EarningsWarRoomState;
  current_cadence_min: EarningsWarRoomCadenceMinute;
  cadence_state: EarningsWarRoomCadenceState;
  prepared_at: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EarningsWarRoomTimelineEvent {
  war_room_event_id: string;
  war_room_id: string;
  phase: EarningsWarRoomPhase;
  event_type: EarningsWarRoomTimelineEventType;
  reason_text: string;
  source_refs: EarningsWarRoomSourceRef[];
  alert_ledger_id?: string;
  report_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface EarningsWarRoomPayload {
  war_room: EarningsWarRoomHeader;
  timeline: EarningsWarRoomTimelineEvent[];
}

export const earningsWarRoomSourceRefSchema = {
  $id: "EarningsWarRoomSourceRef",
  type: "object",
  additionalProperties: false,
  required: ["kind", "ref_id"],
  properties: {
    kind: { type: "string", minLength: 1 },
    ref_id: { type: "string", minLength: 1 },
    label: { type: "string", minLength: 1 },
    url: { type: "string", minLength: 1 },
    captured_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsWarRoomCadenceStateSchema = {
  $id: "EarningsWarRoomCadenceState",
  type: "object",
  additionalProperties: false,
  required: [
    "current_cadence_min",
    "default_cadence_min",
    "fallback_cadence_min",
    "consecutive_failures",
    "consecutive_lag_breaches",
    "consecutive_runtime_breaches",
    "consecutive_healthy_cycles",
    "updated_at"
  ],
  properties: {
    current_cadence_min: { type: "integer", enum: earningsWarRoomCadenceMinutes },
    default_cadence_min: { type: "integer", enum: earningsWarRoomCadenceMinutes },
    fallback_cadence_min: { type: "integer", enum: earningsWarRoomCadenceMinutes },
    consecutive_failures: { type: "integer", minimum: 0 },
    consecutive_lag_breaches: { type: "integer", minimum: 0 },
    consecutive_runtime_breaches: { type: "integer", minimum: 0 },
    consecutive_healthy_cycles: { type: "integer", minimum: 0 },
    latest_cycle_status: { type: "string", enum: earningsWarRoomCycleStatuses },
    latest_source_freshness_lag_min: { type: "number", minimum: 0 },
    latest_runtime_min: { type: "number", minimum: 0 },
    degraded_reason: { type: "string", minLength: 1 },
    next_cycle_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsWarRoomHeaderSchema = {
  $id: "EarningsWarRoomHeader",
  type: "object",
  additionalProperties: false,
  required: [
    "war_room_id",
    "user_id",
    "ticker",
    "earnings_event_id",
    "event_date",
    "state",
    "current_cadence_min",
    "cadence_state",
    "prepared_at",
    "created_at",
    "updated_at"
  ],
  properties: {
    war_room_id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    ticker: { type: "string", minLength: 1 },
    earnings_event_id: { type: "string", minLength: 1 },
    event_date: { type: "string", format: "date" },
    state: { type: "string", enum: earningsWarRoomStates },
    current_cadence_min: { type: "integer", enum: earningsWarRoomCadenceMinutes },
    cadence_state: { $ref: "EarningsWarRoomCadenceState" },
    prepared_at: { type: "string", format: "date-time" },
    closed_at: { type: "string", format: "date-time" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsWarRoomTimelineEventSchema = {
  $id: "EarningsWarRoomTimelineEvent",
  type: "object",
  additionalProperties: false,
  required: [
    "war_room_event_id",
    "war_room_id",
    "phase",
    "event_type",
    "reason_text",
    "source_refs",
    "created_at"
  ],
  properties: {
    war_room_event_id: { type: "string", minLength: 1 },
    war_room_id: { type: "string", minLength: 1 },
    phase: { type: "string", enum: earningsWarRoomPhases },
    event_type: { type: "string", enum: earningsWarRoomTimelineEventTypes },
    reason_text: { type: "string", minLength: 1 },
    source_refs: {
      type: "array",
      items: { $ref: "EarningsWarRoomSourceRef" }
    },
    alert_ledger_id: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    metadata: { type: "object" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;

export const earningsWarRoomPayloadSchema = {
  $id: "EarningsWarRoomPayload",
  type: "object",
  additionalProperties: false,
  required: ["war_room", "timeline"],
  properties: {
    war_room: { $ref: "EarningsWarRoomHeader" },
    timeline: {
      type: "array",
      items: { $ref: "EarningsWarRoomTimelineEvent" }
    }
  }
} as const;
