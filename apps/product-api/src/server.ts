import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { URL } from "node:url";

import type {
  AlertFeedbackState,
  AlertLedgerCategory,
  AlertLedgerFilter,
  AlertFeedbackSubmission,
  AlertRouteTarget,
  AnalysisReport,
  AnalysisRequest,
  AuthTokensResponse,
  CallArtifact,
  CanonicalEvent,
  CoherenceEvaluationRequest,
  ConvictionEvidenceRef,
  ConvictionInsightCard,
  ConvictionInsightFinding,
  ConvictionJournalEntry,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  CreateJobRequest,
  CrossNamePropagationEvaluationRequest,
  CrossNamePropagationEventCategory,
  CrossNamePropagationEventFixture,
  CrossNamePropagationSignalSource,
  EarningsEventSourceState,
  EarningsEventState,
  EarningsEventStateListResponse,
  EarningsEventTimingState,
  FeedbackSeverity,
  EvidenceRightsMetadata,
  FirstPartyContextItem,
  KillSwitchConditionDraft,
  KillSwitchEvaluationFixture,
  KillSwitchEvaluationRequest,
  KillSwitchEvaluationSignalSource,
  KillSwitchSignalType,
  EarningsWarRoomSourceRef,
  JobStatusResponse,
  MarketPulseReport,
  MorningExceptionBriefingMode,
  NameRelationshipDraft,
  NameRelationshipItem,
  NameRelationshipState,
  NameRelationshipType,
  NotificationType,
  ReportFeedbackCode,
  ReportFeedbackSubmission,
  ReportListItem,
  ScenarioStressImpact,
  ScenarioStressRuleSuggestion,
  ScenarioStressRunRequest,
  ScenarioStressRunResponse,
  ScenarioStressTemplate,
  ScenarioStressTemplateId,
  ScenarioRequest,
  ScenarioInputOmission,
  ScenarioResponse,
  StructuralContextPack,
  SubscriptionFeedbackCode,
  SubscriptionFeedbackSubmission,
  SubscriptionTier,
  ThesisFreshnessState,
  ThesisMonitorSnapshot,
  UserProfile
} from "../../../packages/contracts/src";
import {
  alertFeedbackStates,
  alertLedgerCategories,
  callArtifactCompletenessStates,
  callArtifactTypes,
  evidenceDisplayModes,
  evidenceRightsClasses,
  evidenceSourceRanks,
  feedbackSeverityLevels,
  feedbackTriageStatuses,
  firstPartyFetchStates,
  firstPartyPageTypes,
  nameRelationshipStates,
  nameRelationshipTypes,
  reportFeedbackCodes,
  scenarioStressTemplateIds,
  subscriptionFeedbackCodes
} from "../../../packages/contracts/src";
import { captureException, initSentry } from "../../../packages/observability/src/sentry";

