import type { NotificationType } from "./notification-preference";
import type { ThesisFreshnessState } from "./thesis-monitor-snapshot";
import {
  morningExceptionBriefingModes,
  type MorningExceptionBriefingMode
} from "./morning-exception-briefing";
import {
  earningsWarRoomCadenceMinutes,
  earningsWarRoomPhases,
  earningsWarRoomStates,
  earningsWarRoomTimelineEventTypes,
  type EarningsWarRoomCadenceMinute,
  type EarningsWarRoomPhase,
  type EarningsWarRoomState,
  type EarningsWarRoomTimelineEventType
} from "./earnings-war-room";

export const alertLedgerCategories = [
  "thesis_drift",
  "earnings",
  "macro",
  "system"
] as const;

export type AlertLedgerCategory = (typeof alertLedgerCategories)[number];

export const alertFeedbackStates = ["useful", "not_useful"] as const;

export type AlertFeedbackState = (typeof alertFeedbackStates)[number];

export const alertRouteTargets = ["today", "names", "research", "inbox", "you"] as const;

export type AlertRouteTarget = (typeof alertRouteTargets)[number];

export interface AlertLedgerContext {
  ticker?: string;
  report_id?: string;
  war_room_id?: string;
  earnings_event_id?: string;
  rule_id?: string;
  evaluation_id?: string;
  signal_type?: string;
  trigger_key?: string;
  pulse_date?: string;
  report_date?: string;
  digest_date?: string;
  related_tickers?: string[];
  freshness_state?: ThesisFreshnessState;
  freshness_score?: number;
  material_events_count?: number;
  unreviewed_events_count?: number;
  last_deep_dive_at?: string;
  kill_switch_triggered_at?: string;
  briefing_mode?: MorningExceptionBriefingMode;
  exceptions_count?: number;
  watchlist_count?: number;
  lead_route?: AlertRouteTarget;
  lead_ticker?: string;
  lead_report_id?: string;
  lead_pulse_date?: string;
  lead_digest_date?: string;
  war_room_phase?: EarningsWarRoomPhase;
  war_room_state?: EarningsWarRoomState;
  war_room_event_type?: EarningsWarRoomTimelineEventType;
  war_room_cadence_min?: EarningsWarRoomCadenceMinute;
  war_room_next_cycle_at?: string;
  war_room_event_at?: string;
}

export interface AlertLedgerItem {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  category: AlertLedgerCategory;
  route: AlertRouteTarget;
  title: string;
  body: string;
  reason_code: string;
  reason_text: string;
  delivery_state: "sent" | "partial_failure";
  feedback_state?: AlertFeedbackState;
  muted_at?: string;
  context?: AlertLedgerContext;
  created_at: string;
  updated_at: string;
}

export interface AlertLedgerListResponse {
  data: AlertLedgerItem[];
}

export interface AlertLedgerFilter {
  category?: AlertLedgerCategory;
  limit?: number;
}

export interface AlertFeedbackSubmission {
  feedback: AlertFeedbackState;
}

export const alertLedgerContextSchema = {
  $id: "AlertLedgerContext",
  type: "object",
  additionalProperties: false,
  properties: {
    ticker: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    war_room_id: { type: "string", minLength: 1 },
    earnings_event_id: { type: "string", minLength: 1 },
    rule_id: { type: "string", minLength: 1 },
    evaluation_id: { type: "string", minLength: 1 },
    signal_type: { type: "string", minLength: 1 },
    trigger_key: { type: "string", minLength: 1 },
    pulse_date: { type: "string", format: "date" },
    report_date: { type: "string", format: "date" },
    digest_date: { type: "string", format: "date" },
    related_tickers: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    freshness_state: {
      type: "string",
      enum: ["current", "aging", "stale", "triggered"]
    },
    freshness_score: { type: "number", minimum: 0, maximum: 1 },
    material_events_count: { type: "integer", minimum: 0 },
    unreviewed_events_count: { type: "integer", minimum: 0 },
    last_deep_dive_at: { type: "string", format: "date-time" },
    kill_switch_triggered_at: { type: "string", format: "date-time" },
    briefing_mode: { type: "string", enum: morningExceptionBriefingModes },
    exceptions_count: { type: "integer", minimum: 0 },
    watchlist_count: { type: "integer", minimum: 0 },
    lead_route: { type: "string", enum: alertRouteTargets },
    lead_ticker: { type: "string", minLength: 1 },
    lead_report_id: { type: "string", minLength: 1 },
    lead_pulse_date: { type: "string", format: "date" },
    lead_digest_date: { type: "string", format: "date" },
    war_room_phase: { type: "string", enum: earningsWarRoomPhases },
    war_room_state: { type: "string", enum: earningsWarRoomStates },
    war_room_event_type: {
      type: "string",
      enum: earningsWarRoomTimelineEventTypes
    },
    war_room_cadence_min: {
      type: "integer",
      enum: earningsWarRoomCadenceMinutes
    },
    war_room_next_cycle_at: { type: "string", format: "date-time" },
    war_room_event_at: { type: "string", format: "date-time" }
  }
} as const;

export const alertLedgerItemSchema = {
  $id: "AlertLedgerItem",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "user_id",
    "notification_type",
    "category",
    "route",
    "title",
    "body",
    "reason_code",
    "reason_text",
    "delivery_state",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    user_id: { type: "string", minLength: 1 },
    notification_type: {
      type: "string",
      enum: [
        "earnings_preview",
        "earnings_war_room",
        "contrarian_alert",
        "kill_switch",
        "freshness_decay",
        "morning_exception_briefing",
        "weekly_digest",
        "market_pulse_ready"
      ]
    },
    category: { type: "string", enum: alertLedgerCategories },
    route: { type: "string", enum: alertRouteTargets },
    title: { type: "string", minLength: 1 },
    body: { type: "string", minLength: 1 },
    reason_code: { type: "string", minLength: 1 },
    reason_text: { type: "string", minLength: 1 },
    delivery_state: { type: "string", enum: ["sent", "partial_failure"] },
    feedback_state: { type: "string", enum: alertFeedbackStates },
    muted_at: { type: "string", format: "date-time" },
    context: { $ref: "AlertLedgerContext" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" }
  }
} as const;

export const alertLedgerFilterSchema = {
  $id: "AlertLedgerFilter",
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: alertLedgerCategories },
    limit: { type: "integer", minimum: 1, maximum: 100 }
  }
} as const;

export const alertFeedbackSubmissionSchema = {
  $id: "AlertFeedbackSubmission",
  type: "object",
  additionalProperties: false,
  required: ["feedback"],
  properties: {
    feedback: { type: "string", enum: alertFeedbackStates }
  }
} as const;
