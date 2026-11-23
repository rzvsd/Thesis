// POST /internal/notifications/contrarian/evaluate. Copied from server.ts.
// Retry safe: a fired anchor is deactivated, and the alert id is stable per anchor.
// Batched by user: { as_of?, limit?, cursor? } -> { ..., next_cursor }.
import { logError } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { latestPrices } from "./prices.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import {
  cursorValue,
  dateInTimeZone,
  groupTargets,
  nextCursor,
  normalizeDateInput,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
} from "./util.ts";

const moveThresholdPct = 5;
export const contrarianPageSize = 200;

export async function evaluateContrarian(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  const asOfEndIso = new Date(`${asOf}T23:59:59.999Z`).toISOString();
  const limit = pageLimit(body.limit, contrarianPageSize);

  const expiredCount = await deps.store.deactivateExpiredContrarianAnchors(asOfEndIso);
  const audience = await deps.store.listAudience({
    notificationType: "contrarian_alert",
    page: { afterUserId: cursorValue(body.cursor), limit },
  });
  const targetsByUser = groupTargets(audience);
  const userIds = audience.map((m) => m.userId);
  const anchors = userIds.length > 0
    ? await deps.store.listActiveContrarianAnchors({ asOfIso: asOfEndIso, userIds })
    : [];
  const prices = await latestPrices(deps, [...new Set(anchors.map((a) => a.ticker))], asOf);

  const tally = emptyTally();
  let fired = 0;
  for (const anchor of anchors) {
    if (anchor.signalValue === "neutral") {
      await deps.store.deactivateContrarianAnchor(anchor.id, deps.now().toISOString());
      continue;
    }
    const price = prices.get(anchor.ticker.toUpperCase());
    if (!price) continue;
    const movePct = ((price - anchor.anchorPrice) / anchor.anchorPrice) * 100;
    const shouldFire = (anchor.signalValue === "positive" && movePct <= -moveThresholdPct) ||
      (anchor.signalValue === "negative" && movePct >= moveThresholdPct);
    if (!shouldFire) continue;

    const route = notificationRoute("contrarian_alert");
    const move = Math.abs(movePct).toFixed(1);
    const reasonText = `Price moved ${move}% against your ${anchor.signalValue} thesis.`;
    const result = await deliverAlert(deps, {
      alertId: await stableId(`contrarian_alert:${anchor.id}`),
      userId: anchor.userId,
      targets: targetsByUser.get(anchor.userId) ?? [],
      notificationType: "contrarian_alert",
      route,
      title: notificationTitle("contrarian_alert", anchor.ticker),
      body:
        `Your thesis on ${anchor.ticker} (${anchor.signalValue}) is diverging by ${move}%. Tap to review the Deep Dive.`,
      reasonCode: "thesis_shift_detected",
      reasonText,
      pushData: {
        ticker: anchor.ticker,
        report_id: anchor.reportId ?? "",
        signal_value: anchor.signalValue,
        move_pct: movePct.toFixed(2),
        reason_code: "thesis_shift_detected",
        reason_text: reasonText,
        deep_link_target: route,
      },
      ledgerData: { ticker: anchor.ticker, report_id: anchor.reportId ?? "", deep_link_target: route },
    });
    await deps.store.deactivateContrarianAnchor(anchor.id, deps.now().toISOString());
    if (result.duplicate) continue;
    addTally(tally, result.push);
    fired += 1;
  }

  if (tally.failed > 0) logError("Contrarian notification delivery partially failed", { ...tally, fired });
  await appendAudit(deps.store, "contrarian.alerts_evaluated", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    expired_count: expiredCount,
    fired,
    ...tally,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    expired_count: expiredCount,
    fired,
    ...tally,
    next_cursor: nextCursor(userIds, limit),
  });
}
