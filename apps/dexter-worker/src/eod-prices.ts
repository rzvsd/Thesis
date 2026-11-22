// End-of-day prices come only from the data service (GET /v1/market/eod-prices),
// which hides the licensed provider behind PRICE_PROVIDER. With the default provider
// "none" every ticker is unavailable and callers omit price-dependent output.

export interface ClosePricePair {
  previousClose?: number;
  latestClose: number;
}

interface EodPriceEntry {
  ticker: string;
  available: boolean;
  close?: number;
  previous_close?: number;
}

const PRICE_REQUEST_TIMEOUT_MS = 2_000;

// Never throws: an unreachable data service means "no prices".
export async function fetchEodPricePairs(
  priceServiceBaseUrl: string,
  tickers: string[]
): Promise<Map<string, ClosePricePair>> {
  const results = new Map<string, ClosePricePair>();
  if (tickers.length === 0) {
    return results;
  }
  try {
    const url = new URL(`${priceServiceBaseUrl.replace(/\/$/, "")}/v1/market/eod-prices`);
    url.searchParams.set("tickers", tickers.join(","));
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(PRICE_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      return results;
    }
    const payload = (await response.json()) as { data?: { prices?: EodPriceEntry[] } };
    for (const entry of payload.data?.prices ?? []) {
      if (!entry.available || typeof entry.close !== "number" || !Number.isFinite(entry.close)) {
        continue;
      }
      results.set(entry.ticker.toUpperCase(), {
        latestClose: entry.close,
        ...(typeof entry.previous_close === "number" && Number.isFinite(entry.previous_close)
          ? { previousClose: entry.previous_close }
          : {})
      });
    }
  } catch {
    return results;
  }
  return results;
}
