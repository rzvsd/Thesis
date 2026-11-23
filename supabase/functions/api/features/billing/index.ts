// Feature "billing". Owner: M4 (docs/rebuild/OWNERSHIP.md). Ported from apps/product-api/src/routes/revenuecat-routes.ts.
//   POST /v1/webhooks/revenuecat  RevenueCat webhook. Secret in the Authorization header (REVENUECAT_WEBHOOK_SECRET).
//   POST /v1/user/sync-tier       App asks for a fresh tier; reads the RevenueCat REST API (read only).
// No route here can take money or create a plan: purchases happen in Google Play through RevenueCat's SDK.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { env } from "../../../_shared/env.ts";
import { logInfo } from "../../../_shared/log.ts";
import {
  applyWebhookEventToSubscription,
  fetchRevenueCatSubscriberSnapshot,
  hashRevenueCatAppUserId,
  parseRevenueCatWebhookEvent,
  type RevenueCatConfig,
  type RevenueCatSubscriberSnapshot,
  type SubscriptionRecord,
  verifyRevenueCatWebhookSecret,
} from "../../../_lib/billing/revenuecat.ts";
import * as subs from "../../../_lib/billing/store.ts";
import { buildUserProfile, type UserProfile } from "../../../_lib/store/profile.ts";
import { findUserById } from "../../../_lib/store/users.ts";
import { appendAuditEvent } from "../../../_lib/store/reports.ts";
import { bucketOf, generalLimit, type Limiter, readJsonBody } from "../user/http.ts";

export interface BillingDeps {
  limit: Limiter;
  webhookSecret(): string | undefined;
  userExists(userId: string): Promise<boolean>;
  findUserIdByRevenuecatAppUserId(appUserId: string): Promise<string | undefined>;
  getSubscription(userId: string): Promise<SubscriptionRecord>;
  upsertSubscription(input: SubscriptionRecord & { updatedAt: string }): Promise<SubscriptionRecord>;
  fetchSnapshot(appUserId: string): Promise<RevenueCatSubscriberSnapshot>;
  profile(userId: string): Promise<UserProfile | undefined>;
  audit(eventType: string, payload: Record<string, unknown>, userId?: string): Promise<void>;
  now(): string;
}

export function revenueCatConfigFromEnv(): RevenueCatConfig {
  return {
    serverApiKey: env("REVENUECAT_SERVER_API_KEY"),
    entitlementId: env("REVENUECAT_ENTITLEMENT_ID"),
    apiBaseUrl: env("REVENUECAT_API_BASE_URL") ?? "https://api.revenuecat.com/v1",
  };
}

export const pgBillingDeps: BillingDeps = {
  limit: generalLimit,
  webhookSecret: () => env("REVENUECAT_WEBHOOK_SECRET"),
  userExists: async (userId) => (await findUserById(userId)) !== undefined,
  findUserIdByRevenuecatAppUserId: subs.findUserIdByRevenuecatAppUserId,
  getSubscription: subs.getUserSubscription,
  upsertSubscription: subs.upsertUserSubscription,
  fetchSnapshot: (appUserId) => fetchRevenueCatSubscriberSnapshot(revenueCatConfigFromEnv(), appUserId),
  profile: (userId) => buildUserProfile(userId),
  audit: appendAuditEvent,
  now: () => new Date().toISOString(),
};

function requestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function billingRoutes(deps: BillingDeps = pgBillingDeps): Route[] {
  const webhook = async ({ req, path }: RouteContext): Promise<Response> => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    if (!verifyRevenueCatWebhookSecret(req.headers.get("authorization"), deps.webhookSecret())) {
      return apiError(401, "unauthorized", "Invalid RevenueCat webhook secret.");
    }
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const event = parseRevenueCatWebhookEvent(read.body);
    if (!event) return apiError(422, "validation_failed", "Invalid RevenueCat webhook payload.");

    const idHash = await hashRevenueCatAppUserId(event.appUserId);
    const userId = (await deps.userExists(event.appUserId))
      ? event.appUserId
      : await deps.findUserIdByRevenuecatAppUserId(event.appUserId);
    if (!userId) {
      logInfo("revenuecat.webhook_user_not_found", {
        event_type: event.eventType,
        revenuecat_user_id_hash: idHash,
      });
      return json({ status: "ignored", reason: "user_not_found" }, 202);
    }

    const current = await deps.getSubscription(userId);
    const next = applyWebhookEventToSubscription(current, event.eventType, event.billingPeriodEnd);
    const updated = await deps.upsertSubscription({
      userId,
      tier: next.tier,
      billingPeriodEnd: next.billingPeriodEnd,
      revenuecatAppUserId: event.appUserId,
      updatedAt: deps.now(),
    });
    await deps.audit("subscription.webhook_processed", {
      request_id: requestId(req),
      route: path,
      event_type: event.eventType,
      tier: updated.tier,
      billing_period_end: updated.billingPeriodEnd,
      revenuecat_user_id_hash: idHash,
    }, userId);
    return json({ status: "ok" });
  };

  const syncTier = async ({ req, path, auth }: RouteContext): Promise<Response> => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const userId = auth.userId!;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const existing = await deps.getSubscription(userId);
    const raw = read.body.revenuecat_app_user_id;
    const requested = typeof raw === "string" ? raw.trim() : undefined;
    const allowed = new Set<string>([userId]);
    if (existing.revenuecatAppUserId) allowed.add(existing.revenuecatAppUserId);
    if (requested && !allowed.has(requested)) {
      return apiError(403, "forbidden", "revenuecat_app_user_id is not bound to the authenticated user.");
    }
    const appUserId = requested || existing.revenuecatAppUserId || userId;

    let snapshot: RevenueCatSubscriberSnapshot;
    try {
      snapshot = await deps.fetchSnapshot(appUserId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync tier.";
      return apiError(503, "sync_unavailable", message);
    }

    const updated = await deps.upsertSubscription({
      userId,
      tier: snapshot.tier,
      billingPeriodEnd: snapshot.billingPeriodEnd,
      revenuecatAppUserId: snapshot.appUserId,
      updatedAt: deps.now(),
    });
    const profile = await deps.profile(userId);
    if (!profile) return apiError(404, "user_not_found", "User not found.");
    await deps.audit("subscription.sync_tier_completed", {
      request_id: requestId(req),
      route: path,
      tier: updated.tier,
      billing_period_end: updated.billingPeriodEnd,
      revenuecat_user_id_hash: await hashRevenueCatAppUserId(snapshot.appUserId),
    }, userId);
    return json({ data: profile });
  };

  return [
    { method: "POST", path: "/v1/webhooks/revenuecat", auth: "webhook", handler: webhook },
    { method: "POST", path: "/v1/user/sync-tier", auth: "user", handler: syncTier },
  ];
}

export const feature: FeatureModule = {
  name: "billing",
  owner: "M4",
  routes: billingRoutes(),
};
