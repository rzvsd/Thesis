// End-of-day prices (new in the rebuild, docs/rebuild/M3-design.md).
// The daily job asks which tickers to price, fetches closes, and posts them here.
// Evaluators read the latest close per ticker, at most 5 days old; missing means "no price".
import { logInfo } from "../../_shared/log.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok, validation } from "./result.ts";
import type { MarketPriceRow } from "./types.ts";
import { isPlainRecord, normalizeDateInput } from "./util.ts";

export const priceTickerLimit = 500;
export const priceMaxAgeDays = 5;
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;

export async function listPriceTickers(deps: EvaluatorDeps): Promise<EvalResult> {
  const tickers = (await deps.store.listPriceTickers(priceTickerLimit)).filter((t) => tickerPattern.test(t));
  return ok({ tickers });
}

// body: { market_date, prices: [{ ticker, available, close?, reason?, provider? }] }
export async function ingestPrices(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const marketDate = normalizeDateInput(body.market_date);
  if (!marketDate) return validation("market_date must be in YYYY-MM-DD format.");
  if (!Array.isArray(body.prices)) return validation("prices must be an array.");
  if (body.prices.length > 2_000) return validation("prices must have at most 2000 entries.");

  const nowIso = deps.now().toISOString();
  const rows = new Map<string, MarketPriceRow>();
  let unavailable = 0;
  let invalid = 0;
  for (const entry of body.prices) {
    if (!isPlainRecord(entry)) {
      invalid += 1;
      continue;
    }
    const ticker = typeof entry.ticker === "string" ? entry.ticker.trim().toUpperCase() : "";
    if (!tickerPattern.test(ticker)) {
      invalid += 1;
      continue;
    }
    const close = entry.close;
    if (entry.available !== true || typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      unavailable += 1;
      continue;
    }
    rows.set(ticker, {
      ticker,
      marketDate,
      close,
      provider: typeof entry.provider === "string" && entry.provider.trim() ? entry.provider.trim() : "eod",
      retrievedAt: typeof entry.retrieved_at === "string" && Number.isFinite(Date.parse(entry.retrieved_at))
        ? entry.retrieved_at
        : nowIso,
    });
  }
  const stored = await deps.store.upsertMarketPrices([...rows.values()]);
  const counts = { market_date: marketDate, stored, unavailable, invalid };
  await appendAudit(deps.store, "market_prices.ingested", { request_id: meta.requestId, route: meta.route, ...counts });
  logInfo("Market prices ingested", counts);
  return ok({ status: "ok", ...counts });
}

export async function latestPrices(
  deps: EvaluatorDeps,
  tickers: string[],
  asOfDate: string,
): Promise<Map<string, number>> {
  if (tickers.length === 0) return new Map();
  return await deps.store.latestClosePrices({ tickers, asOfDate, maxAgeDays: priceMaxAgeDays });
}
