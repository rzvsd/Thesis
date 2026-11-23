// Macro stress and the legacy sentiment routes. Both read fear_greed_daily.
//   /v1/macro-stress/*  toAppMacroStress(): the old Macro Stress fields plus score, label, sub_scores and
//                       missing_inputs, so the Android parser can read it (contract diff item 1).
//   /v1/sentiment/*     the raw FearGreedSnapshot, as before.
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import { requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import { toAppMacroStress } from "../../../_lib/research/macro_stress.ts";
import { parsePositiveInteger } from "../../../_lib/research/util.ts";
import type { RouteContext } from "../../router.ts";

function parseDays(url: URL): number | undefined {
  return parsePositiveInteger(url.searchParams.get("days") ?? undefined, 90, 1, 365);
}

const badDays = () =>
  json({ error: "validation_failed", error_message: "days must be an integer between 1 and 365." }, 422);

export function macroStressCurrentHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const legacy = await store.getLatestFearGreedSnapshot();
    if (!legacy) {
      return json({
        error: "macro_stress_not_found",
        error_message: "No Macro Stress snapshot is available yet.",
      }, 404);
    }
    const snapshot = toAppMacroStress(legacy);
    await appendAudit(store, "macro_stress.current_retrieved", {
      request_id: requestId(req),
      route: path,
      market_date: snapshot.as_of,
      state: snapshot.state,
    }, userId);
    return json({ data: snapshot });
  };
}

export function macroStressHistoryHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const days = parseDays(url);
    if (days === undefined) return badDays();
    const history = (await store.listFearGreedHistory(days)).map(toAppMacroStress);
    await appendAudit(store, "macro_stress.history_retrieved", {
      request_id: requestId(req),
      route: path,
      days,
      row_count: history.length,
    }, userId);
    return json({ data: history });
  };
}

export function sentimentCurrentHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const snapshot = await store.getLatestFearGreedSnapshot();
    if (!snapshot) {
      return json(
        { error: "sentiment_not_found", error_message: "No sentiment snapshot is available yet." },
        404,
      );
    }
    await appendAudit(store, "sentiment.current_retrieved", {
      request_id: requestId(req),
      route: path,
      market_date: snapshot.market_date,
      score: snapshot.score,
    }, userId);
    return json({ data: snapshot });
  };
}

export function sentimentHistoryHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const days = parseDays(url);
    if (days === undefined) return badDays();
    const history = await store.listFearGreedHistory(days);
    await appendAudit(store, "sentiment.history_retrieved", {
      request_id: requestId(req),
      route: path,
      days,
      row_count: history.length,
    }, userId);
    return json({ data: history });
  };
}
