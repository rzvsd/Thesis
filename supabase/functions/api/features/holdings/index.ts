// Feature "holdings": research holdings list, upsert, delete and CSV import. Owner: M1.
// Ported from apps/product-api/src/routes/research-state-routes.ts and routes/holdings-import-routes.ts.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { getUserTier, type Tier } from "../../../_lib/store/users.ts";
import { isSupportedTicker, normalizeTicker, supportedTickers } from "../../../_lib/store/tickers.ts";
import { addWatchlistTicker, listWatchlistTickers } from "../../../_lib/store/watchlist.ts";
import {
  deleteHolding,
  type HoldingInput,
  type HoldingRecord,
  listHoldings,
  toHoldingView,
  upsertHolding,
} from "../../../_lib/store/holdings.ts";
import { bucketOf, generalLimit, type Limiter, readJsonBody, validationFailed } from "../user/http.ts";
import { importHoldingsCsv } from "./import.ts";

export interface HoldingsDeps {
  limit: Limiter;
  list(userId: string): Promise<HoldingRecord[]>;
  upsert(userId: string, input: HoldingInput): Promise<HoldingRecord>;
  remove(userId: string, ticker: string): Promise<boolean>;
  isSupported(ticker: string): Promise<boolean>;
  supported(tickers: string[]): Promise<Set<string>>;
  watchlist(userId: string): Promise<string[]>;
  follow(userId: string, ticker: string): Promise<string[]>;
  tier(userId: string): Promise<Tier>;
}

export const pgHoldingsDeps: HoldingsDeps = {
  limit: generalLimit,
  list: listHoldings,
  upsert: upsertHolding,
  remove: deleteHolding,
  isSupported: isSupportedTicker,
  supported: supportedTickers,
  watchlist: listWatchlistTickers,
  follow: addWatchlistTicker,
  tier: getUserTier,
};

const BAD_TICKER = "ticker must be a valid US symbol.";

function badAmount(value: unknown): boolean {
  return value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function holdingsRoutes(deps: HoldingsDeps = pgHoldingsDeps): Route[] {
  const list = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const holdings = await deps.list(auth.userId!);
    return json({ data: holdings.map(toHoldingView) });
  };

  const upsert = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const body = read.body;
    const ticker = normalizeTicker(body.ticker);
    if (!ticker) return validationFailed(BAD_TICKER);
    if (!(await deps.isSupported(ticker))) {
      return apiError(404, "ticker_not_found", "Ticker not found in supported NYSE/NASDAQ universe.");
    }
    if (badAmount(body.quantity)) {
      return validationFailed("quantity must be a non-negative number when provided.");
    }
    if (badAmount(body.cost_basis)) {
      return validationFailed("cost_basis must be a non-negative number when provided.");
    }
    const holding = await deps.upsert(auth.userId!, {
      ticker,
      quantity: body.quantity as number | undefined,
      costBasis: body.cost_basis as number | undefined,
      label: optionalText(body.label),
      notes: optionalText(body.notes),
    });
    return json({ data: toHoldingView(holding) });
  };

  // No data wrapper on this one: { deleted: boolean }.
  const remove = async ({ req, path, auth, params }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const ticker = normalizeTicker(params.ticker);
    if (!ticker) return validationFailed(BAD_TICKER);
    return json({ deleted: await deps.remove(auth.userId!, ticker) });
  };

  const importCsv = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const csv = read.body.csv;
    if (typeof csv !== "string" || csv.trim().length === 0) {
      return validationFailed(
        "csv must be a non-empty string with columns ticker, shares and optional cost_basis.",
      );
    }
    const result = await importHoldingsCsv(auth.userId!, csv, deps);
    if ("errorMessage" in result) return validationFailed(result.errorMessage);
    return json({ data: result });
  };

  return [
    { method: "GET", path: "/v1/user/holdings", auth: "user", handler: list },
    { method: "POST", path: "/v1/user/holdings", auth: "user", handler: upsert },
    { method: "POST", path: "/v1/user/holdings/import", auth: "user", handler: importCsv },
    { method: "DELETE", path: "/v1/user/holdings/:ticker", auth: "user", handler: remove },
  ];
}

export const feature: FeatureModule = {
  name: "holdings",
  owner: "M1",
  routes: holdingsRoutes(),
};
