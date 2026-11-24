// Deep Dive 2.0 fact pack: the sourced numbers a report is drawn from (docs/deep-dive/SPEC.md section 7).
// The runner (apps/dexter-worker/src/fact-pack) builds it from SEC XBRL companyfacts and stores it in the report
// as `report.fact_pack`. The renderer only reads it, calculates and draws. Every number shown on the page comes
// from a field here or from a value derived from these fields (derive.ts).
// Keep this file in step with apps/dexter-worker/src/fact-pack/types.ts.

export const FACT_PACK_VERSION = 1;

/** One fiscal year, as reported in that year's 10-K (or 20-F/40-F). Money in the report currency, units not millions. */
export interface AnnualFacts {
  fiscal_year: number;
  /** Period end date, YYYY-MM-DD. */
  period_end: string;
  /** Filing date of the annual report that first reported this year, YYYY-MM-DD. */
  filing_date?: string;
  form?: string;
  accession?: string;
  revenue?: number;
  gross_profit?: number;
  operating_income?: number;
  pretax_income?: number;
  income_tax?: number;
  net_income?: number;
  eps_diluted?: number;
  operating_cash_flow?: number;
  /** Purchases of property, plant and equipment, as a positive number. */
  capex?: number;
  /** operating_cash_flow - capex, filled by the builder when both exist. */
  free_cash_flow?: number;
  /** Cash paid for buybacks, positive. */
  buybacks?: number;
  /** Cash dividends paid, positive. */
  dividends?: number;
  stock_comp?: number;
  cash?: number;
  short_term_investments?: number;
  /** Current plus long-term debt, including commercial paper when tagged. */
  debt_total?: number;
  /** Shares outstanding: the annual report's cover page count (a 10-K dates it after the period end, a 20-F
   *  at the period end), else the balance sheet count at the period end. */
  shares_outstanding?: number;
  /** Weighted average diluted shares for the year. */
  shares_diluted?: number;
  equity?: number;
  total_assets?: number;
  /** Field name to the XBRL concept that supplied it, e.g. { revenue: "us-gaap:Revenues" }. */
  concepts?: Record<string, string>;
  /** Set only on rows adjusted for a stock split (see FactPack.splits): the values as that year's report gave
   *  them. eps_diluted, shares_diluted and shares_outstanding above are then on the latest year's basis. */
  as_reported?: AsReported;
}

export interface AsReported {
  eps_diluted?: number;
  shares_diluted?: number;
  shares_outstanding?: number;
}

/** A stock split found in the filings. ratio is new shares per old share: 4 for a 4-for-1 split, 0.1 for a
 *  1-for-10 reverse split. */
export interface StockSplit {
  ratio: number;
  /** The first fiscal year whose own annual report is on the new share basis. */
  effective_fiscal_year: number;
  /** "restatement": a later filing restated earlier per-share values or share counts by the ratio;
   *  "tag": us-gaap:StockholdersEquityNoteStockSplitConversionRatio1. */
  evidence: "restatement" | "tag";
  /** The XBRL concept that showed it. */
  concept: string;
  /** The filing that first showed the new basis, when known. */
  accession?: string;
  filed?: string;
}

export interface FilingRef {
  form: string;
  filing_date: string;
  /** Period of report, YYYY-MM-DD, when the filing has one. */
  period_end?: string;
  accession: string;
  /** 8-K item numbers, e.g. "2.02,9.01". */
  items?: string;
  url?: string;
}

export interface LatestFiling extends FilingRef {
  period_end: string;
  fiscal_year: number;
  fiscal_period: "FY" | "Q1" | "Q2" | "Q3";
  /** The period label the job fingerprint and ticker_coverage use, e.g. "2025-FY" or "2026-Q1". */
  period_label: string;
}

export interface PriceAtFiling {
  value: number;
  /** Trading date of the close, YYYY-MM-DD. */
  date: string;
  source: string;
}

export interface FactPack {
  version: 1;
  source: "sec_companyfacts";
  ticker: string;
  cik: string;
  entity_name: string;
  currency: string;
  /** MMDD from SEC submissions, e.g. "0927". */
  fiscal_year_end?: string;
  /** SIC code and description from SEC submissions. */
  sic?: string;
  sic_description?: string;
  state_of_incorporation?: string;
  retrieved_at: string;
  latest_filing: LatestFiling | null;
  /** Oldest first, at most 11 years. */
  annual: AnnualFacts[];
  /** Stock splits within the annual rows, oldest first. Present only when there is one: per-share values and
   *  share counts of earlier rows are then adjusted to the latest year's basis (as_reported keeps the originals).
   *  Absent means none was found, not that none happened. */
  splits?: StockSplit[];
  /** Periodic and 8-K filings in the 12 months up to the latest filing, newest first. */
  filings: FilingRef[];
  /** Closing price on the filing date. Null until a licensed price source exists (SPEC rule 3). */
  price_at_filing: PriceAtFiling | null;
  /** Data the pack could not fill, e.g. "segments", "regions", "owners", "price_at_filing".
   *  "history_before_currency_change": older years reported only in another currency are left out. */
  missing: string[];
  sources: Array<{ name: string; url: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The pack's valid split entries (a positive ratio other than 1 and a whole fiscal year), oldest first. */
export function readSplits(value: unknown): StockSplit[] {
  if (!Array.isArray(value)) return [];
  const out: StockSplit[] = [];
  for (const s of value) {
    if (!isRecord(s)) continue;
    const ratio = s.ratio, year = s.effective_fiscal_year;
    if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 1e-9) {
      continue;
    }
    if (typeof year !== "number" || !Number.isInteger(year)) continue;
    out.push({
      ratio,
      effective_fiscal_year: year,
      evidence: s.evidence === "tag" ? "tag" : "restatement",
      concept: typeof s.concept === "string" ? s.concept : "",
      ...(typeof s.accession === "string" ? { accession: s.accession } : {}),
      ...(typeof s.filed === "string" ? { filed: s.filed } : {}),
    });
  }
  return out.sort((a, b) => a.effective_fiscal_year - b.effective_fiscal_year);
}

/** The report's fact pack when it has a usable one (version 1, at least one annual row), else null. */
export function readFactPack(report: unknown): FactPack | null {
  if (!isRecord(report)) return null;
  const pack = report.fact_pack;
  if (!isRecord(pack) || pack.version !== FACT_PACK_VERSION) return null;
  if (!Array.isArray(pack.annual) || pack.annual.length === 0) return null;
  const annual = pack.annual.filter((row): row is AnnualFacts =>
    isRecord(row) && typeof row.fiscal_year === "number" && typeof row.period_end === "string"
  );
  if (annual.length === 0) return null;
  annual.sort((a, b) => a.fiscal_year - b.fiscal_year);
  const splits = readSplits(pack.splits);
  const { splits: _drop, ...rest } = pack;
  return {
    ...(rest as unknown as FactPack),
    annual,
    ...(splits.length ? { splits } : {}),
    filings: Array.isArray(pack.filings) ? (pack.filings as FilingRef[]) : [],
    missing: Array.isArray(pack.missing) ? (pack.missing as string[]) : [],
    sources: Array.isArray(pack.sources) ? (pack.sources as FactPack["sources"]) : [],
    price_at_filing: isRecord(pack.price_at_filing)
      ? (pack.price_at_filing as unknown as PriceAtFiling)
      : null,
    latest_filing: isRecord(pack.latest_filing) ? (pack.latest_filing as unknown as LatestFiling) : null,
  };
}
