// Conviction journal: a PRO user's record of each Deep Dive thesis over time.
import { logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport } from "../types.ts";
import { extractThesisStatement, normalizeTickerSymbol, nowIso } from "./helpers.ts";
import type {
  ConvictionEvidenceRef,
  ConvictionThesisSnapshot,
  EffectsDeps,
  ThesisMonitorSnapshotRecord,
} from "./types.ts";

interface EvidenceLike {
  evidence_id?: string;
  source_name?: string;
  retrieved_at?: string;
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

  const signalEvidence = Array.isArray(report.signal?.evidence)
    ? report.signal.evidence as EvidenceLike[]
    : [];
  const evidenceItems: EvidenceLike[] = [
    ...signalEvidence,
    ...report.sections.flatMap((section) =>
      Array.isArray(section.evidence) ? section.evidence as EvidenceLike[] : []
    ),
  ];
  for (const evidence of evidenceItems) {
    if (!evidence?.evidence_id || refs.has(`evidence:${evidence.evidence_id}`)) {
      continue;
    }
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

export async function recordConvictionJournalEntry(
  deps: Pick<EffectsDeps, "store" | "now">,
  input: {
    userId: string;
    ticker: string;
    eventType: string;
    sourceType: string;
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
): Promise<{ id: string } | undefined> {
  const tier = await deps.store.getUserSubscriptionTier(input.userId);
  if (tier !== "PRO") {
    return undefined;
  }

  const now = nowIso(deps);
  const ticker = input.ticker.trim().toUpperCase();
  const record = await deps.store.upsertConvictionJournalEntry({
    id: crypto.randomUUID(),
    userId: input.userId,
    ticker,
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
    ticker,
    event_type: input.eventType,
    journal_entry_id: record.id,
    source_type: input.sourceType,
    source_id: input.sourceId,
  });
  return record;
}

export async function recordConvictionJournalEntryFromReport(
  deps: Pick<EffectsDeps, "store" | "now">,
  input: { report: AnalysisReport; userId?: string },
): Promise<void> {
  if (input.report.type !== "deep_dive" || !input.userId || !input.report.ticker) {
    return;
  }
  const ticker = input.report.ticker.trim().toUpperCase();
  const monitorSnapshot = (await deps.store.listThesisMonitorSnapshotsByUser(input.userId))
    .find((entry) => entry.ticker === ticker);
  await recordConvictionJournalEntry(deps, {
    userId: input.userId,
    ticker,
    eventType: "deep_dive_generated",
    sourceType: "report",
    sourceId: input.report.report_id,
    eventAt: input.report.generated_at,
    title: `${ticker} thesis recorded`,
    summary: extractThesisStatement(input.report) ??
      input.report.signal?.reasons?.[0] ??
      `${ticker} Deep Dive completed.`,
    thesisSnapshot: convictionThesisSnapshotFromReport(input.report, monitorSnapshot),
    evidenceRefs: convictionEvidenceRefsFromReport(input.report),
    reportId: input.report.report_id,
  });
}
