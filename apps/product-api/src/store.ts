import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { notificationTypes } from "../../../packages/contracts/src";
import type {
  CalendarEventTime,
  CalendarEventType,
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  ContrarianSignalValue,
  FearGreedSnapshot,
  NotificationType,
  SubscriptionTier,
  TickerCoverage
} from "../../../packages/contracts/src";

import type {
  AuditEventRecord,
  CalendarEventRecord,
  ContrarianAlertAnchorRecord,
  JobRecord,
  NotificationPreferenceRecord,
  ReportNoteRecord,
  ReportRecord,
  SessionRecord,
  TickerDeltaChange,
  TickerRegistryRecord,
  TickerRegistryUpsertInput,
  TickerSearchResult,
  UserRecord,
  UserSubscriptionRecord,
  VerificationTokenRecord
} from "./types";

export interface ProductStore {
  createUser(input: { email: string; passwordHash: string }): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined>;
  updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined>;
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
  }): Promise<SessionRecord>;
  getSessionById(id: string): Promise<SessionRecord | undefined>;
  revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined>;
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
  getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord[]>;
  getReportNote(reportId: string, userId: string): Promise<ReportNoteRecord | undefined>;
  upsertReportNote(input: {
    reportId: string;
    userId: string;
    content: string;
    updatedAt: string;
  }): Promise<ReportNoteRecord>;
  upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{ type: NotificationType; enabled: boolean }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]>;
  listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; deviceToken: string }>>;
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
    deviceToken: row.device_token ? String(row.device_token) : undefined
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
  return {
    id: String(row.id),
    userId: String(row.user_id),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    revokedAt: asIsoString(row.revoked_at)
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

function mapNotificationPreference(row: Record<string, unknown>): NotificationPreferenceRecord {
  return {
    userId: String(row.user_id),
    type: String(row.notification_type) as NotificationType,
    enabled: Boolean(row.enabled),
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

export class InMemoryStore implements ProductStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>();
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
  private readonly calendarEvents = new Map<string, CalendarEventRecord>();
  private readonly contrarianAnchors = new Map<string, ContrarianAlertAnchorRecord>();
  private readonly reportNotes = new Map<string, ReportNoteRecord>();
  private readonly notificationPreferencesByUser = new Map<
    string,
    Map<NotificationType, NotificationPreferenceRecord>
  >();

  constructor() {
    const now = new Date().toISOString();
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
      createdAt: now
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

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }

    user.verifiedAt = verifiedAt;
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
    user.deviceToken = deviceToken;
    return user;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const targets: Array<{ userId: string; deviceToken: string }> = [];
    for (const user of this.users.values()) {
      if (user.deviceToken && user.deviceToken.trim().length > 0) {
        targets.push({
          userId: user.id,
          deviceToken: user.deviceToken
        });
      }
    }
    return targets;
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
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: input.id,
      userId: input.userId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt
    };
    this.sessions.set(input.id, session);
    return session;
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(id);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.revokedAt = revokedAt;
    return session;
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

  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord[]> {
    const preferences = this.ensureDefaultNotificationPreferences(userId);
    return [...preferences.values()].map((entry) => ({ ...entry }));
  }

  async upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{ type: NotificationType; enabled: boolean }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]> {
    const preferences = this.ensureDefaultNotificationPreferences(input.userId);
    for (const update of input.preferences) {
      if (!isNotificationType(update.type)) {
        continue;
      }
      preferences.set(update.type, {
        userId: input.userId,
        type: update.type,
        enabled: update.enabled,
        updatedAt: input.updatedAt
      });
    }
    return [...preferences.values()].map((entry) => ({ ...entry }));
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

  async listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; deviceToken: string }>> {
    const normalizedUserIds = input.userIds
      ? new Set(input.userIds.map((userId) => userId.trim()))
      : undefined;
    const targets: Array<{ userId: string; deviceToken: string }> = [];

    for (const user of this.users.values()) {
      if (!user.deviceToken || user.deviceToken.trim().length === 0) {
        continue;
      }
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
      targets.push({
        userId: user.id,
        deviceToken: user.deviceToken
      });
    }

    return targets;
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

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set verified_at = $2 where id = $1 returning *",
      [userId, verifiedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set device_token = $2 where id = $1 returning *",
      [userId, deviceToken ?? null]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const result = await this.pool.query(
      `select id, device_token
         from users
        where device_token is not null
          and length(trim(device_token)) > 0`
    );
    return result.rows.map((row) => ({
      userId: String(row.id),
      deviceToken: String(row.device_token)
    }));
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
  }): Promise<SessionRecord> {
    const result = await this.pool.query(
      `insert into sessions (id, user_id, created_at, expires_at)
       values ($1, $2, $3, $4)
       returning *`,
      [input.id, input.userId, input.createdAt, input.expiresAt]
    );
    return mapSession(result.rows[0] as Record<string, unknown>);
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query("select * from sessions where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query(
      `update sessions
         set revoked_at = coalesce(revoked_at, $2)
       where id = $1
       returning *`,
      [sessionId, revokedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
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

  async upsertNotificationPreferences(input: {
    userId: string;
    preferences: Array<{ type: NotificationType; enabled: boolean }>;
    updatedAt: string;
  }): Promise<NotificationPreferenceRecord[]> {
    if (input.preferences.length === 0) {
      return this.getNotificationPreferences(input.userId);
    }

    for (const preference of input.preferences) {
      await this.pool.query(
        `insert into notification_preferences (
           id,
           user_id,
           notification_type,
           enabled,
           updated_at,
           created_at
         )
         values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)
         on conflict (user_id, notification_type) do update set
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
        [
          randomUUID(),
          input.userId,
          preference.type,
          preference.enabled,
          input.updatedAt
        ]
      );
    }

    return this.getNotificationPreferences(input.userId);
  }

  async listUsersWithDeviceTokenByNotificationType(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
  }): Promise<Array<{ userId: string; deviceToken: string }>> {
    const userIds = (input.userIds ?? [])
      .map((userId) => userId.trim())
      .filter((userId) => userId.length > 0);

    const result = await this.pool.query(
      `select u.id, u.device_token
         from users u
         left join notification_preferences np
           on np.user_id = u.id
          and np.notification_type = $1
         left join subscriptions s
           on s.user_id = u.id
        where u.device_token is not null
          and length(trim(u.device_token)) > 0
          and coalesce(np.enabled, true) = true
          and ($2::text is null or s.tier = $2::text)
          and ($3::text[] is null or u.id = any($3::text[]))`,
      [input.notificationType, input.tier ?? null, userIds.length > 0 ? userIds : null]
    );

    return result.rows.map((row) => ({
      userId: String(row.id),
      deviceToken: String(row.device_token)
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
