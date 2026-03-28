import { createHash } from "node:crypto";

import type { FearGreedSnapshot } from "../../../packages/contracts/src";
import {
  computeFearGreedComposite,
  normalizeLinearRange,
  type SignalInput
} from "../../../packages/fear-greed-engine/src";
import type { ProductStore } from "./store";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface FredObservationResponse {
  observations?: Array<{
    date?: string;
    value?: string;
  }>;
}

export interface BuildFearGreedSnapshotOptions {
  marketDate: string;
  store: ProductStore;
  yahooBaseUrl: string;
  fredBaseUrl: string;
  fredApiKey?: string;
  breadthUniverseLimit: number;
  breadthConcurrency: number;
  minimumAvailableInputs: number;
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMarketDate(marketDate: string): Date | undefined {
  const normalized = marketDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function observedDate(year: number, month: number, day: number): Date {
  const actual = new Date(Date.UTC(year, month - 1, day));
  const weekday = actual.getUTCDay();
  if (weekday === 6) {
    actual.setUTCDate(actual.getUTCDate() - 1);
  } else if (weekday === 0) {
    actual.setUTCDate(actual.getUTCDate() + 1);
  }
  return actual;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number
): Date {
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCDate(date.getUTCDate() + (occurrence - 1) * 7);
  return date;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const date = new Date(Date.UTC(year, month, 0));
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function usMarketHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  holidays.add(toDateKey(observedDate(year, 1, 1)));
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 1, 1, 3))); // MLK
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 2, 1, 3))); // Presidents
  holidays.add(toDateKey(lastWeekdayOfMonth(year, 5, 1))); // Memorial
  holidays.add(toDateKey(observedDate(year, 6, 19))); // Juneteenth
  holidays.add(toDateKey(observedDate(year, 7, 4))); // Independence
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 9, 1, 1))); // Labor
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 11, 4, 4))); // Thanksgiving
  holidays.add(toDateKey(observedDate(year, 12, 25))); // Christmas

  const easter = easterSundayUtc(year);
  const goodFriday = new Date(easter.getTime());
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.add(toDateKey(goodFriday));

  return holidays;
}

export function isUsTradingDay(marketDate: string): boolean {
  const parsed = parseMarketDate(marketDate);
  if (!parsed) {
    return false;
  }

  const weekday = parsed.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return false;
  }

  const holidays = usMarketHolidays(parsed.getUTCFullYear());
  return !holidays.has(toDateKey(parsed));
}

function requiredValues(series: Array<number | null>, minimum: number): number[] {
  const cleaned = series.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (cleaned.length < minimum) {
    throw new Error(`Insufficient data points: ${cleaned.length} found, ${minimum} required`);
  }
  return cleaned;
}

async function fetchYahooCloseSeries(
  baseUrl: string,
  symbol: string
): Promise<Array<number | null>> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "1y");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${symbol}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const close =
    payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(close)) {
    throw new Error(`Yahoo chart response missing close series for ${symbol}`);
  }
  return close;
}

function movingAverage(values: number[], period: number): number {
  if (values.length < period) {
    throw new Error(`Insufficient values for SMA${period}: ${values.length}`);
  }
  const window = values.slice(values.length - period);
  const total = window.reduce((acc, value) => acc + value, 0);
  return total / period;
}

function percentChange(latest: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) {
    throw new Error("Cannot compute percent change with zero previous value");
  }
  return ((latest - previous) / previous) * 100;
}

