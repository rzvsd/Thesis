// Row mappers copied from apps/product-api/src/store.ts.
// postgres.js returns Date for timestamptz and date columns and string for numeric, so the
// helpers below turn those back into the strings and numbers the old node-pg code produced.
import type { FearGreedSnapshot } from "./macro_stress.ts";
import type {
  AlertFeedbackState,
  AlertLedgerCategory,
  AlertLedgerRecord,
  AlertRouteTarget,
  CalendarEventRecord,
  CalendarEventTime,
  CallArtifact,
  ConvictionEvidenceRef,
  ConvictionInsightCardRecord,
  ConvictionInsightFinding,
  ConvictionJournalEntryRecord,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  KillSwitchDirection,
  NameRelationshipRecord,
  NameRelationshipState,
  NameRelationshipType,
  NotificationType,
  OppositeCaseReportRecord,
  ReportRecord,
  ScenarioStressImpactLevel,
  ScenarioStressImpactRecord,
  ScenarioStressRuleSuggestionRecord,
  ScenarioStressRunRecord,
  ScenarioStressTemplateId,
  ScenarioStressTemplateRecord,
  ScenarioStressThesisBreakLikelihood,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  WarRoomCycleStatus,
  WarRoomRecord,
  WarRoomSourceRef,
  WarRoomTimelineEventRecord,
} from "./types.ts";

export type Row = Record<string, unknown>;

export function asIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// For `date` columns: postgres.js gives a Date at UTC midnight; the app wants YYYY-MM-DD.
export function asDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function asJsonArray(value: unknown): unknown[] {
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

const now = () => new Date().toISOString();

export function asConvictionEvidenceRefs(value: unknown): ConvictionEvidenceRef[] {
  const refs: ConvictionEvidenceRef[] = [];
  for (const entry of asJsonArray(value)) {
    const record = asRecord(entry);
    if (!record?.kind || !record.ref_id) continue;
    const ref: ConvictionEvidenceRef = {
      kind: String(record.kind) as ConvictionEvidenceRef["kind"],
      ref_id: String(record.ref_id),
    };
    if (record.label) ref.label = String(record.label);
    if (record.ticker) ref.ticker = String(record.ticker);
    const capturedAt = asIsoString(record.captured_at);
    if (capturedAt) ref.captured_at = capturedAt;
    refs.push(ref);
  }
  return refs;
}

function asConvictionInsightFindings(value: unknown): ConvictionInsightFinding[] {
  const findings: ConvictionInsightFinding[] = [];
  for (const entry of asJsonArray(value)) {
    const record = asRecord(entry);
    if (!record?.finding_type || !record.title || !record.summary) continue;
    findings.push({
      finding_type: String(record.finding_type) as ConvictionInsightFinding["finding_type"],
      title: String(record.title),
      summary: String(record.summary),
      tickers: asStringArray(record.tickers),
      evidence_refs: asConvictionEvidenceRefs(record.evidence_refs),
      confidence: Number(record.confidence ?? 0),
    });
  }
  return findings;
}

function asOppositeCaseKeyPoints(value: unknown): OppositeCaseReportRecord["keyPoints"] {
  return asJsonArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record?.title || !record.summary) return undefined;
      return {
        title: String(record.title),
        summary: String(record.summary),
        evidence_refs: asConvictionEvidenceRefs(record.evidence_refs),
      };
    })
    .filter((entry): entry is OppositeCaseReportRecord["keyPoints"][number] => Boolean(entry));
}

function asWarRoomSourceRefs(value: unknown): WarRoomSourceRef[] {
  const refs: WarRoomSourceRef[] = [];
  for (const entry of asJsonArray(value)) {
    const record = asRecord(entry);
    if (!record?.kind || !record.ref_id) continue;
    const ref: WarRoomSourceRef = { kind: String(record.kind), ref_id: String(record.ref_id) };
    if (record.label) ref.label = String(record.label);
    if (record.url) ref.url = String(record.url);
    const capturedAt = asIsoString(record.captured_at);
    if (capturedAt) ref.captured_at = capturedAt;
    refs.push(ref);
  }
  return refs;
}

export function mapSubscriptionTier(row: Row | undefined): SubscriptionTier {
  return row && String(row.tier) === "PRO" ? "PRO" : "FREE";
}

export function mapReport(row: Row): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportRecord["type"],
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    createdAt: asIsoString(row.created_at) ?? now(),
  };
}

