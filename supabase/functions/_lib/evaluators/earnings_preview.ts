// POST /internal/notifications/earnings-preview. Copied from server.ts.
// Audience: Free users, plus the war room's fallback users (body user_ids, as the old scheduler sent them;
// fallback_user_ids is accepted too). Fallback users are handled on the first page only.
// Retry fix: the old code sent again on every run. Now the alert id is stable per user and session date.
// Batched by user: { as_of?, user_ids?, limit?, cursor? } -> { ..., next_cursor }.
import { logError } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { getEarningsEventStateListForUser } from "./earnings_state.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type { AudienceMember } from "./types.ts";
import {
  cursorValue,
  dateInTimeZone,
  nextBusinessDate,
  nextCursor,
  normalizeDateInput,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
  stringList,
  uniqueUppercaseTickers,
} from "./util.ts";

export const earningsPreviewPageSize = 200;

export async function dispatchEarningsPreview(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = normalizeDateInput(body.as_of ?? dateInTimeZone(deps.now(), deps.timeZone)) ??
    dateInTimeZone(deps.now(), deps.timeZone);
  const nextBiz = nextBusinessDate(today);
  const cursor = cursorValue(body.cursor);
  const limit = pageLimit(body.limit, earningsPreviewPageSize);
  const fallbackUserIds = [
    ...new Set([...(stringList(body.user_ids) ?? []), ...(stringList(body.fallback_user_ids) ?? [])]),
  ];

  const freeAudience = await deps.store.listAudience({
    notificationType: "earnings_preview",
    tier: "FREE",
    page: { afterUserId: cursor, limit },
  });
  const fallbackAudience = !cursor && fallbackUserIds.length > 0
    ? await deps.store.listAudience({ notificationType: "earnings_preview", userIds: fallbackUserIds })
    : [];
  const merged = new Map<string, AudienceMember>(freeAudience.map((m) => [m.userId, m]));
  for (const m of fallbackAudience) if (!merged.has(m.userId)) merged.set(m.userId, m);

  const tally = emptyTally();
  const sentTickers: string[] = [];
  for (const { userId, targets } of merged.values()) {
    const watchlist = await deps.store.listWatchlistTickers(userId);
    if (watchlist.length === 0) continue;
    const events = await deps.store.listCalendarEvents({
      tickers: watchlist,
      fromDate: nextBiz,
      toDate: nextBiz,
      eventType: "earnings",
    });
    if (events.length === 0) continue;

    const stateList = await getEarningsEventStateListForUser(deps, {
      userId,
      asOf: today,
      tickers: watchlist,
      windowPastDays: 3,
      windowAheadDays: 3,
    });
    const estimated = stateList.states.filter((s) => s.event_date === nextBiz && s.timing_state === "estimated")
      .map((s) => s.ticker);
    const stated = stateList.states.filter((s) => s.event_date === nextBiz).map((s) => s.ticker);
    const tickers = uniqueUppercaseTickers(
      estimated.length > 0 ? estimated : stated.length > 0 ? stated : events.map((e) => e.ticker.trim().toUpperCase()),
    );
    const lead = tickers[0];
    if (!lead) continue;
    const leadState = stateList.states.find((s) => s.ticker === lead && s.event_date === nextBiz);
    const timingState = leadState?.timing_state ?? "estimated";
    const sourceState = leadState?.source_state ?? "derived";
    const reasonText = estimated.length > 0
      ? `${tickers.join(", ")} has estimated earnings timing for next market session.`
      : `${tickers.join(", ")} is expected to report by next market session (${timingState}, ${
        sourceState.replace("_", " ")
      }).`;
    const route = notificationRoute("earnings_preview");
    const shared = {
      ticker: lead,
      tickers: tickers.join(","),
      earnings_timing_state: timingState,
      earnings_source_state: sourceState,
      earnings_evidence_state: leadState?.evidence_state ?? "calendar_only",
      earnings_conflict: leadState?.conflict.has_conflict ? "true" : "false",
    };
    const result = await deliverAlert(deps, {
      alertId: await stableId(`earnings_preview:${userId}:${nextBiz}`),
      userId,
      targets,
      notificationType: "earnings_preview",
      route,
      title: notificationTitle("earnings_preview", lead),
      body: `${reasonText} Tap to run a Deep Dive.`,
      reasonCode: "earnings_preview_due",
      reasonText,
      pushData: { ...shared, reason_code: "earnings_preview_due", reason_text: reasonText, deep_link_target: route },
      ledgerData: { ...shared, deep_link_target: route },
    });
    if (result.duplicate) continue;
    addTally(tally, result.push);
    sentTickers.push(...tickers);
  }

  if (tally.failed > 0) logError("Earnings preview notification delivery partially failed", { ...tally });
  await appendAudit(deps.store, "earnings_preview.dispatched", {
    request_id: meta.requestId,
    route: meta.route,
    ...tally,
    ticker_count: sentTickers.length,
    fallback_user_count: fallbackUserIds.length,
  });
  return ok({
    status: "ok",
    ...tally,
    ticker_count: sentTickers.length,
    fallback_user_count: fallbackUserIds.length,
    next_cursor: nextCursor(freeAudience.map((m) => m.userId), limit),
  });
}
