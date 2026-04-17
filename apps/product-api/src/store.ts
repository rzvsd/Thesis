import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { notificationTypes } from "../../../packages/contracts/src";
import type {
  AlertFeedbackState,
  AlertLedgerCategory,
  AlertRouteTarget,
  CallArtifact,
  CanonicalEvent,
  CalendarEventTime,
  CalendarEventType,
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  ContrarianSignalValue,
  ConvictionEvidenceRef,
  ConvictionInsightFinding,
  ConvictionInsightType,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  EarningsWarRoomCadenceMinute,
  EarningsWarRoomCadenceState,
  EarningsWarRoomCycleStatus,
  EarningsWarRoomPhase,
  EarningsWarRoomSourceRef,
  EarningsWarRoomState,
  EarningsWarRoomTimelineEventType,
  KillSwitchDirection,
  KillSwitchEvaluationOutcome,
  KillSwitchEvaluationSignalSource,
  KillSwitchSignalType,
  KillSwitchRuleSource,
  KillSwitchRuleState,
  FeedbackSeverity,
  FeedbackTriageStatus,
  FeedbackRouteStatus,
  FearGreedSnapshot,
  FirstPartyContextItem,
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
  SubscriptionTier,
  TickerCoverage
} from "../../../packages/contracts/src";

import type {
  AuditEventRecord,
  AlertLedgerRecord,
  CalendarEventRecord,
  CallArtifactRecord,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  ContrarianAlertAnchorRecord,
  EarningsWarRoomRecord,
  EarningsWarRoomTimelineEventRecord,
  GoogleIdentityRecord,
  KillSwitchEvaluationRecord,
  KillSwitchRuleRecord,
  JobRecord,
  NameRelationshipRecord,
  FirstPartyContextRecord,
  NotificationPreferenceRecord,
  OppositeCaseReportRecord,
  ScenarioStressImpactRecord,
  ScenarioStressRuleSuggestionRecord,
  ScenarioStressRunRecord,
  ScenarioStressTemplateRecord,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  ReportNoteRecord,
  ReportRecord,
  SessionRecord,
  TickerDeltaChange,
  TickerRegistryRecord,
  TickerRegistryUpsertInput,
  TickerSearchResult,
  UserDeviceRecord,
  UserRecord,
  UserSubscriptionRecord,
  VerificationTokenRecord
} from "./types";

export type GoogleIdentityAttachResult =
  | "linked"
  | "already_linked_to_user"
  | "subject_in_use"
  | "user_already_linked";

export interface ProductStore {
  createUser(input: { email: string; passwordHash: string }): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  findUserByGoogleSubject(googleSubject: string): Promise<UserRecord | undefined>;
  getGoogleIdentityByUserId(userId: string): Promise<GoogleIdentityRecord | undefined>;
  attachGoogleIdentity(input: {
    userId: string;
    googleSubject: string;
    email: string;
    linkedAt: string;
  }): Promise<GoogleIdentityAttachResult>;
  markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined>;
  updateUserPasswordHash(userId: string, passwordHash: string): Promise<UserRecord | undefined>;
  recordFailedLoginAttempt(input: {
    userId: string;
    attemptedAt: string;
    windowSeconds: number;
    maxFailures: number;
    lockoutDurationSeconds: number;
  }): Promise<UserRecord | undefined>;
  clearFailedLoginAttempts(userId: string): Promise<UserRecord | undefined>;
  updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined>;
  upsertUserDevice(input: {
    userId: string;
    installationId: string;
    deviceToken: string;
    platform: string;
    updatedAt: string;
  }): Promise<UserDeviceRecord | undefined>;
  invalidateUserDeviceByInstallation(input: {
    userId: string;
    installationId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<boolean>;
  invalidateUserDevicesByUser(input: {
    userId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number>;
  invalidateUserDeviceByToken(input: {
    deviceToken: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number>;
  listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>>;
  getUserSubscription(userId: string): Promise<UserSubscriptionRecord>;
  findUserIdByRevenuecatAppUserId(revenuecatAppUserId: string): Promise<string | undefined>;
  upsertUserSubscription(input: {
    userId: string;
    tier: SubscriptionTier;
    revenuecatAppUserId?: string;
    billingPeriodEnd?: string;
    updatedAt: string;
  }): Promise<UserSubscriptionRecord>;
  getDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number>;
  reserveDailyDeepDiveUsage(
    userId: string,
    usageDate: string,
    limit: number
  ): Promise<{ allowed: boolean; requestCount: number }>;
  releaseDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number>;
  incrementDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number>;
  createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord>;
  consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined>;
  createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
    familyId?: string;
    parentSessionId?: string;
  }): Promise<SessionRecord>;
  getSessionById(id: string): Promise<SessionRecord | undefined>;
  revokeSession(
    sessionId: string,
    revokedAt: string,
    options?: {
      reason?: string;
      replacedBySessionId?: string;
    }
  ): Promise<SessionRecord | undefined>;
  revokeSessionFamily(input: {
    familyId: string;
    revokedAt: string;
    reason: string;
  }): Promise<number>;
  createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord>;
  findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined>;
  getJob(id: string): Promise<JobRecord | undefined>;
  listRecoverableQueuedDeepDiveJobs(
    createdBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]>;
  listTimedOutRunningDeepDiveJobs(
    startedBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]>;
  markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined>;
  markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined>;
  markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined>;
  createReport(input: ReportRecord): Promise<ReportRecord>;
  findReusableDeepDiveReport(input: {
    ticker: string;
    fingerprint: string;
    nowIso: string;
  }): Promise<ReportRecord | undefined>;
  findLatestComparableDeepDiveReport(input: {
    ticker: string;
    schemaMajor: number;
    sinceIso: string;
  }): Promise<ReportRecord | undefined>;
  getReportById(id: string): Promise<ReportRecord | undefined>;
  hasReportAccessForUser(userId: string, reportId: string): Promise<boolean>;
  deleteReport(id: string): Promise<boolean>;
  listReportsByUser(userId: string): Promise<ReportRecord[]>;
  getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined>;
  getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined>;
  listHistoricalFinancialSnapshotsByTicker(ticker: string): Promise<CanonicalFinancialSnapshot[]>;
  listHistoricalTranscriptsByTicker(ticker: string): Promise<CanonicalTranscript[]>;
  getTickerCoverageByTicker(ticker: string): Promise<TickerCoverage | undefined>;
  listTickerCoverageTickers(limit: number): Promise<string[]>;
  upsertFearGreedSnapshot(input: {
    snapshot: FearGreedSnapshot;
  }): Promise<{ snapshot: FearGreedSnapshot; created: boolean }>;
  getFearGreedSnapshotByMarketDate(marketDate: string): Promise<FearGreedSnapshot | undefined>;
  getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined>;
  listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]>;
  upsertCanonicalEvents(events: CanonicalEvent[]): Promise<{ upserted: number }>;
  listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }): Promise<CanonicalEvent[]>;
  upsertFirstPartyContextItems(items: FirstPartyContextItem[]): Promise<{ upserted: number }>;
  listFirstPartyContextItems(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<FirstPartyContextItem[]>;
  upsertCallArtifacts(artifacts: CallArtifact[]): Promise<{ upserted: number }>;
  listCallArtifacts(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<CallArtifact[]>;
  upsertCalendarEvents(events: CalendarEventRecord[]): Promise<{ upserted: number }>;
  listUpcomingCalendarEventsByTickers(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventType;
  }): Promise<CalendarEventRecord[]>;
  createContrarianAlertAnchor(input: ContrarianAlertAnchorRecord): Promise<ContrarianAlertAnchorRecord>;
  listActiveContrarianAlertAnchors(asOfIso: string): Promise<ContrarianAlertAnchorRecord[]>;
  deactivateContrarianAlertAnchor(id: string, updatedAt: string): Promise<ContrarianAlertAnchorRecord | undefined>;
  deactivateExpiredContrarianAlertAnchors(asOfIso: string): Promise<number>;
  createKillSwitchRule(input: KillSwitchRuleRecord): Promise<KillSwitchRuleRecord>;
  deactivateActiveKillSwitchRulesByUserTicker(input: {
    userId: string;
    ticker: string;
    deactivatedAt: string;
  }): Promise<number>;
  listActiveKillSwitchRules(input: {
    asOfIso: string;
    userIds?: string[];
  }): Promise<KillSwitchRuleRecord[]>;
  getKillSwitchEvaluation(input: {
    ruleId: string;
    signalSource: KillSwitchEvaluationSignalSource;
    triggerKey: string;
  }): Promise<KillSwitchEvaluationRecord | undefined>;
  listKillSwitchEvaluations(input: {
    userId: string;
    ticker?: string;
    outcomes?: KillSwitchEvaluationOutcome[];
    sinceIso?: string;
    limit?: number;
  }): Promise<KillSwitchEvaluationRecord[]>;
  createKillSwitchEvaluation(input: KillSwitchEvaluationRecord): Promise<KillSwitchEvaluationRecord>;
  upsertNameRelationship(input: NameRelationshipRecord): Promise<NameRelationshipRecord>;
  getNameRelationship(relationshipId: string): Promise<NameRelationshipRecord | undefined>;
  listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]>;
  listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }): Promise<NameRelationshipRecord[]>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord[]>;
  getReportNote(reportId: string, userId: string): Promise<ReportNoteRecord | undefined>;
  upsertReportNote(input: {
    reportId: string;
    userId: string;
    content: string;
    updatedAt: string;
  }): Promise<ReportNoteRecord>;
  enqueueUserFeedback(input: {
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
    metadata?: Record<string, unknown>;
    triageStatus: FeedbackTriageStatus;
    routeStatus: FeedbackRouteStatus;
    triageOwner?: string;
    triagedAt?: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<UserFeedbackQueueRecord>;
  listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: FeedbackTriageStatus;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }): Promise<UserFeedbackQueueRecord[]>;
  upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{
      type: NotificationType;
      enabled?: boolean;
      quietUntil?: string | null;
    }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]>;
  createAlertLedgerItem(input: AlertLedgerRecord): Promise<AlertLedgerRecord>;
  getAlertLedgerItem(input: { id: string; userId: string }): Promise<AlertLedgerRecord | undefined>;
  listAlertLedgerItemsByUser(input: {
    userId: string;
    limit: number;
    category?: AlertLedgerCategory;
  }): Promise<AlertLedgerRecord[]>;
  setAlertLedgerFeedback(input: {
    id: string;
    userId: string;
    feedback: AlertFeedbackState;
    updatedAt: string;
  }): Promise<AlertLedgerRecord | undefined>;
  markAlertLedgerMuted(input: {
    id: string;
    userId: string;
    mutedAt: string;
  }): Promise<AlertLedgerRecord | undefined>;
  upsertConvictionJournalEntry(
    input: ConvictionJournalEntryRecord
  ): Promise<ConvictionJournalEntryRecord>;
  listConvictionJournalEntriesByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
  }): Promise<ConvictionJournalEntryRecord[]>;
  upsertConvictionInsightCard(
    input: ConvictionInsightCardRecord
  ): Promise<ConvictionInsightCardRecord>;
  listConvictionInsightCardsByUser(input: {
    userId: string;
    limit: number;
  }): Promise<ConvictionInsightCardRecord[]>;
  upsertOppositeCaseReport(input: OppositeCaseReportRecord): Promise<OppositeCaseReportRecord>;
  getOppositeCaseReportBySource(input: {
    userId: string;
    sourceReportId: string;
  }): Promise<OppositeCaseReportRecord | undefined>;
  listScenarioStressTemplates(input?: {
    includeInactive?: boolean;
    limit?: number;
  }): Promise<ScenarioStressTemplateRecord[]>;
  getScenarioStressTemplate(
    templateId: ScenarioStressTemplateId
  ): Promise<ScenarioStressTemplateRecord | undefined>;
  createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord>;
  getScenarioStressRun(input: {
    id: string;
    userId: string;
  }): Promise<ScenarioStressRunRecord | undefined>;
  createScenarioStressImpacts(
    input: ScenarioStressImpactRecord[]
  ): Promise<ScenarioStressImpactRecord[]>;
  listScenarioStressImpactsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressImpactRecord[]>;
  createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[]
  ): Promise<ScenarioStressRuleSuggestionRecord[]>;
  listScenarioStressRuleSuggestionsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressRuleSuggestionRecord[]>;
  createWarRoom(input: EarningsWarRoomRecord): Promise<EarningsWarRoomRecord>;
  updateWarRoom(input: EarningsWarRoomRecord): Promise<EarningsWarRoomRecord | undefined>;
  getWarRoom(input: { id: string; userId: string }): Promise<EarningsWarRoomRecord | undefined>;
  findWarRoomByEvent(input: {
    userId: string;
    ticker: string;
    earningsEventId: string;
  }): Promise<EarningsWarRoomRecord | undefined>;
  listWarRoomsByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
    includeClosed?: boolean;
  }): Promise<EarningsWarRoomRecord[]>;
  createWarRoomTimelineEvent(
    input: EarningsWarRoomTimelineEventRecord
  ): Promise<EarningsWarRoomTimelineEventRecord>;
  getWarRoomTimelineEvent(input: {
    id: string;
    warRoomId: string;
  }): Promise<EarningsWarRoomTimelineEventRecord | undefined>;
  listWarRoomTimelineEvents(input: {
    warRoomId: string;
    limit: number;
  }): Promise<EarningsWarRoomTimelineEventRecord[]>;
  upsertThesisMonitorSnapshot(input: ThesisMonitorSnapshotRecord): Promise<ThesisMonitorSnapshotRecord>;
  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]>;
  listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; installationId: string; deviceToken: string }>>;
  listUsersWithEmailByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; email: string }>>;
  listUsersWithWatchlist(): Promise<Array<{ userId: string; tickers: string[] }>>;
  listWatchlistTickersByUser(userId: string): Promise<string[]>;
  addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]>;
  removeWatchlistTicker(userId: string, ticker: string): Promise<string[]>;
  searchTickers(query: string, limit: number): Promise<TickerSearchResult[]>;
  getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined>;
  replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }>;
  applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }>;
  appendAuditEvent(input: AuditEventRecord): Promise<void>;
  close(): Promise<void>;
}

function extractSchemaMajor(schemaVersion: string): number | undefined {
  const raw = schemaVersion.trim().split(".")[0];
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    verifiedAt: asIsoString(row.verified_at),
    deviceToken: row.device_token ? String(row.device_token) : undefined,
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    failedLoginWindowStartedAt: asIsoString(row.failed_login_window_started_at),
    lockedUntil: asIsoString(row.locked_until)
  };
}

function mapGoogleIdentity(row: Record<string, unknown>): GoogleIdentityRecord {
  return {
    userId: String(row.user_id),
    googleSubject: String(row.google_subject),
    email: String(row.email),
    linkedAt: asIsoString(row.linked_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapUserDevice(row: Record<string, unknown>): UserDeviceRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    installationId: String(row.installation_id),
    deviceToken: String(row.device_token),
    platform: String(row.platform ?? "android"),
    lastSeenAt: asIsoString(row.last_seen_at) ?? new Date().toISOString(),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString(),
    invalidatedAt: asIsoString(row.invalidated_at),
    invalidationReason: row.invalidation_reason
      ? String(row.invalidation_reason)
      : undefined
  };
}

function mapVerificationToken(row: Record<string, unknown>): VerificationTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    consumedAt: asIsoString(row.consumed_at)
  };
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  const id = String(row.id);
  return {
    id,
    userId: String(row.user_id),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    revokedAt: asIsoString(row.revoked_at),
    familyId: row.family_id ? String(row.family_id) : id,
    parentSessionId: row.parent_session_id ? String(row.parent_session_id) : undefined,
    replacedBySessionId: row.replaced_by_session_id
      ? String(row.replaced_by_session_id)
      : undefined,
    revokedReason: row.revoked_reason ? String(row.revoked_reason) : undefined
  };
}

function mapJob(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    type: String(row.type) as JobRecord["type"],
    status: String(row.status) as JobRecord["status"],
    userId: row.user_id ? String(row.user_id) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    cycleStart: asIsoString(row.cycle_start),
    cycleEnd: asIsoString(row.cycle_end),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    startedAt: asIsoString(row.started_at),
    completedAt: asIsoString(row.completed_at),
    errorMessage: row.error_message ? String(row.error_message) : undefined
  };
}

function mapReport(row: Record<string, unknown>): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportRecord["type"],
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    freshnessExpiresAt: asIsoString(row.freshness_expires_at),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    isCurrent: Boolean(row.is_current)
  };
}

