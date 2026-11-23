// Every query the evaluators run. store_pg.ts implements it with SQL copied from
// apps/product-api/src/store.ts; store_memory.ts is the in-memory fake for tests.
import type { FearGreedSnapshot } from "../research/macro_stress.ts";
import type { EmailTarget } from "./push_port.ts";
import type {
  AlertLedgerRecord,
  AudienceMember,
  CalendarEventRecord,
  CallArtifact,
  CanonicalEvent,
  ContrarianAnchorRecord,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  FeedbackTriageStatus,
  FirstPartyContextItem,
  KillSwitchEvaluationRecord,
  KillSwitchOutcome,
  KillSwitchRuleRecord,
  KillSwitchSignalSource,
  MarketPriceRow,
  NameRelationshipRecord,
  NameRelationshipType,
  NotificationType,
  ReportMeta,
  SubscriptionTier,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserResearchHoldingRecord,
  UserResearchStateRecord,
  WarRoomRow,
  WarRoomTimelineEventRecord,
} from "./types.ts";

export interface UserPage {
  afterUserId?: string;
  limit: number;
}

export interface AuditEventRecord {
  id: string;
  userId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface EvaluatorStore {
  // ---- Ingest ----
  upsertCanonicalEvents(events: CanonicalEvent[]): Promise<{ upserted: number }>;
  listCanonicalEvents(input: {
    subjectType?: CanonicalEvent["subject_type"];
    subjectId?: string;
    family?: CanonicalEvent["family"];
    limit: number;
  }): Promise<CanonicalEvent[]>;
  upsertFirstPartyContextItems(items: FirstPartyContextItem[]): Promise<{ upserted: number }>;
  upsertCallArtifacts(artifacts: CallArtifact[]): Promise<{ upserted: number }>;
  listFirstPartyContextItems(input: { ticker?: string; eventId?: string; limit: number }): Promise<
    FirstPartyContextItem[]
  >;
  listCallArtifacts(input: { ticker?: string; eventId?: string; limit: number }): Promise<CallArtifact[]>;
  upsertFearGreedSnapshot(
    snapshot: FearGreedSnapshot,
  ): Promise<{ snapshot: FearGreedSnapshot; created: boolean }>;
  getLatestFearGreedSnapshot(): Promise<FearGreedSnapshot | undefined>;
  listTickerCoverageTickers(limit: number): Promise<string[]>;
  upsertCalendarEvents(events: CalendarEventRecord[]): Promise<{ upserted: number }>;
  listCalendarEvents(input: {
    tickers: string[];
    fromDate: string;
    toDate: string;
    eventType?: CalendarEventRecord["eventType"];
  }): Promise<CalendarEventRecord[]>;
  userExists(userId: string): Promise<boolean>;
  upsertNameRelationship(input: NameRelationshipRecord): Promise<void>;
  listActiveNameRelationshipsBySource(input: {
    sourceTicker: string;
    relationshipTypes?: NameRelationshipType[];
    minConfidence: number;
  }): Promise<NameRelationshipRecord[]>;

  // ---- Users and audience ----
  // Users who should get this notification type (preference on, not quiet, tier matches),
  // ordered by user id, with their active devices (possibly none).
  listAudience(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds?: string[];
    page?: UserPage;
  }): Promise<AudienceMember[]>;
  listEmailRecipients(input: {
    notificationType: NotificationType;
    tier?: SubscriptionTier;
    userIds: string[];
  }): Promise<EmailTarget[]>;
  invalidateDevice(
    input: { userId: string; installationId: string; at: string; reason: string },
  ): Promise<void>;
  getUserTier(userId: string): Promise<SubscriptionTier>;
  listWatchlistTickers(userId: string): Promise<string[]>;
  listUsersWithWatchlist(page?: UserPage): Promise<Array<{ userId: string; tickers: string[] }>>;
  listUsersWithResearchUniverse(page?: UserPage): Promise<
    Array<{ userId: string; watchlistTickers: string[]; holdingTickers: string[] }>
  >;

