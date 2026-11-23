// GET /v1/conviction/timeline and /v1/conviction/insights. Pro only.
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import {
  toConvictionInsightCardView,
  toConvictionJournalEntryView,
} from "../../../_lib/research/conviction.ts";
import { requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import {
  buildUpgradeRequiredPayload,
  normalizeTickerSymbol,
  parsePositiveInteger,
} from "../../../_lib/research/util.ts";
import type { RouteContext } from "../../router.ts";

export function convictionTimelineHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload(
          "conviction_intelligence",
          "Conviction timeline is available on the Pro tier.",
        ),
        403,
      );
    }
    const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 50, 1, 100);
    if (limit === undefined) {
      return json({
        error: "validation_failed",
        error_message: "limit must be an integer between 1 and 100.",
      }, 422);
    }
    const tickerRaw = url.searchParams.get("ticker");
    const ticker = tickerRaw ? normalizeTickerSymbol(tickerRaw) : undefined;
    if (tickerRaw && !ticker) {
      return json({ error: "validation_failed", error_message: "ticker must be a valid US symbol." }, 422);
    }
    const rows = await store.listConvictionJournalEntriesByUser({ userId, ticker, limit });
    await appendAudit(store, "conviction.timeline_listed", {
      request_id: requestId(req),
      route: path,
      count: rows.length,
      ticker: ticker ?? null,
      limit,
    }, userId);
    return json({ data: rows.map(toConvictionJournalEntryView) });
  };
}

export function convictionInsightsHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    if ((await store.getSubscriptionTier(userId)) !== "PRO") {
      return json(
        buildUpgradeRequiredPayload(
          "conviction_intelligence",
          "Conviction insights are available on the Pro tier.",
        ),
        403,
      );
    }
    const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 10, 1, 50);
    if (limit === undefined) {
      return json(
        { error: "validation_failed", error_message: "limit must be an integer between 1 and 50." },
        422,
      );
    }
    const rows = await store.listConvictionInsightCardsByUser({ userId, limit });
    await appendAudit(store, "conviction.insights_listed", {
      request_id: requestId(req),
      route: path,
      count: rows.length,
      limit,
    }, userId);
    return json({ data: rows.map(toConvictionInsightCardView) });
  };
}
