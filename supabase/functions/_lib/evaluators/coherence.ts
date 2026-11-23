// POST /internal/conviction/coherence/evaluate. Copied from runConvictionCoherenceEvaluation in server.ts.
// Body: { period_start?, period_end?, user_ids?, limit?, cursor? }. Default period: the previous calendar month.
// Users: user_ids if given (empty means everyone), else every user with a watchlist; only Pro users get a card.
// Retry safe: the card is upserted on (user, period, insight type), as before.
import { logError, logInfo } from "../../_shared/log.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok, validation } from "./result.ts";
import type {
  ConvictionEvidenceRef,
  ConvictionInsightFinding,
  ConvictionJournalEntryRecord,
} from "./types.ts";
import {
  createId,
  cursorValue,
  isStrictIsoDate,
  nextCursor,
  pageLimit,
  previousCalendarMonthPeriod,
  roundTo,
  stringList,
} from "./util.ts";

const promptVersion = "thesis-m6-coherence-analyzer";
export const coherencePageSize = 200;

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
  "your",
]);

function keywords(text: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const token of (text ?? "").toLowerCase().match(/[a-z]{5,}/g) ?? []) {
    if (!stopWords.has(token)) out.add(token);
  }
  return out;
}

function ref(entry: ConvictionJournalEntryRecord): ConvictionEvidenceRef {
  return {
    kind: "journal_entry",
    ref_id: entry.id,
    label: entry.title,
    ticker: entry.ticker,
    captured_at: entry.eventAt,
  };
}

export function buildCoherenceFindings(entries: ConvictionJournalEntryRecord[]): ConvictionInsightFinding[] {
  const latestByTicker = new Map<string, ConvictionJournalEntryRecord>();
  for (const entry of entries) {
    const existing = latestByTicker.get(entry.ticker);
    if (!existing || entry.eventAt > existing.eventAt) latestByTicker.set(entry.ticker, entry);
  }
  const latest = [...latestByTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  const findings: ConvictionInsightFinding[] = [];

  for (let i = 0; i < latest.length; i += 1) {
    const left = latest[i];
    for (let j = i + 1; j < latest.length; j += 1) {
      const right = latest[j];
      const lk = keywords(`${left.summary} ${left.thesisSnapshot.thesis_summary ?? ""}`);
      const rk = keywords(`${right.summary} ${right.thesisSnapshot.thesis_summary ?? ""}`);
      const shared = [...lk].filter((k) => rk.has(k));
      if (shared.length >= 2 && findings.every((f) => f.finding_type !== "overlap")) {
        findings.push({
          finding_type: "overlap",
          title: "Thesis overlap detected",
          summary: `${left.ticker} and ${right.ticker} lean on similar language: ${
            shared.slice(0, 3).join(", ")
          }.`,
          tickers: [left.ticker, right.ticker],
          evidence_refs: [ref(left), ref(right)],
          confidence: roundTo(Math.min(0.95, 0.6 + shared.length * 0.05), 2),
        });
      }
      const ls = left.thesisSnapshot.signal_value;
      const rs = right.thesisSnapshot.signal_value;
      if (
        ((ls === "positive" && rs === "negative") || (ls === "negative" && rs === "positive")) &&
        findings.every((f) => f.finding_type !== "contradiction")
      ) {
        findings.push({
          finding_type: "contradiction",
          title: "Opposing thesis signals",
          summary:
            `${left.ticker} and ${right.ticker} carry opposite latest thesis signals. Review whether both assumptions can be true together.`,
          tickers: [left.ticker, right.ticker],
          evidence_refs: [ref(left), ref(right)],
          confidence: 0.72,
        });
      }
    }
  }

  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.ticker, (counts.get(e.ticker) ?? 0) + 1);
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 3) {
    findings.push({
      finding_type: "mismatch",
      title: "Conviction attention is concentrated",
      summary: `${busiest[0]} produced ${
        busiest[1]
      } conviction event(s) this period. Review whether attention is matching thesis importance.`,
      tickers: [busiest[0]],
      evidence_refs: entries.filter((e) => e.ticker === busiest[0]).slice(0, 3).map(ref),
      confidence: 0.68,
    });
  }
  return findings.slice(0, 5);
}

export async function evaluateCoherence(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const fallback = previousCalendarMonthPeriod(deps.now(), deps.timeZone);
  const periodStart = body.period_start ?? fallback.periodStart;
  const periodEnd = body.period_end ?? fallback.periodEnd;
  if (!isStrictIsoDate(periodStart) || !isStrictIsoDate(periodEnd)) {
    return validation("period_start and period_end must be YYYY-MM-DD dates.");
  }
  if (periodStart > periodEnd) return validation("period_start must be on or before period_end.");

  const limit = pageLimit(body.limit, coherencePageSize);
  const cursor = cursorValue(body.cursor);
  const listed = stringList(body.user_ids);
  const userIds = listed && listed.length > 0
    ? [...new Set(listed)].sort().filter((id) => !cursor || id > cursor).slice(0, limit)
    : (await deps.store.listUsersWithWatchlist({ afterUserId: cursor, limit })).map((u) => u.userId);

  const startMs = Date.parse(`${periodStart}T00:00:00.000Z`);
  const endMs = Date.parse(`${periodEnd}T23:59:59.999Z`);
  const generatedAt = deps.now().toISOString();
  let evaluatedUsers = 0;
  let generated = 0;
  let degraded = 0;
  let failed = 0;

  for (const userId of userIds) {
    if ((await deps.store.getUserTier(userId)) !== "PRO") continue;
    evaluatedUsers += 1;
    try {
      const entries = (await deps.store.listConvictionJournalEntriesByUser({ userId, limit: 500 }))
        .filter((e) => {
          const ms = Date.parse(e.eventAt);
          return ms >= startMs && ms <= endMs;
        });
      const findings = buildCoherenceFindings(entries);
      const status = entries.length < 2 ? "degraded" : "generated";
      await deps.store.upsertConvictionInsightCard({
        id: createId(),
        userId,
        periodStart,
        periodEnd,
        insightType: "monthly_coherence",
        status,
        title: findings.length > 0
          ? "Monthly conviction review"
          : "Monthly conviction review: nothing unusual",
        summary: findings.length > 0
          ? `${findings.length} conviction pattern(s) need a quick review.`
          : entries.length < 2
          ? "Not enough conviction history exists yet for a strong monthly pattern."
          : "No overlap, contradiction, or mismatch pattern stood out this month.",
        findings,
        sourceJournalEntryIds: entries.map((e) => e.id),
        generatedAt,
        createdAt: generatedAt,
        updatedAt: generatedAt,
      });
      if (status === "generated") generated += 1;
      else degraded += 1;
      logInfo("Conviction coherence card generated", {
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        finding_count: findings.length,
        prompt_version: promptVersion,
      });
    } catch (error) {
      failed += 1;
      logError("Conviction coherence evaluation failed", {
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        error_name: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  const counts = { evaluated_users: evaluatedUsers, generated, degraded, failed };
  await appendAudit(deps.store, "conviction.coherence_evaluated", {
    request_id: meta.requestId,
    route: meta.route,
    period_start: periodStart,
    period_end: periodEnd,
    ...counts,
  });
  return ok({
    status: "ok",
    period_start: periodStart,
    period_end: periodEnd,
    ...counts,
    next_cursor: nextCursor(userIds, limit),
  });
}
