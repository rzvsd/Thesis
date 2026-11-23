// Feature "watchlist". Owner: M1. Ported from apps/product-api/src/server.ts (GET/POST /watchlist,
// DELETE /watchlist/:ticker).
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { getUserTier, type Tier } from "../../../_lib/store/users.ts";
import { isSupportedTicker, normalizeTicker } from "../../../_lib/store/tickers.ts";
import {
  addWatchlistTicker,
  listWatchlistTickers,
  removeWatchlistTicker,
} from "../../../_lib/store/watchlist.ts";
import { upgradeRequiredBody, watchlistLimitForTier } from "../../../_lib/store/profile_limits.ts";
import { generalLimit, type Limiter, readJsonBody, validationFailed } from "../user/http.ts";

export interface WatchlistDeps {
  limit: Limiter;
  list(userId: string): Promise<string[]>;
  add(userId: string, ticker: string): Promise<string[]>;
  remove(userId: string, ticker: string): Promise<string[]>;
  isSupported(ticker: string): Promise<boolean>;
  tier(userId: string): Promise<Tier>;
}

export const pgWatchlistDeps: WatchlistDeps = {
  limit: generalLimit,
  list: listWatchlistTickers,
  add: addWatchlistTicker,
  remove: removeWatchlistTicker,
  isSupported: isSupportedTicker,
  tier: getUserTier,
};

const BAD_TICKER = "ticker must be a valid US symbol.";

export function watchlistRoutes(deps: WatchlistDeps = pgWatchlistDeps): Route[] {
  // Old rate-limit buckets: "/watchlist" and "/watchlist/:ticker".
  const list = async ({ req, auth }: RouteContext) => {
    const limited = await deps.limit(req, "/watchlist");
    if (limited) return limited;
    return json({ data: await deps.list(auth.userId!) });
  };

  const add = async ({ req, auth }: RouteContext) => {
    const limited = await deps.limit(req, "/watchlist");
    if (limited) return limited;
    const userId = auth.userId!;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const ticker = normalizeTicker(read.body.ticker);
    if (!ticker) return validationFailed(BAD_TICKER);
    if (!(await deps.isSupported(ticker))) {
      return apiError(404, "ticker_not_found", "Ticker not found in supported NYSE/NASDAQ universe.");
    }
    const current = await deps.list(userId);
    const tier = await deps.tier(userId);
    const cap = watchlistLimitForTier(tier);
    if (!current.includes(ticker) && current.length >= cap) {
      return json(
        upgradeRequiredBody("watchlist_cap", `Watchlist limit reached for ${tier} tier (${cap}).`),
        403,
      );
    }
    return json({ data: await deps.add(userId, ticker) });
  };

  const remove = async ({ req, auth, params }: RouteContext) => {
    const limited = await deps.limit(req, "/watchlist/:ticker");
    if (limited) return limited;
    const ticker = normalizeTicker(params.ticker);
    if (!ticker) return validationFailed(BAD_TICKER);
    return json({ data: await deps.remove(auth.userId!, ticker) });
  };

  return [
    { method: "GET", path: "/watchlist", auth: "user", handler: list },
    { method: "POST", path: "/watchlist", auth: "user", handler: add },
    { method: "DELETE", path: "/watchlist/:ticker", auth: "user", handler: remove },
  ];
}

export const feature: FeatureModule = {
  name: "watchlist",
  owner: "M1",
  routes: watchlistRoutes(),
};