async function fetchFredLatestValue(
  baseUrl: string,
  seriesId: string,
  apiKey?: string
): Promise<{ value: number; date: string }> {
  if (!apiKey) {
    throw new Error("SENTIMENT_FRED_API_KEY is required for FRED signals");
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "30");
  url.searchParams.set("file_type", "json");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`FRED request failed for ${seriesId}: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as FredObservationResponse;
  const observation = payload.observations?.find((entry) => {
    if (!entry.value) {
      return false;
    }
    const value = Number(entry.value);
    return Number.isFinite(value);
  });

  if (!observation || !observation.value || !observation.date) {
    throw new Error(`FRED response missing numeric observation for ${seriesId}`);
  }

  return {
    value: Number(observation.value),
    date: observation.date
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  if (inputs.length === 0) {
    return [];
  }

  const results: TOutput[] = [];
  const workers = Math.max(1, Math.min(concurrency, inputs.length));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < inputs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(inputs[index] as TInput);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function unavailableSignal(
  inputName: string,
  provider: string,
  notes: string
): SignalInput {
  return {
    input_name: inputName,
    provider,
    available: false,
    notes
  };
}

export async function buildFearGreedSnapshot(
  options: BuildFearGreedSnapshotOptions
): Promise<FearGreedSnapshot> {
  const nowIso = new Date().toISOString();
  const marketDate = options.marketDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) {
    throw new Error("marketDate must be in YYYY-MM-DD format");
  }

  const signals: SignalInput[] = [];

  try {
    const vixSeries = requiredValues(
      await fetchYahooCloseSeries(options.yahooBaseUrl, "^VIX"),
      30
    );
    const vixLatest = vixSeries[vixSeries.length - 1] as number;
    signals.push({
      input_name: "vix",
      provider: "yahoo_finance",
      available: true,
      raw_value: Number(vixLatest.toFixed(4)),
      normalized_score: normalizeLinearRange(vixLatest, 12, 35, true),
      retrieved_at: nowIso
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "vix",
        "yahoo_finance",
        error instanceof Error ? error.message : "vix fetch failed"
      )
    );
  }

  try {
    const spSeries = requiredValues(
      await fetchYahooCloseSeries(options.yahooBaseUrl, "^GSPC"),
      200
    );
    const latest = spSeries[spSeries.length - 1] as number;
    const sma125 = movingAverage(spSeries, 125);
    const rawMomentum = percentChange(latest, sma125);
    signals.push({
      input_name: "sp500_momentum",
      provider: "yahoo_finance",
      available: true,
      raw_value: Number(rawMomentum.toFixed(4)),
      normalized_score: normalizeLinearRange(rawMomentum, -10, 10, false),
      retrieved_at: nowIso
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "sp500_momentum",
        "yahoo_finance",
        error instanceof Error ? error.message : "momentum fetch failed"
      )
    );
  }

  try {
    const [spySeries, tltSeries] = await Promise.all([
      fetchYahooCloseSeries(options.yahooBaseUrl, "SPY"),
      fetchYahooCloseSeries(options.yahooBaseUrl, "TLT")
    ]);
    const spyValues = requiredValues(spySeries, 30);
    const tltValues = requiredValues(tltSeries, 30);

    const spyLatest = spyValues[spyValues.length - 1] as number;
    const tltLatest = tltValues[tltValues.length - 1] as number;
    const spyPrior = spyValues[spyValues.length - 21] as number;
    const tltPrior = tltValues[tltValues.length - 21] as number;
    const spyReturn = percentChange(spyLatest, spyPrior);
    const tltReturn = percentChange(tltLatest, tltPrior);
    const safeHaven = spyReturn - tltReturn;

    signals.push({
      input_name: "safe_haven_demand",
      provider: "yahoo_finance",
      available: true,
      raw_value: Number(safeHaven.toFixed(4)),
      normalized_score: normalizeLinearRange(safeHaven, -8, 8, false),
      retrieved_at: nowIso
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "safe_haven_demand",
        "yahoo_finance",
        error instanceof Error ? error.message : "safe-haven fetch failed"
      )
    );
  }

  try {
    const universeTickers = await options.store.listTickerCoverageTickers(
      options.breadthUniverseLimit
    );
    if (universeTickers.length === 0) {
      throw new Error("ticker_coverage returned an empty universe");
    }

    const aboveFlags = await mapWithConcurrency(
      universeTickers,
      options.breadthConcurrency,
      async (ticker): Promise<boolean | undefined> => {
        try {
          const series = requiredValues(
            await fetchYahooCloseSeries(options.yahooBaseUrl, ticker),
            210
          );
          const latest = series[series.length - 1] as number;
          const sma200 = movingAverage(series, 200);
          return latest > sma200;
        } catch {
          return undefined;
        }
      }
    );

    const validFlags = aboveFlags.filter(
      (value): value is boolean => typeof value === "boolean"
    );
    if (validFlags.length === 0) {
      throw new Error("No valid breadth ticker series available");
    }

    const aboveCount = validFlags.filter((value) => value).length;
    const rawBreadth = (aboveCount / validFlags.length) * 100;
    signals.push({
      input_name: "market_breadth",
      provider: "yahoo_finance",
      available: true,
      raw_value: Number(rawBreadth.toFixed(4)),
      normalized_score: normalizeLinearRange(rawBreadth, 20, 80, false),
      retrieved_at: nowIso,
      notes: `${validFlags.length} universe tickers evaluated`
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "market_breadth",
        "yahoo_finance",
        error instanceof Error ? error.message : "breadth fetch failed"
      )
    );
  }

  try {
    const junkSpread = await fetchFredLatestValue(
      options.fredBaseUrl,
      "BAMLH0A0HYM2",
      options.fredApiKey
    );
    signals.push({
      input_name: "junk_bond_spread",
      provider: "fred",
      available: true,
      raw_value: Number(junkSpread.value.toFixed(4)),
      normalized_score: normalizeLinearRange(junkSpread.value, 2, 10, true),
      retrieved_at: nowIso,
      notes: junkSpread.date
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "junk_bond_spread",
        "fred",
        error instanceof Error ? error.message : "junk spread fetch failed"
      )
    );
  }

  try {
    const yieldCurve = await fetchFredLatestValue(
      options.fredBaseUrl,
      "T10Y2Y",
      options.fredApiKey
    );
    signals.push({
      input_name: "yield_curve",
      provider: "fred",
      available: true,
      raw_value: Number(yieldCurve.value.toFixed(4)),
      normalized_score: normalizeLinearRange(yieldCurve.value, -1, 2, false),
      retrieved_at: nowIso,
      notes: yieldCurve.date
    });
  } catch (error) {
    signals.push(
      unavailableSignal(
        "yield_curve",
        "fred",
        error instanceof Error ? error.message : "yield curve fetch failed"
      )
    );
  }

  const scored = computeFearGreedComposite(signals, options.minimumAvailableInputs);
  const id = createHash("sha256")
    .update(`fear_greed_daily:${marketDate}`)
    .digest("hex");

  return {
    id,
    market_date: marketDate,
    score: scored.score,
    label: scored.label,
    sub_scores: scored.sub_scores.map((entry) => ({
      input_name: entry.input_name,
      provider: entry.provider,
      available: entry.available,
      weight: Number(entry.weight.toFixed(8)),
      normalized_score:
        typeof entry.normalized_score === "number"
          ? Number(entry.normalized_score.toFixed(2))
          : undefined,
      raw_value:
        typeof entry.raw_value === "number"
          ? Number(entry.raw_value.toFixed(4))
          : undefined,
      retrieved_at: entry.retrieved_at,
      notes: entry.notes
    })),
    missing_inputs: scored.missing_inputs,
    calculated_at: nowIso
  };
}
