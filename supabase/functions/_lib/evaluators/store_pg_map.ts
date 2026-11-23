// Row mappers for store_pg.ts, copied from apps/product-api/src/store.ts.
// postgres.js returns Date for timestamptz and date columns, and string for numeric.
import type { FearGreedSnapshot } from "../research/macro_stress.ts";
import type {
  AlertLedgerRecord,
  CalendarEventRecord,
  CanonicalEvent,
  ContrarianAnchorRecord,
  ConvictionJournalEntryRecord,
  KillSwitchEvaluationRecord,
  KillSwitchRuleRecord,
  NameRelationshipRecord,
  ReportMeta,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserResearchHoldingRecord,
  UserResearchState,
  UserResearchStateRecord,
  WarRoomCadenceState,
  WarRoomRow,
} from "./types.ts";

export type Row = Record<string, unknown>;

export function iso(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function isoNow(value: unknown): string {
  return iso(value) ?? new Date().toISOString();
}

// A date column as YYYY-MM-DD.
export function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function array(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function optNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : Number(value);
}

function optString(value: unknown): string | undefined {
  return value ? String(value) : undefined;
}

export function mapFearGreed(row: Row): FearGreedSnapshot {
  return {
    id: String(row.id),
    market_date: dateOnly(row.market_date),
    score: Number(row.score),
    label: String(row.label) as FearGreedSnapshot["label"],
    sub_scores: array(row.sub_scores) as FearGreedSnapshot["sub_scores"],
    missing_inputs: array(row.missing_inputs).map((v) => String(v)),
    calculated_at: isoNow(row.calculated_at),
  };
}

export function mapCanonicalEvent(row: Row): CanonicalEvent {
  return {
    id: String(row.id),
    family: String(row.family) as CanonicalEvent["family"],
    subject_type: String(row.subject_type) as CanonicalEvent["subject_type"],
    subject_id: String(row.subject_id),
    title: String(row.title),
    occurred_at: isoNow(row.occurred_at),
    source_state: String(row.source_state) as CanonicalEvent["source_state"],
    source: record(row.source) ?? {},
    retrieved_at: isoNow(row.retrieved_at),
    missing_fields: array(row.missing_fields),
    metadata: record(row.metadata) ?? {},
  };
}

export function mapPayload<T>(row: Row): T {
  return (record(row.payload) ?? row) as T;
}

export function mapCalendarEvent(row: Row): CalendarEventRecord {
  const timing = row.timing_state == null ? "" : String(row.timing_state).trim();
  const source = row.source_state == null ? "" : String(row.source_state).trim();
  const reason = row.reason_text == null ? "" : String(row.reason_text).trim();
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    eventType: String(row.event_type) as CalendarEventRecord["eventType"],
    eventDate: dateOnly(row.event_date),
    eventTime: row.event_time == null
      ? undefined
      : String(row.event_time) as CalendarEventRecord["eventTime"],
    provider: String(row.provider),
    retrievedAt: isoNow(row.retrieved_at),
    timingState: timing === "confirmed" || timing === "actual" ? timing : "estimated",
    sourceState:
      source === "official" || source === "first_party" || source === "mixed" || source === "conflicting"
        ? source
        : "derived",
    sourceRef: record(row.source_ref) ?? {},
    reasonText: reason.length > 0 ? reason : "No explicit timing reason was provided.",
  };
}

export function mapContrarianAnchor(row: Row): ContrarianAnchorRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    reportId: optString(row.report_id),
    signalValue: String(row.signal_value) as ContrarianAnchorRecord["signalValue"],
    anchorPrice: Number(row.anchor_price),
    anchoredAt: isoNow(row.anchored_at),
    expiresAt: isoNow(row.expires_at),
    isActive: Boolean(row.is_active),
  };
}

export function mapKillSwitchRule(row: Row): KillSwitchRuleRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    reportId: optString(row.report_id),
    signalValue: row.signal_value
      ? String(row.signal_value) as KillSwitchRuleRecord["signalValue"]
      : undefined,
    anchorPrice: optNumber(row.anchor_price),
    conditionId: String(row.condition_id),
    conditionText: String(row.condition_text),
    signalType: String(row.signal_type) as KillSwitchRuleRecord["signalType"],
    rationale: String(row.rationale),
    thresholdValue: optNumber(row.threshold_value),
    thresholdUnit: optString(row.threshold_unit),
    direction: row.direction ? String(row.direction) as KillSwitchRuleRecord["direction"] : undefined,
    state: String(row.state) as KillSwitchRuleRecord["state"],
    createdAt: isoNow(row.created_at),
  };
}