function mapSubscription(row: Record<string, unknown>): UserSubscriptionRecord {
  return {
    userId: String(row.user_id),
    tier: String(row.tier) as SubscriptionTier,
    revenuecatAppUserId: row.revenuecat_app_user_id
      ? String(row.revenuecat_app_user_id)
      : undefined,
    billingPeriodEnd: asIsoString(row.billing_period_end),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapTicker(row: Record<string, unknown>): TickerRegistryRecord {
  return {
    symbol: String(row.symbol),
    companyName: String(row.company_name),
    exchange: String(row.exchange) as TickerRegistryRecord["exchange"],
    listingStatus: String(row.listing_status) as TickerRegistryRecord["listingStatus"],
    isSupported: Boolean(row.is_supported),
    sourceFeed: String(row.source_feed),
    sourceUpdatedAt: asIsoString(row.source_updated_at) ?? new Date().toISOString(),
    lastSyncedAt: asIsoString(row.last_synced_at) ?? new Date().toISOString(),
    rawPayload: (row.raw_payload as Record<string, unknown> | undefined) ?? {}
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
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

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asJsonArray(value: unknown): unknown[] {
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

function asWarRoomSourceRefs(value: unknown): EarningsWarRoomSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const refs: EarningsWarRoomSourceRef[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (!record?.kind || !record.ref_id) {
      continue;
    }
    const ref: EarningsWarRoomSourceRef = {
      kind: String(record.kind),
      ref_id: String(record.ref_id)
    };
    const label = record.label ? String(record.label) : undefined;
    if (label) {
      ref.label = label;
    }
    const url = record.url ? String(record.url) : undefined;
    if (url) {
      ref.url = url;
    }
    const capturedAt = asIsoString(record.captured_at);
    if (capturedAt) {
      ref.captured_at = capturedAt;
    }
    refs.push(ref);
  }
  return refs;
}

function cloneWarRoomSourceRefs(
  refs: EarningsWarRoomSourceRef[]
): EarningsWarRoomSourceRef[] {
  return refs.map((ref) => ({ ...ref }));
}

function asConvictionEvidenceRefs(value: unknown): ConvictionEvidenceRef[] {
  const refs: ConvictionEvidenceRef[] = [];
  for (const entry of asJsonArray(value)) {
    const record = asRecord(entry);
    if (!record?.kind || !record.ref_id) {
      continue;
    }
    const ref: ConvictionEvidenceRef = {
      kind: String(record.kind) as ConvictionEvidenceRef["kind"],
      ref_id: String(record.ref_id)
    };
    if (record.label) {
      ref.label = String(record.label);
    }
    if (record.ticker) {
      ref.ticker = String(record.ticker);
    }
    const capturedAt = asIsoString(record.captured_at);
    if (capturedAt) {
      ref.captured_at = capturedAt;
    }
    refs.push(ref);
  }
  return refs;
}

function cloneConvictionEvidenceRefs(refs: ConvictionEvidenceRef[]): ConvictionEvidenceRef[] {
  return refs.map((ref) => ({ ...ref }));
}

function cloneConvictionThesisSnapshot(
  snapshot: ConvictionThesisSnapshot
): ConvictionThesisSnapshot {
  return {
    ...snapshot,
    signal_reasons: snapshot.signal_reasons ? [...snapshot.signal_reasons] : undefined
  };
}

function asConvictionInsightFindings(value: unknown): ConvictionInsightFinding[] {
  const findings: ConvictionInsightFinding[] = [];
  for (const entry of asJsonArray(value)) {
    const record = asRecord(entry);
    if (!record?.finding_type || !record.title || !record.summary) {
      continue;
    }
    findings.push({
      finding_type: String(record.finding_type) as ConvictionInsightFinding["finding_type"],
      title: String(record.title),
      summary: String(record.summary),
      tickers: asStringArray(record.tickers),
      evidence_refs: asConvictionEvidenceRefs(record.evidence_refs),
      confidence: Number(record.confidence ?? 0)
    });
  }
  return findings;
}

function cloneConvictionInsightFindings(
  findings: ConvictionInsightFinding[]
): ConvictionInsightFinding[] {
  return findings.map((finding) => ({
    ...finding,
    tickers: [...finding.tickers],
    evidence_refs: cloneConvictionEvidenceRefs(finding.evidence_refs)
  }));
}

function asOppositeCaseKeyPoints(value: unknown): OppositeCaseReportRecord["keyPoints"] {
  return asJsonArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record?.title || !record.summary) {
        return undefined;
      }
      return {
        title: String(record.title),
        summary: String(record.summary),
        evidence_refs: asConvictionEvidenceRefs(record.evidence_refs)
      };
    })
    .filter((entry): entry is OppositeCaseReportRecord["keyPoints"][number] => Boolean(entry));
}

function cloneOppositeCaseKeyPoints(
  keyPoints: OppositeCaseReportRecord["keyPoints"]
): OppositeCaseReportRecord["keyPoints"] {
  return keyPoints.map((point) => ({
    ...point,
    evidence_refs: cloneConvictionEvidenceRefs(point.evidence_refs)
  }));
}

function normalizeWarRoomCadenceState(
  value: unknown,
  currentCadenceMin: EarningsWarRoomCadenceMinute,
  fallbackUpdatedAt: string
): EarningsWarRoomCadenceState {
  const record = asRecord(value) ?? {};
  const latestLag =
    record.latest_source_freshness_lag_min == null
      ? undefined
      : Number(record.latest_source_freshness_lag_min);
  const latestRuntime =
    record.latest_runtime_min == null ? undefined : Number(record.latest_runtime_min);
  const current =
    Number(record.current_cadence_min) === 30 ? 30 : currentCadenceMin;
  const defaultCadence =
    Number(record.default_cadence_min) === 30
      ? 30
      : Number(record.default_cadence_min) === 15
        ? 15
        : 15;
  const fallbackCadence =
    Number(record.fallback_cadence_min) === 15
      ? 15
      : Number(record.fallback_cadence_min) === 30
        ? 30
        : 30;
  const latestCycleStatus =
    record.latest_cycle_status === "success" ||
    record.latest_cycle_status === "timeout" ||
    record.latest_cycle_status === "failure"
      ? (record.latest_cycle_status as EarningsWarRoomCycleStatus)
      : undefined;

  return {
    current_cadence_min: current,
    default_cadence_min: defaultCadence,
    fallback_cadence_min: fallbackCadence,
    consecutive_failures: Math.max(0, Number(record.consecutive_failures ?? 0)),
    consecutive_lag_breaches: Math.max(
      0,
      Number(record.consecutive_lag_breaches ?? 0)
    ),
    consecutive_runtime_breaches: Math.max(
      0,
      Number(record.consecutive_runtime_breaches ?? 0)
    ),
    consecutive_healthy_cycles: Math.max(
      0,
      Number(record.consecutive_healthy_cycles ?? 0)
    ),
    latest_cycle_status: latestCycleStatus,
    latest_source_freshness_lag_min: Number.isFinite(latestLag) ? latestLag : undefined,
    latest_runtime_min: Number.isFinite(latestRuntime) ? latestRuntime : undefined,
    degraded_reason: record.degraded_reason
      ? String(record.degraded_reason)
      : undefined,
    next_cycle_at: asIsoString(record.next_cycle_at),
    updated_at: asIsoString(record.updated_at) ?? fallbackUpdatedAt
  };
}

function cloneWarRoomCadenceState(
  state: EarningsWarRoomCadenceState
): EarningsWarRoomCadenceState {
  return { ...state };
}

function cloneScenarioStressEvidenceRefs(refs: string[]): string[] {
  return refs.map((ref) => String(ref));
}

function defaultScenarioStressTemplates(nowIso: string): ScenarioStressTemplateRecord[] {
  return [
    {
      templateId: "rates_higher_for_longer",
      title: "Rates Stay Higher for Longer",
      summary: "Stress-tests valuation durability if discount rates remain elevated.",
      hypothesis:
        "Higher discount rates can compress valuation multiples for duration-sensitive theses.",
      displayOrder: 1,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      templateId: "recession_in_6m",
      title: "Recession in 6 Months",
      summary: "Evaluates revenue and margin fragility under demand contraction.",
      hypothesis:
        "A broad slowdown can challenge cyclical demand assumptions across followed names.",
      displayOrder: 2,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      templateId: "usd_up_10",
      title: "USD Strengthens 10%",
      summary: "Assesses translation and competitiveness pressure from a stronger dollar.",
      hypothesis:
        "Foreign revenue translation pressure can weaken globally exposed thesis assumptions.",
      displayOrder: 3,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      templateId: "ai_hype_burst",
      title: "AI Hype Cycle Bursts",
      summary: "Examines downside if AI spending and sentiment reset sharply.",
      hypothesis:
        "AI-linked narratives can break quickly when adoption or monetization disappoints.",
      displayOrder: 4,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      templateId: "oil_120_spike",
      title: "Oil Spikes to $120",
      summary: "Measures cost and demand pressure from a rapid energy shock.",
      hypothesis:
        "Energy-sensitive cost structures can invalidate margin and demand assumptions.",
      displayOrder: 5,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
}

function mapHistoricalFinancialSnapshot(row: Record<string, unknown>): CanonicalFinancialSnapshot {
  const data = asRecord(row.data) ?? {};
  const segments = Array.isArray(row.segments) ? (row.segments as CanonicalFinancialSnapshot["segments"]) : undefined;
  const analystEstimates = asRecord(row.analyst_estimates) as CanonicalFinancialSnapshot["analyst_estimates"] | undefined;
  const guidance = asRecord(row.guidance) as CanonicalFinancialSnapshot["guidance"] | undefined;
  return {
    snapshot_id: String(row.snapshot_id),
    ticker: String(row.ticker),
    period: String(row.period),
    period_type: String(row.period_type) as CanonicalFinancialSnapshot["period_type"],
    fiscal_year: Number(row.fiscal_year),
    fiscal_quarter: row.fiscal_quarter == null ? undefined : Number(row.fiscal_quarter),
    provider: String(row.provider),
    filing_date: row.filing_date == null ? undefined : String(row.filing_date),
    retrieved_at: asIsoString(row.retrieved_at) ?? new Date().toISOString(),
    data: data as CanonicalFinancialSnapshot["data"],
    segments,
    analyst_estimates: analystEstimates,
    guidance,
    missing_fields: asStringArray(row.missing_fields)
  };
}

function mapHistoricalTranscript(row: Record<string, unknown>): CanonicalTranscript {
  return {
    transcript_id: String(row.transcript_id),
    ticker: String(row.ticker),
    period: String(row.period),
    fiscal_year: Number(row.fiscal_year),
    fiscal_quarter: Number(row.fiscal_quarter),
    call_date: String(row.call_date),
    provider: String(row.provider),
    retrieved_at: asIsoString(row.retrieved_at) ?? new Date().toISOString(),
    body_text: String(row.body_text ?? ""),
    word_count: Number(row.word_count ?? 0),
    is_complete: Boolean(row.is_complete)
  };
}

function mapTickerCoverage(row: Record<string, unknown>): TickerCoverage {
  return {
    ticker: String(row.ticker),
    snapshot_count: Number(row.snapshot_count ?? 0),
    transcript_count: Number(row.transcript_count ?? 0),
    latest_period: row.latest_period == null ? null : String(row.latest_period),
    earliest_period: row.earliest_period == null ? null : String(row.earliest_period),
    has_guidance: Boolean(row.has_guidance),
    has_estimates: Boolean(row.has_estimates),
    last_synced_at: asIsoString(row.last_synced_at) ?? new Date().toISOString(),
    last_sync_status: String(row.last_sync_status) as TickerCoverage["last_sync_status"],
    backfill_tier: Number(row.backfill_tier) as TickerCoverage["backfill_tier"]
  };
}

function mapFearGreedSnapshot(row: Record<string, unknown>): FearGreedSnapshot {
  return {
    id: String(row.id),
    market_date: String(row.market_date),
    score: Number(row.score),
    label: String(row.label) as FearGreedSnapshot["label"],
    sub_scores: Array.isArray(row.sub_scores)
      ? (row.sub_scores as FearGreedSnapshot["sub_scores"])
      : [],
    missing_inputs: asStringArray(row.missing_inputs),
    calculated_at: asIsoString(row.calculated_at) ?? new Date().toISOString()
  };
}

function mapCanonicalEvent(row: Record<string, unknown>): CanonicalEvent {
  const source = asRecord(row.source) ?? {};
  const nestedSource = asRecord(source.source) ?? {};
  return {
    id: String(row.id),
    family: String(row.family) as CanonicalEvent["family"],
    subject_type: String(row.subject_type) as CanonicalEvent["subject_type"],
    subject_id: String(row.subject_id),
    title: String(row.title),
    occurred_at: asIsoString(row.occurred_at) ?? new Date().toISOString(),
    source_state: String(row.source_state) as CanonicalEvent["source_state"],
    source: {
      source: {
        source_id: String(nestedSource.source_id ?? ""),
        source_family: String(nestedSource.source_family ?? "sec_edgar") as CanonicalEvent["source"]["source"]["source_family"],
        source_name: String(nestedSource.source_name ?? ""),
        source_url: String(nestedSource.source_url ?? ""),
        agency: String(nestedSource.agency ?? ""),
        agency_series_id:
          nestedSource.agency_series_id === undefined
            ? undefined
            : String(nestedSource.agency_series_id)
      },
      retrieved_at: String(source.retrieved_at ?? row.retrieved_at ?? new Date().toISOString()),
      retrieval_status: String(source.retrieval_status ?? "fresh") as CanonicalEvent["source"]["retrieval_status"],
      source_period: source.source_period === undefined ? undefined : String(source.source_period),
      source_revision: source.source_revision === undefined ? undefined : String(source.source_revision)
    },
    retrieved_at: asIsoString(row.retrieved_at) ?? new Date().toISOString(),
    missing_fields: asJsonArray(row.missing_fields).map((item) => {
      const missing = asRecord(item) ?? {};
      return {
        field: String(missing.field ?? ""),
        reason: String(missing.reason ?? "source_unavailable") as CanonicalEvent["missing_fields"][number]["reason"],
        source_id: missing.source_id === undefined ? undefined : String(missing.source_id),
        message: String(missing.message ?? "")
      };
    }),
    metadata: asRecord(row.metadata) ?? {}
  };
}

function cloneFirstPartyContextItem(item: FirstPartyContextItem): FirstPartyContextItem {
  return {
    ...item,
    rights: { ...item.rights },
    artifact_ids: [...item.artifact_ids],
    metadata: { ...item.metadata }
  };
}

function cloneCallArtifact(item: CallArtifact): CallArtifact {
  return {
    ...item,
    rights: { ...item.rights },
    metadata: { ...item.metadata }
  };
}

function mapFirstPartyContextItem(row: Record<string, unknown>): FirstPartyContextItem {
  const payload = asRecord(row.payload) ?? row;
  return cloneFirstPartyContextItem(payload as unknown as FirstPartyContextItem);
}

function mapCallArtifact(row: Record<string, unknown>): CallArtifact {
  const payload = asRecord(row.payload) ?? row;
  return cloneCallArtifact(payload as unknown as CallArtifact);
}

const defaultNotificationTypeList = [...notificationTypes];

function isNotificationType(value: string): value is NotificationType {
  return defaultNotificationTypeList.includes(value as NotificationType);
}

function mapCalendarEvent(row: Record<string, unknown>): CalendarEventRecord {
  const eventTimeRaw = row.event_time == null ? undefined : String(row.event_time);
  const eventTime = eventTimeRaw as CalendarEventTime | undefined;
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    eventType: String(row.event_type) as CalendarEventType,
    eventDate: String(row.event_date),
    eventTime,
    provider: String(row.provider),
    retrievedAt: asIsoString(row.retrieved_at) ?? new Date().toISOString()
  };
}

function mapContrarianAnchor(row: Record<string, unknown>): ContrarianAlertAnchorRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    reportId: row.report_id ? String(row.report_id) : undefined,
    signalValue: String(row.signal_value) as ContrarianSignalValue,
    anchorPrice: Number(row.anchor_price),
    anchoredAt: asIsoString(row.anchored_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    isActive: Boolean(row.is_active)
  };
}

function mapKillSwitchRule(row: Record<string, unknown>): KillSwitchRuleRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    reportId: row.report_id ? String(row.report_id) : undefined,
    signalValue: row.signal_value
      ? (String(row.signal_value) as ContrarianSignalValue)
      : undefined,
    anchorPrice:
      row.anchor_price === null || row.anchor_price === undefined
        ? undefined
        : Number(row.anchor_price),
    conditionId: String(row.condition_id),
    conditionText: String(row.condition_text),
    signalType: String(row.signal_type) as KillSwitchRuleRecord["signalType"],
    rationale: String(row.rationale),
    thresholdValue:
      row.threshold_value === null || row.threshold_value === undefined
        ? undefined
        : Number(row.threshold_value),
    thresholdUnit: row.threshold_unit
      ? (String(row.threshold_unit) as KillSwitchRuleRecord["thresholdUnit"])
      : undefined,
    direction: row.direction
      ? (String(row.direction) as KillSwitchRuleRecord["direction"])
      : undefined,
    promptVersion: String(row.prompt_version ?? ""),
    state: String(row.state) as KillSwitchRuleState,
    source: String(row.source) as KillSwitchRuleSource,
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString(),
    deactivatedAt: asIsoString(row.deactivated_at)
  };
}

