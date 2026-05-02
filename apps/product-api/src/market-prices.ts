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

export interface ClosePricePair {
  previousClose?: number;
  latestClose: number;
}

function latestClosePair(values: Array<number | null> | undefined): ClosePricePair | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const finite: number[] = [];
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      finite.push(value);
      if (finite.length === 2) {
        break;
      }
    }
  }
  const [latestClose, previousClose] = finite;
  if (latestClose === undefined) {
    return undefined;
  }
  return {
    latestClose,
    ...(previousClose !== undefined ? { previousClose } : {})
  };
}

export async function fetchLatestClosePrice(
  yahooBaseUrl: string,
  symbol: string
): Promise<number | undefined> {
  const pair = await fetchLatestClosePricePair(yahooBaseUrl, symbol);
  return pair?.latestClose;
}

export async function fetchLatestClosePricePair(
  yahooBaseUrl: string,
  symbol: string
): Promise<ClosePricePair | undefined> {
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
  const pair = latestClosePair(close);
  if (!pair) {
    throw new Error(`Yahoo close series missing for ${symbol}`);
  }
  return pair;
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

export async function fetchLatestClosePricePairs(
  yahooBaseUrl: string,
  symbols: string[],
  concurrency = 8
): Promise<Map<string, ClosePricePair>> {
  const normalizedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);
  const uniqueSymbols = [...new Set(normalizedSymbols)];
  const maxWorkers = Math.max(1, Math.min(concurrency, uniqueSymbols.length));
  const results = new Map<string, ClosePricePair>();
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
        const pair = await fetchLatestClosePricePair(yahooBaseUrl, symbol);
        if (pair) {
          results.set(symbol, pair);
        }
      } catch {
        continue;
      }
    }
  }

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  return results;
}

