// Alerts sent when a new Pulse issue is stored. Copied from processMarketPulseJob in apps/product-api/src/server.ts:
// Free users with market_pulse_ready on get "Your Morning Pulse is ready"; Pro users with
// morning_exception_briefing on get the Morning Exception Briefing.
// Changes: push goes through the PushSender port (disabled until M4) and the inbox row is written either way;
// users come from listAudience (devices may be empty) in pages; the alert id is stable per user, type and
// pulse date, so a retried run never sends twice. The old "already has an alert for this pulse date" check stays.
import { addTally, deliverAlert, emptyTally, type PushTally } from "../alerts.ts";
import type { EvaluatorDeps } from "../deps.ts";
import type { AlertLedgerRecord, AudienceMember, NotificationType, SubscriptionTier } from "../types.ts";
import { notificationRoute, notificationTitle, stableId } from "../util.ts";
import { buildMorningExceptionBriefing, hasAlertForPulseDate } from "./briefing.ts";
import type { MarketPulseReport } from "./contracts.ts";

export const pulseAudiencePageSize = 200;

export interface PulseNotifyResult extends PushTally {
  provider: string;
  free_sent: number;
  free_deduped: number;
  pro_sent: number;
  pro_deduped: number;
  pro_no_change: number;
  pro_exceptions: number;
}

// The headline the old code used for the push title and the briefing's macro context.
export function pulseHeadline(report: MarketPulseReport): string | undefined {
  const firstHeadlineCandidate = report.sections.bounded_context.evidence?.[0]?.excerpt ??
    report.sections.canonical_events.evidence?.[0]?.excerpt ??
    report.sections.news_summary?.evidence?.[0]?.excerpt;
  return typeof firstHeadlineCandidate === "string" && firstHeadlineCandidate.trim().length > 0
    ? firstHeadlineCandidate.trim()
    : undefined;
}

// Every user of the audience, page by page.
async function* audiencePages(
  deps: EvaluatorDeps,
  notificationType: NotificationType,
  tier: SubscriptionTier,
): AsyncGenerator<AudienceMember> {
  let afterUserId: string | undefined;
  while (true) {
    const page = await deps.store.listAudience({
      notificationType,
      tier,
      page: { afterUserId, limit: pulseAudiencePageSize },
    });
    for (const member of page) yield member;
    if (page.length < pulseAudiencePageSize) return;
    afterUserId = page[page.length - 1].userId;
  }
}

export async function notifyPulseReady(
  deps: EvaluatorDeps,
  report: MarketPulseReport,
): Promise<PulseNotifyResult> {
  const headline = pulseHeadline(report);
  const pulseDate = report.cycle_end.slice(0, 10);
  const cycleStartIso = report.cycle_start && Number.isFinite(Date.parse(report.cycle_start))
    ? report.cycle_start
    : `${pulseDate}T00:00:00.000Z`;
  const tally = emptyTally();
  const out = {
    free_sent: 0,
    free_deduped: 0,
    pro_sent: 0,
    pro_deduped: 0,
    pro_no_change: 0,
    pro_exceptions: 0,
  };

  const recentAlerts = (userId: string): Promise<AlertLedgerRecord[]> =>
    deps.store.listAlertLedgerItemsByUser({ userId, limit: 100 });

  for await (const { userId, targets } of audiencePages(deps, "market_pulse_ready", "FREE")) {
    if (
      hasAlertForPulseDate(await recentAlerts(userId), { notificationType: "market_pulse_ready", pulseDate })
    ) {
      out.free_deduped += 1;
      continue;
    }
    const reasonText = "Your latest market pulse is ready with the current regime and overnight movers.";
    const route = notificationRoute("market_pulse_ready");
    const result = await deliverAlert(deps, {
      alertId: await stableId(`market_pulse_ready:${userId}:${pulseDate}`),
      userId,
      targets,
      notificationType: "market_pulse_ready",
      route,
      title: headline ?? notificationTitle("market_pulse_ready"),
      body: "Your Morning Pulse is ready. Here is what moved overnight.",
      reasonCode: "market_pulse_ready",
      reasonText,
      pushData: {
        report_date: pulseDate,
        reason_code: "market_pulse_ready",
        reason_text: reasonText,
        deep_link_target: route,
      },
      ledgerData: { report_date: pulseDate, deep_link_target: route },
    });
    addTally(tally, result.push);
    if (result.duplicate) out.free_deduped += 1;
    else out.free_sent += 1;
  }

  for await (const { userId, targets } of audiencePages(deps, "morning_exception_briefing", "PRO")) {
    if (
      hasAlertForPulseDate(await recentAlerts(userId), {
        notificationType: "morning_exception_briefing",
        pulseDate,
      })
    ) {
      out.pro_deduped += 1;
      continue;
    }
    const watchlistTickers = await deps.store.listWatchlistTickers(userId);
    const snapshots = await deps.store.listThesisMonitorSnapshotsByUser(userId);
    // The old query filtered created_at >= cycle start in SQL; here the same filter runs on the rows.
    const matchedEvaluations = (await deps.store.listKillSwitchEvaluations({
      userId,
      outcomes: ["matched"],
      limit: 500,
    })).filter((evaluation) => Date.parse(evaluation.createdAt) >= Date.parse(cycleStartIso));
    const briefing = buildMorningExceptionBriefing({
      watchlistTickers,
      snapshots,
      matchedEvaluations,
      macroHeadline: headline,
    });
    const route = notificationRoute("morning_exception_briefing");
    const data = {
      report_date: pulseDate,
      deep_link_target: route,
      briefing_mode: briefing.mode,
      exceptions_count: String(briefing.exceptionsCount),
      watchlist_count: String(briefing.watchlistCount),
      lead_route: briefing.leadRoute ?? "today",
      lead_ticker: briefing.leadTicker ?? "",
      lead_report_id: briefing.leadReportId ?? "",
      lead_pulse_date: pulseDate,
      tickers: briefing.relatedTickers.join(","),
    };
    const result = await deliverAlert(deps, {
      alertId: await stableId(`morning_exception_briefing:${userId}:${pulseDate}`),
      userId,
      targets,
      notificationType: "morning_exception_briefing",
      route,
      title: briefing.title,
      body: briefing.body,
      reasonCode: briefing.reasonCode,
      reasonText: briefing.reasonText,
      pushData: { ...data, reason_code: briefing.reasonCode, reason_text: briefing.reasonText },
      ledgerData: data,
    });
    addTally(tally, result.push);
    if (result.duplicate) {
      out.pro_deduped += 1;
      continue;
    }
    out.pro_sent += 1;
    if (briefing.mode === "no_change") out.pro_no_change += 1;
    else out.pro_exceptions += 1;
  }

  return { ...tally, provider: deps.push.mode, ...out };
}
