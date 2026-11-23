// POST /internal/monitor/recompute. Copied from recomputeThesisMonitorSnapshots in server.ts.
// Body: { as_of?, user_ids?, limit?, cursor? }. As before, a user_ids list limits the run to those users
// (an empty list means nobody); without it every user with a watchlist is recomputed. Paged by user.
// Retry safe: snapshots are upserted per (user, ticker) from the same inputs.
// Report bodies: while the report reader is disabled (M2 owns Storage), a name that has a Deep Dive keeps
// its stored thesis state, reason and score; only the freshness fields are recomputed, using the report's
// created_at as the last Deep Dive time. Names without a stored snapshot get "unresolved".
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { isAnalysisReport } from "./journal.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type {
  AnalysisReportLike,
  KillSwitchEvaluationRecord,
  ThesisFreshnessState,
  ThesisMonitorSnapshotRecord,
  ThesisMonitorState,
} from "./types.ts";
import {
  clampNumber,
  cursorValue,
  dateInTimeZone,
  nextCursor,
  normalizeDateInput,
  pageLimit,
  stringList,
} from "./util.ts";

const monitorFreshnessWindowDays = 14;
const freshnessAgingDays = 14;
const freshnessStaleDays = 45;
const freshnessTriggeredLookbackDays = 14;
const dayMs = 24 * 60 * 60 * 1000;
export const monitorPageSize = 200;

export interface MonitorFreshness {
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  freshnessState: ThesisFreshnessState;
  freshnessScore: number;
  killSwitchTriggeredAt?: string;
  freshnessReason: string;
}

function validIso(value: string | undefined): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function daysSince(earlierIso: string | undefined, laterIso: string): number | undefined {
  if (!earlierIso) return undefined;
  const earlier = Date.parse(earlierIso);
  const later = Date.parse(laterIso);
  if (!Number.isFinite(earlier) || !Number.isFinite(later)) return undefined;
  return Math.max(0, Math.floor((later - earlier) / dayMs));
}

export function computeMonitorFreshness(input: {
  asOfIso: string;
  lastDeepDiveAt?: string;
  materialEventsCount: number;
  unreviewedEventsCount: number;
  killSwitchTriggeredAt?: string;
  fallbackReason?: string;
}): MonitorFreshness {
  const materialEventsCount = Math.max(0, Math.floor(input.materialEventsCount));
  const unreviewed = Math.max(0, Math.floor(input.unreviewedEventsCount));
  const lastDeepDiveAt = validIso(input.lastDeepDiveAt);
  const killSwitchTriggeredAt = validIso(input.killSwitchTriggeredAt);
  const asOfMs = Date.parse(input.asOfIso);
  const isTriggered = killSwitchTriggeredAt !== undefined && Number.isFinite(asOfMs) &&
    Date.parse(killSwitchTriggeredAt) >= asOfMs - freshnessTriggeredLookbackDays * dayMs;
  const age = daysSince(lastDeepDiveAt, input.asOfIso);

  let state: ThesisFreshnessState;
  let reason: string;
  if (isTriggered) {
    state = "triggered";
    reason = `Kill-switch conditions fired recently and ${
      Math.max(1, unreviewed)
    } material event(s) require review.`;
  } else if (age === undefined) {
    state = "stale";
    reason = input.fallbackReason ?? "No Deep Dive baseline is available yet.";
  } else if (age > freshnessStaleDays || unreviewed >= 3) {
    state = "stale";
    reason = age > freshnessStaleDays && unreviewed >= 3
      ? `Deep Dive is ${age} days old with ${unreviewed} unreviewed material event(s).`
      : age > freshnessStaleDays
      ? `Deep Dive is ${age} days old and now stale.`
      : `${unreviewed} material event(s) remain unreviewed.`;
  } else if (age >= freshnessAgingDays || unreviewed >= 1) {
    state = "aging";
    reason = age >= freshnessAgingDays && unreviewed >= 1
      ? `Deep Dive is ${age} days old with ${unreviewed} unreviewed material event(s).`
      : age >= freshnessAgingDays
      ? `Deep Dive is ${age} days old and should be reviewed soon.`
      : `${unreviewed} new material event(s) arrived since your last review.`;
  } else {
    state = "current";
    reason = "Deep Dive is fresh and no material events are waiting for review.";
  }

  const agePenalty = age === undefined
    ? 0.55
    : Math.min(1, age / Math.max(90, freshnessStaleDays * 2)) * 0.55;
  const eventPenalty = Math.min(1, unreviewed / 6) * 0.35;
  const triggerPenalty = isTriggered ? 0.2 : 0;
  return {
    lastDeepDiveAt,
    materialEventsCount,
    unreviewedEventsCount: unreviewed,
    freshnessState: state,
    freshnessScore: clampNumber(1 - agePenalty - eventPenalty - triggerPenalty, 0, 1),
    killSwitchTriggeredAt,
    freshnessReason: reason,
  };
}

