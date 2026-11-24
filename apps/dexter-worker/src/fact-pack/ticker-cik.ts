// Ticker to CIK through SEC's ticker map.
// Real shape of https://www.sec.gov/files/company_tickers.json:
//   { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, "1": { ... }, ... }
// Share classes use a dash in that file ("BRK-B", "BF-B"); exchanges and apps also write "BRK.B" or "BRK/B".
// Every class of a company has the same CIK, so each class ticker leads to the same company (SPEC rule 1).
import { SEC_URLS, type SecClient } from "./sec-client";

export interface TickerMapEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export type CompanyTickersJson = Record<string, TickerMapEntry>;

export interface CikMatch {
  /** Ten digits with leading zeros, as data.sec.gov URLs use it. */
  cik: string;
  /** The ticker as SEC writes it. */
  secTicker: string;
  title: string;
}

/** "brk.b", "BRK/B", "BRK-B" and "BRK B" all become "BRK-B". */
export function normalizeSecTicker(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/[./\s_]+/g, "-");
}

export function padCik(cik: number | string): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

/** Finds the company for a ticker. Exact match first, then the same letters without separators, then any
 *  class of the same base symbol (so "BRK" or an unlisted class still finds Berkshire). */
export function findCik(map: CompanyTickersJson, ticker: string): CikMatch | null {
  const wanted = normalizeSecTicker(ticker);
  if (!wanted) return null;
  const entries = Object.values(map).filter(
    (entry): entry is TickerMapEntry =>
      typeof entry === "object" && entry !== null && typeof entry.ticker === "string" && entry.cik_str != null
  );
  const toMatch = (entry: TickerMapEntry): CikMatch => ({
    cik: padCik(entry.cik_str),
    secTicker: entry.ticker,
    title: entry.title
  });

  const exact = entries.find((entry) => normalizeSecTicker(entry.ticker) === wanted);
  if (exact) return toMatch(exact);

  const squashed = wanted.replace(/-/g, "");
  const loose = entries.find((entry) => normalizeSecTicker(entry.ticker).replace(/-/g, "") === squashed);
  if (loose) return toMatch(loose);

  const base = wanted.split("-")[0] ?? "";
  if (base.length > 0) {
    const sameBase = entries.filter((entry) => normalizeSecTicker(entry.ticker).split("-")[0] === base);
    const ciks = new Set(sameBase.map((entry) => entry.cik_str));
    // Only when every class with that base belongs to one company.
    if (sameBase.length > 0 && ciks.size === 1) return toMatch(sameBase[0]!);
  }
  return null;
}

export async function resolveCik(client: SecClient, ticker: string): Promise<CikMatch | null> {
  const map = await client.getJson<CompanyTickersJson>(SEC_URLS.tickers);
  return findCik(map, ticker);
}
