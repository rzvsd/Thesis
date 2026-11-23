// The holdings CSV import flow, ported from apps/product-api/src/routes/holdings-import-routes.ts.
// One change: supported tickers are looked up in one query instead of one query per row.
import { TICKER_PATTERN } from "../../../_lib/store/tickers.ts";
import { parseAmount, parseHoldingsCsv } from "../../../_lib/store/holdings_csv.ts";
import { watchlistLimitForTier } from "../../../_lib/store/profile_limits.ts";
import type { HoldingsDeps } from "./index.ts";

export interface RowError {
  line: number;
  ticker?: string;
  error: string;
  error_message: string;
}

export interface ImportResult {
  rows: number;
  imported: string[];
  newly_followed: string[];
  errors: RowError[];
  watchlist: string[];
}

type ImportDeps = Pick<HoldingsDeps, "list" | "upsert" | "supported" | "watchlist" | "follow" | "tier">;

export async function importHoldingsCsv(
  userId: string,
  csv: string,
  deps: ImportDeps,
): Promise<ImportResult | { errorMessage: string }> {
  const parsed = parseHoldingsCsv(csv);
  if (!parsed.ok) return { errorMessage: parsed.errorMessage };
  const { rows: lines, columns } = parsed;

  const [watchlist, tier, existingHoldings] = await Promise.all([
    deps.watchlist(userId),
    deps.tier(userId),
    deps.list(userId),
  ]);
  const candidates = lines
    .map(({ cells }) => (cells[columns.ticker] ?? "").trim().toUpperCase())
    .filter((t) => TICKER_PATTERN.test(t));
  const supported = await deps.supported(candidates);

  const nameLimit = watchlistLimitForTier(tier);
  const followed = new Set(watchlist.map((ticker) => ticker.toUpperCase()));
  const existingByTicker = new Map(existingHoldings.map((holding) => [holding.ticker, holding]));
  const seen = new Set<string>();
  const errors: RowError[] = [];
  const imported: string[] = [];
  const newlyFollowed: string[] = [];
  let currentWatchlist = watchlist;

  for (const { line, cells } of lines) {
    const rawTicker = cells[columns.ticker] ?? "";
    const ticker = rawTicker.trim().toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) {
      errors.push({
        line,
        ...(rawTicker ? { ticker: rawTicker } : {}),
        error: "invalid_ticker",
        error_message: "Ticker must be a valid US symbol.",
      });
      continue;
    }
    const shares = parseAmount(cells[columns.shares]);
    if (shares === undefined || shares === null) {
      errors.push({
        line,
        ticker,
        error: "invalid_shares",
        error_message: "Shares must be a non-negative number.",
      });
      continue;
    }
    const costBasis = columns.cost_basis >= 0 ? parseAmount(cells[columns.cost_basis]) : undefined;
    if (costBasis === null) {
      errors.push({
        line,
        ticker,
        error: "invalid_cost_basis",
        error_message: "Cost basis must be a non-negative number when provided.",
      });
      continue;
    }
    if (seen.has(ticker)) {
      errors.push({
        line,
        ticker,
        error: "duplicate_ticker",
        error_message: "Ticker appears more than once in this file.",
      });
      continue;
    }
    seen.add(ticker);

    if (!supported.has(ticker)) {
      errors.push({
        line,
        ticker,
        error: "ticker_not_found",
        error_message: "Ticker not found in supported NYSE/NASDAQ universe.",
      });
      continue;
    }

    if (!followed.has(ticker)) {
      if (followed.size >= nameLimit) {
        errors.push({
          line,
          ticker,
          error: "name_limit_reached",
          error_message:
            `Name limit reached for ${tier} tier (${nameLimit}). Holdings must be followed names.`,
        });
        continue;
      }
      currentWatchlist = await deps.follow(userId, ticker);
      followed.add(ticker);
      newlyFollowed.push(ticker);
    }

    const existing = existingByTicker.get(ticker);
    await deps.upsert(userId, {
      ticker,
      quantity: shares,
      costBasis: costBasis ?? existing?.costBasis,
      label: existing?.label,
      notes: existing?.notes,
    });
    imported.push(ticker);
  }

  return {
    rows: lines.length,
    imported,
    newly_followed: newlyFollowed,
    errors,
    watchlist: currentWatchlist,
  };
}
