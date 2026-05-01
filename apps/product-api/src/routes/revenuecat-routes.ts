import type { IncomingMessage, ServerResponse } from "node:http";

import type { UserProfile } from "../../../../packages/contracts/src";
import type { ProductApiConfig } from "../config";
import {
  fetchRevenueCatSubscriberSnapshot,
  hashRevenueCatAppUserId,
  parseRevenueCatWebhookEvent,
  verifyRevenueCatWebhookSecret
} from "../revenuecat";
import type { ProductStore } from "../store";
import type { UserSubscriptionRecord } from "../types";

interface RevenueCatRuntime {
  config: ProductApiConfig;
  store: ProductStore;
}

interface RequestMeta {
  requestId: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

type SubscriptionProjection = Pick<UserSubscriptionRecord, "tier" | "billingPeriodEnd">;

export interface RevenueCatRouteExecutionContext<TRuntime extends RevenueCatRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
  auth?: AuthContext;
}

export interface RevenueCatRouteDependencies<TRuntime extends RevenueCatRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  buildUserProfile: (runtime: TRuntime, userId: string) => Promise<UserProfile | undefined>;
  logWarn: (message: string, payload?: Record<string, unknown>) => void;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
}

function shouldGrantProFromWebhookEvent(eventType: string): boolean {
  return [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED"
  ].includes(eventType);
}

function shouldExpireFromWebhookEvent(eventType: string): boolean {
  return ["EXPIRATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"].includes(eventType);
}

function applyWebhookEventToSubscription(
  current: UserSubscriptionRecord,
  eventType: string,
  billingPeriodEnd: string | undefined
): SubscriptionProjection {
  if (shouldGrantProFromWebhookEvent(eventType)) {
    return {
      tier: "PRO",
      billingPeriodEnd
    };
  }

  if (eventType === "CANCELLATION") {
    return {
      tier: "PRO",
      billingPeriodEnd: billingPeriodEnd ?? current.billingPeriodEnd
    };
  }

  if (shouldExpireFromWebhookEvent(eventType)) {
    return {
      tier: "FREE",
      billingPeriodEnd: undefined
    };
  }

  return {
    tier: current.tier,
    billingPeriodEnd: current.billingPeriodEnd
  };
}

export async function handleRevenueCatPublicRoutes<TRuntime extends RevenueCatRuntime>(
  context: RevenueCatRouteExecutionContext<TRuntime>,
  deps: RevenueCatRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta } = context;
  if (method !== "POST" || pathname !== "/v1/webhooks/revenuecat") {
    return false;
  }

  const authorizationHeader =
    typeof request.headers.authorization === "string"
      ? request.headers.authorization
      : undefined;
  if (
    !verifyRevenueCatWebhookSecret(
      authorizationHeader,
      runtime.config.revenuecatWebhookSecret
    )
  ) {
    deps.sendJson(response, 401, {
      error: "unauthorized",
      error_message: "Invalid RevenueCat webhook secret."
    });
    return true;
  }

  const payload = await deps.readJsonBody<unknown>(request);
  const parsedEvent = parseRevenueCatWebhookEvent(payload);
  if (!parsedEvent) {
    deps.sendJson(response, 422, {
      error: "validation_failed",
      error_message: "Invalid RevenueCat webhook payload."
    });
    return true;
  }

  const directUser = await runtime.store.findUserById(parsedEvent.appUserId);
  const mappedUserId = directUser
    ? directUser.id
    : await runtime.store.findUserIdByRevenuecatAppUserId(parsedEvent.appUserId);
  if (!mappedUserId) {
    deps.logWarn("RevenueCat webhook user not found", {
      route: pathname,
      event_type: parsedEvent.eventType,
      revenuecat_user_id_hash: hashRevenueCatAppUserId(parsedEvent.appUserId)
    });
    deps.sendJson(response, 202, {
      status: "ignored",
      reason: "user_not_found"
    });
    return true;
  }

  const current = await runtime.store.getUserSubscription(mappedUserId);
  const next = applyWebhookEventToSubscription(
    current,
    parsedEvent.eventType,
    parsedEvent.billingPeriodEnd
  );
  const updated = await runtime.store.upsertUserSubscription({
    userId: mappedUserId,
    tier: next.tier,
    billingPeriodEnd: next.billingPeriodEnd,
    revenuecatAppUserId: parsedEvent.appUserId,
    updatedAt: new Date().toISOString()
  });

  await deps.appendAudit(
    runtime,
    "subscription.webhook_processed",
    {
      request_id: meta.requestId,
      route: pathname,
      event_type: parsedEvent.eventType,
      tier: updated.tier,
      billing_period_end: updated.billingPeriodEnd,
      revenuecat_user_id_hash: hashRevenueCatAppUserId(parsedEvent.appUserId)
    },
    mappedUserId
  );

  deps.sendJson(response, 200, {
    status: "ok"
  });
  return true;
}

export async function handleRevenueCatRoutes<TRuntime extends RevenueCatRuntime>(
  context: RevenueCatRouteExecutionContext<TRuntime>,
  deps: RevenueCatRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta, auth } = context;
  if (!auth || method !== "POST" || pathname !== "/v1/user/sync-tier") {
    return false;
  }

  const body = await deps.readJsonBody<{ revenuecat_app_user_id?: string }>(request);
  const existing = await runtime.store.getUserSubscription(auth.userId);
  const requestedAppUserId = body.revenuecat_app_user_id?.trim();
  const allowedAppUserIds = new Set<string>([auth.userId]);
  if (existing.revenuecatAppUserId) {
    allowedAppUserIds.add(existing.revenuecatAppUserId);
  }
  if (requestedAppUserId && !allowedAppUserIds.has(requestedAppUserId)) {
    deps.sendJson(response, 403, {
      error: "forbidden",
      error_message: "revenuecat_app_user_id is not bound to the authenticated user."
    });
    return true;
  }

  const appUserId =
    requestedAppUserId ||
    existing.revenuecatAppUserId ||
    auth.userId;

  let snapshot;
  try {
    snapshot = await fetchRevenueCatSubscriberSnapshot(runtime.config, appUserId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync tier.";
    deps.sendJson(response, 503, {
      error: "sync_unavailable",
      error_message: message
    });
    return true;
  }

  const updated = await runtime.store.upsertUserSubscription({
    userId: auth.userId,
    tier: snapshot.tier,
    billingPeriodEnd: snapshot.billingPeriodEnd,
    revenuecatAppUserId: snapshot.appUserId,
    updatedAt: new Date().toISOString()
  });

  const profile = await deps.buildUserProfile(runtime, auth.userId);
  if (!profile) {
    deps.sendJson(response, 404, {
      error: "user_not_found",
      error_message: "User not found."
    });
    return true;
  }

  await deps.appendAudit(
    runtime,
    "subscription.sync_tier_completed",
    {
      request_id: meta.requestId,
      route: pathname,
      tier: updated.tier,
      billing_period_end: updated.billingPeriodEnd,
      revenuecat_user_id_hash: hashRevenueCatAppUserId(snapshot.appUserId)
    },
    auth.userId
  );

  deps.sendJson(response, 200, {
    data: profile
  });
  return true;
}
