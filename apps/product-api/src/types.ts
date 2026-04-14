import type {
  AlertFeedbackState,
  AlertLedgerCategory,
  AlertRouteTarget,
  AnalysisReport,
  AnalysisRequest,
  CalendarEventTime,
  CalendarEventType,
  ContrarianSignalValue,
  ConvictionEvidenceRef,
  ConvictionInsightFinding,
  ConvictionInsightStatus,
  ConvictionInsightType,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  EarningsWarRoomCadenceState,
  EarningsWarRoomCadenceMinute,
  EarningsWarRoomPhase,
  EarningsWarRoomSourceRef,
  EarningsWarRoomState,
  EarningsWarRoomTimelineEventType,
  KillSwitchConditionDraft,
  KillSwitchDirection,
  KillSwitchEvaluationOutcome,
  KillSwitchEvaluationSignalSource,
  KillSwitchSignalType,
  KillSwitchRuleSource,
  KillSwitchRuleState,
  FeedbackRouteStatus,
  FeedbackSeverity,
  FeedbackTriageStatus,
  MarketPulseReport,
  NameRelationshipState,
  NameRelationshipType,
  NotificationType,
  ReportFeedbackCode,
  ScenarioStressImpactLevel,
  ScenarioStressRunMode,
  ScenarioStressRunStatus,
  ScenarioStressTemplateId,
  ScenarioStressThesisBreakLikelihood,
  SubscriptionFeedbackCode,
  SubscriptionTier
} from "../../../packages/contracts/src";
import type {
  ThesisMonitorState,
  ThesisFreshnessState,
  TickerExchange,
  TickerListingStatus,
  TickerSearchResult
} from "../../../packages/contracts/src";

export type JobType = "deep_dive" | "market_pulse";
export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  verifiedAt?: string;
  deviceToken?: string;
  failedLoginAttempts: number;
  failedLoginWindowStartedAt?: string;
  lockedUntil?: string;
}

export interface GoogleIdentityRecord {
  userId: string;
  googleSubject: string;
  email: string;
  linkedAt: string;
  updatedAt: string;
}

export interface UserDeviceRecord {
  id: string;
  userId: string;
  installationId: string;
  deviceToken: string;
  platform: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}

export interface UserSubscriptionRecord {
  userId: string;
  tier: SubscriptionTier;
  revenuecatAppUserId?: string;
  billingPeriodEnd?: string;
  updatedAt: string;
}

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  familyId: string;
  parentSessionId?: string;
  replacedBySessionId?: string;
  revokedReason?: string;
}

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  userId?: string;
  ticker?: string;
  reportId?: string;
  cycleStart?: string;
  cycleEnd?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ReportRecord {
  id: string;
  jobId: string;
  type: JobType;
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  fingerprint?: string;
  freshnessExpiresAt?: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface AuditEventRecord {
  id: string;
  userId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TickerRegistryRecord {
  symbol: string;
  companyName: string;
  exchange: TickerExchange;
  listingStatus: TickerListingStatus;
  isSupported: boolean;
  sourceFeed: string;
  sourceUpdatedAt: string;
  lastSyncedAt: string;
  rawPayload: Record<string, unknown>;
}

export interface TickerRegistryUpsertInput {
  symbol: string;
  companyName: string;
  exchange: TickerExchange;
  listingStatus: TickerListingStatus;
  isSupported: boolean;
  sourceFeed: string;
  sourceUpdatedAt: string;
  lastSyncedAt: string;
  rawPayload?: Record<string, unknown>;
}

export interface TickerDeltaChange {
  type: "add" | "delete" | "name_change" | "symbol_change";
  symbol: string;
  companyName?: string;
  newSymbol?: string;
  newCompanyName?: string;
  exchange?: TickerExchange;
  sourceFeed: string;
  sourceUpdatedAt: string;
  rawPayload?: Record<string, unknown>;
}

export type { TickerSearchResult };

export interface CalendarEventRecord {
  id: string;
  ticker: string;
  eventType: CalendarEventType;
  eventDate: string;
  eventTime?: CalendarEventTime;
  provider: string;
  retrievedAt: string;
}

export interface ContrarianAlertAnchorRecord {
  id: string;
  userId: string;
  ticker: string;
  reportId?: string;
  signalValue: ContrarianSignalValue;
  anchorPrice: number;
  anchoredAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface NotificationPreferenceRecord {
  userId: string;
  type: NotificationType;
  enabled: boolean;
  quietUntil?: string;
  updatedAt: string;
}

export interface KillSwitchRuleRecord {
  id: string;
  userId: string;
  ticker: string;
  reportId?: string;
  signalValue?: ContrarianSignalValue;
  anchorPrice?: number;
  conditionId: string;
  conditionText: string;
  signalType: KillSwitchConditionDraft["signal_type"];
  rationale: string;
  thresholdValue?: number;
  thresholdUnit?: KillSwitchConditionDraft["threshold_unit"];
  direction?: KillSwitchConditionDraft["direction"];
  promptVersion: string;
  state: KillSwitchRuleState;
  source: KillSwitchRuleSource;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
}

export interface KillSwitchEvaluationRecord {
  id: string;
  ruleId: string;
  userId: string;
  ticker: string;
  signalSource: KillSwitchEvaluationSignalSource;
  triggerKey: string;
  outcome: KillSwitchEvaluationOutcome;
  reasonCode: string;
  reasonText: string;
  observedValue?: number;
  alertId?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface ReportNoteRecord {
  reportId: string;
  userId: string;
  content: string;
  updatedAt: string;
}

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

export interface AlertLedgerRecord {
  id: string;
  userId: string;
  notificationType: NotificationType;
  category: AlertLedgerCategory;
  route: AlertRouteTarget;
  title: string;
  body: string;
  reasonCode: string;
  reasonText: string;
  deliveryState: "sent" | "partial_failure";
  feedbackState?: AlertFeedbackState;
  mutedAt?: string;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface ConvictionInsightCardRecord {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  insightType: ConvictionInsightType;
  status: ConvictionInsightStatus;
  title: string;
  summary: string;
  findings: ConvictionInsightFinding[];
  sourceJournalEntryIds: string[];
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OppositeCaseReportRecord {
  id: string;
  userId: string;
  sourceReportId: string;
  ticker: string;
  promptVersion: string;
  thesisSummary: string;
  oppositeCaseSummary: string;
  keyPoints: Array<{
    title: string;
    summary: string;
    evidence_refs: ConvictionEvidenceRef[];
  }>;
  sharedEvidenceRefs: ConvictionEvidenceRef[];
  decisiveFactors: string[];
  generatedAt: string;
  createdAt: string;
}

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
  status: ScenarioStressRunStatus;
  runMode: ScenarioStressRunMode;
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

export interface EarningsWarRoomRecord {
  id: string;
  userId: string;
  ticker: string;
  earningsEventId: string;
  eventDate: string;
  state: EarningsWarRoomState;
  currentCadenceMin: EarningsWarRoomCadenceMinute;
  cadenceState: EarningsWarRoomCadenceState;
  preparedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EarningsWarRoomTimelineEventRecord {
  id: string;
  warRoomId: string;
  phase: EarningsWarRoomPhase;
  eventType: EarningsWarRoomTimelineEventType;
  reasonText: string;
  sourceRefs: EarningsWarRoomSourceRef[];
  alertLedgerId?: string;
  reportId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InternalClaimResponse {
  job: JobRecord;
  analysisRequest: AnalysisRequest;
}

export interface InternalCompleteRequest {
  report: AnalysisReport;
}

export interface InternalPulseCompleteRequest {
  report: MarketPulseReport;
}
