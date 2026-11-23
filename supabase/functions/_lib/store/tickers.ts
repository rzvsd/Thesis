// Ticker registry and coverage reads. Owner of this module: M1. Tables ticker_registry and
// ticker_coverage belong to M3; this module only reads them. SQL from PostgresStore in apps/product-api.
import { db } from "./common.ts";

export const TICKER_PATTERN = /^[A-Z.-]{1,12}$/;

// Trim, upper-case and check against the US symbol pattern. Undefined when not valid.
export function normalizeTicker(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ticker = value.trim().toUpperCase();
  return ticker && TICKER_PATTERN.test(ticker) ? ticker : undefined;
}

export interface TickerSearchResult {
  symbol: string;
  company_name: string;
  exchange: "NASDAQ" | "NYSE";
}

export async function searchTickers(query: string, limit: number): Promise<TickerSearchResult[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];
  const likeValue = `%${normalized}%`;
  const symbolPrefix = `${normalized}%`;
  const rows = await db()`
    select symbol, company_name, exchange
      from ticker_registry
     where is_supported = true
       and listing_status = 'active'
       and (upper(symbol) like ${likeValue} or upper(company_name) like ${likeValue})
     order by
       case
         when upper(symbol) = ${normalized} then 0
         when upper(symbol) like ${symbolPrefix} then 1
         else 2
       end,
       symbol asc
     limit ${limit}`;
  return rows.map((row) => ({
    symbol: String(row.symbol),
    company_name: String(row.company_name),
    exchange: String(row.exchange) as TickerSearchResult["exchange"],
  }));
}

export async function isSupportedTicker(symbol: string): Promise<boolean> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return false;
  const rows = await db()`
    select 1 from ticker_registry
     where symbol = ${normalized}
       and is_supported = true
       and listing_status = 'active'`;
  return rows.length > 0;
}

// One query for many symbols (holdings import). Returns the supported ones.
export async function supportedTickers(symbols: string[]): Promise<Set<string>> {
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0))];
  if (list.length === 0) return new Set();
  const rows = await db()`
    select symbol from ticker_registry
     where symbol = any(${list}::text[])
       and is_supported = true
       and listing_status = 'active'`;
  return new Set(rows.map((row) => String(row.symbol)));
}

// Covered = the historical sync ingested the ticker (old deep-dive-precompute.ts).
const COVERED_SYNC_STATUSES = new Set(["success", "partial"]);
export const COVERAGE_LIST_LIMIT = 10_000;

export async function listCoveredTickers(limit = COVERAGE_LIST_LIMIT): Promise<string[]> {
  const bounded = Math.max(1, limit);
  const rows = await db()`
    select ticker
      from ticker_coverage
     where last_sync_status in ('success', 'partial')
     order by backfill_tier asc, ticker asc
     limit ${bounded}`;
  return rows.map((row) => String(row.ticker).trim().toUpperCase());
}

export async function isCoveredTicker(ticker: string): Promise<boolean> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return false;
  const rows = await db()`select last_sync_status from ticker_coverage where ticker = ${normalized}`;
  return rows.length > 0 && COVERED_SYNC_STATUSES.has(String(rows[0].last_sync_status));
}
