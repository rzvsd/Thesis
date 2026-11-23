// The in-app alert inbox: GET /v1/user/alerts, GET /v1/user/alerts/:id,
// POST /v1/user/alerts/:id/feedback, POST /v1/user/alerts/:id/mute.
// Ported from apps/product-api/src/server.ts. Push sending is M4; this only reads and updates alert_ledger.
import { json } from "../../../_shared/http.ts";
import { appendAudit, requestId } from "../../../_lib/research/audit.ts";
import { recordConvictionJournalEntryFromAlertFeedback } from "../../../_lib/research/conviction.ts";
import { readJsonBody, requireUserId, type ResearchDeps } from "../../../_lib/research/deps.ts";
import {
  type AlertFeedbackState,
  alertFeedbackStates,
  alertLedgerCategories,
  type AlertLedgerCategory,
  type AlertLedgerRecord,
  type SubscriptionTier,
} from "../../../_lib/research/types.ts";
import { parsePositiveInteger } from "../../../_lib/research/util.ts";
import type { RouteContext } from "../../router.ts";

// The full "what changed" text (detail_body) is a Pro feature; Free gets the headline and
// detail_locked = true so the app can show the upgrade hint.
export function toAlertLedgerView(record: AlertLedgerRecord, tier: SubscriptionTier) {
  const detailLocked = Boolean(record.detailBody) && tier !== "PRO";
  return {
    id: record.id,
    user_id: record.userId,
    notification_type: record.notificationType,
    category: record.category,
    route: record.route,
    title: record.title,
    body: record.body,
    detail_body: detailLocked ? undefined : record.detailBody,
    ...(detailLocked ? { detail_locked: true } : {}),
    reason_code: record.reasonCode,
    reason_text: record.reasonText,
    delivery_state: record.deliveryState,
    feedback_state: record.feedbackState,
    muted_at: record.mutedAt,
    context: record.context,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

const alertNotFound = () => json({ error: "alert_not_found", error_message: "Alert not found." }, 404);

export function alertsListHandler({ store }: ResearchDeps) {
  return async ({ req, url, path, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const limit = parsePositiveInteger(url.searchParams.get("limit") ?? undefined, 50, 1, 100);
    if (limit === undefined) {
      return json({
        error: "validation_failed",
        error_message: "limit must be an integer between 1 and 100.",
      }, 422);
    }
    const categoryRaw = url.searchParams.get("category")?.trim();
    if (categoryRaw && !(alertLedgerCategories as readonly string[]).includes(categoryRaw)) {
      return json({
        error: "validation_failed",
        error_message: "category must be one of: thesis_drift, earnings, macro, system.",
      }, 422);
    }
    const category = categoryRaw && categoryRaw.length > 0 ? categoryRaw as AlertLedgerCategory : undefined;
    const rows = await store.listAlertLedgerItemsByUser({ userId, limit, category });
    await appendAudit(store, "alerts.listed", {
      request_id: requestId(req),
      route: path,
      count: rows.length,
      category: category ?? null,
      limit,
    }, userId);
    const tier = await store.getSubscriptionTier(userId);
    return json({ data: rows.map((row) => toAlertLedgerView(row, tier)) });
  };
}

export function alertGetHandler({ store }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const tier = await store.getSubscriptionTier(userId);
    const record = await store.getAlertLedgerItem({ id: params.id, userId });
    if (!record) return alertNotFound();
    await appendAudit(store, "alerts.retrieved", {
      request_id: requestId(req),
      route: path,
      alert_id: params.id,
      notification_type: record.notificationType,
    }, userId);
    return json({ data: toAlertLedgerView(record, tier) });
  };
}

export function alertFeedbackHandler({ store, readReportBody }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const tier = await store.getSubscriptionTier(userId);
    const body = await readJsonBody<{ feedback?: string }>(req);
    const feedback = body.feedback?.trim();
    if (!feedback || !(alertFeedbackStates as readonly string[]).includes(feedback)) {
      return json({
        error: "validation_failed",
        error_message: "feedback must be one of: useful, not_useful.",
      }, 422);
    }
    const updated = await store.setAlertLedgerFeedback({
      id: params.id,
      userId,
      feedback: feedback as AlertFeedbackState,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) return alertNotFound();
    await appendAudit(store, "alerts.feedback_submitted", {
      request_id: requestId(req),
      route: path,
      alert_id: params.id,
      feedback,
      notification_type: updated.notificationType,
    }, userId);
    await recordConvictionJournalEntryFromAlertFeedback(
      store,
      readReportBody,
      updated,
      feedback as AlertFeedbackState,
    );
    return json({ data: toAlertLedgerView(updated, tier) });
  };
}

export function alertMuteHandler({ store }: ResearchDeps) {
  return async ({ req, path, params, auth }: RouteContext): Promise<Response> => {
    const userId = requireUserId(auth.userId);
    const tier = await store.getSubscriptionTier(userId);
    const existing = await store.getAlertLedgerItem({ id: params.id, userId });
    if (!existing) return alertNotFound();

    // Quiet this notification type for 24 hours, then mark the alert muted.
    const mutedAt = new Date().toISOString();
    const quietUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await store.setNotificationQuietUntil({
      userId,
      type: existing.notificationType,
      quietUntil,
      updatedAt: mutedAt,
    });
    const updated = await store.markAlertLedgerMuted({ id: params.id, userId, mutedAt });
    if (!updated) return alertNotFound();
    await appendAudit(store, "alerts.muted", {
      request_id: requestId(req),
      route: path,
      alert_id: params.id,
      notification_type: updated.notificationType,
      quiet_until: quietUntil,
    }, userId);
    return json({ data: toAlertLedgerView(updated, tier) });
  };
}
