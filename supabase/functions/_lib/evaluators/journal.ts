// Conviction journal entries written when an alert fires. Copied from server.ts
// (recordConvictionJournalEntryFromAlert, latestConvictionSnapshotForTicker and helpers).
import { logInfo } from "../../_shared/log.ts";
import type { EvaluatorDeps } from "./deps.ts";
import type {
  AlertLedgerRecord,
  AnalysisReportLike,
  ConvictionEvidenceRef,
  ConvictionJournalEventType,
  ConvictionJournalSourceType,
  ConvictionThesisSnapshot,
  ThesisMonitorSnapshotRecord,
} from "./types.ts";
import { createId, isPlainRecord, normalizeTickerSymbol } from "./util.ts";

export function isAnalysisReport(value: unknown): value is AnalysisReportLike {
  if (!isPlainRecord(value)) return false;
  if (typeof value.report_id !== "string" || typeof value.generated_at !== "string") return false;
  if (value.type !== "deep_dive" && value.type !== "market_pulse") return false;
  return Array.isArray(value.sections);
}

export function extractThesisStatement(report: AnalysisReportLike): string | undefined {
  const section = report.sections.find((s) =>
    s.section_id === "thesis_statement" || s.title.trim().toLowerCase() === "thesis statement"
  );
  const body = section?.body?.trim();
  return body && body.length > 0 ? body : undefined;
}

export function convictionEvidenceRefsFromReport(report: AnalysisReportLike): ConvictionEvidenceRef[] {
  const refs = new Map<string, ConvictionEvidenceRef>();
  const ticker = normalizeTickerSymbol(report.ticker);
  refs.set(`report:${report.report_id}`, {
    kind: "report",
    ref_id: report.report_id,
    label: report.type === "deep_dive" ? "Deep Dive report" : "Report",
    ticker,
    captured_at: report.generated_at,
  });
  const items = [...(report.signal?.evidence ?? []), ...report.sections.flatMap((s) => s.evidence ?? [])];
  for (const e of items) {
    if (!e.evidence_id || refs.has(`evidence:${e.evidence_id}`)) continue;
    refs.set(`evidence:${e.evidence_id}`, {
      kind: "evidence_item",
      ref_id: e.evidence_id,
      label: e.source_name,
      ticker,
      captured_at: e.retrieved_at,
    });
  }
  return [...refs.values()].slice(0, 16);
}

export function convictionThesisSnapshotFromReport(
  report: AnalysisReportLike,
  monitor?: ThesisMonitorSnapshotRecord,
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
    monitor_state: monitor?.state,
    monitor_reason: monitor?.reason,
    monitor_score: monitor?.score,
    freshness_state: monitor?.freshnessState,
    freshness_score: monitor?.freshnessScore,
  };
}

async function latestConvictionSnapshotForTicker(
  deps: EvaluatorDeps,
  input: { userId: string; ticker: string; reportId?: string },
): Promise<{ snapshot: ConvictionThesisSnapshot; evidenceRefs: ConvictionEvidenceRef[] }> {
  const ticker = input.ticker.trim().toUpperCase();
  const monitor = (await deps.store.listThesisMonitorSnapshotsByUser(input.userId)).find((s) =>
    s.ticker === ticker
  );
  if (deps.reports.enabled) {
    const meta = input.reportId
      ? await deps.store.getReportMeta(input.reportId)
      : (await deps.store.listDeepDiveReportsByUser(input.userId)).find((r) => r.ticker === ticker);
    if (meta) {
      try {
        const artifact = await deps.reports.read(meta.artifactKey);
        if (isAnalysisReport(artifact) && artifact.type === "deep_dive") {
          return {
            snapshot: convictionThesisSnapshotFromReport(artifact, monitor),
            evidenceRefs: convictionEvidenceRefsFromReport(artifact),
          };
        }
      } catch {
        logInfo("Conviction journal fell back without report artifact", { user_id: input.userId, ticker });
      }
    }
  }
  return {
    snapshot: {
      ticker,
      monitor_state: monitor?.state,
      monitor_reason: monitor?.reason,
      monitor_score: monitor?.score,
      freshness_state: monitor?.freshnessState,
      freshness_score: monitor?.freshnessScore,
      report_id: monitor?.reportId,
      report_generated_at: monitor?.reportGeneratedAt,
      report_schema_version: monitor?.reportSchemaVersion,
    },
    evidenceRefs: monitor
      ? [{
        kind: "monitor_snapshot",
        ref_id: `${input.userId}:${ticker}`,
        label: "Monitor snapshot",
        ticker,
        captured_at: monitor.updatedAt,
      }]
      : [],
  };
}

function tickerFromAlert(alert: AlertLedgerRecord): string | undefined {
  for (
    const c of [
      alert.context.ticker,
      alert.context.affected_ticker,
      alert.context.lead_ticker,
      alert.context.source_ticker,
    ]
  ) {
    const t = normalizeTickerSymbol(c);
    if (t) return t;
  }
  return undefined;
}

// Only Pro users get journal entries. The upsert key (user, event type, source) makes retries safe.
export async function recordConvictionJournalEntryFromAlert(
  deps: EvaluatorDeps,
  alert: AlertLedgerRecord,
): Promise<void> {
  const ticker = tickerFromAlert(alert);
  if (!ticker) return;
  let eventType: ConvictionJournalEventType | undefined;
  let sourceType: ConvictionJournalSourceType = "alert_ledger";
  let sourceId = alert.id;
  if (alert.notificationType === "kill_switch") eventType = "kill_switch_alert_fired";
  else if (alert.notificationType === "freshness_decay") eventType = "freshness_decay_alert_fired";
  else if (alert.notificationType === "cross_name_propagation") eventType = "cross_name_alert_fired";
  else if (
    alert.notificationType === "earnings_war_room" && alert.context.war_room_phase === "post" &&
    typeof alert.context.war_room_id === "string"
  ) {
    eventType = "earnings_war_room_closed";
    sourceType = "war_room";
    sourceId = alert.context.war_room_id;
  }
  if (!eventType) return;
  if ((await deps.store.getUserTier(alert.userId)) !== "PRO") return;

  const reportId = typeof alert.context.report_id === "string" && alert.context.report_id.length > 0
    ? alert.context.report_id
    : undefined;
  const { snapshot, evidenceRefs } = await latestConvictionSnapshotForTicker(deps, {
    userId: alert.userId,
    ticker,
    reportId,
  });
  const now = deps.now().toISOString();
  await deps.store.upsertConvictionJournalEntry({
    id: createId(),
    userId: alert.userId,
    ticker,
    eventType,
    sourceType,
    sourceId,
    eventAt: alert.createdAt,
    title: alert.title,
    summary: alert.reasonText || alert.body,
    thesisSnapshot: snapshot,
    evidenceRefs: [
      { kind: "alert_ledger", ref_id: alert.id, label: alert.title, ticker, captured_at: alert.createdAt },
      ...evidenceRefs,
    ],
    reportId,
    alertLedgerId: alert.id,
    warRoomId: typeof alert.context.war_room_id === "string" ? alert.context.war_room_id : undefined,
    monitorSnapshotKey: `${alert.userId}:${ticker}`,
    createdAt: now,
    updatedAt: now,
  });
  logInfo("Conviction journal entry upserted", { user_id: alert.userId, ticker, event_type: eventType });
}
