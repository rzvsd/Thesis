// Conviction journal, insights and opposite case. Copied from apps/product-api/src/server.ts (AGENTS rule 3).
import { logInfo } from "../../_shared/log.ts";
import type { ReportBodyReader } from "./ports.ts";
import type { ResearchStore } from "./store.ts";
import type {
  AlertFeedbackState,
  AlertLedgerRecord,
  AnalysisReport,
  ConvictionEvidenceRef,
  ConvictionInsightCardRecord,
  ConvictionJournalEntryRecord,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  OppositeCaseReportRecord,
  ThesisMonitorSnapshotRecord,
} from "./types.ts";
import { createId, normalizeTickerSymbol } from "./util.ts";

export const convictionOppositeCasePromptVersion = "thesis-m6-opposite-case";

export function toConvictionJournalEntryView(record: ConvictionJournalEntryRecord) {
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
        : undefined,
    },
    evidence_refs: record.evidenceRefs.map((ref) => ({ ...ref })),
    report_id: record.reportId,
    alert_ledger_id: record.alertLedgerId,
    war_room_id: record.warRoomId,
    monitor_snapshot_key: record.monitorSnapshotKey,
    opposite_case_id: record.oppositeCaseId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function toConvictionInsightCardView(record: ConvictionInsightCardRecord) {
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
      evidence_refs: finding.evidence_refs.map((ref) => ({ ...ref })),
    })),
    source_journal_entry_ids: [...record.sourceJournalEntryIds],
    generated_at: record.generatedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function toOppositeCaseView(record: OppositeCaseReportRecord) {
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
      evidence_refs: point.evidence_refs.map((ref) => ({ ...ref })),
    })),
    shared_evidence_refs: record.sharedEvidenceRefs.map((ref) => ({ ...ref })),
    decisive_factors: [...record.decisiveFactors],
    generated_at: record.generatedAt,
    created_at: record.createdAt,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// server.ts isAnalysisReport.
export function isAnalysisReport(value: unknown): value is AnalysisReport {
  if (!isObject(value)) return false;
  if (typeof value.report_id !== "string" || typeof value.generated_at !== "string") return false;
  if (value.type !== "deep_dive" && value.type !== "market_pulse") return false;
  return Array.isArray(value.sections);
}

// Stands in for assertIncomingAnalysisReport (report-validation.ts). The full schema check stays with
// the writer (M2); here a body that is not a report throws, which the old server also turned into a 500.
export function assertAnalysisReport(value: unknown): AnalysisReport {
  if (!isAnalysisReport(value)) throw new Error("Stored report body is not a valid analysis report");
  return value;
}

export function extractThesisStatement(report: AnalysisReport): string | undefined {
  const section = report.sections.find((entry) =>
    entry.section_id === "thesis_statement" || entry.title.trim().toLowerCase() === "thesis statement"
  );
  const body = section?.body?.trim();
  return body && body.length > 0 ? body : undefined;
}

export function convictionEvidenceRefsFromReport(report: AnalysisReport): ConvictionEvidenceRef[] {
  const refs = new Map<string, ConvictionEvidenceRef>();
  const reportTicker = normalizeTickerSymbol(report.ticker);
  refs.set(`report:${report.report_id}`, {
    kind: "report",
    ref_id: report.report_id,
    label: report.type === "deep_dive" ? "Deep Dive report" : "Report",
    ticker: reportTicker,
    captured_at: report.generated_at,
  });
  const evidenceItems = [
    ...(report.signal?.evidence ?? []),
    ...report.sections.flatMap((section) => section.evidence ?? []),
  ];
  for (const evidence of evidenceItems) {
    if (!evidence.evidence_id || refs.has(`evidence:${evidence.evidence_id}`)) continue;
    refs.set(`evidence:${evidence.evidence_id}`, {
      kind: "evidence_item",
      ref_id: evidence.evidence_id,
      label: evidence.source_name,
      ticker: reportTicker,
      captured_at: evidence.retrieved_at,
    });
  }
  return [...refs.values()].slice(0, 16);
}

export function convictionThesisSnapshotFromReport(
  report: AnalysisReport,
  monitorSnapshot?: ThesisMonitorSnapshotRecord,
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
    freshness_score: monitorSnapshot?.freshnessScore,
  };
}

