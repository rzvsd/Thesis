// GET /internal/feedback/queue. Copied from server.ts. Read only.
// Query: limit (1-500, default 50), feedback_type, triage_status, user_tier, source_surface.
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalResult, ok, validation } from "./result.ts";
import { type FeedbackTriageStatus, feedbackTriageStatuses, type UserFeedbackQueueRecord } from "./types.ts";
import { parsePositiveInteger } from "./util.ts";

export function toFeedbackQueueView(r: UserFeedbackQueueRecord): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    feedback_type: r.feedbackType,
    code: r.code,
    severity: r.severity,
    source_surface: r.sourceSurface,
    user_tier: r.userTier,
    report_id: r.reportId ?? null,
    ticker: r.ticker ?? null,
    message: r.message,
    metadata: r.metadata,
    triage_status: r.triageStatus,
    route_status: r.routeStatus,
    triage_owner: r.triageOwner ?? null,
    triaged_at: r.triagedAt ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function listFeedbackQueue(deps: EvaluatorDeps, query: URLSearchParams): Promise<EvalResult> {
  const limit = parsePositiveInteger(query.get("limit"), 50, 1, 500);
  if (limit === undefined) return validation("limit must be an integer between 1 and 500.");
  const feedbackType = query.get("feedback_type")?.trim() ?? "";
  if (feedbackType && feedbackType !== "report" && feedbackType !== "subscription") {
    return validation("feedback_type must be report or subscription when provided.");
  }
  const triage = query.get("triage_status")?.trim() ?? "";
  if (triage && !(feedbackTriageStatuses as readonly string[]).includes(triage)) {
    return validation("triage_status must be one of: new, reviewed, routed, resolved, dismissed.");
  }
  const tier = query.get("user_tier")?.trim().toUpperCase() ?? "";
  if (tier && tier !== "FREE" && tier !== "PRO") {
    return validation("user_tier must be FREE or PRO when provided.");
  }
  const surface = query.get("source_surface")?.trim();

  const rows = await deps.store.listUserFeedbackQueue({
    limit,
    feedbackType: feedbackType ? (feedbackType as "report" | "subscription") : undefined,
    triageStatus: triage ? (triage as FeedbackTriageStatus) : undefined,
    userTier: tier ? (tier as "FREE" | "PRO") : undefined,
    sourceSurface: surface || undefined,
  });
  return ok({ data: rows.map(toFeedbackQueueView) });
}
