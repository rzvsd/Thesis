// POST /internal/notifications/freshness-decay. Copied from dispatchFreshnessDecayNotifications in server.ts.
// Retry fix: the old code could fire a second alert (for the next ticker) when run twice on one date.
// Now each user gets at most one freshness alert per as_of date (stable alert id per user and date).
// Batched by user: { as_of?, user_ids?, limit?, cursor? } -> { ..., next_cursor }.
import { logError } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type { AlertLedgerRecord, ThesisFreshnessState, ThesisMonitorSnapshotRecord } from "./types.ts";
import {
  cursorValue,
  dateInTimeZone,
  nextCursor,
  normalizeDateInput,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
  stringList,
} from "./util.ts";

const cooldownHours = 72;
export const freshnessPageSize = 200;

function severity(state: ThesisFreshnessState): number {
  return state === "triggered" ? 4 : state === "stale" ? 3 : state === "aging" ? 2 : 1;
}

function parseState(value: unknown): ThesisFreshnessState | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return v === "current" || v === "aging" || v === "stale" || v === "triggered" ? v : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function shouldDispatchFreshnessAlert(input: {
  previous?: AlertLedgerRecord;
  candidate: ThesisMonitorSnapshotRecord;
  asOfDate: string;
}): boolean {
  const previous = input.previous;
  if (!previous) return true;
  const prevState = parseState(previous.context.freshness_state);
  const prevUnreviewed = num(previous.context.unreviewed_events_count);
  const prevScore = num(previous.context.freshness_score);
  if (previous.context.report_date === input.asOfDate) return false;
  if (prevState && prevState !== input.candidate.freshnessState) return true;
  if (prevState && severity(input.candidate.freshnessState) > severity(prevState)) return true;
  if (prevUnreviewed !== undefined && input.candidate.unreviewedEventsCount > prevUnreviewed) return true;
  if (prevScore !== undefined && input.candidate.freshnessScore < prevScore - 0.05) return true;
  const prevCreated = Date.parse(previous.createdAt);
  const asOfMidday = Date.parse(`${input.asOfDate}T12:00:00.000Z`);
  if (!Number.isFinite(prevCreated) || !Number.isFinite(asOfMidday)) return true;
  return asOfMidday - prevCreated >= cooldownHours * 60 * 60 * 1000;
}

export async function dispatchFreshnessDecay(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  // An empty list means everyone, as in the old SQL.
  const listed = stringList(body.user_ids);
  const userIds = listed && listed.length > 0 ? listed : undefined;
  const limit = pageLimit(body.limit, freshnessPageSize);

  const audience = await deps.store.listAudience({
    notificationType: "freshness_decay",
    userIds,
    page: { afterUserId: cursorValue(body.cursor), limit },
  });

  let evaluated = 0;
  let fired = 0;
  const tally = emptyTally();
  for (const { userId, targets } of audience) {
    const snapshots = await deps.store.listThesisMonitorSnapshotsByUser(userId);
    const recent = (await deps.store.listAlertLedgerItemsByUser({ userId, limit: 200 }))
      .filter((a) => a.notificationType === "freshness_decay")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestByTicker = new Map<string, AlertLedgerRecord>();
    for (const a of recent) {
      const t = typeof a.context.ticker === "string" ? a.context.ticker.trim().toUpperCase() : "";
      if (t && !latestByTicker.has(t)) latestByTicker.set(t, a);
    }
    evaluated += snapshots.length;

    const candidates = snapshots
      .filter((s) => s.freshnessState === "stale" || s.freshnessState === "triggered")
      .sort((a, b) =>
        severity(b.freshnessState) - severity(a.freshnessState) ||
        b.unreviewedEventsCount - a.unreviewedEventsCount ||
        a.freshnessScore - b.freshnessScore ||
        a.ticker.localeCompare(b.ticker)
      );
    const lead = candidates.find((c) =>
      shouldDispatchFreshnessAlert({
        previous: latestByTicker.get(c.ticker.trim().toUpperCase()),
        candidate: c,
        asOfDate: asOf,
      })
    );
    if (!lead) continue;

    const route = notificationRoute("freshness_decay");
    const remaining = candidates.filter((c) => c.ticker !== lead.ticker);
    const body = remaining.length > 0
      ? `${lead.ticker} is ${lead.freshnessState}. ${remaining.length} more name(s) also need review.`
      : `${lead.ticker} is ${lead.freshnessState}. Open Names to review what changed.`;
    const related = remaining.slice(0, 4).map((r) => r.ticker).join(",");
    const shared = {
      ticker: lead.ticker,
      tickers: related,
      freshness_state: lead.freshnessState,
      freshness_score: lead.freshnessScore.toFixed(3),
      material_events_count: String(lead.materialEventsCount),
      unreviewed_events_count: String(lead.unreviewedEventsCount),
      last_deep_dive_at: lead.lastDeepDiveAt ?? "",
      kill_switch_triggered_at: lead.killSwitchTriggeredAt ?? "",
    };
    const result = await deliverAlert(deps, {
      alertId: await stableId(`freshness_decay:${userId}:${asOf}`),
      userId,
      targets,
      notificationType: "freshness_decay",
      route,
      title: notificationTitle("freshness_decay", lead.ticker),
      body,
      reasonCode: "freshness_decay_review_needed",
      reasonText: lead.freshnessReason,
      pushData: {
        ...shared,
        reason_code: "freshness_decay_review_needed",
        reason_text: lead.freshnessReason,
        deep_link_target: route,
      },
      ledgerData: { ...shared, report_date: asOf, deep_link_target: route },
    });
    if (result.duplicate) continue;
    fired += 1;
    addTally(tally, result.push);
  }

  if (tally.failed > 0) logError("Freshness-decay notification delivery partially failed", { ...tally, fired });
  await appendAudit(deps.store, "freshness_decay.dispatched", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    evaluated,
    fired,
    ...tally,
    targeted_users: userIds?.length ?? null,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    evaluated,
    fired,
    ...tally,
    next_cursor: nextCursor(audience.map((m) => m.userId), limit),
  });
}
