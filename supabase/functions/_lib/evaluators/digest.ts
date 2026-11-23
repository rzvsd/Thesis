// POST /internal/notifications/weekly-digest. Copied from server.ts.
// Body: { digest_date?, limit?, cursor? }. Runs on Sundays only, else { status: "skipped" }.
// Audience: PRO users with weekly_digest on (paged); email goes to the verified, opted-in subset.
// Retry fix: the old code sent push, email and a new inbox row on every run. Now the alert id is stable
// per user and digest date, and a user that already has it is skipped (no push, no email, no row).
import { logError } from "../../_shared/log.ts";
import { legacySnapshotToMacroStress } from "../research/macro_stress.ts";
import { recordAlertLedgerItem, sendPush } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import {
  addDaysToIsoDate,
  cursorValue,
  dateInTimeZone,
  isSundayIsoDate,
  nextCursor,
  normalizeDateInput,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
} from "./util.ts";

const lookaheadDays = 7;
export const digestPageSize = 200;

export async function dispatchWeeklyDigest(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const digestDate = normalizeDateInput(body.digest_date ?? today) ?? today;
  if (!isSundayIsoDate(digestDate)) {
    return ok({ status: "skipped", digest_date: digestDate, reason: "not_weekly_digest_day" });
  }
  const limit = pageLimit(body.limit, digestPageSize);
  const audience = await deps.store.listAudience({
    notificationType: "weekly_digest",
    tier: "PRO",
    page: { afterUserId: cursorValue(body.cursor), limit },
  });
  const userIds = audience.map((m) => m.userId);
  const emails = userIds.length > 0
    ? await deps.store.listEmailRecipients({ notificationType: "weekly_digest", tier: "PRO", userIds })
    : [];
  const emailByUser = new Map(emails.map((e) => [e.userId, e]));
  const legacy = await deps.store.getLatestFearGreedSnapshot();
  const macro = legacy ? legacySnapshotToMacroStress(legacy) : undefined;
  const route = notificationRoute("weekly_digest");
  const title = notificationTitle("weekly_digest");

  const t = { attempted: 0, delivered: 0, failed: 0, emailAttempted: 0, emailDelivered: 0, emailFailed: 0 };
  let skippedExisting = 0;
  for (const { userId, targets } of audience) {
    const alertId = await stableId(`weekly_digest:${userId}:${digestDate}`);
    if (await deps.store.alertExists(alertId)) {
      skippedExisting += 1;
      continue;
    }
    const watchlist = await deps.store.listWatchlistTickers(userId);
    const upcoming = watchlist.length > 0
      ? await deps.store.listCalendarEvents({
        tickers: watchlist,
        fromDate: digestDate,
        toDate: addDaysToIsoDate(digestDate, lookaheadDays),
        eventType: "earnings",
      })
      : [];
    const parts = [
      macro
        ? `Macro Stress: ${macro.state.replaceAll("_", " ")}. ${macro.summary}`
        : "Macro Stress data is not ready yet.",
      watchlist.length > 0
        ? `${watchlist.length} watchlist names matter this week.`
        : "Your watchlist is empty.",
      upcoming.length > 0
        ? `${upcoming.length} watchlist names report soon.`
        : "No watchlist earnings are due soon.",
    ];
    const reasonText = watchlist.length > 0
      ? `${watchlist.length} followed names and ${upcoming.length} upcoming earnings were summarized.`
      : "Your weekly market summary was prepared.";

    const push = await sendPush(deps, targets, {
      notificationType: "weekly_digest",
      route,
      title,
      body: parts.join(" "),
      data: {
        alert_id: alertId,
        digest_date: digestDate,
        macro_stress_state: macro?.state ?? "",
        macro_stress_summary: macro?.summary ?? "",
        fear_greed_score: legacy ? String(legacy.score) : "",
        fear_greed_label: legacy?.label ?? "",
        watchlist_count: String(watchlist.length),
        upcoming_earnings_count: String(upcoming.length),
        reason_code: "weekly_summary_ready",
        reason_text: reasonText,
        deep_link_target: route,
      },
    });
    t.attempted += push.attempted;
    t.delivered += push.delivered;
    t.failed += push.failed;

    const target = emailByUser.get(userId);
    const email = target
      ? await deps.email.send([target], {
        subject: `Thesis Weekly Digest - ${digestDate}`,
        text: parts.join("\n"),
      })
      : { attempted: 0, delivered: 0, failed: 0, skipped: 0 };
    t.emailAttempted += email.attempted;
    t.emailDelivered += email.delivered;
    t.emailFailed += email.failed;

    const channels = [...(push.attempted > 0 ? ["push"] : []), ...(email.attempted > 0 ? ["email"] : [])];
    await recordAlertLedgerItem(deps, {
      id: alertId,
      userId,
      notificationType: "weekly_digest",
      route,
      title,
      body: parts.join(" "),
      reasonCode: "weekly_summary_ready",
      reasonText,
      deliveryState: push.failed + email.failed > 0 ? "partial_failure" : "sent",
      data: {
        digest_date: digestDate,
        ...(watchlist[0] ? { ticker: watchlist[0] } : {}),
        tickers: watchlist.join(","),
        channels: channels.join(","),
        push_attempted: String(push.attempted),
        push_delivered: String(push.delivered),
        email_attempted: String(email.attempted),
        email_delivered: String(email.delivered),
        deep_link_target: route,
      },
    });
  }

  const counts = {
    attempted: t.attempted,
    delivered: t.delivered,
    failed: t.failed,
    email_attempted: t.emailAttempted,
    email_delivered: t.emailDelivered,
    email_failed: t.emailFailed,
    total_attempted: t.attempted + t.emailAttempted,
    total_delivered: t.delivered + t.emailDelivered,
    total_failed: t.failed + t.emailFailed,
  };
  if (counts.total_failed > 0) {
    logError("Weekly digest notification delivery partially failed", {
      request_id: meta.requestId,
      route: meta.route,
      digest_date: digestDate,
      ...counts,
    });
  }
  await appendAudit(deps.store, "weekly_digest.dispatched", {
    request_id: meta.requestId,
    route: meta.route,
    digest_date: digestDate,
    sunday_schedule: true,
    ...counts,
    already_sent: skippedExisting,
  });
  return ok({
    status: "ok",
    digest_date: digestDate,
    ...counts,
    already_sent: skippedExisting,
    next_cursor: nextCursor(userIds, limit),
  });
}