export function mapFearGreedSnapshot(row: Row): FearGreedSnapshot {
  return {
    id: String(row.id),
    market_date: asDateString(row.market_date),
    score: Number(row.score),
    label: String(row.label) as FearGreedSnapshot["label"],
    sub_scores: Array.isArray(row.sub_scores) ? (row.sub_scores as FearGreedSnapshot["sub_scores"]) : [],
    missing_inputs: asStringArray(row.missing_inputs),
    calculated_at: asIsoString(row.calculated_at) ?? now(),
  };
}

export function mapCallArtifact(row: Row): CallArtifact {
  const payload = (asRecord(row.payload) ?? row) as unknown as CallArtifact;
  return { ...payload, rights: { ...payload.rights }, metadata: { ...payload.metadata } };
}

export function mapCalendarEvent(row: Row): CalendarEventRecord {
  const eventTime = row.event_time == null ? undefined : String(row.event_time) as CalendarEventTime;
  const timingRaw = row.timing_state == null ? undefined : String(row.timing_state).trim();
  const timingState = timingRaw === "confirmed" || timingRaw === "actual" ? timingRaw : "estimated";
  const sourceRaw = row.source_state == null ? undefined : String(row.source_state).trim();
  const sourceState = sourceRaw === "official" || sourceRaw === "first_party" || sourceRaw === "mixed" ||
      sourceRaw === "conflicting"
    ? sourceRaw
    : "derived";
  const reasonText = row.reason_text == null ? "" : String(row.reason_text).trim();
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    eventType: String(row.event_type),
    eventDate: asDateString(row.event_date),
    eventTime,
    provider: String(row.provider),
    retrievedAt: asIsoString(row.retrieved_at) ?? now(),
    timingState,
    sourceState,
    sourceRef: asRecord(row.source_ref) ?? {},
    reasonText: reasonText.length > 0 ? reasonText : "No explicit timing reason was provided.",
  };
}

export function mapNameRelationship(row: Row): NameRelationshipRecord {
  return {
    relationshipId: String(row.relationship_id),
    userId: String(row.user_id),
    sourceTicker: String(row.source_ticker),
    targetTicker: String(row.target_ticker),
    relationshipType: String(row.relationship_type) as NameRelationshipType,
    confidence: Number(row.confidence ?? 0),
    state: String(row.state) as NameRelationshipState,
    sourceReportId: String(row.source_report_id),
    promptVersion: String(row.prompt_version ?? "unknown"),
    evidenceText: String(row.evidence_text ?? ""),
    rationale: String(row.rationale ?? ""),
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
    suppressedAt: asIsoString(row.suppressed_at),
  };
}