function mapKillSwitchEvaluation(row: Record<string, unknown>): KillSwitchEvaluationRecord {
  return {
    id: String(row.id),
    ruleId: String(row.rule_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    signalSource: String(row.signal_source) as KillSwitchEvaluationSignalSource,
    triggerKey: String(row.trigger_key),
    outcome: String(row.outcome) as KillSwitchEvaluationOutcome,
    reasonCode: String(row.reason_code),
    reasonText: String(row.reason_text),
    observedValue:
      row.observed_value === null || row.observed_value === undefined
        ? undefined
        : Number(row.observed_value),
    alertId: row.alert_id ? String(row.alert_id) : undefined,
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapNameRelationship(row: Record<string, unknown>): NameRelationshipRecord {
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
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString(),
    suppressedAt: asIsoString(row.suppressed_at)
  };
}

function mapNotificationPreference(row: Record<string, unknown>): NotificationPreferenceRecord {
  return {
    userId: String(row.user_id),
    type: String(row.notification_type) as NotificationType,
    enabled: Boolean(row.enabled),
    quietUntil: asIsoString(row.quiet_until),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function isQuietUntilActive(quietUntil: string | undefined, asOfIso: string): boolean {
  if (!quietUntil) {
    return false;
  }

  const quietUntilMillis = Date.parse(quietUntil);
  const asOfMillis = Date.parse(asOfIso);
  if (!Number.isFinite(quietUntilMillis) || !Number.isFinite(asOfMillis)) {
    return false;
  }

  return quietUntilMillis > asOfMillis;
}

function mapThesisMonitorSnapshot(row: Record<string, unknown>): ThesisMonitorSnapshotRecord {
  const materialEventsCount = Number(row.material_events_count ?? 0);
  const unreviewedEventsCount = Number(row.unreviewed_events_count ?? 0);
  const freshnessScore = Number(row.freshness_score ?? 0);
  return {
    userId: String(row.user_id),
    ticker: String(row.ticker),
    state: String(row.state) as ThesisMonitorSnapshotRecord["state"],
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
    freshnessState: (String(row.freshness_state ?? "stale") as ThesisMonitorSnapshotRecord["freshnessState"]),
    freshnessScore: Number.isFinite(freshnessScore) ? Math.min(1, Math.max(0, freshnessScore)) : 0,
    killSwitchTriggeredAt: asIsoString(row.kill_switch_triggered_at),
    freshnessReason: String(row.freshness_reason ?? "Freshness has not been computed yet."),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapReportNote(row: Record<string, unknown>): ReportNoteRecord {
  return {
    reportId: String(row.report_id),
    userId: String(row.user_id),
    content: String(row.content ?? ""),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapUserFeedbackQueueRecord(row: Record<string, unknown>): UserFeedbackQueueRecord {
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
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapAlertLedgerRecord(row: Record<string, unknown>): AlertLedgerRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    notificationType: String(row.notification_type) as NotificationType,
    category: String(row.category) as AlertLedgerCategory,
    route: String(row.route) as AlertRouteTarget,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    reasonCode: String(row.reason_code ?? ""),
    reasonText: String(row.reason_text ?? ""),
    deliveryState: String(row.delivery_state) as AlertLedgerRecord["deliveryState"],
    feedbackState: row.feedback_state ? (String(row.feedback_state) as AlertFeedbackState) : undefined,
    mutedAt: asIsoString(row.muted_at),
    context: asRecord(row.context) ?? {},
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapConvictionJournalEntryRecord(
  row: Record<string, unknown>
): ConvictionJournalEntryRecord {
  return {
    id: String(row.journal_entry_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    eventType: String(row.event_type) as ConvictionJournalEventType,
    sourceType: String(row.source_type) as ConvictionJournalSourceType,
    sourceId: String(row.source_id),
    eventAt: asIsoString(row.event_at) ?? new Date().toISOString(),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    thesisSnapshot: cloneConvictionThesisSnapshot(
      (asRecord(row.thesis_snapshot) ?? {}) as ConvictionThesisSnapshot
    ),
    evidenceRefs: asConvictionEvidenceRefs(row.evidence_refs),
    reportId: row.report_id ? String(row.report_id) : undefined,
    alertLedgerId: row.alert_ledger_id ? String(row.alert_ledger_id) : undefined,
    warRoomId: row.war_room_id ? String(row.war_room_id) : undefined,
    monitorSnapshotKey: row.monitor_snapshot_key
      ? String(row.monitor_snapshot_key)
      : undefined,
    oppositeCaseId: row.opposite_case_id ? String(row.opposite_case_id) : undefined,
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapConvictionInsightCardRecord(
  row: Record<string, unknown>
): ConvictionInsightCardRecord {
  return {
    id: String(row.insight_id),
    userId: String(row.user_id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    insightType: String(row.insight_type) as ConvictionInsightType,
    status: String(row.status) as ConvictionInsightCardRecord["status"],
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    findings: asConvictionInsightFindings(row.findings),
    sourceJournalEntryIds: asStringArray(asJsonArray(row.source_journal_entry_ids)),
    generatedAt: asIsoString(row.generated_at) ?? new Date().toISOString(),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapOppositeCaseReportRecord(row: Record<string, unknown>): OppositeCaseReportRecord {
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
    generatedAt: asIsoString(row.generated_at) ?? new Date().toISOString(),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString()
  };
}

function mapScenarioStressTemplateRecord(
  row: Record<string, unknown>
): ScenarioStressTemplateRecord {
  return {
    templateId: String(row.scenario_id) as ScenarioStressTemplateId,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    hypothesis: String(row.hypothesis ?? ""),
    displayOrder: Number(row.display_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

function mapScenarioStressRunRecord(row: Record<string, unknown>): ScenarioStressRunRecord {
  return {
    id: String(row.scenario_run_id),
    scenarioId: String(row.scenario_id) as ScenarioStressTemplateId,
    userId: String(row.user_id),
    status: String(row.status) as ScenarioStressRunStatus,
    runMode: String(row.run_mode) as ScenarioStressRunMode,
    asOf: String(row.as_of),
    totalNames: Number(row.total_names ?? 0),
    impactedNames: Number(row.impacted_names ?? 0),
    criticalNames: Number(row.critical_names ?? 0),
    summary: String(row.summary ?? ""),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    completedAt: asIsoString(row.completed_at) ?? new Date().toISOString()
  };
}

function mapScenarioStressImpactRecord(
  row: Record<string, unknown>
): ScenarioStressImpactRecord {
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
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString()
  };
}

function mapScenarioStressRuleSuggestionRecord(
  row: Record<string, unknown>
): ScenarioStressRuleSuggestionRecord {
  return {
    id: String(row.scenario_rule_suggestion_id),
    scenarioRunId: String(row.scenario_run_id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    signalType: String(row.signal_type) as KillSwitchSignalType,
    direction: String(row.direction) as KillSwitchDirection,
    conditionText: String(row.condition_text ?? ""),
    rationale: String(row.rationale ?? ""),
    confidence: Number(row.confidence ?? 0),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString()
  };
}

function mapEarningsWarRoomRecord(row: Record<string, unknown>): EarningsWarRoomRecord {
  const updatedAt = asIsoString(row.updated_at) ?? new Date().toISOString();
  const currentCadenceMin =
    Number(row.current_cadence_min) === 30 ? 30 : 15;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    earningsEventId: String(row.earnings_event_id),
    eventDate:
      (typeof row.event_date === "string" && row.event_date.trim().length > 0
        ? row.event_date.trim()
        : undefined) ??
      (asIsoString(row.prepared_at)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)),
    state: String(row.state) as EarningsWarRoomState,
    currentCadenceMin,
    cadenceState: normalizeWarRoomCadenceState(
      row.cadence_state,
      currentCadenceMin,
      updatedAt
    ),
    preparedAt: asIsoString(row.prepared_at) ?? updatedAt,
    closedAt: asIsoString(row.closed_at),
    createdAt: asIsoString(row.created_at) ?? updatedAt,
    updatedAt
  };
}

function mapEarningsWarRoomTimelineEventRecord(
  row: Record<string, unknown>
): EarningsWarRoomTimelineEventRecord {
  return {
    id: String(row.id),
    warRoomId: String(row.war_room_id),
    phase: String(row.phase) as EarningsWarRoomPhase,
    eventType: String(row.event_type) as EarningsWarRoomTimelineEventType,
    reasonText: String(row.reason_text ?? ""),
    sourceRefs: cloneWarRoomSourceRefs(asWarRoomSourceRefs(row.source_refs)),
    alertLedgerId: row.alert_ledger_id ? String(row.alert_ledger_id) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    metadata: asRecord(row.metadata) ?? {},
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString()
  };
}

export class InMemoryStore implements ProductStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly userDevicesByUser = new Map<string, Map<string, UserDeviceRecord>>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly googleIdentitiesBySubject = new Map<string, GoogleIdentityRecord>();
  private readonly googleIdentitiesByUserId = new Map<string, GoogleIdentityRecord>();
  private readonly subscriptions = new Map<string, UserSubscriptionRecord>();
  private readonly userIdsByRevenuecatAppUserId = new Map<string, string>();
  private readonly deepDiveDailyUsage = new Map<string, Map<string, number>>();
  private readonly verificationTokensByHash = new Map<string, VerificationTokenRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly jobs = new Map<string, JobRecord>();
  private readonly reports = new Map<string, ReportRecord>();
  private readonly tickerRegistry = new Map<string, TickerRegistryRecord>();
  private readonly watchlists = new Map<string, Set<string>>();
  private readonly auditEvents: AuditEventRecord[] = [];
  private readonly historicalFinancialsByTicker = new Map<string, CanonicalFinancialSnapshot[]>();
  private readonly historicalTranscriptsByTicker = new Map<string, CanonicalTranscript[]>();
  private readonly historicalCoverageByTicker = new Map<string, TickerCoverage>();
  private readonly fearGreedByMarketDate = new Map<string, FearGreedSnapshot>();
  private readonly canonicalEvents = new Map<string, CanonicalEvent>();
  private readonly firstPartyContextItems = new Map<string, FirstPartyContextItem>();
  private readonly callArtifacts = new Map<string, CallArtifact>();
  private readonly calendarEvents = new Map<string, CalendarEventRecord>();
  private readonly contrarianAnchors = new Map<string, ContrarianAlertAnchorRecord>();
  private readonly killSwitchRules = new Map<string, KillSwitchRuleRecord>();
  private readonly killSwitchEvaluations = new Map<string, KillSwitchEvaluationRecord>();
  private readonly nameRelationships = new Map<string, NameRelationshipRecord>();
  private readonly reportNotes = new Map<string, ReportNoteRecord>();
  private readonly userFeedbackQueue = new Map<string, UserFeedbackQueueRecord>();
  private readonly thesisMonitorSnapshots = new Map<string, ThesisMonitorSnapshotRecord>();
  private readonly alertLedgerByUser = new Map<string, Map<string, AlertLedgerRecord>>();
  private readonly convictionJournalByUser = new Map<
    string,
    Map<string, ConvictionJournalEntryRecord>
  >();
  private readonly convictionInsightsByUser = new Map<
    string,
    Map<string, ConvictionInsightCardRecord>
  >();
  private readonly oppositeCasesByUser = new Map<
    string,
    Map<string, OppositeCaseReportRecord>
  >();
  private readonly scenarioStressTemplates = new Map<
    ScenarioStressTemplateId,
    ScenarioStressTemplateRecord
  >();
  private readonly scenarioStressRunsByUser = new Map<
    string,
    Map<string, ScenarioStressRunRecord>
  >();
  private readonly scenarioStressImpactsByRun = new Map<
    string,
    Map<string, ScenarioStressImpactRecord>
  >();
  private readonly scenarioStressRuleSuggestionsByRun = new Map<
    string,
    Map<string, ScenarioStressRuleSuggestionRecord>
  >();
  private readonly warRoomsByUser = new Map<string, Map<string, EarningsWarRoomRecord>>();
  private readonly warRoomTimelineByRoom = new Map<
    string,
    Map<string, EarningsWarRoomTimelineEventRecord>
  >();
  private readonly notificationPreferencesByUser = new Map<
    string,
    Map<NotificationType, NotificationPreferenceRecord>
  >();

  constructor() {
    const now = new Date().toISOString();
    for (const template of defaultScenarioStressTemplates(now)) {
      this.scenarioStressTemplates.set(template.templateId, { ...template });
    }
    const seed: TickerRegistryRecord[] = [
      {
        symbol: "AAPL",
        companyName: "Apple Inc. Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "MSFT",
        companyName: "Microsoft Corporation Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "TSLA",
        companyName: "Tesla, Inc. Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "NVDA",
        companyName: "NVIDIA Corporation Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "AMZN",
        companyName: "Amazon.com, Inc. Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "META",
        companyName: "Meta Platforms, Inc. Class A Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "GOOGL",
        companyName: "Alphabet Inc. Class A Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      }
    ];
    for (const entry of seed) {
      this.tickerRegistry.set(entry.symbol, entry);
    }

    const retrievedAt = now;
    const aaplFinancials: CanonicalFinancialSnapshot[] = [
      {
        snapshot_id: "memory-aapl-2025-q4",
        ticker: "AAPL",
        period: "2025-Q4",
        period_type: "quarterly",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        provider: "sec_edgar",
        filing_date: "2026-01-30",
        retrieved_at: retrievedAt,
        data: {
          revenue: 143756000000,
          net_income: 42097000000,
          eps_diluted: 2.4
        },
        missing_fields: []
      },
      {
        snapshot_id: "memory-aapl-2025-q3",
        ticker: "AAPL",
        period: "2025-Q3",
        period_type: "quarterly",
        fiscal_year: 2025,
        fiscal_quarter: 3,
        provider: "sec_edgar",
        filing_date: "2025-10-31",
        retrieved_at: retrievedAt,
        data: {
          revenue: 124300000000,
          net_income: 36330000000,
          eps_diluted: 2.18
        },
        missing_fields: []
      }
    ];

    const aaplTranscripts: CanonicalTranscript[] = [
      {
        transcript_id: "memory-aapl-2025-q4",
        ticker: "AAPL",
        period: "2025-Q4",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        call_date: "2026-01-30",
        provider: "huggingface_kurry",
        retrieved_at: retrievedAt,
        body_text: "Apple management discussed strong Services growth and product demand.",
        word_count: 11,
        is_complete: true
      }
    ];

    this.historicalFinancialsByTicker.set("AAPL", aaplFinancials);
    this.historicalTranscriptsByTicker.set("AAPL", aaplTranscripts);
    this.historicalCoverageByTicker.set("AAPL", {
      ticker: "AAPL",
      snapshot_count: aaplFinancials.length,
      transcript_count: aaplTranscripts.length,
      latest_period: "2025-Q4",
      earliest_period: "2025-Q3",
      has_guidance: false,
      has_estimates: false,
      last_synced_at: retrievedAt,
      last_sync_status: "success",
      backfill_tier: 1
    });
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | undefined> {
    const normalizedEmail = input.email.toLowerCase();
    if (this.usersByEmail.has(normalizedEmail)) {
      return undefined;
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const user: UserRecord = {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: now,
      failedLoginAttempts: 0
    };
    this.users.set(id, user);
    this.usersByEmail.set(normalizedEmail, id);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? this.users.get(userId) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  async findUserByGoogleSubject(googleSubject: string): Promise<UserRecord | undefined> {
    const identity = this.googleIdentitiesBySubject.get(googleSubject.trim());
    if (!identity) {
      return undefined;
    }
    return this.users.get(identity.userId);
  }

  async getGoogleIdentityByUserId(userId: string): Promise<GoogleIdentityRecord | undefined> {
    const identity = this.googleIdentitiesByUserId.get(userId);
    return identity ? { ...identity } : undefined;
  }

  async attachGoogleIdentity(input: {
    userId: string;
    googleSubject: string;
    email: string;
    linkedAt: string;
  }): Promise<GoogleIdentityAttachResult> {
    const normalizedSubject = input.googleSubject.trim();
    const normalizedEmail = input.email.trim().toLowerCase();
    const subjectIdentity = this.googleIdentitiesBySubject.get(normalizedSubject);
    if (subjectIdentity && subjectIdentity.userId !== input.userId) {
      return "subject_in_use";
    }

    const userIdentity = this.googleIdentitiesByUserId.get(input.userId);
    if (userIdentity) {
      if (userIdentity.googleSubject === normalizedSubject) {
        userIdentity.email = normalizedEmail;
        userIdentity.updatedAt = input.linkedAt;
        this.googleIdentitiesBySubject.set(normalizedSubject, { ...userIdentity });
        return "already_linked_to_user";
      }
      return "user_already_linked";
    }

    const identity: GoogleIdentityRecord = {
      userId: input.userId,
      googleSubject: normalizedSubject,
      email: normalizedEmail,
      linkedAt: input.linkedAt,
      updatedAt: input.linkedAt
    };
    this.googleIdentitiesBySubject.set(normalizedSubject, identity);
    this.googleIdentitiesByUserId.set(input.userId, identity);
    return "linked";
  }

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }

    user.verifiedAt = verifiedAt;
    return user;
  }

  async updateUserPasswordHash(
    userId: string,
    passwordHash: string
  ): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }

    user.passwordHash = passwordHash;
    return user;
  }

  async recordFailedLoginAttempt(input: {
    userId: string;
    attemptedAt: string;
    windowSeconds: number;
    maxFailures: number;
    lockoutDurationSeconds: number;
  }): Promise<UserRecord | undefined> {
    const user = this.users.get(input.userId);
    if (!user) {
      return undefined;
    }

    const attemptedAtMs = Date.parse(input.attemptedAt);
    const windowStartMs = user.failedLoginWindowStartedAt
      ? Date.parse(user.failedLoginWindowStartedAt)
      : Number.NaN;
    const windowMs = input.windowSeconds * 1000;
    const shouldResetWindow =
      !Number.isFinite(windowStartMs) || attemptedAtMs - windowStartMs > windowMs;

    if (shouldResetWindow) {
      user.failedLoginAttempts = 1;
      user.failedLoginWindowStartedAt = input.attemptedAt;
    } else {
      user.failedLoginAttempts += 1;
    }

    if (user.failedLoginAttempts >= input.maxFailures) {
      user.lockedUntil = new Date(
        attemptedAtMs + input.lockoutDurationSeconds * 1000
      ).toISOString();
    }

    return user;
  }

  async clearFailedLoginAttempts(userId: string): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }

    user.failedLoginAttempts = 0;
    user.failedLoginWindowStartedAt = undefined;
    user.lockedUntil = undefined;
    return user;
  }

  async updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    if (!deviceToken || deviceToken.trim().length === 0) {
      await this.invalidateUserDevicesByUser({
        userId,
        invalidatedAt: new Date().toISOString(),
        reason: "legacy_unset"
      });
      user.deviceToken = undefined;
      return user;
    }

    const normalized = deviceToken.trim();
    user.deviceToken = normalized;
    await this.upsertUserDevice({
      userId,
      installationId: `legacy:${userId}`,
      deviceToken: normalized,
      platform: "android",
      updatedAt: new Date().toISOString()
    });
    return user;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const targets: Array<{ userId: string; deviceToken: string }> = [];
    for (const devices of this.userDevicesByUser.values()) {
      for (const device of devices.values()) {
        if (device.invalidatedAt) {
          continue;
        }
        targets.push({
          userId: device.userId,
          deviceToken: device.deviceToken
        });
      }
    }
    return targets;
  }

  async upsertUserDevice(input: {
    userId: string;
    installationId: string;
    deviceToken: string;
    platform: string;
    updatedAt: string;
  }): Promise<UserDeviceRecord | undefined> {
    const user = this.users.get(input.userId);
    if (!user) {
      return undefined;
    }

    const normalizedInstallation = input.installationId.trim();
    const normalizedToken = input.deviceToken.trim();
    if (normalizedInstallation.length === 0 || normalizedToken.length === 0) {
      return undefined;
    }

    const invalidatedAt = input.updatedAt;
    for (const devices of this.userDevicesByUser.values()) {
      for (const device of devices.values()) {
        if (device.invalidatedAt) {
          continue;
        }
        if (
          device.deviceToken === normalizedToken &&
          (device.userId !== input.userId || device.installationId !== normalizedInstallation)
        ) {
          device.invalidatedAt = invalidatedAt;
          device.invalidationReason = "token_rotated";
          device.updatedAt = invalidatedAt;
        }
      }
    }

    let userDevices = this.userDevicesByUser.get(input.userId);
    if (!userDevices) {
      userDevices = new Map<string, UserDeviceRecord>();
      this.userDevicesByUser.set(input.userId, userDevices);
    }

    const existing = userDevices.get(normalizedInstallation);
    const createdAt = existing?.createdAt ?? input.updatedAt;
    const id = existing?.id ?? randomUUID();
    const record: UserDeviceRecord = {
      id,
      userId: input.userId,
      installationId: normalizedInstallation,
      deviceToken: normalizedToken,
      platform: input.platform.trim().toLowerCase() || "android",
      lastSeenAt: input.updatedAt,
      createdAt,
      updatedAt: input.updatedAt,
      invalidatedAt: undefined,
      invalidationReason: undefined
    };
    userDevices.set(normalizedInstallation, record);
    return { ...record };
  }

  async invalidateUserDeviceByInstallation(input: {
    userId: string;
    installationId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<boolean> {
    const devices = this.userDevicesByUser.get(input.userId);
    if (!devices) {
      return false;
    }
    const device = devices.get(input.installationId.trim());
    if (!device || device.invalidatedAt) {
      return false;
    }
    device.invalidatedAt = input.invalidatedAt;
    device.invalidationReason = input.reason;
    device.updatedAt = input.invalidatedAt;
    return true;
  }

  async invalidateUserDevicesByUser(input: {
    userId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number> {
    const devices = this.userDevicesByUser.get(input.userId);
    if (!devices) {
      return 0;
    }
    let changed = 0;
    for (const device of devices.values()) {
      if (device.invalidatedAt) {
        continue;
      }
      device.invalidatedAt = input.invalidatedAt;
      device.invalidationReason = input.reason;
      device.updatedAt = input.invalidatedAt;
      changed += 1;
    }
    return changed;
  }

  async invalidateUserDeviceByToken(input: {
    deviceToken: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number> {
    let changed = 0;
    for (const devices of this.userDevicesByUser.values()) {
      for (const device of devices.values()) {
        if (device.invalidatedAt) {
          continue;
        }
        if (device.deviceToken !== input.deviceToken) {
          continue;
        }
        device.invalidatedAt = input.invalidatedAt;
        device.invalidationReason = input.reason;
        device.updatedAt = input.invalidatedAt;
        changed += 1;
      }
    }
    return changed;
  }

  async listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; installationId: string; deviceToken: string }>> {
    const normalizedUserIds = input.userIds
      ? new Set(input.userIds.map((userId) => userId.trim()))
      : undefined;

    const pushTargets: Array<{ userId: string; installationId: string; deviceToken: string }> = [];
    for (const user of this.users.values()) {
      if (normalizedUserIds && !normalizedUserIds.has(user.id)) {
        continue;
      }
      if (input.tier) {
        const subscription = await this.getUserSubscription(user.id);
        if (subscription.tier !== input.tier) {
          continue;
        }
      }
      const preferences = this.ensureDefaultNotificationPreferences(user.id);
      const preference = preferences.get(input.notificationType);
      if (!preference || !preference.enabled) {
        continue;
      }
      if (isQuietUntilActive(preference.quietUntil, new Date().toISOString())) {
        continue;
      }
      const devices = this.userDevicesByUser.get(user.id);
      if (!devices) {
        continue;
      }
      for (const device of devices.values()) {
        if (device.invalidatedAt) {
          continue;
        }
        pushTargets.push({
          userId: user.id,
          installationId: device.installationId,
          deviceToken: device.deviceToken
        });
      }
    }

    return pushTargets;
  }

  async listUsersWithEmailByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; email: string }>> {
    const normalizedUserIds = input.userIds
      ? new Set(input.userIds.map((userId) => userId.trim()))
      : undefined;

    const emailTargets: Array<{ userId: string; email: string }> = [];
    for (const user of this.users.values()) {
      if (normalizedUserIds && !normalizedUserIds.has(user.id)) {
        continue;
      }
      if (input.tier) {
        const subscription = await this.getUserSubscription(user.id);
        if (subscription.tier !== input.tier) {
          continue;
        }
      }
      const preferences = this.ensureDefaultNotificationPreferences(user.id);
      const preference = preferences.get(input.notificationType);
      if (!preference || !preference.enabled) {
        continue;
      }
      if (isQuietUntilActive(preference.quietUntil, new Date().toISOString())) {
        continue;
      }
      if (!user.verifiedAt) {
        continue;
      }
      const normalizedEmail = user.email.trim().toLowerCase();
      if (normalizedEmail.length === 0) {
        continue;
      }
      emailTargets.push({
        userId: user.id,
        email: normalizedEmail
      });
    }

    return emailTargets;
  }

  private ensureDefaultNotificationPreferences(userId: string): Map<NotificationType, NotificationPreferenceRecord> {
    let preferences = this.notificationPreferencesByUser.get(userId);
    if (!preferences) {
      preferences = new Map<NotificationType, NotificationPreferenceRecord>();
      const now = new Date().toISOString();
      for (const type of defaultNotificationTypeList) {
        preferences.set(type, {
          userId,
          type,
          enabled: true,
          updatedAt: now
        });
      }
      this.notificationPreferencesByUser.set(userId, preferences);
    }
    return preferences;
  }

  async getUserSubscription(userId: string): Promise<UserSubscriptionRecord> {
    const existing = this.subscriptions.get(userId);
    if (existing) {
      return existing;
    }

    const created: UserSubscriptionRecord = {
      userId,
      tier: "FREE",
      updatedAt: new Date().toISOString()
    };
    this.subscriptions.set(userId, created);
    return created;
  }

  async findUserIdByRevenuecatAppUserId(revenuecatAppUserId: string): Promise<string | undefined> {
    return this.userIdsByRevenuecatAppUserId.get(revenuecatAppUserId.trim()) ?? undefined;
  }

  async upsertUserSubscription(input: {
    userId: string;
    tier: SubscriptionTier;
    revenuecatAppUserId?: string;
    billingPeriodEnd?: string;
    updatedAt: string;
  }): Promise<UserSubscriptionRecord> {
    const previous = this.subscriptions.get(input.userId);
    const nextRevenuecatAppUserId = input.revenuecatAppUserId?.trim() || previous?.revenuecatAppUserId;
    const subscription: UserSubscriptionRecord = {
      userId: input.userId,
      tier: input.tier,
      revenuecatAppUserId: nextRevenuecatAppUserId,
      billingPeriodEnd: input.billingPeriodEnd,
      updatedAt: input.updatedAt
    };

    this.subscriptions.set(input.userId, subscription);
    if (previous?.revenuecatAppUserId && previous.revenuecatAppUserId !== nextRevenuecatAppUserId) {
      this.userIdsByRevenuecatAppUserId.delete(previous.revenuecatAppUserId);
    }
    if (nextRevenuecatAppUserId) {
      this.userIdsByRevenuecatAppUserId.set(nextRevenuecatAppUserId, input.userId);
    }

    return subscription;
  }

  async getDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    const perUser = this.deepDiveDailyUsage.get(userId);
    if (!perUser) {
      return 0;
    }
    return perUser.get(usageDate) ?? 0;
  }

  async reserveDailyDeepDiveUsage(
    userId: string,
    usageDate: string,
    limit: number
  ): Promise<{ allowed: boolean; requestCount: number }> {
    let perUser = this.deepDiveDailyUsage.get(userId);
    if (!perUser) {
      perUser = new Map<string, number>();
      this.deepDiveDailyUsage.set(userId, perUser);
    }

    const current = perUser.get(usageDate) ?? 0;
    if (current >= limit) {
      return {
        allowed: false,
        requestCount: current
      };
    }

    const next = current + 1;
    perUser.set(usageDate, next);
    return {
      allowed: true,
      requestCount: next
    };
  }

  async releaseDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    const perUser = this.deepDiveDailyUsage.get(userId);
    if (!perUser) {
      return 0;
    }

    const current = perUser.get(usageDate) ?? 0;
    if (current <= 1) {
      perUser.delete(usageDate);
      if (perUser.size === 0) {
        this.deepDiveDailyUsage.delete(userId);
      }
      return 0;
    }

    const next = current - 1;
    perUser.set(usageDate, next);
    return next;
  }

  async incrementDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    let perUser = this.deepDiveDailyUsage.get(userId);
    if (!perUser) {
      perUser = new Map<string, number>();
      this.deepDiveDailyUsage.set(userId, perUser);
    }

    const next = (perUser.get(usageDate) ?? 0) + 1;
    perUser.set(usageDate, next);
    return next;
  }

  async createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord> {
    const token: VerificationTokenRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt
    };
    this.verificationTokensByHash.set(input.tokenHash, token);
    return token;
  }

  async consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined> {
    const token = this.verificationTokensByHash.get(tokenHash);
    if (!token) {
      return undefined;
    }

    if (token.consumedAt) {
      return undefined;
    }

    if (Date.parse(token.expiresAt) <= Date.now()) {
      return undefined;
    }

    token.consumedAt = consumedAt;
    return token;
  }

  async createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
    familyId?: string;
    parentSessionId?: string;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: input.id,
      userId: input.userId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      familyId: input.familyId ?? input.id,
      parentSessionId: input.parentSessionId
    };
    this.sessions.set(input.id, session);
    return session;
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(id);
  }

  async revokeSession(
    sessionId: string,
    revokedAt: string,
    options?: {
      reason?: string;
      replacedBySessionId?: string;
    }
  ): Promise<SessionRecord | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.revokedAt = session.revokedAt ?? revokedAt;
    if (options?.reason && !session.revokedReason) {
      session.revokedReason = options.reason;
    }
    if (options?.replacedBySessionId && !session.replacedBySessionId) {
      session.replacedBySessionId = options.replacedBySessionId;
    }
    return session;
  }

  async revokeSessionFamily(input: {
    familyId: string;
    revokedAt: string;
    reason: string;
  }): Promise<number> {
    let affected = 0;
    for (const session of this.sessions.values()) {
      if (session.familyId !== input.familyId) {
        continue;
      }
      if (session.revokedAt) {
        continue;
      }
      session.revokedAt = input.revokedAt;
      session.revokedReason = input.reason;
      affected += 1;
    }
    return affected;
  }

  async createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const job: JobRecord = {
      id: input.id,
      type: input.type,
      status: "queued",
      userId: input.userId,
      ticker: input.ticker,
      cycleStart: input.cycleStart,
      cycleEnd: input.cycleEnd,
      createdAt: input.createdAt
    };
    this.jobs.set(input.id, job);
    return job;
  }

  async findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined> {
    for (const job of this.jobs.values()) {
      if (job.type === type && job.cycleStart === cycleStart) {
        return job;
      }
    }
    return undefined;
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    return this.jobs.get(id);
  }

  async listRecoverableQueuedDeepDiveJobs(
    createdBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]> {
    const createdBefore = Date.parse(createdBeforeIso);
    if (Number.isNaN(createdBefore) || limit <= 0) {
      return [];
    }

    return [...this.jobs.values()]
      .filter((job) => (
        job.type === "deep_dive" &&
        job.status === "queued" &&
        Date.parse(job.createdAt) <= createdBefore
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, limit);
  }

  async listTimedOutRunningDeepDiveJobs(
    startedBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]> {
    const startedBefore = Date.parse(startedBeforeIso);
    if (Number.isNaN(startedBefore) || limit <= 0) {
      return [];
    }

    return [...this.jobs.values()]
      .filter((job) => {
        if (job.type !== "deep_dive" || job.status !== "running") {
          return false;
        }
        const startedAt = Date.parse(job.startedAt ?? job.createdAt);
        return !Number.isNaN(startedAt) && startedAt <= startedBefore;
      })
      .sort((left, right) => {
        const leftStarted = left.startedAt ?? left.createdAt;
        const rightStarted = right.startedAt ?? right.createdAt;
        return leftStarted.localeCompare(rightStarted);
      })
      .slice(0, limit);
  }

  async markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job || job.status !== "queued") {
      return undefined;
    }

    job.status = "running";
    job.startedAt = startedAt;
    job.errorMessage = undefined;
    return job;
  }

  async markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job) {
      return undefined;
    }

    job.status = "failed";
    if (!job.startedAt) {
      job.startedAt = failedAt;
    }
    job.completedAt = failedAt;
    job.errorMessage = errorMessage;
    return job;
  }

  async markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return undefined;
    }

    job.status = "complete";
    if (!job.startedAt) {
      job.startedAt = completedAt;
    }
    job.completedAt = completedAt;
    job.reportId = reportId;
    job.errorMessage = undefined;
    return job;
  }

  async createReport(input: ReportRecord): Promise<ReportRecord> {
    this.reports.set(input.id, input);
    return input;
  }

  async findReusableDeepDiveReport(input: {
    ticker: string;
    fingerprint: string;
    nowIso: string;
  }): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) =>
        report.type === "deep_dive" &&
        report.ticker === input.ticker &&
        report.fingerprint === input.fingerprint &&
        report.freshnessExpiresAt !== undefined &&
        Date.parse(report.freshnessExpiresAt) > Date.parse(input.nowIso) &&
        [...this.jobs.values()].some((job) =>
          job.status === "complete" && job.reportId === report.id
        ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async findLatestComparableDeepDiveReport(input: {
    ticker: string;
    schemaMajor: number;
    sinceIso: string;
  }): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) =>
        report.type === "deep_dive" &&
        report.ticker === input.ticker &&
        extractSchemaMajor(report.schemaVersion) === input.schemaMajor &&
        Date.parse(report.createdAt) >= Date.parse(input.sinceIso) &&
        [...this.jobs.values()].some((job) =>
          job.status === "complete" && job.reportId === report.id
        ))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async getReportById(id: string): Promise<ReportRecord | undefined> {
    return this.reports.get(id);
  }

  async hasReportAccessForUser(userId: string, reportId: string): Promise<boolean> {
    return [...this.jobs.values()].some((job) =>
      job.userId === userId &&
      job.status === "complete" &&
      job.reportId === reportId
    );
  }

  async deleteReport(id: string): Promise<boolean> {
    const report = this.reports.get(id);
    if (!report) {
      return false;
    }

    this.reports.delete(id);
    for (const job of this.jobs.values()) {
      if (job.reportId === id) {
        job.reportId = undefined;
      }
    }
    return true;
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    const accessibleReportIds = new Set(
      [...this.jobs.values()]
        .filter((job) =>
          job.userId === userId &&
          job.status === "complete" &&
          job.reportId !== undefined)
        .map((job) => job.reportId as string)
    );

    return [...this.reports.values()]
      .filter((report) => accessibleReportIds.has(report.id))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) => report.type === type)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) => report.type === type && report.createdAt.startsWith(date))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async listHistoricalFinancialSnapshotsByTicker(ticker: string): Promise<CanonicalFinancialSnapshot[]> {
    return [...(this.historicalFinancialsByTicker.get(ticker.trim().toUpperCase()) ?? [])];
  }

  async listHistoricalTranscriptsByTicker(ticker: string): Promise<CanonicalTranscript[]> {
    return [...(this.historicalTranscriptsByTicker.get(ticker.trim().toUpperCase()) ?? [])];
  }

  async getTickerCoverageByTicker(ticker: string): Promise<TickerCoverage | undefined> {
    const coverage = this.historicalCoverageByTicker.get(ticker.trim().toUpperCase());
    if (!coverage) {
      return undefined;
    }
    return { ...coverage };
  }

  async listTickerCoverageTickers(limit: number): Promise<string[]> {
    return [...this.historicalCoverageByTicker.keys()]
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker) => ticker.length > 0)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, Math.max(1, limit));
  }

  async upsertFearGreedSnapshot(input: {
    snapshot: FearGreedSnapshot;
  }): Promise<{ snapshot: FearGreedSnapshot; created: boolean }> {
    const key = input.snapshot.market_date;
    const created = !this.fearGreedByMarketDate.has(key);
    const stored: FearGreedSnapshot = {
      ...input.snapshot,
      sub_scores: input.snapshot.sub_scores.map((item) => ({ ...item })),
      missing_inputs: [...input.snapshot.missing_inputs]
    };
    this.fearGreedByMarketDate.set(key, stored);
    return {
      snapshot: stored,
      created
    };
  }

  async getFearGreedSnapshotByMarketDate(
    marketDate: string
  ): Promise<FearGreedSnapshot | undefined> {
    const snapshot = this.fearGreedByMarketDate.get(marketDate);
    if (!snapshot) {
      return undefined;
    }
    return {
      ...snapshot,
      sub_scores: snapshot.sub_scores.map((item) => ({ ...item })),
      missing_inputs: [...snapshot.missing_inputs]
    };
  }

  async getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined> {
    const latestDate = [...this.fearGreedByMarketDate.keys()]
      .sort((left, right) => right.localeCompare(left))[0];
    if (!latestDate) {
      return undefined;
    }
    return this.getFearGreedSnapshotByMarketDate(latestDate);
  }

  async listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]> {
    const limit = Math.max(1, days);
    const dates = [...this.fearGreedByMarketDate.keys()]
      .sort((left, right) => right.localeCompare(left))
      .slice(0, limit)
      .sort((left, right) => left.localeCompare(right));

    const snapshots: FearGreedSnapshot[] = [];
    for (const date of dates) {
      const snapshot = await this.getFearGreedSnapshotByMarketDate(date);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
    return snapshots;
  }

  async upsertCanonicalEvents(events: CanonicalEvent[]): Promise<{ upserted: number }> {
    for (const event of events) {
      this.canonicalEvents.set(event.id, {
        ...event,
        missing_fields: event.missing_fields.map((missing) => ({ ...missing })),
        metadata: { ...event.metadata },
        source: {
          ...event.source,
          source: { ...event.source.source }
        }
      });
    }
    return { upserted: events.length };
  }

  async listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }): Promise<CanonicalEvent[]> {
    const normalizedSubjectId = input.subjectId?.trim().toUpperCase();
    return [...this.canonicalEvents.values()]
      .filter((event) => !input.subjectType || event.subject_type === input.subjectType)
      .filter((event) => !normalizedSubjectId || event.subject_id.trim().toUpperCase() === normalizedSubjectId)
      .filter((event) => !input.family || event.family === input.family)
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
      .slice(0, Math.max(1, input.limit))
      .map((event) => ({
        ...event,
        missing_fields: event.missing_fields.map((missing) => ({ ...missing })),
        metadata: { ...event.metadata },
        source: {
          ...event.source,
          source: { ...event.source.source }
        }
      }));
  }

  async upsertFirstPartyContextItems(items: FirstPartyContextItem[]): Promise<{ upserted: number }> {
    for (const item of items) {
      this.firstPartyContextItems.set(item.context_id, cloneFirstPartyContextItem(item));
    }
    return { upserted: items.length };
  }

  async listFirstPartyContextItems(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<FirstPartyContextItem[]> {
    const ticker = input.ticker?.trim().toUpperCase();
    return [...this.firstPartyContextItems.values()]
      .filter((item) => !ticker || item.ticker.trim().toUpperCase() === ticker)
      .filter((item) => !input.eventId || item.event_id === input.eventId)
      .sort((left, right) => right.retrieved_at.localeCompare(left.retrieved_at))
      .slice(0, Math.max(1, input.limit))
      .map(cloneFirstPartyContextItem);
  }

  async upsertCallArtifacts(artifacts: CallArtifact[]): Promise<{ upserted: number }> {
    for (const artifact of artifacts) {
      this.callArtifacts.set(artifact.artifact_id, cloneCallArtifact(artifact));
    }
    return { upserted: artifacts.length };
  }

  async listCallArtifacts(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<CallArtifact[]> {
    const ticker = input.ticker?.trim().toUpperCase();
    return [...this.callArtifacts.values()]
      .filter((artifact) => !ticker || artifact.ticker.trim().toUpperCase() === ticker)
      .filter((artifact) => !input.eventId || artifact.event_id === input.eventId)
      .sort((left, right) => right.retrieved_at.localeCompare(left.retrieved_at))
      .slice(0, Math.max(1, input.limit))
      .map(cloneCallArtifact);
  }

  async upsertCalendarEvents(events: CalendarEventRecord[]): Promise<{ upserted: number }> {
    for (const event of events) {
      const ticker = event.ticker.trim().toUpperCase();
      const key = `${ticker}:${event.eventType}:${event.eventDate}`;
      this.calendarEvents.set(key, {
        ...event,
        ticker
      });
    }
    return {
      upserted: events.length
    };
  }

  async listUpcomingCalendarEventsByTickers(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventType;
  }): Promise<CalendarEventRecord[]> {
    const tickerSet = new Set(
      input.tickers
        .map((ticker) => ticker.trim().toUpperCase())
        .filter((ticker) => ticker.length > 0)
    );
    if (tickerSet.size === 0) {
      return [];
    }

    const fromTime = Date.parse(`${input.fromDate}T00:00:00.000Z`);
    const toTime = Date.parse(`${input.toDate}T23:59:59.999Z`);
    if (Number.isNaN(fromTime) || Number.isNaN(toTime) || fromTime > toTime) {
      return [];
    }

    return [...this.calendarEvents.values()]
      .filter((event) => {
        if (!tickerSet.has(event.ticker.trim().toUpperCase())) {
          return false;
        }
        if (input.eventType && event.eventType !== input.eventType) {
          return false;
        }
        const eventTime = Date.parse(`${event.eventDate}T00:00:00.000Z`);
        return !Number.isNaN(eventTime) && eventTime >= fromTime && eventTime <= toTime;
      })
      .sort((left, right) => {
        const byDate = left.eventDate.localeCompare(right.eventDate);
        if (byDate !== 0) {
          return byDate;
        }
        return left.ticker.localeCompare(right.ticker);
      });
  }

  async createContrarianAlertAnchor(
    input: ContrarianAlertAnchorRecord
  ): Promise<ContrarianAlertAnchorRecord> {
    const stored: ContrarianAlertAnchorRecord = {
      ...input,
      ticker: input.ticker.trim().toUpperCase()
    };
    this.contrarianAnchors.set(stored.id, stored);
    return { ...stored };
  }

  async listActiveContrarianAlertAnchors(asOfIso: string): Promise<ContrarianAlertAnchorRecord[]> {
    const asOf = Date.parse(asOfIso);
    if (Number.isNaN(asOf)) {
      return [];
    }

    return [...this.contrarianAnchors.values()]
      .filter((anchor) =>
        anchor.isActive &&
        Date.parse(anchor.expiresAt) >= asOf
      )
      .sort((left, right) => left.anchoredAt.localeCompare(right.anchoredAt))
      .map((anchor) => ({ ...anchor }));
  }

  async deactivateContrarianAlertAnchor(
    id: string,
    updatedAt: string
  ): Promise<ContrarianAlertAnchorRecord | undefined> {
    void updatedAt;
    const existing = this.contrarianAnchors.get(id);
    if (!existing) {
      return undefined;
    }

    existing.isActive = false;
    return { ...existing };
  }

  async deactivateExpiredContrarianAlertAnchors(asOfIso: string): Promise<number> {
    const asOf = Date.parse(asOfIso);
    if (Number.isNaN(asOf)) {
      return 0;
    }

    let updated = 0;
    for (const anchor of this.contrarianAnchors.values()) {
      if (!anchor.isActive) {
        continue;
      }
      if (Date.parse(anchor.expiresAt) < asOf) {
        anchor.isActive = false;
        updated += 1;
      }
    }
    return updated;
  }

  async createKillSwitchRule(input: KillSwitchRuleRecord): Promise<KillSwitchRuleRecord> {
    const next: KillSwitchRuleRecord = {
      ...input,
      ticker: input.ticker.trim().toUpperCase()
    };
    this.killSwitchRules.set(next.id, next);
    return { ...next };
  }

  async deactivateActiveKillSwitchRulesByUserTicker(input: {
    userId: string;
    ticker: string;
    deactivatedAt: string;
  }): Promise<number> {
    const ticker = input.ticker.trim().toUpperCase();
    let deactivated = 0;
    for (const rule of this.killSwitchRules.values()) {
      if (
        rule.userId !== input.userId ||
        rule.ticker !== ticker ||
        rule.state !== "active"
      ) {
        continue;
      }
      rule.state = "inactive";
      rule.deactivatedAt = input.deactivatedAt;
      rule.updatedAt = input.deactivatedAt;
      deactivated += 1;
    }
    return deactivated;
  }

  async listActiveKillSwitchRules(input: {
    asOfIso: string;
    userIds?: string[];
  }): Promise<KillSwitchRuleRecord[]> {
    const asOf = Date.parse(input.asOfIso);
    if (Number.isNaN(asOf)) {
      return [];
    }

    const userIdSet =
      input.userIds && input.userIds.length > 0 ? new Set(input.userIds) : undefined;
    return [...this.killSwitchRules.values()]
      .filter((rule) => {
        if (rule.state !== "active") {
          return false;
        }
        if (rule.deactivatedAt && Date.parse(rule.deactivatedAt) <= asOf) {
          return false;
        }
        if (userIdSet && !userIdSet.has(rule.userId)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((rule) => ({ ...rule }));
  }

  async getKillSwitchEvaluation(input: {
    ruleId: string;
    signalSource: KillSwitchEvaluationSignalSource;
    triggerKey: string;
  }): Promise<KillSwitchEvaluationRecord | undefined> {
    const key = `${input.ruleId}:${input.signalSource}:${input.triggerKey}`;
    const existing = this.killSwitchEvaluations.get(key);
    return existing ? { ...existing } : undefined;
  }

  async listKillSwitchEvaluations(input: {
    userId: string;
    ticker?: string;
    outcomes?: KillSwitchEvaluationOutcome[];
    sinceIso?: string;
    limit?: number;
  }): Promise<KillSwitchEvaluationRecord[]> {
    const ticker =
      typeof input.ticker === "string" && input.ticker.trim().length > 0
        ? input.ticker.trim().toUpperCase()
        : undefined;
    const sinceMillis =
      typeof input.sinceIso === "string" && input.sinceIso.trim().length > 0
        ? Date.parse(input.sinceIso)
        : Number.NaN;
    const sinceFilter = Number.isFinite(sinceMillis) ? (sinceMillis as number) : undefined;
    const outcomeSet =
      Array.isArray(input.outcomes) && input.outcomes.length > 0
        ? new Set(input.outcomes)
        : undefined;
    const limit = Math.max(1, input.limit ?? 500);

    return [...this.killSwitchEvaluations.values()]
      .filter((evaluation) => evaluation.userId === input.userId)
      .filter((evaluation) => !ticker || evaluation.ticker === ticker)
      .filter((evaluation) => !outcomeSet || outcomeSet.has(evaluation.outcome))
      .filter((evaluation) => {
        if (!sinceFilter) {
          return true;
        }
        const createdMillis = Date.parse(evaluation.createdAt);
        return Number.isFinite(createdMillis) && createdMillis >= sinceFilter;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((evaluation) => ({ ...evaluation }));
  }

  async createKillSwitchEvaluation(
    input: KillSwitchEvaluationRecord
  ): Promise<KillSwitchEvaluationRecord> {
    const key = `${input.ruleId}:${input.signalSource}:${input.triggerKey}`;
    this.killSwitchEvaluations.set(key, { ...input });
    return { ...input };
  }

  async upsertNameRelationship(
    input: NameRelationshipRecord
  ): Promise<NameRelationshipRecord> {
    const existing = this.nameRelationships.get(input.relationshipId);
    const next: NameRelationshipRecord = {
      ...input,
      sourceTicker: input.sourceTicker.trim().toUpperCase(),
      targetTicker: input.targetTicker.trim().toUpperCase(),
      createdAt: existing?.createdAt ?? input.createdAt
    };
    this.nameRelationships.set(next.relationshipId, next);
    return { ...next };
  }

  async getNameRelationship(
    relationshipId: string
  ): Promise<NameRelationshipRecord | undefined> {
    const existing = this.nameRelationships.get(relationshipId);
    return existing ? { ...existing } : undefined;
  }

  async listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]> {
    const sourceTicker = input.sourceTicker?.trim().toUpperCase();
    const targetTicker = input.targetTicker?.trim().toUpperCase();
    const stateSet = input.states && input.states.length > 0 ? new Set(input.states) : undefined;
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence ?? 0));
    return [...this.nameRelationships.values()]
      .filter((relationship) => relationship.userId === input.userId)
      .filter((relationship) => !sourceTicker || relationship.sourceTicker === sourceTicker)
      .filter((relationship) => !targetTicker || relationship.targetTicker === targetTicker)
      .filter((relationship) => !stateSet || stateSet.has(relationship.state))
      .filter((relationship) => relationship.confidence >= minConfidence)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, input.limit))
      .map((relationship) => ({ ...relationship }));
  }

  async listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }): Promise<NameRelationshipRecord[]> {
    const sourceTicker = input.sourceTicker.trim().toUpperCase();
    const relationshipTypeSet =
      input.relationshipTypes && input.relationshipTypes.length > 0
        ? new Set(input.relationshipTypes)
        : undefined;
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence));
    return [...this.nameRelationships.values()]
      .filter((relationship) => relationship.state === "active")
      .filter((relationship) => relationship.sourceTicker === sourceTicker)
      .filter((relationship) => !relationshipTypeSet || relationshipTypeSet.has(relationship.relationshipType))
      .filter((relationship) => relationship.confidence >= minConfidence)
      .sort((left, right) => right.confidence - left.confidence || left.updatedAt.localeCompare(right.updatedAt))
      .map((relationship) => ({ ...relationship }));
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord[]> {
    const preferences = this.ensureDefaultNotificationPreferences(userId);
    return [...preferences.values()].map((entry) => ({ ...entry }));
  }

  async upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{
      type: NotificationType;
      enabled?: boolean;
      quietUntil?: string | null;
    }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]> {
    const preferences = this.ensureDefaultNotificationPreferences(input.userId);
    for (const update of input.preferences) {
      if (!isNotificationType(update.type)) {
        continue;
      }
      const current = preferences.get(update.type);
      const effectiveQuietUntil =
        update.quietUntil !== undefined
          ? update.quietUntil ?? undefined
          : update.enabled !== undefined
            ? undefined
            : current?.quietUntil;
      preferences.set(update.type, {
        userId: input.userId,
        type: update.type,
        enabled: update.enabled ?? current?.enabled ?? true,
        quietUntil: effectiveQuietUntil,
        updatedAt: input.updatedAt
      });
    }
    return [...preferences.values()].map((entry) => ({ ...entry }));
  }

  async createAlertLedgerItem(input: AlertLedgerRecord): Promise<AlertLedgerRecord> {
    let alerts = this.alertLedgerByUser.get(input.userId);
    if (!alerts) {
      alerts = new Map<string, AlertLedgerRecord>();
      this.alertLedgerByUser.set(input.userId, alerts);
    }
    const next: AlertLedgerRecord = {
      ...input,
      context: { ...(input.context ?? {}) }
    };
    alerts.set(next.id, next);
    return {
      ...next,
      context: { ...next.context }
    };
  }

  async getAlertLedgerItem(input: {
    id: string;
    userId: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const alerts = this.alertLedgerByUser.get(input.userId);
    const item = alerts?.get(input.id);
    return item
      ? {
          ...item,
          context: { ...item.context }
        }
      : undefined;
  }

  async listAlertLedgerItemsByUser(input: {
    userId: string;
    limit: number;
    category?: AlertLedgerCategory;
  }): Promise<AlertLedgerRecord[]> {
    const alerts = [...(this.alertLedgerByUser.get(input.userId)?.values() ?? [])]
      .filter((item) => !input.category || item.category === input.category)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, input.limit));
    return alerts.map((item) => ({
      ...item,
      context: { ...item.context }
    }));
  }

  async setAlertLedgerFeedback(input: {
    id: string;
    userId: string;
    feedback: AlertFeedbackState;
    updatedAt: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const alerts = this.alertLedgerByUser.get(input.userId);
    const existing = alerts?.get(input.id);
    if (!alerts || !existing) {
      return undefined;
    }
    const next: AlertLedgerRecord = {
      ...existing,
      feedbackState: input.feedback,
      updatedAt: input.updatedAt,
      context: { ...existing.context }
    };
    alerts.set(input.id, next);
    return {
      ...next,
      context: { ...next.context }
    };
  }

  async markAlertLedgerMuted(input: {
    id: string;
    userId: string;
    mutedAt: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const alerts = this.alertLedgerByUser.get(input.userId);
    const existing = alerts?.get(input.id);
    if (!alerts || !existing) {
      return undefined;
    }
    const next: AlertLedgerRecord = {
      ...existing,
      mutedAt: input.mutedAt,
      updatedAt: input.mutedAt,
      context: { ...existing.context }
    };
    alerts.set(input.id, next);
    return {
      ...next,
      context: { ...next.context }
    };
  }

  async upsertConvictionJournalEntry(
    input: ConvictionJournalEntryRecord
  ): Promise<ConvictionJournalEntryRecord> {
    let entries = this.convictionJournalByUser.get(input.userId);
    if (!entries) {
      entries = new Map<string, ConvictionJournalEntryRecord>();
      this.convictionJournalByUser.set(input.userId, entries);
    }

    const existing = [...entries.values()].find(
      (entry) =>
        entry.eventType === input.eventType &&
        entry.sourceType === input.sourceType &&
        entry.sourceId === input.sourceId
    );
    const next: ConvictionJournalEntryRecord = {
      ...input,
      id: existing?.id ?? input.id,
      ticker: input.ticker.trim().toUpperCase(),
      thesisSnapshot: cloneConvictionThesisSnapshot(input.thesisSnapshot),
      evidenceRefs: cloneConvictionEvidenceRefs(input.evidenceRefs)
    };
    entries.set(next.id, next);
    return {
      ...next,
      thesisSnapshot: cloneConvictionThesisSnapshot(next.thesisSnapshot),
      evidenceRefs: cloneConvictionEvidenceRefs(next.evidenceRefs)
    };
  }

  async listConvictionJournalEntriesByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
  }): Promise<ConvictionJournalEntryRecord[]> {
    const ticker = input.ticker?.trim().toUpperCase();
    return [...(this.convictionJournalByUser.get(input.userId)?.values() ?? [])]
      .filter((entry) => !ticker || entry.ticker === ticker)
      .sort((left, right) => right.eventAt.localeCompare(left.eventAt))
      .slice(0, Math.max(1, input.limit))
      .map((entry) => ({
        ...entry,
        thesisSnapshot: cloneConvictionThesisSnapshot(entry.thesisSnapshot),
        evidenceRefs: cloneConvictionEvidenceRefs(entry.evidenceRefs)
      }));
  }

  async upsertConvictionInsightCard(
    input: ConvictionInsightCardRecord
  ): Promise<ConvictionInsightCardRecord> {
    let insights = this.convictionInsightsByUser.get(input.userId);
    if (!insights) {
      insights = new Map<string, ConvictionInsightCardRecord>();
      this.convictionInsightsByUser.set(input.userId, insights);
    }
    const existing = [...insights.values()].find(
      (entry) =>
        entry.periodStart === input.periodStart &&
        entry.periodEnd === input.periodEnd &&
        entry.insightType === input.insightType
    );
    const next: ConvictionInsightCardRecord = {
      ...input,
      id: existing?.id ?? input.id,
      findings: cloneConvictionInsightFindings(input.findings),
      sourceJournalEntryIds: [...input.sourceJournalEntryIds]
    };
    insights.set(next.id, next);
    return {
      ...next,
      findings: cloneConvictionInsightFindings(next.findings),
      sourceJournalEntryIds: [...next.sourceJournalEntryIds]
    };
  }

  async listConvictionInsightCardsByUser(input: {
    userId: string;
    limit: number;
  }): Promise<ConvictionInsightCardRecord[]> {
    return [...(this.convictionInsightsByUser.get(input.userId)?.values() ?? [])]
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
      .slice(0, Math.max(1, input.limit))
      .map((entry) => ({
        ...entry,
        findings: cloneConvictionInsightFindings(entry.findings),
        sourceJournalEntryIds: [...entry.sourceJournalEntryIds]
      }));
  }

  async upsertOppositeCaseReport(
    input: OppositeCaseReportRecord
  ): Promise<OppositeCaseReportRecord> {
    let reports = this.oppositeCasesByUser.get(input.userId);
    if (!reports) {
      reports = new Map<string, OppositeCaseReportRecord>();
      this.oppositeCasesByUser.set(input.userId, reports);
    }
    const existing = [...reports.values()].find(
      (entry) => entry.sourceReportId === input.sourceReportId
    );
    const next: OppositeCaseReportRecord = {
      ...input,
      id: existing?.id ?? input.id,
      ticker: input.ticker.trim().toUpperCase(),
      keyPoints: cloneOppositeCaseKeyPoints(input.keyPoints),
      sharedEvidenceRefs: cloneConvictionEvidenceRefs(input.sharedEvidenceRefs),
      decisiveFactors: [...input.decisiveFactors]
    };
    reports.set(next.id, next);
    return {
      ...next,
      keyPoints: cloneOppositeCaseKeyPoints(next.keyPoints),
      sharedEvidenceRefs: cloneConvictionEvidenceRefs(next.sharedEvidenceRefs),
      decisiveFactors: [...next.decisiveFactors]
    };
  }

  async getOppositeCaseReportBySource(input: {
    userId: string;
    sourceReportId: string;
  }): Promise<OppositeCaseReportRecord | undefined> {
    const report = [...(this.oppositeCasesByUser.get(input.userId)?.values() ?? [])].find(
      (entry) => entry.sourceReportId === input.sourceReportId
    );
    return report
      ? {
          ...report,
          keyPoints: cloneOppositeCaseKeyPoints(report.keyPoints),
          sharedEvidenceRefs: cloneConvictionEvidenceRefs(report.sharedEvidenceRefs),
          decisiveFactors: [...report.decisiveFactors]
        }
      : undefined;
  }

  async listScenarioStressTemplates(input?: {
    includeInactive?: boolean;
    limit?: number;
  }): Promise<ScenarioStressTemplateRecord[]> {
    const includeInactive = input?.includeInactive ?? false;
    return [...this.scenarioStressTemplates.values()]
      .filter((template) => includeInactive || template.isActive)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .slice(0, Math.max(1, input?.limit ?? 50))
      .map((template) => ({ ...template }));
  }

  async getScenarioStressTemplate(
    templateId: ScenarioStressTemplateId
  ): Promise<ScenarioStressTemplateRecord | undefined> {
    const template = this.scenarioStressTemplates.get(templateId);
    return template ? { ...template } : undefined;
  }

  async createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord> {
    let runs = this.scenarioStressRunsByUser.get(input.userId);
    if (!runs) {
      runs = new Map<string, ScenarioStressRunRecord>();
      this.scenarioStressRunsByUser.set(input.userId, runs);
    }
    const next: ScenarioStressRunRecord = {
      ...input,
      totalNames: Math.max(0, Math.floor(input.totalNames)),
      impactedNames: Math.max(0, Math.floor(input.impactedNames)),
      criticalNames: Math.max(0, Math.floor(input.criticalNames))
    };
    runs.set(next.id, next);
    return { ...next };
  }

  async getScenarioStressRun(input: {
    id: string;
    userId: string;
  }): Promise<ScenarioStressRunRecord | undefined> {
    const run = this.scenarioStressRunsByUser.get(input.userId)?.get(input.id);
    return run ? { ...run } : undefined;
  }

  async createScenarioStressImpacts(
    input: ScenarioStressImpactRecord[]
  ): Promise<ScenarioStressImpactRecord[]> {
    const created: ScenarioStressImpactRecord[] = [];
    for (const item of input) {
      let impacts = this.scenarioStressImpactsByRun.get(item.scenarioRunId);
      if (!impacts) {
        impacts = new Map<string, ScenarioStressImpactRecord>();
        this.scenarioStressImpactsByRun.set(item.scenarioRunId, impacts);
      }
      const next: ScenarioStressImpactRecord = {
        ...item,
        ticker: item.ticker.trim().toUpperCase(),
        stressScore: Math.min(1, Math.max(0, item.stressScore)),
        evidenceRefs: cloneScenarioStressEvidenceRefs(item.evidenceRefs)
      };
      impacts.set(next.id, next);
      created.push({
        ...next,
        evidenceRefs: cloneScenarioStressEvidenceRefs(next.evidenceRefs)
      });
    }
    return created;
  }

  async listScenarioStressImpactsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressImpactRecord[]> {
    const run = await this.getScenarioStressRun({
      id: input.scenarioRunId,
      userId: input.userId
    });
    if (!run) {
      return [];
    }
    return [...(this.scenarioStressImpactsByRun.get(input.scenarioRunId)?.values() ?? [])]
      .sort((left, right) => right.stressScore - left.stressScore || left.ticker.localeCompare(right.ticker))
      .map((impact) => ({
        ...impact,
        evidenceRefs: cloneScenarioStressEvidenceRefs(impact.evidenceRefs)
      }));
  }

  async createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[]
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    const created: ScenarioStressRuleSuggestionRecord[] = [];
    for (const item of input) {
      let suggestions = this.scenarioStressRuleSuggestionsByRun.get(item.scenarioRunId);
      if (!suggestions) {
        suggestions = new Map<string, ScenarioStressRuleSuggestionRecord>();
        this.scenarioStressRuleSuggestionsByRun.set(item.scenarioRunId, suggestions);
      }
      const next: ScenarioStressRuleSuggestionRecord = {
        ...item,
        ticker: item.ticker.trim().toUpperCase(),
        confidence: Math.min(1, Math.max(0, item.confidence))
      };
      suggestions.set(next.id, next);
      created.push({ ...next });
    }
    return created;
  }

  async listScenarioStressRuleSuggestionsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressRuleSuggestionRecord[]> {
    const run = await this.getScenarioStressRun({
      id: input.scenarioRunId,
      userId: input.userId
    });
    if (!run) {
      return [];
    }
    return [...(this.scenarioStressRuleSuggestionsByRun.get(input.scenarioRunId)?.values() ?? [])]
      .sort((left, right) => right.confidence - left.confidence || left.ticker.localeCompare(right.ticker))
      .map((suggestion) => ({ ...suggestion }));
  }

  async createWarRoom(input: EarningsWarRoomRecord): Promise<EarningsWarRoomRecord> {
    let warRooms = this.warRoomsByUser.get(input.userId);
    if (!warRooms) {
      warRooms = new Map<string, EarningsWarRoomRecord>();
      this.warRoomsByUser.set(input.userId, warRooms);
    }

    const next: EarningsWarRoomRecord = {
      ...input,
      ticker: input.ticker.trim().toUpperCase(),
      eventDate: input.eventDate.trim(),
      cadenceState: cloneWarRoomCadenceState(input.cadenceState)
    };
    warRooms.set(next.id, next);
    return {
      ...next,
      cadenceState: cloneWarRoomCadenceState(next.cadenceState)
    };
  }

  async updateWarRoom(
    input: EarningsWarRoomRecord
  ): Promise<EarningsWarRoomRecord | undefined> {
    const warRooms = this.warRoomsByUser.get(input.userId);
    if (!warRooms?.has(input.id)) {
      return undefined;
    }

    const next: EarningsWarRoomRecord = {
      ...input,
      ticker: input.ticker.trim().toUpperCase(),
      eventDate: input.eventDate.trim(),
      cadenceState: cloneWarRoomCadenceState(input.cadenceState)
    };
    warRooms.set(next.id, next);
    return {
      ...next,
      cadenceState: cloneWarRoomCadenceState(next.cadenceState)
    };
  }

  async getWarRoom(input: {
    id: string;
    userId: string;
  }): Promise<EarningsWarRoomRecord | undefined> {
    const warRoom = this.warRoomsByUser.get(input.userId)?.get(input.id);
    return warRoom
      ? {
          ...warRoom,
          cadenceState: cloneWarRoomCadenceState(warRoom.cadenceState)
        }
      : undefined;
  }

  async findWarRoomByEvent(input: {
    userId: string;
    ticker: string;
    earningsEventId: string;
  }): Promise<EarningsWarRoomRecord | undefined> {
    const ticker = input.ticker.trim().toUpperCase();
    const warRoom = [...(this.warRoomsByUser.get(input.userId)?.values() ?? [])].find(
      (candidate) =>
        candidate.ticker === ticker && candidate.earningsEventId === input.earningsEventId
    );
    return warRoom
      ? {
          ...warRoom,
          cadenceState: cloneWarRoomCadenceState(warRoom.cadenceState)
        }
      : undefined;
  }

  async listWarRoomsByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
    includeClosed?: boolean;
  }): Promise<EarningsWarRoomRecord[]> {
    const ticker =
      typeof input.ticker === "string" && input.ticker.trim().length > 0
        ? input.ticker.trim().toUpperCase()
        : undefined;

    return [...(this.warRoomsByUser.get(input.userId)?.values() ?? [])]
      .filter((warRoom) => !ticker || warRoom.ticker === ticker)
      .filter((warRoom) => input.includeClosed || warRoom.state !== "closed")
      .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt))
      .slice(0, Math.max(1, input.limit))
      .map((warRoom) => ({
        ...warRoom,
        cadenceState: cloneWarRoomCadenceState(warRoom.cadenceState)
      }));
  }

  async createWarRoomTimelineEvent(
    input: EarningsWarRoomTimelineEventRecord
  ): Promise<EarningsWarRoomTimelineEventRecord> {
    let events = this.warRoomTimelineByRoom.get(input.warRoomId);
    if (!events) {
      events = new Map<string, EarningsWarRoomTimelineEventRecord>();
      this.warRoomTimelineByRoom.set(input.warRoomId, events);
    }

    const next: EarningsWarRoomTimelineEventRecord = {
      ...input,
      sourceRefs: cloneWarRoomSourceRefs(input.sourceRefs),
      metadata: { ...input.metadata }
    };
    events.set(next.id, next);
    return {
      ...next,
      sourceRefs: cloneWarRoomSourceRefs(next.sourceRefs),
      metadata: { ...next.metadata }
    };
  }

  async getWarRoomTimelineEvent(input: {
    id: string;
    warRoomId: string;
  }): Promise<EarningsWarRoomTimelineEventRecord | undefined> {
    const event = this.warRoomTimelineByRoom.get(input.warRoomId)?.get(input.id);
    return event
      ? {
          ...event,
          sourceRefs: cloneWarRoomSourceRefs(event.sourceRefs),
          metadata: { ...event.metadata }
        }
      : undefined;
  }

  async listWarRoomTimelineEvents(input: {
    warRoomId: string;
    limit: number;
  }): Promise<EarningsWarRoomTimelineEventRecord[]> {
    return [...(this.warRoomTimelineByRoom.get(input.warRoomId)?.values() ?? [])]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-Math.max(1, input.limit))
      .map((event) => ({
        ...event,
        sourceRefs: cloneWarRoomSourceRefs(event.sourceRefs),
        metadata: { ...event.metadata }
      }));
  }

  async upsertThesisMonitorSnapshot(
    input: ThesisMonitorSnapshotRecord
  ): Promise<ThesisMonitorSnapshotRecord> {
    const key = `${input.userId}:${input.ticker.trim().toUpperCase()}`;
    const next: ThesisMonitorSnapshotRecord = {
      ...input,
      ticker: input.ticker.trim().toUpperCase(),
      materialEventsCount: Math.max(0, Math.floor(input.materialEventsCount ?? 0)),
      unreviewedEventsCount: Math.max(0, Math.floor(input.unreviewedEventsCount ?? 0)),
      freshnessState: input.freshnessState ?? "stale",
      freshnessScore: Math.min(1, Math.max(0, input.freshnessScore ?? 0)),
      freshnessReason: input.freshnessReason ?? "Freshness has not been computed yet."
    };
    this.thesisMonitorSnapshots.set(key, next);
    return { ...next };
  }

  async listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    return [...this.thesisMonitorSnapshots.values()]
      .filter((snapshot) => snapshot.userId === userId)
      .sort((left, right) => left.ticker.localeCompare(right.ticker))
      .map((snapshot) => ({ ...snapshot }));
  }

  async getReportNote(
    reportId: string,
    userId: string
  ): Promise<ReportNoteRecord | undefined> {
    const key = `${reportId}:${userId}`;
    const note = this.reportNotes.get(key);
    return note ? { ...note } : undefined;
  }

  async upsertReportNote(input: {
    reportId: string;
    userId: string;
    content: string;
    updatedAt: string;
  }): Promise<ReportNoteRecord> {
    const key = `${input.reportId}:${input.userId}`;
    const note: ReportNoteRecord = {
      reportId: input.reportId,
      userId: input.userId,
      content: input.content,
      updatedAt: input.updatedAt
    };
    this.reportNotes.set(key, note);
    return { ...note };
  }

  async enqueueUserFeedback(input: {
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
    metadata?: Record<string, unknown>;
    triageStatus: FeedbackTriageStatus;
    routeStatus: FeedbackRouteStatus;
    triageOwner?: string;
    triagedAt?: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<UserFeedbackQueueRecord> {
    const record: UserFeedbackQueueRecord = {
      ...input,
      ticker: input.ticker?.trim().toUpperCase(),
      metadata: { ...(input.metadata ?? {}) }
    };
    this.userFeedbackQueue.set(record.id, record);
    return { ...record, metadata: { ...record.metadata } };
  }

  async listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: FeedbackTriageStatus;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }): Promise<UserFeedbackQueueRecord[]> {
    return [...this.userFeedbackQueue.values()]
      .filter((row) => !input.feedbackType || row.feedbackType === input.feedbackType)
      .filter((row) => !input.triageStatus || row.triageStatus === input.triageStatus)
      .filter((row) => !input.userTier || row.userTier === input.userTier)
      .filter((row) => !input.sourceSurface || row.sourceSurface === input.sourceSurface)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, input.limit))
      .map((row) => ({ ...row, metadata: { ...row.metadata } }));
  }

  async listUsersWithWatchlist(): Promise<Array<{ userId: string; tickers: string[] }>> {
    return [...this.watchlists.entries()]
      .map(([userId, tickers]) => ({
        userId,
        tickers: [...tickers].sort((left, right) => left.localeCompare(right))
      }))
      .filter((entry) => entry.tickers.length > 0);
  }

  async listWatchlistTickersByUser(userId: string): Promise<string[]> {
    const set = this.watchlists.get(userId);
    if (!set) {
      return [];
    }
    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]> {
    const normalizedTicker = input.ticker.trim().toUpperCase();
    let set = this.watchlists.get(input.userId);
    if (!set) {
      set = new Set<string>();
      this.watchlists.set(input.userId, set);
    }
    set.add(normalizedTicker);
    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async removeWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
    const set = this.watchlists.get(userId);
    if (!set) {
      return [];
    }

    set.delete(ticker.trim().toUpperCase());
    if (set.size === 0) {
      this.watchlists.delete(userId);
      return [];
    }

    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async searchTickers(query: string, limit: number): Promise<TickerSearchResult[]> {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    return [...this.tickerRegistry.values()]
      .filter(
        (entry) =>
          entry.isSupported &&
          entry.listingStatus === "active" &&
          (entry.symbol.includes(normalized) ||
            entry.companyName.toUpperCase().includes(normalized))
      )
      .slice(0, limit)
      .map((entry) => ({
        symbol: entry.symbol,
        company_name: entry.companyName,
        exchange: entry.exchange
      }));
  }

  async getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined> {
    const normalized = symbol.trim().toUpperCase();
    const entry = this.tickerRegistry.get(normalized);
    if (!entry || !entry.isSupported || entry.listingStatus !== "active") {
      return undefined;
    }
    return entry;
  }

  async replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }> {
    const incomingSymbols = new Set<string>();
    for (const entry of input.entries) {
      const symbol = entry.symbol.trim().toUpperCase();
      incomingSymbols.add(symbol);
      this.tickerRegistry.set(symbol, {
        symbol,
        companyName: entry.companyName,
        exchange: entry.exchange,
        listingStatus: entry.listingStatus,
        isSupported: entry.isSupported,
        sourceFeed: entry.sourceFeed || input.sourceFeed,
        sourceUpdatedAt: entry.sourceUpdatedAt,
        lastSyncedAt: input.syncedAt,
        rawPayload: entry.rawPayload ?? {}
      });
    }

    let deactivated = 0;
    for (const [symbol, existing] of this.tickerRegistry.entries()) {
      if (!incomingSymbols.has(symbol) && existing.listingStatus === "active") {
        this.tickerRegistry.set(symbol, {
          ...existing,
          listingStatus: "delisted",
          isSupported: false,
          sourceFeed: input.sourceFeed,
          lastSyncedAt: input.syncedAt
        });
        deactivated += 1;
      }
    }

    return {
      upserted: input.entries.length,
      deactivated
    };
  }

  async applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }> {
    let added = 0;
    let deleted = 0;
    let updated = 0;
    let renamed = 0;

    for (const change of input.changes) {
      const symbol = change.symbol.trim().toUpperCase();
      if (!symbol) {
        continue;
      }

      const existing = this.tickerRegistry.get(symbol);
      if (change.type === "add") {
        this.tickerRegistry.set(symbol, {
          symbol,
          companyName: change.companyName ?? existing?.companyName ?? symbol,
          exchange: change.exchange ?? existing?.exchange ?? "NASDAQ",
          listingStatus: "active",
          isSupported: true,
          sourceFeed: change.sourceFeed,
          sourceUpdatedAt: change.sourceUpdatedAt,
          lastSyncedAt: input.syncedAt,
          rawPayload: change.rawPayload ?? {}
        });
        if (existing) {
          updated += 1;
        } else {
          added += 1;
        }
        continue;
      }

      if (change.type === "delete") {
        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            listingStatus: "delisted",
            isSupported: false,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
          deleted += 1;
        }
        continue;
      }

      if (change.type === "name_change") {
        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            companyName: change.newCompanyName ?? change.companyName ?? existing.companyName,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
          updated += 1;
        }
        continue;
      }

      if (change.type === "symbol_change") {
        const nextSymbol = change.newSymbol?.trim().toUpperCase();
        if (!nextSymbol) {
          continue;
        }

        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            listingStatus: "delisted",
            isSupported: false,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
        }

        this.tickerRegistry.set(nextSymbol, {
          symbol: nextSymbol,
          companyName:
            change.newCompanyName ??
            change.companyName ??
            existing?.companyName ??
            nextSymbol,
          exchange: change.exchange ?? existing?.exchange ?? "NASDAQ",
          listingStatus: "active",
          isSupported: true,
          sourceFeed: change.sourceFeed,
          sourceUpdatedAt: change.sourceUpdatedAt,
          lastSyncedAt: input.syncedAt,
          rawPayload: change.rawPayload ?? {}
        });
        renamed += 1;
      }
    }

    return {
      added,
      deleted,
      updated,
      renamed
    };
  }

  async appendAuditEvent(input: AuditEventRecord): Promise<void> {
    this.auditEvents.push(input);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

export class PostgresStore implements ProductStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl
    });
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | undefined> {
    try {
      const result = await this.pool.query(
        `insert into users (id, email, password_hash, created_at)
         values ($1, $2, $3, $4)
         returning *`,
        [randomUUID(), input.email.toLowerCase(), input.passwordHash, new Date().toISOString()]
      );
      return mapUser(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query("select * from users where email = $1", [
      email.toLowerCase()
    ]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query("select * from users where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async findUserByGoogleSubject(googleSubject: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      `select u.*
         from user_google_identities g
         join users u on u.id = g.user_id
        where g.google_subject = $1
        limit 1`,
      [googleSubject.trim()]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async getGoogleIdentityByUserId(userId: string): Promise<GoogleIdentityRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from user_google_identities
        where user_id = $1
        limit 1`,
      [userId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapGoogleIdentity(row) : undefined;
  }

  async attachGoogleIdentity(input: {
    userId: string;
    googleSubject: string;
    email: string;
    linkedAt: string;
  }): Promise<GoogleIdentityAttachResult> {
    const normalizedSubject = input.googleSubject.trim();
    const normalizedEmail = input.email.trim().toLowerCase();

    const subjectResult = await this.pool.query(
      `select *
         from user_google_identities
        where google_subject = $1
        limit 1`,
      [normalizedSubject]
    );
    const subjectRow = subjectResult.rows[0] as Record<string, unknown> | undefined;
    if (subjectRow) {
      const subjectIdentity = mapGoogleIdentity(subjectRow);
      if (subjectIdentity.userId !== input.userId) {
        return "subject_in_use";
      }
    }

    const userResult = await this.pool.query(
      `select *
         from user_google_identities
        where user_id = $1
        limit 1`,
      [input.userId]
    );
    const userRow = userResult.rows[0] as Record<string, unknown> | undefined;
    if (userRow) {
      const userIdentity = mapGoogleIdentity(userRow);
      if (userIdentity.googleSubject !== normalizedSubject) {
        return "user_already_linked";
      }
      await this.pool.query(
        `update user_google_identities
            set email = $2,
                updated_at = $3
          where user_id = $1`,
        [input.userId, normalizedEmail, input.linkedAt]
      );
      return "already_linked_to_user";
    }

    try {
      await this.pool.query(
        `insert into user_google_identities (
           user_id,
           google_subject,
           email,
           linked_at,
           updated_at
         ) values ($1, $2, $3, $4, $4)`,
        [input.userId, normalizedSubject, normalizedEmail, input.linkedAt]
      );
      return "linked";
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return "subject_in_use";
      }
      throw error;
    }
  }

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set verified_at = $2 where id = $1 returning *",
      [userId, verifiedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async recordFailedLoginAttempt(input: {
    userId: string;
    attemptedAt: string;
    windowSeconds: number;
    maxFailures: number;
    lockoutDurationSeconds: number;
  }): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      `with next_state as (
         select
           id,
           case
             when failed_login_window_started_at is null
               or failed_login_window_started_at <= ($2::timestamptz - ($3 * interval '1 second'))
             then 1
             else failed_login_attempts + 1
           end as next_attempts,
           case
             when failed_login_window_started_at is null
               or failed_login_window_started_at <= ($2::timestamptz - ($3 * interval '1 second'))
             then $2::timestamptz
             else failed_login_window_started_at
           end as next_window_started_at
         from users
         where id = $1
       )
       update users u
          set failed_login_attempts = s.next_attempts,
              failed_login_window_started_at = s.next_window_started_at,
              locked_until = case
                when s.next_attempts >= $4
                then $2::timestamptz + ($5 * interval '1 second')
                else null
              end
         from next_state s
        where u.id = s.id
      returning u.*`,
      [
        input.userId,
        input.attemptedAt,
        input.windowSeconds,
        input.maxFailures,
        input.lockoutDurationSeconds
      ]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async clearFailedLoginAttempts(userId: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      `update users
          set failed_login_attempts = 0,
              failed_login_window_started_at = null,
              locked_until = null
        where id = $1
      returning *`,
      [userId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async updateUserPasswordHash(
    userId: string,
    passwordHash: string
  ): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set password_hash = $2 where id = $1 returning *",
      [userId, passwordHash]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined> {
    const user = await this.findUserById(userId);
    if (!user) {
      return undefined;
    }

    const nowIso = new Date().toISOString();
    if (!deviceToken || deviceToken.trim().length === 0) {
      await this.invalidateUserDevicesByUser({
        userId,
        invalidatedAt: nowIso,
        reason: "legacy_unset"
      });
      await this.pool.query("update users set device_token = null where id = $1", [userId]);
      return this.findUserById(userId);
    }

    const normalizedToken = deviceToken.trim();
    await this.upsertUserDevice({
      userId,
      installationId: `legacy:${userId}`,
      deviceToken: normalizedToken,
      platform: "android",
      updatedAt: nowIso
    });
    const result = await this.pool.query(
      "update users set device_token = $2 where id = $1 returning *",
      [userId, normalizedToken]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const result = await this.pool.query(
      `select user_id, device_token
         from user_devices
        where invalidated_at is null
          and length(trim(device_token)) > 0`
    );
    return result.rows.map((row) => ({
      userId: String(row.user_id),
      deviceToken: String(row.device_token)
    }));
  }

  async upsertUserDevice(input: {
    userId: string;
    installationId: string;
    deviceToken: string;
    platform: string;
    updatedAt: string;
  }): Promise<UserDeviceRecord | undefined> {
    const normalizedInstallation = input.installationId.trim();
    const normalizedToken = input.deviceToken.trim();
    if (normalizedInstallation.length === 0 || normalizedToken.length === 0) {
      return undefined;
    }

    const user = await this.findUserById(input.userId);
    if (!user) {
      return undefined;
    }

    await this.pool.query(
      `update user_devices
          set invalidated_at = $2,
              invalidation_reason = 'token_rotated',
              updated_at = $2
        where device_token = $1
          and invalidated_at is null
          and not (user_id = $3 and installation_id = $4)`,
      [normalizedToken, input.updatedAt, input.userId, normalizedInstallation]
    );

    const result = await this.pool.query(
      `insert into user_devices (
         id,
         user_id,
         installation_id,
         device_token,
         platform,
         last_seen_at,
         created_at,
         updated_at,
         invalidated_at,
         invalidation_reason
       )
       values ($1, $2, $3, $4, $5, $6, $6, $6, null, null)
       on conflict (user_id, installation_id) do update set
         device_token = excluded.device_token,
         platform = excluded.platform,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at,
         invalidated_at = null,
         invalidation_reason = null
       returning *`,
      [
        randomUUID(),
        input.userId,
        normalizedInstallation,
        normalizedToken,
        input.platform.trim().toLowerCase() || "android",
        input.updatedAt
      ]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUserDevice(row) : undefined;
  }

  async invalidateUserDeviceByInstallation(input: {
    userId: string;
    installationId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<boolean> {
    const result = await this.pool.query(
      `update user_devices
          set invalidated_at = $3,
              invalidation_reason = $4,
              updated_at = $3
        where user_id = $1
          and installation_id = $2
          and invalidated_at is null`,
      [input.userId, input.installationId.trim(), input.invalidatedAt, input.reason]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async invalidateUserDevicesByUser(input: {
    userId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number> {
    const result = await this.pool.query(
      `update user_devices
          set invalidated_at = $2,
              invalidation_reason = $3,
              updated_at = $2
        where user_id = $1
          and invalidated_at is null`,
      [input.userId, input.invalidatedAt, input.reason]
    );
    return result.rowCount ?? 0;
  }

  async invalidateUserDeviceByToken(input: {
    deviceToken: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<number> {
    const result = await this.pool.query(
      `update user_devices
          set invalidated_at = $2,
              invalidation_reason = $3,
              updated_at = $2
        where device_token = $1
          and invalidated_at is null`,
      [input.deviceToken.trim(), input.invalidatedAt, input.reason]
    );
    return result.rowCount ?? 0;
  }

  async getUserSubscription(userId: string): Promise<UserSubscriptionRecord> {
    await this.pool.query(
      `insert into subscriptions (user_id, tier, updated_at)
       values ($1, 'FREE', $2)
       on conflict (user_id) do nothing`,
      [userId, new Date().toISOString()]
    );

    const result = await this.pool.query(
      `select *
         from subscriptions
        where user_id = $1
        limit 1`,
      [userId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return {
        userId,
        tier: "FREE",
        updatedAt: new Date().toISOString()
      };
    }
    return mapSubscription(row);
  }

  async findUserIdByRevenuecatAppUserId(revenuecatAppUserId: string): Promise<string | undefined> {
    const result = await this.pool.query(
      `select user_id
         from subscriptions
        where revenuecat_app_user_id = $1
        limit 1`,
      [revenuecatAppUserId.trim()]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row?.user_id ? String(row.user_id) : undefined;
  }

  async upsertUserSubscription(input: {
    userId: string;
    tier: SubscriptionTier;
    revenuecatAppUserId?: string;
    billingPeriodEnd?: string;
    updatedAt: string;
  }): Promise<UserSubscriptionRecord> {
    const result = await this.pool.query(
      `insert into subscriptions (
         user_id,
         tier,
         revenuecat_app_user_id,
         billing_period_end,
         updated_at,
         created_at
       )
       values ($1, $2, $3, $4, $5, $5)
       on conflict (user_id) do update set
         tier = excluded.tier,
         revenuecat_app_user_id = coalesce(excluded.revenuecat_app_user_id, subscriptions.revenuecat_app_user_id),
         billing_period_end = excluded.billing_period_end,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.userId,
        input.tier,
        input.revenuecatAppUserId?.trim() || null,
        input.billingPeriodEnd ?? null,
        input.updatedAt
      ]
    );
    return mapSubscription(result.rows[0] as Record<string, unknown>);
  }

  async getDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    const result = await this.pool.query(
      `select request_count
         from deep_dive_daily_usage
        where user_id = $1
          and usage_date = $2::date
        limit 1`,
      [userId, usageDate]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row?.request_count ? Number(row.request_count) : 0;
  }

  async reserveDailyDeepDiveUsage(
    userId: string,
    usageDate: string,
    limit: number
  ): Promise<{ allowed: boolean; requestCount: number }> {
    const nowIso = new Date().toISOString();
    const result = await this.pool.query(
      `insert into deep_dive_daily_usage (user_id, usage_date, request_count, created_at, updated_at)
       values ($1, $2::date, 1, $4, $4)
       on conflict (user_id, usage_date) do update set
         request_count = deep_dive_daily_usage.request_count + 1,
         updated_at = excluded.updated_at
       where deep_dive_daily_usage.request_count < $3
       returning request_count`,
      [userId, usageDate, limit, nowIso]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row?.request_count) {
      const requestCount = await this.getDailyDeepDiveUsage(userId, usageDate);
      return {
        allowed: false,
        requestCount
      };
    }

    return {
      allowed: true,
      requestCount: Number(row.request_count)
    };
  }

  async releaseDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.pool.query(
      `update deep_dive_daily_usage
          set request_count = greatest(request_count - 1, 0),
              updated_at = $3
        where user_id = $1
          and usage_date = $2::date
      returning request_count`,
      [userId, usageDate, nowIso]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row?.request_count ? Number(row.request_count) : 0;
  }

  async incrementDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.pool.query(
      `insert into deep_dive_daily_usage (user_id, usage_date, request_count, created_at, updated_at)
       values ($1, $2::date, 1, $3, $3)
       on conflict (user_id, usage_date) do update set
         request_count = deep_dive_daily_usage.request_count + 1,
         updated_at = excluded.updated_at
       returning request_count`,
      [userId, usageDate, nowIso]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row?.request_count ? Number(row.request_count) : 1;
  }

  async createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord> {
    const result = await this.pool.query(
      `insert into verification_tokens (id, user_id, token_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [input.id, input.userId, input.tokenHash, input.createdAt, input.expiresAt]
    );
    return mapVerificationToken(result.rows[0] as Record<string, unknown>);
  }

  async consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined> {
    const result = await this.pool.query(
      `update verification_tokens
         set consumed_at = $2
       where token_hash = $1
         and consumed_at is null
         and expires_at > now()
       returning *`,
      [tokenHash, consumedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapVerificationToken(row) : undefined;
  }

  async createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
    familyId?: string;
    parentSessionId?: string;
  }): Promise<SessionRecord> {
    const result = await this.pool.query(
      `insert into sessions (
         id,
         user_id,
         created_at,
         expires_at,
         family_id,
         parent_session_id
       )
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        input.id,
        input.userId,
        input.createdAt,
        input.expiresAt,
        input.familyId ?? input.id,
        input.parentSessionId ?? null
      ]
    );
    return mapSession(result.rows[0] as Record<string, unknown>);
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query("select * from sessions where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
  }

  async revokeSession(
    sessionId: string,
    revokedAt: string,
    options?: {
      reason?: string;
      replacedBySessionId?: string;
    }
  ): Promise<SessionRecord | undefined> {
    const result = await this.pool.query(
      `update sessions
         set revoked_at = coalesce(revoked_at, $2),
             revoked_reason = coalesce(revoked_reason, $3),
             replaced_by_session_id = coalesce(replaced_by_session_id, $4)
       where id = $1
       returning *`,
      [sessionId, revokedAt, options?.reason ?? null, options?.replacedBySessionId ?? null]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
  }

  async revokeSessionFamily(input: {
    familyId: string;
    revokedAt: string;
    reason: string;
  }): Promise<number> {
    const result = await this.pool.query(
      `update sessions
          set revoked_at = coalesce(revoked_at, $2),
              revoked_reason = coalesce(revoked_reason, $3)
        where family_id = $1
          and revoked_at is null`,
      [input.familyId, input.revokedAt, input.reason]
    );
    return result.rowCount ?? 0;
  }

  async createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const result = await this.pool.query(
      `insert into jobs (id, type, status, user_id, ticker, cycle_start, cycle_end, created_at)
       values ($1, $2, 'queued', $3, $4, $5, $6, $7)
       returning *`,
      [
        input.id,
        input.type,
        input.userId ?? null,
        input.ticker ?? null,
        input.cycleStart ?? null,
        input.cycleEnd ?? null,
        input.createdAt
      ]
    );
    return mapJob(result.rows[0] as Record<string, unknown>);
  }

  async findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from jobs
        where type = $1
          and cycle_start = $2::timestamptz
        order by created_at desc
        limit 1`,
      [type, cycleStart]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    const result = await this.pool.query("select * from jobs where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async listRecoverableQueuedDeepDiveJobs(
    createdBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const result = await this.pool.query(
      `select *
         from jobs
        where type = 'deep_dive'
          and status = 'queued'
          and created_at <= $1::timestamptz
        order by created_at asc
        limit $2`,
      [createdBeforeIso, limit]
    );
    return result.rows.map((row) => mapJob(row as Record<string, unknown>));
  }

  async listTimedOutRunningDeepDiveJobs(
    startedBeforeIso: string,
    limit: number
  ): Promise<JobRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const result = await this.pool.query(
      `select *
         from jobs
        where type = 'deep_dive'
          and status = 'running'
          and coalesce(started_at, created_at) <= $1::timestamptz
        order by coalesce(started_at, created_at) asc
        limit $2`,
      [startedBeforeIso, limit]
    );
    return result.rows.map((row) => mapJob(row as Record<string, unknown>));
  }

  async markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'running',
             started_at = coalesce(started_at, $2),
             error_message = null
       where id = $1
         and status = 'queued'
       returning *`,
      [id, startedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'failed',
             started_at = coalesce(started_at, $2),
             completed_at = $2,
             error_message = $3
       where id = $1
       returning *`,
      [id, failedAt, errorMessage]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'complete',
             started_at = coalesce(started_at, $2),
             completed_at = $2,
             error_message = null,
             report_id = $3
       where id = $1
         and status in ('queued', 'running')
       returning *`,
      [id, completedAt, reportId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async createReport(input: ReportRecord): Promise<ReportRecord> {
    const result = await this.pool.query(
      `insert into reports (
         id, job_id, type, ticker, schema_version, artifact_key, fingerprint, freshness_expires_at, created_at, is_current
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.id,
        input.jobId,
        input.type,
        input.ticker ?? null,
        input.schemaVersion,
        input.artifactKey,
        input.fingerprint ?? null,
        input.freshnessExpiresAt ?? null,
        input.createdAt,
        input.isCurrent
      ]
    );
    return mapReport(result.rows[0] as Record<string, unknown>);
  }

  async findReusableDeepDiveReport(input: {
    ticker: string;
    fingerprint: string;
    nowIso: string;
  }): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select r.*
         from reports r
        where r.type = 'deep_dive'
          and r.ticker = $1
          and r.fingerprint = $2
          and r.freshness_expires_at > $3::timestamptz
          and exists (
            select 1
              from jobs j
             where j.report_id = r.id
               and j.status = 'complete'
          )
        order by r.created_at desc
        limit 1`,
      [input.ticker, input.fingerprint, input.nowIso]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async findLatestComparableDeepDiveReport(input: {
    ticker: string;
    schemaMajor: number;
    sinceIso: string;
  }): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select r.*
         from reports r
        where r.type = 'deep_dive'
          and r.ticker = $1
          and split_part(r.schema_version, '.', 1) = $2
          and r.created_at >= $3::timestamptz
          and exists (
            select 1
              from jobs j
             where j.report_id = r.id
               and j.status = 'complete'
          )
        order by r.created_at desc
        limit 1`,
      [input.ticker, String(input.schemaMajor), input.sinceIso]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async getReportById(id: string): Promise<ReportRecord | undefined> {
    const result = await this.pool.query("select * from reports where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async hasReportAccessForUser(userId: string, reportId: string): Promise<boolean> {
    const result = await this.pool.query(
      `select 1
         from jobs
        where user_id = $1
          and status = 'complete'
          and report_id = $2
        limit 1`,
      [userId, reportId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteReport(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const deleteResult = await client.query(
        "delete from reports where id = $1 returning job_id",
        [id]
      );
      if ((deleteResult.rowCount ?? 0) === 0) {
        await client.query("rollback");
        return false;
      }

      await client.query("update jobs set report_id = null where report_id = $1", [id]);
      await client.query("commit");
      return true;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    const result = await this.pool.query(
      `select distinct r.*
         from reports r
         join jobs j on j.report_id = r.id
        where j.user_id = $1
          and j.status = 'complete'
        order by r.created_at desc`,
      [userId]
    );
    return result.rows.map((row) => mapReport(row as Record<string, unknown>));
  }

  async getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from reports
        where type = $1
        order by created_at desc
        limit 1`,
      [type]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from reports
        where type = $1
          and (created_at at time zone 'UTC')::date = $2::date
        order by created_at desc
        limit 1`,
      [type, date]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async listHistoricalFinancialSnapshotsByTicker(ticker: string): Promise<CanonicalFinancialSnapshot[]> {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      return [];
    }
    const result = await this.pool.query(
      `select *
         from financial_snapshots
        where ticker = $1
        order by fiscal_year desc, fiscal_quarter desc nulls last, period_type asc`,
      [normalizedTicker]
    );
    return result.rows.map((row) => mapHistoricalFinancialSnapshot(row as Record<string, unknown>));
  }

  async listHistoricalTranscriptsByTicker(ticker: string): Promise<CanonicalTranscript[]> {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      return [];
    }
    const result = await this.pool.query(
      `select *
         from transcripts
        where ticker = $1
        order by fiscal_year desc, fiscal_quarter desc`,
      [normalizedTicker]
    );
    return result.rows.map((row) => mapHistoricalTranscript(row as Record<string, unknown>));
  }

  async getTickerCoverageByTicker(ticker: string): Promise<TickerCoverage | undefined> {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      return undefined;
    }
    const result = await this.pool.query(
      `select *
         from ticker_coverage
        where ticker = $1`,
      [normalizedTicker]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTickerCoverage(row) : undefined;
  }

  async listTickerCoverageTickers(limit: number): Promise<string[]> {
    const boundedLimit = Math.max(1, limit);
    const result = await this.pool.query(
      `select ticker
         from ticker_coverage
        where last_sync_status in ('success', 'partial')
        order by backfill_tier asc, ticker asc
        limit $1`,
      [boundedLimit]
    );
    return result.rows.map((row) => String(row.ticker).trim().toUpperCase());
  }

  async upsertFearGreedSnapshot(input: {
    snapshot: FearGreedSnapshot;
  }): Promise<{ snapshot: FearGreedSnapshot; created: boolean }> {
    const existing = await this.getFearGreedSnapshotByMarketDate(input.snapshot.market_date);

    await this.pool.query(
      `insert into fear_greed_daily (
         id,
         market_date,
         score,
         label,
         sub_scores,
         missing_inputs,
         calculated_at
       )
       values ($1, $2::date, $3, $4, $5::jsonb, $6::jsonb, $7::timestamptz)
       on conflict (market_date) do update set
         id = excluded.id,
         score = excluded.score,
         label = excluded.label,
         sub_scores = excluded.sub_scores,
         missing_inputs = excluded.missing_inputs,
         calculated_at = excluded.calculated_at`,
      [
        input.snapshot.id,
        input.snapshot.market_date,
        input.snapshot.score,
        input.snapshot.label,
        JSON.stringify(input.snapshot.sub_scores),
        JSON.stringify(input.snapshot.missing_inputs),
        input.snapshot.calculated_at
      ]
    );

    const snapshot = await this.getFearGreedSnapshotByMarketDate(input.snapshot.market_date);
    if (!snapshot) {
      throw new Error("Failed to load stored fear_greed_daily snapshot after upsert");
    }

    return {
      snapshot,
      created: existing === undefined
    };
  }

  async getFearGreedSnapshotByMarketDate(
    marketDate: string
  ): Promise<FearGreedSnapshot | undefined> {
    const result = await this.pool.query(
      `select *
         from fear_greed_daily
        where market_date = $1::date
        limit 1`,
      [marketDate]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapFearGreedSnapshot(row) : undefined;
  }

  async getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined> {
    const result = await this.pool.query(
      `select *
         from fear_greed_daily
        order by market_date desc
        limit 1`
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapFearGreedSnapshot(row) : undefined;
  }

  async listFearGreedHistory(days: number): Promise<FearGreedSnapshot[]> {
    const boundedDays = Math.max(1, days);
    const result = await this.pool.query(
      `select *
         from (
           select *
             from fear_greed_daily
            order by market_date desc
            limit $1
         ) as latest
        order by market_date asc`,
      [boundedDays]
    );
    return result.rows.map((row) => mapFearGreedSnapshot(row as Record<string, unknown>));
  }

  async upsertCanonicalEvents(events: CanonicalEvent[]): Promise<{ upserted: number }> {
    if (events.length === 0) {
      return { upserted: 0 };
    }

    for (const event of events) {
      await this.pool.query(
        `insert into canonical_events (
           id,
           family,
           subject_type,
           subject_id,
           title,
           occurred_at,
           source_state,
           source,
           missing_fields,
           metadata,
           retrieved_at,
           updated_at
         )
         values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::timestamptz, $12::timestamptz)
         on conflict (id) do update set
           family = excluded.family,
           subject_type = excluded.subject_type,
           subject_id = excluded.subject_id,
           title = excluded.title,
           occurred_at = excluded.occurred_at,
           source_state = excluded.source_state,
           source = excluded.source,
           missing_fields = excluded.missing_fields,
           metadata = excluded.metadata,
           retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          event.id,
          event.family,
          event.subject_type,
          event.subject_id,
          event.title,
          event.occurred_at,
          event.source_state,
          JSON.stringify(event.source),
          JSON.stringify(event.missing_fields),
          JSON.stringify(event.metadata),
          event.retrieved_at,
          new Date().toISOString()
        ]
      );
    }

    return { upserted: events.length };
  }

  async listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }): Promise<CanonicalEvent[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (input.subjectType) {
      values.push(input.subjectType);
      conditions.push(`subject_type = $${values.length}`);
    }
    if (input.subjectId) {
      values.push(input.subjectId.trim().toUpperCase());
      conditions.push(`upper(subject_id) = $${values.length}`);
    }
    if (input.family) {
      values.push(input.family);
      conditions.push(`family = $${values.length}`);
    }
    values.push(Math.max(1, input.limit));

    const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const result = await this.pool.query(
      `select *
         from canonical_events
        ${whereClause}
        order by occurred_at desc
        limit $${values.length}`,
      values
    );

    return result.rows.map((row) => mapCanonicalEvent(row as Record<string, unknown>));
  }

  async upsertFirstPartyContextItems(items: FirstPartyContextItem[]): Promise<{ upserted: number }> {
    for (const item of items) {
      await this.pool.query(
        `insert into first_party_context_items (
           context_id,
           ticker,
           event_id,
           source_url,
           source_domain,
           page_type,
           fetch_state,
           rights,
           payload,
           retrieved_at,
           updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::timestamptz, $11::timestamptz)
         on conflict (context_id) do update set
           ticker = excluded.ticker,
           event_id = excluded.event_id,
           source_url = excluded.source_url,
           source_domain = excluded.source_domain,
           page_type = excluded.page_type,
           fetch_state = excluded.fetch_state,
           rights = excluded.rights,
           payload = excluded.payload,
           retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          item.context_id,
          item.ticker.trim().toUpperCase(),
          item.event_id ?? null,
          item.source_url,
          item.source_domain,
          item.page_type,
          item.fetch_state,
          JSON.stringify(item.rights),
          JSON.stringify(item),
          item.retrieved_at,
          new Date().toISOString()
        ]
      );
    }
    return { upserted: items.length };
  }

  async listFirstPartyContextItems(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<FirstPartyContextItem[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input.ticker) {
      values.push(input.ticker.trim().toUpperCase());
      conditions.push(`ticker = $${values.length}`);
    }
    if (input.eventId) {
      values.push(input.eventId);
      conditions.push(`event_id = $${values.length}`);
    }
    values.push(Math.max(1, input.limit));
    const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const result = await this.pool.query(
      `select payload
         from first_party_context_items
        ${whereClause}
        order by retrieved_at desc
        limit $${values.length}`,
      values
    );
    return result.rows.map((row) => mapFirstPartyContextItem(row as Record<string, unknown>));
  }

  async upsertCallArtifacts(artifacts: CallArtifact[]): Promise<{ upserted: number }> {
    for (const artifact of artifacts) {
      await this.pool.query(
        `insert into call_artifacts (
           artifact_id,
           ticker,
           event_id,
           context_id,
           source_url,
           source_domain,
           artifact_type,
           completeness_state,
           rights,
           payload,
           retrieved_at,
           updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::timestamptz, $12::timestamptz)
         on conflict (artifact_id) do update set
           ticker = excluded.ticker,
           event_id = excluded.event_id,
           context_id = excluded.context_id,
           source_url = excluded.source_url,
           source_domain = excluded.source_domain,
           artifact_type = excluded.artifact_type,
           completeness_state = excluded.completeness_state,
           rights = excluded.rights,
           payload = excluded.payload,
           retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          artifact.artifact_id,
          artifact.ticker.trim().toUpperCase(),
          artifact.event_id ?? null,
          artifact.context_id ?? null,
          artifact.source_url,
          artifact.source_domain,
          artifact.artifact_type,
          artifact.completeness_state,
          JSON.stringify(artifact.rights),
          JSON.stringify(artifact),
          artifact.retrieved_at,
          new Date().toISOString()
        ]
      );
    }
    return { upserted: artifacts.length };
  }

  async listCallArtifacts(input: {
    ticker?: string;
    eventId?: string;
    limit: number;
  }): Promise<CallArtifact[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input.ticker) {
      values.push(input.ticker.trim().toUpperCase());
      conditions.push(`ticker = $${values.length}`);
    }
    if (input.eventId) {
      values.push(input.eventId);
      conditions.push(`event_id = $${values.length}`);
    }
    values.push(Math.max(1, input.limit));
    const whereClause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
    const result = await this.pool.query(
      `select payload
         from call_artifacts
        ${whereClause}
        order by retrieved_at desc
        limit $${values.length}`,
      values
    );
    return result.rows.map((row) => mapCallArtifact(row as Record<string, unknown>));
  }

  async upsertCalendarEvents(events: CalendarEventRecord[]): Promise<{ upserted: number }> {
    if (events.length === 0) {
      return { upserted: 0 };
    }

    for (const event of events) {
      await this.pool.query(
        `insert into calendar_events (
           id,
           ticker,
           event_type,
           event_date,
           event_time,
           provider,
           retrieved_at,
           updated_at
         )
         values ($1, $2, $3, $4::date, $5, $6, $7::timestamptz, $8::timestamptz)
         on conflict (ticker, event_type, event_date) do update set
           id = excluded.id,
           event_time = excluded.event_time,
           provider = excluded.provider,
           retrieved_at = excluded.retrieved_at,
           updated_at = excluded.updated_at`,
        [
          event.id,
          event.ticker.trim().toUpperCase(),
          event.eventType,
          event.eventDate,
          event.eventTime ?? null,
          event.provider,
          event.retrievedAt,
          new Date().toISOString()
        ]
      );
    }

    return {
      upserted: events.length
    };
  }

  async listUpcomingCalendarEventsByTickers(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventType;
  }): Promise<CalendarEventRecord[]> {
    const tickers = input.tickers
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker) => ticker.length > 0);
    if (tickers.length === 0) {
      return [];
    }

    const result = await this.pool.query(
      `select *
         from calendar_events
        where ticker = any($1::text[])
          and event_date >= $2::date
          and event_date <= $3::date
          and ($4::text is null or event_type = $4::text)
        order by event_date asc, ticker asc`,
      [tickers, input.fromDate, input.toDate, input.eventType ?? null]
    );

    return result.rows.map((row) => mapCalendarEvent(row as Record<string, unknown>));
  }

  async createContrarianAlertAnchor(
    input: ContrarianAlertAnchorRecord
  ): Promise<ContrarianAlertAnchorRecord> {
    const result = await this.pool.query(
      `insert into contrarian_alert_anchors (
         id,
         user_id,
         ticker,
         report_id,
         signal_value,
         anchor_price,
         anchored_at,
         expires_at,
         is_active,
         updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10::timestamptz)
       returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.reportId ?? null,
        input.signalValue,
        input.anchorPrice,
        input.anchoredAt,
        input.expiresAt,
        input.isActive,
        new Date().toISOString()
      ]
    );
    return mapContrarianAnchor(result.rows[0] as Record<string, unknown>);
  }

  async listActiveContrarianAlertAnchors(asOfIso: string): Promise<ContrarianAlertAnchorRecord[]> {
    const result = await this.pool.query(
      `select *
         from contrarian_alert_anchors
        where is_active = true
          and expires_at >= $1::timestamptz
        order by anchored_at asc`,
      [asOfIso]
    );
    return result.rows.map((row) => mapContrarianAnchor(row as Record<string, unknown>));
  }

  async deactivateContrarianAlertAnchor(
    id: string,
    updatedAt: string
  ): Promise<ContrarianAlertAnchorRecord | undefined> {
    const result = await this.pool.query(
      `update contrarian_alert_anchors
          set is_active = false,
              updated_at = $2::timestamptz
        where id = $1
        returning *`,
      [id, updatedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapContrarianAnchor(row) : undefined;
  }

  async deactivateExpiredContrarianAlertAnchors(asOfIso: string): Promise<number> {
    const result = await this.pool.query(
      `update contrarian_alert_anchors
          set is_active = false,
              updated_at = $2::timestamptz
        where is_active = true
          and expires_at < $1::timestamptz`,
      [asOfIso, asOfIso]
    );
    return result.rowCount ?? 0;
  }

  async createKillSwitchRule(input: KillSwitchRuleRecord): Promise<KillSwitchRuleRecord> {
    const result = await this.pool.query(
      `insert into kill_switch_rules (
         id,
         user_id,
         ticker,
         report_id,
         signal_value,
         anchor_price,
         condition_id,
         condition_text,
         signal_type,
         rationale,
         threshold_value,
         threshold_unit,
         direction,
         prompt_version,
         state,
         source,
         created_at,
         updated_at,
         deactivated_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17::timestamptz,
         $18::timestamptz,
         $19::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.reportId ?? null,
        input.signalValue ?? null,
        input.anchorPrice ?? null,
        input.conditionId,
        input.conditionText,
        input.signalType,
        input.rationale,
        input.thresholdValue ?? null,
        input.thresholdUnit ?? null,
        input.direction ?? null,
        input.promptVersion,
        input.state,
        input.source,
        input.createdAt,
        input.updatedAt,
        input.deactivatedAt ?? null
      ]
    );
    return mapKillSwitchRule(result.rows[0] as Record<string, unknown>);
  }

  async deactivateActiveKillSwitchRulesByUserTicker(input: {
    userId: string;
    ticker: string;
    deactivatedAt: string;
  }): Promise<number> {
    const result = await this.pool.query(
      `update kill_switch_rules
          set state = 'inactive',
              deactivated_at = $3::timestamptz,
              updated_at = $3::timestamptz
        where user_id = $1
          and ticker = $2
          and state = 'active'`,
      [input.userId, input.ticker.trim().toUpperCase(), input.deactivatedAt]
    );
    return result.rowCount ?? 0;
  }

  async listActiveKillSwitchRules(input: {
    asOfIso: string;
    userIds?: string[];
  }): Promise<KillSwitchRuleRecord[]> {
    const userIds = input.userIds?.filter((entry) => entry.trim().length > 0) ?? [];
    const result = await this.pool.query(
      `select *
         from kill_switch_rules
        where state = 'active'
          and (deactivated_at is null or deactivated_at > $1::timestamptz)
          and (
            array_length($2::text[], 1) is null
            or user_id = any($2::text[])
          )
        order by created_at asc`,
      [input.asOfIso, userIds.length > 0 ? userIds : null]
    );
    return result.rows.map((row) => mapKillSwitchRule(row as Record<string, unknown>));
  }

  async getKillSwitchEvaluation(input: {
    ruleId: string;
    signalSource: KillSwitchEvaluationSignalSource;
    triggerKey: string;
  }): Promise<KillSwitchEvaluationRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from kill_switch_evaluations
        where rule_id = $1
          and signal_source = $2
          and trigger_key = $3
        limit 1`,
      [input.ruleId, input.signalSource, input.triggerKey]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapKillSwitchEvaluation(row) : undefined;
  }

  async listKillSwitchEvaluations(input: {
    userId: string;
    ticker?: string;
    outcomes?: KillSwitchEvaluationOutcome[];
    sinceIso?: string;
    limit?: number;
  }): Promise<KillSwitchEvaluationRecord[]> {
    const outcomes = (input.outcomes ?? []).filter((value) => typeof value === "string");
    const limit = Math.max(1, input.limit ?? 500);
    const result = await this.pool.query(
      `select *
         from kill_switch_evaluations
        where user_id = $1
          and ($2::text is null or ticker = $2::text)
          and (array_length($3::text[], 1) is null or outcome = any($3::text[]))
          and ($4::timestamptz is null or created_at >= $4::timestamptz)
        order by created_at desc
        limit $5`,
      [
        input.userId,
        input.ticker?.trim().toUpperCase() ?? null,
        outcomes.length > 0 ? outcomes : null,
        input.sinceIso ?? null,
        limit
      ]
    );
    return result.rows.map((row) => mapKillSwitchEvaluation(row as Record<string, unknown>));
  }

  async createKillSwitchEvaluation(
    input: KillSwitchEvaluationRecord
  ): Promise<KillSwitchEvaluationRecord> {
    const result = await this.pool.query(
      `insert into kill_switch_evaluations (
         id,
         rule_id,
         user_id,
         ticker,
         signal_source,
         trigger_key,
         outcome,
         reason_code,
         reason_text,
         observed_value,
         alert_id,
         created_at,
         updated_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12::timestamptz,
         $13::timestamptz
       )
       on conflict (rule_id, signal_source, trigger_key) do update set
         outcome = excluded.outcome,
         reason_code = excluded.reason_code,
         reason_text = excluded.reason_text,
         observed_value = excluded.observed_value,
         alert_id = excluded.alert_id,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.id,
        input.ruleId,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.signalSource,
        input.triggerKey,
        input.outcome,
        input.reasonCode,
        input.reasonText,
        input.observedValue ?? null,
        input.alertId ?? null,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapKillSwitchEvaluation(result.rows[0] as Record<string, unknown>);
  }

  async upsertNameRelationship(
    input: NameRelationshipRecord
  ): Promise<NameRelationshipRecord> {
    const result = await this.pool.query(
      `insert into name_relationships (
         relationship_id,
         user_id,
         source_ticker,
         target_ticker,
         relationship_type,
         confidence,
         state,
         source_report_id,
         prompt_version,
         evidence_text,
         rationale,
         created_at,
         updated_at,
         suppressed_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         $12::timestamptz,
         $13::timestamptz,
         $14::timestamptz
       )
       on conflict (relationship_id) do update set
         user_id = excluded.user_id,
         source_ticker = excluded.source_ticker,
         target_ticker = excluded.target_ticker,
         relationship_type = excluded.relationship_type,
         confidence = excluded.confidence,
         state = excluded.state,
         source_report_id = excluded.source_report_id,
         prompt_version = excluded.prompt_version,
         evidence_text = excluded.evidence_text,
         rationale = excluded.rationale,
         updated_at = excluded.updated_at,
         suppressed_at = excluded.suppressed_at
       returning *`,
      [
        input.relationshipId,
        input.userId,
        input.sourceTicker.trim().toUpperCase(),
        input.targetTicker.trim().toUpperCase(),
        input.relationshipType,
        input.confidence,
        input.state,
        input.sourceReportId,
        input.promptVersion,
        input.evidenceText,
        input.rationale,
        input.createdAt,
        input.updatedAt,
        input.suppressedAt ?? null
      ]
    );
    return mapNameRelationship(result.rows[0] as Record<string, unknown>);
  }

  async getNameRelationship(
    relationshipId: string
  ): Promise<NameRelationshipRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from name_relationships
        where relationship_id = $1
        limit 1`,
      [relationshipId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapNameRelationship(row) : undefined;
  }

  async listNameRelationshipsByUser(input: {
    userId: string;
    sourceTicker?: string;
    targetTicker?: string;
    states?: NameRelationshipState[];
    minConfidence?: number;
    limit: number;
  }): Promise<NameRelationshipRecord[]> {
    const states = input.states?.filter((state) => typeof state === "string") ?? [];
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence ?? 0));
    const result = await this.pool.query(
      `select *
         from name_relationships
        where user_id = $1
          and ($2::text is null or source_ticker = $2::text)
          and ($3::text is null or target_ticker = $3::text)
          and (array_length($4::text[], 1) is null or state = any($4::text[]))
          and confidence >= $5
        order by updated_at desc
        limit $6`,
      [
        input.userId,
        input.sourceTicker?.trim().toUpperCase() ?? null,
        input.targetTicker?.trim().toUpperCase() ?? null,
        states.length > 0 ? states : null,
        minConfidence,
        Math.max(1, input.limit)
      ]
    );
    return result.rows.map((row) => mapNameRelationship(row as Record<string, unknown>));
  }

  async listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }): Promise<NameRelationshipRecord[]> {
    const relationshipTypes =
      input.relationshipTypes?.filter((type) => typeof type === "string") ?? [];
    const minConfidence = Math.max(0, Math.min(1, input.minConfidence));
    const result = await this.pool.query(
      `select *
         from name_relationships
        where state = 'active'
          and source_ticker = $1
          and (array_length($2::text[], 1) is null or relationship_type = any($2::text[]))
          and confidence >= $3
        order by confidence desc, updated_at asc`,
      [
        input.sourceTicker.trim().toUpperCase(),
        relationshipTypes.length > 0 ? relationshipTypes : null,
        minConfidence
      ]
    );
    return result.rows.map((row) => mapNameRelationship(row as Record<string, unknown>));
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord[]> {
    const result = await this.pool.query(
      `select *
         from notification_preferences
        where user_id = $1`,
      [userId]
    );

    const existing = new Map<NotificationType, NotificationPreferenceRecord>();
    for (const row of result.rows) {
      const preference = mapNotificationPreference(row as Record<string, unknown>);
      existing.set(preference.type, preference);
    }

    const now = new Date().toISOString();
    const merged: NotificationPreferenceRecord[] = [];
    for (const type of defaultNotificationTypeList) {
      const current = existing.get(type);
      if (current) {
        merged.push(current);
      } else {
        merged.push({
          userId,
          type,
          enabled: true,
          updatedAt: now
        });
      }
    }

    return merged;
  }

  async getReportNote(
    reportId: string,
    userId: string
  ): Promise<ReportNoteRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from report_notes
        where report_id = $1
          and user_id = $2`,
      [reportId, userId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReportNote(row) : undefined;
  }

  async upsertReportNote(input: {
    reportId: string;
    userId: string;
    content: string;
    updatedAt: string;
  }): Promise<ReportNoteRecord> {
    const result = await this.pool.query(
      `insert into report_notes (report_id, user_id, content, updated_at)
       values ($1, $2, $3, $4::timestamptz)
       on conflict (report_id, user_id) do update set
         content = excluded.content,
         updated_at = excluded.updated_at
       returning *`,
      [input.reportId, input.userId, input.content, input.updatedAt]
    );
    return mapReportNote(result.rows[0] as Record<string, unknown>);
  }

  async enqueueUserFeedback(input: {
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
    metadata?: Record<string, unknown>;
    triageStatus: FeedbackTriageStatus;
    routeStatus: FeedbackRouteStatus;
    triageOwner?: string;
    triagedAt?: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<UserFeedbackQueueRecord> {
    const result = await this.pool.query(
      `insert into user_feedback_queue (
         id,
         user_id,
         feedback_type,
         code,
         severity,
         source_surface,
         user_tier,
         report_id,
         ticker,
         message,
         metadata,
         triage_status,
         route_status,
         triage_owner,
         triaged_at,
         created_at,
         updated_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11::jsonb, $12, $13, $14, $15::timestamptz,
         $16::timestamptz, $17::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.feedbackType,
        input.code,
        input.severity,
        input.sourceSurface,
        input.userTier,
        input.reportId ?? null,
        input.ticker?.trim().toUpperCase() ?? null,
        input.message,
        JSON.stringify(input.metadata ?? {}),
        input.triageStatus,
        input.routeStatus,
        input.triageOwner ?? null,
        input.triagedAt ?? null,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapUserFeedbackQueueRecord(result.rows[0] as Record<string, unknown>);
  }

  async listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: FeedbackTriageStatus;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }): Promise<UserFeedbackQueueRecord[]> {
    const result = await this.pool.query(
      `select *
         from user_feedback_queue
        where ($1::text is null or feedback_type = $1::text)
          and ($2::text is null or triage_status = $2::text)
          and ($3::text is null or user_tier = $3::text)
          and ($4::text is null or source_surface = $4::text)
        order by created_at desc
        limit $5`,
      [
        input.feedbackType ?? null,
        input.triageStatus ?? null,
        input.userTier ?? null,
        input.sourceSurface ?? null,
        Math.max(1, input.limit)
      ]
    );
    return result.rows.map((row) => mapUserFeedbackQueueRecord(row as Record<string, unknown>));
  }

  async upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{
      type: NotificationType;
      enabled?: boolean;
      quietUntil?: string | null;
    }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]> {
    if (input.preferences.length === 0) {
      return this.getNotificationPreferences(input.userId);
    }

    for (const preference of input.preferences) {
      const enabledProvided = typeof preference.enabled === "boolean";
      const quietUntilProvided = preference.quietUntil !== undefined || enabledProvided;
      const quietUntilValue =
        preference.quietUntil !== undefined
          ? preference.quietUntil
          : enabledProvided
            ? null
            : undefined;
      await this.pool.query(
        `insert into notification_preferences (
           id,
           user_id,
           notification_type,
           enabled,
           quiet_until,
           updated_at,
           created_at
          )
         values ($1, $2, $3, coalesce($4::boolean, true), $5::timestamptz, $6::timestamptz, $6::timestamptz)
         on conflict (user_id, notification_type) do update set
           enabled = case
             when $7::boolean then coalesce($4::boolean, notification_preferences.enabled)
             else notification_preferences.enabled
           end,
           quiet_until = case
             when $8::boolean then $5::timestamptz
             else notification_preferences.quiet_until
           end,
           updated_at = $6::timestamptz`,
        [
          randomUUID(),
          input.userId,
          preference.type,
          enabledProvided ? preference.enabled ?? null : null,
          quietUntilValue ?? null,
          input.updatedAt,
          enabledProvided,
          quietUntilProvided
        ]
      );
    }

    return this.getNotificationPreferences(input.userId);
  }

  async createAlertLedgerItem(input: AlertLedgerRecord): Promise<AlertLedgerRecord> {
    const result = await this.pool.query(
      `insert into alert_ledger (
         id,
         user_id,
         notification_type,
         category,
         route,
         title,
         body,
         reason_code,
         reason_text,
         delivery_state,
         feedback_state,
         muted_at,
         context,
         created_at,
         updated_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12::timestamptz, $13::jsonb, $14::timestamptz, $15::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.notificationType,
        input.category,
        input.route,
        input.title,
        input.body,
        input.reasonCode,
        input.reasonText,
        input.deliveryState,
        input.feedbackState ?? null,
        input.mutedAt ?? null,
        JSON.stringify(input.context ?? {}),
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapAlertLedgerRecord(result.rows[0] as Record<string, unknown>);
  }

  async getAlertLedgerItem(input: {
    id: string;
    userId: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from alert_ledger
        where id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId]
    );
    const row = result.rows[0];
    return row ? mapAlertLedgerRecord(row as Record<string, unknown>) : undefined;
  }

  async listAlertLedgerItemsByUser(input: {
    userId: string;
    limit: number;
    category?: AlertLedgerCategory;
  }): Promise<AlertLedgerRecord[]> {
    const result = await this.pool.query(
      `select *
         from alert_ledger
        where user_id = $1
          and ($2::text is null or category = $2::text)
        order by created_at desc
        limit $3`,
      [input.userId, input.category ?? null, Math.max(1, input.limit)]
    );
    return result.rows.map((row) => mapAlertLedgerRecord(row as Record<string, unknown>));
  }

  async setAlertLedgerFeedback(input: {
    id: string;
    userId: string;
    feedback: AlertFeedbackState;
    updatedAt: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const result = await this.pool.query(
      `update alert_ledger
          set feedback_state = $3,
              updated_at = $4::timestamptz
        where id = $1
          and user_id = $2
        returning *`,
      [input.id, input.userId, input.feedback, input.updatedAt]
    );
    const row = result.rows[0];
    return row ? mapAlertLedgerRecord(row as Record<string, unknown>) : undefined;
  }

  async markAlertLedgerMuted(input: {
    id: string;
    userId: string;
    mutedAt: string;
  }): Promise<AlertLedgerRecord | undefined> {
    const result = await this.pool.query(
      `update alert_ledger
          set muted_at = $3::timestamptz,
              updated_at = $3::timestamptz
        where id = $1
          and user_id = $2
        returning *`,
      [input.id, input.userId, input.mutedAt]
    );
    const row = result.rows[0];
    return row ? mapAlertLedgerRecord(row as Record<string, unknown>) : undefined;
  }

  async upsertConvictionJournalEntry(
    input: ConvictionJournalEntryRecord
  ): Promise<ConvictionJournalEntryRecord> {
    const result = await this.pool.query(
      `insert into conviction_journal_entries (
         journal_entry_id,
         user_id,
         ticker,
         event_type,
         source_type,
         source_id,
         event_at,
         title,
         summary,
         thesis_snapshot,
         evidence_refs,
         report_id,
         alert_ledger_id,
         war_room_id,
         monitor_snapshot_key,
         opposite_case_id,
         created_at,
         updated_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7::timestamptz,
         $8,
         $9,
         $10::jsonb,
         $11::jsonb,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17::timestamptz,
         $18::timestamptz
       )
       on conflict (user_id, event_type, source_type, source_id) do update set
         ticker = excluded.ticker,
         event_at = excluded.event_at,
         title = excluded.title,
         summary = excluded.summary,
         thesis_snapshot = excluded.thesis_snapshot,
         evidence_refs = excluded.evidence_refs,
         report_id = excluded.report_id,
         alert_ledger_id = excluded.alert_ledger_id,
         war_room_id = excluded.war_room_id,
         monitor_snapshot_key = excluded.monitor_snapshot_key,
         opposite_case_id = excluded.opposite_case_id,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.eventType,
        input.sourceType,
        input.sourceId,
        input.eventAt,
        input.title,
        input.summary,
        JSON.stringify(input.thesisSnapshot),
        JSON.stringify(input.evidenceRefs),
        input.reportId ?? null,
        input.alertLedgerId ?? null,
        input.warRoomId ?? null,
        input.monitorSnapshotKey ?? null,
        input.oppositeCaseId ?? null,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapConvictionJournalEntryRecord(result.rows[0] as Record<string, unknown>);
  }

  async listConvictionJournalEntriesByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
  }): Promise<ConvictionJournalEntryRecord[]> {
    const result = await this.pool.query(
      `select *
         from conviction_journal_entries
        where user_id = $1
          and ($2::text is null or ticker = $2::text)
        order by event_at desc, created_at desc
        limit $3`,
      [
        input.userId,
        input.ticker?.trim().toUpperCase() ?? null,
        Math.max(1, input.limit)
      ]
    );
    return result.rows.map((row) =>
      mapConvictionJournalEntryRecord(row as Record<string, unknown>)
    );
  }

  async upsertConvictionInsightCard(
    input: ConvictionInsightCardRecord
  ): Promise<ConvictionInsightCardRecord> {
    const result = await this.pool.query(
      `insert into conviction_insight_cards (
         insight_id,
         user_id,
         period_start,
         period_end,
         insight_type,
         status,
         title,
         summary,
         findings,
         source_journal_entry_ids,
         generated_at,
         created_at,
         updated_at
       )
       values (
         $1,
         $2,
         $3::date,
         $4::date,
         $5,
         $6,
         $7,
         $8,
         $9::jsonb,
         $10::jsonb,
         $11::timestamptz,
         $12::timestamptz,
         $13::timestamptz
       )
       on conflict (user_id, period_start, period_end, insight_type) do update set
         status = excluded.status,
         title = excluded.title,
         summary = excluded.summary,
         findings = excluded.findings,
         source_journal_entry_ids = excluded.source_journal_entry_ids,
         generated_at = excluded.generated_at,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.id,
        input.userId,
        input.periodStart,
        input.periodEnd,
        input.insightType,
        input.status,
        input.title,
        input.summary,
        JSON.stringify(input.findings),
        JSON.stringify(input.sourceJournalEntryIds),
        input.generatedAt,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapConvictionInsightCardRecord(result.rows[0] as Record<string, unknown>);
  }

  async listConvictionInsightCardsByUser(input: {
    userId: string;
    limit: number;
  }): Promise<ConvictionInsightCardRecord[]> {
    const result = await this.pool.query(
      `select *
         from conviction_insight_cards
        where user_id = $1
        order by generated_at desc
        limit $2`,
      [input.userId, Math.max(1, input.limit)]
    );
    return result.rows.map((row) =>
      mapConvictionInsightCardRecord(row as Record<string, unknown>)
    );
  }

  async upsertOppositeCaseReport(
    input: OppositeCaseReportRecord
  ): Promise<OppositeCaseReportRecord> {
    const result = await this.pool.query(
      `insert into opposite_case_reports (
         opposite_case_id,
         user_id,
         source_report_id,
         ticker,
         prompt_version,
         thesis_summary,
         opposite_case_summary,
         key_points,
         shared_evidence_refs,
         decisive_factors,
         generated_at,
         created_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8::jsonb,
         $9::jsonb,
         $10::jsonb,
         $11::timestamptz,
         $12::timestamptz
       )
       on conflict (user_id, source_report_id) do update set
         ticker = excluded.ticker,
         prompt_version = excluded.prompt_version,
         thesis_summary = excluded.thesis_summary,
         opposite_case_summary = excluded.opposite_case_summary,
         key_points = excluded.key_points,
         shared_evidence_refs = excluded.shared_evidence_refs,
         decisive_factors = excluded.decisive_factors,
         generated_at = excluded.generated_at
       returning *`,
      [
        input.id,
        input.userId,
        input.sourceReportId,
        input.ticker.trim().toUpperCase(),
        input.promptVersion,
        input.thesisSummary,
        input.oppositeCaseSummary,
        JSON.stringify(input.keyPoints),
        JSON.stringify(input.sharedEvidenceRefs),
        JSON.stringify(input.decisiveFactors),
        input.generatedAt,
        input.createdAt
      ]
    );
    return mapOppositeCaseReportRecord(result.rows[0] as Record<string, unknown>);
  }

  async getOppositeCaseReportBySource(input: {
    userId: string;
    sourceReportId: string;
  }): Promise<OppositeCaseReportRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from opposite_case_reports
        where user_id = $1
          and source_report_id = $2
        limit 1`,
      [input.userId, input.sourceReportId]
    );
    const row = result.rows[0];
    return row ? mapOppositeCaseReportRecord(row as Record<string, unknown>) : undefined;
  }

  async listScenarioStressTemplates(input?: {
    includeInactive?: boolean;
    limit?: number;
  }): Promise<ScenarioStressTemplateRecord[]> {
    const includeInactive = input?.includeInactive ?? false;
    const result = await this.pool.query(
      `select *
         from scenario_stress_templates
        where ($1::boolean = true or is_active = true)
        order by display_order asc, updated_at desc
        limit $2`,
      [includeInactive, Math.max(1, input?.limit ?? 50)]
    );
    return result.rows.map((row) =>
      mapScenarioStressTemplateRecord(row as Record<string, unknown>)
    );
  }

  async getScenarioStressTemplate(
    templateId: ScenarioStressTemplateId
  ): Promise<ScenarioStressTemplateRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from scenario_stress_templates
        where scenario_id = $1
        limit 1`,
      [templateId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapScenarioStressTemplateRecord(row) : undefined;
  }

  async createScenarioStressRun(input: ScenarioStressRunRecord): Promise<ScenarioStressRunRecord> {
    const result = await this.pool.query(
      `insert into scenario_stress_runs (
         scenario_run_id,
         user_id,
         scenario_id,
         status,
         run_mode,
         as_of,
         total_names,
         impacted_names,
         critical_names,
         summary,
         created_at,
         completed_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6::date,
         $7,
         $8,
         $9,
         $10,
         $11::timestamptz,
         $12::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.scenarioId,
        input.status,
        input.runMode,
        input.asOf,
        Math.max(0, Math.floor(input.totalNames)),
        Math.max(0, Math.floor(input.impactedNames)),
        Math.max(0, Math.floor(input.criticalNames)),
        input.summary,
        input.createdAt,
        input.completedAt
      ]
    );
    return mapScenarioStressRunRecord(result.rows[0] as Record<string, unknown>);
  }

  async getScenarioStressRun(input: {
    id: string;
    userId: string;
  }): Promise<ScenarioStressRunRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from scenario_stress_runs
        where scenario_run_id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapScenarioStressRunRecord(row) : undefined;
  }

  async createScenarioStressImpacts(
    input: ScenarioStressImpactRecord[]
  ): Promise<ScenarioStressImpactRecord[]> {
    if (input.length === 0) {
      return [];
    }
    const created: ScenarioStressImpactRecord[] = [];
    for (const item of input) {
      const result = await this.pool.query(
        `insert into scenario_stress_impacts (
           scenario_impact_id,
           scenario_run_id,
           user_id,
           ticker,
           impact_level,
           thesis_break_likelihood,
           stress_score,
           rationale,
           evidence_refs,
           created_at
         )
         values (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9::jsonb,
           $10::timestamptz
         )
         returning *`,
        [
          item.id,
          item.scenarioRunId,
          item.userId,
          item.ticker.trim().toUpperCase(),
          item.impactLevel,
          item.thesisBreakLikelihood,
          Math.min(1, Math.max(0, item.stressScore)),
          item.rationale,
          JSON.stringify(item.evidenceRefs),
          item.createdAt
        ]
      );
      created.push(mapScenarioStressImpactRecord(result.rows[0] as Record<string, unknown>));
    }
    return created;
  }

  async listScenarioStressImpactsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressImpactRecord[]> {
    const result = await this.pool.query(
      `select impacts.*
         from scenario_stress_impacts impacts
         join scenario_stress_runs runs on runs.scenario_run_id = impacts.scenario_run_id
        where impacts.scenario_run_id = $1
          and runs.user_id = $2
        order by impacts.stress_score desc, impacts.ticker asc`,
      [input.scenarioRunId, input.userId]
    );
    return result.rows.map((row) =>
      mapScenarioStressImpactRecord(row as Record<string, unknown>)
    );
  }

  async createScenarioStressRuleSuggestions(
    input: ScenarioStressRuleSuggestionRecord[]
  ): Promise<ScenarioStressRuleSuggestionRecord[]> {
    if (input.length === 0) {
      return [];
    }
    const created: ScenarioStressRuleSuggestionRecord[] = [];
    for (const item of input) {
      const result = await this.pool.query(
        `insert into scenario_stress_rule_suggestions (
           scenario_rule_suggestion_id,
           scenario_run_id,
           user_id,
           ticker,
           signal_type,
           direction,
           condition_text,
           rationale,
           confidence,
           created_at
         )
         values (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10::timestamptz
         )
         returning *`,
        [
          item.id,
          item.scenarioRunId,
          item.userId,
          item.ticker.trim().toUpperCase(),
          item.signalType,
          item.direction,
          item.conditionText,
          item.rationale,
          Math.min(1, Math.max(0, item.confidence)),
          item.createdAt
        ]
      );
      created.push(
        mapScenarioStressRuleSuggestionRecord(result.rows[0] as Record<string, unknown>)
      );
    }
    return created;
  }

  async listScenarioStressRuleSuggestionsByRun(input: {
    scenarioRunId: string;
    userId: string;
  }): Promise<ScenarioStressRuleSuggestionRecord[]> {
    const result = await this.pool.query(
      `select suggestions.*
         from scenario_stress_rule_suggestions suggestions
         join scenario_stress_runs runs on runs.scenario_run_id = suggestions.scenario_run_id
        where suggestions.scenario_run_id = $1
          and runs.user_id = $2
        order by suggestions.confidence desc, suggestions.ticker asc`,
      [input.scenarioRunId, input.userId]
    );
    return result.rows.map((row) =>
      mapScenarioStressRuleSuggestionRecord(row as Record<string, unknown>)
    );
  }

  async createWarRoom(input: EarningsWarRoomRecord): Promise<EarningsWarRoomRecord> {
    const result = await this.pool.query(
      `insert into war_rooms (
         id,
         user_id,
         ticker,
         earnings_event_id,
         event_date,
         state,
         current_cadence_min,
         cadence_state,
         prepared_at,
         closed_at,
         created_at,
         updated_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5::date,
         $6,
         $7,
         $8::jsonb,
         $9::timestamptz,
         $10::timestamptz,
         $11::timestamptz,
         $12::timestamptz
       )
       returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.earningsEventId,
        input.eventDate.trim(),
        input.state,
        input.currentCadenceMin,
        JSON.stringify(input.cadenceState),
        input.preparedAt,
        input.closedAt ?? null,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapEarningsWarRoomRecord(result.rows[0] as Record<string, unknown>);
  }

  async updateWarRoom(
    input: EarningsWarRoomRecord
  ): Promise<EarningsWarRoomRecord | undefined> {
    const result = await this.pool.query(
      `update war_rooms
          set ticker = $3,
              earnings_event_id = $4,
              event_date = $5::date,
              state = $6,
              current_cadence_min = $7,
              cadence_state = $8::jsonb,
              prepared_at = $9::timestamptz,
              closed_at = $10::timestamptz,
              updated_at = $11::timestamptz
        where id = $1
          and user_id = $2
        returning *`,
      [
        input.id,
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.earningsEventId,
        input.eventDate.trim(),
        input.state,
        input.currentCadenceMin,
        JSON.stringify(input.cadenceState),
        input.preparedAt,
        input.closedAt ?? null,
        input.updatedAt
      ]
    );
    const row = result.rows[0];
    return row ? mapEarningsWarRoomRecord(row as Record<string, unknown>) : undefined;
  }

  async getWarRoom(input: {
    id: string;
    userId: string;
  }): Promise<EarningsWarRoomRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from war_rooms
        where id = $1
          and user_id = $2
        limit 1`,
      [input.id, input.userId]
    );
    const row = result.rows[0];
    return row ? mapEarningsWarRoomRecord(row as Record<string, unknown>) : undefined;
  }

  async findWarRoomByEvent(input: {
    userId: string;
    ticker: string;
    earningsEventId: string;
  }): Promise<EarningsWarRoomRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from war_rooms
        where user_id = $1
          and ticker = $2
          and earnings_event_id = $3
        limit 1`,
      [input.userId, input.ticker.trim().toUpperCase(), input.earningsEventId]
    );
    const row = result.rows[0];
    return row ? mapEarningsWarRoomRecord(row as Record<string, unknown>) : undefined;
  }

  async listWarRoomsByUser(input: {
    userId: string;
    ticker?: string;
    limit: number;
    includeClosed?: boolean;
  }): Promise<EarningsWarRoomRecord[]> {
    const result = await this.pool.query(
      `select *
         from war_rooms
        where user_id = $1
          and ($2::text is null or ticker = $2::text)
          and ($3::boolean = true or state <> 'closed')
        order by prepared_at desc
        limit $4`,
      [
        input.userId,
        input.ticker?.trim().toUpperCase() ?? null,
        input.includeClosed ?? false,
        Math.max(1, input.limit)
      ]
    );
    return result.rows.map((row) => mapEarningsWarRoomRecord(row as Record<string, unknown>));
  }

  async createWarRoomTimelineEvent(
    input: EarningsWarRoomTimelineEventRecord
  ): Promise<EarningsWarRoomTimelineEventRecord> {
    const result = await this.pool.query(
      `insert into war_room_timeline_events (
         id,
         war_room_id,
         phase,
         event_type,
         reason_text,
         source_refs,
         alert_ledger_id,
         report_id,
         metadata,
         created_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6::jsonb,
         $7,
         $8,
         $9::jsonb,
         $10::timestamptz
       )
       returning *`,
      [
        input.id,
        input.warRoomId,
        input.phase,
        input.eventType,
        input.reasonText,
        JSON.stringify(input.sourceRefs),
        input.alertLedgerId ?? null,
        input.reportId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdAt
      ]
    );
    return mapEarningsWarRoomTimelineEventRecord(
      result.rows[0] as Record<string, unknown>
    );
  }

  async getWarRoomTimelineEvent(input: {
    id: string;
    warRoomId: string;
  }): Promise<EarningsWarRoomTimelineEventRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from war_room_timeline_events
        where id = $1
          and war_room_id = $2
        limit 1`,
      [input.id, input.warRoomId]
    );
    const row = result.rows[0];
    return row
      ? mapEarningsWarRoomTimelineEventRecord(row as Record<string, unknown>)
      : undefined;
  }

  async listWarRoomTimelineEvents(input: {
    warRoomId: string;
    limit: number;
  }): Promise<EarningsWarRoomTimelineEventRecord[]> {
    const result = await this.pool.query(
      `select *
         from war_room_timeline_events
        where war_room_id = $1
        order by created_at desc
        limit $2`,
      [input.warRoomId, Math.max(1, input.limit)]
    );
    return result.rows
      .map((row) => mapEarningsWarRoomTimelineEventRecord(row as Record<string, unknown>))
      .reverse();
  }

  async upsertThesisMonitorSnapshot(
    input: ThesisMonitorSnapshotRecord
  ): Promise<ThesisMonitorSnapshotRecord> {
    const result = await this.pool.query(
      `insert into thesis_monitor_snapshots (
         user_id,
         ticker,
         state,
         reason,
         score,
         report_id,
         report_generated_at,
         report_schema_version,
         last_deep_dive_at,
         material_events_count,
         unreviewed_events_count,
         freshness_state,
         freshness_score,
         kill_switch_triggered_at,
         freshness_reason,
         updated_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7::timestamptz,
         $8,
         $9::timestamptz,
         $10,
         $11,
         $12,
         $13,
         $14::timestamptz,
         $15,
         $16::timestamptz
       )
       on conflict (user_id, ticker) do update set
         state = excluded.state,
         reason = excluded.reason,
         score = excluded.score,
         report_id = excluded.report_id,
         report_generated_at = excluded.report_generated_at,
         report_schema_version = excluded.report_schema_version,
         last_deep_dive_at = excluded.last_deep_dive_at,
         material_events_count = excluded.material_events_count,
         unreviewed_events_count = excluded.unreviewed_events_count,
         freshness_state = excluded.freshness_state,
         freshness_score = excluded.freshness_score,
         kill_switch_triggered_at = excluded.kill_switch_triggered_at,
         freshness_reason = excluded.freshness_reason,
         updated_at = excluded.updated_at
       returning *`,
      [
        input.userId,
        input.ticker.trim().toUpperCase(),
        input.state,
        input.reason,
        input.score,
        input.reportId ?? null,
        input.reportGeneratedAt ?? null,
        input.reportSchemaVersion ?? null,
        input.lastDeepDiveAt ?? input.reportGeneratedAt ?? null,
        Math.max(0, Math.floor(input.materialEventsCount)),
        Math.max(0, Math.floor(input.unreviewedEventsCount)),
        input.freshnessState,
        Math.min(1, Math.max(0, input.freshnessScore)),
        input.killSwitchTriggeredAt ?? null,
        input.freshnessReason,
        input.updatedAt
      ]
    );
    return mapThesisMonitorSnapshot(result.rows[0] as Record<string, unknown>);
  }

  async listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]> {
    const result = await this.pool.query(
      `select *
         from thesis_monitor_snapshots
        where user_id = $1
        order by ticker asc`,
      [userId]
    );
    return result.rows.map((row) => mapThesisMonitorSnapshot(row as Record<string, unknown>));
  }

  async listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; installationId: string; deviceToken: string }>> {
    const userIds = (input.userIds ?? [])
      .map((userId) => userId.trim())
      .filter((userId) => userId.length > 0);

    const result = await this.pool.query(
      `select ud.user_id, ud.installation_id, ud.device_token
         from user_devices ud
         left join notification_preferences np
           on np.user_id = ud.user_id
           and np.notification_type = $1
         left join subscriptions s
           on s.user_id = ud.user_id
         where ud.invalidated_at is null
           and length(trim(ud.device_token)) > 0
           and coalesce(np.enabled, true) = true
           and (np.quiet_until is null or np.quiet_until <= now())
           and ($2::text is null or s.tier = $2::text)
           and ($3::text[] is null or ud.user_id = any($3::text[]))`,
      [input.notificationType, input.tier ?? null, userIds.length > 0 ? userIds : null]
    );

    return result.rows.map((row) => ({
      userId: String(row.user_id),
      installationId: String(row.installation_id),
      deviceToken: String(row.device_token)
    }));
  }

  async listUsersWithEmailByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; email: string }>> {
    const userIds = (input.userIds ?? [])
      .map((userId) => userId.trim())
      .filter((userId) => userId.length > 0);

    const result = await this.pool.query(
      `select u.id as user_id, lower(trim(u.email)) as email
         from users u
         left join notification_preferences np
           on np.user_id = u.id
           and np.notification_type = $1
         left join subscriptions s
           on s.user_id = u.id
        where u.verified_at is not null
          and length(trim(u.email)) > 0
          and coalesce(np.enabled, true) = true
          and (np.quiet_until is null or np.quiet_until <= now())
          and ($2::text is null or s.tier = $2::text)
          and ($3::text[] is null or u.id = any($3::text[]))
        order by u.id asc`,
      [input.notificationType, input.tier ?? null, userIds.length > 0 ? userIds : null]
    );

    return result.rows.map((row) => ({
      userId: String(row.user_id),
      email: String(row.email)
    }));
  }

  async listUsersWithWatchlist(): Promise<Array<{ userId: string; tickers: string[] }>> {
    const result = await this.pool.query(
      `select user_id, array_agg(ticker order by ticker asc) as tickers
         from watchlists
        group by user_id`
    );

    return result.rows.map((row) => ({
      userId: String(row.user_id),
      tickers: Array.isArray(row.tickers)
        ? row.tickers.map((value: unknown) => String(value))
        : []
    }));
  }

  async listWatchlistTickersByUser(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      `select ticker
         from watchlists
        where user_id = $1
        order by ticker asc`,
      [userId]
    );
    return result.rows.map((row) => String(row.ticker));
  }

  async addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]> {
    await this.pool.query(
      `insert into watchlists (id, user_id, ticker, added_at)
       values ($1, $2, $3, $4)
       on conflict (user_id, ticker) do update
         set added_at = excluded.added_at`,
      [input.id, input.userId, input.ticker.trim().toUpperCase(), input.addedAt]
    );
    return this.listWatchlistTickersByUser(input.userId);
  }

  async removeWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
    await this.pool.query(
      "delete from watchlists where user_id = $1 and ticker = $2",
      [userId, ticker.trim().toUpperCase()]
    );
    return this.listWatchlistTickersByUser(userId);
  }

  async searchTickers(query: string, limit: number): Promise<TickerSearchResult[]> {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    const likeValue = `%${normalized}%`;
    const symbolPrefix = `${normalized}%`;
    const result = await this.pool.query(
      `select symbol, company_name, exchange
         from ticker_registry
        where is_supported = true
          and listing_status = 'active'
          and (upper(symbol) like $1 or upper(company_name) like $1)
        order by
          case
            when upper(symbol) = $2 then 0
            when upper(symbol) like $3 then 1
            else 2
          end,
          symbol asc
        limit $4`,
      [likeValue, normalized, symbolPrefix, limit]
    );

    return result.rows.map((row) => ({
      symbol: String(row.symbol),
      company_name: String(row.company_name),
      exchange: String(row.exchange) as TickerSearchResult["exchange"]
    }));
  }

  async getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    const result = await this.pool.query(
      `select *
         from ticker_registry
        where symbol = $1
          and is_supported = true
          and listing_status = 'active'`,
      [normalized]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTicker(row) : undefined;
  }

  async replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const entry of input.entries) {
        const symbol = entry.symbol.trim().toUpperCase();
        if (!symbol) {
          continue;
        }

        await client.query(
          `insert into ticker_registry (
             symbol,
             company_name,
             exchange,
             listing_status,
             is_supported,
             source_feed,
             source_updated_at,
             last_synced_at,
             raw_payload
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           on conflict (symbol) do update set
             company_name = excluded.company_name,
             exchange = excluded.exchange,
             listing_status = excluded.listing_status,
             is_supported = excluded.is_supported,
             source_feed = excluded.source_feed,
             source_updated_at = excluded.source_updated_at,
             last_synced_at = excluded.last_synced_at,
             raw_payload = excluded.raw_payload`,
          [
            symbol,
            entry.companyName,
            entry.exchange,
            entry.listingStatus,
            entry.isSupported,
            entry.sourceFeed || input.sourceFeed,
            entry.sourceUpdatedAt,
            input.syncedAt,
            JSON.stringify(entry.rawPayload ?? {})
          ]
        );
      }

      const symbols = input.entries
        .map((entry) => entry.symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0);
      const deactivateResult = await client.query(
        `update ticker_registry
            set listing_status = 'delisted',
                is_supported = false,
                source_feed = $1,
                last_synced_at = $2
          where listing_status = 'active'
            and not (symbol = any($3::text[]))`,
        [input.sourceFeed, input.syncedAt, symbols.length > 0 ? symbols : ["__NONE__"]]
      );

      await client.query("commit");
      return {
        upserted: input.entries.length,
        deactivated: deactivateResult.rowCount ?? 0
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }> {
    let added = 0;
    let deleted = 0;
    let updated = 0;
    let renamed = 0;

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const change of input.changes) {
        const symbol = change.symbol.trim().toUpperCase();
        if (!symbol) {
          continue;
        }

        if (change.type === "add") {
          await client.query(
            `insert into ticker_registry (
               symbol,
               company_name,
               exchange,
               listing_status,
               is_supported,
               source_feed,
               source_updated_at,
               last_synced_at,
               raw_payload
             )
             values ($1, $2, $3, 'active', true, $4, $5, $6, $7::jsonb)
             on conflict (symbol) do update set
               company_name = excluded.company_name,
               exchange = excluded.exchange,
               listing_status = 'active',
               is_supported = true,
               source_feed = excluded.source_feed,
               source_updated_at = excluded.source_updated_at,
               last_synced_at = excluded.last_synced_at,
               raw_payload = excluded.raw_payload`,
            [
              symbol,
              change.companyName ?? symbol,
              change.exchange ?? "NASDAQ",
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          added += 1;
          continue;
        }

        if (change.type === "delete") {
          const result = await client.query(
            `update ticker_registry
                set listing_status = 'delisted',
                    is_supported = false,
                    source_feed = $2,
                    source_updated_at = $3,
                    last_synced_at = $4,
                    raw_payload = $5::jsonb
              where symbol = $1`,
            [
              symbol,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          if ((result.rowCount ?? 0) > 0) {
            deleted += 1;
          }
          continue;
        }

        if (change.type === "name_change") {
          const result = await client.query(
            `update ticker_registry
                set company_name = $2,
                    source_feed = $3,
                    source_updated_at = $4,
                    last_synced_at = $5,
                    raw_payload = $6::jsonb
              where symbol = $1`,
            [
              symbol,
              change.newCompanyName ?? change.companyName ?? symbol,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          if ((result.rowCount ?? 0) > 0) {
            updated += 1;
          }
          continue;
        }

        if (change.type === "symbol_change") {
          const currentResult = await client.query(
            "select * from ticker_registry where symbol = $1",
            [symbol]
          );
          const current = currentResult.rows[0] as Record<string, unknown> | undefined;
          const nextSymbol = change.newSymbol?.trim().toUpperCase();
          if (!nextSymbol) {
            continue;
          }

          if (current) {
            await client.query(
              `update ticker_registry
                  set listing_status = 'delisted',
                      is_supported = false,
                      source_feed = $2,
                      source_updated_at = $3,
                      last_synced_at = $4,
                      raw_payload = $5::jsonb
                where symbol = $1`,
              [
                symbol,
                change.sourceFeed,
                change.sourceUpdatedAt,
                input.syncedAt,
                JSON.stringify(change.rawPayload ?? {})
              ]
            );
          }

          const companyName =
            change.newCompanyName ??
            change.companyName ??
            (current ? String(current.company_name) : nextSymbol);
          const exchange =
            change.exchange ??
            (current ? (String(current.exchange) as TickerRegistryRecord["exchange"]) : "NASDAQ");

          await client.query(
            `insert into ticker_registry (
               symbol,
               company_name,
               exchange,
               listing_status,
               is_supported,
               source_feed,
               source_updated_at,
               last_synced_at,
               raw_payload
             )
             values ($1, $2, $3, 'active', true, $4, $5, $6, $7::jsonb)
             on conflict (symbol) do update set
               company_name = excluded.company_name,
               exchange = excluded.exchange,
               listing_status = 'active',
               is_supported = true,
               source_feed = excluded.source_feed,
               source_updated_at = excluded.source_updated_at,
               last_synced_at = excluded.last_synced_at,
               raw_payload = excluded.raw_payload`,
            [
              nextSymbol,
              companyName,
              exchange,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          renamed += 1;
        }
      }

      await client.query("commit");
      return {
        added,
        deleted,
        updated,
        renamed
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async appendAuditEvent(input: AuditEventRecord): Promise<void> {
    await this.pool.query(
      `insert into audit_events (id, user_id, event_type, payload, created_at)
       values ($1, $2, $3, $4::jsonb, $5)`,
      [
        input.id,
        input.userId ?? null,
        input.eventType,
        JSON.stringify(input.payload),
        input.createdAt
      ]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
