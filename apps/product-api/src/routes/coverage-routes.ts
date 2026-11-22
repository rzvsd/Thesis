import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { ProductApiConfig } from "../config";
import { isCoveredTicker, listCoveredTickers, runDeepDivePrecompute } from "../deep-dive-precompute";
import type { JobQueue } from "../queue";
import type { ProductStore } from "../store";

interface CoverageRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  queue: JobQueue;
}

export interface CoverageRouteContext<TRuntime extends CoverageRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  url: URL;
}

export interface CoverageRouteDependencies {
  hasInternalToken: (request: IncomingMessage, expectedToken: string) => boolean;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  deepDiveFingerprint: (ticker: string, latestPeriod?: string) => string;
}

export async function handleCoverageRoutes<TRuntime extends CoverageRuntime>(
  context: CoverageRouteContext<TRuntime>,
  deps: CoverageRouteDependencies
): Promise<boolean> {
  const { method, pathname, request, response, runtime, url } = context;

  // Public source of truth for which companies are covered (no auth: the list is not sensitive).
  if (method === "GET" && pathname === "/v1/coverage") {
    const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
    if (ticker !== undefined) {
      if (!/^[A-Z.-]{1,12}$/.test(ticker)) {
        deps.sendJson(response, 422, {
          error: "validation_failed",
          error_message: "ticker must be a valid US symbol."
        });
        return true;
      }
      deps.sendJson(response, 200, {
        data: { ticker, is_covered: await isCoveredTicker(runtime.store, ticker) }
      });
      return true;
    }
    const tickers = await listCoveredTickers(runtime.store);
    deps.sendJson(response, 200, { data: { count: tickers.length, tickers } });
    return true;
  }

  if (method === "POST" && pathname === "/internal/deep-dive/precompute") {
    if (!deps.hasInternalToken(request, runtime.config.internalWorkerToken)) {
      deps.sendJson(response, 401, { error: "unauthorized", error_message: "Internal token required." });
      return true;
    }
    const result = await runDeepDivePrecompute(runtime, deps.deepDiveFingerprint);
    deps.sendJson(response, 200, {
      status: "accepted",
      queued: result.queued.length,
      in_flight: result.in_flight,
      jobs: result.queued
    });
    return true;
  }

  return false;
}
