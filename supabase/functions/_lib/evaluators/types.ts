// Contract and record types the evaluators need.
// Copied from packages/contracts/src and apps/product-api/src/types.ts (only the fields we use).

export type SubscriptionTier = "FREE" | "PRO";

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

export type AlertLedgerCategory = "thesis_drift" | "earnings" | "macro" | "system";
export type AlertRouteTarget = "today" | "names" | "research" | "inbox" | "you";

// ---- Evidence, canonical events, first-party context ----

export const evidenceRightsClasses = [
  "official_public",
  "first_party_public",
  "licensed",
  "user_provided",
  "unknown",
  "prohibited",
] as const;
export const evidenceDisplayModes = [
  "full_text_allowed",
  "excerpt_only",
  "headline_only",
  "link_only",
  "internal_only_not_user_visible",
] as const;
export const evidenceSourceRanks = [
  "official",
  "first_party",
  "allowlisted_context",
  "third_party",
  "unknown",
] as const;

export interface EvidenceRightsMetadata {
  rights_class: (typeof evidenceRightsClasses)[number];
  display_mode: (typeof evidenceDisplayModes)[number];
  source_rank: (typeof evidenceSourceRanks)[number];
  source_type: string;
  can_store_full_text: boolean;
  can_display_excerpt: boolean;
  can_display_link: boolean;
  policy_reason: string;
  reviewed_at: string;
  review_expires_at?: string;
}

export interface CanonicalEvent {
  id: string;
  family: "filing_posted" | "macro_release_published";
  subject_type: "ticker" | "macro_series";
  subject_id: string;
  title: string;
  occurred_at: string;
  source_state: "official" | "partial" | "missing";
  source: Record<string, unknown>;
  retrieved_at: string;
  missing_fields: unknown[];
  metadata: Record<string, unknown>;
}

export const firstPartyPageTypes = [
  "investor_relations",
  "earnings_release",
  "press_release",
  "presentation",
  "webcast",
  "sec_filing_reference",
  "supplemental_material",
  "newsroom",
] as const;
export const firstPartyFetchStates = [
  "fetched",
  "rejected_unapproved_domain",
  "rejected_undefined_rights",
  "source_unavailable",
  "parser_unsupported",
  "skipped_outside_policy",
] as const;

export interface FirstPartyContextItem {
  context_id: string;
  ticker: string;
  event_id?: string;
  registry_entry_id: string;
  source_url: string;
  source_domain: string;
  page_type: (typeof firstPartyPageTypes)[number];
  title: string;
  summary: string;
  excerpt?: string;
  retrieved_at: string;
  published_at?: string;
  content_hash: string;
  fetch_state: (typeof firstPartyFetchStates)[number];
  rights: EvidenceRightsMetadata;
  artifact_ids: string[];
  metadata: Record<string, unknown>;
}

export const callArtifactTypes = [
  "earnings_release",
  "presentation",
  "webcast",
  "transcript",
  "supplemental_material",
  "sec_exhibit",
] as const;
export const callArtifactCompletenessStates = [
  "complete",
  "partial",
  "metadata_only",
  "unavailable",
  "blocked_by_rights",
] as const;

export interface CallArtifact {
  artifact_id: string;
  ticker: string;
  event_id?: string;
  context_id?: string;
  artifact_type: (typeof callArtifactTypes)[number];
  title: string;
  source_url: string;
  source_domain: string;
  published_at?: string;
  retrieved_at: string;
  completeness_state: (typeof callArtifactCompletenessStates)[number];
  rights: EvidenceRightsMetadata;
  content_hash?: string;
  metadata: Record<string, unknown>;
}

// ---- Calendar and earnings state ----

export type EarningsEventTimingState = "estimated" | "confirmed" | "actual";
export type EarningsEventSourceState = "official" | "first_party" | "derived" | "mixed" | "conflicting";
export type EarningsEventEvidenceState =
  | "calendar_only"
  | "release_artifact"
  | "release_with_followup"
  | "release_with_transcript";
export type CalendarEventTime = "before_market" | "after_market" | "during_market";

