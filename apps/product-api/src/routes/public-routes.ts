import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { ProductApiConfig } from "../config";
import type { ProductStore } from "../store";
import type { UserSubscriptionRecord } from "../types";

interface PublicRuntime {
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

interface RevenueCatEvent {
  eventType: string;
  appUserId: string;
  billingPeriodEnd?: string;
}

export interface PublicRouteExecutionContext<TRuntime extends PublicRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
  url: URL;
}

export interface PublicRouteDependencies<TRuntime extends PublicRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  applyWebhookEventToSubscription: (
    current: UserSubscriptionRecord,
    eventType: string,
    billingPeriodEnd?: string
  ) => SubscriptionProjection;
  authenticateAccessToken: (
    runtime: TRuntime,
    request: IncomingMessage
  ) => Promise<AuthContext | undefined>;
  hasInternalToken: (request: IncomingMessage, expectedToken: string) => boolean;
  hashRevenueCatAppUserId: (appUserId: string) => string;
  logWarn: (message: string, payload?: Record<string, unknown>) => void;
  parseRevenueCatWebhookEvent: (payload: unknown) => RevenueCatEvent | undefined;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  verifyRevenueCatWebhookSecret: (
    authorizationHeader: string | undefined,
    expectedSecret: string | undefined
  ) => boolean;
}

export async function handlePublicRoutes<TRuntime extends PublicRuntime>(
  context: PublicRouteExecutionContext<TRuntime>,
  deps: PublicRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta, url } = context;

  if (
    method === "GET" &&
    (pathname === "/v1/historical/financials" ||
      pathname === "/v1/historical/transcripts" ||
      pathname === "/v1/historical/coverage")
  ) {
    const internalRequest = deps.hasInternalToken(request, runtime.config.internalWorkerToken);
    const historicalAuth = internalRequest
      ? undefined
      : await deps.authenticateAccessToken(runtime, request);
    if (!internalRequest && !historicalAuth) {
      deps.sendJson(response, 401, {
        error: "unauthorized",
        error_message: "Authentication required."
      });
      return true;
    }

    const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
    if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "ticker query parameter is required and must be a valid US symbol."
      });
      return true;
    }

    if (pathname === "/v1/historical/financials") {
      const snapshots = await runtime.store.listHistoricalFinancialSnapshotsByTicker(ticker);
      await deps.appendAudit(
        runtime,
        "historical.financials_retrieved",
        {
          request_id: meta.requestId,
          route: pathname,
          ticker,
          internal_request: internalRequest,
          row_count: snapshots.length
        },
        historicalAuth?.userId
      );
      deps.sendJson(response, 200, {
        data: snapshots,
        missing: snapshots.length === 0
      });
      return true;
    }

    if (pathname === "/v1/historical/transcripts") {
      const transcripts = await runtime.store.listHistoricalTranscriptsByTicker(ticker);
      await deps.appendAudit(
        runtime,
        "historical.transcripts_retrieved",
        {
          request_id: meta.requestId,
          route: pathname,
          ticker,
          internal_request: internalRequest,
          row_count: transcripts.length
        },
        historicalAuth?.userId
      );
      deps.sendJson(response, 200, {
        data: transcripts,
        missing: transcripts.length === 0
      });
      return true;
    }

    const coverage = await runtime.store.getTickerCoverageByTicker(ticker);
    await deps.appendAudit(
      runtime,
      "historical.coverage_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        ticker,
        internal_request: internalRequest,
        found: Boolean(coverage)
      },
      historicalAuth?.userId
    );
    deps.sendJson(response, 200, {
      data: coverage ?? null,
      missing: coverage === undefined
    });
    return true;
  }

  if (method === "POST" && pathname === "/v1/webhooks/revenuecat") {
    const authorizationHeader =
      typeof request.headers.authorization === "string"
        ? request.headers.authorization
        : undefined;
    if (
      !deps.verifyRevenueCatWebhookSecret(
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
    const parsedEvent = deps.parseRevenueCatWebhookEvent(payload);
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
        revenuecat_user_id_hash: deps.hashRevenueCatAppUserId(parsedEvent.appUserId)
      });
      deps.sendJson(response, 202, {
        status: "ignored",
        reason: "user_not_found"
      });
      return true;
    }

    const current = await runtime.store.getUserSubscription(mappedUserId);
    const next = deps.applyWebhookEventToSubscription(
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
        revenuecat_user_id_hash: deps.hashRevenueCatAppUserId(parsedEvent.appUserId)
      },
      mappedUserId
    );

    deps.sendJson(response, 200, {
      status: "ok"
    });
    return true;
  }

  return false;
}
