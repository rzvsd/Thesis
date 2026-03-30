interface YahooChartResponse {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

function latestFinite(values: Array<number | null> | undefined): number | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export async function fetchLatestClosePrice(
  yahooBaseUrl: string,
  symbol: string
): Promise<number | undefined> {
  const url = new URL(
    `${yahooBaseUrl.replace(/\/$/, "")}/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${symbol}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const close = payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  const latest = latestFinite(close);
  if (latest === undefined) {
    throw new Error(`Yahoo close series missing for ${symbol}`);
  }
  return latest;
}

export async function fetchLatestClosePrices(
  yahooBaseUrl: string,
  symbols: string[],
  concurrency = 8
): Promise<Map<string, number>> {
  const normalizedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);
  const uniqueSymbols = [...new Set(normalizedSymbols)];
  const maxWorkers = Math.max(1, Math.min(concurrency, uniqueSymbols.length));
  const results = new Map<string, number>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < uniqueSymbols.length) {
      const index = cursor;
      cursor += 1;
      const symbol = uniqueSymbols[index];
      if (!symbol) {
        continue;
      }
      try {
        const latest = await fetchLatestClosePrice(yahooBaseUrl, symbol);
        if (latest !== undefined) {
          results.set(symbol, latest);
        }
      } catch {
        continue;
      }
    }
  }

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  return results;
}