export function mapThesisMonitorSnapshot(row: Row): ThesisMonitorSnapshotRecord {
  const materialEventsCount = Number(row.material_events_count ?? 0);
  const unreviewedEventsCount = Number(row.unreviewed_events_count ?? 0);
  const freshnessScore = Number(row.freshness_score ?? 0);
  return {
    userId: String(row.user_id),
    ticker: String(row.ticker),
    state: String(row.state),
    reason: String(row.reason ?? ""),
    score: Number(row.score ?? 0),
    reportId: row.report_id ? String(row.report_id) : undefined,
    reportGeneratedAt: asIsoString(row.report_generated_at),
    reportSchemaVersion: row.report_schema_version ? String(row.report_schema_version) : undefined,
    lastDeepDiveAt: asIsoString(row.last_deep_dive_at) ?? asIsoString(row.report_generated_at),
    materialEventsCount: Number.isFinite(materialEventsCount)
      ? Math.max(0, Math.floor(materialEventsCount))
      : 0,
    unreviewedEventsCount: Number.isFinite(unreviewedEventsCount)
      ? Math.max(0, Math.floor(unreviewedEventsCount))
      : 0,
    freshnessState: String(row.freshness_state ?? "stale") as ThesisMonitorSnapshotRecord["freshnessState"],
    freshnessScore: Number.isFinite(freshnessScore) ? Math.min(1, Math.max(0, freshnessScore)) : 0,
    killSwitchTriggeredAt: asIsoString(row.kill_switch_triggered_at),
    freshnessReason: String(row.freshness_reason ?? "Freshness has not been computed yet."),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapUserFeedbackQueueRecord(row: Row): UserFeedbackQueueRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    feedbackType: String(row.feedback_type) as UserFeedbackQueueRecord["feedbackType"],
    code: String(row.code) as UserFeedbackQueueRecord["code"],
    severity: String(row.severity) as UserFeedbackQueueRecord["severity"],
    sourceSurface: String(row.source_surface),
    userTier: String(row.user_tier) as SubscriptionTier,
    reportId: row.report_id ? String(row.report_id) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
    message: String(row.message ?? ""),
    metadata: asRecord(row.metadata) ?? {},
    triageStatus: String(row.triage_status) as UserFeedbackQueueRecord["triageStatus"],
    routeStatus: String(row.route_status) as UserFeedbackQueueRecord["routeStatus"],
    triageOwner: row.triage_owner ? String(row.triage_owner) : undefined,
    triagedAt: asIsoString(row.triaged_at),
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapAlertLedgerRecord(row: Row): AlertLedgerRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    notificationType: String(row.notification_type) as NotificationType,
    category: String(row.category) as AlertLedgerCategory,
    route: String(row.route) as AlertRouteTarget,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    detailBody: row.detail_body ? String(row.detail_body) : undefined,
    reasonCode: String(row.reason_code ?? ""),
    reasonText: String(row.reason_text ?? ""),
    deliveryState: String(row.delivery_state) as AlertLedgerRecord["deliveryState"],
    feedbackState: row.feedback_state ? (String(row.feedback_state) as AlertFeedbackState) : undefined,
    mutedAt: asIsoString(row.muted_at),
    context: asRecord(row.context) ?? {},
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapConvictionJournalEntryRecord(row: Row): ConvictionJournalEntryRecord {
  const snapshot = (asRecord(row.thesis_snapshot) ?? {}) as ConvictionThesisSnapshot;
  return {
    id: String(row.journal_entry_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    eventType: String(row.event_type) as ConvictionJournalEventType,
    sourceType: String(row.source_type) as ConvictionJournalSourceType,
    sourceId: String(row.source_id),
    eventAt: asIsoString(row.event_at) ?? now(),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    thesisSnapshot: {
      ...snapshot,
      signal_reasons: snapshot.signal_reasons ? [...snapshot.signal_reasons] : undefined,
    },
    evidenceRefs: asConvictionEvidenceRefs(row.evidence_refs),
    reportId: row.report_id ? String(row.report_id) : undefined,
    alertLedgerId: row.alert_ledger_id ? String(row.alert_ledger_id) : undefined,
    warRoomId: row.war_room_id ? String(row.war_room_id) : undefined,
    monitorSnapshotKey: row.monitor_snapshot_key ? String(row.monitor_snapshot_key) : undefined,
    oppositeCaseId: row.opposite_case_id ? String(row.opposite_case_id) : undefined,
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapConvictionInsightCardRecord(row: Row): ConvictionInsightCardRecord {
  return {
    id: String(row.insight_id),
    userId: String(row.user_id),
    periodStart: asDateString(row.period_start),
    periodEnd: asDateString(row.period_end),
    insightType: String(row.insight_type) as ConvictionInsightCardRecord["insightType"],
    status: String(row.status) as ConvictionInsightCardRecord["status"],
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    findings: asConvictionInsightFindings(row.findings),
    sourceJournalEntryIds: asStringArray(asJsonArray(row.source_journal_entry_ids)),
    generatedAt: asIsoString(row.generated_at) ?? now(),
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapOppositeCaseReportRecord(row: Row): OppositeCaseReportRecord {
  return {
    id: String(row.opposite_case_id),
    userId: String(row.user_id),
    sourceReportId: String(row.source_report_id),
    ticker: String(row.ticker),
    promptVersion: String(row.prompt_version),
    thesisSummary: String(row.thesis_summary ?? ""),
    oppositeCaseSummary: String(row.opposite_case_summary ?? ""),
    keyPoints: asOppositeCaseKeyPoints(row.key_points),
    sharedEvidenceRefs: asConvictionEvidenceRefs(row.shared_evidence_refs),
    decisiveFactors: asStringArray(asJsonArray(row.decisive_factors)),
    generatedAt: asIsoString(row.generated_at) ?? now(),
    createdAt: asIsoString(row.created_at) ?? now(),
  };
}

export function mapScenarioStressTemplateRecord(row: Row): ScenarioStressTemplateRecord {
  return {
    templateId: String(row.scenario_id) as ScenarioStressTemplateId,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    hypothesis: String(row.hypothesis ?? ""),
    displayOrder: Number(row.display_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: asIsoString(row.created_at) ?? now(),
    updatedAt: asIsoString(row.updated_at) ?? now(),
  };
}

export function mapScenarioStressRunRecord(row: Row): ScenarioStressRunRecord {
  return {
    id: String(row.scenario_run_id),
    scenarioId: String(row.scenario_id) as ScenarioStressTemplateId,
    userId: String(row.user_id),
    status: String(row.status) as ScenarioStressRunRecord["status"],
    runMode: String(row.run_mode) as ScenarioStressRunRecord["runMode"],
    asOf: asDateString(row.as_of),
    totalNames: Number(row.total_names ?? 0),
    impactedNames: Number(row.impacted_names ?? 0),
    criticalNames: Number(row.critical_names ?? 0),
    summary: String(row.summary ?? ""),
    createdAt: asIsoString(row.created_at) ?? now(),
    completedAt: asIsoString(row.completed_at) ?? now(),
  };
}

export function mapScenarioStressImpactRecord(row: Row): ScenarioStressImpactRecord {
  return {
    id: String(row.scenario_impact_id),
    scenarioRunId: String(row.scenario_run_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    impactLevel: String(row.impact_level) as ScenarioStressImpactLevel,
    thesisBreakLikelihood: String(row.thesis_break_likelihood) as ScenarioStressThesisBreakLikelihood,
    stressScore: Number(row.stress_score ?? 0),
    rationale: String(row.rationale ?? ""),
    evidenceRefs: asStringArray(asJsonArray(row.evidence_refs)),
    createdAt: asIsoString(row.created_at) ?? now(),
  };
}

export function mapScenarioStressRuleSuggestionRecord(row: Row): ScenarioStressRuleSuggestionRecord {
  return {
    id: String(row.scenario_rule_suggestion_id),
    scenarioRunId: String(row.scenario_run_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    signalType: String(row.signal_type),
    direction: String(row.direction) as KillSwitchDirection,
    conditionText: String(row.condition_text ?? ""),
    rationale: String(row.rationale ?? ""),
    confidence: Number(row.confidence ?? 0),
    createdAt: asIsoString(row.created_at) ?? now(),
  };
}

function asWarRoomCycleStatus(value: unknown): WarRoomCycleStatus {
  if (typeof value !== "string") return "success";
  const normalized = value.trim().toLowerCase();
  if (normalized === "failed" || normalized === "failure") return "failure";
  if (normalized === "timeout") return "timeout";
  return "success";
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// mapEarningsWarRoomRecord + toLegacyWarRoomRecord from the old server, fused into one step.
export function mapWarRoomRecord(row: Row): WarRoomRecord {
  const updatedAt = asIsoString(row.updated_at) ?? now();
  const cadence = asRecord(row.cadence_state) ?? {};
  const latestStatus =
    cadence.latest_cycle_status === "success" || cadence.latest_cycle_status === "timeout" ||
      cadence.latest_cycle_status === "failure"
      ? cadence.latest_cycle_status
      : undefined;
  const state = String(row.state);
  const eventDate = row.event_date instanceof Date
    ? asDateString(row.event_date)
    : typeof row.event_date === "string" && row.event_date.trim().length > 0
    ? row.event_date.trim()
    : asIsoString(row.prepared_at)?.slice(0, 10) ?? now().slice(0, 10);
  return {
    warRoomId: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    earningsEventId: String(row.earnings_event_id),
    eventDate,
    state: state === "live" || state === "post" || state === "closed" ? state : "pre",
    currentCadenceMin: Number(row.current_cadence_min) === 30 ? 30 : 15,
    lastCycleStatus: latestStatus ? asWarRoomCycleStatus(latestStatus) : undefined,
    lastLagMin: optionalNumber(cadence.latest_source_freshness_lag_min),
    lastRuntimeMin: optionalNumber(cadence.latest_runtime_min),
    lastCycleAt: asIsoString(cadence.updated_at) ?? updatedAt,
    preparedAt: asIsoString(row.prepared_at) ?? updatedAt,
    closedAt: asIsoString(row.closed_at),
    createdAt: asIsoString(row.created_at) ?? updatedAt,
    updatedAt,
  };
}

export function mapWarRoomTimelineEvent(row: Row): WarRoomTimelineEventRecord {
  return {
    id: String(row.id),
    warRoomId: String(row.war_room_id),
    phase: String(row.phase),
    eventType: String(row.event_type),
    reasonText: String(row.reason_text ?? ""),
    sourceRefs: asWarRoomSourceRefs(row.source_refs),
    alertLedgerId: row.alert_ledger_id ? String(row.alert_ledger_id) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    metadata: asRecord(row.metadata) ?? {},
    createdAt: asIsoString(row.created_at) ?? now(),
  };
}