export function summarizeMonitorState(
  report: AnalysisReportLike,
  asOfIso: string,
): { state: ThesisMonitorState; reason: string; score: number } {
  const trust = report.trust_metadata;
  const raw = report.confidence?.score;
  const score = typeof raw === "number" && Number.isFinite(raw) ? clampNumber(raw, 0, 1) : 0.5;
  const generatedMs = Date.parse(report.generated_at);
  const staleCutoff = Date.parse(asOfIso) - monitorFreshnessWindowDays * dayMs;
  const drift = trust?.thesis_drift?.summary?.toLowerCase() ?? "";
  const driftUnavailable = trust?.thesis_drift?.status === "unavailable";
  const contradiction = trust?.contradiction_state === "present" || (trust?.contradictions?.length ?? 0) > 0;

  if (
    trust?.freshness_state === "stale" || contradiction || !Number.isFinite(generatedMs) ||
    generatedMs < staleCutoff || report.signal?.value === "no_signal"
  ) {
    return {
      state: "unresolved",
      reason: contradiction
        ? "Evidence is conflicting and needs review."
        : "Evidence is stale or insufficient to confirm thesis state.",
      score,
    };
  }
  if (
    drift.includes("weaken") || drift.includes("deteriorat") || drift.includes("risk") ||
    report.signal?.value === "negative"
  ) {
    return { state: "weakened", reason: "Latest evidence weakens the prior thesis.", score };
  }
  if (drift.includes("improv") || drift.includes("strengthen")) {
    return {
      state: "improved",
      reason: "Latest evidence strengthens conviction versus the prior thesis.",
      score,
    };
  }
  if (report.signal?.value === "positive" && !driftUnavailable) {
    return {
      state: "improved",
      reason: "Signal and drift are both supportive of the thesis direction.",
      score,
    };
  }
  return {
    state: "intact",
    reason: "Latest evidence remains broadly consistent with the prior thesis.",
    score,
  };
}

function snapshot(
  base:
    & Pick<ThesisMonitorSnapshotRecord, "userId" | "ticker" | "state" | "reason" | "score" | "updatedAt">
    & Partial<Pick<ThesisMonitorSnapshotRecord, "reportId" | "reportGeneratedAt" | "reportSchemaVersion">>,
  f: MonitorFreshness,
): ThesisMonitorSnapshotRecord {
  return {
    ...base,
    ticker: base.ticker.trim().toUpperCase(),
    lastDeepDiveAt: f.lastDeepDiveAt,
    materialEventsCount: f.materialEventsCount,
    unreviewedEventsCount: f.unreviewedEventsCount,
    freshnessState: f.freshnessState,
    freshnessScore: f.freshnessScore,
    killSwitchTriggeredAt: f.killSwitchTriggeredAt,
    freshnessReason: f.freshnessReason,
  };
}

function unresolved(userId: string, ticker: string, reason: string, asOfIso: string, updatedAt: string) {
  return snapshot(
    { userId, ticker, state: "unresolved", reason, score: 0, updatedAt },
    computeMonitorFreshness({
      asOfIso,
      materialEventsCount: 0,
      unreviewedEventsCount: 0,
      fallbackReason: reason,
    }),
  );
}

async function materialEvents(
  deps: EvaluatorDeps,
  ticker: string,
  lastDeepDiveAt: string,
  asOfDate: string,
  matched: KillSwitchEvaluationRecord[],
) {
  const fromDate = Number.isFinite(Date.parse(lastDeepDiveAt))
    ? new Date(Date.parse(lastDeepDiveAt)).toISOString().slice(0, 10)
    : asOfDate;
  const earnings = await deps.store.listCalendarEvents({
    tickers: [ticker],
    fromDate,
    toDate: asOfDate,
    eventType: "earnings",
  });
  const lastMs = Date.parse(lastDeepDiveAt);
  const hits = matched.filter((e) => {
    if (e.ticker.trim().toUpperCase() !== ticker) return false;
    const created = Date.parse(e.createdAt);
    return !Number.isFinite(created) || !Number.isFinite(lastMs) || created >= lastMs;
  });
  const killSwitchTriggeredAt = hits.map((e) => e.createdAt).sort((a, b) => b.localeCompare(a))[0];
  return { count: earnings.length + hits.length, killSwitchTriggeredAt };
}