export interface CalendarEventRecord {
  id: string;
  ticker: string;
  eventType: "earnings" | "dividend" | "split";
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
  artifact_type: CallArtifact["artifact_type"];
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

// ---- Alerts and push ----

export interface PushTarget {
  userId: string;
  installationId: string;
  deviceToken: string;
}

// One user who should get an alert. targets may be empty (no device): the inbox row is still written.
export interface AudienceMember {
  userId: string;
  targets: PushTarget[];
}

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
  feedbackState?: "useful" | "not_useful";
  mutedAt?: string;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---- Kill switch, contrarian, monitor ----

export type SignalValue = "positive" | "neutral" | "negative";
export type KillSwitchSignalType =
  | "price_move_pct"
  | "thesis_state"
  | "earnings_event"
  | "sec_filing"
  | "guidance_revision"
  | "management_change"
  | "macro_regime"
  | "analyst_rerating"
  | "news_sentiment"
  | "custom";
export type KillSwitchSignalSource = "daily" | "event";
export type KillSwitchOutcome = "matched" | "not_matched" | "skipped" | "error";

export interface KillSwitchRuleRecord {
  id: string;
  userId: string;
  ticker: string;
  reportId?: string;
  signalValue?: SignalValue;
  anchorPrice?: number;
  conditionId: string;
  conditionText: string;
  signalType: KillSwitchSignalType;
  rationale: string;
  thresholdValue?: number;
  thresholdUnit?: string;
  direction?: "against_signal" | "above" | "below" | "any";
  state: "active" | "inactive";
  createdAt: string;
}

export interface KillSwitchEvaluationRecord {
  id: string;
  ruleId: string;
  userId: string;
  ticker: string;
  signalSource: KillSwitchSignalSource;
  triggerKey: string;
  outcome: KillSwitchOutcome;
  reasonCode: string;
  reasonText: string;
  observedValue?: number;
  alertId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContrarianAnchorRecord {
  id: string;
  userId: string;
  ticker: string;
  reportId?: string;
  signalValue: SignalValue;
  anchorPrice: number;
  anchoredAt: string;
  expiresAt: string;
  isActive: boolean;
}

export type ThesisMonitorState = "intact" | "improved" | "weakened" | "unresolved";
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

// ---- Name relationships ----

export const nameRelationshipTypes = ["supplier", "competitor", "partner", "sector"] as const;
export type NameRelationshipType = (typeof nameRelationshipTypes)[number];

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

export interface NameRelationshipRecord {
  relationshipId: string;
  userId: string;
  sourceTicker: string;
  targetTicker: string;
  relationshipType: NameRelationshipType;
  confidence: number;
  state: "active" | "suppressed" | "inactive";
  sourceReportId: string;
  promptVersion: string;
  evidenceText: string;
  rationale: string;
  createdAt: string;
  updatedAt: string;
  suppressedAt?: string;
}

// ---- War rooms ----

export type WarRoomDbState = "preparing" | "ready" | "live" | "post" | "closed" | "degraded" | "failed";
export type WarRoomCycleStatus = "success" | "failure" | "timeout";
export type WarRoomPhase = "pre" | "live" | "post";

export interface WarRoomCadenceState {
  current_cadence_min: 15 | 30;
  default_cadence_min: 15 | 30;
  fallback_cadence_min: 15 | 30;
  consecutive_failures: number;
  consecutive_lag_breaches: number;
  consecutive_runtime_breaches: number;
  consecutive_healthy_cycles: number;
  latest_cycle_status?: WarRoomCycleStatus;
  latest_source_freshness_lag_min?: number;
  latest_runtime_min?: number;
  updated_at: string;
}

// The row as stored (EarningsWarRoomRecord in the old code).
export interface WarRoomRow {
  id: string;
  userId: string;
  ticker: string;
  earningsEventId: string;
  eventDate: string;
  state: WarRoomDbState;
  currentCadenceMin: 15 | 30;
  cadenceState: WarRoomCadenceState;
  preparedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarRoomSourceRef {
  kind: string;
  ref_id: string;
  label?: string;
  captured_at?: string;
}

export interface WarRoomTimelineEventRecord {
  id: string;
  warRoomId: string;
  phase: WarRoomPhase;
  eventType:
    | "prepared"
    | "playbook_updated"
    | "live_cycle_completed"
    | "cadence_changed"
    | "alert_emitted"
    | "deep_dive_queued"
    | "post_event_closed"
    | "failed";
  reasonText: string;
  sourceRefs: WarRoomSourceRef[];
  alertLedgerId?: string;
  reportId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
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

export interface ConvictionEvidenceRef {
  kind: string;
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
  signal_value?: string;
  signal_reasons?: string[];
  confidence_score?: number;
  confidence_label?: string;
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

// ---- Reports (read only; M2 owns them) ----

export interface ReportMeta {
  id: string;
  jobId: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  createdAt: string;
}

// The parts of AnalysisReport the evaluators read.
export interface AnalysisReportLike {
  report_id: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  generated_at: string;
  schema_version?: string;
  issuer?: { name?: string };
  sections: Array<{
    section_id?: string;
    title: string;
    body?: string;
    evidence?: Array<{ evidence_id?: string; source_name?: string; retrieved_at?: string }>;
  }>;
  signal?: {
    value?: string;
    reasons?: string[];
    evidence?: Array<{ evidence_id?: string; source_name?: string; retrieved_at?: string }>;
  };
  confidence?: { score?: number; label?: string };
  trust_metadata?: {
    freshness_state?: string;
    contradiction_state?: string;
    contradictions?: unknown[];
    thesis_drift?: { status?: string; summary?: string };
  };
}

export interface MarketPulseLike {
  report_id: string;
  sections: unknown;
  macro_news?: { state?: string };
}

// ---- Research state (contract shapes) ----

export interface UserResearchEvidenceRef {
  kind: string;
  ref_id: string;
  label?: string;
  ticker?: string;
  captured_at?: string;
}

export interface UserResearchHolding {
  ticker: string;
  quantity?: number;
  cost_basis?: number;
  label?: string;
  notes?: string;
  updated_at: string;
}

export interface UserResearchOmission {
  family: string;
  code: string;
  reason: string;
  ticker?: string;
}

export interface UserResearchDailyDelta {
  state: string;
  title: string;
  body: string;
  evidence_refs: UserResearchEvidenceRef[];
}

export interface UserResearchNameState {
  ticker: string;
  company_name?: string;
  in_watchlist: boolean;
  holding?: UserResearchHolding;
  monitor_state?: ThesisMonitorState;
  freshness_state?: ThesisFreshnessState;
  latest_report_id?: string;
  latest_report_generated_at?: string;
  latest_pulse_id?: string;
  daily_delta: UserResearchDailyDelta;
  summary: string;
  what_changed: string;
  why_it_matters: string;
  what_to_watch: string;
  evidence_refs: UserResearchEvidenceRef[];
  omissions: UserResearchOmission[];
}

export interface UserResearchState {
  state_id: string;
  user_id: string;
  as_of: string;
  generated_at: string;
  prior_state_id?: string;
  watchlist_tickers: string[];
  holdings: UserResearchHolding[];
  names: UserResearchNameState[];
  omissions: UserResearchOmission[];
  evidence_refs: UserResearchEvidenceRef[];
}

export interface UserResearchHoldingRecord {
  userId: string;
  ticker: string;
  quantity?: number;
  costBasis?: number;
  label?: string;
  notes?: string;
  updatedAt: string;
}

export interface UserResearchStateRecord {
  stateId: string;
  userId: string;
  asOf: string;
  generatedAt: string;
  state: UserResearchState;
}

// ---- Feedback queue ----

export const feedbackTriageStatuses = ["new", "reviewed", "routed", "resolved", "dismissed"] as const;
export type FeedbackTriageStatus = (typeof feedbackTriageStatuses)[number];

export interface UserFeedbackQueueRecord {
  id: string;
  userId: string;
  feedbackType: "report" | "subscription";
  code: string;
  severity: string;
  sourceSurface: string;
  userTier: SubscriptionTier;
  reportId?: string;
  ticker?: string;
  message: string;
  metadata: Record<string, unknown>;
  triageStatus: FeedbackTriageStatus;
  routeStatus: string;
  triageOwner?: string;
  triagedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Prices ----

export interface MarketPriceRow {
  ticker: string;
  marketDate: string;
  close: number;
  provider: string;
  retrievedAt: string;
}

// ---- News ----

// official_public: a public body's own release. headline_link_only: a publisher's headline, at most 120
// characters, shown with the source name and a link and nothing more.
export type NewsRights = "official_public" | "headline_link_only";

export interface NewsItemRow {
  // sha256 of the link (lower-case hex), set by the job.
  articleId: string;
  sourceKey: string;
  sourceName: string;
  url: string;
  title: string;
  publishedAt: string;
  rights: NewsRights;
  tickers: string[];
  // When this fetch saw the item.
  seenAt: string;
}

// How one source did in one fetch.
export interface NewsSourceCheck {
  sourceKey: string;
  checkedAt: string;
  ok: boolean;
  errorCode?: string;
  articleCount: number;
  newestItemAt?: string;
}

export interface NewsSourceStatusRecord {
  sourceKey: string;
  lastCheckedAt: string;
  lastOkAt?: string;
  lastErrorCode?: string;
  lastArticleCount: number;
  newestItemAt?: string;
  consecutiveFailures: number;
}