export function mapKillSwitchEvaluation(row: Row): KillSwitchEvaluationRecord {
  return {
    id: String(row.id),
    ruleId: String(row.rule_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    signalSource: String(row.signal_source) as KillSwitchEvaluationRecord["signalSource"],
    triggerKey: String(row.trigger_key),
    outcome: String(row.outcome) as KillSwitchEvaluationRecord["outcome"],
    reasonCode: String(row.reason_code),
    reasonText: String(row.reason_text),
    observedValue: optNumber(row.observed_value),
    alertId: optString(row.alert_id),
    createdAt: isoNow(row.created_at),
    updatedAt: isoNow(row.updated_at),
  };
}

export function mapNameRelationship(row: Row): NameRelationshipRecord {
  return {
    relationshipId: String(row.relationship_id),
    userId: String(row.user_id),
    sourceTicker: String(row.source_ticker),
    targetTicker: String(row.target_ticker),
    relationshipType: String(row.relationship_type) as NameRelationshipRecord["relationshipType"],
    confidence: Number(row.confidence ?? 0),
    state: String(row.state) as NameRelationshipRecord["state"],
    sourceReportId: String(row.source_report_id),
    promptVersion: String(row.prompt_version ?? "unknown"),
    evidenceText: String(row.evidence_text ?? ""),
    rationale: String(row.rationale ?? ""),
    createdAt: isoNow(row.created_at),
    updatedAt: isoNow(row.updated_at),
    suppressedAt: iso(row.suppressed_at),
  };
}

export function mapMonitorSnapshot(row: Row): ThesisMonitorSnapshotRecord {
  const material = Number(row.material_events_count ?? 0);
  const unreviewed = Number(row.unreviewed_events_count ?? 0);
  const freshnessScore = Number(row.freshness_score ?? 0);
  return {
    userId: String(row.user_id),
    ticker: String(row.ticker),
    state: String(row.state) as ThesisMonitorSnapshotRecord["state"],
    reason: String(row.reason ?? ""),
    score: Number(row.score ?? 0),
    reportId: optString(row.report_id),
    reportGeneratedAt: iso(row.report_generated_at),
    reportSchemaVersion: optString(row.report_schema_version),
    lastDeepDiveAt: iso(row.last_deep_dive_at) ?? iso(row.report_generated_at),
    materialEventsCount: Number.isFinite(material) ? Math.max(0, Math.floor(material)) : 0,
    unreviewedEventsCount: Number.isFinite(unreviewed) ? Math.max(0, Math.floor(unreviewed)) : 0,
    freshnessState: String(row.freshness_state ?? "stale") as ThesisMonitorSnapshotRecord["freshnessState"],
    freshnessScore: Number.isFinite(freshnessScore) ? Math.min(1, Math.max(0, freshnessScore)) : 0,
    killSwitchTriggeredAt: iso(row.kill_switch_triggered_at),
    freshnessReason: String(row.freshness_reason ?? "Freshness has not been computed yet."),
    updatedAt: isoNow(row.updated_at),
  };
}

export function mapAlertLedger(row: Row): AlertLedgerRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    notificationType: String(row.notification_type) as AlertLedgerRecord["notificationType"],
    category: String(row.category) as AlertLedgerRecord["category"],
    route: String(row.route) as AlertLedgerRecord["route"],
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    detailBody: optString(row.detail_body),
    reasonCode: String(row.reason_code ?? ""),
    reasonText: String(row.reason_text ?? ""),
    deliveryState: String(row.delivery_state) as AlertLedgerRecord["deliveryState"],
    feedbackState: row.feedback_state
      ? String(row.feedback_state) as AlertLedgerRecord["feedbackState"]
      : undefined,
    mutedAt: iso(row.muted_at),
    context: record(row.context) ?? {},
    createdAt: isoNow(row.created_at),
    updatedAt: isoNow(row.updated_at),
  };
}

