import type {
  AnalysisReport,
  AnalysisRequest,
  CalendarEventTime,
  CalendarEventType,
  ContrarianSignalValue,
  FeedbackRouteStatus,
  FeedbackSeverity,
  FeedbackTriageStatus,
  MarketPulseReport,
  NotificationType,
  ReportFeedbackCode,
  SubscriptionFeedbackCode,
  SubscriptionTier
} from "../../../packages/contracts/src";
import type {
  ThesisMonitorState,
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
  updatedAt: string;
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
