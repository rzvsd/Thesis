// POST /v1/feedback/report and POST /v1/feedback/subscription. Both answer 202 queued_for_review.
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import { readJsonBody, requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import {
  type FeedbackSeverity,
  feedbackSeverityLevels,
  type ReportFeedbackCode,
  reportFeedbackCodes,
  type SubscriptionFeedbackCode,
  subscriptionFeedbackCodes,
  type UserFeedbackQueueRecord,
} from "../../../_lib/research/types.ts";
import { createId, normalizeFeedbackMessage } from "../../../_lib/research/util.ts";
import type { RouteContext } from "../../router.ts";

interface FeedbackBody {
  report_id?: string;
  ticker?: string;
  code?: string;
  severity?: string;
  source_surface?: string;
  message?: unknown;
}

const invalid = (message: string) => json({ error: "validation_failed", error_message: message }, 422);

// Shared checks: source_surface, severity, message. Returns a Response on failure.
function validateCommon(body: FeedbackBody):
  | { ok: true; sourceSurface: string; severity: FeedbackSeverity; message: string }
  | { ok: false; response: Response } {
  const sourceSurface = body.source_surface?.trim();
  if (!sourceSurface || sourceSurface.length > 100) {
    return { ok: false, response: invalid("source_surface is required and must be at most 100 characters.") };
  }
  const severity = body.severity?.trim() ?? "normal";
  if (!(feedbackSeverityLevels as readonly string[]).includes(severity)) {
    return { ok: false, response: invalid("severity must be one of: normal, high, blocker.") };
  }
  const message = normalizeFeedbackMessage(body.message);
  if (body.message !== undefined && message === undefined) {
    return { ok: false, response: invalid("message must be at most 2000 characters.") };
  }
  return { ok: true, sourceSurface, severity: severity as FeedbackSeverity, message: message ?? "" };
}

function accepted(queued: UserFeedbackQueueRecord): Response {
  return json({
    data: {
      feedback_id: queued.id,
      status: "queued_for_review",
      triage_status: queued.triageStatus,
      route_status: queued.routeStatus,
      created_at: queued.createdAt,
    },
  }, 202);
}

export function reportFeedbackHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const body = await readJsonBody<FeedbackBody>(req);
    const reportId = body.report_id?.trim();
    if (!reportId) return invalid("report_id is required.");
    const code = body.code?.trim();
    if (!code || !(reportFeedbackCodes as readonly string[]).includes(code)) {
      return invalid("code must be one of: useful, confusing, generic, stale, bug_report.");
    }
    const common = validateCommon(body);
    if (!common.ok) return common.response;

    const notFound = () => json({ error: "report_not_found", error_message: "Report not found." }, 404);
    const report = await store.getReportById(reportId);
    if (!report) return notFound();
    if (!(await store.hasReportAccessForUser(userId, report.id))) return notFound();

    const tier = await store.getSubscriptionTier(userId);
    const ticker = body.ticker?.trim().toUpperCase() || report.ticker?.trim().toUpperCase() || undefined;
    const nowIso = new Date().toISOString();
    const rid = requestId(req);
    const queued = await store.enqueueUserFeedback({
      id: createId(),
      userId,
      feedbackType: "report",
      code: code as ReportFeedbackCode,
      severity: common.severity,
      sourceSurface: common.sourceSurface,
      userTier: tier,
      reportId,
      ticker,
      message: common.message,
      metadata: { request_id: rid, report_type: report.type, report_schema_version: report.schemaVersion },
      triageStatus: "new",
      routeStatus: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await appendAudit(store, "feedback.report_submitted", {
      request_id: rid,
      route: path,
      feedback_id: queued.id,
      report_id: reportId,
      code,
      severity: common.severity,
      source_surface: common.sourceSurface,
      user_tier: tier,
    }, userId);
    return accepted(queued);
  };
}

export function subscriptionFeedbackHandler({ store }: ResearchDeps) {
  return async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const body = await readJsonBody<FeedbackBody>(req);
    const code = body.code?.trim();
    if (!code || !(subscriptionFeedbackCodes as readonly string[]).includes(code)) {
      return invalid("code must be one of: cancel_price, cancel_low_value, cancel_too_noisy, cancel_other.");
    }
    const common = validateCommon(body);
    if (!common.ok) return common.response;

    const tier = await store.getSubscriptionTier(userId);
    const nowIso = new Date().toISOString();
    const rid = requestId(req);
    const queued = await store.enqueueUserFeedback({
      id: createId(),
      userId,
      feedbackType: "subscription",
      code: code as SubscriptionFeedbackCode,
      severity: common.severity,
      sourceSurface: common.sourceSurface,
      userTier: tier,
      message: common.message,
      metadata: { request_id: rid },
      triageStatus: "new",
      routeStatus: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await appendAudit(store, "feedback.subscription_submitted", {
      request_id: rid,
      route: path,
      feedback_id: queued.id,
      code,
      severity: common.severity,
      source_surface: common.sourceSurface,
      user_tier: tier,
    }, userId);
    return accepted(queued);
  };
}