import { createArtifactStore, type ArtifactStore } from "./artifact-store";
import { loadConfig, validateConfig, type ProductApiConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";
import { createJobQueue, type JobQueue } from "./queue";
import { createRateLimiter, type RateLimiter } from "./rate-limit";
import { EmailNotifier } from "./email";
import {
  createId,
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword
} from "./security";
import { createProductStore } from "./store-factory";
import type { ProductStore } from "./store";
import { assertIncomingAnalysisReport } from "./report-validation";
import { assertIncomingMarketPulseReport } from "./market-pulse-validation";
import { buildMarketPulseReport } from "./market-pulse";
import { fetchEnvelope } from "./pulse/fetchers";
import { headlineItemsFromApprovedNews } from "./pulse/macro-news";
import { buildMarketPulsePdfExport } from "./market-pulse-render";
import { buildInstitutionalPdfExport } from "./report-pdf";
import {
  buildMacroStressSnapshot,
  legacySnapshotToMacroStress,
  macroStressToLegacySnapshot
} from "./macro-stress";
import {
  buildEarningsEventStates,
  normalizeEarningsSourceState,
  normalizeEarningsTimingState
} from "./earnings-state";
import { PushNotifier } from "./push";
import { isUsTradingDay, isValidMarketDate } from "./sentiment";
import { fetchLatestClosePrice, fetchLatestClosePrices } from "./market-prices";
import { verifyGoogleIdToken } from "./google-oidc";
import { handleAuthRoutes } from "./routes/auth-routes";
import { handleCoverageRoutes } from "./routes/coverage-routes";
import { handleNotificationRoutes } from "./routes/notification-routes";
import { handlePulseRoutes } from "./routes/pulse-routes";
import { handlePublicRoutes } from "./routes/public-routes";
import {
  handleRevenueCatPublicRoutes,
  handleRevenueCatRoutes
} from "./routes/revenuecat-routes";
import {
  handleInternalResearchStateRoutes,
  handleResearchStateRoutes
} from "./routes/research-state-routes";
import { startTickerSyncScheduler } from "./ticker-sync-scheduler";
import { startJobRecoveryScheduler } from "./job-recovery-scheduler";
import type {
  AlertLedgerRecord,
  AuditEventRecord,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  EarningsWarRoomRecord,
  EarningsWarRoomTimelineEventRecord,
  JobRecord,
  KillSwitchEvaluationRecord,
  KillSwitchRuleRecord,
  NameRelationshipRecord,
  OppositeCaseReportRecord,
  ScenarioStressImpactRecord,
  ScenarioStressRuleSuggestionRecord,
  ScenarioStressRunRecord,
  ScenarioStressTemplateRecord,
  ThesisMonitorSnapshotRecord,
  UserFeedbackQueueRecord,
  UserRecord
} from "./types";

type HealthPayload = {
  status: "ok";
  modes: { push: "stub" | "fcm"; email: "stub" | "resend"; artifact_store: "filesystem" | "s3" };
};

const defaultMaxJsonBodyBytes = 1024 * 1024;
const requestJsonBodyLimitKey = Symbol("requestJsonBodyLimitKey");
const corsAllowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const corsAllowedHeaders = "authorization,content-type,x-request-id,x-internal-token";

class PayloadTooLargeError extends Error {
  readonly limitBytes: number;

  constructor(limitBytes: number) {
    super(`JSON payload exceeded ${limitBytes} bytes`);
    this.name = "PayloadTooLargeError";
    this.limitBytes = limitBytes;
  }
}

type IncomingMessageWithBodyLimit = IncomingMessage & {
  [requestJsonBodyLimitKey]?: number;
};

interface AuthContext {
  userId: string;
  sessionId: string;
}

interface Runtime {
  config: ProductApiConfig;
  store: ProductStore;
  queue: JobQueue;
  rateLimiter: RateLimiter;
  artifactStore: ArtifactStore;
  pushNotifier: PushNotifier;
  emailNotifier: EmailNotifier;
  close: () => Promise<void>;
}

interface RequestMeta {
  requestId: string;
  pathname: string;
}

interface CalendarEventSource {
  ticker: string;
  event_type: "earnings";
  event_date: string;
  event_time?: "before_market" | "after_market" | "during_market";
  provider?: string;
  retrieved_at?: string;
  timing_state?: EarningsEventTimingState;
  source_state?: EarningsEventSourceState;
  source_ref?: Record<string, unknown>;
  reason_text?: string;
}

const serviceName = "product-api";
const contrarianMoveThresholdPct = 5;
const contrarianAnchorWindowDays = 90;
const killSwitchDefaultPriceMoveThresholdPct = 5;
const weeklyDigestLookaheadDays = 7;
const monitorFreshnessWindowDays = 14;
const freshnessAgingDays = 14;
const freshnessStaleDays = 45;
const freshnessTriggeredLookbackDays = 14;
const freshnessDecayCooldownHours = 72;
const warRoomFastCadenceMinutes = 15;
const warRoomFallbackCadenceMinutes = 30;
const warRoomFallbackConsecutiveThreshold = 2;
const warRoomRecoveryHealthyThreshold = 3;
const warRoomLagFallbackThresholdMinutes = 20;
const warRoomRuntimeFallbackThresholdMinutes = 12;
const warRoomLagRecoveryThresholdMinutes = 10;
const warRoomRuntimeRecoveryThresholdMinutes = 8;
const warRoomPreparationLookaheadDays = 2;
const crossNamePropagationDefaultConfidenceThreshold = 0.7;
const convictionOppositeCasePromptVersion = "thesis-m6-opposite-case";
const convictionCoherencePromptVersion = "thesis-m6-coherence-analyzer";
const alertLedgerCategoryList = [...alertLedgerCategories];
const alertFeedbackStateList = [...alertFeedbackStates];
const nameRelationshipTypeList = [...nameRelationshipTypes];
const nameRelationshipStateList = [...nameRelationshipStates];
const reportFeedbackCodeList = [...reportFeedbackCodes];
const subscriptionFeedbackCodeList = [...subscriptionFeedbackCodes];
const feedbackSeverityList = [...feedbackSeverityLevels];
const feedbackTriageStatusList = [...feedbackTriageStatuses];

function isAlertLedgerCategory(value: string): value is AlertLedgerCategory {
  return alertLedgerCategoryList.includes(value as AlertLedgerCategory);
}

function isAlertFeedbackState(value: string): value is AlertFeedbackState {
  return alertFeedbackStateList.includes(value as AlertFeedbackState);
}

function isNameRelationshipType(value: string): value is NameRelationshipType {
  return nameRelationshipTypeList.includes(value as NameRelationshipType);
}

function isNameRelationshipState(value: string): value is NameRelationshipState {
  return nameRelationshipStateList.includes(value as NameRelationshipState);
}

function isReportFeedbackCode(value: string): value is ReportFeedbackCode {
  return reportFeedbackCodeList.includes(value as ReportFeedbackCode);
}

function isSubscriptionFeedbackCode(value: string): value is SubscriptionFeedbackCode {
  return subscriptionFeedbackCodeList.includes(value as SubscriptionFeedbackCode);
}

function isFeedbackSeverity(value: string): value is FeedbackSeverity {
  return feedbackSeverityList.includes(value as FeedbackSeverity);
}

function isFeedbackTriageStatus(value: string): value is (typeof feedbackTriageStatusList)[number] {
  return feedbackTriageStatusList.includes(value as (typeof feedbackTriageStatusList)[number]);
}

function addDaysToIsoDate(baseDate: string, days: number): string {
  const base = new Date(`${baseDate}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isWeekendIsoDate(value: string): boolean {
  const utcNoon = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(utcNoon.getTime())) {
    return false;
  }
  const day = utcNoon.getUTCDay();
  return day === 0 || day === 6;
}

function isSundayIsoDate(value: string): boolean {
  const utcNoon = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(utcNoon.getTime())) {
    return false;
  }
  return utcNoon.getUTCDay() === 0;
}

function nextBusinessDate(baseDate: string): string {
  let candidate = addDaysToIsoDate(baseDate, 1);
  while (isWeekendIsoDate(candidate)) {
    candidate = addDaysToIsoDate(candidate, 1);
  }
  return candidate;
}

function asContrarianSignal(value: string | undefined): "positive" | "neutral" | "negative" | undefined {
  if (value === "positive" || value === "neutral" || value === "negative") {
    return value;
  }
  return undefined;
}

function asAlertRouteTarget(value: string | undefined): AlertRouteTarget | undefined {
  if (
    value === "today" ||
    value === "names" ||
    value === "research" ||
    value === "inbox" ||
    value === "you"
  ) {
    return value;
  }
  return undefined;
}

function asMorningExceptionBriefingMode(
  value: string | undefined
): MorningExceptionBriefingMode | undefined {
  if (value === "no_change" || value === "exceptions_present") {
    return value;
  }
  return undefined;
}

function uniqueUppercaseTickers(values: string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0)
  )];
}

async function getEarningsEventStateListForUser(
  runtime: Runtime,
  input: {
    userId: string;
    asOf: string;
    tickers?: string[];
    windowPastDays?: number;
    windowAheadDays?: number;
  }
): Promise<EarningsEventStateListResponse> {
  const watchlistTickers =
    input.tickers && input.tickers.length > 0
      ? uniqueUppercaseTickers(input.tickers)
      : uniqueUppercaseTickers(await runtime.store.listWatchlistTickersByUser(input.userId));
  const windowPastDays = Math.max(0, Math.floor(input.windowPastDays ?? 7));
  const windowAheadDays = Math.max(1, Math.floor(input.windowAheadDays ?? 30));
  const windowStart = addDaysToIsoDate(input.asOf, -windowPastDays);
  const windowEnd = addDaysToIsoDate(input.asOf, windowAheadDays);
  if (watchlistTickers.length === 0) {
    return {
      as_of: input.asOf,
      window_start: windowStart,
      window_end: windowEnd,
      states: []
    };
  }

  const events = await runtime.store.listUpcomingCalendarEventsByTickers({
    tickers: watchlistTickers,
    fromDate: windowStart,
    toDate: windowEnd,
    eventType: "earnings"
  });
  const artifactsByTicker = new Map<string, CallArtifact[]>();
  for (const ticker of watchlistTickers) {
    const artifacts = await runtime.store.listCallArtifacts({
      ticker,
      limit: 250
    });
    artifactsByTicker.set(ticker, artifacts);
  }

  return {
    as_of: input.asOf,
    window_start: windowStart,
    window_end: windowEnd,
    states: buildEarningsEventStates({
      asOf: input.asOf,
      events,
      artifactsByTicker
    })
  };
}

function findEarningsState(
  states: EarningsEventState[],
  input: { ticker: string; eventId?: string; eventDate?: string }
): EarningsEventState | undefined {
  const ticker = input.ticker.trim().toUpperCase();
  const byTicker = states.filter((state) => state.ticker === ticker);
  if (byTicker.length === 0) {
    return undefined;
  }
  if (input.eventId) {
    const byEventId = byTicker.find((state) => state.earnings_event_id === input.eventId);
    if (byEventId) {
      return byEventId;
    }
  }
  if (input.eventDate) {
    const byDate = byTicker.find((state) => state.event_date === input.eventDate);
    if (byDate) {
      return byDate;
    }
  }
  return byTicker[0];
}

function buildWarRoomEvidencePack(input: {
  state?: EarningsEventState;
  timeline: EarningsWarRoomTimelineEventRecord[];
}): {
  baseline: Record<string, unknown>;
  release_artifact: Record<string, unknown>;
  followup_context: Record<string, unknown>;
  transcript: Record<string, unknown>;
} {
  const preparedEvent = input.timeline
    .filter((event) => event.eventType === "prepared")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
  const followupEvent = input.timeline
    .filter((event) =>
      event.eventType === "deep_dive_queued" ||
      event.eventType === "post_event_closed" ||
      event.eventType === "playbook_updated"
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const baselineRef = preparedEvent?.sourceRefs?.[0];
  const baseline = baselineRef
    ? {
        kind: baselineRef.kind,
        ref_id: baselineRef.ref_id,
        label: baselineRef.label,
        captured_at: baselineRef.captured_at
      }
    : {
        omission: {
          reason_code: "baseline_missing",
          reason_text: "No prepared baseline reference was found in War Room history."
        }
      };

  const releaseArtifact = input.state?.release_artifact
    ? {
        ...input.state.release_artifact
      }
    : {
        omission: {
          reason_code: "release_artifact_missing",
          reason_text: "No release artifact has been ingested yet for this earnings event."
        }
      };

  const followupContext = followupEvent
    ? {
        event_type: followupEvent.eventType,
        reason_text: followupEvent.reasonText,
        report_id: followupEvent.reportId,
        alert_ledger_id: followupEvent.alertLedgerId,
        created_at: followupEvent.createdAt
      }
    : {
        omission: {
          reason_code: "followup_context_missing",
          reason_text: "No contradiction or follow-up summary exists yet for this War Room."
        }
      };

  const transcript = input.state?.has_transcript
    ? {
        available: true,
        reason_text: "Transcript artifact is available."
      }
    : {
        available: false,
        omission: {
          reason_code: "transcript_optional",
          reason_text: "Transcript text is optional and not required for War Room readiness."
        }
      };

  return {
    baseline,
    release_artifact: releaseArtifact,
    followup_context: followupContext,
    transcript
  };
}

function groupPushTargetsByUser(
  targets: Array<{ userId: string; installationId: string; deviceToken: string }>
): Map<string, Array<{ userId: string; installationId: string; deviceToken: string }>> {
  const grouped = new Map<string, Array<{ userId: string; installationId: string; deviceToken: string }>>();
  for (const target of targets) {
    const existing = grouped.get(target.userId);
    if (existing) {
      existing.push(target);
      continue;
    }
    grouped.set(target.userId, [target]);
  }
  return grouped;
}

function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "earnings_preview":
      return "Earnings preview";
    case "earnings_war_room":
      return "Earnings War Room";
    case "contrarian_alert":
      return "Contrarian alert";
    case "kill_switch":
      return "Kill-switch alert";
    case "freshness_decay":
      return "Freshness decay";
    case "morning_exception_briefing":
      return "Morning Exception Briefing";
    case "cross_name_propagation":
      return "Cross-name alert";
    case "weekly_digest":
      return "Weekly digest";
    case "market_pulse_ready":
      return "Market Pulse";
  }
}

function notificationCategory(type: NotificationType): AlertLedgerCategory {
  switch (type) {
    case "contrarian_alert":
    case "kill_switch":
    case "freshness_decay":
    case "cross_name_propagation":
      return "thesis_drift";
    case "earnings_preview":
    case "earnings_war_room":
      return "earnings";
    case "morning_exception_briefing":
    case "weekly_digest":
    case "market_pulse_ready":
      return "macro";
  }
}

function notificationRoute(type: NotificationType): AlertRouteTarget {
  if (type === "earnings_war_room") {
    return "research";
  }
  if (
    type === "weekly_digest" ||
    type === "market_pulse_ready" ||
    type === "morning_exception_briefing"
  ) {
    return "today";
  }
  if (type === "freshness_decay") {
    return "names";
  }
  if (type === "cross_name_propagation") {
    return "names";
  }
  return "research";
}

function notificationTitle(type: NotificationType, ticker?: string): string {
  if (!ticker) {
    return notificationTypeLabel(type);
  }
  return `${notificationTypeLabel(type)}: ${ticker}`;
}

interface InternalJsonResponse<T> {
  status: number;
  ok: boolean;
  payload: T;
}

function alertLedgerContextFromData(data: Record<string, string> | undefined): Record<string, unknown> {
  if (!data) {
    return {};
  }
  const leadRoute = asAlertRouteTarget(data.lead_route);
  const briefingMode = asMorningExceptionBriefingMode(data.briefing_mode);
  const relatedTickers = data.tickers
    ?.split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => ticker.length > 0);
  return {
    ...(data.ticker ? { ticker: data.ticker.trim().toUpperCase() } : {}),
    ...(data.report_id ? { report_id: data.report_id } : {}),
    ...(data.war_room_id ? { war_room_id: data.war_room_id } : {}),
    ...(data.war_room_phase ? { war_room_phase: data.war_room_phase } : {}),
    ...(data.earnings_event_id ? { earnings_event_id: data.earnings_event_id } : {}),
    ...(data.event_date ? { event_date: data.event_date } : {}),
    ...(data.earnings_timing_state ? { earnings_timing_state: data.earnings_timing_state } : {}),
    ...(data.earnings_source_state ? { earnings_source_state: data.earnings_source_state } : {}),
    ...(data.earnings_evidence_state ? { earnings_evidence_state: data.earnings_evidence_state } : {}),
    ...(data.earnings_conflict
      ? { earnings_conflict: data.earnings_conflict === "true" }
      : {}),
    ...(data.current_cadence_min
      ? { current_cadence_min: Number(data.current_cadence_min) }
      : {}),
    ...(data.rule_id ? { rule_id: data.rule_id } : {}),
    ...(data.evaluation_id ? { evaluation_id: data.evaluation_id } : {}),
    ...(data.signal_type ? { signal_type: data.signal_type } : {}),
    ...(data.trigger_key ? { trigger_key: data.trigger_key } : {}),
    ...(data.report_date && data.deep_link_target === "today" ? { pulse_date: data.report_date } : {}),
    ...(data.report_date ? { report_date: data.report_date } : {}),
    ...(data.digest_date ? { digest_date: data.digest_date } : {}),
    ...(relatedTickers && relatedTickers.length > 0 ? { related_tickers: relatedTickers } : {}),
    ...(data.freshness_state ? { freshness_state: data.freshness_state } : {}),
    ...(data.freshness_score ? { freshness_score: Number(data.freshness_score) } : {}),
    ...(data.material_events_count
      ? { material_events_count: Number(data.material_events_count) }
      : {}),
    ...(data.unreviewed_events_count
      ? { unreviewed_events_count: Number(data.unreviewed_events_count) }
      : {}),
    ...(data.last_deep_dive_at ? { last_deep_dive_at: data.last_deep_dive_at } : {}),
    ...(data.kill_switch_triggered_at
      ? { kill_switch_triggered_at: data.kill_switch_triggered_at }
      : {}),
    ...(briefingMode ? { briefing_mode: briefingMode } : {}),
    ...(data.exceptions_count ? { exceptions_count: Number(data.exceptions_count) } : {}),
    ...(data.watchlist_count ? { watchlist_count: Number(data.watchlist_count) } : {}),
    ...(leadRoute ? { lead_route: leadRoute } : {}),
    ...(data.lead_ticker ? { lead_ticker: data.lead_ticker.trim().toUpperCase() } : {}),
    ...(data.lead_report_id ? { lead_report_id: data.lead_report_id } : {}),
    ...(data.lead_pulse_date ? { lead_pulse_date: data.lead_pulse_date } : {}),
    ...(data.lead_digest_date ? { lead_digest_date: data.lead_digest_date } : {}),
    ...(data.relationship_id ? { relationship_id: data.relationship_id } : {}),
    ...(data.source_ticker ? { source_ticker: data.source_ticker.trim().toUpperCase() } : {}),
    ...(data.affected_ticker ? { affected_ticker: data.affected_ticker.trim().toUpperCase() } : {}),
    ...(data.relationship_type ? { relationship_type: data.relationship_type } : {}),
    ...(data.relationship_confidence
      ? { relationship_confidence: Number(data.relationship_confidence) }
      : {}),
    ...(data.relationship_source_report_id
      ? { relationship_source_report_id: data.relationship_source_report_id }
      : {}),
    ...(data.propagation_trigger_key ? { propagation_trigger_key: data.propagation_trigger_key } : {}),
    ...(data.propagation_signal_type ? { propagation_signal_type: data.propagation_signal_type } : {}),
    ...(data.propagation_event_id ? { propagation_event_id: data.propagation_event_id } : {}),
    ...(data.propagation_reason ? { propagation_reason: data.propagation_reason } : {})
  };
}

function toAlertLedgerView(record: AlertLedgerRecord) {
  return {
    id: record.id,
    user_id: record.userId,
    notification_type: record.notificationType,
    category: record.category,
    route: record.route,
    title: record.title,
    body: record.body,
    reason_code: record.reasonCode,
    reason_text: record.reasonText,
    delivery_state: record.deliveryState,
    feedback_state: record.feedbackState,
    muted_at: record.mutedAt,
    context: record.context,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function toNameRelationshipView(record: NameRelationshipRecord): NameRelationshipItem {
  return {
    relationship_id: record.relationshipId,
    user_id: record.userId,
    source_ticker: record.sourceTicker,
    target_ticker: record.targetTicker,
    relationship_type: record.relationshipType,
    confidence: record.confidence,
    state: record.state,
    source_report_id: record.sourceReportId,
    prompt_version: record.promptVersion,
    evidence_text: record.evidenceText,
    rationale: record.rationale,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    suppressed_at: record.suppressedAt
  };
}

function toConvictionJournalEntryView(
  record: ConvictionJournalEntryRecord
): ConvictionJournalEntry {
  return {
    journal_entry_id: record.id,
    user_id: record.userId,
    ticker: record.ticker,
    event_type: record.eventType,
    source_type: record.sourceType,
    source_id: record.sourceId,
    event_at: record.eventAt,
    title: record.title,
    summary: record.summary,
    thesis_snapshot: {
      ...record.thesisSnapshot,
      signal_reasons: record.thesisSnapshot.signal_reasons
        ? [...record.thesisSnapshot.signal_reasons]
        : undefined
    },
    evidence_refs: record.evidenceRefs.map((ref) => ({ ...ref })),
    report_id: record.reportId,
    alert_ledger_id: record.alertLedgerId,
    war_room_id: record.warRoomId,
    monitor_snapshot_key: record.monitorSnapshotKey,
    opposite_case_id: record.oppositeCaseId,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function toConvictionInsightCardView(
  record: ConvictionInsightCardRecord
): ConvictionInsightCard {
  return {
    insight_id: record.id,
    user_id: record.userId,
    period_start: record.periodStart,
    period_end: record.periodEnd,
    insight_type: record.insightType,
    status: record.status,
    title: record.title,
    summary: record.summary,
    findings: record.findings.map((finding) => ({
      ...finding,
      tickers: [...finding.tickers],
      evidence_refs: finding.evidence_refs.map((ref) => ({ ...ref }))
    })),
    source_journal_entry_ids: [...record.sourceJournalEntryIds],
    generated_at: record.generatedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function toOppositeCaseView(record: OppositeCaseReportRecord) {
  return {
    opposite_case_id: record.id,
    user_id: record.userId,
    source_report_id: record.sourceReportId,
    ticker: record.ticker,
    prompt_version: record.promptVersion,
    thesis_summary: record.thesisSummary,
    opposite_case_summary: record.oppositeCaseSummary,
    key_points: record.keyPoints.map((point) => ({
      ...point,
      evidence_refs: point.evidence_refs.map((ref) => ({ ...ref }))
    })),
    shared_evidence_refs: record.sharedEvidenceRefs.map((ref) => ({ ...ref })),
    decisive_factors: [...record.decisiveFactors],
    generated_at: record.generatedAt,
    created_at: record.createdAt
  };
}

function buildScenarioStressRouteTarget(input: {
  scenarioId: ScenarioStressTemplateId;
  scenarioRunId: string;
  ticker?: string;
  ruleId?: string;
}) {
  return {
    open_tab: "research" as const,
    scenario_id: input.scenarioId,
    scenario_run_id: input.scenarioRunId,
    ...(input.ticker ? { ticker: input.ticker } : {}),
    ...(input.ruleId ? { rule_id: input.ruleId } : {})
  };
}

function toScenarioStressTemplateView(
  record: ScenarioStressTemplateRecord
): ScenarioStressTemplate {
  return {
    scenario_id: record.templateId,
    title: record.title,
    summary: record.summary,
    hypothesis: record.hypothesis,
    active: record.isActive,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function toScenarioStressRunView(record: ScenarioStressRunRecord) {
  return {
    scenario_run_id: record.id,
    scenario_id: record.scenarioId,
    user_id: record.userId,
    status: record.status,
    run_mode: record.runMode,
    as_of: record.asOf,
    total_names: record.totalNames,
    impacted_names: record.impactedNames,
    critical_names: record.criticalNames,
    summary: record.summary,
    route: buildScenarioStressRouteTarget({
      scenarioId: record.scenarioId,
      scenarioRunId: record.id
    }),
    created_at: record.createdAt,
    completed_at: record.completedAt
  };
}

function toScenarioStressImpactView(
  record: ScenarioStressImpactRecord,
  run: ScenarioStressRunRecord
): ScenarioStressImpact {
  return {
    scenario_impact_id: record.id,
    scenario_run_id: record.scenarioRunId,
    user_id: record.userId,
    ticker: record.ticker,
    impact_level: record.impactLevel,
    thesis_break_likelihood: record.thesisBreakLikelihood,
    stress_score: record.stressScore,
    rationale: record.rationale,
    evidence_refs: [...record.evidenceRefs],
    route: buildScenarioStressRouteTarget({
      scenarioId: run.scenarioId,
      scenarioRunId: run.id,
      ticker: record.ticker
    }),
    created_at: record.createdAt
  };
}

function toScenarioStressRuleSuggestionView(
  record: ScenarioStressRuleSuggestionRecord,
  run: ScenarioStressRunRecord
): ScenarioStressRuleSuggestion {
  return {
    scenario_rule_suggestion_id: record.id,
    scenario_run_id: record.scenarioRunId,
    user_id: record.userId,
    ticker: record.ticker,
    signal_type: record.signalType,
    direction: record.direction,
    condition_text: record.conditionText,
    rationale: record.rationale,
    confidence: record.confidence,
    route: buildScenarioStressRouteTarget({
      scenarioId: run.scenarioId,
      scenarioRunId: run.id,
      ticker: record.ticker,
      ruleId: record.id
    }),
    created_at: record.createdAt
  };
}

function buildScenarioStressRunResponse(input: {
  run: ScenarioStressRunRecord;
  impacts: ScenarioStressImpactRecord[];
  suggestions: ScenarioStressRuleSuggestionRecord[];
}): ScenarioStressRunResponse {
  return {
    data: {
      run: toScenarioStressRunView(input.run),
      impacts: input.impacts.map((impact) => toScenarioStressImpactView(impact, input.run)),
      rule_suggestions: input.suggestions.map((suggestion) =>
        toScenarioStressRuleSuggestionView(suggestion, input.run)
      )
    }
  };
}

interface ComparableDeepDiveSummary {
  report_id: string;
  generated_at: string;
  schema_version: string;
  ticker?: string;
  signal_value?: string;
  confidence_label?: string;
  confidence_score?: number;
  thesis_statement?: string;
  valuation_mid?: number;
  trust_metadata?: AnalysisReport["trust_metadata"];
}

interface MonitorStateSummary {
  state: ThesisMonitorSnapshot["state"];
  reason: string;
  score: number;
}

interface MonitorFreshnessSummary {
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  freshnessState: ThesisFreshnessState;
  freshnessScore: number;
  killSwitchTriggeredAt?: string;
  freshnessReason: string;
}

async function fetchInternalJson<T>(
  url: string,
  body: Record<string, unknown> | undefined,
  internalToken: string
): Promise<InternalJsonResponse<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": internalToken
    },
    body: body ? JSON.stringify(body) : "{}"
  });
  const payload = (await response.json()) as T;
  return {
    status: response.status,
    ok: response.ok,
    payload
  };
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void {
  response.writeHead(statusCode, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}

function sendBinary(
  response: ServerResponse,
  statusCode: number,
  body: Buffer,
  contentType: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": String(body.byteLength),
    ...headers
  });
  response.end(body);
}

function appendVaryHeader(response: ServerResponse, value: string): void {
  const existing = response.getHeader("vary");
  if (typeof existing === "string" && existing.length > 0) {
    const values = new Set(
      existing
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    );
    values.add(value);
    response.setHeader("vary", [...values].join(", "));
    return;
  }

  response.setHeader("vary", value);
}

function applySecurityHeaders(response: ServerResponse, nodeEnv: string): void {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (nodeEnv === "production") {
    response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
}

function applyCorsHeaders(response: ServerResponse, origin: string): void {
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader("access-control-allow-methods", corsAllowedMethods);
  response.setHeader("access-control-allow-headers", corsAllowedHeaders);
  response.setHeader("access-control-max-age", "600");
  appendVaryHeader(response, "Origin");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureAdminBootstrapUser(runtime: Runtime): Promise<UserRecord | undefined> {
  if (!runtime.config.adminBootstrapEnabled) {
    return undefined;
  }

  const email = runtime.config.adminBootstrapEmail;
  const passwordHash = runtime.config.adminBootstrapPasswordHash;
  if (!email || !passwordHash) {
    return undefined;
  }

  const nowIso = new Date().toISOString();
  let user = await runtime.store.findUserByEmail(email);

  if (!user) {
    user = await runtime.store.createUser({
      email,
      passwordHash
    });
  }
  if (!user) {
    user = await runtime.store.findUserByEmail(email);
  }
  if (!user) {
    return undefined;
  }

  if (user.passwordHash !== passwordHash) {
    const updated = await runtime.store.updateUserPasswordHash(user.id, passwordHash);
    if (updated) {
      user = updated;
    }
  }

  if (runtime.config.adminBootstrapAutoVerify && !user.verifiedAt) {
    const verified = await runtime.store.markUserVerified(user.id, nowIso);
    if (verified) {
      user = verified;
    }
  }

  if (runtime.config.adminBootstrapForcePro) {
    await runtime.store.upsertUserSubscription({
      userId: user.id,
      tier: "PRO",
      updatedAt: nowIso
    });
  }

  return user;
}

async function maybeBootstrapAdminForLogin(
  runtime: Runtime,
  email: string,
  password: string
): Promise<void> {
  if (!runtime.config.adminBootstrapEnabled) {
    return;
  }

  const bootstrapEmail = runtime.config.adminBootstrapEmail;
  const bootstrapPasswordHash = runtime.config.adminBootstrapPasswordHash;
  if (!bootstrapEmail || !bootstrapPasswordHash) {
    return;
  }

  if (email !== bootstrapEmail) {
    return;
  }

  let passwordMatches = false;
  try {
    passwordMatches = await verifyPassword(password, bootstrapPasswordHash);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    return;
  }

  await ensureAdminBootstrapUser(runtime);
}

function extractClientIp(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

function routeBucket(pathname: string): string {
  if (pathname.startsWith("/jobs/")) {
    return "/jobs/:id";
  }

  if (pathname.startsWith("/reports/")) {
    return "/reports/:id";
  }

  if (pathname.startsWith("/pulse/")) {
    return "/pulse/:date";
  }

  if (pathname.startsWith("/watchlist/")) {
    return "/watchlist/:ticker";
  }

  if (pathname.startsWith("/v1/user/alerts/")) {
    return "/v1/user/alerts/:id";
  }

  return pathname;
}

interface RequestRateLimitPolicy {
  routeKey: string;
  windowSeconds: number;
  maxRequests: number;
  authRoute: boolean;
}

function resolveRateLimitPolicy(
  config: ProductApiConfig,
  method: string,
  pathname: string
): RequestRateLimitPolicy {
  if (method === "POST" && pathname === "/auth/login") {
    return {
      routeKey: "/auth/login",
      windowSeconds: config.authRateLimitWindowSeconds,
      maxRequests: config.authRateLimitLoginMaxRequests,
      authRoute: true
    };
  }

  if (method === "POST" && pathname === "/auth/register") {
    return {
      routeKey: "/auth/register",
      windowSeconds: config.authRateLimitWindowSeconds,
      maxRequests: config.authRateLimitRegisterMaxRequests,
      authRoute: true
    };
  }

  if (method === "POST" && pathname === "/auth/refresh") {
    return {
      routeKey: "/auth/refresh",
      windowSeconds: config.authRateLimitWindowSeconds,
      maxRequests: config.authRateLimitRefreshMaxRequests,
      authRoute: true
    };
  }

  if (pathname.startsWith("/auth/")) {
    return {
      routeKey: routeBucket(pathname),
      windowSeconds: config.authRateLimitWindowSeconds,
      maxRequests: config.authRateLimitLoginMaxRequests,
      authRoute: true
    };
  }

  return {
    routeKey: routeBucket(pathname),
    windowSeconds: config.rateLimitWindowSeconds,
    maxRequests: config.rateLimitMaxRequests,
    authRoute: false
  };
}

function secondsUntilIso(isoTimestamp: string, nowEpochMs: number = Date.now()): number {
  const targetEpochMs = Date.parse(isoTimestamp);
  if (!Number.isFinite(targetEpochMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((targetEpochMs - nowEpochMs) / 1000));
}

function parseBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function extractRequestOrigin(request: IncomingMessage): string | undefined {
  const header = request.headers.origin;
  if (typeof header !== "string") {
    return undefined;
  }
  const origin = header.trim();
  return origin.length > 0 ? origin : undefined;
}

function hasInternalToken(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers["x-internal-token"];
  if (typeof header !== "string") {
    return false;
  }
  const providedBytes = Buffer.from(header, "utf-8");
  const expectedBytes = Buffer.from(expectedToken, "utf-8");
  const comparisonLength = Math.max(providedBytes.length, expectedBytes.length, 1);
  const providedPadded = Buffer.alloc(comparisonLength);
  const expectedPadded = Buffer.alloc(comparisonLength);
  providedBytes.copy(providedPadded);
  expectedBytes.copy(expectedPadded);
  const matches = timingSafeEqual(providedPadded, expectedPadded);
  return matches && providedBytes.length === expectedBytes.length;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalEvent(value: unknown): value is CanonicalEvent {
  if (!isPlainRecord(value)) {
    return false;
  }
  const source = value.source;
  if (!isPlainRecord(source) || !isPlainRecord(source.source)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    (value.family === "filing_posted" || value.family === "macro_release_published") &&
    (value.subject_type === "ticker" || value.subject_type === "macro_series") &&
    typeof value.subject_id === "string" &&
    typeof value.title === "string" &&
    typeof value.occurred_at === "string" &&
    (value.source_state === "official" || value.source_state === "partial" || value.source_state === "missing") &&
    typeof value.retrieved_at === "string" &&
    Array.isArray(value.missing_fields) &&
    isPlainRecord(value.metadata)
  );
}

function isEvidenceRightsMetadata(value: unknown): value is EvidenceRightsMetadata {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    evidenceRightsClasses.includes(value.rights_class as EvidenceRightsMetadata["rights_class"]) &&
    evidenceDisplayModes.includes(value.display_mode as EvidenceRightsMetadata["display_mode"]) &&
    evidenceSourceRanks.includes(value.source_rank as EvidenceRightsMetadata["source_rank"]) &&
    typeof value.source_type === "string" &&
    typeof value.can_store_full_text === "boolean" &&
    typeof value.can_display_excerpt === "boolean" &&
    typeof value.can_display_link === "boolean" &&
    typeof value.policy_reason === "string" &&
    typeof value.reviewed_at === "string"
  );
}

function isFirstPartyContextItem(value: unknown): value is FirstPartyContextItem {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    typeof value.context_id === "string" &&
    typeof value.ticker === "string" &&
    typeof value.registry_entry_id === "string" &&
    typeof value.source_url === "string" &&
    typeof value.source_domain === "string" &&
    firstPartyPageTypes.includes(value.page_type as FirstPartyContextItem["page_type"]) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.retrieved_at === "string" &&
    typeof value.content_hash === "string" &&
    firstPartyFetchStates.includes(value.fetch_state as FirstPartyContextItem["fetch_state"]) &&
    isEvidenceRightsMetadata(value.rights) &&
    Array.isArray(value.artifact_ids) &&
    isPlainRecord(value.metadata)
  );
}

function isCallArtifact(value: unknown): value is CallArtifact {
  if (!isPlainRecord(value)) {
    return false;
  }
  return (
    typeof value.artifact_id === "string" &&
    typeof value.ticker === "string" &&
    callArtifactTypes.includes(value.artifact_type as CallArtifact["artifact_type"]) &&
    typeof value.title === "string" &&
    typeof value.source_url === "string" &&
    typeof value.source_domain === "string" &&
    typeof value.retrieved_at === "string" &&
    callArtifactCompletenessStates.includes(
      value.completeness_state as CallArtifact["completeness_state"]
    ) &&
    isEvidenceRightsMetadata(value.rights) &&
    isPlainRecord(value.metadata)
  );
}

function setRequestJsonBodyLimit(request: IncomingMessage, maxBytes: number): void {
  const safeMaxBytes = Number.isFinite(maxBytes) && maxBytes > 0
    ? Math.floor(maxBytes)
    : defaultMaxJsonBodyBytes;
  (request as IncomingMessageWithBodyLimit)[requestJsonBodyLimitKey] = safeMaxBytes;
}

function getRequestJsonBodyLimit(request: IncomingMessage): number {
  const configured = (request as IncomingMessageWithBodyLimit)[requestJsonBodyLimitKey];
  if (typeof configured !== "number" || !Number.isFinite(configured) || configured <= 0) {
    return defaultMaxJsonBodyBytes;
  }
  return configured;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    let bodyBytes = 0;
    let payloadTooLarge = false;
    let finished = false;
    const maxBytes = getRequestJsonBodyLimit(request);

    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      if (finished) {
        return;
      }

      bodyBytes += Buffer.byteLength(chunk, "utf-8");
      if (bodyBytes > maxBytes) {
        payloadTooLarge = true;
        return;
      }

      body += chunk;
    });
    request.on("end", () => {
      if (finished) {
        return;
      }

      finished = true;
      if (payloadTooLarge) {
        reject(new PayloadTooLargeError(maxBytes));
        return;
      }

      if (!body.trim()) {
        resolve({} as T);
        return;
      }

      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", (error) => {
      if (finished) {
        return;
      }
      finished = true;
      reject(error);
    });
  });
}

function buildJobStatusResponse(job: JobRecord): JobStatusResponse {
  return {
    job_id: job.id,
    type: job.type,
    status: job.status,
    ticker: job.ticker,
    report_id: job.reportId,
    created_at: job.createdAt,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    error_message: job.errorMessage
  };
}

function buildReportListItem(report: {
  id: string;
  jobId: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  schemaVersion: string;
  createdAt: string;
}): ReportListItem {
  return {
    report_id: report.id,
    job_id: report.jobId,
    type: report.type,
    ticker: report.ticker,
    schema_version: report.schemaVersion,
    created_at: report.createdAt
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function normalizeDateInput(value: string): string | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  if (!isValidMarketDate(normalized)) {
    return undefined;
  }
  return normalized;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number | undefined {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (parsed < minimum || parsed > maximum) {
    return undefined;
  }

  return parsed;
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function subtractDaysIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function extractThesisStatement(report: AnalysisReport): string | undefined {
  const section = report.sections.find((entry) =>
    entry.section_id === "thesis_statement" ||
    entry.title.trim().toLowerCase() === "thesis statement"
  );
  const body = section?.body?.trim();
  return body && body.length > 0 ? body : undefined;
}

function toComparableSummary(report: AnalysisReport): ComparableDeepDiveSummary {
  return {
    report_id: report.report_id,
    generated_at: report.generated_at,
    schema_version: report.schema_version,
    ticker: report.ticker,
    signal_value: report.signal?.value,
    confidence_label: report.confidence?.label,
    confidence_score: report.confidence?.score,
    thesis_statement: extractThesisStatement(report),
    valuation_mid: report.valuation?.fair_value_mid,
    trust_metadata: report.trust_metadata
  };
}

function toFeedbackQueueView(record: UserFeedbackQueueRecord): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    feedback_type: record.feedbackType,
    code: record.code,
    severity: record.severity,
    source_surface: record.sourceSurface,
    user_tier: record.userTier,
    report_id: record.reportId ?? null,
    ticker: record.ticker ?? null,
    message: record.message,
    metadata: record.metadata,
    triage_status: record.triageStatus,
    route_status: record.routeStatus,
    triage_owner: record.triageOwner ?? null,
    triaged_at: record.triagedAt ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function normalizeFeedbackMessage(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length > maxLength) {
    return undefined;
  }
  return trimmed;
}

function deepDiveFingerprint(input: {
  ticker: string;
  schemaVersion: string;
  latestPeriod?: string;
}): string {
  const latestPeriod = input.latestPeriod?.trim().toUpperCase() || "LATEST_UNKNOWN";
  return `${input.ticker.trim().toUpperCase()}|${input.schemaVersion.trim()}|${latestPeriod}`;
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

function watchlistLimitForTier(tier: SubscriptionTier): number {
  return tier === "PRO" ? 20 : 5;
}

function dailyDeepDiveLimitForTier(tier: SubscriptionTier): number {
  return tier === "PRO" ? -1 : 1;
}

function remainingDeepDives(limit: number, usedToday: number): number {
  if (limit < 0) {
    return -1;
  }
  return Math.max(0, limit - usedToday);
}

function buildUpgradeRequiredPayload(feature: string, errorMessage: string): Record<string, unknown> {
  return {
    error: "upgrade_required",
    feature,
    error_message: errorMessage
  };
}

async function buildUserProfile(
  runtime: Runtime,
  userId: string
): Promise<UserProfile | undefined> {
  const user = await runtime.store.findUserById(userId);
  if (!user) {
    return undefined;
  }

  const subscription = await runtime.store.getUserSubscription(userId);
  const watchlistLimit = watchlistLimitForTier(subscription.tier);
  const deepDiveLimit = dailyDeepDiveLimitForTier(subscription.tier);
  const usageDate = dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
  const usedToday =
    deepDiveLimit < 0
      ? 0
      : await runtime.store.getDailyDeepDiveUsage(userId, usageDate);

  return {
    user_id: user.id,
    email: user.email,
    tier: subscription.tier,
    billing_period_end: subscription.billingPeriodEnd,
    watchlist_limit: watchlistLimit,
    daily_deep_dive_limit: deepDiveLimit,
    deep_dives_remaining_today: remainingDeepDives(deepDiveLimit, usedToday)
  };
}

async function fetchCalendarEventsFromDataOpenbb(
  runtime: Runtime,
  input: {
    requestId: string;
    startDate: string;
    endDate: string;
  }
): Promise<CalendarEventSource[]> {
  const response = await fetchInternalJson<Record<string, unknown>>(
    `${runtime.config.marketPulseDataOpenbbBaseUrl}/internal/calendar/earnings`,
    {
      start_date: input.startDate,
      end_date: input.endDate
    },
    runtime.config.internalWorkerToken
  );

  if (!response.ok) {
    throw new Error(
      `calendar source failed with status ${response.status}: ${JSON.stringify(response.payload)}`
    );
  }

  const data = isObject(response.payload.data) ? response.payload.data : undefined;
  const eventsRaw = data?.events;
  if (!Array.isArray(eventsRaw)) {
    return [];
  }

  const events: CalendarEventSource[] = [];
  for (const row of eventsRaw) {
    if (!isObject(row)) {
      continue;
    }
    const ticker = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
    const eventDate = typeof row.event_date === "string" ? row.event_date.trim() : "";
    if (!ticker || !eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      continue;
    }
    const eventTimeRaw = typeof row.event_time === "string" ? row.event_time.trim() : undefined;
    const eventTime =
      eventTimeRaw === "before_market" ||
      eventTimeRaw === "after_market" ||
      eventTimeRaw === "during_market"
        ? eventTimeRaw
        : undefined;
    const provider =
      typeof row.provider === "string" && row.provider.trim().length > 0
        ? row.provider.trim()
        : "calendar_feed";
    const retrievedAt =
      typeof row.retrieved_at === "string" && row.retrieved_at.trim().length > 0
        ? row.retrieved_at
        : new Date().toISOString();
    const timingState = normalizeEarningsTimingState(
      typeof row.timing_state === "string" ? row.timing_state.trim() : undefined
    );
    const sourceState = normalizeEarningsSourceState(
      typeof row.source_state === "string" ? row.source_state.trim() : undefined,
      provider
    );
    const sourceRef =
      isObject(row.source_ref) ? { ...row.source_ref } : {};
    const reasonTextRaw =
      typeof row.reason_text === "string" ? row.reason_text.trim() : "";
    const reasonText =
      reasonTextRaw.length > 0
        ? reasonTextRaw
        : timingState === "confirmed"
          ? "Company or official source confirms the earnings timing."
          : "Earnings timing is estimated pending stronger source confirmation.";
    events.push({
      ticker,
      event_type: "earnings",
      event_date: eventDate,
      event_time: eventTime,
      provider,
      retrieved_at: retrievedAt,
      timing_state: timingState,
      source_state: sourceState,
      source_ref: sourceRef,
      reason_text: reasonText
    });
  }
  return events;
}

async function createContrarianAnchorFromReport(
  runtime: Runtime,
  input: {
    report: AnalysisReport;
    userId?: string;
    requestId: string;
    route: string;
  }
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }
  const signalValue = asContrarianSignal(report.signal?.value);
  if (!signalValue) {
    return;
  }

  const ticker = report.ticker.trim().toUpperCase();
  let anchorPrice: number | undefined;
  try {
    anchorPrice = await fetchLatestClosePrice(runtime.config.sentimentYahooBaseUrl, ticker);
  } catch (error) {
    const message = error instanceof Error ? error.message : "anchor price lookup failed";
    logWarn("Contrarian anchor skipped due to missing anchor price", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      error_message: message
    });
    await appendAudit(runtime, "contrarian.anchor_skipped", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      signal_value: signalValue,
      reason: "anchor_price_unavailable"
    }, userId);
    return;
  }

  if (!anchorPrice || !Number.isFinite(anchorPrice) || anchorPrice <= 0) {
    await appendAudit(runtime, "contrarian.anchor_skipped", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      signal_value: signalValue,
      reason: "anchor_price_invalid"
    }, userId);
    return;
  }

  const anchoredAt = new Date().toISOString();
  const expiresAt = addHours(anchoredAt, contrarianAnchorWindowDays * 24);
  await runtime.store.createContrarianAlertAnchor({
    id: createId(),
    userId,
    ticker,
    reportId: report.report_id,
    signalValue,
    anchorPrice,
    anchoredAt,
    expiresAt,
    isActive: true
  });

  await appendAudit(runtime, "contrarian.anchor_created", {
    request_id: input.requestId,
    route: input.route,
    report_id: report.report_id,
    ticker,
    signal_value: signalValue,
    anchor_price: anchorPrice,
    expires_at: expiresAt
  }, userId);
}

function normalizeKillSwitchSignalType(value: string | undefined): KillSwitchSignalType {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "price_move_pct":
    case "price_move":
      return "price_move_pct";
    case "thesis_state":
    case "thesis_drift":
      return "thesis_state";
    case "earnings_event":
    case "earnings":
      return "earnings_event";
    case "sec_filing":
    case "filing":
      return "sec_filing";
    case "guidance_revision":
    case "guidance":
      return "guidance_revision";
    case "management_change":
      return "management_change";
    case "macro_regime":
    case "macro":
      return "macro_regime";
    case "analyst_rerating":
    case "analyst":
      return "analyst_rerating";
    case "news_sentiment":
    case "sentiment":
      return "news_sentiment";
    default:
      return "custom";
  }
}

function sanitizeKillSwitchConditionDrafts(
  report: AnalysisReport
): KillSwitchConditionDraft[] {
  const raw = report.kill_switch_conditions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: KillSwitchConditionDraft[] = [];
  for (const [index, candidate] of raw.entries()) {
    const conditionText =
      typeof candidate.condition_text === "string" ? candidate.condition_text.trim() : "";
    const rationale =
      typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
    if (conditionText.length === 0 || rationale.length === 0) {
      continue;
    }
    const conditionId =
      typeof candidate.condition_id === "string" && candidate.condition_id.trim().length > 0
        ? candidate.condition_id.trim()
        : `ks_${index + 1}`;
    const thresholdValue =
      typeof candidate.threshold_value === "number" && Number.isFinite(candidate.threshold_value)
        ? candidate.threshold_value
        : undefined;
    const thresholdUnit =
      candidate.threshold_unit === "pct" ||
      candidate.threshold_unit === "count" ||
      candidate.threshold_unit === "score" ||
      candidate.threshold_unit === "days"
        ? candidate.threshold_unit
        : undefined;
    const direction =
      candidate.direction === "against_signal" ||
      candidate.direction === "above" ||
      candidate.direction === "below" ||
      candidate.direction === "any"
        ? candidate.direction
        : undefined;

    parsed.push({
      condition_id: conditionId,
      condition_text: conditionText,
      signal_type: normalizeKillSwitchSignalType(
        typeof candidate.signal_type === "string" ? candidate.signal_type : undefined
      ),
      rationale,
      ...(thresholdValue !== undefined ? { threshold_value: thresholdValue } : {}),
      ...(thresholdUnit ? { threshold_unit: thresholdUnit } : {}),
      ...(direction ? { direction } : {}),
      ...(typeof candidate.prompt_version === "string" &&
      candidate.prompt_version.trim().length > 0
        ? { prompt_version: candidate.prompt_version.trim() }
        : {})
    });
  }
  return parsed.slice(0, 5);
}

async function createKillSwitchRulesFromReport(
  runtime: Runtime,
  input: {
    report: AnalysisReport;
    userId?: string;
    requestId: string;
    route: string;
  }
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }

  const sanitized = sanitizeKillSwitchConditionDrafts(report);
  if (sanitized.length < 3) {
    logWarn("Kill-switch rule extraction skipped due to insufficient conditions", {
      request_id: input.requestId,
      route: input.route,
      report_id: report.report_id,
      ticker: report.ticker,
      condition_count: sanitized.length
    });
    await appendAudit(
      runtime,
      "kill_switch.rules_skipped",
      {
        request_id: input.requestId,
        route: input.route,
        report_id: report.report_id,
        ticker: report.ticker,
        condition_count: sanitized.length,
        reason: "insufficient_conditions"
      },
      userId
    );
    return;
  }

  const ticker = report.ticker.trim().toUpperCase();
  const hasPriceMoveRule = sanitized.some((rule) => rule.signal_type === "price_move_pct");
  const signalValue = asContrarianSignal(report.signal?.value);
  let anchorPrice: number | undefined;
  if (hasPriceMoveRule) {
    try {
      anchorPrice = await fetchLatestClosePrice(runtime.config.sentimentYahooBaseUrl, ticker);
    } catch (error) {
      const message = error instanceof Error ? error.message : "anchor price lookup failed";
      logWarn("Kill-switch rules falling back without anchor price", {
        request_id: input.requestId,
        route: input.route,
        report_id: report.report_id,
        ticker,
        error_message: message
      });
    }
  }

  const now = new Date().toISOString();
  await runtime.store.deactivateActiveKillSwitchRulesByUserTicker({
    userId,
    ticker,
    deactivatedAt: now
  });
  for (const condition of sanitized) {
    await runtime.store.createKillSwitchRule({
      id: createId(),
      userId,
      ticker,
      reportId: report.report_id,
      signalValue,
      anchorPrice,
      conditionId: condition.condition_id,
      conditionText: condition.condition_text,
      signalType: condition.signal_type,
      rationale: condition.rationale,
      thresholdValue: condition.threshold_value,
      thresholdUnit: condition.threshold_unit,
      direction: condition.direction,
      promptVersion: condition.prompt_version ?? "unknown",
      state: "active",
      source: "dexter_prompt",
      createdAt: now,
      updatedAt: now
    });
  }

  logInfo("Kill-switch rules created", {
    request_id: input.requestId,
    route: input.route,
    report_id: report.report_id,
    ticker,
    rule_count: sanitized.length
  });
  await appendAudit(
    runtime,
    "kill_switch.rules_created",
    {
      request_id: input.requestId,
      route: input.route,
      report_id: report.report_id,
      ticker,
      rule_count: sanitized.length
    },
    userId
  );
}

function normalizeTickerSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(ticker)) {
    return undefined;
  }
  return ticker;
}

function stableNameRelationshipId(input: {
  userId: string;
  sourceTicker: string;
  targetTicker: string;
  relationshipType: NameRelationshipType;
}): string {
  const hash = createHash("sha256")
    .update(`${input.userId}|${input.sourceTicker}|${input.targetTicker}|${input.relationshipType}`)
    .digest("hex")
    .slice(0, 24);
  return `nr_${hash}`;
}

function sanitizeNameRelationshipDrafts(input: {
  relationships: NameRelationshipDraft[] | undefined;
  userId: string;
  reportId: string;
  reportTicker?: string;
}): NameRelationshipRecord[] {
  if (!Array.isArray(input.relationships)) {
    return [];
  }

  const reportTicker = normalizeTickerSymbol(input.reportTicker);
  const now = new Date().toISOString();
  const parsed: NameRelationshipRecord[] = [];
  const seen = new Set<string>();

  for (const candidate of input.relationships) {
    let sourceTicker = normalizeTickerSymbol(candidate.source_ticker);
    let targetTicker = normalizeTickerSymbol(candidate.target_ticker);
    if (!sourceTicker || !targetTicker || sourceTicker === targetTicker) {
      continue;
    }

    if (reportTicker && sourceTicker === reportTicker && targetTicker !== reportTicker) {
      [sourceTicker, targetTicker] = [targetTicker, sourceTicker];
    }
    if (reportTicker && targetTicker !== reportTicker) {
      continue;
    }

    if (!isNameRelationshipType(candidate.relationship_type)) {
      continue;
    }
    const confidence =
      typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : undefined;
    const evidenceText =
      typeof candidate.evidence_text === "string" ? candidate.evidence_text.trim() : "";
    const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
    if (confidence === undefined || evidenceText.length === 0 || rationale.length === 0) {
      continue;
    }

    const relationshipId =
      typeof candidate.relationship_id === "string" && candidate.relationship_id.trim().length > 0
        ? candidate.relationship_id.trim()
        : stableNameRelationshipId({
            userId: input.userId,
            sourceTicker,
            targetTicker,
            relationshipType: candidate.relationship_type
          });
    if (seen.has(relationshipId)) {
      continue;
    }
    seen.add(relationshipId);

    parsed.push({
      relationshipId,
      userId: input.userId,
      sourceTicker,
      targetTicker,
      relationshipType: candidate.relationship_type,
      confidence,
      state: "active",
      sourceReportId: input.reportId,
      promptVersion:
        typeof candidate.prompt_version === "string" && candidate.prompt_version.trim().length > 0
          ? candidate.prompt_version.trim()
          : "unknown",
      evidenceText,
      rationale,
      createdAt: now,
      updatedAt: now
    });
  }

  return parsed;
}

async function upsertNameRelationships(
  runtime: Runtime,
  input: {
    userId: string;
    reportId: string;
    reportTicker?: string;
    relationships: NameRelationshipDraft[] | undefined;
    requestId: string;
    route: string;
  }
): Promise<number> {
  const sanitized = sanitizeNameRelationshipDrafts({
    userId: input.userId,
    reportId: input.reportId,
    reportTicker: input.reportTicker,
    relationships: input.relationships
  });

  for (const relationship of sanitized) {
    await runtime.store.upsertNameRelationship(relationship);
  }

  if (sanitized.length > 0) {
    logInfo("Name relationships upserted", {
      request_id: input.requestId,
      route: input.route,
      report_id: input.reportId,
      relationship_count: sanitized.length
    });
    await appendAudit(
      runtime,
      "name_relationships.upserted",
      {
        request_id: input.requestId,
        route: input.route,
        report_id: input.reportId,
        relationship_count: sanitized.length
      },
      input.userId
    );
  }

  return sanitized.length;
}

async function createNameRelationshipsFromReport(
  runtime: Runtime,
  input: {
    report: AnalysisReport;
    userId?: string;
    requestId: string;
    route: string;
  }
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }

  await upsertNameRelationships(runtime, {
    userId,
    reportId: report.report_id,
    reportTicker: report.ticker,
    relationships: report.name_relationships,
    requestId: input.requestId,
    route: input.route
  });
}

function asCrossNamePropagationSignalSource(
  value: string | undefined
): CrossNamePropagationSignalSource {
  return value === "event" ? "event" : "daily";
}

function asCrossNamePropagationEventCategory(
  value: string | undefined,
  signalType: KillSwitchSignalType
): CrossNamePropagationEventCategory {
  if (value === "macro" || signalType === "macro_regime") {
    return "macro";
  }
  return "thesis_drift";
}

function asCrossNamePropagationFixture(
  value: unknown
): CrossNamePropagationEventFixture | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const sourceTicker = normalizeTickerSymbol(candidate.source_ticker);
  if (!sourceTicker) {
    return undefined;
  }
  const signalType = normalizeKillSwitchSignalType(
    typeof candidate.signal_type === "string" ? candidate.signal_type : undefined
  );
  const eventCategory = asCrossNamePropagationEventCategory(
    typeof candidate.event_category === "string" ? candidate.event_category : undefined,
    signalType
  );
  const metadata =
    typeof candidate.metadata === "object" && candidate.metadata !== null && !Array.isArray(candidate.metadata)
      ? Object.fromEntries(
          Object.entries(candidate.metadata as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;

  return {
    source_ticker: sourceTicker,
    signal_type: signalType,
    event_category: eventCategory,
    event_id:
      typeof candidate.event_id === "string" && candidate.event_id.trim().length > 0
        ? candidate.event_id.trim()
        : undefined,
    source_report_id:
      typeof candidate.source_report_id === "string" && candidate.source_report_id.trim().length > 0
        ? candidate.source_report_id.trim()
        : undefined,
    reason_text:
      typeof candidate.reason_text === "string" && candidate.reason_text.trim().length > 0
        ? candidate.reason_text.trim()
        : undefined,
    occurred_at:
      typeof candidate.occurred_at === "string" && candidate.occurred_at.trim().length > 0
        ? candidate.occurred_at.trim()
        : undefined,
    metadata
  };
}

function normalizeConfidenceThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return crossNamePropagationDefaultConfidenceThreshold;
  }
  return Math.max(crossNamePropagationDefaultConfidenceThreshold, Math.min(1, value));
}

function asKillSwitchSignalSource(
  value: string | undefined
): KillSwitchEvaluationSignalSource {
  if (value === "event") {
    return "event";
  }
  return "daily";
}

function asKillSwitchFixture(
  value: unknown
): KillSwitchEvaluationFixture | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const ticker = typeof candidate.ticker === "string" ? candidate.ticker.trim().toUpperCase() : "";
  const signalType = normalizeKillSwitchSignalType(
    typeof candidate.signal_type === "string" ? candidate.signal_type : undefined
  );
  if (ticker.length === 0) {
    return undefined;
  }
  const metadata =
    typeof candidate.metadata === "object" && candidate.metadata !== null && !Array.isArray(candidate.metadata)
      ? Object.fromEntries(
          Object.entries(candidate.metadata as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;
  return {
    ticker,
    signal_type: signalType,
    value:
      typeof candidate.value === "number" && Number.isFinite(candidate.value)
        ? candidate.value
        : undefined,
    reason_text:
      typeof candidate.reason_text === "string" && candidate.reason_text.trim().length > 0
        ? candidate.reason_text.trim()
        : undefined,
    metadata
  };
}

function evaluatePriceMoveRule(
  rule: KillSwitchRuleRecord,
  currentPrice: number | undefined
): {
  outcome: "matched" | "not_matched" | "skipped";
  reasonCode: string;
  reasonText: string;
  observedValue?: number;
} {
  if (
    !Number.isFinite(rule.anchorPrice) ||
    !rule.anchorPrice ||
    rule.anchorPrice <= 0 ||
    !Number.isFinite(currentPrice)
  ) {
    return {
      outcome: "skipped",
      reasonCode: "price_unavailable",
      reasonText: "Price move could not be evaluated because anchor or current price is unavailable."
    };
  }
  const movePct = (((currentPrice as number) - rule.anchorPrice) / rule.anchorPrice) * 100;
  const threshold = Math.max(
    0.1,
    rule.thresholdValue ?? killSwitchDefaultPriceMoveThresholdPct
  );
  const direction = rule.direction ?? "against_signal";
  let matched = false;
  if (direction === "any") {
    matched = Math.abs(movePct) >= threshold;
  } else if (direction === "above") {
    matched = movePct >= threshold;
  } else if (direction === "below") {
    matched = movePct <= -threshold;
  } else {
    if (rule.signalValue === "negative") {
      matched = movePct >= threshold;
    } else if (rule.signalValue === "positive") {
      matched = movePct <= -threshold;
    } else {
      matched = Math.abs(movePct) >= threshold;
    }
  }

  if (matched) {
    return {
      outcome: "matched",
      reasonCode: "kill_switch_price_move",
      reasonText: `Price moved ${Math.abs(movePct).toFixed(1)}% and crossed kill-switch threshold ${threshold.toFixed(1)}%.`,
      observedValue: Number(movePct.toFixed(4))
    };
  }

  return {
    outcome: "not_matched",
    reasonCode: "kill_switch_no_match",
    reasonText: `Price move ${Math.abs(movePct).toFixed(1)}% did not cross threshold ${threshold.toFixed(1)}%.`,
    observedValue: Number(movePct.toFixed(4))
  };
}

function clampScore(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return clampNumber(value as number, 0, 1);
}

function isoDateFromDateTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function daysSince(earlierIso: string | undefined, laterIso: string): number | undefined {
  if (!earlierIso) {
    return undefined;
  }
  const earlier = Date.parse(earlierIso);
  const later = Date.parse(laterIso);
  if (!Number.isFinite(earlier) || !Number.isFinite(later)) {
    return undefined;
  }
  const delta = Math.floor((later - earlier) / (24 * 60 * 60 * 1000));
  return Math.max(0, delta);
}

function computeMonitorFreshness(input: {
  asOfIso: string;
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  killSwitchTriggeredAt?: string;
  fallbackReason?: string;
}): MonitorFreshnessSummary {
  const materialEventsCount = Math.max(0, Math.floor(input.materialEventsCount));
  const unreviewedEventsCount = Math.max(0, Math.floor(input.unreviewedEventsCount));
  const lastDeepDiveAt =
    typeof input.lastDeepDiveAt === "string" && Number.isFinite(Date.parse(input.lastDeepDiveAt))
      ? input.lastDeepDiveAt
      : undefined;
  const killSwitchTriggeredAt =
    typeof input.killSwitchTriggeredAt === "string" &&
      Number.isFinite(Date.parse(input.killSwitchTriggeredAt))
      ? input.killSwitchTriggeredAt
      : undefined;

  const asOfMillis = Date.parse(input.asOfIso);
  const triggeredLookbackStart = Number.isFinite(asOfMillis)
    ? asOfMillis - freshnessTriggeredLookbackDays * 24 * 60 * 60 * 1000
    : Number.NaN;
  const isTriggered =
    killSwitchTriggeredAt !== undefined &&
    Number.isFinite(triggeredLookbackStart) &&
    Number.isFinite(Date.parse(killSwitchTriggeredAt)) &&
    Date.parse(killSwitchTriggeredAt) >= (triggeredLookbackStart as number);

  const ageDays = daysSince(lastDeepDiveAt, input.asOfIso);

  let freshnessState: ThesisFreshnessState;
  let freshnessReason: string;

  if (isTriggered) {
    freshnessState = "triggered";
    freshnessReason = `Kill-switch conditions fired recently and ${Math.max(
      1,
      unreviewedEventsCount
    )} material event(s) require review.`;
  } else if (ageDays === undefined) {
    freshnessState = "stale";
    freshnessReason = input.fallbackReason ?? "No Deep Dive baseline is available yet.";
  } else if (ageDays > freshnessStaleDays || unreviewedEventsCount >= 3) {
    freshnessState = "stale";
    if (ageDays > freshnessStaleDays && unreviewedEventsCount >= 3) {
      freshnessReason = `Deep Dive is ${ageDays} days old with ${unreviewedEventsCount} unreviewed material event(s).`;
    } else if (ageDays > freshnessStaleDays) {
      freshnessReason = `Deep Dive is ${ageDays} days old and now stale.`;
    } else {
      freshnessReason = `${unreviewedEventsCount} material event(s) remain unreviewed.`;
    }
  } else if (ageDays >= freshnessAgingDays || unreviewedEventsCount >= 1) {
    freshnessState = "aging";
    if (ageDays >= freshnessAgingDays && unreviewedEventsCount >= 1) {
      freshnessReason = `Deep Dive is ${ageDays} days old with ${unreviewedEventsCount} unreviewed material event(s).`;
    } else if (ageDays >= freshnessAgingDays) {
      freshnessReason = `Deep Dive is ${ageDays} days old and should be reviewed soon.`;
    } else {
      freshnessReason = `${unreviewedEventsCount} new material event(s) arrived since your last review.`;
    }
  } else {
    freshnessState = "current";
    freshnessReason = "Deep Dive is fresh and no material events are waiting for review.";
  }

  const agePenalty =
    ageDays === undefined ? 0.55 : Math.min(1, ageDays / Math.max(90, freshnessStaleDays * 2)) * 0.55;
  const eventPenalty = Math.min(1, unreviewedEventsCount / 6) * 0.35;
  const triggerPenalty = isTriggered ? 0.2 : 0;
  const freshnessScore = clampNumber(1 - agePenalty - eventPenalty - triggerPenalty, 0, 1);

  return {
    lastDeepDiveAt,
    materialEventsCount,
    unreviewedEventsCount,
    freshnessState,
    freshnessScore,
    killSwitchTriggeredAt,
    freshnessReason
  };
}

function summarizeMonitorState(
  report: AnalysisReport,
  asOfIso: string
): MonitorStateSummary {
  const trust = report.trust_metadata;
  const score = clampScore(report.confidence?.score);
  const generatedAtMs = Date.parse(report.generated_at);
  const staleCutoffMs = Date.parse(asOfIso) - monitorFreshnessWindowDays * 24 * 60 * 60 * 1000;
  const driftSummary = trust?.thesis_drift?.summary?.toLowerCase() ?? "";
  const driftUnavailable = trust?.thesis_drift?.status === "unavailable";
  const contradictionPresent =
    trust?.contradiction_state === "present" ||
    (trust?.contradictions?.length ?? 0) > 0;

  if (
    trust?.freshness_state === "stale" ||
    contradictionPresent ||
    !Number.isFinite(generatedAtMs) ||
    generatedAtMs < staleCutoffMs ||
    report.signal?.value === "no_signal"
  ) {
    return {
      state: "unresolved",
      reason:
        contradictionPresent
          ? "Evidence is conflicting and needs review."
          : "Evidence is stale or insufficient to confirm thesis state.",
      score
    };
  }

  if (
    driftSummary.includes("weaken") ||
    driftSummary.includes("deteriorat") ||
    driftSummary.includes("risk") ||
    report.signal?.value === "negative"
  ) {
    return {
      state: "weakened",
      reason: "Latest evidence weakens the prior thesis.",
      score
    };
  }

  if (
    driftSummary.includes("improv") ||
    driftSummary.includes("strengthen")
  ) {
    return {
      state: "improved",
      reason: "Latest evidence strengthens conviction versus the prior thesis.",
      score
    };
  }

  if (report.signal?.value === "positive" && !driftUnavailable) {
    return {
      state: "improved",
      reason: "Signal and drift are both supportive of the thesis direction.",
      score
    };
  }

  return {
    state: "intact",
    reason: "Latest evidence remains broadly consistent with the prior thesis.",
    score
  };
}

function isAnalysisReport(value: unknown): value is AnalysisReport {
  if (!isObject(value)) {
    return false;
  }
  if (typeof value.report_id !== "string" || typeof value.generated_at !== "string") {
    return false;
  }
  if (value.type !== "deep_dive" && value.type !== "market_pulse") {
    return false;
  }
  if (!Array.isArray(value.sections)) {
    return false;
  }
  return true;
}

async function upsertUnresolvedSnapshot(
  runtime: Runtime,
  input: {
    userId: string;
    ticker: string;
    reason: string;
    asOfIso: string;
    updatedAt: string;
  }
): Promise<ThesisMonitorSnapshotRecord> {
  const freshness = computeMonitorFreshness({
    asOfIso: input.asOfIso,
    materialEventsCount: 0,
    unreviewedEventsCount: 0,
    fallbackReason: input.reason
  });
  return runtime.store.upsertThesisMonitorSnapshot({
    userId: input.userId,
    ticker: input.ticker.trim().toUpperCase(),
    state: "unresolved",
    reason: input.reason,
    score: 0,
    lastDeepDiveAt: freshness.lastDeepDiveAt,
    materialEventsCount: freshness.materialEventsCount,
    unreviewedEventsCount: freshness.unreviewedEventsCount,
    freshnessState: freshness.freshnessState,
    freshnessScore: freshness.freshnessScore,
    killSwitchTriggeredAt: freshness.killSwitchTriggeredAt,
    freshnessReason: freshness.freshnessReason,
    updatedAt: input.updatedAt
  });
}

async function upsertSnapshotFromReport(
  runtime: Runtime,
  input: {
    userId: string;
    ticker: string;
    report: AnalysisReport;
    asOfIso: string;
    materialEventsCount: number;
    unreviewedEventsCount: number;
    killSwitchTriggeredAt?: string;
    updatedAt: string;
  }
): Promise<ThesisMonitorSnapshotRecord> {
  const summary = summarizeMonitorState(input.report, input.asOfIso);
  const freshness = computeMonitorFreshness({
    asOfIso: input.asOfIso,
    lastDeepDiveAt: input.report.generated_at,
    materialEventsCount: input.materialEventsCount,
    unreviewedEventsCount: input.unreviewedEventsCount,
    killSwitchTriggeredAt: input.killSwitchTriggeredAt
  });
  return runtime.store.upsertThesisMonitorSnapshot({
    userId: input.userId,
    ticker: input.ticker.trim().toUpperCase(),
    state: summary.state,
    reason: summary.reason,
    score: summary.score,
    reportId: input.report.report_id,
    reportGeneratedAt: input.report.generated_at,
    reportSchemaVersion: input.report.schema_version,
    lastDeepDiveAt: freshness.lastDeepDiveAt,
    materialEventsCount: freshness.materialEventsCount,
    unreviewedEventsCount: freshness.unreviewedEventsCount,
    freshnessState: freshness.freshnessState,
    freshnessScore: freshness.freshnessScore,
    killSwitchTriggeredAt: freshness.killSwitchTriggeredAt,
    freshnessReason: freshness.freshnessReason,
    updatedAt: input.updatedAt
  });
}

async function recomputeThesisMonitorSnapshots(
  runtime: Runtime,
  input: {
    asOfIso: string;
    userIds?: string[];
  }
): Promise<{
  users: number;
  names: number;
  unresolved: number;
  updated: number;
}> {
  const asOfDate = input.asOfIso.slice(0, 10);
  const usersWithWatchlist = await runtime.store.listUsersWithWatchlist();
  const filterUserIds = input.userIds
    ? new Set(input.userIds.map((userId) => userId.trim()).filter((userId) => userId.length > 0))
    : undefined;
  const updatedAt = new Date().toISOString();
  let users = 0;
  let names = 0;
  let unresolved = 0;
  let updated = 0;

  for (const entry of usersWithWatchlist) {
    if (filterUserIds && !filterUserIds.has(entry.userId)) {
      continue;
    }
    if (entry.tickers.length === 0) {
      continue;
    }

    users += 1;
    names += entry.tickers.length;

    const reports = (await runtime.store.listReportsByUser(entry.userId))
      .filter((report) => report.type === "deep_dive")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const matchedKillSwitchEvaluations = await runtime.store.listKillSwitchEvaluations({
      userId: entry.userId,
      outcomes: ["matched"],
      limit: 2_000
    });

    for (const ticker of entry.tickers) {
      const latest = reports.find((report) => report.ticker === ticker);
      if (!latest) {
        await upsertUnresolvedSnapshot(runtime, {
          userId: entry.userId,
          ticker,
          reason: "No completed Deep Dive exists yet for this name.",
          asOfIso: input.asOfIso,
          updatedAt
        });
        unresolved += 1;
        updated += 1;
        continue;
      }

      let storedReport: unknown;
      try {
        storedReport = await runtime.artifactStore.readReport(latest.artifactKey);
      } catch {
        await upsertUnresolvedSnapshot(runtime, {
          userId: entry.userId,
          ticker,
          reason: "Report artifact is unavailable and cannot be evaluated.",
          asOfIso: input.asOfIso,
          updatedAt
        });
        unresolved += 1;
        updated += 1;
        continue;
      }

      if (!isAnalysisReport(storedReport) || storedReport.type !== "deep_dive") {
        await upsertUnresolvedSnapshot(runtime, {
          userId: entry.userId,
          ticker,
          reason: "Latest Deep Dive is not readable in monitor format.",
          asOfIso: input.asOfIso,
          updatedAt
        });
        unresolved += 1;
        updated += 1;
        continue;
      }

      const lastDeepDiveAt = storedReport.generated_at;
      const fromDate = isoDateFromDateTime(lastDeepDiveAt) ?? asOfDate;
      const normalizedTicker = ticker.trim().toUpperCase();
      const earningsEvents = await runtime.store.listUpcomingCalendarEventsByTickers({
        tickers: [normalizedTicker],
        fromDate,
        toDate: asOfDate,
        eventType: "earnings"
      });
      const killSwitchMatches = matchedKillSwitchEvaluations.filter((evaluation) => {
        if (evaluation.ticker.trim().toUpperCase() !== normalizedTicker) {
          return false;
        }
        if (!lastDeepDiveAt) {
          return true;
        }
        const createdAtMs = Date.parse(evaluation.createdAt);
        const lastDeepDiveMs = Date.parse(lastDeepDiveAt);
        if (!Number.isFinite(createdAtMs) || !Number.isFinite(lastDeepDiveMs)) {
          return true;
        }
        return createdAtMs >= lastDeepDiveMs;
      });
      const killSwitchTriggeredAt = killSwitchMatches
        .map((entry) => entry.createdAt)
        .sort((left, right) => right.localeCompare(left))[0];
      const materialEventsCount = earningsEvents.length + killSwitchMatches.length;
      const unreviewedEventsCount = materialEventsCount;

      const snapshot = await upsertSnapshotFromReport(runtime, {
        userId: entry.userId,
        ticker,
        report: storedReport,
        asOfIso: input.asOfIso,
        materialEventsCount,
        unreviewedEventsCount,
        killSwitchTriggeredAt,
        updatedAt
      });
      if (snapshot.state === "unresolved") {
        unresolved += 1;
      }
      updated += 1;
    }
  }

  return {
    users,
    names,
    unresolved,
    updated
  };
}

function isMarketPulseReport(report: unknown): report is MarketPulseReport {
  if (!isObject(report)) {
    return false;
  }
  if (typeof report.report_id !== "string" || typeof report.generated_at !== "string") {
    return false;
  }
  if (!isObject(report.sections)) {
    return false;
  }
  return (
    isObject(report.sections.market_moves) &&
    isObject(report.sections.market_tape) &&
    isObject(report.sections.macro_releases) &&
    isObject(report.sections.rates_fx_commodities) &&
    isObject(report.sections.news_summary) &&
    isObject(report.sections.uncertainty_flags)
  );
}

function cloneReusableDeepDiveReport(
  report: AnalysisReport,
  overrides: {
    reportId: string;
    jobId: string;
    generatedAt: string;
  }
): AnalysisReport {
  return {
    ...report,
    report_id: overrides.reportId,
    job_id: overrides.jobId,
    generated_at: overrides.generatedAt
  };
}

function deterministicValuationFactor(assumptions: {
  terminal_growth_rate: number;
  wacc: number;
}): number {
  return (1 + assumptions.terminal_growth_rate) / (assumptions.wacc - assumptions.terminal_growth_rate);
}

const phase6ScenarioDeterministicModel = "phase6_deterministic_v1" as const;

function buildScenarioInputOmissions(
  valuation: NonNullable<AnalysisReport["valuation"]>
): ScenarioInputOmission[] {
  const omissions: ScenarioInputOmission[] = [
    {
      omission_code: "market_beta_omitted",
      omission_text:
        "Phase 6 deterministic scenarios do not use market beta or correlation inputs.",
      affects_fields: ["assumptions.beta", "assumptions.correlation_matrix"]
    }
  ];

  if (!isFiniteNumber(valuation.spot_price)) {
    omissions.push({
      omission_code: "spot_reference_unavailable",
      omission_text:
        "Spot reference is unavailable in this report, so implied upside is omitted in scenario output.",
      affects_fields: ["spot_price", "implied_upside_pct"]
    });
  }

  if (isFiniteNumber(valuation.assumptions.beta)) {
    omissions.push({
      omission_code: "legacy_beta_ignored",
      omission_text:
        "A legacy beta value exists on this report and is ignored by the Phase 6 deterministic scenario model.",
      affects_fields: ["assumptions.beta"]
    });
  }

  return omissions;
}

function assumptionsWithoutLegacyBeta(
  assumptions: NonNullable<AnalysisReport["valuation"]>["assumptions"]
): NonNullable<AnalysisReport["valuation"]>["assumptions"] {
  const normalized: NonNullable<AnalysisReport["valuation"]>["assumptions"] = { ...assumptions };
  delete (normalized as { beta?: number }).beta;
  return normalized;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number = 4): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function isStrictIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed);
}

function previousCalendarMonthPeriod(timeZone: string): {
  periodStart: string;
  periodEnd: string;
} {
  const today = dateInTimeZone(new Date(), timeZone);
  const currentMonth = new Date(`${today.slice(0, 7)}-01T12:00:00.000Z`);
  currentMonth.setUTCMonth(currentMonth.getUTCMonth() - 1);
  const periodStart = currentMonth.toISOString().slice(0, 10);
  currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1);
  currentMonth.setUTCDate(0);
  const periodEnd = currentMonth.toISOString().slice(0, 10);
  return { periodStart, periodEnd };
}

function convictionTextKeywords(text: string | undefined): Set<string> {
  const stopWords = new Set([
    "about",
    "after",
    "against",
    "because",
    "could",
    "from",
    "into",
    "more",
    "that",
    "their",
    "there",
    "these",
    "this",
    "with",
    "your"
  ]);
  const keywords = new Set<string>();
  for (const token of (text ?? "").toLowerCase().match(/[a-z]{5,}/g) ?? []) {
    if (!stopWords.has(token)) {
      keywords.add(token);
    }
  }
  return keywords;
}

function buildOppositeCaseReportRecord(input: {
  report: AnalysisReport;
  userId: string;
  sourceReportId: string;
  nowIso: string;
}): OppositeCaseReportRecord {
  const ticker = input.report.ticker?.trim().toUpperCase() ?? "UNKNOWN";
  const thesisSummary =
    extractThesisStatement(input.report) ??
    input.report.signal?.reasons?.[0] ??
    `${ticker} thesis summary is unavailable in the source report.`;
  const signalLanguage = input.report.signal?.value
    ? `The source signal is ${input.report.signal.value}.`
    : "The source signal is not explicit.";
  const firstReason =
    input.report.signal?.reasons?.[0] ??
    "The evidence set is limited, so the opposite case should stay conservative.";
  const valuationLanguage = input.report.valuation?.fair_value_mid
    ? `The valuation midpoint of ${input.report.valuation.fair_value_mid} can break if the assumptions prove too optimistic.`
    : "Valuation support is unavailable, so the thesis depends more heavily on qualitative evidence.";
  const sharedEvidenceRefs = convictionEvidenceRefsFromReport(input.report);

  return {
    id: createId(),
    userId: input.userId,
    sourceReportId: input.sourceReportId,
    ticker,
    promptVersion: convictionOppositeCasePromptVersion,
    thesisSummary,
    oppositeCaseSummary:
      `The strongest case against the ${ticker} thesis is that the evidence may not be durable enough to support the current conviction. ${signalLanguage}`,
    keyPoints: [
      {
        title: "Evidence durability risk",
        summary: `The opposite case challenges whether this remains true: ${firstReason}`,
        evidence_refs: sharedEvidenceRefs
      },
      {
        title: "Assumption sensitivity",
        summary: valuationLanguage,
        evidence_refs: sharedEvidenceRefs
      },
      {
        title: "Timing risk",
        summary:
          "Even if the thesis is directionally right, the market may require fresher proof before rewarding it.",
        evidence_refs: sharedEvidenceRefs
      }
    ],
    sharedEvidenceRefs,
    decisiveFactors: [
      "Whether the latest thesis evidence remains durable after new material events.",
      "Whether valuation and confidence assumptions survive the next review.",
      "Whether future evidence confirms or weakens the core thesis statement."
    ],
    generatedAt: input.nowIso,
    createdAt: input.nowIso
  };
}

function buildCoherenceFindings(
  entries: ConvictionJournalEntryRecord[]
): ConvictionInsightFinding[] {
  const latestByTicker = new Map<string, ConvictionJournalEntryRecord>();
  for (const entry of entries) {
    const existing = latestByTicker.get(entry.ticker);
    if (!existing || entry.eventAt > existing.eventAt) {
      latestByTicker.set(entry.ticker, entry);
    }
  }
  const latest = [...latestByTicker.values()].sort((left, right) =>
    left.ticker.localeCompare(right.ticker)
  );
  const findings: ConvictionInsightFinding[] = [];

  for (let leftIndex = 0; leftIndex < latest.length; leftIndex += 1) {
    const left = latest[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < latest.length; rightIndex += 1) {
      const right = latest[rightIndex];
      if (!right) {
        continue;
      }
      const leftKeywords = convictionTextKeywords(
        `${left.summary} ${left.thesisSnapshot.thesis_summary ?? ""}`
      );
      const rightKeywords = convictionTextKeywords(
        `${right.summary} ${right.thesisSnapshot.thesis_summary ?? ""}`
      );
      const shared = [...leftKeywords].filter((keyword) => rightKeywords.has(keyword));
      if (shared.length >= 2 && findings.every((finding) => finding.finding_type !== "overlap")) {
        findings.push({
          finding_type: "overlap",
          title: "Thesis overlap detected",
          summary:
            `${left.ticker} and ${right.ticker} lean on similar language: ${shared.slice(0, 3).join(", ")}.`,
          tickers: [left.ticker, right.ticker],
          evidence_refs: [
            {
              kind: "journal_entry",
              ref_id: left.id,
              label: left.title,
              ticker: left.ticker,
              captured_at: left.eventAt
            },
            {
              kind: "journal_entry",
              ref_id: right.id,
              label: right.title,
              ticker: right.ticker,
              captured_at: right.eventAt
            }
          ],
          confidence: roundTo(Math.min(0.95, 0.6 + shared.length * 0.05), 2)
        });
      }

      const leftSignal = left.thesisSnapshot.signal_value;
      const rightSignal = right.thesisSnapshot.signal_value;
      if (
        ((leftSignal === "positive" && rightSignal === "negative") ||
          (leftSignal === "negative" && rightSignal === "positive")) &&
        findings.every((finding) => finding.finding_type !== "contradiction")
      ) {
        findings.push({
          finding_type: "contradiction",
          title: "Opposing thesis signals",
          summary:
            `${left.ticker} and ${right.ticker} carry opposite latest thesis signals. Review whether both assumptions can be true together.`,
          tickers: [left.ticker, right.ticker],
          evidence_refs: [
            {
              kind: "journal_entry",
              ref_id: left.id,
              label: left.title,
              ticker: left.ticker,
              captured_at: left.eventAt
            },
            {
              kind: "journal_entry",
              ref_id: right.id,
              label: right.title,
              ticker: right.ticker,
              captured_at: right.eventAt
            }
          ],
          confidence: 0.72
        });
      }
    }
  }

  const eventCounts = new Map<string, number>();
  for (const entry of entries) {
    eventCounts.set(entry.ticker, (eventCounts.get(entry.ticker) ?? 0) + 1);
  }
  const busiest = [...eventCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (busiest && busiest[1] >= 3) {
    const tickerEntries = entries.filter((entry) => entry.ticker === busiest[0]).slice(0, 3);
    findings.push({
      finding_type: "mismatch",
      title: "Conviction attention is concentrated",
      summary:
        `${busiest[0]} produced ${busiest[1]} conviction event(s) this period. Review whether attention is matching thesis importance.`,
      tickers: [busiest[0]],
      evidence_refs: tickerEntries.map((entry) => ({
        kind: "journal_entry",
        ref_id: entry.id,
        label: entry.title,
        ticker: entry.ticker,
        captured_at: entry.eventAt
      })),
      confidence: 0.68
    });
  }

  return findings.slice(0, 5);
}

async function runConvictionCoherenceEvaluation(
  runtime: Runtime,
  input: {
    periodStart: string;
    periodEnd: string;
    userIds?: string[];
  }
): Promise<{
  evaluatedUsers: number;
  generated: number;
  degraded: number;
  failed: number;
}> {
  const candidateUserIds = input.userIds && input.userIds.length > 0
    ? input.userIds
    : (await runtime.store.listUsersWithWatchlist()).map((entry) => entry.userId);
  const uniqueUserIds = [...new Set(candidateUserIds.map((userId) => userId.trim()).filter(Boolean))];
  const periodStartMs = Date.parse(`${input.periodStart}T00:00:00.000Z`);
  const periodEndMs = Date.parse(`${input.periodEnd}T23:59:59.999Z`);
  const generatedAt = new Date().toISOString();
  let evaluatedUsers = 0;
  let generated = 0;
  let degraded = 0;
  let failed = 0;

  for (const userId of uniqueUserIds) {
    const subscription = await runtime.store.getUserSubscription(userId);
    if (subscription.tier !== "PRO") {
      continue;
    }
    evaluatedUsers += 1;
    try {
      const entries = (await runtime.store.listConvictionJournalEntriesByUser({
        userId,
        limit: 500
      })).filter((entry) => {
        const eventMs = Date.parse(entry.eventAt);
        return eventMs >= periodStartMs && eventMs <= periodEndMs;
      });
      const findings = buildCoherenceFindings(entries);
      const status = entries.length < 2 ? "degraded" : "generated";
      const title = findings.length > 0
        ? "Monthly conviction review"
        : "Monthly conviction review: nothing unusual";
      const summary = findings.length > 0
        ? `${findings.length} conviction pattern(s) need a quick review.`
        : entries.length < 2
          ? "Not enough conviction history exists yet for a strong monthly pattern."
          : "No overlap, contradiction, or mismatch pattern stood out this month.";

      await runtime.store.upsertConvictionInsightCard({
        id: createId(),
        userId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        insightType: "monthly_coherence",
        status,
        title,
        summary,
        findings,
        sourceJournalEntryIds: entries.map((entry) => entry.id),
        generatedAt,
        createdAt: generatedAt,
        updatedAt: generatedAt
      });
      if (status === "generated") {
        generated += 1;
      } else {
        degraded += 1;
      }
      logInfo("Conviction coherence card generated", {
        user_id: userId,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        finding_count: findings.length,
        prompt_version: convictionCoherencePromptVersion
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Coherence evaluation failed.";
      logError("Conviction coherence evaluation failed", {
        user_id: userId,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        error_message: message
      });
      captureException(new Error(message), {
        service: serviceName,
        user_id: userId,
        period_start: input.periodStart,
        period_end: input.periodEnd
      });
    }
  }

  return {
    evaluatedUsers,
    generated,
    degraded,
    failed
  };
}

interface ScenarioStressTemplateProfile {
  scenarioId: ScenarioStressTemplateId;
  signalType: KillSwitchSignalType;
  direction: "above" | "below" | "against_signal" | "any";
  baseSensitivity: number;
  stressLeaders: string[];
  rationaleLead: string;
  conditionFragment: string;
}

const scenarioStressTemplateProfiles: Record<
  ScenarioStressTemplateId,
  ScenarioStressTemplateProfile
> = {
  rates_higher_for_longer: {
    scenarioId: "rates_higher_for_longer",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.27,
    stressLeaders: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOG"],
    rationaleLead:
      "Long-duration valuation assumptions become fragile when rates remain elevated.",
    conditionFragment: "rate regime pressure persists and valuation support weakens"
  },
  recession_in_6m: {
    scenarioId: "recession_in_6m",
    signalType: "thesis_state",
    direction: "below",
    baseSensitivity: 0.31,
    stressLeaders: ["DIS", "NKE", "TGT", "HD", "LOW", "F", "GM", "AMZN"],
    rationaleLead:
      "Demand compression can invalidate growth and margin assumptions faster than expected.",
    conditionFragment: "demand softness persists and thesis confidence drops"
  },
  usd_up_10: {
    scenarioId: "usd_up_10",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.24,
    stressLeaders: ["AAPL", "MSFT", "NVDA", "KO", "PG", "MCD", "GOOG"],
    rationaleLead:
      "FX translation pressure can erode internationally exposed assumptions.",
    conditionFragment: "FX headwinds continue and international thesis assumptions deteriorate"
  },
  ai_hype_burst: {
    scenarioId: "ai_hype_burst",
    signalType: "news_sentiment",
    direction: "below",
    baseSensitivity: 0.34,
    stressLeaders: ["NVDA", "AMD", "MSFT", "GOOG", "META", "AAPL", "TSLA"],
    rationaleLead:
      "AI narrative resets can pressure both growth expectations and multiple support.",
    conditionFragment: "AI sentiment deteriorates and execution evidence turns mixed"
  },
  oil_120_spike: {
    scenarioId: "oil_120_spike",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.22,
    stressLeaders: ["DAL", "UAL", "AAL", "AMZN", "WMT", "TSLA", "F", "GM"],
    rationaleLead:
      "Energy cost shocks can quickly pressure margin and demand resilience assumptions.",
    conditionFragment: "energy-cost pressure persists and margin assumptions weaken"
  }
};

function deterministicUnit(seed: string): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  const head = digest.slice(0, 12);
  const value = Number.parseInt(head, 16);
  const max = 0xffffffffffff;
  return value / max;
}

function scenarioStressImpactLevelFromScore(score: number):
  "none" | "watch" | "elevated" | "high" | "critical" {
  if (score >= 0.86) {
    return "critical";
  }
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.52) {
    return "elevated";
  }
  if (score >= 0.32) {
    return "watch";
  }
  return "none";
}

function scenarioStressThesisBreakLikelihoodFromScore(score: number):
  "low" | "moderate" | "high" | "very_high" {
  if (score >= 0.86) {
    return "very_high";
  }
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.48) {
    return "moderate";
  }
  return "low";
}

function scenarioStressScoreForTicker(input: {
  scenarioId: ScenarioStressTemplateId;
  ticker: string;
  asOf: string;
  snapshot?: ThesisMonitorSnapshotRecord;
}): number {
  const profile = scenarioStressTemplateProfiles[input.scenarioId];
  const ticker = input.ticker.trim().toUpperCase();
  const snapshot = input.snapshot;
  const monitorBias = snapshot
    ? snapshot.state === "unresolved"
      ? 0.22
      : snapshot.state === "weakened"
        ? 0.18
        : snapshot.state === "intact"
          ? -0.04
          : -0.07
    : 0.03;
  const freshnessBias = snapshot
    ? snapshot.freshnessState === "triggered"
      ? 0.24
      : snapshot.freshnessState === "stale"
        ? 0.12
        : snapshot.freshnessState === "aging"
          ? 0.06
          : -0.02
    : 0.02;
  const monitorScore = snapshot ? clampNumber(snapshot.score, 0, 1) : 0.5;
  const freshnessScore = snapshot ? clampNumber(snapshot.freshnessScore, 0, 1) : 0.5;
  const scoreBias = (1 - monitorScore) * 0.11;
  const freshnessScoreBias = (1 - freshnessScore) * 0.09;
  const leaderBias = profile.stressLeaders.includes(ticker) ? 0.16 : 0.04;
  const jitter = (deterministicUnit(`${input.scenarioId}:${ticker}:${input.asOf}`) - 0.5) * 0.08;
  const score =
    profile.baseSensitivity +
    leaderBias +
    monitorBias +
    freshnessBias +
    scoreBias +
    freshnessScoreBias +
    jitter;
  return roundTo(clampNumber(score, 0, 1), 4);
}

async function runScenarioStressEvaluation(runtime: Runtime, input: {
  userId: string;
  scenarioId: ScenarioStressTemplateId;
  asOf: string;
  nowIso: string;
}): Promise<{
  run: ScenarioStressRunRecord;
  impacts: ScenarioStressImpactRecord[];
  suggestions: ScenarioStressRuleSuggestionRecord[];
}> {
  const profile = scenarioStressTemplateProfiles[input.scenarioId];
  const watchlist = (await runtime.store.listWatchlistTickersByUser(input.userId))
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => ticker.length > 0)
    .sort((left, right) => left.localeCompare(right));
  const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(input.userId);
  const snapshotsByTicker = new Map<string, ThesisMonitorSnapshotRecord>();
  for (const snapshot of snapshots) {
    snapshotsByTicker.set(snapshot.ticker.trim().toUpperCase(), snapshot);
  }

  const impacts: ScenarioStressImpactRecord[] = [];
  const suggestions: ScenarioStressRuleSuggestionRecord[] = [];

  for (const ticker of watchlist) {
    const snapshot = snapshotsByTicker.get(ticker);
    const stressScore = scenarioStressScoreForTicker({
      scenarioId: input.scenarioId,
      ticker,
      asOf: input.asOf,
      snapshot
    });
    const impactLevel = scenarioStressImpactLevelFromScore(stressScore);
    if (impactLevel === "none") {
      continue;
    }
    const thesisBreakLikelihood = scenarioStressThesisBreakLikelihoodFromScore(stressScore);
    const monitorStateText = snapshot
      ? `${snapshot.state} / ${snapshot.freshnessState}`
      : "no monitor snapshot";
    const rationale =
      `${profile.rationaleLead} ${ticker} currently reads ${monitorStateText}, giving a stress score of ${roundTo(stressScore, 2)}.`;
    const evidenceRefs = snapshot
      ? [
          `monitor_state:${snapshot.state}`,
          `freshness_state:${snapshot.freshnessState}`,
          `monitor_score:${roundTo(clampNumber(snapshot.score, 0, 1), 2)}`,
          `freshness_score:${roundTo(clampNumber(snapshot.freshnessScore, 0, 1), 2)}`
        ]
      : ["monitor_state:unavailable", "freshness_state:unavailable"];
    impacts.push({
      id: createId(),
      scenarioRunId: "",
      userId: input.userId,
      ticker,
      impactLevel,
      thesisBreakLikelihood,
      stressScore,
      rationale,
      evidenceRefs,
      createdAt: input.nowIso
    });

    if (impactLevel === "elevated" || impactLevel === "high" || impactLevel === "critical") {
      const confidence = roundTo(clampNumber(stressScore * 0.88 + 0.08, 0, 1), 4);
      suggestions.push({
        id: createId(),
        scenarioRunId: "",
        userId: input.userId,
        ticker,
        signalType: profile.signalType,
        direction: profile.direction,
        conditionText:
          `${ticker}: Add a scenario guardrail for ${scenarioStressTemplateProfiles[input.scenarioId].conditionFragment}.`,
        rationale:
          `${profile.rationaleLead} Suggested as review-only until the user confirms the condition wording.`,
        confidence,
        createdAt: input.nowIso
      });
    }
  }

  const runId = createId();
  const impactsWithRun = impacts.map((impact) => ({ ...impact, scenarioRunId: runId }));
  const suggestionsWithRun = suggestions.map((suggestion) => ({
    ...suggestion,
    scenarioRunId: runId
  }));
  const criticalCount = impactsWithRun.filter((impact) => impact.impactLevel === "critical").length;
  const highOrCriticalCount = impactsWithRun.filter(
    (impact) => impact.impactLevel === "high" || impact.impactLevel === "critical"
  ).length;
  const summary =
    impactsWithRun.length === 0
      ? `No critical scenario stress detected across ${watchlist.length} followed name(s).`
      : `${impactsWithRun.length} of ${watchlist.length} followed name(s) show stress under this scenario (${highOrCriticalCount} high/critical).`;

  const run = await runtime.store.createScenarioStressRun({
    id: runId,
    scenarioId: input.scenarioId,
    userId: input.userId,
    status: "completed",
    runMode: "manual",
    asOf: input.asOf,
    totalNames: watchlist.length,
    impactedNames: impactsWithRun.length,
    criticalNames: criticalCount,
    summary,
    createdAt: input.nowIso,
    completedAt: input.nowIso
  });
  const createdImpacts = await runtime.store.createScenarioStressImpacts(impactsWithRun);
  const createdSuggestions = await runtime.store.createScenarioStressRuleSuggestions(
    suggestionsWithRun
  );
  return {
    run,
    impacts: createdImpacts,
    suggestions: createdSuggestions
  };
}

function computeScenarioResponse(
  reportId: string,
  valuation: NonNullable<AnalysisReport["valuation"]>,
  overrides: NonNullable<ScenarioRequest["overrides"]>
): ScenarioResponse {
  const omissions = buildScenarioInputOmissions(valuation);
  const baseAssumptions = assumptionsWithoutLegacyBeta(valuation.assumptions);
  const base = {
    fair_value_mid: valuation.fair_value_mid,
    fair_value_low: valuation.fair_value_low,
    fair_value_high: valuation.fair_value_high,
    spot_price: valuation.spot_price,
    implied_upside_pct: valuation.implied_upside_pct,
    assumptions: baseAssumptions,
    degraded_reason: valuation.degraded_reason,
    omissions
  };

  const scenarioAssumptions = {
    ...baseAssumptions,
    projection_years:
      overrides.projection_years ?? baseAssumptions.projection_years,
    terminal_growth_rate:
      overrides.terminal_growth_rate ?? baseAssumptions.terminal_growth_rate,
    wacc: overrides.wacc ?? baseAssumptions.wacc
  };

  const hasBaseMid = isFiniteNumber(valuation.fair_value_mid);
  if (!hasBaseMid) {
    return {
      report_id: reportId,
      deterministic_model: phase6ScenarioDeterministicModel,
      base,
      scenario: {
        fair_value_mid: undefined,
        fair_value_low: undefined,
        fair_value_high: undefined,
        spot_price: valuation.spot_price,
        implied_upside_pct: undefined,
        assumptions: scenarioAssumptions,
        degraded_reason:
          valuation.degraded_reason ??
          "Base valuation fair value is unavailable for scenario recomputation.",
        omissions
      },
      omissions
    };
  }

  const baseFactor = deterministicValuationFactor(baseAssumptions);
  const scenarioFactor = deterministicValuationFactor(scenarioAssumptions);
  const projectionRatioRaw =
    scenarioAssumptions.projection_years / baseAssumptions.projection_years;
  const projectionRatio = clampNumber(projectionRatioRaw, 0.5, 1.5);
  const scaling = (scenarioFactor / baseFactor) * projectionRatio;

  const scenarioMid = roundTo((valuation.fair_value_mid as number) * scaling, 4);
  const scenarioLow = isFiniteNumber(valuation.fair_value_low)
    ? roundTo(valuation.fair_value_low * scaling, 4)
    : undefined;
  const scenarioHigh = isFiniteNumber(valuation.fair_value_high)
    ? roundTo(valuation.fair_value_high * scaling, 4)
    : undefined;

  const spotPrice = isFiniteNumber(valuation.spot_price) ? valuation.spot_price : undefined;
  const impliedUpsidePct = spotPrice
    ? roundTo(((scenarioMid - spotPrice) / spotPrice) * 100, 4)
    : undefined;

  return {
    report_id: reportId,
    deterministic_model: phase6ScenarioDeterministicModel,
    base,
    scenario: {
      fair_value_mid: scenarioMid,
      fair_value_low: scenarioLow,
      fair_value_high: scenarioHigh,
      spot_price: spotPrice,
      implied_upside_pct: impliedUpsidePct,
      assumptions: scenarioAssumptions,
      omissions
    },
    omissions
  };
}

function mergeIssuerMetadata(
  report: AnalysisReport,
  issuer?: {
    name?: string;
    exchange?: string;
    currency?: string;
    domicile_country?: string;
    region?: string;
    sector?: string;
    industry?: string;
  }
): AnalysisReport {
  const issuerName = issuer?.name?.trim();
  if (
    !issuerName &&
    !issuer?.exchange &&
    !issuer?.currency &&
    !issuer?.domicile_country &&
    !issuer?.region &&
    !issuer?.sector &&
    !issuer?.industry
  ) {
    return report;
  }

  const nextIssuer = {
    name: report.issuer?.name?.trim() || issuerName || "",
    exchange: report.issuer?.exchange?.trim() || issuer?.exchange?.trim() || undefined,
    currency: report.issuer?.currency?.trim() || issuer?.currency?.trim() || undefined,
    domicile_country:
      report.issuer?.domicile_country?.trim() || issuer?.domicile_country?.trim() || undefined,
    region: report.issuer?.region?.trim() || issuer?.region?.trim() || undefined,
    sector: report.issuer?.sector?.trim() || issuer?.sector?.trim() || undefined,
    industry: report.issuer?.industry?.trim() || issuer?.industry?.trim() || undefined
  };
  if (!nextIssuer.name) {
    return report;
  }

  if (
    report.issuer?.name === nextIssuer.name &&
    report.issuer?.exchange === nextIssuer.exchange &&
    report.issuer?.currency === nextIssuer.currency &&
    report.issuer?.domicile_country === nextIssuer.domicile_country &&
    report.issuer?.region === nextIssuer.region &&
    report.issuer?.sector === nextIssuer.sector &&
    report.issuer?.industry === nextIssuer.industry
  ) {
    return report;
  }

  return {
    ...report,
    issuer: nextIssuer
  };
}

async function fetchStructuralContext(
  runtime: Runtime,
  input: {
    ticker?: string;
    country?: string;
    subjectType?: "issuer" | "market_pulse";
    asOf?: string;
  }
): Promise<StructuralContextPack | undefined> {
  const params = new URLSearchParams();
  if (input.ticker) {
    params.set("ticker", input.ticker);
  }
  if (input.country) {
    params.set("country", input.country);
  }
  if (input.subjectType) {
    params.set("subject_type", input.subjectType);
  }
  if (input.asOf) {
    params.set("as_of", input.asOf);
  }

  try {
    const response = await fetch(
      `${runtime.config.marketPulseDataOpenbbBaseUrl}/v1/official/structural?${params.toString()}`
    );
    if (!response.ok) {
      logWarn("Structural context fetch degraded", {
        ticker: input.ticker,
        country: input.country,
        subject_type: input.subjectType,
        as_of: input.asOf,
        status_code: response.status
      });
      return undefined;
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      data?: StructuralContextPack;
      error_message?: string;
    };
    if (!payload.ok || !payload.data) {
      logWarn("Structural context payload missing data", {
        ticker: input.ticker,
        country: input.country,
        subject_type: input.subjectType,
        as_of: input.asOf,
        error_message: payload.error_message
      });
      return undefined;
    }
    return payload.data;
  } catch (error) {
    logWarn("Structural context fetch failed", {
      ticker: input.ticker,
      country: input.country,
      subject_type: input.subjectType,
      as_of: input.asOf,
      error_message: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

function appendUniqueParagraph(paragraphs: string[], nextParagraph: string): string[] {
  if (paragraphs.includes(nextParagraph)) {
    return paragraphs;
  }
  return [...paragraphs, nextParagraph];
}

function appendUniqueKeyPoint(points: string[], nextPoint: string): string[] {
  if (points.includes(nextPoint)) {
    return points;
  }
  return [...points, nextPoint];
}

function mergeStructuralContextIntoDueDiligence(
  report: AnalysisReport,
  structuralContext: StructuralContextPack
): AnalysisReport {
  if (!report.due_diligence) {
    return {
      ...report,
      structural_context: report.structural_context ?? structuralContext
    };
  }

  const competitiveObservation = structuralContext.observations.find((entry) =>
    ["gdp_per_capita", "sector_mix", "education"].includes(entry.family)
  );
  const growthObservation = structuralContext.observations.find((entry) =>
    ["population", "infrastructure", "energy_access"].includes(entry.family)
  );
  const riskObservation = structuralContext.observations.find((entry) =>
    ["debt_context", "inequality", "inflation_regime", "public_debt"].includes(entry.family)
  );
  const imfOmission = structuralContext.omissions.find((entry) => entry.source_family === "imf");

  const nextSections = report.due_diligence.sections.map((section) => {
    if (section.section_id === "competitive_positioning" && competitiveObservation) {
      const paragraph = `Structural context: ${competitiveObservation.summary}`;
      return {
        ...section,
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(
          section.key_points,
          `${competitiveObservation.label} remains a relevant backdrop.`
        )
      };
    }

    if (section.section_id === "growth_opportunities_and_outlook" && growthObservation) {
      const paragraph = `Structural context: ${growthObservation.summary}`;
      return {
        ...section,
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(
          section.key_points,
          `${growthObservation.label} helps frame the current opportunity set.`
        )
      };
    }

    if (section.section_id === "risks_and_challenges" && (riskObservation || imfOmission)) {
      const paragraph = riskObservation
        ? `Structural context: ${riskObservation.summary}`
        : `Coverage limitation: ${imfOmission?.reason_text}`;
      const keyPoint = riskObservation
        ? `${riskObservation.label} remains part of the macro risk frame.`
        : "IMF context remains intentionally non-blocking in this run.";
      return {
        ...section,
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(section.key_points, keyPoint)
      };
    }

    return section;
  });

  return {
    ...report,
    structural_context: report.structural_context ?? structuralContext,
    due_diligence: {
      ...report.due_diligence,
      sections: nextSections
    }
  };
}

async function enrichAnalysisReportIssuer(runtime: Runtime, report: AnalysisReport): Promise<AnalysisReport> {
  if (!report.ticker) {
    return report;
  }

  const supportedTicker = await runtime.store.getSupportedTicker(report.ticker);
  if (!supportedTicker) {
    return report;
  }

  let nextReport = mergeIssuerMetadata(report, {
    name: supportedTicker.companyName,
    exchange: supportedTicker.exchange
  });

  if (nextReport.structural_context?.subject_type === "issuer") {
    return mergeIssuerMetadata(nextReport, nextReport.structural_context.issuer_metadata);
  }

  const structuralContext = await fetchStructuralContext(runtime, {
    ticker: report.ticker,
    subjectType: "issuer",
    asOf: report.generated_at.slice(0, 10)
  });
  if (!structuralContext) {
    return nextReport;
  }

  nextReport = mergeIssuerMetadata(nextReport, structuralContext.issuer_metadata);
  return mergeStructuralContextIntoDueDiligence(nextReport, structuralContext);
}

async function cleanupStoredReport(
  runtime: Runtime,
  reportId: string,
  artifactKey: string | undefined
): Promise<void> {
  const cleanupTasks: Promise<unknown>[] = [];

  if (artifactKey) {
    cleanupTasks.push(runtime.artifactStore.deleteReport(artifactKey));
  }

  cleanupTasks.push(runtime.store.deleteReport(reportId));

  const results = await Promise.allSettled(cleanupTasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      logWarn("Report cleanup warning", {
        error_message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        report_id: reportId,
        artifact_key: artifactKey
      });
    }
  });
}

async function authenticateAccessToken(
  runtime: Runtime,
  request: IncomingMessage
): Promise<AuthContext | undefined> {
  const token = parseBearerToken(request);
  if (!token) {
    return undefined;
  }

  const claims = verifyAuthToken(token, runtime.config.jwtSecret);
  if (!claims || claims.typ !== "access") {
    return undefined;
  }

  const session = await runtime.store.getSessionById(claims.sid);
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    return undefined;
  }

  if (Date.parse(session.expiresAt) <= Date.now()) {
    return undefined;
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid
  };
}

async function authenticateAnyToken(
  runtime: Runtime,
  token: string
): Promise<AuthContext | undefined> {
  const claims = verifyAuthToken(token, runtime.config.jwtSecret);
  if (!claims) {
    return undefined;
  }

  const session = await runtime.store.getSessionById(claims.sid);
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    return undefined;
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid
  };
}

async function appendAudit(
  runtime: Runtime,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const auditEvent: AuditEventRecord = {
    id: createId(),
    eventType,
    payload,
    userId,
    createdAt: new Date().toISOString()
  };
  await runtime.store.appendAuditEvent(auditEvent);
}

async function recordAlertLedgerItem(
  runtime: Runtime,
  input: {
    id?: string;
    userId: string;
    notificationType: NotificationType;
    category?: AlertLedgerCategory;
    route: AlertRouteTarget;
    title: string;
    body: string;
    reasonCode: string;
    reasonText: string;
    deliveryState: AlertLedgerRecord["deliveryState"];
    data?: Record<string, string>;
  }
): Promise<AlertLedgerRecord> {
  const now = new Date().toISOString();
  const alert = await runtime.store.createAlertLedgerItem({
    id: input.id ?? createId(),
    userId: input.userId,
    notificationType: input.notificationType,
    category: input.category ?? notificationCategory(input.notificationType),
    route: input.route,
    title: input.title,
    body: input.body,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    deliveryState: input.deliveryState,
    context: alertLedgerContextFromData(input.data),
    createdAt: now,
    updatedAt: now
  });
  await recordConvictionJournalEntryFromAlert(runtime, alert);
  return alert;
}

function convictionTickerFromAlert(alert: AlertLedgerRecord): string | undefined {
  const candidates = [
    alert.context?.ticker,
    alert.context?.affected_ticker,
    alert.context?.lead_ticker,
    alert.context?.source_ticker
  ];
  for (const candidate of candidates) {
    const ticker = normalizeTickerSymbol(candidate);
    if (ticker) {
      return ticker;
    }
  }
  return undefined;
}

function convictionEvidenceRefsFromReport(report: AnalysisReport): ConvictionEvidenceRef[] {
  const refs = new Map<string, ConvictionEvidenceRef>();
  const reportTicker = normalizeTickerSymbol(report.ticker);
  refs.set(`report:${report.report_id}`, {
    kind: "report",
    ref_id: report.report_id,
    label: report.type === "deep_dive" ? "Deep Dive report" : "Report",
    ticker: reportTicker,
    captured_at: report.generated_at
  });

  const evidenceItems = [
    ...(report.signal?.evidence ?? []),
    ...report.sections.flatMap((section) => section.evidence ?? [])
  ];
  for (const evidence of evidenceItems) {
    if (!evidence.evidence_id || refs.has(`evidence:${evidence.evidence_id}`)) {
      continue;
    }
    refs.set(`evidence:${evidence.evidence_id}`, {
      kind: "evidence_item",
      ref_id: evidence.evidence_id,
      label: evidence.source_name,
      ticker: reportTicker,
      captured_at: evidence.retrieved_at
    });
  }

  return [...refs.values()].slice(0, 16);
}

function convictionThesisSnapshotFromReport(
  report: AnalysisReport,
  monitorSnapshot?: ThesisMonitorSnapshotRecord
): ConvictionThesisSnapshot {
  return {
    ticker: normalizeTickerSymbol(report.ticker),
    report_id: report.report_id,
    report_generated_at: report.generated_at,
    report_schema_version: report.schema_version,
    signal_value: report.signal?.value,
    signal_reasons: report.signal?.reasons ? [...report.signal.reasons] : undefined,
    confidence_score: report.confidence?.score,
    confidence_label: report.confidence?.label,
    thesis_summary: extractThesisStatement(report) ?? report.signal?.reasons?.[0],
    monitor_state: monitorSnapshot?.state,
    monitor_reason: monitorSnapshot?.reason,
    monitor_score: monitorSnapshot?.score,
    freshness_state: monitorSnapshot?.freshnessState,
    freshness_score: monitorSnapshot?.freshnessScore
  };
}

async function latestConvictionSnapshotForTicker(
  runtime: Runtime,
  input: {
    userId: string;
    ticker: string;
    reportId?: string;
  }
): Promise<{
  snapshot: ConvictionThesisSnapshot;
  evidenceRefs: ConvictionEvidenceRef[];
  report?: AnalysisReport;
}> {
  const ticker = input.ticker.trim().toUpperCase();
  const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(input.userId);
  const monitorSnapshot = snapshots.find((entry) => entry.ticker === ticker);
  const candidateReports = input.reportId
    ? [await runtime.store.getReportById(input.reportId)]
    : (await runtime.store.listReportsByUser(input.userId))
        .filter((report) => report.type === "deep_dive" && report.ticker === ticker)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const reportMetadata = candidateReports.find(Boolean);

  if (reportMetadata) {
    try {
      const artifact = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
      if (isAnalysisReport(artifact) && artifact.type === "deep_dive") {
        return {
          snapshot: convictionThesisSnapshotFromReport(artifact, monitorSnapshot),
          evidenceRefs: convictionEvidenceRefsFromReport(artifact),
          report: artifact
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "report artifact unavailable";
      logWarn("Conviction journal fell back without report artifact", {
        user_id: input.userId,
        ticker,
        report_id: reportMetadata.id,
        error_message: message
      });
    }
  }

  return {
    snapshot: {
      ticker,
      monitor_state: monitorSnapshot?.state,
      monitor_reason: monitorSnapshot?.reason,
      monitor_score: monitorSnapshot?.score,
      freshness_state: monitorSnapshot?.freshnessState,
      freshness_score: monitorSnapshot?.freshnessScore,
      report_id: monitorSnapshot?.reportId,
      report_generated_at: monitorSnapshot?.reportGeneratedAt,
      report_schema_version: monitorSnapshot?.reportSchemaVersion
    },
    evidenceRefs: monitorSnapshot
      ? [
          {
            kind: "monitor_snapshot",
            ref_id: `${input.userId}:${ticker}`,
            label: "Monitor snapshot",
            ticker,
            captured_at: monitorSnapshot.updatedAt
          }
        ]
      : []
  };
}

async function recordConvictionJournalEntry(
  runtime: Runtime,
  input: {
    userId: string;
    ticker: string;
    eventType: ConvictionJournalEventType;
    sourceType: ConvictionJournalSourceType;
    sourceId: string;
    title: string;
    summary: string;
    thesisSnapshot: ConvictionThesisSnapshot;
    evidenceRefs: ConvictionEvidenceRef[];
    eventAt?: string;
    reportId?: string;
    alertLedgerId?: string;
    warRoomId?: string;
    monitorSnapshotKey?: string;
    oppositeCaseId?: string;
  }
): Promise<ConvictionJournalEntryRecord | undefined> {
  const subscription = await runtime.store.getUserSubscription(input.userId);
  if (subscription.tier !== "PRO") {
    return undefined;
  }

  const now = new Date().toISOString();
  const record = await runtime.store.upsertConvictionJournalEntry({
    id: createId(),
    userId: input.userId,
    ticker: input.ticker.trim().toUpperCase(),
    eventType: input.eventType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    eventAt: input.eventAt ?? now,
    title: input.title,
    summary: input.summary,
    thesisSnapshot: input.thesisSnapshot,
    evidenceRefs: input.evidenceRefs,
    reportId: input.reportId,
    alertLedgerId: input.alertLedgerId,
    warRoomId: input.warRoomId,
    monitorSnapshotKey: input.monitorSnapshotKey,
    oppositeCaseId: input.oppositeCaseId,
    createdAt: now,
    updatedAt: now
  });
  logInfo("Conviction journal entry upserted", {
    user_id: input.userId,
    ticker: record.ticker,
    event_type: record.eventType,
    journal_entry_id: record.id,
    source_type: record.sourceType,
    source_id: record.sourceId
  });
  return record;
}

async function recordConvictionJournalEntryFromReport(
  runtime: Runtime,
  input: {
    report: AnalysisReport;
    userId?: string;
  }
): Promise<void> {
  if (input.report.type !== "deep_dive" || !input.userId || !input.report.ticker) {
    return;
  }
  const ticker = input.report.ticker.trim().toUpperCase();
  const monitorSnapshot = (await runtime.store.listThesisMonitorSnapshotsByUser(input.userId))
    .find((entry) => entry.ticker === ticker);
  await recordConvictionJournalEntry(runtime, {
    userId: input.userId,
    ticker,
    eventType: "deep_dive_generated",
    sourceType: "report",
    sourceId: input.report.report_id,
    eventAt: input.report.generated_at,
    title: `${ticker} thesis recorded`,
    summary:
      extractThesisStatement(input.report) ??
      input.report.signal?.reasons?.[0] ??
      `${ticker} Deep Dive completed.`,
    thesisSnapshot: convictionThesisSnapshotFromReport(input.report, monitorSnapshot),
    evidenceRefs: convictionEvidenceRefsFromReport(input.report),
    reportId: input.report.report_id
  });
}

async function recordConvictionJournalEntryFromAlert(
  runtime: Runtime,
  alert: AlertLedgerRecord
): Promise<void> {
  const ticker = convictionTickerFromAlert(alert);
  if (!ticker) {
    return;
  }
  let eventType: ConvictionJournalEventType | undefined;
  let sourceType: ConvictionJournalSourceType = "alert_ledger";
  let sourceId = alert.id;
  if (alert.notificationType === "kill_switch") {
    eventType = "kill_switch_alert_fired";
  } else if (alert.notificationType === "freshness_decay") {
    eventType = "freshness_decay_alert_fired";
  } else if (alert.notificationType === "cross_name_propagation") {
    eventType = "cross_name_alert_fired";
  } else if (
    alert.notificationType === "earnings_war_room" &&
    alert.context?.war_room_phase === "post" &&
    typeof alert.context.war_room_id === "string"
  ) {
    eventType = "earnings_war_room_closed";
    sourceType = "war_room";
    sourceId = alert.context.war_room_id;
  }
  if (!eventType) {
    return;
  }

  const reportId = typeof alert.context?.report_id === "string"
    ? alert.context.report_id
    : undefined;
  const { snapshot, evidenceRefs } = await latestConvictionSnapshotForTicker(runtime, {
    userId: alert.userId,
    ticker,
    reportId
  });
  const eventRefs: ConvictionEvidenceRef[] = [
    {
      kind: "alert_ledger",
      ref_id: alert.id,
      label: alert.title,
      ticker,
      captured_at: alert.createdAt
    },
    ...evidenceRefs
  ];

  await recordConvictionJournalEntry(runtime, {
    userId: alert.userId,
    ticker,
    eventType,
    sourceType,
    sourceId,
    eventAt: alert.createdAt,
    title: alert.title,
    summary: alert.reasonText || alert.body,
    thesisSnapshot: snapshot,
    evidenceRefs: eventRefs,
    reportId,
    alertLedgerId: alert.id,
    warRoomId: typeof alert.context?.war_room_id === "string"
      ? alert.context.war_room_id
      : undefined,
    monitorSnapshotKey: `${alert.userId}:${ticker}`
  });
}

async function recordConvictionJournalEntryFromAlertFeedback(
  runtime: Runtime,
  alert: AlertLedgerRecord,
  feedback: AlertFeedbackState
): Promise<void> {
  const ticker = convictionTickerFromAlert(alert);
  if (!ticker) {
    return;
  }
  const reportId = typeof alert.context?.report_id === "string"
    ? alert.context.report_id
    : undefined;
  const { snapshot, evidenceRefs } = await latestConvictionSnapshotForTicker(runtime, {
    userId: alert.userId,
    ticker,
    reportId
  });
  await recordConvictionJournalEntry(runtime, {
    userId: alert.userId,
    ticker,
    eventType: "alert_feedback_recorded",
    sourceType: "alert_ledger",
    sourceId: alert.id,
    eventAt: new Date().toISOString(),
    title: `Feedback recorded for ${alert.title}`,
    summary: `User marked the alert as ${feedback}.`,
    thesisSnapshot: snapshot,
    evidenceRefs: [
      {
        kind: "alert_ledger",
        ref_id: alert.id,
        label: alert.title,
        ticker,
        captured_at: alert.updatedAt
      },
      ...evidenceRefs
    ],
    reportId,
    alertLedgerId: alert.id,
    warRoomId: typeof alert.context?.war_room_id === "string"
      ? alert.context.war_room_id
      : undefined,
    monitorSnapshotKey: `${alert.userId}:${ticker}`
  });
}

async function hasCrossNamePropagationAlert(input: {
  runtime: Runtime;
  userId: string;
  relationshipId: string;
  triggerKey: string;
}): Promise<boolean> {
  const existingAlerts = await input.runtime.store.listAlertLedgerItemsByUser({
    userId: input.userId,
    limit: 100
  });
  return existingAlerts.some((alert) => {
    if (alert.notificationType !== "cross_name_propagation") {
      return false;
    }
    return (
      alert.context?.relationship_id === input.relationshipId &&
      alert.context?.propagation_trigger_key === input.triggerKey
    );
  });
}

async function dispatchCrossNamePropagation(
  runtime: Runtime,
  input: {
    asOf: string;
    signalSource: CrossNamePropagationSignalSource;
    triggerKey: string;
    confidenceThreshold: number;
    fixtures: CrossNamePropagationEventFixture[];
    requestId: string;
    route: string;
  }
): Promise<{
  evaluated: number;
  matched: number;
  suppressed: number;
  attempted: number;
  delivered: number;
  failed: number;
}> {
  const watchlistsByUser = new Map<string, Set<string>>();
  const recipientsByUser = new Map<
    string,
    Array<{ userId: string; installationId: string; deviceToken: string }>
  >();
  let evaluated = 0;
  let matched = 0;
  let suppressed = 0;
  let attempted = 0;
  let delivered = 0;
  let failed = 0;

  for (const fixture of input.fixtures) {
    const eventCategory = asCrossNamePropagationEventCategory(
      fixture.event_category,
      fixture.signal_type
    );
    const relationshipTypes: NameRelationshipType[] | undefined =
      eventCategory === "macro" ? ["sector"] : undefined;
    const relationships = await runtime.store.listActiveNameRelationshipsBySource({
      sourceTicker: fixture.source_ticker,
      relationshipTypes,
      minConfidence: input.confidenceThreshold
    });

    for (const relationship of relationships) {
      evaluated += 1;
      let watchlist = watchlistsByUser.get(relationship.userId);
      if (!watchlist) {
        const tickers = await runtime.store.listWatchlistTickersByUser(relationship.userId);
        watchlist = new Set(tickers.map((ticker) => ticker.trim().toUpperCase()));
        watchlistsByUser.set(relationship.userId, watchlist);
      }
      if (!watchlist.has(relationship.targetTicker)) {
        suppressed += 1;
        continue;
      }

      if (
        await hasCrossNamePropagationAlert({
          runtime,
          userId: relationship.userId,
          relationshipId: relationship.relationshipId,
          triggerKey: input.triggerKey
        })
      ) {
        suppressed += 1;
        continue;
      }

      let userTargets = recipientsByUser.get(relationship.userId);
      if (!userTargets) {
        userTargets = await runtime.store.listUsersWithDeviceTokenByNotificationType({
          notificationType: "cross_name_propagation",
          tier: "PRO",
          userIds: [relationship.userId]
        });
        recipientsByUser.set(relationship.userId, userTargets);
      }
      if (userTargets.length === 0) {
        suppressed += 1;
        continue;
      }

      const alertId = createId();
      const route = notificationRoute("cross_name_propagation");
      const title = notificationTitle("cross_name_propagation", relationship.targetTicker);
      const reasonText =
        fixture.reason_text ??
        `${relationship.sourceTicker} has a ${fixture.signal_type} signal linked to ${relationship.targetTicker}.`;
      const body =
        `${relationship.sourceTicker} may affect your ${relationship.targetTicker} thesis ` +
        `through a ${relationship.relationshipType} relationship: ${relationship.rationale}`;
      const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
        notificationType: "cross_name_propagation",
        route,
        title,
        body,
        data: {
          alert_id: alertId,
          source_ticker: relationship.sourceTicker,
          affected_ticker: relationship.targetTicker,
          relationship_id: relationship.relationshipId,
          relationship_type: relationship.relationshipType,
          relationship_confidence: relationship.confidence.toFixed(2),
          relationship_source_report_id: relationship.sourceReportId,
          propagation_trigger_key: input.triggerKey,
          propagation_signal_type: fixture.signal_type,
          propagation_event_id: fixture.event_id ?? "",
          propagation_reason: reasonText,
          reason_code: "cross_name_signal",
          reason_text: reasonText,
          deep_link_target: route
        }
      });
      attempted += pushResult.attempted;
      delivered += pushResult.delivered;
      failed += pushResult.failed;
      matched += 1;

      for (const invalidTarget of pushResult.invalidTargets) {
        await runtime.store.invalidateUserDeviceByInstallation({
          userId: invalidTarget.userId,
          installationId: invalidTarget.installationId,
          invalidatedAt: new Date().toISOString(),
          reason: "fcm_invalid_registration"
        });
      }

      await recordAlertLedgerItem(runtime, {
        id: alertId,
        userId: relationship.userId,
        notificationType: "cross_name_propagation",
        category: eventCategory === "macro" ? "macro" : "thesis_drift",
        route,
        title,
        body,
        reasonCode: "cross_name_signal",
        reasonText,
        deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
        data: {
          ticker: relationship.targetTicker,
          source_ticker: relationship.sourceTicker,
          affected_ticker: relationship.targetTicker,
          relationship_id: relationship.relationshipId,
          relationship_type: relationship.relationshipType,
          relationship_confidence: relationship.confidence.toFixed(2),
          relationship_source_report_id: relationship.sourceReportId,
          report_id: relationship.sourceReportId,
          propagation_trigger_key: input.triggerKey,
          propagation_signal_type: fixture.signal_type,
          propagation_event_id: fixture.event_id ?? "",
          propagation_reason: reasonText,
          reason_code: "cross_name_signal",
          reason_text: reasonText,
          deep_link_target: route
        }
      });

      logInfo("Cross-name propagated alert emitted", {
        request_id: input.requestId,
        route: input.route,
        alert_id: alertId,
        source_ticker: relationship.sourceTicker,
        affected_ticker: relationship.targetTicker,
        relationship_type: relationship.relationshipType
      });
    }
  }

  return {
    evaluated,
    matched,
    suppressed,
    attempted,
    delivered,
    failed
  };
}

function freshnessSeverity(state: ThesisFreshnessState): number {
  switch (state) {
    case "triggered":
      return 4;
    case "stale":
      return 3;
    case "aging":
      return 2;
    case "current":
      return 1;
  }
}

function parseFreshnessState(value: unknown): ThesisFreshnessState | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "current" ||
    normalized === "aging" ||
    normalized === "stale" ||
    normalized === "triggered"
  ) {
    return normalized;
  }
  return undefined;
}

function parseNumericContextValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function shouldDispatchFreshnessAlert(input: {
  previous?: AlertLedgerRecord;
  candidate: ThesisMonitorSnapshotRecord;
  asOfDate: string;
}): boolean {
  if (!input.previous) {
    return true;
  }

  const previous = input.previous;
  const previousState = parseFreshnessState(previous.context?.freshness_state);
  const previousUnreviewed = parseNumericContextValue(previous.context?.unreviewed_events_count);
  const previousScore = parseNumericContextValue(previous.context?.freshness_score);
  const previousReportDate =
    typeof previous.context?.report_date === "string"
      ? previous.context.report_date
      : undefined;

  if (previousReportDate === input.asOfDate) {
    return false;
  }

  if (previousState && previousState !== input.candidate.freshnessState) {
    return true;
  }

  if (
    previousState &&
    freshnessSeverity(input.candidate.freshnessState) > freshnessSeverity(previousState)
  ) {
    return true;
  }

  if (
    previousUnreviewed !== undefined &&
    input.candidate.unreviewedEventsCount > previousUnreviewed
  ) {
    return true;
  }

  if (
    previousScore !== undefined &&
    input.candidate.freshnessScore < previousScore - 0.05
  ) {
    return true;
  }

  const previousCreatedAt = Date.parse(previous.createdAt);
  const asOfMidday = Date.parse(`${input.asOfDate}T12:00:00.000Z`);
  if (!Number.isFinite(previousCreatedAt) || !Number.isFinite(asOfMidday)) {
    return true;
  }

  const cooldownMs = freshnessDecayCooldownHours * 60 * 60 * 1000;
  return asOfMidday - previousCreatedAt >= cooldownMs;
}

async function dispatchFreshnessDecayNotifications(
  runtime: Runtime,
  input: {
    asOfDate: string;
    userIds?: string[];
  }
): Promise<{
  evaluated: number;
  fired: number;
  attempted: number;
  delivered: number;
  failed: number;
}> {
  const recipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
    notificationType: "freshness_decay",
    userIds: input.userIds
  });
  const recipientsByUser = groupPushTargetsByUser(recipients);

  let evaluated = 0;
  let fired = 0;
  let attempted = 0;
  let delivered = 0;
  let failed = 0;

  for (const [userId, userTargets] of recipientsByUser.entries()) {
    const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(userId);
    const recentFreshnessAlerts = (await runtime.store.listAlertLedgerItemsByUser({
      userId,
      limit: 200
    }))
      .filter((alert) => alert.notificationType === "freshness_decay")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const latestFreshnessAlertByTicker = new Map<string, AlertLedgerRecord>();
    for (const alert of recentFreshnessAlerts) {
      const ticker = typeof alert.context?.ticker === "string"
        ? alert.context.ticker.trim().toUpperCase()
        : "";
      if (ticker.length === 0 || latestFreshnessAlertByTicker.has(ticker)) {
        continue;
      }
      latestFreshnessAlertByTicker.set(ticker, alert);
    }

    evaluated += snapshots.length;
    const candidates = snapshots
      .filter((snapshot) => snapshot.freshnessState === "stale" || snapshot.freshnessState === "triggered")
      .sort((left, right) => {
        const bySeverity = freshnessSeverity(right.freshnessState) - freshnessSeverity(left.freshnessState);
        if (bySeverity !== 0) {
          return bySeverity;
        }
        const byEvents = right.unreviewedEventsCount - left.unreviewedEventsCount;
        if (byEvents !== 0) {
          return byEvents;
        }
        const byScore = left.freshnessScore - right.freshnessScore;
        if (byScore !== 0) {
          return byScore;
        }
        return left.ticker.localeCompare(right.ticker);
      });

    const lead = candidates.find((candidate) =>
      shouldDispatchFreshnessAlert({
        previous: latestFreshnessAlertByTicker.get(candidate.ticker.trim().toUpperCase()),
        candidate,
        asOfDate: input.asOfDate
      })
    );
    if (!lead) {
      continue;
    }

    fired += 1;
    const route = notificationRoute("freshness_decay");
    const title = notificationTitle("freshness_decay", lead.ticker);
    const remaining = candidates.filter((candidate) => candidate.ticker !== lead.ticker);
    const additional = Math.max(0, remaining.length);
    const body = additional > 0
      ? `${lead.ticker} is ${lead.freshnessState}. ${additional} more name(s) also need review.`
      : `${lead.ticker} is ${lead.freshnessState}. Open Names to review what changed.`;
    const relatedTickers = remaining.slice(0, 4).map((row) => row.ticker);

    const alertId = createId();
    const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
      notificationType: "freshness_decay",
      route,
      title,
      body,
      data: {
        alert_id: alertId,
        ticker: lead.ticker,
        tickers: relatedTickers.join(","),
        reason_code: "freshness_decay_review_needed",
        reason_text: lead.freshnessReason,
        freshness_state: lead.freshnessState,
        freshness_score: lead.freshnessScore.toFixed(3),
        material_events_count: String(lead.materialEventsCount),
        unreviewed_events_count: String(lead.unreviewedEventsCount),
        last_deep_dive_at: lead.lastDeepDiveAt ?? "",
        kill_switch_triggered_at: lead.killSwitchTriggeredAt ?? "",
        deep_link_target: route
      }
    });
    attempted += pushResult.attempted;
    delivered += pushResult.delivered;
    failed += pushResult.failed;
    for (const invalidTarget of pushResult.invalidTargets) {
      await runtime.store.invalidateUserDeviceByInstallation({
        userId: invalidTarget.userId,
        installationId: invalidTarget.installationId,
        invalidatedAt: new Date().toISOString(),
        reason: "fcm_invalid_registration"
      });
    }

    await recordAlertLedgerItem(runtime, {
      id: alertId,
      userId,
      notificationType: "freshness_decay",
      route,
      title,
      body,
      reasonCode: "freshness_decay_review_needed",
      reasonText: lead.freshnessReason,
      deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
      data: {
        ticker: lead.ticker,
        tickers: relatedTickers.join(","),
        freshness_state: lead.freshnessState,
        freshness_score: lead.freshnessScore.toFixed(3),
        material_events_count: String(lead.materialEventsCount),
        unreviewed_events_count: String(lead.unreviewedEventsCount),
        last_deep_dive_at: lead.lastDeepDiveAt ?? "",
        kill_switch_triggered_at: lead.killSwitchTriggeredAt ?? "",
        report_date: input.asOfDate,
        deep_link_target: route
      }
    });
  }

  return {
    evaluated,
    fired,
    attempted,
    delivered,
    failed
  };
}

interface MorningExceptionCandidate {
  ticker: string;
  priority: number;
  route: AlertRouteTarget;
  reasonCode: string;
  reasonText: string;
  reportId?: string;
}

interface MorningExceptionBriefingOutcome {
  mode: MorningExceptionBriefingMode;
  watchlistCount: number;
  exceptionsCount: number;
  title: string;
  body: string;
  reasonCode: string;
  reasonText: string;
  leadRoute?: AlertRouteTarget;
  leadTicker?: string;
  leadReportId?: string;
  relatedTickers: string[];
}

type WarRoomPhase = "pre" | "live" | "post";
type WarRoomCycleStatus = "success" | "failure" | "timeout";

interface WarRoomRecord {
  warRoomId: string;
  userId: string;
  ticker: string;
  earningsEventId: string;
  eventDate: string;
  state: "pre" | "live" | "post" | "closed";
  currentCadenceMin: number;
  failureStreak: number;
  lagBreachStreak: number;
  runtimeBreachStreak: number;
  healthyStreak: number;
  lastCycleStatus?: WarRoomCycleStatus;
  lastLagMin?: number;
  lastRuntimeMin?: number;
  lastCycleAt?: string;
  preparedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WarRoomCycleMetrics {
  status: WarRoomCycleStatus;
  lagMinutes: number;
  runtimeMinutes: number;
}

interface WarRoomCadenceResult {
  nextCadenceMin: number;
  failureStreak: number;
  lagBreachStreak: number;
  runtimeBreachStreak: number;
  healthyStreak: number;
  triggerType?: "failures" | "lag_breach" | "runtime_breach" | "healthy_recovery";
  transitioned: boolean;
}

function normalizeWarRoomState(value: string | undefined): WarRoomRecord["state"] {
  if (value === "live" || value === "post" || value === "closed") {
    return value;
  }
  return "pre";
}

function toEarningsWarRoomState(state: WarRoomRecord["state"]): EarningsWarRoomRecord["state"] {
  if (state === "live" || state === "post" || state === "closed") {
    return state;
  }
  return "ready";
}

function toLegacyWarRoomState(state: EarningsWarRoomRecord["state"]): WarRoomRecord["state"] {
  if (state === "live" || state === "post" || state === "closed") {
    return state;
  }
  return "pre";
}

function asWarRoomPhase(value: string | undefined): WarRoomPhase {
  if (value === "live" || value === "post") {
    return value;
  }
  return "pre";
}

function asWarRoomCycleStatus(value: unknown): WarRoomCycleStatus {
  if (typeof value !== "string") {
    return "success";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "failed" || normalized === "failure") {
    return "failure";
  }
  if (normalized === "timeout") {
    return "timeout";
  }
  return "success";
}

function boundedWholeNumber(value: unknown, fallback: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(max, Math.floor(value)));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(max, Math.floor(parsed)));
    }
  }
  return fallback;
}

function computeWarRoomCadence(
  warRoom: Pick<
    WarRoomRecord,
    "currentCadenceMin" | "failureStreak" | "lagBreachStreak" | "runtimeBreachStreak" | "healthyStreak"
  >,
  cycle: WarRoomCycleMetrics
): WarRoomCadenceResult {
  const failedCycle = cycle.status === "failure" || cycle.status === "timeout";
  const failureStreak = failedCycle ? warRoom.failureStreak + 1 : 0;
  const lagBreachStreak =
    cycle.lagMinutes >= warRoomLagFallbackThresholdMinutes ? warRoom.lagBreachStreak + 1 : 0;
  const runtimeBreachStreak =
    cycle.runtimeMinutes > warRoomRuntimeFallbackThresholdMinutes
      ? warRoom.runtimeBreachStreak + 1
      : 0;
  const healthyCycle =
    cycle.status === "success" &&
    cycle.lagMinutes <= warRoomLagRecoveryThresholdMinutes &&
    cycle.runtimeMinutes <= warRoomRuntimeRecoveryThresholdMinutes;
  const healthyStreak = healthyCycle ? warRoom.healthyStreak + 1 : 0;

  let nextCadenceMin =
    warRoom.currentCadenceMin === warRoomFallbackCadenceMinutes
      ? warRoomFallbackCadenceMinutes
      : warRoomFastCadenceMinutes;
  let triggerType: WarRoomCadenceResult["triggerType"];

  if (nextCadenceMin === warRoomFastCadenceMinutes) {
    if (failureStreak >= warRoomFallbackConsecutiveThreshold) {
      nextCadenceMin = warRoomFallbackCadenceMinutes;
      triggerType = "failures";
    } else if (lagBreachStreak >= warRoomFallbackConsecutiveThreshold) {
      nextCadenceMin = warRoomFallbackCadenceMinutes;
      triggerType = "lag_breach";
    } else if (runtimeBreachStreak >= warRoomFallbackConsecutiveThreshold) {
      nextCadenceMin = warRoomFallbackCadenceMinutes;
      triggerType = "runtime_breach";
    }
  } else if (
    healthyStreak >= warRoomRecoveryHealthyThreshold
  ) {
    nextCadenceMin = warRoomFastCadenceMinutes;
    triggerType = "healthy_recovery";
  }

  const transitioned = nextCadenceMin !== warRoom.currentCadenceMin;
  return {
    nextCadenceMin,
    failureStreak: transitioned && triggerType === "healthy_recovery" ? 0 : failureStreak,
    lagBreachStreak: transitioned && triggerType === "healthy_recovery" ? 0 : lagBreachStreak,
    runtimeBreachStreak: transitioned && triggerType === "healthy_recovery" ? 0 : runtimeBreachStreak,
    healthyStreak,
    triggerType,
    transitioned
  };
}

function defaultWarRoomCycleMetrics(): WarRoomCycleMetrics {
  return {
    status: "success",
    lagMinutes: 0,
    runtimeMinutes: 0
  };
}

function parseWarRoomCycleFixture(
  value: unknown
): { warRoomId?: string; ticker?: string; metrics: WarRoomCycleMetrics } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const rawWarRoomId = typeof record.war_room_id === "string" ? record.war_room_id.trim() : "";
  const rawTicker = typeof record.ticker === "string" ? record.ticker.trim().toUpperCase() : "";
  return {
    warRoomId: rawWarRoomId.length > 0 ? rawWarRoomId : undefined,
    ticker: rawTicker.length > 0 ? rawTicker : undefined,
    metrics: {
      status: asWarRoomCycleStatus(record.status),
      lagMinutes: boundedWholeNumber(record.lag_minutes, 0, 120),
      runtimeMinutes: boundedWholeNumber(record.runtime_minutes, 0, 120)
    }
  };
}

function toEarningsCycleStatus(
  value: WarRoomCycleStatus | undefined
): "success" | "failure" | "timeout" | undefined {
  if (value === "failure" || value === "timeout" || value === "success") {
    return value;
  }
  return undefined;
}

function toLegacyWarRoomRecord(record: EarningsWarRoomRecord): WarRoomRecord {
  return {
    warRoomId: record.id,
    userId: record.userId,
    ticker: record.ticker,
    earningsEventId: record.earningsEventId,
    eventDate: record.eventDate,
    state: toLegacyWarRoomState(record.state),
    currentCadenceMin: record.currentCadenceMin,
    failureStreak: record.cadenceState.consecutive_failures,
    lagBreachStreak: record.cadenceState.consecutive_lag_breaches,
    runtimeBreachStreak: record.cadenceState.consecutive_runtime_breaches,
    healthyStreak: record.cadenceState.consecutive_healthy_cycles,
    lastCycleStatus: record.cadenceState.latest_cycle_status
      ? asWarRoomCycleStatus(record.cadenceState.latest_cycle_status)
      : undefined,
    lastLagMin: record.cadenceState.latest_source_freshness_lag_min,
    lastRuntimeMin: record.cadenceState.latest_runtime_min,
    lastCycleAt: record.cadenceState.updated_at,
    preparedAt: record.preparedAt,
    closedAt: record.closedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toEarningsWarRoomRecord(record: WarRoomRecord): EarningsWarRoomRecord {
  return {
    id: record.warRoomId,
    userId: record.userId,
    ticker: record.ticker,
    earningsEventId: record.earningsEventId,
    eventDate: record.eventDate,
    state: toEarningsWarRoomState(record.state),
    currentCadenceMin: record.currentCadenceMin === 30 ? 30 : 15,
    cadenceState: {
      current_cadence_min: record.currentCadenceMin === 30 ? 30 : 15,
      default_cadence_min: 15,
      fallback_cadence_min: 30,
      consecutive_failures: Math.max(0, Math.floor(record.failureStreak)),
      consecutive_lag_breaches: Math.max(0, Math.floor(record.lagBreachStreak)),
      consecutive_runtime_breaches: Math.max(0, Math.floor(record.runtimeBreachStreak)),
      consecutive_healthy_cycles: Math.max(0, Math.floor(record.healthyStreak)),
      latest_cycle_status: toEarningsCycleStatus(record.lastCycleStatus),
      latest_source_freshness_lag_min: record.lastLagMin,
      latest_runtime_min: record.lastRuntimeMin,
      updated_at: record.lastCycleAt ?? record.updatedAt
    },
    preparedAt: record.preparedAt,
    closedAt: record.closedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function findWarRoomByUserTickerEvent(
  runtime: Runtime,
  input: {
    userId: string;
    ticker: string;
    earningsEventId: string;
  }
): Promise<WarRoomRecord | undefined> {
  const found = await runtime.store.findWarRoomByEvent(input);
  return found ? toLegacyWarRoomRecord(found) : undefined;
}

async function upsertWarRoom(runtime: Runtime, input: WarRoomRecord): Promise<WarRoomRecord> {
  const normalized = toEarningsWarRoomRecord(input);
  const existing = await runtime.store.getWarRoom({
    id: normalized.id,
    userId: normalized.userId
  });
  const saved = existing
    ? await runtime.store.updateWarRoom(normalized)
    : await runtime.store.createWarRoom(normalized);
  return toLegacyWarRoomRecord(saved ?? normalized);
}

async function listWarRooms(
  runtime: Runtime,
  input: {
    eventDateFrom?: string;
    eventDateTo?: string;
    states?: Array<WarRoomRecord["state"]>;
    userIds?: string[];
  }
): Promise<WarRoomRecord[]> {
  const explicitUserIds = (input.userIds ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const userIds =
    explicitUserIds.length > 0
      ? [...new Set(explicitUserIds)]
      : (await runtime.store.listUsersWithWatchlist()).map((entry) => entry.userId);

  const all: WarRoomRecord[] = [];
  for (const userId of userIds) {
    const rooms = await runtime.store.listWarRoomsByUser({
      userId,
      includeClosed: true,
      limit: 250
    });
    for (const room of rooms) {
      all.push(toLegacyWarRoomRecord(room));
    }
  }

  return all
    .filter((room) => (input.states ? input.states.includes(room.state) : true))
    .filter((room) =>
      input.eventDateFrom ? room.eventDate.localeCompare(input.eventDateFrom) >= 0 : true
    )
    .filter((room) =>
      input.eventDateTo ? room.eventDate.localeCompare(input.eventDateTo) <= 0 : true
    );
}

async function getWarRoomById(
  runtime: Runtime,
  input: { warRoomId: string; userId: string }
): Promise<WarRoomRecord | undefined> {
  const room = await runtime.store.getWarRoom({
    id: input.warRoomId,
    userId: input.userId
  });
  return room ? toLegacyWarRoomRecord(room) : undefined;
}

async function createWarRoomTimelineEvent(
  runtime: Runtime,
  input: {
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
    sourceRefs?: EarningsWarRoomSourceRef[];
    alertLedgerId?: string;
    reportId?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }
): Promise<EarningsWarRoomTimelineEventRecord> {
  return runtime.store.createWarRoomTimelineEvent({
    id: createId(),
    warRoomId: input.warRoomId,
    phase: input.phase,
    eventType: input.eventType,
    reasonText: input.reasonText,
    sourceRefs: input.sourceRefs ?? [],
    alertLedgerId: input.alertLedgerId,
    reportId: input.reportId,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt
  });
}

async function queueDeepDiveRefresh(
  runtime: Runtime,
  input: { userId: string; ticker: string; createdAt: string }
): Promise<JobRecord | undefined> {
  const job = await runtime.store.createJob({
    id: createId(),
    type: "deep_dive",
    userId: input.userId,
    ticker: input.ticker,
    createdAt: input.createdAt
  });

  try {
    await runtime.queue.publish(job.id);
    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue publish failed";
    await runtime.store.markJobFailed(job.id, new Date().toISOString(), message);
    captureException(new Error(message), {
      service: serviceName,
      job_id: job.id,
      user_id: input.userId,
      ticker: input.ticker
    });
    return undefined;
  }
}

function truncateMessage(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function safeParseDateMs(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function contextPulseDate(alert: AlertLedgerRecord): string | undefined {
  const pulseDate =
    typeof alert.context?.pulse_date === "string" && alert.context.pulse_date.trim().length > 0
      ? alert.context.pulse_date.trim()
      : undefined;
  if (pulseDate) {
    return pulseDate;
  }
  const reportDate =
    typeof alert.context?.report_date === "string" && alert.context.report_date.trim().length > 0
      ? alert.context.report_date.trim()
      : undefined;
  return reportDate;
}

function hasAlertForPulseDate(
  alerts: AlertLedgerRecord[],
  input: {
    notificationType: NotificationType;
    pulseDate: string;
  }
): boolean {
  return alerts.some(
    (alert) =>
      alert.notificationType === input.notificationType &&
      contextPulseDate(alert) === input.pulseDate
  );
}

function buildMorningExceptionBriefing(input: {
  watchlistTickers: string[];
  snapshots: ThesisMonitorSnapshotRecord[];
  matchedEvaluations: KillSwitchEvaluationRecord[];
  macroHeadline?: string;
}): MorningExceptionBriefingOutcome {
  const normalizedWatchlist = input.watchlistTickers
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => ticker.length > 0);
  const watchlistSet = new Set(normalizedWatchlist);
  const snapshotByTicker = new Map<string, ThesisMonitorSnapshotRecord>();
  for (const snapshot of input.snapshots) {
    snapshotByTicker.set(snapshot.ticker.trim().toUpperCase(), snapshot);
  }

  const matchedEvaluationByTicker = new Map<string, KillSwitchEvaluationRecord>();
  for (const evaluation of input.matchedEvaluations) {
    const ticker = evaluation.ticker.trim().toUpperCase();
    if (!watchlistSet.has(ticker)) {
      continue;
    }
    const current = matchedEvaluationByTicker.get(ticker);
    const currentMs = safeParseDateMs(current?.createdAt) ?? 0;
    const nextMs = safeParseDateMs(evaluation.createdAt) ?? 0;
    if (!current || nextMs >= currentMs) {
      matchedEvaluationByTicker.set(ticker, evaluation);
    }
  }

  const candidates: MorningExceptionCandidate[] = [];
  for (const ticker of normalizedWatchlist) {
    const snapshot = snapshotByTicker.get(ticker);
    const matchedEvaluation = matchedEvaluationByTicker.get(ticker);
    if (matchedEvaluation) {
      candidates.push({
        ticker,
        priority: 1,
        route: "research",
        reasonCode: "morning_exception_kill_switch",
        reasonText: matchedEvaluation.reasonText,
        reportId: snapshot?.reportId
      });
      continue;
    }

    if (snapshot?.freshnessState === "triggered") {
      candidates.push({
        ticker,
        priority: 2,
        route: "names",
        reasonCode: "morning_exception_freshness",
        reasonText: snapshot.freshnessReason,
        reportId: snapshot.reportId
      });
      continue;
    }

    if (snapshot?.freshnessState === "stale") {
      candidates.push({
        ticker,
        priority: 3,
        route: "names",
        reasonCode: "morning_exception_freshness",
        reasonText: snapshot.freshnessReason,
        reportId: snapshot.reportId
      });
      continue;
    }

    if (snapshot?.state === "weakened" || snapshot?.state === "unresolved") {
      candidates.push({
        ticker,
        priority: 4,
        route: "names",
        reasonCode: "morning_exception_thesis_state",
        reasonText: snapshot.reason,
        reportId: snapshot.reportId
      });
    }
  }

  candidates.sort((left, right) => {
    const byPriority = left.priority - right.priority;
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.ticker.localeCompare(right.ticker);
  });

  if (candidates.length === 0) {
    const noChangeBody = normalizedWatchlist.length > 0
      ? `Nothing changed for your names. Thesis intact across ${normalizedWatchlist.length} name(s).`
      : "No followed names yet. Add names to unlock personalized morning exceptions.";
    const macroSuffix = input.macroHeadline?.trim()
      ? ` Macro context: ${truncateMessage(input.macroHeadline, 92)}.`
      : "";
    return {
      mode: "no_change",
      watchlistCount: normalizedWatchlist.length,
      exceptionsCount: 0,
      title: notificationTypeLabel("morning_exception_briefing"),
      body: `${noChangeBody}${macroSuffix}`.trim(),
      reasonCode: "morning_exception_no_change",
      reasonText: noChangeBody,
      leadRoute: normalizedWatchlist.length > 0 ? "today" : "names",
      relatedTickers: []
    };
  }

  const lead = candidates[0] as MorningExceptionCandidate;
  const relatedTickers = candidates
    .slice(1, 5)
    .map((candidate) => candidate.ticker);
  const remaining = Math.max(0, candidates.length - 1);
  const headline = remaining > 0
    ? `${lead.ticker} needs review. ${remaining} more name(s) are flagged.`
    : `${lead.ticker} needs review this morning.`;
  const macroSuffix = input.macroHeadline?.trim()
    ? ` Macro context: ${truncateMessage(input.macroHeadline, 80)}.`
    : "";

  return {
    mode: "exceptions_present",
    watchlistCount: normalizedWatchlist.length,
    exceptionsCount: candidates.length,
    title:
      candidates.length === 1
        ? "1 exception needs review"
        : `${candidates.length} exceptions need review`,
    body: `${headline}${macroSuffix}`.trim(),
    reasonCode: lead.reasonCode,
    reasonText: lead.reasonText,
    leadRoute: lead.route,
    leadTicker: lead.ticker,
    leadReportId: lead.reportId,
    relatedTickers
  };
}

async function issueTokens(
  runtime: Runtime,
  userId: string,
  sessionId: string,
  refreshTokenExpiresAt: string
): Promise<AuthTokensResponse> {
  const accessToken = signAuthToken(
    {
      sub: userId,
      sid: sessionId,
      typ: "access"
    },
    runtime.config.accessTokenTtlSeconds,
    runtime.config.jwtSecret
  );

  const refreshExpiryUnix = Math.floor(Date.parse(refreshTokenExpiresAt) / 1000);
  const refreshTtlSeconds = Math.max(
    1,
    refreshExpiryUnix - Math.floor(Date.now() / 1000)
  );
  const refreshToken = signAuthToken(
    {
      sub: userId,
      sid: sessionId,
      typ: "refresh"
    },
    refreshTtlSeconds,
    runtime.config.jwtSecret
  );

  return {
    access_token: accessToken.token,
    refresh_token: refreshToken.token,
    token_type: "Bearer",
    access_token_expires_at: accessToken.expiresAt,
    refresh_token_expires_at: refreshTokenExpiresAt
  };
}

async function processMarketPulseJob(
  runtime: Runtime,
  job: JobRecord
): Promise<void> {
  const startedAt = new Date().toISOString();
  const running = await runtime.store.markJobRunning(job.id, startedAt);
  if (!running) {
    return;
  }

  await appendAudit(
    runtime,
    "job.running",
    {
      route: "/internal/pulse/dispatch",
      job_id: running.id,
      status: "running"
    },
    running.userId
  );

  const fallbackCycleEnd = new Date().toISOString();
  const fallbackCycleStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cycleStart = running.cycleStart ?? fallbackCycleStart;
  const cycleEnd = running.cycleEnd ?? fallbackCycleEnd;

  try {
    if (running.ticker === "FORCE_FAIL") {
      throw new Error("Forced market pulse failure");
    }

    let previousReport: MarketPulseReport | undefined;
    try {
      const latestPulse = await runtime.store.getLatestReportByType("market_pulse");
      if (latestPulse) {
        const artifact = await runtime.artifactStore.readReport(latestPulse.artifactKey);
        if (isMarketPulseReport(artifact)) {
          previousReport = artifact;
        }
      }
    } catch (error) {
      logWarn("Previous Market Pulse unavailable for editorial delta", {
        job_id: running.id,
        error: error instanceof Error ? error.message : "unknown error"
      });
    }

    const asOfDate = cycleEnd.slice(0, 10);
    let calendarEvents: Awaited<ReturnType<typeof fetchCalendarEventsFromDataOpenbb>> = [];
    let calendarFetchState: "complete" | "data_unavailable" = "complete";
    let calendarUnavailableReason: string | undefined;
    try {
      calendarEvents = await fetchCalendarEventsFromDataOpenbb(runtime, {
        requestId: running.id,
        startDate: asOfDate,
        endDate: addDaysToIsoDate(asOfDate, 7)
      });
    } catch (error) {
      calendarFetchState = "data_unavailable";
      calendarUnavailableReason =
        error instanceof Error
          ? `Earnings calendar access was unavailable: ${error.message}`
          : "Earnings calendar access was unavailable.";
      logWarn("Market Pulse earnings calendar unavailable", {
        job_id: running.id,
        error: calendarUnavailableReason
      });
    }

    // M4: approved-source headlines feed the headline digest and macro/geopolitical news pack.
    const approvedNews = await fetchEnvelope<unknown>(
      `${runtime.config.marketPulseNewsIngestBaseUrl}/v1/news?date=${encodeURIComponent(asOfDate)}`,
      { headers: { "x-request-id": running.id } }
    );
    const headlineItems = approvedNews.ok ? headlineItemsFromApprovedNews(approvedNews.data) : [];
    const macroNewsUnavailableReason = approvedNews.ok
      ? undefined
      : `Approved headline access was unavailable: ${approvedNews.errorMessage}`;
    if (macroNewsUnavailableReason) {
      logWarn("Market Pulse approved headlines unavailable", {
        job_id: running.id,
        error: macroNewsUnavailableReason
      });
    }

    const pulseReport = await buildMarketPulseReport({
      cycleStart,
      cycleEnd,
      schemaVersion: runtime.config.marketPulseSchemaVersion,
      tickers: runtime.config.marketPulseTickers,
      dataOpenbbBaseUrl: runtime.config.marketPulseDataOpenbbBaseUrl,
      newsIngestBaseUrl: runtime.config.marketPulseNewsIngestBaseUrl,
      previousReport,
      calendarEvents,
      calendarFetchState,
      calendarUnavailableReason,
      headlineItems,
      macroNewsFetchState: approvedNews.ok ? "complete" : "data_unavailable",
      macroNewsUnavailableReason
    });
    const report = assertIncomingMarketPulseReport(pulseReport);

    let artifactKey: string | undefined;
    try {
      artifactKey = await runtime.artifactStore.writeReport(report);
      await runtime.store.createReport({
        id: report.report_id,
        jobId: running.id,
        type: "market_pulse",
        schemaVersion: report.schema_version,
        artifactKey,
        createdAt: report.cycle_end,
        isCurrent: true
      });

      const completed = await runtime.store.markJobComplete(
        running.id,
        new Date().toISOString(),
        report.report_id
      );
      if (!completed) {
        await cleanupStoredReport(runtime, report.report_id, artifactKey);
        await runtime.store.markJobFailed(
          running.id,
          new Date().toISOString(),
          "Job was not found for completion."
        );
        return;
      }

      await appendAudit(
        runtime,
        "job.complete",
        {
          route: "/internal/pulse/dispatch",
          job_id: completed.id,
          report_id: report.report_id,
          status: "complete"
        },
        completed.userId
      );

      const unavailableFlags = report.flags.filter((flag) =>
        flag.startsWith("data_unavailable:")
      );
      if (unavailableFlags.length > 0) {
        const message = "Market Pulse degraded with unavailable data";
        captureException(new Error(message), {
          service: serviceName,
          job_id: completed.id,
          report_id: report.report_id,
          cycle_start: report.cycle_start,
          cycle_end: report.cycle_end,
          unavailable_flags: unavailableFlags
        });
      }

      const firstHeadlineCandidate =
        report.sections.bounded_context.evidence?.[0]?.excerpt ??
        report.sections.canonical_events.evidence?.[0]?.excerpt ??
        report.sections.news_summary?.evidence?.[0]?.excerpt;
      const headline =
        typeof firstHeadlineCandidate === "string" && firstHeadlineCandidate.trim().length > 0
          ? firstHeadlineCandidate.trim()
          : undefined;
      const pulseDate = report.cycle_end.slice(0, 10);
      const cycleStartIso =
        report.cycle_start && Number.isFinite(Date.parse(report.cycle_start))
          ? report.cycle_start
          : `${pulseDate}T00:00:00.000Z`;

      const freePulseTargets = await runtime.store.listUsersWithDeviceTokenByNotificationType({
        notificationType: "market_pulse_ready",
        tier: "FREE"
      });
      const freePulseTargetsByUser = groupPushTargetsByUser(freePulseTargets);
      const proBriefingTargets = await runtime.store.listUsersWithDeviceTokenByNotificationType({
        notificationType: "morning_exception_briefing",
        tier: "PRO"
      });
      const proBriefingTargetsByUser = groupPushTargetsByUser(proBriefingTargets);

      const recentAlertsByUser = new Map<string, AlertLedgerRecord[]>();
      const listRecentAlerts = async (userId: string): Promise<AlertLedgerRecord[]> => {
        const cached = recentAlertsByUser.get(userId);
        if (cached) {
          return cached;
        }
        const rows = await runtime.store.listAlertLedgerItemsByUser({
          userId,
          limit: 100
        });
        recentAlertsByUser.set(userId, rows);
        return rows;
      };

      let attempted = 0;
      let delivered = 0;
      let failed = 0;
      let provider: "stub" | "fcm" = runtime.config.pushProviderMode;
      let freeSent = 0;
      let freeDeduped = 0;
      let proSent = 0;
      let proDeduped = 0;
      let proNoChange = 0;
      let proExceptions = 0;

      for (const [userId, userTargets] of freePulseTargetsByUser.entries()) {
        const existingAlerts = await listRecentAlerts(userId);
        if (
          hasAlertForPulseDate(existingAlerts, {
            notificationType: "market_pulse_ready",
            pulseDate
          })
        ) {
          freeDeduped += 1;
          continue;
        }

        const alertId = createId();
        const reasonText =
          "Your latest market pulse is ready with the current regime and overnight movers.";
        const title = headline ?? notificationTitle("market_pulse_ready");
        const body = "Your Morning Pulse is ready. Here is what moved overnight.";
        const route = notificationRoute("market_pulse_ready");
        const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
          notificationType: "market_pulse_ready",
          route,
          title,
          body,
          data: {
            alert_id: alertId,
            report_date: pulseDate,
            reason_code: "market_pulse_ready",
            reason_text: reasonText,
            deep_link_target: route
          }
        });

        attempted += pushResult.attempted;
        delivered += pushResult.delivered;
        failed += pushResult.failed;
        provider = pushResult.provider;

        for (const invalidTarget of pushResult.invalidTargets) {
          await runtime.store.invalidateUserDeviceByInstallation({
            userId: invalidTarget.userId,
            installationId: invalidTarget.installationId,
            invalidatedAt: new Date().toISOString(),
            reason: "fcm_invalid_registration"
          });
        }

        const alert = await recordAlertLedgerItem(runtime, {
          id: alertId,
          userId,
          notificationType: "market_pulse_ready",
          route,
          title,
          body,
          reasonCode: "market_pulse_ready",
          reasonText,
          deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
          data: {
            report_date: pulseDate,
            deep_link_target: route
          }
        });
        freeSent += 1;
        recentAlertsByUser.set(userId, [alert, ...existingAlerts]);
      }

      for (const [userId, userTargets] of proBriefingTargetsByUser.entries()) {
        const existingAlerts = await listRecentAlerts(userId);
        if (
          hasAlertForPulseDate(existingAlerts, {
            notificationType: "morning_exception_briefing",
            pulseDate
          })
        ) {
          proDeduped += 1;
          continue;
        }

        const watchlistTickers = await runtime.store.listWatchlistTickersByUser(userId);
        const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(userId);
        const matchedEvaluations = await runtime.store.listKillSwitchEvaluations({
          userId,
          outcomes: ["matched"],
          sinceIso: cycleStartIso,
          limit: 500
        });
        const briefing = buildMorningExceptionBriefing({
          watchlistTickers,
          snapshots,
          matchedEvaluations,
          macroHeadline: headline
        });

        const route = notificationRoute("morning_exception_briefing");
        const alertId = createId();
        const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
          notificationType: "morning_exception_briefing",
          route,
          title: briefing.title,
          body: briefing.body,
          data: {
            alert_id: alertId,
            report_date: pulseDate,
            reason_code: briefing.reasonCode,
            reason_text: briefing.reasonText,
            deep_link_target: route,
            briefing_mode: briefing.mode,
            exceptions_count: String(briefing.exceptionsCount),
            watchlist_count: String(briefing.watchlistCount),
            lead_route: briefing.leadRoute ?? "today",
            lead_ticker: briefing.leadTicker ?? "",
            lead_report_id: briefing.leadReportId ?? "",
            lead_pulse_date: pulseDate,
            tickers: briefing.relatedTickers.join(",")
          }
        });

        attempted += pushResult.attempted;
        delivered += pushResult.delivered;
        failed += pushResult.failed;
        provider = pushResult.provider;

        for (const invalidTarget of pushResult.invalidTargets) {
          await runtime.store.invalidateUserDeviceByInstallation({
            userId: invalidTarget.userId,
            installationId: invalidTarget.installationId,
            invalidatedAt: new Date().toISOString(),
            reason: "fcm_invalid_registration"
          });
        }

        const alert = await recordAlertLedgerItem(runtime, {
          id: alertId,
          userId,
          notificationType: "morning_exception_briefing",
          route,
          title: briefing.title,
          body: briefing.body,
          reasonCode: briefing.reasonCode,
          reasonText: briefing.reasonText,
          deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
          data: {
            report_date: pulseDate,
            deep_link_target: route,
            briefing_mode: briefing.mode,
            exceptions_count: String(briefing.exceptionsCount),
            watchlist_count: String(briefing.watchlistCount),
            lead_route: briefing.leadRoute ?? "today",
            lead_ticker: briefing.leadTicker ?? "",
            lead_report_id: briefing.leadReportId ?? "",
            lead_pulse_date: pulseDate,
            tickers: briefing.relatedTickers.join(",")
          }
        });

        proSent += 1;
        if (briefing.mode === "no_change") {
          proNoChange += 1;
        } else {
          proExceptions += 1;
        }
        recentAlertsByUser.set(userId, [alert, ...existingAlerts]);
      }

      logInfo("Market Pulse push delivery attempted", {
        job_id: completed.id,
        attempted,
        delivered,
        failed,
        provider,
        free_sent: freeSent,
        free_deduped: freeDeduped,
        pro_sent: proSent,
        pro_deduped: proDeduped,
        pro_no_change: proNoChange,
        pro_exceptions: proExceptions
      });

      if (failed > 0) {
        const error = new Error("Push delivery partially failed");
        captureException(error, {
          service: serviceName,
          job_id: completed.id,
          attempted,
          delivered,
          failed
        });
      }

      await appendAudit(
        runtime,
        "market_pulse.push_delivery",
        {
          route: "/internal/pulse/dispatch",
          job_id: completed.id,
          attempted,
          delivered,
          failed,
          provider,
          free_sent: freeSent,
          free_deduped: freeDeduped,
          pro_sent: proSent,
          pro_deduped: proDeduped,
          pro_no_change: proNoChange,
          pro_exceptions: proExceptions
        },
        completed.userId
      );
    } catch (error) {
      if (artifactKey) {
        await cleanupStoredReport(runtime, report.report_id, artifactKey);
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market Pulse processing failed";
    const failed = await runtime.store.markJobFailed(
      running.id,
      new Date().toISOString(),
      message
    );

    await appendAudit(
      runtime,
      "job.failed",
      {
        route: "/internal/pulse/dispatch",
        job_id: running.id,
        status: "failed",
        error_message: message
      },
      failed?.userId
    );

    captureException(new Error(message), {
      service: serviceName,
      job_id: running.id
    });
  }
}

async function createRuntime(config: ProductApiConfig): Promise<Runtime> {
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`Invalid configuration: ${configErrors.join("; ")}`);
  }

  initSentry({
    enabled: Boolean(process.env.SENTRY_DSN),
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development"
  });

  const store = await createProductStore(config);
  const queue = await createJobQueue({
    backend: config.queueBackend,
    queueKey: config.queueKey,
    redisUrl: config.redisUrl
  });
  const rateLimiter = await createRateLimiter({
    backend: config.queueBackend,
    redisUrl: config.redisUrl,
    windowSeconds: config.rateLimitWindowSeconds,
    maxRequests: config.rateLimitMaxRequests
  });
  const artifactStore = createArtifactStore(config);
  const pushNotifier = new PushNotifier({
    provider: config.pushProviderMode,
    googleApplicationCredentials: config.googleApplicationCredentials
  });
  const emailNotifier = new EmailNotifier({
    provider: config.emailProviderMode,
    resendApiBaseUrl: config.emailResendApiBaseUrl,
    resendApiKey: config.emailResendApiKey,
    fromAddress: config.emailFromAddress
  });
  const tickerSyncScheduler =
    config.storeBackend === "postgres" && config.tickerAutoSyncEnabled
      ? startTickerSyncScheduler(
        store,
        {
          enabled: config.tickerAutoSyncEnabled,
          runOnStartup: config.tickerAutoSyncRunOnStartup,
          deltaIntervalSeconds: config.tickerDeltaSyncIntervalSeconds,
          fullIntervalSeconds: config.tickerFullSyncIntervalSeconds
        },
        process.env
      )
      : undefined;
  const jobRecoveryScheduler = startJobRecoveryScheduler(store, queue, config);
  const runtime: Runtime = {
    config,
    store,
    queue,
    rateLimiter,
    artifactStore,
    pushNotifier,
    emailNotifier,
    close: async () => {
      await Promise.all([
        tickerSyncScheduler?.close() ?? Promise.resolve(),
        jobRecoveryScheduler.close(),
        store.close(),
        queue.close(),
        rateLimiter.close()
      ]);
    }
  };

  if (config.adminBootstrapRequested && !config.adminBootstrapEnabled) {
    logWarn("Admin bootstrap ignored outside non-production environment.", {
      node_env: config.nodeEnv
    });
  } else if (config.adminBootstrapEnabled) {
    await ensureAdminBootstrapUser(runtime);
    logInfo("Admin bootstrap is active for non-production.", {
      node_env: config.nodeEnv
    });
  }

  return runtime;
}

export function startServer(port: number = loadConfig().port): Server {
  const config = {
    ...loadConfig(),
    port
  };
  const corsAllowedOrigins = new Set(config.corsAllowedOrigins);
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`Invalid configuration: ${configErrors.join("; ")}`);
  }
  const runtimePromise = createRuntime(config);

  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const origin = extractRequestOrigin(request);
    const allowedOrigin = origin && corsAllowedOrigins.has(origin) ? origin : undefined;
    const meta: RequestMeta = {
      requestId: request.headers["x-request-id"]?.toString() ?? randomUUID(),
      pathname
    };

    applySecurityHeaders(response, config.nodeEnv);
    if (allowedOrigin) {
      applyCorsHeaders(response, allowedOrigin);
    }

    if (method === "OPTIONS") {
      if (!origin || !request.headers["access-control-request-method"]) {
        sendJson(response, 400, {
          error: "validation_failed",
          error_message: "CORS preflight request is missing required headers."
        });
        return;
      }
      if (!allowedOrigin) {
        sendJson(response, 403, {
          error: "forbidden_origin",
          error_message: "Origin is not allowed."
        });
        return;
      }
      response.writeHead(204);
      response.end();
      return;
    }

    if (method === "GET" && pathname === "/health") {
      const payload: HealthPayload = {
        status: "ok",
        modes: {
          push: config.pushProviderMode,
          email: config.emailProviderMode,
          artifact_store: config.artifactStoreMode
        }
      };
      sendJson(response, 200, payload);
      return;
    }

    let runtime: Runtime;
    try {
      runtime = await runtimePromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime initialization failed";
      logError("Runtime initialization failed", {
        request_id: meta.requestId,
        error_message: message
      });
      captureException(new Error(message), {
        service: serviceName,
        request_id: meta.requestId
      });
      sendJson(response, 500, {
        error: "service_unavailable",
        error_message: "Product API runtime failed to initialize"
      });
      return;
    }
    setRequestJsonBodyLimit(request, runtime.config.maxJsonBodyBytes);

    try {
      if (!pathname.startsWith("/internal/")) {
        const rateLimitPolicy = resolveRateLimitPolicy(runtime.config, method, pathname);
        const rateLimit = await runtime.rateLimiter.check(
          extractClientIp(request),
          `${method}:${rateLimitPolicy.routeKey}`,
          {
            windowSeconds: rateLimitPolicy.windowSeconds,
            maxRequests: rateLimitPolicy.maxRequests
          }
        );
        if (!rateLimit.allowed) {
          logWarn("Rate limit exceeded", {
            request_id: meta.requestId,
            route: pathname,
            rate_limit_route: rateLimitPolicy.routeKey,
            auth_route: rateLimitPolicy.authRoute
          });
          sendJson(response, 429, {
            error: "rate_limited",
            error_message: "Rate limit exceeded. Please retry later.",
            retry_after_seconds: rateLimit.retryAfterSeconds
          });
          return;
        }
      }

      if (
        await handleAuthRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta
          },
          {
            appendAudit,
            authenticateAccessToken,
            authenticateAnyToken,
            createId,
            createOpaqueToken,
            hashOpaqueToken,
            hashPassword,
            isValidEmail,
            issueTokens,
            logInfo,
            maybeBootstrapAdminForLogin,
            normalizeEmail,
            parseBearerToken,
            readJsonBody,
            secondsUntilIso,
            sendJson,
            verifyAuthToken,
            verifyGoogleIdToken,
            verifyPassword
          }
        )
      ) {
        return;
      }

      if (
        await handleCoverageRoutes(
          { method, pathname, request, response, runtime, url },
          {
            hasInternalToken,
            sendJson,
            deepDiveFingerprint: (ticker, latestPeriod) =>
              deepDiveFingerprint({ ticker, schemaVersion: "2.0", latestPeriod })
          }
        )
      ) {
        return;
      }

      if (pathname.startsWith("/internal/")) {
        if (!hasInternalToken(request, runtime.config.internalWorkerToken)) {
          sendJson(response, 401, {
            error: "unauthorized",
            error_message: "Internal token mismatch."
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/canonical-events/ingest") {
          const body = await readJsonBody<{ events?: unknown[] }>(request);
          const rawEvents = Array.isArray(body.events) ? body.events : [];
          if (rawEvents.length === 0) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "events must include at least one canonical event."
            });
            return;
          }

          const invalidIndex = rawEvents.findIndex((event) => !isCanonicalEvent(event));
          if (invalidIndex >= 0) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: `events[${invalidIndex}] is not a valid canonical event.`
            });
            return;
          }

          const events = rawEvents as CanonicalEvent[];
          const result = await runtime.store.upsertCanonicalEvents(events);
          sendJson(response, 200, {
            status: "accepted",
            upserted: result.upserted,
            event_count: events.length
          });
          return;
        }

        if (method === "GET" && pathname === "/internal/canonical-events") {
          const subjectTypeRaw = url.searchParams.get("subject_type")?.trim();
          const subjectType =
            subjectTypeRaw === "ticker" || subjectTypeRaw === "macro_series"
              ? subjectTypeRaw
              : undefined;
          if (subjectTypeRaw && !subjectType) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "subject_type must be ticker or macro_series."
            });
            return;
          }
          const familyRaw = url.searchParams.get("family")?.trim();
          const family =
            familyRaw === "filing_posted" || familyRaw === "macro_release_published"
              ? familyRaw
              : undefined;
          if (familyRaw && !family) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "family must be filing_posted or macro_release_published."
            });
            return;
          }
          const limit = parsePositiveInteger(
            url.searchParams.get("limit")?.trim() ?? undefined,
            50,
            1,
            250
          );
          if (limit === undefined) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "limit must be an integer between 1 and 250."
            });
            return;
          }

          const events = await runtime.store.listCanonicalEvents({
            subjectType,
            subjectId: url.searchParams.get("subject_id")?.trim() || undefined,
            family,
            limit
          });
          sendJson(response, 200, {
            data: events
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/first-party/context/ingest") {
          const body = await readJsonBody<{ context_items?: unknown[]; call_artifacts?: unknown[] }>(request);
          const rawItems = Array.isArray(body.context_items) ? body.context_items : [];
          const rawArtifacts = Array.isArray(body.call_artifacts) ? body.call_artifacts : [];
          if (rawItems.length === 0 && rawArtifacts.length === 0) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "context_items or call_artifacts must include at least one item."
            });
            return;
          }

          const invalidItemIndex = rawItems.findIndex((item) => !isFirstPartyContextItem(item));
          if (invalidItemIndex >= 0) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: `context_items[${invalidItemIndex}] is not a valid first-party context item.`
            });
            return;
          }

          const invalidArtifactIndex = rawArtifacts.findIndex((item) => !isCallArtifact(item));
          if (invalidArtifactIndex >= 0) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: `call_artifacts[${invalidArtifactIndex}] is not a valid call artifact.`
            });
            return;
          }

          const contextItems = rawItems as FirstPartyContextItem[];
          const callArtifacts = rawArtifacts as CallArtifact[];
          const contextResult = await runtime.store.upsertFirstPartyContextItems(contextItems);
          const artifactResult = await runtime.store.upsertCallArtifacts(callArtifacts);
          sendJson(response, 200, {
            status: "accepted",
            context_upserted: contextResult.upserted,
            artifact_upserted: artifactResult.upserted
          });
          return;
        }

        if (method === "GET" && pathname === "/internal/first-party/context") {
          const limit = parsePositiveInteger(
            url.searchParams.get("limit")?.trim() ?? undefined,
            50,
            1,
            250
          );
          if (limit === undefined) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "limit must be an integer between 1 and 250."
            });
            return;
          }

          const queryInput = {
            ticker: url.searchParams.get("ticker")?.trim() || undefined,
            eventId: url.searchParams.get("event_id")?.trim() || undefined,
            limit
          };
          const contextItems = await runtime.store.listFirstPartyContextItems(queryInput);
          const callArtifacts = await runtime.store.listCallArtifacts(queryInput);
          sendJson(response, 200, {
            data: {
              context_items: contextItems,
              call_artifacts: callArtifacts
            }
          });
          return;
        }

        if (method === "GET" && pathname === "/internal/reports/comparable-latest") {
          const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
          if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "ticker query parameter is required and must be a valid US symbol."
            });
            return;
          }

          const schemaMajorRaw = url.searchParams.get("schema_major")?.trim() ?? "2";
          const schemaMajor = Number.parseInt(schemaMajorRaw, 10);
          if (!Number.isFinite(schemaMajor) || schemaMajor < 1 || schemaMajor > 20) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "schema_major must be an integer between 1 and 20."
            });
            return;
          }

          const lookbackDays = parsePositiveInteger(
            url.searchParams.get("lookback_days")?.trim() ?? undefined,
            120,
            1,
            365
          );
          if (lookbackDays === undefined) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "lookback_days must be an integer between 1 and 365."
            });
            return;
          }

          const sinceIso = subtractDaysIso(lookbackDays);
          const comparable = await runtime.store.findLatestComparableDeepDiveReport({
            ticker,
            schemaMajor,
            sinceIso
          });

          if (!comparable) {
            sendJson(response, 200, {
              missing: true,
              data: null
            });
            return;
          }

          const artifact = await runtime.artifactStore.readReport(comparable.artifactKey);
          if (!artifact || !("job_id" in artifact)) {
            sendJson(response, 200, {
              missing: true,
              data: null
            });
            return;
          }

          let report: AnalysisReport;
          try {
            report = assertIncomingAnalysisReport(artifact);
          } catch {
            sendJson(response, 200, {
              missing: true,
              data: null
            });
            return;
          }

          report = await enrichAnalysisReportIssuer(runtime, report);

          sendJson(response, 200, {
            missing: false,
            data: toComparableSummary(report)
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/pulse/dispatch") {
          const body = await readJsonBody<{
            cycle_start?: string;
            cycle_end?: string;
            force_fail?: boolean;
          }>(request);
          const cycleEnd = body.cycle_end?.trim() || new Date().toISOString();
          const cycleStart =
            body.cycle_start?.trim() ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const forceFail = body.force_fail === true;

          if (!isIsoDateTime(cycleStart) || !isIsoDateTime(cycleEnd)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "cycle_start and cycle_end must be valid ISO datetime strings."
            });
            return;
          }

          if (Date.parse(cycleStart) >= Date.parse(cycleEnd)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "cycle_start must be before cycle_end."
            });
            return;
          }

          const existing = await runtime.store.findJobByTypeAndCycleStart(
            "market_pulse",
            cycleStart
          );
          if (existing && existing.status !== "failed") {
            sendJson(response, 200, {
              deduplicated: true,
              job: buildJobStatusResponse(existing)
            });
            return;
          }

          const createdAt = new Date().toISOString();
          const job = await runtime.store.createJob({
            id: createId(),
            type: "market_pulse",
            ticker: forceFail ? "FORCE_FAIL" : undefined,
            cycleStart,
            cycleEnd,
            createdAt
          });

          await appendAudit(runtime, "job.queued", {
            request_id: meta.requestId,
            route: pathname,
            job_id: job.id,
            status: "queued",
            cycle_start: cycleStart,
            cycle_end: cycleEnd
          });

          logInfo("Pulse job queued", {
            request_id: meta.requestId,
            job_id: job.id,
            cycle_start: cycleStart,
            cycle_end: cycleEnd
          });

          setImmediate(() => {
            void processMarketPulseJob(runtime, job);
          });

          sendJson(response, 202, {
            deduplicated: false,
            job: buildJobStatusResponse(job)
          });
          return;
        }

        if (
          method === "POST" &&
          (pathname === "/internal/macro-stress/dispatch" ||
            pathname === "/internal/sentiment/dispatch")
        ) {
          const body = await readJsonBody<{ market_date?: string }>(request);
          const fallbackDate = dateInTimeZone(new Date(), "America/New_York");
          const marketDate = normalizeDateInput(body.market_date ?? fallbackDate);
          if (!marketDate) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "market_date must be in YYYY-MM-DD format."
            });
            return;
          }

          if (!isUsTradingDay(marketDate)) {
            await appendAudit(runtime, "macro_stress.skipped_non_trading_day", {
              request_id: meta.requestId,
              route: pathname,
              market_date: marketDate
            });

            logInfo("Macro Stress dispatch skipped on non-trading day", {
              request_id: meta.requestId,
              market_date: marketDate
            });

            sendJson(response, 200, {
              status: "skipped",
              market_date: marketDate,
              reason: "non_trading_day"
            });
            return;
          }

          try {
            const macroResponse = await fetch(
              `${runtime.config.marketPulseDataOpenbbBaseUrl}/v1/official/macro?scope=daily`
            );
            if (!macroResponse.ok) {
              throw new Error(`Official macro pull failed with HTTP ${macroResponse.status}`);
            }
            const macroPayload = (await macroResponse.json()) as {
              ok?: boolean;
              data?: {
                observations?: unknown[];
              };
              error_flag?: boolean;
              error_message?: string;
            };
            const macroSuccess =
              macroPayload.ok === true &&
              macroPayload.error_flag !== true &&
              macroPayload.data !== undefined &&
              macroPayload.data !== null;
            if (!macroSuccess) {
              throw new Error(
                macroPayload.error_message?.trim() || "Official macro payload returned no data."
              );
            }

            const observations = Array.isArray(macroPayload.data?.observations)
              ? macroPayload.data.observations
              : [];
            const omissions: Array<{
              registry_id: string;
              reason_code: string;
              reason_text: string;
            }> = [];
            if (observations.length === 0) {
              omissions.push({
                registry_id: "OFFICIAL_MACRO",
                reason_code: "missing_input",
                reason_text: "Official macro payload returned no observations."
              });
            }

            const macroStressSnapshot = buildMacroStressSnapshot({
              asOf: marketDate,
              generatedAt: new Date().toISOString(),
              observations: observations as Array<{
                registry_id?: string;
                value?: number;
                unit?: string;
                period?: string;
                category?: string;
                retrieval?: {
                  source?: {
                    source_name?: string;
                  };
                  retrieved_at?: string;
                };
                missing_fields?: unknown[];
              }>,
              omissions
            });
            const persisted = await runtime.store.upsertFearGreedSnapshot({
              snapshot: macroStressToLegacySnapshot(macroStressSnapshot)
            });
            const persistedMacroStress = legacySnapshotToMacroStress(persisted.snapshot);

            await appendAudit(runtime, "macro_stress.snapshot_upserted", {
              request_id: meta.requestId,
              route: pathname,
              market_date: marketDate,
              state: persistedMacroStress.state,
              summary: persistedMacroStress.summary,
              created: persisted.created,
              omissions_count: persistedMacroStress.omissions.length
            });

            sendJson(response, 200, {
              status: persisted.created ? "created" : "updated",
              market_date: marketDate,
              state: persistedMacroStress.state,
              summary: persistedMacroStress.summary,
              no_material_change: persistedMacroStress.no_material_change,
              omissions: persistedMacroStress.omissions,
              score: persisted.snapshot.score,
              label: persisted.snapshot.label,
              missing_inputs: persisted.snapshot.missing_inputs
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Macro Stress dispatch failed";
            await appendAudit(runtime, "macro_stress.dispatch_failed", {
              request_id: meta.requestId,
              route: pathname,
              market_date: marketDate,
              error_message: message
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              market_date: marketDate
            });
            sendJson(response, 503, {
              error: "macro_stress_unavailable",
              error_message: "Macro Stress snapshot could not be generated."
            });
          }
          return;
        }

        if (method === "POST" && pathname === "/internal/calendar/sync") {
          const body = await readJsonBody<{ start_date?: string; end_date?: string }>(request);
          const startDate =
            normalizeDateInput(
              body.start_date ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
            ) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const endDate =
            normalizeDateInput(body.end_date ?? addDaysToIsoDate(startDate, 14)) ??
            addDaysToIsoDate(startDate, 14);
          if (
            Date.parse(`${startDate}T00:00:00.000Z`) >
            Date.parse(`${endDate}T00:00:00.000Z`)
          ) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "start_date must be on or before end_date."
            });
            return;
          }

          let events: CalendarEventSource[];
          try {
            events = await fetchCalendarEventsFromDataOpenbb(runtime, {
              requestId: meta.requestId,
              startDate,
              endDate
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Calendar source unavailable.";
            sendJson(response, 503, {
              error: "calendar_unavailable",
              error_message: message
            });
            return;
          }

          if (events.length === 0) {
            logWarn("Calendar sync returned no usable events", {
              request_id: meta.requestId,
              route: pathname,
              start_date: startDate,
              end_date: endDate
            });
          }
          const supportedTickers = new Set(
            await runtime.store.listTickerCoverageTickers(10_000)
          );
          const filtered = events.filter((event) => supportedTickers.has(event.ticker));
          const upserted = await runtime.store.upsertCalendarEvents(
            filtered.map((event) => ({
              id: createId(),
              ticker: event.ticker.trim().toUpperCase(),
              eventType: "earnings",
              eventDate: event.event_date,
              eventTime: event.event_time,
              provider: event.provider ?? "calendar_feed",
              retrievedAt: event.retrieved_at ?? new Date().toISOString(),
              timingState: normalizeEarningsTimingState(event.timing_state),
              sourceState: normalizeEarningsSourceState(event.source_state, event.provider),
              sourceRef: event.source_ref ?? {},
              reasonText:
                event.reason_text?.trim().length
                  ? event.reason_text.trim()
                  : "No explicit earnings timing reason was provided."
            }))
          );

          await appendAudit(runtime, "calendar.sync_completed", {
            request_id: meta.requestId,
            route: pathname,
            start_date: startDate,
            end_date: endDate,
            source_rows: events.length,
            supported_rows: filtered.length,
            events_upserted: upserted.upserted
          });

          logInfo("Calendar sync complete", {
            request_id: meta.requestId,
            start_date: startDate,
            end_date: endDate,
            source_rows: events.length,
            supported_rows: filtered.length,
            events_upserted: upserted.upserted
          });

          sendJson(response, 200, {
            status: "ok",
            start_date: startDate,
            end_date: endDate,
            source_rows: events.length,
            supported_rows: filtered.length,
            events_upserted: upserted.upserted
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/name-relationships/ingest") {
          const body = await readJsonBody<{
            user_id?: string;
            report_id?: string;
            relationships?: NameRelationshipDraft[];
          }>(request);
          const userId = body.user_id?.trim();
          const reportId = body.report_id?.trim();
          if (!userId || !reportId || !Array.isArray(body.relationships)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "user_id, report_id, and relationships are required."
            });
            return;
          }

          const user = await runtime.store.findUserById(userId);
          const report = await runtime.store.getReportById(reportId);
          if (!user || !report) {
            sendJson(response, 404, {
              error: "not_found",
              error_message: "User or report not found for relationship ingestion."
            });
            return;
          }

          const upserted = await upsertNameRelationships(runtime, {
            userId,
            reportId,
            reportTicker: report.ticker,
            relationships: body.relationships,
            requestId: meta.requestId,
            route: pathname
          });

          sendJson(response, 200, {
            status: "ok",
            upserted
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/earnings-war-room") {
          const body = await readJsonBody<{
            as_of?: string;
            phase?: string;
            force_fail_user_ids?: string[];
            live_fixtures?: Array<{
              war_room_id?: string;
              ticker?: string;
              status?: string;
              lag_minutes?: number;
              runtime_minutes?: number;
            }>;
          }>(request);
          const asOf =
            normalizeDateInput(
              body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
            ) ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const phaseRaw =
            typeof body.phase === "string" ? body.phase.trim().toLowerCase() : "auto";
          const includePre = phaseRaw === "auto" || phaseRaw === "pre";
          const includeLive = phaseRaw === "auto" || phaseRaw === "live";
          const includePost = phaseRaw === "auto" || phaseRaw === "post";
          const allowFailureInjection =
            runtime.config.storeBackend === "memory" && process.env.NODE_ENV !== "production";
          const forcedFailUserIds = new Set(
            allowFailureInjection && Array.isArray(body.force_fail_user_ids)
              ? body.force_fail_user_ids
                  .map((value) => (typeof value === "string" ? value.trim() : ""))
                  .filter((value) => value.length > 0)
              : []
          );
          const proRecipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
            notificationType: "earnings_war_room",
            tier: "PRO"
          });
          const recipientsByUser = groupPushTargetsByUser(proRecipients);
          const cycleFixtures = Array.isArray(body.live_fixtures)
            ? body.live_fixtures
                .map((entry) => parseWarRoomCycleFixture(entry))
                .filter(
                  (entry): entry is { warRoomId?: string; ticker?: string; metrics: WarRoomCycleMetrics } =>
                    Boolean(entry)
                )
            : [];
          const cycleFixtureByWarRoomId = new Map<string, WarRoomCycleMetrics>();
          const cycleFixtureByTicker = new Map<string, WarRoomCycleMetrics>();
          for (const fixture of cycleFixtures) {
            if (fixture.warRoomId) {
              cycleFixtureByWarRoomId.set(fixture.warRoomId, fixture.metrics);
            } else if (fixture.ticker) {
              cycleFixtureByTicker.set(fixture.ticker, fixture.metrics);
            }
          }

          let prepared = 0;
          let liveUpdated = 0;
          let postClosed = 0;
          let attempted = 0;
          let delivered = 0;
          let failed = 0;
          const fallbackUserIds = new Set<string>();

          if (includePre) {
            const prepareToDate = addDaysToIsoDate(asOf, warRoomPreparationLookaheadDays);
            for (const [userId, userTargets] of recipientsByUser.entries()) {
              try {
                if (forcedFailUserIds.has(userId)) {
                  throw new Error("Forced War Room preparation failure for smoke proof.");
                }
                const watchlist = await runtime.store.listWatchlistTickersByUser(userId);
                if (watchlist.length === 0) {
                  continue;
                }
                const events = (await runtime.store.listUpcomingCalendarEventsByTickers({
                  tickers: watchlist,
                  fromDate: asOf,
                  toDate: prepareToDate,
                  eventType: "earnings"
                })).sort((left, right) => {
                  const byDate = left.eventDate.localeCompare(right.eventDate);
                  if (byDate !== 0) {
                    return byDate;
                  }
                  return left.ticker.localeCompare(right.ticker);
                });
                const leadEvent = events[0];
                if (!leadEvent) {
                  continue;
                }
                const ticker = leadEvent.ticker.trim().toUpperCase();
                const earningsStates = await getEarningsEventStateListForUser(runtime, {
                  userId,
                  asOf,
                  tickers: [ticker],
                  windowPastDays: 14,
                  windowAheadDays: Math.max(7, warRoomPreparationLookaheadDays + 3)
                });
                const leadState = findEarningsState(earningsStates.states, {
                  ticker,
                  eventId: leadEvent.id,
                  eventDate: leadEvent.eventDate
                });
                const existing = await findWarRoomByUserTickerEvent(runtime, {
                  userId,
                  ticker,
                  earningsEventId: leadEvent.id
                });
                const nowIso = new Date().toISOString();
                const warRoomId = existing?.warRoomId ?? createId();
                const warRoom = await upsertWarRoom(runtime, {
                  warRoomId,
                  userId,
                  ticker,
                  earningsEventId: leadEvent.id,
                  eventDate: leadEvent.eventDate,
                  state: normalizeWarRoomState(existing?.state),
                  currentCadenceMin: existing?.currentCadenceMin ?? warRoomFastCadenceMinutes,
                  failureStreak: existing?.failureStreak ?? 0,
                  lagBreachStreak: existing?.lagBreachStreak ?? 0,
                  runtimeBreachStreak: existing?.runtimeBreachStreak ?? 0,
                  healthyStreak: existing?.healthyStreak ?? 0,
                  lastCycleStatus: existing?.lastCycleStatus,
                  lastLagMin: existing?.lastLagMin,
                  lastRuntimeMin: existing?.lastRuntimeMin,
                  lastCycleAt: existing?.lastCycleAt,
                  preparedAt: existing?.preparedAt ?? nowIso,
                  closedAt: existing?.closedAt,
                  createdAt: existing?.createdAt ?? nowIso,
                  updatedAt: nowIso
                });

                if (!existing) {
                  prepared += 1;
                  await createWarRoomTimelineEvent(runtime, {
                    warRoomId: warRoom.warRoomId,
                    phase: "pre",
                    eventType: "prepared",
                    reasonText: `${ticker} reports on ${leadEvent.eventDate}. War Room prep is ready.`,
                    sourceRefs: [
                      {
                        kind: "calendar_event",
                        ref_id: leadEvent.id,
                        label: `${ticker} earnings ${leadEvent.eventDate}`
                      }
                    ],
                    metadata: {
                      ticker,
                      event_date: leadEvent.eventDate,
                      earnings_timing_state: leadState?.timing_state ?? "estimated",
                      earnings_source_state: leadState?.source_state ?? "derived",
                      earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                      earnings_conflict: leadState?.conflict.has_conflict ?? false
                    },
                    createdAt: nowIso
                  });
                }

                if (existing) {
                  continue;
                }

                const route = notificationRoute("earnings_war_room");
                const alertId = createId();
                const title = notificationTitle("earnings_war_room", ticker);
                const timingState = leadState?.timing_state ?? "estimated";
                const sourceState = leadState?.source_state ?? "derived";
                const reasonText = `${ticker} reports on ${leadEvent.eventDate}. Timing is ${timingState} (${sourceState.replace("_", " ")}). Open War Room to review thesis watchpoints.`;
                const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
                  notificationType: "earnings_war_room",
                  route,
                  title,
                  body: reasonText,
                  data: {
                    alert_id: alertId,
                    ticker,
                    war_room_id: warRoom.warRoomId,
                    earnings_event_id: leadEvent.id,
                    event_date: leadEvent.eventDate,
                    current_cadence_min: String(warRoom.currentCadenceMin),
                    war_room_phase: "pre",
                    earnings_timing_state: timingState,
                    earnings_source_state: sourceState,
                    earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                    earnings_conflict: leadState?.conflict.has_conflict ? "true" : "false",
                    reason_code: "war_room_prepared",
                    reason_text: reasonText,
                    deep_link_target: route
                  }
                });
                attempted += pushResult.attempted;
                delivered += pushResult.delivered;
                failed += pushResult.failed;
                for (const invalidTarget of pushResult.invalidTargets) {
                  await runtime.store.invalidateUserDeviceByInstallation({
                    userId: invalidTarget.userId,
                    installationId: invalidTarget.installationId,
                    invalidatedAt: new Date().toISOString(),
                    reason: "fcm_invalid_registration"
                  });
                }

                const alert = await recordAlertLedgerItem(runtime, {
                  id: alertId,
                  userId,
                  notificationType: "earnings_war_room",
                  route,
                  title,
                  body: reasonText,
                  reasonCode: "war_room_prepared",
                  reasonText,
                  deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
                  data: {
                    ticker,
                    war_room_id: warRoom.warRoomId,
                    earnings_event_id: leadEvent.id,
                    event_date: leadEvent.eventDate,
                    current_cadence_min: String(warRoom.currentCadenceMin),
                    war_room_phase: "pre",
                    earnings_timing_state: timingState,
                    earnings_source_state: sourceState,
                    earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                    earnings_conflict: leadState?.conflict.has_conflict ? "true" : "false",
                    deep_link_target: route
                  }
                });

                await createWarRoomTimelineEvent(runtime, {
                  warRoomId: warRoom.warRoomId,
                  phase: "pre",
                  eventType: "alert_emitted",
                  reasonText,
                  alertLedgerId: alert.id,
                  sourceRefs: [
                    {
                      kind: "alert_ledger",
                      ref_id: alert.id,
                      label: "War Room pre-event alert"
                    }
                  ],
                  metadata: {
                    ticker,
                    event_date: leadEvent.eventDate,
                    earnings_timing_state: timingState,
                    earnings_source_state: sourceState,
                    earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                    earnings_conflict: leadState?.conflict.has_conflict ?? false
                  },
                  createdAt: new Date().toISOString()
                });
              } catch (error) {
                fallbackUserIds.add(userId);
                const message =
                  error instanceof Error ? error.message : "War Room preparation failed.";
                logWarn("War Room preparation degraded to legacy path", {
                  request_id: meta.requestId,
                  route: pathname,
                  user_id: userId,
                  error_message: message
                });
              }
            }
          }

          if (includeLive) {
            const liveCandidates = await listWarRooms(runtime, {
              eventDateFrom: asOf,
              eventDateTo: asOf,
              states: ["pre", "live", "post"],
              userIds: [...recipientsByUser.keys()]
            });
            for (const warRoom of liveCandidates) {
              if (warRoom.state === "closed") {
                continue;
              }
              const nowIso = new Date().toISOString();
              const cycle =
                cycleFixtureByWarRoomId.get(warRoom.warRoomId) ??
                cycleFixtureByTicker.get(warRoom.ticker) ??
                defaultWarRoomCycleMetrics();
              const cadence = computeWarRoomCadence(warRoom, cycle);
              const nextState: WarRoomRecord["state"] =
                warRoom.state === "pre" ? "live" : normalizeWarRoomState(warRoom.state);
              const updated = await upsertWarRoom(runtime, {
                ...warRoom,
                state: nextState,
                currentCadenceMin: cadence.nextCadenceMin,
                failureStreak: cadence.failureStreak,
                lagBreachStreak: cadence.lagBreachStreak,
                runtimeBreachStreak: cadence.runtimeBreachStreak,
                healthyStreak: cadence.healthyStreak,
                lastCycleStatus: cycle.status,
                lastLagMin: cycle.lagMinutes,
                lastRuntimeMin: cycle.runtimeMinutes,
                lastCycleAt: nowIso,
                updatedAt: nowIso
              });
              const liveStateList = await getEarningsEventStateListForUser(runtime, {
                userId: updated.userId,
                asOf,
                tickers: [updated.ticker],
                windowPastDays: 14,
                windowAheadDays: 14
              });
              const liveEarningsState = findEarningsState(liveStateList.states, {
                ticker: updated.ticker,
                eventId: updated.earningsEventId,
                eventDate: updated.eventDate
              });
              const liveTimingState = liveEarningsState?.timing_state ?? "estimated";
              const liveSourceState = liveEarningsState?.source_state ?? "derived";
              liveUpdated += 1;

              await createWarRoomTimelineEvent(runtime, {
                warRoomId: updated.warRoomId,
                phase: asWarRoomPhase("live"),
                eventType: cadence.transitioned ? "cadence_changed" : "live_cycle_completed",
                reasonText: cadence.transitioned
                  ? `Cadence changed from ${warRoom.currentCadenceMin} min to ${updated.currentCadenceMin} min (${cadence.triggerType ?? "rule"}).`
                  : `Live cycle completed with status ${cycle.status}.`,
                sourceRefs: [
                  {
                    kind: "live_cycle_metrics",
                    ref_id: `${updated.warRoomId}:${nowIso}`,
                    label: `status=${cycle.status}`
                  }
                ],
                metadata: {
                  status: cycle.status,
                  lag_minutes: cycle.lagMinutes,
                  runtime_minutes: cycle.runtimeMinutes,
                  trigger_type: cadence.triggerType,
                  earnings_timing_state: liveTimingState,
                  earnings_source_state: liveSourceState,
                  earnings_evidence_state: liveEarningsState?.evidence_state ?? "calendar_only",
                  earnings_conflict: liveEarningsState?.conflict.has_conflict ?? false
                },
                createdAt: nowIso
              });

              if (!cadence.transitioned) {
                continue;
              }

              const userTargets = recipientsByUser.get(updated.userId);
              if (!userTargets || userTargets.length === 0) {
                continue;
              }

              const route = notificationRoute("earnings_war_room");
              const alertId = createId();
              const reasonText = cadence.triggerType === "healthy_recovery"
                ? `${updated.ticker} War Room recovered to 15-minute cadence.`
                : `${updated.ticker} War Room shifted to 30-minute cadence due to source degradation.`;
              const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
                notificationType: "earnings_war_room",
                route,
                title: notificationTitle("earnings_war_room", updated.ticker),
                body: reasonText,
                data: {
                  alert_id: alertId,
                  ticker: updated.ticker,
                  war_room_id: updated.warRoomId,
                  earnings_event_id: updated.earningsEventId,
                  event_date: updated.eventDate,
                  current_cadence_min: String(updated.currentCadenceMin),
                  war_room_phase: "live",
                  earnings_timing_state: liveTimingState,
                  earnings_source_state: liveSourceState,
                  earnings_evidence_state: liveEarningsState?.evidence_state ?? "calendar_only",
                  earnings_conflict: liveEarningsState?.conflict.has_conflict ? "true" : "false",
                  reason_code:
                    cadence.triggerType === "healthy_recovery"
                      ? "war_room_cadence_recovered"
                      : "war_room_cadence_fallback",
                  reason_text: reasonText,
                  deep_link_target: route
                }
              });
              attempted += pushResult.attempted;
              delivered += pushResult.delivered;
              failed += pushResult.failed;
              for (const invalidTarget of pushResult.invalidTargets) {
                await runtime.store.invalidateUserDeviceByInstallation({
                  userId: invalidTarget.userId,
                  installationId: invalidTarget.installationId,
                  invalidatedAt: new Date().toISOString(),
                  reason: "fcm_invalid_registration"
                });
              }
              const alert = await recordAlertLedgerItem(runtime, {
                id: alertId,
                userId: updated.userId,
                notificationType: "earnings_war_room",
                route,
                title: notificationTitle("earnings_war_room", updated.ticker),
                body: reasonText,
                reasonCode:
                  cadence.triggerType === "healthy_recovery"
                    ? "war_room_cadence_recovered"
                    : "war_room_cadence_fallback",
                reasonText,
                deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
                data: {
                  ticker: updated.ticker,
                  war_room_id: updated.warRoomId,
                  earnings_event_id: updated.earningsEventId,
                  event_date: updated.eventDate,
                  current_cadence_min: String(updated.currentCadenceMin),
                  war_room_phase: "live",
                  earnings_timing_state: liveTimingState,
                  earnings_source_state: liveSourceState,
                  earnings_evidence_state: liveEarningsState?.evidence_state ?? "calendar_only",
                  earnings_conflict: liveEarningsState?.conflict.has_conflict ? "true" : "false",
                  deep_link_target: route
                }
              });
              await createWarRoomTimelineEvent(runtime, {
                warRoomId: updated.warRoomId,
                phase: "live",
                eventType: "alert_emitted",
                reasonText,
                alertLedgerId: alert.id,
                sourceRefs: [
                  {
                    kind: "alert_ledger",
                    ref_id: alert.id,
                    label: "War Room cadence alert"
                  }
                ],
                createdAt: new Date().toISOString()
              });
            }
          }

          if (includePost) {
            const postCandidates = await listWarRooms(runtime, {
              eventDateTo: asOf,
              states: ["pre", "live", "post"],
              userIds: [...recipientsByUser.keys()]
            });
            for (const warRoom of postCandidates) {
              if (warRoom.state === "closed") {
                continue;
              }
              const nowIso = new Date().toISOString();
              const postStateList = await getEarningsEventStateListForUser(runtime, {
                userId: warRoom.userId,
                asOf,
                tickers: [warRoom.ticker],
                windowPastDays: 14,
                windowAheadDays: 14
              });
              const postEarningsState = findEarningsState(postStateList.states, {
                ticker: warRoom.ticker,
                eventId: warRoom.earningsEventId,
                eventDate: warRoom.eventDate
              });
              const postTimingState = postEarningsState?.timing_state ?? "estimated";
              const postSourceState = postEarningsState?.source_state ?? "derived";
              const queuedJob = await queueDeepDiveRefresh(runtime, {
                userId: warRoom.userId,
                ticker: warRoom.ticker,
                createdAt: nowIso
              });

              const triggerKey = `war_room_post:${warRoom.warRoomId}:${asOf}`;
              const activeRules = await runtime.store.listActiveKillSwitchRules({
                asOfIso: nowIso,
                userIds: [warRoom.userId]
              });
              for (const rule of activeRules.filter((rule) => rule.ticker === warRoom.ticker)) {
                const existingEvaluation = await runtime.store.getKillSwitchEvaluation({
                  ruleId: rule.id,
                  signalSource: "event",
                  triggerKey
                });
                if (existingEvaluation) {
                  continue;
                }
                await runtime.store.createKillSwitchEvaluation({
                  id: createId(),
                  ruleId: rule.id,
                  userId: warRoom.userId,
                  ticker: warRoom.ticker,
                  signalSource: "event",
                  triggerKey,
                  outcome: "skipped",
                  reasonCode: "war_room_post_recheck",
                  reasonText: "Post-earnings re-evaluation queued from War Room closure.",
                  createdAt: nowIso,
                  updatedAt: nowIso
                });
              }

              const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(warRoom.userId);
              const snapshot = snapshots.find((entry) => entry.ticker === warRoom.ticker);
              if (snapshot) {
                await runtime.store.upsertThesisMonitorSnapshot({
                  ...snapshot,
                  freshnessState: "current",
                  freshnessScore: 1,
                  materialEventsCount: 0,
                  unreviewedEventsCount: 0,
                  killSwitchTriggeredAt: undefined,
                  freshnessReason: "War Room post-event closure reset freshness and queued Deep Dive review.",
                  updatedAt: nowIso
                });
              }

              const closed = await upsertWarRoom(runtime, {
                ...warRoom,
                state: "closed",
                closedAt: nowIso,
                updatedAt: nowIso
              });
              postClosed += 1;

              const route = notificationRoute("earnings_war_room");
              const reasonText = `${closed.ticker} post-event review started. Deep Dive refresh has been queued.`;
              const userTargets = recipientsByUser.get(closed.userId);
              let alertId: string | undefined;
              if (userTargets && userTargets.length > 0) {
                alertId = createId();
                const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
                  notificationType: "earnings_war_room",
                  route,
                  title: notificationTitle("earnings_war_room", closed.ticker),
                  body: reasonText,
                  data: {
                    alert_id: alertId,
                    ticker: closed.ticker,
                    war_room_id: closed.warRoomId,
                    earnings_event_id: closed.earningsEventId,
                    event_date: closed.eventDate,
                    war_room_phase: "post",
                    earnings_timing_state: postTimingState,
                    earnings_source_state: postSourceState,
                    earnings_evidence_state: postEarningsState?.evidence_state ?? "calendar_only",
                    earnings_conflict: postEarningsState?.conflict.has_conflict ? "true" : "false",
                    reason_code: "war_room_post_refresh_queued",
                    reason_text: reasonText,
                    report_id: queuedJob?.reportId ?? "",
                    deep_link_target: route
                  }
                });
                attempted += pushResult.attempted;
                delivered += pushResult.delivered;
                failed += pushResult.failed;
                for (const invalidTarget of pushResult.invalidTargets) {
                  await runtime.store.invalidateUserDeviceByInstallation({
                    userId: invalidTarget.userId,
                    installationId: invalidTarget.installationId,
                    invalidatedAt: new Date().toISOString(),
                    reason: "fcm_invalid_registration"
                  });
                }
                const alert = await recordAlertLedgerItem(runtime, {
                  id: alertId,
                  userId: closed.userId,
                  notificationType: "earnings_war_room",
                  route,
                  title: notificationTitle("earnings_war_room", closed.ticker),
                  body: reasonText,
                  reasonCode: "war_room_post_refresh_queued",
                  reasonText,
                  deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
                  data: {
                    ticker: closed.ticker,
                    war_room_id: closed.warRoomId,
                    earnings_event_id: closed.earningsEventId,
                    event_date: closed.eventDate,
                    war_room_phase: "post",
                    earnings_timing_state: postTimingState,
                    earnings_source_state: postSourceState,
                    earnings_evidence_state: postEarningsState?.evidence_state ?? "calendar_only",
                    earnings_conflict: postEarningsState?.conflict.has_conflict ? "true" : "false",
                    report_id: queuedJob?.reportId ?? "",
                    deep_link_target: route
                  }
                });
                alertId = alert.id;
              }

              await createWarRoomTimelineEvent(runtime, {
                warRoomId: closed.warRoomId,
                phase: "post",
                eventType: "deep_dive_queued",
                reasonText,
                alertLedgerId: alertId,
                reportId: queuedJob?.reportId,
                sourceRefs: [
                  {
                    kind: "job",
                    ref_id: queuedJob?.id ?? triggerKey,
                    label: "Deep Dive refresh queued"
                  }
                ],
                metadata: {
                  trigger_key: triggerKey,
                  closed: true,
                  earnings_timing_state: postTimingState,
                  earnings_source_state: postSourceState,
                  earnings_evidence_state: postEarningsState?.evidence_state ?? "calendar_only",
                  earnings_conflict: postEarningsState?.conflict.has_conflict ?? false
                },
                createdAt: nowIso
              });
            }
          }

          await appendAudit(runtime, "earnings_war_room.dispatched", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOf,
            phase: phaseRaw,
            prepared,
            live_updated: liveUpdated,
            post_closed: postClosed,
            attempted,
            delivered,
            failed,
            fallback_user_count: fallbackUserIds.size
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOf,
            phase: phaseRaw,
            prepared,
            live_updated: liveUpdated,
            post_closed: postClosed,
            attempted,
            delivered,
            failed,
            fallback_user_ids: [...fallbackUserIds]
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/earnings-preview") {
          const body = await readJsonBody<{ as_of?: string; user_ids?: string[] }>(request);
          const today = normalizeDateInput(
            body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
          ) ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const nextBiz = nextBusinessDate(today);
          const freeRecipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
            notificationType: "earnings_preview"
            ,
            tier: "FREE"
          });
          const fallbackUserIds = Array.isArray(body.user_ids)
            ? body.user_ids
                .map((value) => (typeof value === "string" ? value.trim() : ""))
                .filter((value) => value.length > 0)
            : [];
          const fallbackRecipients =
            fallbackUserIds.length > 0
              ? await runtime.store.listUsersWithDeviceTokenByNotificationType({
                  notificationType: "earnings_preview",
                  userIds: fallbackUserIds
                })
              : [];
          const mergedRecipients = [...freeRecipients];
          const mergedRecipientKeys = new Set(
            freeRecipients.map((target) => `${target.userId}:${target.installationId}`)
          );
          for (const target of fallbackRecipients) {
            const key = `${target.userId}:${target.installationId}`;
            if (mergedRecipientKeys.has(key)) {
              continue;
            }
            mergedRecipientKeys.add(key);
            mergedRecipients.push(target);
          }
          const recipientsByUser = groupPushTargetsByUser(mergedRecipients);

          let attempted = 0;
          let delivered = 0;
          let failed = 0;
          const sentTickers: string[] = [];

          for (const [userId, userTargets] of recipientsByUser.entries()) {
            const watchlist = await runtime.store.listWatchlistTickersByUser(userId);
            if (watchlist.length === 0) {
              continue;
            }

            const events = await runtime.store.listUpcomingCalendarEventsByTickers({
              tickers: watchlist,
              fromDate: nextBiz,
              toDate: nextBiz,
              eventType: "earnings"
            });
            if (events.length === 0) {
              continue;
            }

            const earningsStateList = await getEarningsEventStateListForUser(runtime, {
              userId,
              asOf: today,
              tickers: watchlist,
              windowPastDays: 3,
              windowAheadDays: 3
            });
            const estimatedTickers = earningsStateList.states
              .filter((state) => state.event_date === nextBiz && state.timing_state === "estimated")
              .map((state) => state.ticker);
            const stateTickers = earningsStateList.states
              .filter((state) => state.event_date === nextBiz)
              .map((state) => state.ticker);
            const uniqueTickers = uniqueUppercaseTickers(
              estimatedTickers.length > 0
                ? estimatedTickers
                : stateTickers.length > 0
                  ? stateTickers
                  : events.map((event) => event.ticker.trim().toUpperCase())
            );
            const leadTicker = uniqueTickers[0];
            if (!leadTicker) {
              continue;
            }
            const leadState = earningsStateList.states.find(
              (state) => state.ticker === leadTicker && state.event_date === nextBiz
            );
            const timingState = leadState?.timing_state ?? "estimated";
            const sourceState = leadState?.source_state ?? "derived";
            const reasonText =
              estimatedTickers.length > 0
                ? `${uniqueTickers.join(", ")} has estimated earnings timing for next market session.`
                : `${uniqueTickers.join(", ")} is expected to report by next market session (${timingState}, ${sourceState.replace("_", " ")}).`;
            const alertId = createId();
            const route = notificationRoute("earnings_preview");
            const title = notificationTitle("earnings_preview", leadTicker);
            const body = `${reasonText} Tap to run a Deep Dive.`;

            const pushResult = await runtime.pushNotifier.sendNotification(
              userTargets,
              {
                notificationType: "earnings_preview",
                route,
                title,
                body,
                data: {
                  alert_id: alertId,
                  ticker: leadTicker,
                  tickers: uniqueTickers.join(","),
                  earnings_timing_state: timingState,
                  earnings_source_state: sourceState,
                  earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                  earnings_conflict: leadState?.conflict.has_conflict ? "true" : "false",
                  reason_code: "earnings_preview_due",
                  reason_text: reasonText,
                  deep_link_target: route
                }
              }
            );

            attempted += pushResult.attempted;
            delivered += pushResult.delivered;
            failed += pushResult.failed;
            for (const invalidTarget of pushResult.invalidTargets) {
              await runtime.store.invalidateUserDeviceByInstallation({
                userId: invalidTarget.userId,
                installationId: invalidTarget.installationId,
                invalidatedAt: new Date().toISOString(),
                reason: "fcm_invalid_registration"
                });
            }
            sentTickers.push(...uniqueTickers);
            await recordAlertLedgerItem(runtime, {
              id: alertId,
              userId,
              notificationType: "earnings_preview",
              route,
              title,
              body,
              reasonCode: "earnings_preview_due",
              reasonText,
              deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
              data: {
                ticker: leadTicker,
                tickers: uniqueTickers.join(","),
                earnings_timing_state: timingState,
                earnings_source_state: sourceState,
                earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
                earnings_conflict: leadState?.conflict.has_conflict ? "true" : "false",
                deep_link_target: route
              }
            });
          }

          if (failed > 0) {
            const message = "Earnings preview notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              attempted,
              delivered,
              failed
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              attempted,
              delivered,
              failed
            });
          }

          await appendAudit(runtime, "earnings_preview.dispatched", {
            request_id: meta.requestId,
            route: pathname,
            attempted,
            delivered,
            failed,
            ticker_count: sentTickers.length,
            fallback_user_count: fallbackUserIds.length
          });

          sendJson(response, 200, {
            status: "ok",
            attempted,
            delivered,
            failed,
            ticker_count: sentTickers.length,
            fallback_user_count: fallbackUserIds.length
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/cross-name/evaluate") {
          const body = await readJsonBody<CrossNamePropagationEvaluationRequest>(request);
          const asOf =
            normalizeDateInput(body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const signalSource = asCrossNamePropagationSignalSource(body.signal_source);
          const triggerKey =
            typeof body.trigger_key === "string" && body.trigger_key.trim().length > 0
              ? body.trigger_key.trim()
              : `${signalSource}:${asOf}`;
          const confidenceThreshold = normalizeConfidenceThreshold(body.confidence_threshold);
          const fixtures = (Array.isArray(body.fixtures) ? body.fixtures : [])
            .map((fixture) => asCrossNamePropagationFixture(fixture))
            .filter((fixture): fixture is CrossNamePropagationEventFixture => Boolean(fixture));

          const result = await dispatchCrossNamePropagation(runtime, {
            asOf,
            signalSource,
            triggerKey,
            confidenceThreshold,
            fixtures,
            requestId: meta.requestId,
            route: pathname
          });

          if (result.failed > 0) {
            const message = "Cross-name propagation notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              attempted: result.attempted,
              delivered: result.delivered,
              failed: result.failed,
              matched: result.matched
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              attempted: result.attempted,
              delivered: result.delivered,
              failed: result.failed,
              matched: result.matched
            });
          }

          await appendAudit(runtime, "cross_name.propagation_evaluated", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOf,
            signal_source: signalSource,
            trigger_key: triggerKey,
            confidence_threshold: confidenceThreshold,
            evaluated: result.evaluated,
            matched: result.matched,
            suppressed: result.suppressed,
            attempted: result.attempted,
            delivered: result.delivered,
            failed: result.failed
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOf,
            signal_source: signalSource,
            trigger_key: triggerKey,
            confidence_threshold: confidenceThreshold,
            evaluated: result.evaluated,
            matched: result.matched,
            suppressed: result.suppressed,
            attempted: result.attempted,
            delivered: result.delivered,
            failed: result.failed
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/conviction/coherence/evaluate") {
          const body = await readJsonBody<CoherenceEvaluationRequest>(request);
          const defaultPeriod = previousCalendarMonthPeriod(runtime.config.subscriptionTimezone);
          const periodStart = body.period_start ?? defaultPeriod.periodStart;
          const periodEnd = body.period_end ?? defaultPeriod.periodEnd;
          if (!isStrictIsoDate(periodStart) || !isStrictIsoDate(periodEnd)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "period_start and period_end must be YYYY-MM-DD dates."
            });
            return;
          }
          if (Date.parse(`${periodStart}T00:00:00.000Z`) > Date.parse(`${periodEnd}T23:59:59.999Z`)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "period_start must be on or before period_end."
            });
            return;
          }
          const userIds = Array.isArray(body.user_ids)
            ? body.user_ids
                .map((value) => (typeof value === "string" ? value.trim() : ""))
                .filter((value) => value.length > 0)
            : undefined;
          const result = await runConvictionCoherenceEvaluation(runtime, {
            periodStart,
            periodEnd,
            userIds
          });

          await appendAudit(runtime, "conviction.coherence_evaluated", {
            request_id: meta.requestId,
            route: pathname,
            period_start: periodStart,
            period_end: periodEnd,
            evaluated_users: result.evaluatedUsers,
            generated: result.generated,
            degraded: result.degraded,
            failed: result.failed
          });

          sendJson(response, 200, {
            status: "ok",
            period_start: periodStart,
            period_end: periodEnd,
            evaluated_users: result.evaluatedUsers,
            generated: result.generated,
            degraded: result.degraded,
            failed: result.failed
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/kill-switch/evaluate") {
          const body = await readJsonBody<KillSwitchEvaluationRequest>(request);
          const asOf =
            normalizeDateInput(body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const signalSource = asKillSwitchSignalSource(body.signal_source);
          const triggerKey =
            typeof body.trigger_key === "string" && body.trigger_key.trim().length > 0
              ? body.trigger_key.trim()
              : `${signalSource}:${asOf}`;
          const asOfEndIso = new Date(`${asOf}T23:59:59.999Z`).toISOString();

          const fixtures = (Array.isArray(body.fixtures) ? body.fixtures : [])
            .map((fixture) => asKillSwitchFixture(fixture))
            .filter((fixture): fixture is KillSwitchEvaluationFixture => Boolean(fixture));
          const fixtureMap = new Map<string, KillSwitchEvaluationFixture>();
          for (const fixture of fixtures) {
            fixtureMap.set(`${fixture.ticker}:${fixture.signal_type}`, fixture);
          }

          const recipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
            notificationType: "kill_switch"
          });
          const recipientsByUser = groupPushTargetsByUser(recipients);
          const recipientIds = [...new Set(recipients.map((entry) => entry.userId))];
          const rules = await runtime.store.listActiveKillSwitchRules({
            asOfIso: asOfEndIso,
            userIds: recipientIds
          });

          const tickerSet = new Set<string>();
          for (const rule of rules) {
            if (rule.signalType === "price_move_pct") {
              tickerSet.add(rule.ticker);
            }
          }
          let prices = new Map<string, number>();
          if (tickerSet.size > 0) {
            try {
              prices = await fetchLatestClosePrices(
                runtime.config.sentimentYahooBaseUrl,
                [...tickerSet],
                6
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : "price lookup failed";
              logWarn("Kill-switch price lookup degraded", {
                request_id: meta.requestId,
                route: pathname,
                error_message: message,
                ticker_count: tickerSet.size
              });
            }
          }

          const snapshotMap = new Map<string, ThesisMonitorSnapshotRecord>();
          for (const userId of recipientIds) {
            const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(userId);
            for (const snapshot of snapshots) {
              snapshotMap.set(`${snapshot.userId}:${snapshot.ticker}`, snapshot);
            }
          }

          let evaluated = 0;
          let matched = 0;
          let skipped = 0;
          let attempted = 0;
          let delivered = 0;
          let failed = 0;
          for (const rule of rules) {
            const existing = await runtime.store.getKillSwitchEvaluation({
              ruleId: rule.id,
              signalSource,
              triggerKey
            });
            if (existing) {
              skipped += 1;
              continue;
            }

            const fixture = fixtureMap.get(`${rule.ticker}:${rule.signalType}`);
            const evaluationId = createId();
            let outcome: "matched" | "not_matched" | "skipped" = "not_matched";
            let reasonCode = "kill_switch_no_match";
            let reasonText = "No material signal crossed this kill-switch condition.";
            let observedValue: number | undefined;

            if (rule.signalType === "price_move_pct") {
              const result = evaluatePriceMoveRule(rule, prices.get(rule.ticker));
              outcome = result.outcome;
              reasonCode = result.reasonCode;
              reasonText = result.reasonText;
              observedValue = result.observedValue;
            } else if (rule.signalType === "thesis_state") {
              const snapshot = snapshotMap.get(`${rule.userId}:${rule.ticker}`);
              if (!snapshot) {
                outcome = "skipped";
                reasonCode = "snapshot_unavailable";
                reasonText = "Thesis monitor snapshot is unavailable for this rule.";
              } else if (snapshot.state === "weakened" || snapshot.state === "unresolved") {
                outcome = "matched";
                reasonCode = "kill_switch_thesis_state";
                reasonText = `Monitor state is ${snapshot.state}: ${snapshot.reason}`;
                observedValue = snapshot.score;
              } else {
                outcome = "not_matched";
                reasonCode = "kill_switch_no_match";
                reasonText = `Monitor state is ${snapshot.state}; threshold state not reached.`;
                observedValue = snapshot.score;
              }
            } else if (fixture) {
              outcome = "matched";
              reasonCode = "kill_switch_fixture_match";
              reasonText = fixture.reason_text ??
                `Matched fixture signal for ${fixture.ticker} (${fixture.signal_type}).`;
              observedValue = fixture.value;
            }

            let alertId: string | undefined;
            if (outcome === "matched") {
              matched += 1;
              const userTargets = recipientsByUser.get(rule.userId);
              if (userTargets && userTargets.length > 0) {
                alertId = createId();
                const route = notificationRoute("kill_switch");
                const title = notificationTitle("kill_switch", rule.ticker);
                const pushBody = `Kill-switch triggered for ${rule.ticker}: ${rule.conditionText}`;
                const pushResult = await runtime.pushNotifier.sendNotification(userTargets, {
                  notificationType: "kill_switch",
                  route,
                  title,
                  body: pushBody,
                  data: {
                    alert_id: alertId,
                    ticker: rule.ticker,
                    report_id: rule.reportId ?? "",
                    rule_id: rule.id,
                    signal_type: rule.signalType,
                    trigger_key: triggerKey,
                    reason_code: reasonCode,
                    reason_text: reasonText,
                    deep_link_target: route
                  }
                });
                attempted += pushResult.attempted;
                delivered += pushResult.delivered;
                failed += pushResult.failed;
                for (const invalidTarget of pushResult.invalidTargets) {
                  await runtime.store.invalidateUserDeviceByInstallation({
                    userId: invalidTarget.userId,
                    installationId: invalidTarget.installationId,
                    invalidatedAt: new Date().toISOString(),
                    reason: "fcm_invalid_registration"
                  });
                }
                await recordAlertLedgerItem(runtime, {
                  id: alertId,
                  userId: rule.userId,
                  notificationType: "kill_switch",
                  route,
                  title,
                  body: pushBody,
                  reasonCode,
                  reasonText,
                  deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
                  data: {
                    ticker: rule.ticker,
                    report_id: rule.reportId ?? "",
                    rule_id: rule.id,
                    evaluation_id: evaluationId,
                    signal_type: rule.signalType,
                    trigger_key: triggerKey,
                    deep_link_target: route
                  }
                });
              }
            } else if (outcome === "skipped") {
              skipped += 1;
            }

            await runtime.store.createKillSwitchEvaluation({
              id: evaluationId,
              ruleId: rule.id,
              userId: rule.userId,
              ticker: rule.ticker,
              signalSource,
              triggerKey,
              outcome,
              reasonCode,
              reasonText,
              observedValue,
              alertId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            evaluated += 1;
            logInfo("Kill-switch rule evaluated", {
              request_id: meta.requestId,
              route: pathname,
              rule_id: rule.id,
              ticker: rule.ticker,
              outcome,
              signal_source: signalSource
            });
          }

          if (failed > 0) {
            const message = "Kill-switch notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              attempted,
              delivered,
              failed,
              matched
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              attempted,
              delivered,
              failed,
              matched
            });
          }

          await appendAudit(runtime, "kill_switch.rules_evaluated", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOf,
            signal_source: signalSource,
            trigger_key: triggerKey,
            evaluated,
            matched,
            skipped,
            attempted,
            delivered,
            failed
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOf,
            signal_source: signalSource,
            trigger_key: triggerKey,
            evaluated,
            matched,
            skipped,
            attempted,
            delivered,
            failed
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/freshness-decay") {
          const body = await readJsonBody<{ as_of?: string; user_ids?: string[] }>(request);
          const asOf =
            normalizeDateInput(body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const userIds = Array.isArray(body.user_ids)
            ? body.user_ids
                .map((value) => (typeof value === "string" ? value.trim() : ""))
                .filter((value) => value.length > 0)
            : undefined;

          const result = await dispatchFreshnessDecayNotifications(runtime, {
            asOfDate: asOf,
            userIds
          });

          if (result.failed > 0) {
            const message = "Freshness-decay notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              as_of: asOf,
              attempted: result.attempted,
              delivered: result.delivered,
              failed: result.failed,
              fired: result.fired
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              as_of: asOf,
              attempted: result.attempted,
              delivered: result.delivered,
              failed: result.failed,
              fired: result.fired
            });
          }

          await appendAudit(runtime, "freshness_decay.dispatched", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOf,
            evaluated: result.evaluated,
            fired: result.fired,
            attempted: result.attempted,
            delivered: result.delivered,
            failed: result.failed,
            targeted_users: userIds?.length ?? null
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOf,
            evaluated: result.evaluated,
            fired: result.fired,
            attempted: result.attempted,
            delivered: result.delivered,
            failed: result.failed
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/contrarian/evaluate") {
          const body = await readJsonBody<{ as_of?: string }>(request);
          const asOf =
            normalizeDateInput(body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const asOfEndIso = new Date(`${asOf}T23:59:59.999Z`).toISOString();
          const expiredCount = await runtime.store.deactivateExpiredContrarianAlertAnchors(
            asOfEndIso
          );
          const recipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
            notificationType: "contrarian_alert"
          });
          const recipientsByUser = groupPushTargetsByUser(recipients);
          const recipientIds = new Set(recipients.map((entry) => entry.userId));
          const anchors = (await runtime.store.listActiveContrarianAlertAnchors(
            asOfEndIso
          )).filter((anchor) => recipientIds.has(anchor.userId));
          const prices = await fetchLatestClosePrices(
            runtime.config.sentimentYahooBaseUrl,
            anchors.map((anchor) => anchor.ticker),
            6
          );

          let attempted = 0;
          let delivered = 0;
          let failed = 0;
          let fired = 0;
          for (const anchor of anchors) {
            if (anchor.signalValue === "neutral") {
              await runtime.store.deactivateContrarianAlertAnchor(
                anchor.id,
                new Date().toISOString()
              );
              continue;
            }
            const currentPrice = prices.get(anchor.ticker);
            if (!currentPrice) {
              continue;
            }

            const movePct = ((currentPrice - anchor.anchorPrice) / anchor.anchorPrice) * 100;
            const shouldFire =
              (anchor.signalValue === "positive" && movePct <= -contrarianMoveThresholdPct) ||
              (anchor.signalValue === "negative" && movePct >= contrarianMoveThresholdPct);
            if (!shouldFire) {
              continue;
            }

            const userTargets = recipientsByUser.get(anchor.userId);
            if (!userTargets || userTargets.length === 0) {
              continue;
            }
            const alertId = createId();
            const route = notificationRoute("contrarian_alert");
            const title = notificationTitle("contrarian_alert", anchor.ticker);
            const reasonText = `Price moved ${Math.abs(movePct).toFixed(1)}% against your ${anchor.signalValue} thesis.`;
            const body =
              `Your thesis on ${anchor.ticker} (${anchor.signalValue}) is diverging by ${Math.abs(movePct).toFixed(1)}%. Tap to review the Deep Dive.`;

            const pushResult = await runtime.pushNotifier.sendNotification(
              userTargets,
              {
                notificationType: "contrarian_alert",
                route,
                title,
                body,
                data: {
                  alert_id: alertId,
                  ticker: anchor.ticker,
                  report_id: anchor.reportId ?? "",
                  signal_value: anchor.signalValue,
                  move_pct: movePct.toFixed(2),
                  reason_code: "thesis_shift_detected",
                  reason_text: reasonText,
                  deep_link_target: route
                }
              }
            );

            attempted += pushResult.attempted;
            delivered += pushResult.delivered;
            failed += pushResult.failed;
            fired += 1;
            for (const invalidTarget of pushResult.invalidTargets) {
              await runtime.store.invalidateUserDeviceByInstallation({
                userId: invalidTarget.userId,
                installationId: invalidTarget.installationId,
                invalidatedAt: new Date().toISOString(),
                reason: "fcm_invalid_registration"
                });
            }
            await runtime.store.deactivateContrarianAlertAnchor(
              anchor.id,
              new Date().toISOString()
            );
            await recordAlertLedgerItem(runtime, {
              id: alertId,
              userId: anchor.userId,
              notificationType: "contrarian_alert",
              route,
              title,
              body,
              reasonCode: "thesis_shift_detected",
              reasonText,
              deliveryState: pushResult.failed > 0 ? "partial_failure" : "sent",
              data: {
                ticker: anchor.ticker,
                report_id: anchor.reportId ?? "",
                deep_link_target: route
              }
            });
          }

          if (failed > 0) {
            const message = "Contrarian notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              attempted,
              delivered,
              failed,
              fired
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              attempted,
              delivered,
              failed,
              fired
            });
          }

          await appendAudit(runtime, "contrarian.alerts_evaluated", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOf,
            expired_count: expiredCount,
            fired,
            attempted,
            delivered,
            failed
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOf,
            expired_count: expiredCount,
            fired,
            attempted,
            delivered,
            failed
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/notifications/weekly-digest") {
          const body = await readJsonBody<{ digest_date?: string }>(request);
          const digestDate =
            normalizeDateInput(body.digest_date ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const isScheduleSunday = isSundayIsoDate(digestDate);
          if (!isScheduleSunday) {
            sendJson(response, 200, {
              status: "skipped",
              digest_date: digestDate,
              reason: "not_weekly_digest_day"
            });
            return;
          }
          const pushRecipients = await runtime.store.listUsersWithDeviceTokenByNotificationType({
            notificationType: "weekly_digest",
            tier: "PRO"
          });
          const emailRecipients = await runtime.store.listUsersWithEmailByNotificationType({
            notificationType: "weekly_digest",
            tier: "PRO"
          });
          const pushRecipientsByUser = groupPushTargetsByUser(pushRecipients);
          const emailRecipientsByUser = new Map(
            emailRecipients.map((recipient) => [recipient.userId, recipient])
          );
          const recipientUserIds = new Set<string>([
            ...pushRecipientsByUser.keys(),
            ...emailRecipientsByUser.keys()
          ]);
          const latestLegacySentiment = await runtime.store.getLatestFearGreedSnapshot();
          const latestMacroStress = latestLegacySentiment
            ? legacySnapshotToMacroStress(latestLegacySentiment)
            : undefined;

          let attempted = 0;
          let delivered = 0;
          let failed = 0;
          let emailAttempted = 0;
          let emailDelivered = 0;
          let emailFailed = 0;

          for (const userId of recipientUserIds) {
            const userTargets = pushRecipientsByUser.get(userId) ?? [];
            const emailTarget = emailRecipientsByUser.get(userId);
            const watchlist = await runtime.store.listWatchlistTickersByUser(userId);
            const upcomingEvents = watchlist.length > 0
              ? await runtime.store.listUpcomingCalendarEventsByTickers({
                  tickers: watchlist,
                  fromDate: digestDate,
                  toDate: addDaysToIsoDate(digestDate, weeklyDigestLookaheadDays),
                  eventType: "earnings"
                })
              : [];
            const watchlistCount = watchlist.length;
            const upcomingCount = upcomingEvents.length;
            const digestParts = [
              latestMacroStress
                ? `Macro Stress: ${latestMacroStress.state.replaceAll("_", " ")}. ${latestMacroStress.summary}`
                : "Macro Stress data is not ready yet.",
              watchlistCount > 0
                ? `${watchlistCount} watchlist names matter this week.`
                : "Your watchlist is empty.",
              upcomingCount > 0
                ? `${upcomingCount} watchlist names report soon.`
                : "No watchlist earnings are due soon."
            ];
            const reasonText = watchlistCount > 0
              ? `${watchlistCount} followed names and ${upcomingCount} upcoming earnings were summarized.`
              : "Your weekly market summary was prepared.";
            const alertId = createId();
            const route = notificationRoute("weekly_digest");
            const title = notificationTitle("weekly_digest");
            const digestBody = digestParts.join(" ");
            const digestEmailBody = digestParts.join("\n");

            let userPushAttempted = 0;
            let userPushDelivered = 0;
            let userPushFailed = 0;
            if (userTargets.length > 0) {
              const pushResult = await runtime.pushNotifier.sendNotification(
                userTargets,
                {
                  notificationType: "weekly_digest",
                  route,
                  title,
                  body: digestBody,
                  data: {
                    alert_id: alertId,
                    digest_date: digestDate,
                    macro_stress_state: latestMacroStress?.state ?? "",
                    macro_stress_summary: latestMacroStress?.summary ?? "",
                    fear_greed_score: latestLegacySentiment
                      ? String(latestLegacySentiment.score)
                      : "",
                    fear_greed_label: latestLegacySentiment?.label ?? "",
                    watchlist_count: String(watchlistCount),
                    upcoming_earnings_count: String(upcomingCount),
                    reason_code: "weekly_summary_ready",
                    reason_text: reasonText,
                    deep_link_target: route
                  }
                }
              );

              userPushAttempted = pushResult.attempted;
              userPushDelivered = pushResult.delivered;
              userPushFailed = pushResult.failed;
              attempted += pushResult.attempted;
              delivered += pushResult.delivered;
              failed += pushResult.failed;
              for (const invalidTarget of pushResult.invalidTargets) {
                await runtime.store.invalidateUserDeviceByInstallation({
                  userId: invalidTarget.userId,
                  installationId: invalidTarget.installationId,
                  invalidatedAt: new Date().toISOString(),
                  reason: "fcm_invalid_registration"
                });
              }
            }

            let userEmailAttempted = 0;
            let userEmailDelivered = 0;
            let userEmailFailed = 0;
            if (emailTarget) {
              const emailResult = await runtime.emailNotifier.sendNotification(
                [emailTarget],
                {
                  subject: `Thesis Weekly Digest - ${digestDate}`,
                  text: digestEmailBody
                }
              );
              userEmailAttempted = emailResult.attempted;
              userEmailDelivered = emailResult.delivered;
              userEmailFailed = emailResult.failed;
              emailAttempted += emailResult.attempted;
              emailDelivered += emailResult.delivered;
              emailFailed += emailResult.failed;
            }

            const attemptedChannels = [
              ...(userPushAttempted > 0 ? ["push"] : []),
              ...(userEmailAttempted > 0 ? ["email"] : [])
            ];
            const userDeliveryState =
              userPushFailed + userEmailFailed > 0 ? "partial_failure" : "sent";

            await recordAlertLedgerItem(runtime, {
              id: alertId,
              userId,
              notificationType: "weekly_digest",
              route,
              title,
              body: digestBody,
              reasonCode: "weekly_summary_ready",
              reasonText,
              deliveryState: userDeliveryState,
              data: {
                digest_date: digestDate,
                ...(watchlist[0] ? { ticker: watchlist[0] } : {}),
                tickers: watchlist.join(","),
                channels: attemptedChannels.join(","),
                push_attempted: String(userPushAttempted),
                push_delivered: String(userPushDelivered),
                email_attempted: String(userEmailAttempted),
                email_delivered: String(userEmailDelivered),
                deep_link_target: route
              }
            });
          }

          const totalAttempted = attempted + emailAttempted;
          const totalDelivered = delivered + emailDelivered;
          const totalFailed = failed + emailFailed;
          if (totalFailed > 0) {
            const message = "Weekly digest notification delivery partially failed";
            logError(message, {
              request_id: meta.requestId,
              route: pathname,
              digest_date: digestDate,
              attempted,
              delivered,
              failed,
              email_attempted: emailAttempted,
              email_delivered: emailDelivered,
              email_failed: emailFailed,
              total_attempted: totalAttempted,
              total_delivered: totalDelivered,
              total_failed: totalFailed
            });
            captureException(new Error(message), {
              service: serviceName,
              route: pathname,
              digest_date: digestDate,
              attempted,
              delivered,
              failed,
              email_attempted: emailAttempted,
              email_delivered: emailDelivered,
              email_failed: emailFailed,
              total_attempted: totalAttempted,
              total_delivered: totalDelivered,
              total_failed: totalFailed
            });
          }

          await appendAudit(runtime, "weekly_digest.dispatched", {
            request_id: meta.requestId,
            route: pathname,
            digest_date: digestDate,
            sunday_schedule: isScheduleSunday,
            attempted,
            delivered,
            failed,
            email_attempted: emailAttempted,
            email_delivered: emailDelivered,
            email_failed: emailFailed,
            total_attempted: totalAttempted,
            total_delivered: totalDelivered,
            total_failed: totalFailed
          });

          sendJson(response, 200, {
            status: "ok",
            digest_date: digestDate,
            attempted,
            delivered,
            failed,
            email_attempted: emailAttempted,
            email_delivered: emailDelivered,
            email_failed: emailFailed,
            total_attempted: totalAttempted,
            total_delivered: totalDelivered,
            total_failed: totalFailed
          });
          return;
        }

        if (
          await handleInternalResearchStateRoutes(
            {
              method,
              pathname,
              request,
              response,
              runtime,
              meta
            },
            {
              appendAudit,
              dateInTimeZone,
              normalizeDateInput,
              readJsonBody,
              sendJson
            }
          )
        ) {
          return;
        }

        if (method === "POST" && pathname === "/internal/monitor/recompute") {
          const body = await readJsonBody<{ as_of?: string; user_ids?: string[] }>(request);
          const asOfDate =
            normalizeDateInput(
              body.as_of ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
            ) ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
          const asOfIso = new Date(`${asOfDate}T12:00:00.000Z`).toISOString();
          const userIds = Array.isArray(body.user_ids)
            ? body.user_ids
                .map((value) => (typeof value === "string" ? value.trim() : ""))
                .filter((value) => value.length > 0)
            : undefined;

          const result = await recomputeThesisMonitorSnapshots(runtime, {
            asOfIso,
            userIds
          });

          await appendAudit(runtime, "monitor.recomputed", {
            request_id: meta.requestId,
            route: pathname,
            as_of: asOfDate,
            users: result.users,
            names: result.names,
            unresolved: result.unresolved,
            updated: result.updated
          });

          sendJson(response, 200, {
            status: "ok",
            as_of: asOfDate,
            ...result
          });
          return;
        }

        if (method === "GET" && pathname === "/internal/feedback/queue") {
          const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 50, 1, 500);
          if (limit === undefined) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "limit must be an integer between 1 and 500."
            });
            return;
          }

          const feedbackTypeRaw = url.searchParams.get("feedback_type")?.trim() ?? "";
          if (
            feedbackTypeRaw.length > 0 &&
            feedbackTypeRaw !== "report" &&
            feedbackTypeRaw !== "subscription"
          ) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "feedback_type must be report or subscription when provided."
            });
            return;
          }

          const triageStatusRaw = url.searchParams.get("triage_status")?.trim() ?? "";
          if (triageStatusRaw.length > 0 && !isFeedbackTriageStatus(triageStatusRaw)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message:
                "triage_status must be one of: new, reviewed, routed, resolved, dismissed."
            });
            return;
          }

          const tierRaw = url.searchParams.get("user_tier")?.trim().toUpperCase() ?? "";
          if (tierRaw.length > 0 && tierRaw !== "FREE" && tierRaw !== "PRO") {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "user_tier must be FREE or PRO when provided."
            });
            return;
          }

          const sourceSurface = url.searchParams.get("source_surface")?.trim();
          const rows = await runtime.store.listUserFeedbackQueue({
            limit,
            feedbackType: feedbackTypeRaw.length > 0
              ? (feedbackTypeRaw as "report" | "subscription")
              : undefined,
            triageStatus: triageStatusRaw.length > 0
              ? (triageStatusRaw as "new" | "reviewed" | "routed" | "resolved" | "dismissed")
              : undefined,
            userTier: tierRaw.length > 0 ? (tierRaw as SubscriptionTier) : undefined,
            sourceSurface: sourceSurface && sourceSurface.length > 0 ? sourceSurface : undefined
          });

          sendJson(response, 200, {
            data: rows.map((row) => toFeedbackQueueView(row))
          });
          return;
        }

        const parts = pathname.split("/").filter(Boolean);
        if (parts.length === 4 && parts[0] === "internal" && parts[1] === "jobs") {
          const jobId = parts[2];
          const action = parts[3];
          if (!jobId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          if (method === "POST" && action === "claim") {
            const running = await runtime.store.markJobRunning(
              jobId,
              new Date().toISOString()
            );
            if (!running) {
              sendJson(response, 409, {
                error: "job_not_claimable",
                error_message: "Job is not queued or does not exist."
              });
              return;
            }

            const analysisRequest: AnalysisRequest = {
              request_id: createId(),
              type: running.type,
              ticker: running.ticker,
              user_id: running.userId,
              job_id: running.id,
              requested_at: new Date().toISOString()
            };
            await appendAudit(runtime, "job.running", {
              request_id: meta.requestId,
              route: pathname,
              job_id: running.id,
              status: "running"
            }, running.userId);

            sendJson(response, 200, {
              job: buildJobStatusResponse(running),
              analysis_request: analysisRequest
            });
            return;
          }

          if (method === "POST" && action === "complete") {
            const body = await readJsonBody<{ report?: AnalysisReport }>(request);
            if (!body.report) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "A valid report payload with matching job_id is required."
              });
              return;
            }
            const validationErrors: string[] = [];
            let report: AnalysisReport;
            try {
              report = assertIncomingAnalysisReport(body.report);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown report validation error";
              validationErrors.push(...message.split("; ").filter((entry) => entry.length > 0));
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "Report failed schema validation before storage.",
                validation_errors: validationErrors
              });
              return;
            }

            report = await enrichAnalysisReportIssuer(runtime, report);

            if (report.job_id !== jobId) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "A valid report payload with matching job_id is required."
              });
              return;
            }

            let artifactKey: string | undefined;
            try {
              const reportFingerprint =
                report.type === "deep_dive" && report.ticker
                  ? deepDiveFingerprint({
                    ticker: report.ticker,
                    schemaVersion: report.schema_version,
                    latestPeriod: report.historical_context?.latest_period
                  })
                  : undefined;
              // Jobs without a user are scheduled pre-computes: they stay reusable until the next filing.
              const freshnessHours = (await runtime.store.getJob(jobId))?.userId
                ? runtime.config.deepDiveReuseFreshnessHours
                : runtime.config.deepDivePrecomputeFreshnessHours;
              const freshnessExpiresAt = reportFingerprint
                ? addHours(new Date().toISOString(), freshnessHours)
                : undefined;

              artifactKey = await runtime.artifactStore.writeReport(report);
              await runtime.store.createReport({
                id: report.report_id,
                jobId: report.job_id,
                type: report.type,
                ticker: report.ticker,
                schemaVersion: report.schema_version,
                artifactKey,
                fingerprint: reportFingerprint,
                freshnessExpiresAt,
                createdAt: report.generated_at,
                isCurrent: true
              });
              const completed = await runtime.store.markJobComplete(
                jobId,
                new Date().toISOString(),
                report.report_id
              );
              if (!completed) {
                await cleanupStoredReport(runtime, report.report_id, artifactKey);
                await runtime.store.markJobFailed(
                  jobId,
                  new Date().toISOString(),
                  "Job was not found for completion."
                );
                sendJson(response, 404, {
                  error: "job_not_found",
                  error_message: "Job was not found for completion."
                });
                return;
              }

              await appendAudit(runtime, "job.complete", {
                request_id: meta.requestId,
                route: pathname,
                job_id: completed.id,
                report_id: report.report_id,
                status: "complete"
              }, completed.userId);

              await createContrarianAnchorFromReport(runtime, {
                report,
                userId: completed.userId,
                requestId: meta.requestId,
                route: pathname
              });
              await createKillSwitchRulesFromReport(runtime, {
                report,
                userId: completed.userId,
                requestId: meta.requestId,
                route: pathname
              });
              await createNameRelationshipsFromReport(runtime, {
                report,
                userId: completed.userId,
                requestId: meta.requestId,
                route: pathname
              });

              if (report.type === "deep_dive" && completed.userId && report.ticker) {
                const normalizedTicker = report.ticker.trim().toUpperCase();
                const watchlist = await runtime.store.listWatchlistTickersByUser(completed.userId);
                if (watchlist.includes(normalizedTicker)) {
                  const snapshot = await upsertSnapshotFromReport(runtime, {
                    userId: completed.userId,
                    ticker: normalizedTicker,
                    report,
                    asOfIso: new Date().toISOString(),
                    materialEventsCount: 0,
                    unreviewedEventsCount: 0,
                    updatedAt: new Date().toISOString()
                  });
                  await appendAudit(runtime, "monitor.snapshot_upserted", {
                    request_id: meta.requestId,
                    route: pathname,
                    ticker: normalizedTicker,
                    state: snapshot.state,
                    score: snapshot.score
                  }, completed.userId);
                }
              }
              await recordConvictionJournalEntryFromReport(runtime, {
                report,
                userId: completed.userId
              });

              sendJson(response, 200, {
                status: "ok",
                report_id: report.report_id
              });
              return;
            } catch (error) {
              if (artifactKey) {
                await cleanupStoredReport(runtime, report.report_id, artifactKey);
              }

              const message = error instanceof Error ? error.message : "Report completion failed";
              const failed = await runtime.store.markJobFailed(
                jobId,
                new Date().toISOString(),
                message
              );
              captureException(new Error(message), {
                service: serviceName,
                job_id: jobId
              });
              sendJson(response, failed ? 500 : 404, {
                error: failed ? "internal_error" : "job_not_found",
                error_message: failed
                  ? "Product API failed to finalize the report."
                  : "Job was not found for completion."
              });
              return;
            }
          }

          if (method === "POST" && action === "fail") {
            const body = await readJsonBody<{ error_message?: string }>(request);
            const errorMessage = body.error_message?.trim() || "Dexter worker reported a failure.";
            const failed = await runtime.store.markJobFailed(
              jobId,
              new Date().toISOString(),
              errorMessage
            );
            if (!failed) {
              sendJson(response, 404, {
                error: "job_not_found",
                error_message: "Job was not found for failure update."
              });
              return;
            }

            await appendAudit(runtime, "job.failed", {
              request_id: meta.requestId,
              route: pathname,
              job_id: failed.id,
              status: "failed",
              error_message: errorMessage
            }, failed.userId);

            captureException(new Error(errorMessage), {
              service: serviceName,
              job_id: failed.id
            });

            sendJson(response, 200, {
              status: "ok"
            });
            return;
          }
        }

        sendJson(response, 404, { status: "not_found" });
        return;
      }

      if (
        await handleRevenueCatPublicRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta
          },
          {
            appendAudit,
            buildUserProfile,
            logWarn,
            readJsonBody,
            sendJson
          }
        )
      ) {
        return;
      }

      if (
        await handlePublicRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta,
            url
          },
          {
            appendAudit,
            authenticateAccessToken,
            hasInternalToken,
            sendJson
          }
        )
      ) {
        return;
      }

      const auth = await authenticateAccessToken(runtime, request);
      if (!auth) {
        sendJson(response, 401, {
          error: "unauthorized",
          error_message: "Authentication required."
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/conviction/timeline") {
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        if (subscription.tier !== "PRO") {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "conviction_intelligence",
              "Conviction timeline is available on the Pro tier."
            )
          );
          return;
        }
        const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 50, 1, 100);
        if (limit === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "limit must be an integer between 1 and 100."
          });
          return;
        }
        const tickerRaw = url.searchParams.get("ticker");
        const ticker = tickerRaw ? normalizeTickerSymbol(tickerRaw) : undefined;
        if (tickerRaw && !ticker) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }
        const rows = await runtime.store.listConvictionJournalEntriesByUser({
          userId: auth.userId,
          ticker,
          limit
        });
        await appendAudit(runtime, "conviction.timeline_listed", {
          request_id: meta.requestId,
          route: pathname,
          count: rows.length,
          ticker: ticker ?? null,
          limit
        }, auth.userId);
        sendJson(response, 200, {
          data: rows.map((row) => toConvictionJournalEntryView(row))
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/conviction/insights") {
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        if (subscription.tier !== "PRO") {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "conviction_intelligence",
              "Conviction insights are available on the Pro tier."
            )
          );
          return;
        }
        const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 10, 1, 50);
        if (limit === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "limit must be an integer between 1 and 50."
          });
          return;
        }
        const rows = await runtime.store.listConvictionInsightCardsByUser({
          userId: auth.userId,
          limit
        });
        await appendAudit(runtime, "conviction.insights_listed", {
          request_id: meta.requestId,
          route: pathname,
          count: rows.length,
          limit
        }, auth.userId);
        sendJson(response, 200, {
          data: rows.map((row) => toConvictionInsightCardView(row))
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/scenarios/templates") {
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        if (subscription.tier !== "PRO") {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "scenario_stress",
              "Scenario stress cards are available on the Pro tier."
            )
          );
          return;
        }
        const templates = await runtime.store.listScenarioStressTemplates({
          includeInactive: false,
          limit: 20
        });
        await appendAudit(runtime, "scenario_stress.templates_listed", {
          request_id: meta.requestId,
          route: pathname,
          count: templates.length
        }, auth.userId);
        sendJson(response, 200, {
          data: templates.map((template) => toScenarioStressTemplateView(template))
        });
        return;
      }

      if (method === "POST" && pathname === "/v1/scenarios/runs") {
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        if (subscription.tier !== "PRO") {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "scenario_stress",
              "Scenario stress cards are available on the Pro tier."
            )
          );
          return;
        }

        const body = await readJsonBody<ScenarioStressRunRequest>(request);
        const scenarioId = body.scenario_id;
        if (!scenarioId || !scenarioStressTemplateIds.includes(scenarioId)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message:
              `scenario_id must be one of: ${scenarioStressTemplateIds.join(", ")}.`
          });
          return;
        }

        const template = await runtime.store.getScenarioStressTemplate(scenarioId);
        if (!template || !template.isActive) {
          sendJson(response, 404, {
            error: "scenario_not_found",
            error_message: "Scenario template was not found."
          });
          return;
        }

        let asOf = dateInTimeZone(new Date(), "America/New_York");
        if (body.as_of !== undefined) {
          if (!isStrictIsoDate(body.as_of)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "as_of must be a valid ISO date (YYYY-MM-DD)."
            });
            return;
          }
          asOf = body.as_of;
        }

        const evaluation = await runScenarioStressEvaluation(runtime, {
          userId: auth.userId,
          scenarioId,
          asOf,
          nowIso: new Date().toISOString()
        });

        await appendAudit(runtime, "scenario_stress.run_created", {
          request_id: meta.requestId,
          route: pathname,
          scenario_id: scenarioId,
          scenario_run_id: evaluation.run.id,
          impacted_names: evaluation.run.impactedNames,
          critical_names: evaluation.run.criticalNames
        }, auth.userId);

        sendJson(response, 200, buildScenarioStressRunResponse({
          run: evaluation.run,
          impacts: evaluation.impacts,
          suggestions: evaluation.suggestions
        }));
        return;
      }

      if (method === "GET" && pathname.startsWith("/v1/scenarios/runs/")) {
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        if (subscription.tier !== "PRO") {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "scenario_stress",
              "Scenario stress cards are available on the Pro tier."
            )
          );
          return;
        }

        const scenarioParts = pathname.split("/").filter(Boolean);
        if (
          scenarioParts.length !== 4 ||
          scenarioParts[0] !== "v1" ||
          scenarioParts[1] !== "scenarios" ||
          scenarioParts[2] !== "runs"
        ) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }
        const scenarioRunId = scenarioParts[3];
        if (!scenarioRunId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const run = await runtime.store.getScenarioStressRun({
          id: scenarioRunId,
          userId: auth.userId
        });
        if (!run) {
          sendJson(response, 404, {
            error: "scenario_run_not_found",
            error_message: "Scenario run not found."
          });
          return;
        }
        const impacts = await runtime.store.listScenarioStressImpactsByRun({
          scenarioRunId,
          userId: auth.userId
        });
        const suggestions = await runtime.store.listScenarioStressRuleSuggestionsByRun({
          scenarioRunId,
          userId: auth.userId
        });

        await appendAudit(runtime, "scenario_stress.run_retrieved", {
          request_id: meta.requestId,
          route: pathname,
          scenario_run_id: scenarioRunId,
          scenario_id: run.scenarioId,
          impact_count: impacts.length,
          suggestion_count: suggestions.length
        }, auth.userId);

        sendJson(response, 200, buildScenarioStressRunResponse({
          run,
          impacts,
          suggestions
        }));
        return;
      }

      if (method === "GET" && pathname === "/v1/user/alerts") {
        const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 50, 1, 100);
        if (limit === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "limit must be an integer between 1 and 100."
          });
          return;
        }

        const categoryRaw = url.searchParams.get("category")?.trim();
        if (categoryRaw && !isAlertLedgerCategory(categoryRaw)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "category must be one of: thesis_drift, earnings, macro, system."
          });
          return;
        }

        const filter: AlertLedgerFilter = {
          limit,
          category: categoryRaw && categoryRaw.length > 0
            ? (categoryRaw as AlertLedgerCategory)
            : undefined
        };
        const rows = await runtime.store.listAlertLedgerItemsByUser({
          userId: auth.userId,
          limit: filter.limit ?? 50,
          category: filter.category
        });

        await appendAudit(runtime, "alerts.listed", {
          request_id: meta.requestId,
          route: pathname,
          count: rows.length,
          category: filter.category ?? null,
          limit: filter.limit ?? 50
        }, auth.userId);

        sendJson(response, 200, {
          data: rows.map((row) => toAlertLedgerView(row))
        });
        return;
      }

      const userAlertParts = pathname.split("/").filter(Boolean);
      if (userAlertParts.length >= 4 &&
        userAlertParts[0] === "v1" &&
        userAlertParts[1] === "user" &&
        userAlertParts[2] === "alerts"
      ) {
        const alertId = userAlertParts[3];
        if (!alertId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        if (method === "GET" && userAlertParts.length === 4) {
          const record = await runtime.store.getAlertLedgerItem({
            id: alertId,
            userId: auth.userId
          });
          if (!record) {
            sendJson(response, 404, {
              error: "alert_not_found",
              error_message: "Alert not found."
            });
            return;
          }

          await appendAudit(runtime, "alerts.retrieved", {
            request_id: meta.requestId,
            route: pathname,
            alert_id: alertId,
            notification_type: record.notificationType
          }, auth.userId);

          sendJson(response, 200, {
            data: toAlertLedgerView(record)
          });
          return;
        }

        if (method === "POST" && userAlertParts.length === 5 && userAlertParts[4] === "feedback") {
          const body = await readJsonBody<AlertFeedbackSubmission>(request);
          const feedback = body.feedback?.trim();
          if (!feedback || !isAlertFeedbackState(feedback)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "feedback must be one of: useful, not_useful."
            });
            return;
          }

          const updated = await runtime.store.setAlertLedgerFeedback({
            id: alertId,
            userId: auth.userId,
            feedback,
            updatedAt: new Date().toISOString()
          });
          if (!updated) {
            sendJson(response, 404, {
              error: "alert_not_found",
              error_message: "Alert not found."
            });
            return;
          }

          await appendAudit(runtime, "alerts.feedback_submitted", {
            request_id: meta.requestId,
            route: pathname,
            alert_id: alertId,
            feedback,
            notification_type: updated.notificationType
          }, auth.userId);
          await recordConvictionJournalEntryFromAlertFeedback(runtime, updated, feedback);

          sendJson(response, 200, {
            data: toAlertLedgerView(updated)
          });
          return;
        }

        if (method === "POST" && userAlertParts.length === 5 && userAlertParts[4] === "mute") {
          const existing = await runtime.store.getAlertLedgerItem({
            id: alertId,
            userId: auth.userId
          });
          if (!existing) {
            sendJson(response, 404, {
              error: "alert_not_found",
              error_message: "Alert not found."
            });
            return;
          }

          const mutedAt = new Date().toISOString();
          const quietUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await runtime.store.upsertNotificationPreferences({
            userId: auth.userId,
            preferences: [
              {
                type: existing.notificationType,
                quietUntil
              }
            ],
            updatedAt: mutedAt
          });
          const updated = await runtime.store.markAlertLedgerMuted({
            id: alertId,
            userId: auth.userId,
            mutedAt
          });
          if (!updated) {
            sendJson(response, 404, {
              error: "alert_not_found",
              error_message: "Alert not found."
            });
            return;
          }

          await appendAudit(runtime, "alerts.muted", {
            request_id: meta.requestId,
            route: pathname,
            alert_id: alertId,
            notification_type: updated.notificationType,
            quiet_until: quietUntil
          }, auth.userId);

          sendJson(response, 200, {
            data: toAlertLedgerView(updated)
          });
          return;
        }
      }

      if (method === "GET" && pathname === "/v1/user/profile") {
        const profile = await buildUserProfile(runtime, auth.userId);
        if (!profile) {
          sendJson(response, 404, {
            error: "user_not_found",
            error_message: "User not found."
          });
          return;
        }

        await appendAudit(
          runtime,
          "subscription.profile_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            tier: profile.tier
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: profile
        });
        return;
      }

      if (
        await handleRevenueCatRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta,
            auth
          },
          {
            appendAudit,
            buildUserProfile,
            logWarn,
            readJsonBody,
            sendJson
          }
        )
      ) {
        return;
      }

      if (method === "POST" && pathname === "/v1/feedback/report") {
        const body = await readJsonBody<ReportFeedbackSubmission>(request);
        const reportId = body.report_id?.trim();
        if (!reportId) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "report_id is required."
          });
          return;
        }

        const codeRaw = body.code?.trim();
        if (!codeRaw || !isReportFeedbackCode(codeRaw)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "code must be one of: useful, confusing, generic, stale, bug_report."
          });
          return;
        }

        const sourceSurface = body.source_surface?.trim();
        if (!sourceSurface || sourceSurface.length > 100) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "source_surface is required and must be at most 100 characters."
          });
          return;
        }

        const severityRaw = body.severity?.trim() ?? "normal";
        if (!isFeedbackSeverity(severityRaw)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "severity must be one of: normal, high, blocker."
          });
          return;
        }

        const message = normalizeFeedbackMessage(body.message);
        if (body.message !== undefined && message === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "message must be at most 2000 characters."
          });
          return;
        }

        const reportMetadata = await runtime.store.getReportById(reportId);
        if (!reportMetadata) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
        if (!hasAccess) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const subscription = await runtime.store.getUserSubscription(auth.userId);
        const ticker =
          body.ticker?.trim().toUpperCase() ||
          reportMetadata.ticker?.trim().toUpperCase() ||
          undefined;
        const nowIso = new Date().toISOString();
        const queued = await runtime.store.enqueueUserFeedback({
          id: createId(),
          userId: auth.userId,
          feedbackType: "report",
          code: codeRaw,
          severity: severityRaw,
          sourceSurface,
          userTier: subscription.tier,
          reportId,
          ticker,
          message: message ?? "",
          metadata: {
            request_id: meta.requestId,
            report_type: reportMetadata.type,
            report_schema_version: reportMetadata.schemaVersion
          },
          triageStatus: "new",
          routeStatus: "pending",
          createdAt: nowIso,
          updatedAt: nowIso
        });

        await appendAudit(
          runtime,
          "feedback.report_submitted",
          {
            request_id: meta.requestId,
            route: pathname,
            feedback_id: queued.id,
            report_id: reportId,
            code: codeRaw,
            severity: severityRaw,
            source_surface: sourceSurface,
            user_tier: subscription.tier
          },
          auth.userId
        );

        sendJson(response, 202, {
          data: {
            feedback_id: queued.id,
            status: "queued_for_review",
            triage_status: queued.triageStatus,
            route_status: queued.routeStatus,
            created_at: queued.createdAt
          }
        });
        return;
      }

      if (method === "POST" && pathname === "/v1/feedback/subscription") {
        const body = await readJsonBody<SubscriptionFeedbackSubmission>(request);

        const codeRaw = body.code?.trim();
        if (!codeRaw || !isSubscriptionFeedbackCode(codeRaw)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message:
              "code must be one of: cancel_price, cancel_low_value, cancel_too_noisy, cancel_other."
          });
          return;
        }

        const sourceSurface = body.source_surface?.trim();
        if (!sourceSurface || sourceSurface.length > 100) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "source_surface is required and must be at most 100 characters."
          });
          return;
        }

        const severityRaw = body.severity?.trim() ?? "normal";
        if (!isFeedbackSeverity(severityRaw)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "severity must be one of: normal, high, blocker."
          });
          return;
        }

        const message = normalizeFeedbackMessage(body.message);
        if (body.message !== undefined && message === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "message must be at most 2000 characters."
          });
          return;
        }

        const subscription = await runtime.store.getUserSubscription(auth.userId);
        const nowIso = new Date().toISOString();
        const queued = await runtime.store.enqueueUserFeedback({
          id: createId(),
          userId: auth.userId,
          feedbackType: "subscription",
          code: codeRaw,
          severity: severityRaw,
          sourceSurface,
          userTier: subscription.tier,
          message: message ?? "",
          metadata: {
            request_id: meta.requestId
          },
          triageStatus: "new",
          routeStatus: "pending",
          createdAt: nowIso,
          updatedAt: nowIso
        });

        await appendAudit(
          runtime,
          "feedback.subscription_submitted",
          {
            request_id: meta.requestId,
            route: pathname,
            feedback_id: queued.id,
            code: codeRaw,
            severity: severityRaw,
            source_surface: sourceSurface,
            user_tier: subscription.tier
          },
          auth.userId
        );

        sendJson(response, 202, {
          data: {
            feedback_id: queued.id,
            status: "queued_for_review",
            triage_status: queued.triageStatus,
            route_status: queued.routeStatus,
            created_at: queued.createdAt
          }
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/macro-stress/current") {
        const legacySnapshot = await runtime.store.getLatestFearGreedSnapshot();
        if (!legacySnapshot) {
          sendJson(response, 404, {
            error: "macro_stress_not_found",
            error_message: "No Macro Stress snapshot is available yet."
          });
          return;
        }
        const snapshot = legacySnapshotToMacroStress(legacySnapshot);

        await appendAudit(
          runtime,
          "macro_stress.current_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            market_date: snapshot.as_of,
            state: snapshot.state
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: snapshot
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/macro-stress/history") {
        const days = parsePositiveInteger(url.searchParams.get("days") ?? undefined, 90, 1, 365);
        if (days === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "days must be an integer between 1 and 365."
          });
          return;
        }

        const history = (await runtime.store.listFearGreedHistory(days)).map((snapshot) =>
          legacySnapshotToMacroStress(snapshot)
        );
        await appendAudit(
          runtime,
          "macro_stress.history_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            days,
            row_count: history.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: history
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/sentiment/current") {
        const snapshot = await runtime.store.getLatestFearGreedSnapshot();
        if (!snapshot) {
          sendJson(response, 404, {
            error: "sentiment_not_found",
            error_message: "No sentiment snapshot is available yet."
          });
          return;
        }

        await appendAudit(
          runtime,
          "sentiment.current_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            market_date: snapshot.market_date,
            score: snapshot.score
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: snapshot
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/sentiment/history") {
        const days = parsePositiveInteger(url.searchParams.get("days") ?? undefined, 90, 1, 365);
        if (days === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "days must be an integer between 1 and 365."
          });
          return;
        }

        const history = await runtime.store.listFearGreedHistory(days);
        await appendAudit(
          runtime,
          "sentiment.history_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            days,
            row_count: history.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: history
        });
        return;
      }

      if (
        await handleNotificationRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta,
            auth
          },
          {
            appendAudit,
            readJsonBody,
            sendJson
          }
        )
      ) {
        return;
      }

      if (method === "GET" && pathname === "/v1/user/monitor-snapshots") {
        const snapshots = await runtime.store.listThesisMonitorSnapshotsByUser(auth.userId);
        await appendAudit(
          runtime,
          "monitor.snapshots_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            snapshot_count: snapshots.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: snapshots.map((snapshot) => ({
            user_id: snapshot.userId,
            ticker: snapshot.ticker,
            state: snapshot.state,
            reason: snapshot.reason,
            score: snapshot.score,
            report_id: snapshot.reportId,
            report_generated_at: snapshot.reportGeneratedAt,
            report_schema_version: snapshot.reportSchemaVersion,
            last_deep_dive_at: snapshot.lastDeepDiveAt,
            material_events_count: snapshot.materialEventsCount,
            unreviewed_events_count: snapshot.unreviewedEventsCount,
            freshness_state: snapshot.freshnessState,
            freshness_score: snapshot.freshnessScore,
            kill_switch_triggered_at: snapshot.killSwitchTriggeredAt,
            freshness_reason: snapshot.freshnessReason,
            updated_at: snapshot.updatedAt
          }))
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/names/relationships") {
        const sourceTicker = normalizeTickerSymbol(url.searchParams.get("source_ticker") ?? undefined);
        const targetTicker = normalizeTickerSymbol(url.searchParams.get("target_ticker") ?? undefined);
        const stateRaw = url.searchParams.get("state")?.trim();
        const states =
          stateRaw && stateRaw.length > 0
            ? stateRaw
                .split(",")
                .map((state) => state.trim())
                .filter((state): state is NameRelationshipState => isNameRelationshipState(state))
            : undefined;
        if (stateRaw && stateRaw.length > 0 && (!states || states.length === 0)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "state must be active, suppressed, inactive, or a comma-separated list."
          });
          return;
        }
        const minConfidenceRaw = url.searchParams.get("min_confidence");
        const minConfidence =
          minConfidenceRaw === null || minConfidenceRaw.trim().length === 0
            ? undefined
            : Number.parseFloat(minConfidenceRaw);
        if (minConfidence !== undefined && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "min_confidence must be a number between 0 and 1."
          });
          return;
        }
        const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 100, 1, 250);
        if (limit === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "limit must be an integer between 1 and 250."
          });
          return;
        }

        const relationships = await runtime.store.listNameRelationshipsByUser({
          userId: auth.userId,
          sourceTicker,
          targetTicker,
          states,
          minConfidence,
          limit
        });
        await appendAudit(runtime, "name_relationships.retrieved", {
          request_id: meta.requestId,
          route: pathname,
          relationship_count: relationships.length
        }, auth.userId);

        sendJson(response, 200, {
          data: relationships.map(toNameRelationshipView)
        });
        return;
      }

      if (method === "GET" && pathname === "/v1/research/earnings/state") {
        const asOf =
          normalizeDateInput(
            url.searchParams.get("as_of")?.trim() ??
              dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
          ) ?? dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
        const windowPastDays = parsePositiveInteger(
          url.searchParams.get("window_past_days")?.trim() ?? undefined,
          7,
          1,
          30
        );
        if (windowPastDays === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "window_past_days must be an integer between 1 and 30."
          });
          return;
        }
        const windowAheadDays = parsePositiveInteger(
          url.searchParams.get("window_ahead_days")?.trim() ?? undefined,
          30,
          1,
          120
        );
        if (windowAheadDays === undefined) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "window_ahead_days must be an integer between 1 and 120."
          });
          return;
        }
        const tickers = uniqueUppercaseTickers(
          (url.searchParams.get("tickers") ?? "")
            .split(",")
            .map((value) => value.trim())
        );
        const stateList = await getEarningsEventStateListForUser(runtime, {
          userId: auth.userId,
          asOf,
          tickers: tickers.length > 0 ? tickers : undefined,
          windowPastDays,
          windowAheadDays
        });
        await appendAudit(
          runtime,
          "earnings_state.retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker_count: tickers.length,
            state_count: stateList.states.length,
            as_of: asOf
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: stateList
        });
        return;
      }

      if (method === "GET" && pathname.startsWith("/v1/research/war-room/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== "research" || parts[2] !== "war-room") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }
        const warRoomId = parts[3]?.trim();
        if (!warRoomId) {
          sendJson(response, 404, {
            error: "war_room_not_found",
            error_message: "War Room not found."
          });
          return;
        }

        const warRoom = await getWarRoomById(runtime, {
          warRoomId,
          userId: auth.userId
        });
        if (!warRoom) {
          sendJson(response, 404, {
            error: "war_room_not_found",
            error_message: "War Room not found."
          });
          return;
        }

        const timeline = await runtime.store.listWarRoomTimelineEvents({
          warRoomId: warRoom.warRoomId,
          limit: 200
        });
        const earningsStateList = await getEarningsEventStateListForUser(runtime, {
          userId: auth.userId,
          asOf: normalizeDateInput(warRoom.eventDate) ??
            dateInTimeZone(new Date(), runtime.config.subscriptionTimezone),
          tickers: [warRoom.ticker],
          windowPastDays: 30,
          windowAheadDays: 30
        });
        const earningsState = findEarningsState(earningsStateList.states, {
          ticker: warRoom.ticker,
          eventId: warRoom.earningsEventId,
          eventDate: warRoom.eventDate
        });
        const evidencePack = buildWarRoomEvidencePack({
          state: earningsState,
          timeline
        });
        await appendAudit(
          runtime,
          "war_room.retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            war_room_id: warRoom.warRoomId,
            timeline_count: timeline.length,
            earnings_timing_state: earningsState?.timing_state,
            earnings_source_state: earningsState?.source_state
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: {
            war_room_id: warRoom.warRoomId,
            ticker: warRoom.ticker,
            earnings_event_id: warRoom.earningsEventId,
            event_date: warRoom.eventDate,
            state: warRoom.state,
            current_cadence_min: warRoom.currentCadenceMin,
            prepared_at: warRoom.preparedAt,
            closed_at: warRoom.closedAt,
            last_cycle_status: warRoom.lastCycleStatus,
            last_lag_min: warRoom.lastLagMin,
            last_runtime_min: warRoom.lastRuntimeMin,
            last_cycle_at: warRoom.lastCycleAt,
            earnings_state: earningsState ?? null,
            evidence_pack: evidencePack,
            reason_path: {
              earnings_state_reason: earningsState?.reason_text,
              latest_timeline_reason:
                timeline.length > 0 ? timeline[0]?.reasonText : undefined
            },
            timeline: timeline.map((event) => ({
              war_room_event_id: event.id,
              war_room_id: event.warRoomId,
              phase: event.phase,
              event_type: event.eventType,
              reason_text: event.reasonText,
              source_refs: event.sourceRefs,
              alert_ledger_id: event.alertLedgerId,
              report_id: event.reportId,
              created_at: event.createdAt
            }))
          }
        });
        return;
      }

      if (method === "GET" && pathname === "/watchlist") {
        const tickers = await runtime.store.listWatchlistTickersByUser(auth.userId);
        sendJson(response, 200, {
          data: tickers
        });
        return;
      }

      if (
        await handleResearchStateRoutes(
          {
            method,
            pathname,
            request,
            response,
            runtime,
            meta,
            auth
          },
          {
            appendAudit,
            dateInTimeZone,
            normalizeDateInput,
            readJsonBody,
            sendJson
          }
        )
      ) {
        return;
      }

      if (method === "POST" && pathname === "/watchlist") {
        const body = await readJsonBody<{ ticker?: string }>(request);
        const ticker = body.ticker?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const supportedTicker = await runtime.store.getSupportedTicker(ticker);
        if (!supportedTicker) {
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        const current = await runtime.store.listWatchlistTickersByUser(auth.userId);
        const subscription = await runtime.store.getUserSubscription(auth.userId);
        const watchlistLimit = watchlistLimitForTier(subscription.tier);
        if (!current.includes(ticker) && current.length >= watchlistLimit) {
          sendJson(
            response,
            403,
            buildUpgradeRequiredPayload(
              "watchlist_cap",
              `Watchlist limit reached for ${subscription.tier} tier (${watchlistLimit}).`
            )
          );
          return;
        }

        const updated = await runtime.store.addWatchlistTicker({
          id: createId(),
          userId: auth.userId,
          ticker,
          addedAt: new Date().toISOString()
        });

        await appendAudit(
          runtime,
          "watchlist.ticker_added",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker,
            watchlist_size: updated.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: updated
        });
        return;
      }

      if (method === "DELETE" && pathname.startsWith("/watchlist/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "watchlist") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const ticker = parts[1]?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const updated = await runtime.store.removeWatchlistTicker(auth.userId, ticker);
        await appendAudit(
          runtime,
          "watchlist.ticker_removed",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker,
            watchlist_size: updated.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: updated
        });
        return;
      }

      if (
        await handlePulseRoutes(
          {
            method,
            pathname,
            response,
            runtime,
            meta,
            auth
          },
          {
            appendAudit,
            normalizeDateInput,
            sendJson,
            sendBinary,
            buildMarketPulsePdfExport
          }
        )
      ) {
        return;
      }

      if (method === "GET" && (pathname === "/tickers/search" || pathname === "/tickers")) {
        const query = url.searchParams.get("q")?.trim() ?? "";
        if (!query) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "query parameter q is required."
          });
          return;
        }

        logInfo("Ticker search requested", {
          request_id: meta.requestId,
          user_id: auth.userId,
          query
        });

        const results = await runtime.store.searchTickers(query, 25);
        if (results.length === 0) {
          logWarn("Ticker not found", {
            request_id: meta.requestId,
            user_id: auth.userId,
            query,
            reason: "no_supported_match"
          });
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        logInfo("Ticker search succeeded", {
          request_id: meta.requestId,
          user_id: auth.userId,
          query,
          result_count: results.length
        });
        sendJson(response, 200, {
          data: results
        });
        return;
      }

      if (method === "POST" && pathname === "/jobs") {
        const body = await readJsonBody<CreateJobRequest>(request);
        const ticker = body.ticker?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const supportedTicker = await runtime.store.getSupportedTicker(ticker);
        if (!supportedTicker) {
          logWarn("Ticker not found or unsupported for Deep Dive request", {
            request_id: meta.requestId,
            user_id: auth.userId,
            ticker
          });
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        const subscription = await runtime.store.getUserSubscription(auth.userId);
        const deepDiveLimit = dailyDeepDiveLimitForTier(subscription.tier);
        const usageDate = dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
        let usageReserved = false;
        if (deepDiveLimit > 0) {
          const reservation = await runtime.store.reserveDailyDeepDiveUsage(
            auth.userId,
            usageDate,
            deepDiveLimit
          );
          if (!reservation.allowed) {
            sendJson(
              response,
              403,
              buildUpgradeRequiredPayload(
                "deep_dive_daily_limit",
                `Daily Deep Dive limit reached for ${subscription.tier} tier (${deepDiveLimit}/day).`
              )
            );
            return;
          }
          usageReserved = true;
        }

        const nowIso = new Date().toISOString();
        const coverage = await runtime.store.getTickerCoverageByTicker(ticker);
        const fingerprint = deepDiveFingerprint({
          ticker,
          schemaVersion: "2.0",
          latestPeriod: coverage?.latest_period ?? undefined
        });
        const reusable = await runtime.store.findReusableDeepDiveReport({
          ticker,
          fingerprint,
          nowIso
        });

        if (reusable) {
          let reuseJob: JobRecord;
          try {
            reuseJob = await runtime.store.createJob({
              id: createId(),
              type: "deep_dive",
              userId: auth.userId,
              ticker,
              createdAt: nowIso
            });
          } catch (error) {
            if (usageReserved) {
              await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
            }
            throw error;
          }
          const reusableArtifact = await runtime.artifactStore.readReport(reusable.artifactKey);
          if (!reusableArtifact || !("job_id" in reusableArtifact)) {
            if (usageReserved) {
              await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
            }
            await runtime.store.markJobFailed(
              reuseJob.id,
              new Date().toISOString(),
              "Reusable report artifact missing."
            );
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Reusable report artifact missing."
            });
            return;
          }

          const reusableReport = await enrichAnalysisReportIssuer(runtime, assertIncomingAnalysisReport(reusableArtifact));
          const reusedReportId = createId();
          const reusedReport = cloneReusableDeepDiveReport(reusableReport, {
            reportId: reusedReportId,
            jobId: reuseJob.id,
            generatedAt: nowIso
          });

          let artifactKey: string | undefined;
          try {
            artifactKey = await runtime.artifactStore.writeReport(reusedReport);
            const persisted = await runtime.store.createReport({
              id: reusedReport.report_id,
              jobId: reuseJob.id,
              type: reusedReport.type,
              ticker: reusedReport.ticker,
              schemaVersion: reusedReport.schema_version,
              artifactKey,
              fingerprint: reusable.fingerprint,
              freshnessExpiresAt: reusable.freshnessExpiresAt,
              createdAt: reusedReport.generated_at,
              isCurrent: true
            });
            const completed = await runtime.store.markJobComplete(
              reuseJob.id,
              nowIso,
              persisted.id
            );
            if (!completed) {
              await cleanupStoredReport(runtime, persisted.id, artifactKey);
              if (usageReserved) {
                await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
              }
              await runtime.store.markJobFailed(
                reuseJob.id,
                new Date().toISOString(),
                "Failed to attach reusable report."
              );
              sendJson(response, 500, {
                error: "internal_error",
                error_message: "Failed to attach reusable report."
              });
              return;
            }

            await appendAudit(
              runtime,
              "job.reused",
              {
                request_id: meta.requestId,
                route: pathname,
                job_id: completed.id,
                report_id: persisted.id,
                ticker,
                fingerprint
              },
              auth.userId
            );

            await createContrarianAnchorFromReport(runtime, {
              report: reusedReport,
              userId: auth.userId,
              requestId: meta.requestId,
              route: pathname
            });
            await createKillSwitchRulesFromReport(runtime, {
              report: reusedReport,
              userId: auth.userId,
              requestId: meta.requestId,
              route: pathname
            });
            await createNameRelationshipsFromReport(runtime, {
              report: reusedReport,
              userId: auth.userId,
              requestId: meta.requestId,
              route: pathname
            });
            await recordConvictionJournalEntryFromReport(runtime, {
              report: reusedReport,
              userId: auth.userId
            });

            logInfo("Deep dive report reused", {
              request_id: meta.requestId,
              user_id: auth.userId,
              job_id: completed.id,
              report_id: persisted.id,
              ticker,
              fingerprint
            });

            sendJson(response, 200, buildJobStatusResponse(completed));
            return;
          } catch (error) {
            if (artifactKey) {
              await cleanupStoredReport(runtime, reusedReportId, artifactKey);
            }
            if (usageReserved) {
              await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
            }
            const message = error instanceof Error ? error.message : "Reusable report handling failed";
            await runtime.store.markJobFailed(
              reuseJob.id,
              new Date().toISOString(),
              message
            );
            captureException(new Error(message), {
              service: serviceName,
              request_id: meta.requestId,
              route: pathname
            });
            sendJson(response, 500, {
              error: "internal_error",
              error_message: "Failed to attach reusable report."
            });
            return;
          }
        }

        const createdAt = nowIso;
        let job: JobRecord;
        try {
          job = await runtime.store.createJob({
            id: createId(),
            type: "deep_dive",
            userId: auth.userId,
            ticker,
            createdAt
          });
        } catch (error) {
          if (usageReserved) {
            await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
          }
          throw error;
        }

        try {
          await runtime.queue.publish(job.id);
        } catch (error) {
          if (usageReserved) {
            await runtime.store.releaseDailyDeepDiveUsage(auth.userId, usageDate);
          }
          const message = error instanceof Error ? error.message : "Queue publish failed";
          const failedJob = await runtime.store.markJobFailed(
            job.id,
            new Date().toISOString(),
            message
          );
          await appendAudit(runtime, "job.failed", {
            request_id: meta.requestId,
            route: pathname,
            job_id: job.id,
            status: "failed",
            error_message: message
          }, auth.userId);
          captureException(new Error(message), {
            service: serviceName,
            job_id: job.id
          });
          sendJson(response, 503, {
            error: "queue_unavailable",
            error_message: "Job could not be queued.",
            job: failedJob ? buildJobStatusResponse(failedJob) : undefined
          });
          return;
        }

        await appendAudit(runtime, "job.queued", {
          request_id: meta.requestId,
          route: pathname,
          job_id: job.id,
          ticker,
          status: "queued"
        }, auth.userId);

        logInfo("Job queued", {
          request_id: meta.requestId,
          user_id: auth.userId,
          job_id: job.id,
          ticker
        });

        sendJson(response, 202, buildJobStatusResponse(job));
        return;
      }

      if (method === "GET" && pathname.startsWith("/jobs/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "jobs") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const jobId = parts[1];
        if (!jobId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const job = await runtime.store.getJob(jobId);
        if (!job || job.userId !== auth.userId) {
          sendJson(response, 404, {
            error: "job_not_found",
            error_message: "Job not found."
          });
          return;
        }

        sendJson(response, 200, buildJobStatusResponse(job));
        return;
      }

      if (method === "GET" && pathname === "/reports") {
        const reports = await runtime.store.listReportsByUser(auth.userId);
        const payload = reports.map(buildReportListItem);
        sendJson(response, 200, payload);
        return;
      }

      if (method === "GET" && pathname.startsWith("/reports/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "reports") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const reportId = parts[1];
        if (!reportId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const reportMetadata = await runtime.store.getReportById(reportId);
        if (!reportMetadata) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
        if (!hasAccess) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const artifact = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
        if (!artifact) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report artifact missing."
          });
          return;
        }

        let report: AnalysisReport;
        try {
          report = await enrichAnalysisReportIssuer(runtime, assertIncomingAnalysisReport(artifact));
        } catch {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report artifact missing."
          });
          return;
        }

        await appendAudit(runtime, "report.retrieved", {
          request_id: meta.requestId,
          route: pathname,
          job_id: reportMetadata.jobId,
          report_id: reportMetadata.id
        }, auth.userId);

        sendJson(response, 200, report);
        return;
      }

      if ((method === "GET" || method === "PUT") && pathname.startsWith("/v1/reports/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (method === "GET" && parts.length === 5 && parts[0] === "v1" && parts[1] === "reports" && parts[3] === "export" && parts[4] === "pdf") {
          const reportId = parts[2];
          if (!reportId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          const reportMetadata = await runtime.store.getReportById(reportId);
          if (!reportMetadata) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
          if (!hasAccess) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const artifact = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
          if (!artifact || !("type" in artifact) || artifact.type !== "deep_dive") {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Deep Dive report artifact missing."
            });
            return;
          }

          let deepDiveReport: AnalysisReport;
          try {
            deepDiveReport = await enrichAnalysisReportIssuer(runtime, assertIncomingAnalysisReport(artifact));
          } catch {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Deep Dive report artifact missing."
            });
            return;
          }
            try {
              const pdf = buildInstitutionalPdfExport(deepDiveReport);
              const filenameTicker = deepDiveReport.ticker ? deepDiveReport.ticker.trim().toUpperCase() : "REPORT";
              await appendAudit(runtime, "report.exported_pdf", {
                request_id: meta.requestId,
                route: pathname,
                report_id: reportId,
                page_count: pdf.pageCount
              }, auth.userId);

              sendBinary(
                response,
                200,
                pdf.buffer,
                "application/pdf",
                {
                  "content-disposition": `attachment; filename="thesis-deep-dive-${filenameTicker}-${reportId}.pdf"`
                }
              );
              return;
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown PDF export failure";
              logError("PDF export failed", {
                request_id: meta.requestId,
                route: pathname,
                report_id: reportId,
                error_message: message
              });
              captureException(new Error(message), {
                service: serviceName,
                request_id: meta.requestId,
                route: pathname,
                report_id: reportId
              });
              sendJson(response, 500, {
                error: "internal_error",
                error_message: "PDF export failed."
              });
              return;
            }
          }

        if (method === "GET" && parts.length === 4 && parts[0] === "v1" && parts[1] === "reports" && parts[3] === "opposite-case") {
          const reportId = parts[2];
          if (!reportId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          const reportMetadata = await runtime.store.getReportById(reportId);
          if (!reportMetadata) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
          if (!hasAccess) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const subscription = await runtime.store.getUserSubscription(auth.userId);
          if (subscription.tier !== "PRO") {
            sendJson(
              response,
              403,
              buildUpgradeRequiredPayload(
                "conviction_intelligence",
                "Opposite-case generation is available on the Pro tier."
              )
            );
            return;
          }

          const existing = await runtime.store.getOppositeCaseReportBySource({
            userId: auth.userId,
            sourceReportId: reportId
          });
          if (!existing) {
            sendJson(response, 404, {
              error: "opposite_case_not_found",
              error_message: "No opposite-case report exists for this Deep Dive yet."
            });
            return;
          }

          await appendAudit(runtime, "conviction.opposite_case_retrieved", {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportId,
            opposite_case_id: existing.id
          }, auth.userId);

          sendJson(response, 200, {
            data: toOppositeCaseView(existing)
          });
          return;
        }

        if (parts.length === 4 && parts[0] === "v1" && parts[1] === "reports" && parts[3] === "note") {
          const reportId = parts[2];
          if (!reportId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          const reportMetadata = await runtime.store.getReportById(reportId);
          if (!reportMetadata) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
          if (!hasAccess) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          if (method === "GET") {
            const existing = await runtime.store.getReportNote(reportId, auth.userId);
            if (!existing) {
              sendJson(response, 404, {
                error: "note_not_found",
                error_message: "No note is saved for this report."
              });
              return;
            }
            sendJson(response, 200, {
              data: {
                report_id: reportId,
                content: existing.content,
                updated_at: existing.updatedAt
              }
            });
            return;
          }

          const body = await readJsonBody<{ content?: unknown }>(request);
          if (typeof body.content !== "string") {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "content must be a string."
            });
            return;
          }

          const content = body.content.trim();
          if (content.length > 10_000) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "content must be at most 10000 characters."
            });
            return;
          }

          const updated = await runtime.store.upsertReportNote({
            reportId,
            userId: auth.userId,
            content,
            updatedAt: new Date().toISOString()
          });

          await appendAudit(runtime, "report.note_upserted", {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportId,
            content_length: content.length
          }, auth.userId);

          sendJson(response, 200, {
            data: {
              report_id: reportId,
              content: updated.content,
              updated_at: updated.updatedAt
            }
          });
          return;
        }
      }

      if (method === "POST" && pathname.startsWith("/v1/reports/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length === 4 && parts[0] === "v1" && parts[1] === "reports" && parts[3] === "opposite-case") {
          const reportId = parts[2];
          if (!reportId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          const reportMetadata = await runtime.store.getReportById(reportId);
          if (!reportMetadata) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
          if (!hasAccess) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const subscription = await runtime.store.getUserSubscription(auth.userId);
          if (subscription.tier !== "PRO") {
            sendJson(
              response,
              403,
              buildUpgradeRequiredPayload(
                "conviction_intelligence",
                "Opposite-case generation is available on the Pro tier."
              )
            );
            return;
          }

          const existing = await runtime.store.getOppositeCaseReportBySource({
            userId: auth.userId,
            sourceReportId: reportId
          });
          if (existing) {
            sendJson(response, 200, {
              data: toOppositeCaseView(existing)
            });
            return;
          }

          const artifact = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
          if (!artifact || !("job_id" in artifact)) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report artifact missing."
            });
            return;
          }

          const report = await enrichAnalysisReportIssuer(runtime, assertIncomingAnalysisReport(artifact));
          if (report.type !== "deep_dive" || !report.ticker) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "Opposite-case generation is only supported for Deep Dive reports."
            });
            return;
          }

          const nowIso = new Date().toISOString();
          const oppositeCase = await runtime.store.upsertOppositeCaseReport(
            buildOppositeCaseReportRecord({
              report,
              userId: auth.userId,
              sourceReportId: reportId,
              nowIso
            })
          );
          await recordConvictionJournalEntry(runtime, {
            userId: auth.userId,
            ticker: oppositeCase.ticker,
            eventType: "opposite_case_generated",
            sourceType: "opposite_case",
            sourceId: oppositeCase.id,
            eventAt: oppositeCase.generatedAt,
            title: `${oppositeCase.ticker} opposite case generated`,
            summary: oppositeCase.oppositeCaseSummary,
            thesisSnapshot: convictionThesisSnapshotFromReport(report),
            evidenceRefs: [
              {
                kind: "report",
                ref_id: reportId,
                label: "Source Deep Dive report",
                ticker: oppositeCase.ticker,
                captured_at: report.generated_at
              },
              ...oppositeCase.sharedEvidenceRefs
            ],
            reportId,
            oppositeCaseId: oppositeCase.id
          });

          await appendAudit(runtime, "conviction.opposite_case_generated", {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportId,
            opposite_case_id: oppositeCase.id,
            prompt_version: oppositeCase.promptVersion
          }, auth.userId);

          sendJson(response, 200, {
            data: toOppositeCaseView(oppositeCase)
          });
          return;
        }

        if (parts.length === 4 && parts[0] === "v1" && parts[1] === "reports" && parts[3] === "scenario") {
          const reportId = parts[2];
          if (!reportId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          const reportMetadata = await runtime.store.getReportById(reportId);
          if (!reportMetadata) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
          if (!hasAccess) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report not found."
            });
            return;
          }

          const subscription = await runtime.store.getUserSubscription(auth.userId);
          if (subscription.tier !== "PRO") {
            sendJson(
              response,
              403,
              buildUpgradeRequiredPayload(
                "what_if_scenario",
                "What-If scenarios are available on the Pro tier."
              )
            );
            return;
          }

          const artifact = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
          if (!artifact || !("job_id" in artifact)) {
            sendJson(response, 404, {
              error: "report_not_found",
              error_message: "Report artifact missing."
            });
            return;
          }

          const report = await enrichAnalysisReportIssuer(runtime, assertIncomingAnalysisReport(artifact));
          if (report.type !== "deep_dive") {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "Scenario requests are only supported for Deep Dive reports."
            });
            return;
          }

          if (!report.valuation) {
            sendJson(response, 422, {
              error: "scenario_unavailable",
              error_message: "Valuation block is required for scenario analysis."
            });
            return;
          }

          const body = await readJsonBody<ScenarioRequest>(request);
          const overridesRaw = body.overrides ?? {};
          const projectionYears = overridesRaw.projection_years;
          const terminalGrowth = overridesRaw.terminal_growth_rate;
          const wacc = overridesRaw.wacc;

          if (projectionYears !== undefined) {
            if (!isFiniteNumber(projectionYears) || !Number.isInteger(projectionYears) || projectionYears < 1 || projectionYears > 30) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "projection_years must be an integer between 1 and 30."
              });
              return;
            }
          }
          if (terminalGrowth !== undefined) {
            if (!isFiniteNumber(terminalGrowth) || terminalGrowth < -0.2 || terminalGrowth > 0.2) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "terminal_growth_rate must be between -0.2 and 0.2."
              });
              return;
            }
          }
          if (wacc !== undefined) {
            if (!isFiniteNumber(wacc) || wacc <= 0 || wacc > 1) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "wacc must be between 0 and 1."
              });
              return;
            }
          }

          const mergedWacc = wacc ?? report.valuation.assumptions.wacc;
          const mergedGrowth = terminalGrowth ?? report.valuation.assumptions.terminal_growth_rate;
          if (mergedWacc <= mergedGrowth) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "wacc must be greater than terminal_growth_rate."
            });
            return;
          }

          const scenario = computeScenarioResponse(reportId, report.valuation, {
            projection_years: projectionYears,
            terminal_growth_rate: terminalGrowth,
            wacc
          });

          await appendAudit(runtime, "report.scenario_generated", {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportId,
            has_projection_years_override: projectionYears !== undefined,
            has_terminal_growth_override: terminalGrowth !== undefined,
            has_wacc_override: wacc !== undefined
          }, auth.userId);

          sendJson(response, 200, scenario);
          return;
        }
      }

      sendJson(response, 404, { status: "not_found" });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        sendJson(response, 413, {
          error: "payload_too_large",
          error_message: `JSON body must be <= ${error.limitBytes} bytes.`
        });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown product-api failure";
      logError("Unhandled request failure", {
        request_id: meta.requestId,
        route: meta.pathname,
        error_message: message
      });
      captureException(new Error(message), {
        service: serviceName,
        request_id: meta.requestId,
        route: meta.pathname
      });
      sendJson(response, 500, {
        error: "internal_error",
        error_message: "Product API failed to process the request."
      });
    }
  });

  server.on("listening", () => {
    logInfo("Service started", {
      port
    });
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    logError("Server error", {
      error_message: message
    });
  });

  server.on("close", () => {
    runtimePromise
      .then((runtime) => runtime.close())
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Runtime close failed";
        logWarn("Runtime close warning", {
          error_message: message
        });
      });
  });

  return server.listen(port);
}

if (require.main === module) {
  startServer();
}