export function mapJournalEntry(row: Row): ConvictionJournalEntryRecord {
  return {
    id: String(row.journal_entry_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    eventType: String(row.event_type) as ConvictionJournalEntryRecord["eventType"],
    sourceType: String(row.source_type) as ConvictionJournalEntryRecord["sourceType"],
    sourceId: String(row.source_id),
    eventAt: isoNow(row.event_at),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    thesisSnapshot: (record(row.thesis_snapshot) ?? {}) as ConvictionJournalEntryRecord["thesisSnapshot"],
    evidenceRefs: array(row.evidence_refs) as ConvictionJournalEntryRecord["evidenceRefs"],
    reportId: optString(row.report_id),
    alertLedgerId: optString(row.alert_ledger_id),
    warRoomId: optString(row.war_room_id),
    monitorSnapshotKey: optString(row.monitor_snapshot_key),
    oppositeCaseId: optString(row.opposite_case_id),
    createdAt: isoNow(row.created_at),
    updatedAt: isoNow(row.updated_at),
  };
}

function cadence(value: unknown, current: 15 | 30, fallbackUpdatedAt: string): WarRoomCadenceState {
  const r = record(value) ?? {};
  const status = r.latest_cycle_status;
  return {
    current_cadence_min: Number(r.current_cadence_min) === 30 ? 30 : current,
    default_cadence_min: Number(r.default_cadence_min) === 30 ? 30 : 15,
    fallback_cadence_min: Number(r.fallback_cadence_min) === 15 ? 15 : 30,
    consecutive_failures: Math.max(0, Number(r.consecutive_failures ?? 0)),
    consecutive_lag_breaches: Math.max(0, Number(r.consecutive_lag_breaches ?? 0)),
    consecutive_runtime_breaches: Math.max(0, Number(r.consecutive_runtime_breaches ?? 0)),
    consecutive_healthy_cycles: Math.max(0, Number(r.consecutive_healthy_cycles ?? 0)),
    latest_cycle_status: status === "success" || status === "timeout" || status === "failure"
      ? status
      : undefined,
    latest_source_freshness_lag_min: optNumber(r.latest_source_freshness_lag_min),
    latest_runtime_min: optNumber(r.latest_runtime_min),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : fallbackUpdatedAt,
  };
}

export function mapWarRoom(row: Row): WarRoomRow {
  const updatedAt = isoNow(row.updated_at);
  const current = Number(row.current_cadence_min) === 30 ? 30 : 15;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    earningsEventId: String(row.earnings_event_id),
    eventDate: row.event_date ? dateOnly(row.event_date) : isoNow(row.prepared_at).slice(0, 10),
    state: String(row.state) as WarRoomRow["state"],
    currentCadenceMin: current,
    cadenceState: cadence(row.cadence_state, current, updatedAt),
    preparedAt: iso(row.prepared_at) ?? updatedAt,
    closedAt: iso(row.closed_at),
    createdAt: iso(row.created_at) ?? updatedAt,
    updatedAt,
  };
}

export function mapReportMeta(row: Row): ReportMeta {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportMeta["type"],
    ticker: optString(row.ticker),
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    createdAt: isoNow(row.created_at),
  };
}

export function mapHolding(row: Row): UserResearchHoldingRecord {
  return {
    userId: String(row.user_id),
    ticker: String(row.ticker),
    quantity: optNumber(row.quantity),
    costBasis: optNumber(row.cost_basis),
    label: row.label == null ? undefined : String(row.label),
    notes: row.notes == null ? undefined : String(row.notes),
    updatedAt: isoNow(row.updated_at),
  };
}

export function mapResearchState(row: Row): UserResearchStateRecord {
  return {
    stateId: String(row.state_id),
    userId: String(row.user_id),
    asOf: dateOnly(row.as_of),
    generatedAt: isoNow(row.generated_at),
    state: (record(row.state) ?? {}) as unknown as UserResearchState,
  };
}

export function mapFeedback(row: Row): UserFeedbackQueueRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    feedbackType: String(row.feedback_type) as UserFeedbackQueueRecord["feedbackType"],
    code: String(row.code),
    severity: String(row.severity),
    sourceSurface: String(row.source_surface),
    userTier: String(row.user_tier) as UserFeedbackQueueRecord["userTier"],
    reportId: optString(row.report_id),
    ticker: optString(row.ticker),
    message: String(row.message ?? ""),
    metadata: record(row.metadata) ?? {},
    triageStatus: String(row.triage_status) as UserFeedbackQueueRecord["triageStatus"],
    routeStatus: String(row.route_status),
    triageOwner: optString(row.triage_owner),
    triagedAt: iso(row.triaged_at),
    createdAt: isoNow(row.created_at),
    updatedAt: isoNow(row.updated_at),
  };
}

export function stringArray(value: unknown): string[] {
  return array(value).map((v) => String(v));
}
