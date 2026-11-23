// Morning Exception Briefing for Pro users, sent with each new Pulse issue.
// Copied from apps/product-api/src/server.ts (buildMorningExceptionBriefing, truncateMessage, safeParseDateMs,
// contextPulseDate, hasAlertForPulseDate). Keep tested logic.
import type {
  AlertLedgerRecord,
  AlertRouteTarget,
  KillSwitchEvaluationRecord,
  NotificationType,
  ThesisMonitorSnapshotRecord,
} from "../types.ts";
import { notificationTitle } from "../util.ts";

export type MorningExceptionBriefingMode = "no_change" | "exceptions_present";

interface MorningExceptionCandidate {
  ticker: string;
  priority: number;
  route: AlertRouteTarget;
  reasonCode: string;
  reasonText: string;
  reportId?: string;
}

export interface MorningExceptionBriefingOutcome {
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

export function truncateMessage(value: string, maxLength: number): string {
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
  const context = alert.context as Record<string, unknown> | undefined;
  const pulseDate = typeof context?.pulse_date === "string" && context.pulse_date.trim().length > 0
    ? context.pulse_date.trim()
    : undefined;
  if (pulseDate) {
    return pulseDate;
  }
  return typeof context?.report_date === "string" && context.report_date.trim().length > 0
    ? context.report_date.trim()
    : undefined;
}

export function hasAlertForPulseDate(
  alerts: AlertLedgerRecord[],
  input: { notificationType: NotificationType; pulseDate: string },
): boolean {
  return alerts.some(
    (alert) =>
      alert.notificationType === input.notificationType && contextPulseDate(alert) === input.pulseDate,
  );
}

export function buildMorningExceptionBriefing(input: {
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
        reportId: snapshot?.reportId,
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
        reportId: snapshot.reportId,
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
        reportId: snapshot.reportId,
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
        reportId: snapshot.reportId,
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
      title: notificationTitle("morning_exception_briefing"),
      body: `${noChangeBody}${macroSuffix}`.trim(),
      reasonCode: "morning_exception_no_change",
      reasonText: noChangeBody,
      leadRoute: normalizedWatchlist.length > 0 ? "today" : "names",
      relatedTickers: [],
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
    title: candidates.length === 1
      ? "1 exception needs review"
      : `${candidates.length} exceptions need review`,
    body: `${headline}${macroSuffix}`.trim(),
    reasonCode: lead.reasonCode,
    reasonText: lead.reasonText,
    leadRoute: lead.route,
    leadTicker: lead.ticker,
    leadReportId: lead.reportId,
    relatedTickers,
  };
}