export async function recomputeMonitor(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOfDate = normalizeDateInput(body.as_of ?? today) ?? today;
  const asOfIso = new Date(`${asOfDate}T12:00:00.000Z`).toISOString();
  const filter = Array.isArray(body.user_ids) ? new Set(stringList(body.user_ids)) : undefined;
  const limit = pageLimit(body.limit, monitorPageSize);
  const page = await deps.store.listUsersWithWatchlist({ afterUserId: cursorValue(body.cursor), limit });
  const updatedAt = deps.now().toISOString();
  let users = 0;
  let names = 0;
  let unresolvedCount = 0;
  let updated = 0;
  let kept = 0;

  for (const entry of page) {
    if (filter && !filter.has(entry.userId)) continue;
    if (entry.tickers.length === 0) continue;
    users += 1;
    names += entry.tickers.length;
    const reports = (await deps.store.listDeepDiveReportsByUser(entry.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const matched = await deps.store.listKillSwitchEvaluations({
      userId: entry.userId,
      outcomes: ["matched"],
      limit: 2000,
    });
    const existing = deps.reports.enabled
      ? new Map<string, ThesisMonitorSnapshotRecord>()
      : new Map((await deps.store.listThesisMonitorSnapshotsByUser(entry.userId)).map((s) => [s.ticker, s]));

    for (const rawTicker of entry.tickers) {
      const ticker = rawTicker.trim().toUpperCase();
      const latest = reports.find((r) => r.ticker?.trim().toUpperCase() === ticker);
      let record: ThesisMonitorSnapshotRecord;
      if (!latest) {
        record = unresolved(
          entry.userId,
          ticker,
          "No completed Deep Dive exists yet for this name.",
          asOfIso,
          updatedAt,
        );
      } else if (!deps.reports.enabled) {
        // Body not readable yet: keep the stored thesis state, refresh freshness from report metadata.
        const prev = existing.get(ticker);
        const lastAt = prev?.reportId === latest.id && prev.lastDeepDiveAt
          ? prev.lastDeepDiveAt
          : latest.createdAt;
        const events = await materialEvents(deps, ticker, lastAt, asOfDate, matched);
        const f = computeMonitorFreshness({
          asOfIso,
          lastDeepDiveAt: lastAt,
          materialEventsCount: events.count,
          unreviewedEventsCount: events.count,
          killSwitchTriggeredAt: events.killSwitchTriggeredAt,
        });
        record = snapshot({
          userId: entry.userId,
          ticker,
          state: prev?.state ?? "unresolved",
          reason: prev?.reason ?? "Report body is not readable yet; thesis state is pending.",
          score: prev?.score ?? 0,
          reportId: prev?.reportId ?? latest.id,
          reportGeneratedAt: prev?.reportGeneratedAt,
          reportSchemaVersion: prev?.reportSchemaVersion ?? latest.schemaVersion,
          updatedAt,
        }, f);
        kept += 1;
      } else {
        let body: unknown;
        try {
          body = await deps.reports.read(latest.artifactKey);
        } catch {
          body = undefined;
        }
        if (body === undefined) {
          record = unresolved(
            entry.userId,
            ticker,
            "Report artifact is unavailable and cannot be evaluated.",
            asOfIso,
            updatedAt,
          );
        } else if (!isAnalysisReport(body) || body.type !== "deep_dive") {
          record = unresolved(
            entry.userId,
            ticker,
            "Latest Deep Dive is not readable in monitor format.",
            asOfIso,
            updatedAt,
          );
        } else {
          const summary = summarizeMonitorState(body, asOfIso);
          const events = await materialEvents(deps, ticker, body.generated_at, asOfDate, matched);
          record = snapshot(
            {
              userId: entry.userId,
              ticker,
              ...summary,
              reportId: body.report_id,
              reportGeneratedAt: body.generated_at,
              reportSchemaVersion: body.schema_version,
              updatedAt,
            },
            computeMonitorFreshness({
              asOfIso,
              lastDeepDiveAt: body.generated_at,
              materialEventsCount: events.count,
              unreviewedEventsCount: events.count,
              killSwitchTriggeredAt: events.killSwitchTriggeredAt,
            }),
          );
        }
      }
      await deps.store.upsertThesisMonitorSnapshot(record);
      if (record.state === "unresolved") unresolvedCount += 1;
      updated += 1;
    }
  }

  const counts = { users, names, unresolved: unresolvedCount, updated, kept_state: kept };
  await appendAudit(deps.store, "monitor.recomputed", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOfDate,
    ...counts,
  });
  return ok({
    status: "ok",
    as_of: asOfDate,
    ...counts,
    next_cursor: nextCursor(page.map((u) => u.userId), limit),
  });
}
