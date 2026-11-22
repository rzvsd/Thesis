import type { IncomingMessage, ServerResponse } from "node:http";

import type { SubscriptionTier } from "../../../../packages/contracts/src";
import type { ProductStore } from "../store";

const IMPORT_PATH = "/v1/user/holdings/import";
const MAX_DATA_ROWS = 500;
const TICKER_PATTERN = /^[A-Z.-]{1,12}$/;

const HEADER_ALIASES: Record<"ticker" | "shares" | "cost_basis", string[]> = {
  ticker: ["ticker", "symbol"],
  shares: ["shares", "quantity", "qty"],
  cost_basis: ["cost_basis", "cost basis", "costbasis", "cost"]
};

interface HoldingsImportRuntime {
  store: ProductStore;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface HoldingsImportRouteExecutionContext<TRuntime extends HoldingsImportRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: { requestId: string };
  auth?: AuthContext;
}

export interface HoldingsImportRouteDependencies<TRuntime extends HoldingsImportRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  createId: () => string;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  watchlistLimitForTier: (tier: SubscriptionTier) => number;
}

interface RowError {
  line: number;
  ticker?: string;
  error: string;
  error_message: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

// Accepts "1,234.5" and "$170.20" as broker exports often write them.
function parseAmount(value: string | undefined): number | undefined | null {
  const cleaned = value?.replace(/[$,\s]/g, "") ?? "";
  if (cleaned.length === 0) {
    return undefined;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function findColumn(header: string[], field: keyof typeof HEADER_ALIASES): number {
  return header.findIndex((cell) => HEADER_ALIASES[field].includes(cell.toLowerCase()));
}

export async function handleHoldingsImportRoutes<TRuntime extends HoldingsImportRuntime>(
  context: HoldingsImportRouteExecutionContext<TRuntime>,
  deps: HoldingsImportRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta, auth } = context;
  if (!auth || method !== "POST" || pathname !== IMPORT_PATH) {
    return false;
  }

  const body = await deps.readJsonBody<{ csv?: unknown }>(request);
  if (typeof body.csv !== "string" || body.csv.trim().length === 0) {
    deps.sendJson(response, 422, {
      error: "validation_failed",
      error_message: "csv must be a non-empty string with columns ticker, shares and optional cost_basis."
    });
    return true;
  }

  const lines = body.csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, cells: splitCsvLine(text) }))
    .filter((row) => row.cells.some((cell) => cell.length > 0));

  let columns = { ticker: 0, shares: 1, cost_basis: 2 };
  const first = lines[0]?.cells ?? [];
  if (findColumn(first, "ticker") >= 0) {
    columns = {
      ticker: findColumn(first, "ticker"),
      shares: findColumn(first, "shares"),
      cost_basis: findColumn(first, "cost_basis")
    };
    if (columns.shares < 0) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "CSV header must include a shares (or quantity) column."
      });
      return true;
    }
    lines.shift();
  }

  if (lines.length > MAX_DATA_ROWS) {
    deps.sendJson(response, 422, {
      error: "validation_failed",
      error_message: `CSV may contain at most ${MAX_DATA_ROWS} holdings.`
    });
    return true;
  }

  const [watchlist, subscription, existingHoldings] = await Promise.all([
    runtime.store.listWatchlistTickersByUser(auth.userId),
    runtime.store.getUserSubscription(auth.userId),
    runtime.store.listUserResearchHoldings(auth.userId)
  ]);
  const nameLimit = deps.watchlistLimitForTier(subscription.tier);
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
      errors.push({ line, ...(rawTicker ? { ticker: rawTicker } : {}), error: "invalid_ticker", error_message: "Ticker must be a valid US symbol." });
      continue;
    }
    const shares = parseAmount(cells[columns.shares]);
    if (shares === undefined || shares === null) {
      errors.push({ line, ticker, error: "invalid_shares", error_message: "Shares must be a non-negative number." });
      continue;
    }
    const costBasis = columns.cost_basis >= 0 ? parseAmount(cells[columns.cost_basis]) : undefined;
    if (costBasis === null) {
      errors.push({ line, ticker, error: "invalid_cost_basis", error_message: "Cost basis must be a non-negative number when provided." });
      continue;
    }
    if (seen.has(ticker)) {
      errors.push({ line, ticker, error: "duplicate_ticker", error_message: "Ticker appears more than once in this file." });
      continue;
    }
    seen.add(ticker);

    if (!(await runtime.store.getSupportedTicker(ticker))) {
      errors.push({ line, ticker, error: "ticker_not_found", error_message: "Ticker not found in supported NYSE/NASDAQ universe." });
      continue;
    }

    if (!followed.has(ticker)) {
      if (followed.size >= nameLimit) {
        errors.push({
          line,
          ticker,
          error: "name_limit_reached",
          error_message: `Name limit reached for ${subscription.tier} tier (${nameLimit}). Holdings must be followed names.`
        });
        continue;
      }
      currentWatchlist = await runtime.store.addWatchlistTicker({
        id: deps.createId(),
        userId: auth.userId,
        ticker,
        addedAt: new Date().toISOString()
      });
      followed.add(ticker);
      newlyFollowed.push(ticker);
    }

    const existing = existingByTicker.get(ticker);
    await runtime.store.upsertUserResearchHolding({
      userId: auth.userId,
      ticker,
      quantity: shares,
      costBasis: costBasis ?? existing?.costBasis,
      label: existing?.label,
      notes: existing?.notes,
      updatedAt: new Date().toISOString()
    });
    imported.push(ticker);
  }

  await deps.appendAudit(runtime, "research_holding.csv_imported", {
    request_id: meta.requestId,
    route: pathname,
    rows: lines.length,
    imported: imported.length,
    newly_followed: newlyFollowed.length,
    errors: errors.length
  }, auth.userId);

  deps.sendJson(response, 200, {
    data: {
      rows: lines.length,
      imported,
      newly_followed: newlyFollowed,
      errors,
      watchlist: currentWatchlist
    }
  });
  return true;
}