export function buildOppositeCaseReportRecord(input: {
  report: AnalysisReport;
  userId: string;
  sourceReportId: string;
  nowIso: string;
}): OppositeCaseReportRecord {
  const ticker = input.report.ticker?.trim().toUpperCase() ?? "UNKNOWN";
  const thesisSummary = extractThesisStatement(input.report) ??
    input.report.signal?.reasons?.[0] ??
    `${ticker} thesis summary is unavailable in the source report.`;
  const signalLanguage = input.report.signal?.value
    ? `The source signal is ${input.report.signal.value}.`
    : "The source signal is not explicit.";
  const firstReason = input.report.signal?.reasons?.[0] ??
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
        evidence_refs: sharedEvidenceRefs,
      },
      { title: "Assumption sensitivity", summary: valuationLanguage, evidence_refs: sharedEvidenceRefs },
      {
        title: "Timing risk",
        summary:
          "Even if the thesis is directionally right, the market may require fresher proof before rewarding it.",
        evidence_refs: sharedEvidenceRefs,
      },
    ],
    sharedEvidenceRefs,
    decisiveFactors: [
      "Whether the latest thesis evidence remains durable after new material events.",
      "Whether valuation and confidence assumptions survive the next review.",
      "Whether future evidence confirms or weakens the core thesis statement.",
    ],
    generatedAt: input.nowIso,
    createdAt: input.nowIso,
  };
}

// Journal entries are a Pro feature: Free users get no entry (old behaviour).
export async function recordConvictionJournalEntry(
  store: ResearchStore,
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
  },
): Promise<ConvictionJournalEntryRecord | undefined> {
  if ((await store.getSubscriptionTier(input.userId)) !== "PRO") return undefined;
  const now = new Date().toISOString();
  const record = await store.upsertConvictionJournalEntry({
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
    updatedAt: now,
  });
  logInfo("Conviction journal entry upserted", {
    user_id: input.userId,
    ticker: record.ticker,
    event_type: record.eventType,
    journal_entry_id: record.id,
    source_type: record.sourceType,
    source_id: record.sourceId,
  });
  return record;
}

export function convictionTickerFromAlert(alert: AlertLedgerRecord): string | undefined {
  const candidates = [
    alert.context?.ticker,
    alert.context?.affected_ticker,
    alert.context?.lead_ticker,
    alert.context?.source_ticker,
  ];
  for (const candidate of candidates) {
    const ticker = normalizeTickerSymbol(candidate);
    if (ticker) return ticker;
  }
  return undefined;
}

export async function latestConvictionSnapshotForTicker(
  store: ResearchStore,
  readReportBody: ReportBodyReader,
  input: { userId: string; ticker: string; reportId?: string },
): Promise<
  { snapshot: ConvictionThesisSnapshot; evidenceRefs: ConvictionEvidenceRef[]; report?: AnalysisReport }
> {
  const ticker = input.ticker.trim().toUpperCase();
  const snapshots = await store.listThesisMonitorSnapshotsByUser(input.userId);
  const monitorSnapshot = snapshots.find((entry) => entry.ticker === ticker);
  const candidateReports = input.reportId
    ? [await store.getReportById(input.reportId)]
    : (await store.listReportsByUser(input.userId))
      .filter((report) => report.type === "deep_dive" && report.ticker === ticker)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const reportMetadata = candidateReports.find(Boolean);

  if (reportMetadata) {
    try {
      const artifact = await readReportBody(reportMetadata);
      if (isAnalysisReport(artifact) && artifact.type === "deep_dive") {
        return {
          snapshot: convictionThesisSnapshotFromReport(artifact, monitorSnapshot),
          evidenceRefs: convictionEvidenceRefsFromReport(artifact),
          report: artifact,
        };
      }
    } catch {
      logInfo("Conviction journal fell back without report artifact", {
        user_id: input.userId,
        ticker,
        report_id: reportMetadata.id,
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
      report_schema_version: monitorSnapshot?.reportSchemaVersion,
    },
    evidenceRefs: monitorSnapshot
      ? [{
        kind: "monitor_snapshot",
        ref_id: `${input.userId}:${ticker}`,
        label: "Monitor snapshot",
        ticker,
        captured_at: monitorSnapshot.updatedAt,
      }]
      : [],
  };
}

export async function recordConvictionJournalEntryFromAlertFeedback(
  store: ResearchStore,
  readReportBody: ReportBodyReader,
  alert: AlertLedgerRecord,
  feedback: AlertFeedbackState,
): Promise<void> {
  const ticker = convictionTickerFromAlert(alert);
  if (!ticker) return;
  const reportId = typeof alert.context?.report_id === "string" ? alert.context.report_id : undefined;
  const { snapshot, evidenceRefs } = await latestConvictionSnapshotForTicker(store, readReportBody, {
    userId: alert.userId,
    ticker,
    reportId,
  });
  await recordConvictionJournalEntry(store, {
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
      { kind: "alert_ledger", ref_id: alert.id, label: alert.title, ticker, captured_at: alert.updatedAt },
      ...evidenceRefs,
    ],
    reportId,
    alertLedgerId: alert.id,
    warRoomId: typeof alert.context?.war_room_id === "string" ? alert.context.war_room_id : undefined,
    monitorSnapshotKey: `${alert.userId}:${ticker}`,
  });
}
