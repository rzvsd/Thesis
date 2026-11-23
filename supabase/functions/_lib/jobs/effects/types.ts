// Records and ports for the side effects of a completed Deep Dive.
// Ported from apps/product-api/src/server.ts, store.ts and filing-change-alerts.ts.
import type { AnalysisReport, ReportRecord } from "../types.ts";

export type ContrarianSignalValue = "positive" | "neutral" | "negative";

export const killSwitchSignalTypes = [
  "price_move_pct",
  "thesis_state",
  "earnings_event",
  "sec_filing",
  "guidance_revision",
  "management_change",
  "macro_regime",
  "analyst_rerating",
  "news_sentiment",
  "custom",
] as const;
export type KillSwitchSignalType = (typeof killSwitchSignalTypes)[number];
export type KillSwitchDirection = "against_signal" | "above" | "below" | "any";
export type KillSwitchThresholdUnit = "pct" | "count" | "score" | "days";

export interface KillSwitchConditionDraft {
  condition_id: string;
  condition_text: string;
  signal_type: KillSwitchSignalType;
  rationale: string;
  threshold_value?: number;
  threshold_unit?: KillSwitchThresholdUnit;
  direction?: KillSwitchDirection;
  prompt_version?: string;
}

export const nameRelationshipTypes = ["supplier", "competitor", "partner", "sector"] as const;
export type NameRelationshipType = (typeof nameRelationshipTypes)[number];
export type NameRelationshipState = "active" | "suppressed" | "inactive";

export interface NameRelationshipDraft {
  relationship_id?: string;
  source_ticker: string;
  target_ticker: string;
  relationship_type: string;
  confidence: number;
  evidence_text: string;
  rationale: string;
  prompt_version?: string;
}

export type ThesisMonitorState = "intact" | "improved" | "weakened" | "unresolved";
export type ThesisFreshnessState = "current" | "aging" | "stale" | "triggered";

export interface AuditEventRecord {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  userId?: string;
  createdAt: string;
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

export interface KillSwitchRuleRecord {
  id: string;
  userId: string;
  ticker: string;
  reportId?: string;
  signalValue?: ContrarianSignalValue;
  anchorPrice?: number;
  conditionId: string;
  conditionText: string;
  signalType: KillSwitchSignalType;
  rationale: string;
  thresholdValue?: number;
  thresholdUnit?: KillSwitchThresholdUnit;
  direction?: KillSwitchDirection;
  promptVersion: string;
  state: "active" | "inactive";
  source: "dexter_prompt" | "fallback";
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string;
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

export interface ConvictionEvidenceRef {
  kind: "report" | "evidence_item" | "alert_ledger" | "war_room" | "monitor_snapshot" | "opposite_case";
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
  eventType: string;
  sourceType: string;
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

export interface SupportedTickerRecord {
  symbol: string;
  companyName: string;
  exchange: string;
}

export interface AlertLedgerRecord {
  id: string;
  userId: string;
  notificationType: string;
  category: "thesis_drift" | "earnings" | "macro" | "system";
  route: string;
  title: string;
  body: string;
  detailBody?: string;
  reasonCode: string;
  reasonText: string;
  deliveryState: "sent" | "partial_failure";
  context: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PushTarget {
  userId: string;
  installationId: string;
  deviceToken: string;
}

export interface EmailTarget {
  userId: string;
  email: string;
}

// Everything the effects read or write. postgresEffectsStore implements it; tests use a fake.
export interface EffectsStore {
  appendAuditEvent(input: AuditEventRecord): Promise<void>;
  createContrarianAlertAnchor(input: ContrarianAlertAnchorRecord): Promise<void>;
  deactivateActiveKillSwitchRulesByUserTicker(
    input: { userId: string; ticker: string; deactivatedAt: string },
  ): Promise<number>;
  createKillSwitchRule(input: KillSwitchRuleRecord): Promise<void>;
  upsertNameRelationship(input: NameRelationshipRecord): Promise<void>;
  listWatchlistTickersByUser(userId: string): Promise<string[]>;
  upsertThesisMonitorSnapshot(input: ThesisMonitorSnapshotRecord): Promise<ThesisMonitorSnapshotRecord>;
  listThesisMonitorSnapshotsByUser(userId: string): Promise<ThesisMonitorSnapshotRecord[]>;
  // Creates the FREE row when missing, like the old getUserSubscription.
  getUserSubscriptionTier(userId: string): Promise<"FREE" | "PRO">;
  upsertConvictionJournalEntry(input: ConvictionJournalEntryRecord): Promise<{ id: string }>;
  getSupportedTicker(symbol: string): Promise<SupportedTickerRecord | undefined>;
  findLatestComparableDeepDiveReport(
    input: { ticker: string; schemaMajor: number; sinceIso: string },
  ): Promise<ReportRecord | undefined>;
  listUsersWithWatchlist(): Promise<Array<{ userId: string; tickers: string[] }>>;
  listUsersWithDeviceTokenByNotificationType(
    input: { notificationType: string; userIds?: string[] },
  ): Promise<PushTarget[]>;
  listUsersWithEmailByNotificationType(
    input: { notificationType: string; userIds?: string[] },
  ): Promise<EmailTarget[]>;
  // Stored rows only; a type with no row counts as enabled (the old store filled in enabled defaults).
  getNotificationPreferences(userId: string): Promise<Array<{ type: string; enabled: boolean }>>;
  getAlertLedgerItem(input: { id: string; userId: string }): Promise<{ id: string } | undefined>;
  createAlertLedgerItem(input: AlertLedgerRecord): Promise<void>;
  invalidateUserDeviceByInstallation(
    input: { userId: string; installationId: string; invalidatedAt: string; reason: string },
  ): Promise<boolean>;
}

export interface PushPayload {
  notificationType: string;
  route: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface EmailPayload {
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

// Push and email delivery (owned by later milestones). `failed` counts targets not delivered.
export interface FilingAlertNotifier {
  sendPush(
    targets: PushTarget[],
    payload: PushPayload,
  ): Promise<{ failed: number; invalidTargets: PushTarget[] }>;
  sendEmail(targets: EmailTarget[], payload: EmailPayload): Promise<{ failed: number }>;
  // One-click unsubscribe link for a user; undefined when not configured.
  emailUnsubscribeUrl?(userId: string): string | undefined;
}

// Minimal shape of the data-openbb structural context pack used by issuer enrichment.
export interface StructuralContextPack {
  subject_type: string;
  issuer_metadata?: IssuerMetadata;
  observations: Array<{ family: string; label: string; summary: string; [key: string]: unknown }>;
  omissions: Array<{ source_family: string; reason_text: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface IssuerMetadata {
  name?: string;
  exchange?: string;
  currency?: string;
  domicile_country?: string;
  region?: string;
  sector?: string;
  industry?: string;
}

export type FetchStructuralContext = (
  input: { ticker?: string; country?: string; subjectType?: "issuer" | "market_pulse"; asOf?: string },
) => Promise<StructuralContextPack | undefined>;

export interface EffectsDeps {
  store: EffectsStore;
  // Latest end-of-day close for a ticker; undefined or a throw both mean "unavailable".
  latestClose: (ticker: string) => Promise<number | undefined>;
  notifier: FilingAlertNotifier;
  readReport: (artifactKey: string) => Promise<AnalysisReport | undefined>;
  now?: () => Date;
}

export interface CompletionEffectsInput {
  report: AnalysisReport;
  userId?: string;
  requestId: string;
  route: string;
  includeMonitorSnapshot: boolean;
}
