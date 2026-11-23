// Feature "tickers": ticker search and the public coverage list. Owner: M1.
// Ported from apps/product-api/src/server.ts (/tickers/search, /tickers) and routes/coverage-routes.ts.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import {
  isCoveredTicker,
  listCoveredTickers,
  searchTickers,
  TICKER_PATTERN,
  type TickerSearchResult,
} from "../../../_lib/store/tickers.ts";
import { bucketOf, generalLimit, type Limiter, validationFailed } from "../user/http.ts";

export interface TickersDeps {
  limit: Limiter;
  search(query: string, limit: number): Promise<TickerSearchResult[]>;
  listCovered(): Promise<string[]>;
  isCovered(ticker: string): Promise<boolean>;
}

export const pgTickersDeps: TickersDeps = {
  limit: generalLimit,
  search: searchTickers,
  listCovered: () => listCoveredTickers(),
  isCovered: isCoveredTicker,
};

export const SEARCH_LIMIT = 25;

export function tickersRoutes(deps: TickersDeps = pgTickersDeps): Route[] {
  const search = async ({ req, url, path }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query) return validationFailed("query parameter q is required.");
    const results = await deps.search(query, SEARCH_LIMIT);
    if (results.length === 0) {
      return apiError(404, "ticker_not_found", "Ticker not found in supported NYSE/NASDAQ universe.");
    }
    return json({ data: results });
  };

  // Public: the list of covered companies is not sensitive.
  const coverage = async ({ req, url, path }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
    if (ticker !== undefined) {
      if (!TICKER_PATTERN.test(ticker)) return validationFailed("ticker must be a valid US symbol.");
      return json({ data: { ticker, is_covered: await deps.isCovered(ticker) } });
    }
    const tickers = await deps.listCovered();
    return json({ data: { count: tickers.length, tickers } });
  };

  return [
    { method: "GET", path: "/tickers/search", auth: "user", handler: search },
    { method: "GET", path: "/tickers", auth: "user", handler: search },
    { method: "GET", path: "/v1/coverage", auth: "none", handler: coverage },
  ];
}

export const feature: FeatureModule = {
  name: "tickers",
  owner: "M1",
  routes: tickersRoutes(),
};
