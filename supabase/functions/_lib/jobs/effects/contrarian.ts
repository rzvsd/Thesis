// Contrarian alert anchor: remembers the close price at the time of a directional signal.
import { logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport } from "../types.ts";
import { addHours, appendAudit, asContrarianSignal, contrarianAnchorWindowDays, nowIso } from "./helpers.ts";
import type { EffectsDeps } from "./types.ts";

export async function createContrarianAnchorFromReport(
  deps: Pick<EffectsDeps, "store" | "latestClose" | "now">,
  input: { report: AnalysisReport; userId?: string; requestId: string; route: string },
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }
  const signalValue = asContrarianSignal(report.signal?.value);
  if (!signalValue) {
    return;
  }

  const ticker = report.ticker.trim().toUpperCase();
  let anchorPrice: number | undefined;
  try {
    anchorPrice = await deps.latestClose(ticker);
    // The old price lookup threw when no close was available.
    if (anchorPrice === undefined) {
      throw new Error(`EOD price unavailable for ${ticker}: missing`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "anchor price lookup failed";
    logInfo("Contrarian anchor skipped due to missing anchor price", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      error_message: message,
    });
    await appendAudit(deps.store, "contrarian.anchor_skipped", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      signal_value: signalValue,
      reason: "anchor_price_unavailable",
    }, userId);
    return;
  }

  if (!anchorPrice || !Number.isFinite(anchorPrice) || anchorPrice <= 0) {
    await appendAudit(deps.store, "contrarian.anchor_skipped", {
      request_id: input.requestId,
      route: input.route,
      ticker,
      signal_value: signalValue,
      reason: "anchor_price_invalid",
    }, userId);
    return;
  }

  const anchoredAt = nowIso(deps);
  const expiresAt = addHours(anchoredAt, contrarianAnchorWindowDays * 24);
  await deps.store.createContrarianAlertAnchor({
    id: crypto.randomUUID(),
    userId,
    ticker,
    reportId: report.report_id,
    signalValue,
    anchorPrice,
    anchoredAt,
    expiresAt,
    isActive: true,
  });

  await appendAudit(deps.store, "contrarian.anchor_created", {
    request_id: input.requestId,
    route: input.route,
    report_id: report.report_id,
    ticker,
    signal_value: signalValue,
    anchor_price: anchorPrice,
    expires_at: expiresAt,
  }, userId);
}