  // ---- Alerts and conviction ----
  // Inserts the row; false when a row with this id already exists (a retried run).
  insertAlertLedgerItem(input: AlertLedgerRecord): Promise<boolean>;
  alertExists(id: string): Promise<boolean>;
  listAlertLedgerItemsByUser(input: { userId: string; limit: number }): Promise<AlertLedgerRecord[]>;
  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord): Promise<void>;
  listConvictionJournalEntriesByUser(input: { userId: string; limit: number }): Promise<
    ConvictionJournalEntryRecord[]
  >;
  upsertConvictionInsightCard(input: ConvictionInsightCardRecord): Promise<void>;

  // ---- Monitor, kill switch, contrarian ----
  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]>;
  upsertThesisMonitorSnapshot(input: ThesisMonitorSnapshotRecord): Promise<ThesisMonitorSnapshotRecord>;
  listActiveKillSwitchRules(input: { asOfIso: string; userIds?: string[] }): Promise<KillSwitchRuleRecord[]>;
  getKillSwitchEvaluation(input: {
    ruleId: string;
    signalSource: KillSwitchSignalSource;
    triggerKey: string;
  }): Promise<KillSwitchEvaluationRecord | undefined>;
  createKillSwitchEvaluation(input: KillSwitchEvaluationRecord): Promise<void>;
  listKillSwitchEvaluations(
    input: { userId: string; outcomes?: KillSwitchOutcome[]; limit: number },
  ): Promise<
    KillSwitchEvaluationRecord[]
  >;
  deactivateExpiredContrarianAnchors(asOfIso: string): Promise<number>;
  listActiveContrarianAnchors(
    input: { asOfIso: string; userIds?: string[] },
  ): Promise<ContrarianAnchorRecord[]>;
  deactivateContrarianAnchor(id: string, at: string): Promise<void>;

  // ---- War rooms ----
  findWarRoomByEvent(input: { userId: string; ticker: string; earningsEventId: string }): Promise<
    WarRoomRow | undefined
  >;
  getWarRoom(input: { id: string; userId: string }): Promise<WarRoomRow | undefined>;
  createWarRoom(input: WarRoomRow): Promise<WarRoomRow>;
  updateWarRoom(input: WarRoomRow): Promise<WarRoomRow | undefined>;
  listWarRoomsByUser(input: { userId: string; includeClosed: boolean; limit: number }): Promise<WarRoomRow[]>;
  createWarRoomTimelineEvent(input: WarRoomTimelineEventRecord): Promise<void>;

  // ---- Reports (metadata only; M2 owns the tables) ----
  listDeepDiveReportsByUser(userId: string): Promise<ReportMeta[]>;
  getReportMeta(reportId: string): Promise<ReportMeta | undefined>;
  getPulseReportByDate(date: string): Promise<ReportMeta | undefined>;

  // ---- Research state ----
  listUserResearchHoldings(userId: string): Promise<UserResearchHoldingRecord[]>;
  getLatestUserResearchState(
    input: { userId: string; asOf?: string },
  ): Promise<UserResearchStateRecord | undefined>;
  upsertUserResearchState(input: UserResearchStateRecord): Promise<void>;

  // ---- Feedback ----
  listUserFeedbackQueue(input: {
    limit: number;
    feedbackType?: "report" | "subscription";
    triageStatus?: FeedbackTriageStatus;
    userTier?: SubscriptionTier;
    sourceSurface?: string;
  }): Promise<UserFeedbackQueueRecord[]>;

  // ---- Prices ----
  upsertMarketPrices(rows: MarketPriceRow[]): Promise<number>;
  // Latest close per ticker on or before asOfDate and not older than maxAgeDays.
  latestClosePrices(input: { tickers: string[]; asOfDate: string; maxAgeDays: number }): Promise<
    Map<string, number>
  >;
  listPriceTickers(limit: number): Promise<string[]>;

  // ---- Audit ----
  appendAuditEvent(input: AuditEventRecord): Promise<void>;
}
