// End-of-day prices come only from the data service (GET /v1/market/eod-prices),
// which hides the licensed provider behind PRICE_PROVIDER. Missing prices are normal:
// with the default provider "none" every ticker is unavailable.

interface EodPriceEntry {
  ticker: string;
  available: boolean;
  close?: number;
  reason?: string;
}

interface EodPricesEnvelope {
  data?: {
    prices?: EodPriceEntry[];
  };
}

const PRICE_REQUEST_TIMEOUT_MS = 5_000;
// Matches the data service's per-request limit and ticker format.
const MAX_TICKERS_PER_REQUEST = 50;
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

async function fetchEodPriceEntries(
  priceServiceBaseUrl: string,
  symbols: string[]
): Promise<EodPriceEntry[]> {
  const uniqueSymbols = [
    ...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter((symbol) => TICKER_PATTERN.test(symbol)))
  ];
  const entries: EodPriceEntry[] = [];
  for (let start = 0; start < uniqueSymbols.length; start += MAX_TICKERS_PER_REQUEST) {
    const url = new URL(`${priceServiceBaseUrl.replace(/\/$/, "")}/v1/market/eod-prices`);
    url.searchParams.set("tickers", uniqueSymbols.slice(start, start + MAX_TICKERS_PER_REQUEST).join(","));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(PRICE_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new Error(`EOD price request failed: HTTP ${response.status}`);
    }
    const payload = (await response.json()) as EodPricesEnvelope;
    entries.push(...(payload.data?.prices ?? []));
  }
  return entries;
}

function availableClose(entry: EodPriceEntry | undefined): number | undefined {
  return entry?.available && typeof entry.close === "number" && Number.isFinite(entry.close)
    ? entry.close
    : undefined;
}

export async function fetchLatestClosePrice(
  priceServiceBaseUrl: string,
  symbol: string
): Promise<number | undefined> {
  const [entry] = await fetchEodPriceEntries(priceServiceBaseUrl, [symbol]);
  const close = availableClose(entry);
  if (close === undefined) {
    throw new Error(`EOD price unavailable for ${symbol}: ${entry?.reason ?? "missing"}`);
  }
  return close;
}

// Never throws: an unreachable data service means "no prices", like the default provider.
export async function fetchLatestClosePrices(
  priceServiceBaseUrl: string,
  symbols: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  let entries: EodPriceEntry[];
  try {
    entries = await fetchEodPriceEntries(priceServiceBaseUrl, symbols);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const close = availableClose(entry);
    if (close !== undefined) {
      results.set(entry.ticker.toUpperCase(), close);
    }
  }
  return results;
}
