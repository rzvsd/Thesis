import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { ProductApiConfig } from "../config";
import type { ProductStore } from "../store";

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
  authenticateAccessToken: (
    runtime: TRuntime,
    request: IncomingMessage
  ) => Promise<AuthContext | undefined>;
  hasInternalToken: (request: IncomingMessage, expectedToken: string) => boolean;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
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
      pathname === "/v1/historical/filing-sections" ||
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

    if (pathname === "/v1/historical/filing-sections") {
      // Reviewed 10-Q/10-K section excerpts (M11), read through data-openbb from SEC EDGAR.
      let filings: unknown[] = [];
      let unavailableReason: string | undefined;
      try {
        const upstream = await fetch(
          `${runtime.config.marketPulseDataOpenbbBaseUrl}/v1/official/filing-sections?ticker=${encodeURIComponent(ticker)}`,
          { headers: { "x-request-id": meta.requestId } }
        );
        const payload = (await upstream.json()) as { ok?: boolean; data?: { filings?: unknown }; error_message?: string };
        if (upstream.ok && payload.ok === true && Array.isArray(payload.data?.filings)) {
          filings = payload.data.filings;
        } else {
          unavailableReason = payload.error_message ?? `HTTP ${upstream.status}`;
        }
      } catch (error) {
        unavailableReason = error instanceof Error ? error.message : "network error";
      }
      await deps.appendAudit(
        runtime,
        "historical.filing_sections_retrieved",
        {
          request_id: meta.requestId,
          route: pathname,
          ticker,
          internal_request: internalRequest,
          row_count: filings.length,
          ...(unavailableReason ? { unavailable_reason: unavailableReason } : {})
        },
        historicalAuth?.userId
      );
      deps.sendJson(response, 200, {
        data: filings,
        missing: filings.length === 0
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

  return false;
}
