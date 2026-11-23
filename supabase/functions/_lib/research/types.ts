// Contract and record types for the research and alerts features.
// Copied from packages/contracts/src and apps/product-api/src/types.ts (Deno cannot import that package).
// Only the parts these routes use are here.

export type SubscriptionTier = "FREE" | "PRO";

// ---- Alerts ----
export const alertLedgerCategories = ["thesis_drift", "earnings", "macro", "system"] as const;
export type AlertLedgerCategory = (typeof alertLedgerCategories)[number];

export const alertFeedbackStates = ["useful", "not_useful"] as const;
export type AlertFeedbackState = (typeof alertFeedbackStates)[number];

export type AlertRouteTarget = "today" | "names" | "research" | "inbox" | "you";

export const notificationTypes = [
  "earnings_preview",
  "earnings_war_room",
  "contrarian_alert",
  "kill_switch",
  "freshness_decay",
  "morning_exception_briefing",
  "cross_name_propagation",
  "weekly_digest",
  "market_pulse_ready",
  "filing_change",
  "pulse_email",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export interface AlertLedgerRecord {
  id: string;
  userId: string;
  notificationType: NotificationType;
  category: AlertLedgerCategory;
  route: AlertRouteTarget;
  title: string;
  body: string;
  detailBody?: string;
  reasonCode: string;
  reasonText: string;
  deliveryState: "sent" | "partial_failure";
  feedbackState?: AlertFeedbackState;
  mutedAt?: string;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---- Name relationships ----
export const nameRelationshipStates = ["active", "suppressed", "inactive"] as const;
export type NameRelationshipState = (typeof nameRelationshipStates)[number];
export type NameRelationshipType = "supplier" | "competitor" | "partner" | "sector";

export interface NameRelationshipRecord {
  relationshipId: string;
  userId: string;
  sourceTicker: string;
  targetTicker: string;
  relationshipType: NameRelationshipType;
  confidence: number;
  state: NameRelationshipState;
  sourceReportId: string;
  promptVersion: string;
  evidenceText: string;
  rationale: string;
  createdAt: string;
  updatedAt: string;
  suppressedAt?: string;
}

// ---- Feedback ----
export const reportFeedbackCodes = ["useful", "confusing", "generic", "stale", "bug_report"] as const;
export type ReportFeedbackCode = (typeof reportFeedbackCodes)[number];
export const subscriptionFeedbackCodes = [
  "cancel_price",
  "cancel_low_value",
  "cancel_too_noisy",
  "cancel_other",
] as const;
export type SubscriptionFeedbackCode = (typeof subscriptionFeedbackCodes)[number];
export const feedbackSeverityLevels = ["normal", "high", "blocker"] as const;
export type FeedbackSeverity = (typeof feedbackSeverityLevels)[number];
export type FeedbackTriageStatus = "new" | "reviewed" | "routed" | "resolved" | "dismissed";
export type FeedbackRouteStatus = "pending" | "routed" | "not_applicable";

export interface UserFeedbackQueueRecord {
  id: string;
  userId: string;
  feedbackType: "report" | "subscription";
  code: ReportFeedbackCode | SubscriptionFeedbackCode;
  severity: FeedbackSeverity;
  sourceSurface: string;
  userTier: SubscriptionTier;
  reportId?: string;
  ticker?: string;
  message: string;
  metadata: Record<string, unknown>;
  triageStatus: FeedbackTriageStatus;
  routeStatus: FeedbackRouteStatus;
  triageOwner?: string;
  triagedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Reports (rows owned by M2) ----
export interface ReportRecord {
  id: string;
  jobId: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  createdAt: string;
}

// The parts of the stored report body these routes read.
export interface ValuationAssumptions {
  methodology: "deterministic_dcf";
  projection_years: number;
  terminal_growth_rate: number;
  wacc: number;
  beta?: number;
  effective_tax_rate?: number;
  shares_outstanding?: number;
}

export interface ValuationBlock {
  fair_value_mid?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  spot_price?: number;
  implied_upside_pct?: number;
  assumptions: ValuationAssumptions;
  degraded_reason?: string;
}

export interface ReportEvidence {
  evidence_id?: string;
  source_name?: string;
  retrieved_at?: string;
}

export interface AnalysisReport {
  report_id: string;
  job_id: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  generated_at: string;
  schema_version: string;
  sections: Array<{ section_id?: string; title: string; body?: string; evidence?: ReportEvidence[] }>;
  signal?: { value?: SignalValue; reasons?: string[]; evidence?: ReportEvidence[] };
  confidence?: { score?: number; label?: ConfidenceLabel };
  valuation?: ValuationBlock;
}

export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient_data";
export type SignalValue = "positive" | "neutral" | "negative" | "no_signal";

// ---- What-if scenario ----
export interface ScenarioOverrides {
  terminal_growth_rate?: number;
  wacc?: number;
  projection_years?: number;
}

export interface ScenarioInputOmission {
  omission_code: string;
  omission_text: string;
  affects_fields: string[];
}

export interface ScenarioValuationSnapshot {
  fair_value_mid?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  spot_price?: number;
  implied_upside_pct?: number;
  assumptions: ValuationAssumptions;
  degraded_reason?: string;
  omissions?: ScenarioInputOmission[];
}

export interface ScenarioResponse {
  report_id: string;
  deterministic_model: "phase6_deterministic_v1";
  base: ScenarioValuationSnapshot;
  scenario: ScenarioValuationSnapshot;
  omissions: ScenarioInputOmission[];
}

// ---- Monitor ----
export type ThesisMonitorState = "intact" | "improved" | "weakened" | "unresolved" | string;
export type ThesisFreshnessState = "current" | "aging" | "stale" | "triggered";

export interface ThesisMonitorSnapshotRecord {
  userId: string;
  ticker: string;
  state: ThesisMonitorState;
  reason: string;
  score: number;
  reportId?: string;
  reportGeneratedAt?: string;
  reportSchemaVersion?: string;
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  freshnessState: ThesisFreshnessState;
  freshnessScore: number;
  killSwitchTriggeredAt?: string;
  freshnessReason: string;
  updatedAt: string;
}

// ---- Conviction ----
export type ConvictionJournalEventType =
  | "deep_dive_generated"
  | "kill_switch_alert_fired"
  | "freshness_decay_alert_fired"
  | "earnings_war_room_closed"
  | "cross_name_alert_fired"
  | "alert_feedback_recorded"
  | "opposite_case_generated";

export type ConvictionJournalSourceType =
  | "report"
  | "alert_ledger"
  | "war_room"
  | "monitor_snapshot"
  | "opposite_case";

export type ConvictionEvidenceRefKind =
  | "report"
  | "journal_entry"
  | "alert_ledger"
  | "war_room"
  | "monitor_snapshot"
  | "name_relationship"
  | "evidence_item";

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

export interface ConvictionJournalEntryRecord {
  id: string;
  userId: string;
  ticker: string;
  eventType: ConvictionJournalEventType;
  sourceType: ConvictionJournalSourceType;
  sourceId: string;
  eventAt: string;
  title: string;
  summary: string;
  thesisSnapshot: ConvictionThesisSnapshot;
  evidenceRefs: ConvictionEvidenceRef[];
  reportId?: string;
  alertLedgerId?: string;
  warRoomId?: string;
  monitorSnapshotKey?: string;
  oppositeCaseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConvictionInsightFinding {
  finding_type: "overlap" | "contradiction" | "mismatch";
  title: string;
  summary: string;
  tickers: string[];
  evidence_refs: ConvictionEvidenceRef[];
  confidence: number;
}

export interface ConvictionInsightCardRecord {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  insightType: "monthly_coherence";
  status: "generated" | "degraded" | "failed";
  title: string;
  summary: string;
  findings: ConvictionInsightFinding[];
  sourceJournalEntryIds: string[];
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OppositeCasePoint {
  title: string;
  summary: string;
  evidence_refs: ConvictionEvidenceRef[];
}

export interface OppositeCaseReportRecord {
  id: string;
  userId: string;
  sourceReportId: string;
  ticker: string;
  promptVersion: string;
  thesisSummary: string;
  oppositeCaseSummary: string;
  keyPoints: OppositeCasePoint[];
  sharedEvidenceRefs: ConvictionEvidenceRef[];
  decisiveFactors: string[];
  generatedAt: string;
  createdAt: string;
}

// ---- Scenario stress ----
export const scenarioStressTemplateIds = [
  "rates_higher_for_longer",
  "recession_in_6m",
  "usd_up_10",
  "ai_hype_burst",
  "oil_120_spike",
] as const;
export type ScenarioStressTemplateId = (typeof scenarioStressTemplateIds)[number];
export type ScenarioStressImpactLevel = "none" | "watch" | "elevated" | "high" | "critical";
export type ScenarioStressThesisBreakLikelihood = "low" | "moderate" | "high" | "very_high";
export type KillSwitchSignalType = string;
export type KillSwitchDirection = "above" | "below" | "against_signal" | "any";

export interface ScenarioStressTemplateRecord {
  templateId: ScenarioStressTemplateId;
  title: string;
  summary: string;
  hypothesis: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStressRunRecord {
  id: string;
  scenarioId: ScenarioStressTemplateId;
  userId: string;
  status: "completed" | "degraded" | "failed";
  runMode: "manual";
  asOf: string;
  totalNames: number;
  impactedNames: number;
  criticalNames: number;
  summary: string;
  createdAt: string;
  completedAt: string;
}

export interface ScenarioStressImpactRecord {
  id: string;
  scenarioRunId: string;
  userId: string;
  ticker: string;
  impactLevel: ScenarioStressImpactLevel;
  thesisBreakLikelihood: ScenarioStressThesisBreakLikelihood;
  stressScore: number;
  rationale: string;
  evidenceRefs: string[];
  createdAt: string;
}

export interface ScenarioStressRuleSuggestionRecord {
  id: string;
  scenarioRunId: string;
  userId: string;
  ticker: string;
  signalType: KillSwitchSignalType;
  direction: KillSwitchDirection;
  conditionText: string;
  rationale: string;
  confidence: number;
  createdAt: string;
}

// ---- Earnings state and war room ----
export type EarningsEventTimingState = "estimated" | "confirmed" | "actual";
export type EarningsEventSourceState = "official" | "first_party" | "derived" | "mixed" | "conflicting";
export type EarningsEventEvidenceState =
  | "calendar_only"
  | "release_artifact"
  | "release_with_followup"
  | "release_with_transcript";
export type CalendarEventTime = "before_market" | "after_market" | "during_market";
export type CallArtifactType =
  | "earnings_release"
  | "presentation"
  | "webcast"
  | "transcript"
  | "supplemental_material"
  | "sec_exhibit";

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
  completeness_state: string;
  rights: Record<string, unknown>;
  content_hash?: string;
  metadata: Record<string, unknown>;
}

export interface CalendarEventRecord {
  id: string;
  ticker: string;
  eventType: string;
  eventDate: string;
  eventTime?: CalendarEventTime;
  provider: string;
  retrievedAt: string;
  timingState: EarningsEventTimingState;
  sourceState: EarningsEventSourceState;
  sourceRef: Record<string, unknown>;
  reasonText: string;
}

export interface EarningsEventTimingCandidate {
  event_id: string;
  event_date: string;
  event_time?: CalendarEventTime;
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
  event_time?: CalendarEventTime;
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

export interface WarRoomSourceRef {
  kind: string;
  ref_id: string;
  label?: string;
  url?: string;
  captured_at?: string;
}

export type WarRoomCycleStatus = "success" | "failure" | "timeout";

// The old server's legacy war room view (server.ts WarRoomRecord), built from the war_rooms row.
export interface WarRoomRecord {
  warRoomId: string;
  userId: string;
  ticker: string;
  earningsEventId: string;
  eventDate: string;
  state: "pre" | "live" | "post" | "closed";
  currentCadenceMin: number;
  lastCycleStatus?: WarRoomCycleStatus;
  lastLagMin?: number;
  lastRuntimeMin?: number;
  lastCycleAt?: string;
  preparedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarRoomTimelineEventRecord {
  id: string;
  warRoomId: string;
  phase: string;
  eventType: string;
  reasonText: string;
  sourceRefs: WarRoomSourceRef[];
  alertLedgerId?: string;
  reportId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
