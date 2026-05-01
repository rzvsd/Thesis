import type { IncomingMessage, ServerResponse } from "node:http";

import type { UserResearchHolding } from "../../../../packages/contracts/src";
import type { ArtifactStore } from "../artifact-store";
import type { ProductApiConfig } from "../config";
import { refreshUserResearchStates } from "../research-state";
import type { ProductStore } from "../store";

interface ResearchStateRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  artifactStore: ArtifactStore;
}

interface RequestMeta {
  requestId: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface ResearchStateRouteExecutionContext<TRuntime extends ResearchStateRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
  auth?: AuthContext;
}

export interface ResearchStateRouteDependencies<TRuntime extends ResearchStateRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  dateInTimeZone: (date: Date, timeZone: string) => string;
  normalizeDateInput: (value: string) => string | undefined;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
}

function toHoldingView(holding: {
  ticker: string;
  quantity?: number;
  costBasis?: number;
  label?: string;
  notes?: string;
  updatedAt: string;
}): UserResearchHolding {
  return {
    ticker: holding.ticker,
    ...(holding.quantity !== undefined ? { quantity: holding.quantity } : {}),
    ...(holding.costBasis !== undefined ? { cost_basis: holding.costBasis } : {}),
    ...(holding.label ? { label: holding.label } : {}),
    ...(holding.notes ? { notes: holding.notes } : {}),
    updated_at: holding.updatedAt
  };
}

function normalizeTicker(value: string | undefined): string | undefined {
  const ticker = value?.trim().toUpperCase();
  return ticker && /^[A-Z.-]{1,12}$/.test(ticker) ? ticker : undefined;
}

export async function handleInternalResearchStateRoutes<TRuntime extends ResearchStateRuntime>(
  context: ResearchStateRouteExecutionContext<TRuntime>,
  deps: ResearchStateRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta } = context;
  if (method !== "POST" || pathname !== "/internal/research-state/refresh") {
    return false;
  }

  const body = await deps.readJsonBody<{ as_of?: string; user_ids?: string[]; dry_run?: boolean }>(request);
  const asOfDate =
    deps.normalizeDateInput(
      body.as_of ?? deps.dateInTimeZone(new Date(), runtime.config.subscriptionTimezone)
    ) ?? deps.dateInTimeZone(new Date(), runtime.config.subscriptionTimezone);
  const userIds = Array.isArray(body.user_ids)
    ? body.user_ids
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : undefined;

  const result = await refreshUserResearchStates({
    store: runtime.store,
    artifactStore: runtime.artifactStore,
    asOf: asOfDate,
    userIds,
    dryRun: body.dry_run === true
  });

  await deps.appendAudit(runtime, "research_state.refreshed", {
    request_id: meta.requestId,
    route: pathname,
    as_of: asOfDate,
    users: result.users,
    names: result.names,
    created: result.created,
    updated: result.updated,
    omissions: result.omissions,
    dry_run: result.dry_run
  });

  deps.sendJson(response, 200, {
    status: "ok",
    as_of: asOfDate,
    users: result.users,
    names: result.names,
    created: result.created,
    updated: result.updated,
    omissions: result.omissions,
    dry_run: result.dry_run,
    states: result.dry_run ? result.states : undefined
  });
  return true;
}

export async function handleResearchStateRoutes<TRuntime extends ResearchStateRuntime>(
  context: ResearchStateRouteExecutionContext<TRuntime>,
  deps: ResearchStateRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta, auth } = context;
  if (!auth) {
    return false;
  }

  if (method === "GET" && pathname === "/v1/user/holdings") {
    const holdings = await runtime.store.listUserResearchHoldings(auth.userId);
    deps.sendJson(response, 200, {
      data: holdings.map(toHoldingView)
    });
    return true;
  }

  if (method === "POST" && pathname === "/v1/user/holdings") {
    const body = await deps.readJsonBody<{
      ticker?: string;
      quantity?: number;
      cost_basis?: number;
      label?: string;
      notes?: string;
    }>(request);
    const ticker = normalizeTicker(body.ticker);
    if (!ticker) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "ticker must be a valid US symbol."
      });
      return true;
    }

    const supportedTicker = await runtime.store.getSupportedTicker(ticker);
    if (!supportedTicker) {
      deps.sendJson(response, 404, {
        error: "ticker_not_found",
        error_message: "Ticker not found in supported NYSE/NASDAQ universe."
      });
      return true;
    }
    if (body.quantity !== undefined && (!Number.isFinite(body.quantity) || body.quantity < 0)) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "quantity must be a non-negative number when provided."
      });
      return true;
    }
    if (body.cost_basis !== undefined && (!Number.isFinite(body.cost_basis) || body.cost_basis < 0)) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "cost_basis must be a non-negative number when provided."
      });
      return true;
    }

    const holding = await runtime.store.upsertUserResearchHolding({
      userId: auth.userId,
      ticker,
      quantity: body.quantity,
      costBasis: body.cost_basis,
      label: body.label?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      updatedAt: new Date().toISOString()
    });
    await deps.appendAudit(runtime, "research_holding.upserted", {
      request_id: meta.requestId,
      route: pathname,
      ticker
    }, auth.userId);
    deps.sendJson(response, 200, {
      data: toHoldingView(holding)
    });
    return true;
  }

  if (method === "DELETE" && pathname.startsWith("/v1/user/holdings/")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 4) {
      deps.sendJson(response, 404, { status: "not_found" });
      return true;
    }
    const ticker = normalizeTicker(parts[3]);
    if (!ticker) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "ticker must be a valid US symbol."
      });
      return true;
    }
    const deleted = await runtime.store.deleteUserResearchHolding(auth.userId, ticker);
    await deps.appendAudit(runtime, "research_holding.deleted", {
      request_id: meta.requestId,
      route: pathname,
      ticker,
      deleted
    }, auth.userId);
    deps.sendJson(response, 200, { deleted });
    return true;
  }

  return false;
}
