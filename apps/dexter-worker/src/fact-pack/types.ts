// Mirror of supabase/functions/_lib/reports/deep_dive_v2/fact_pack.ts (the FactPack contract).
// Keep the two files in step. Only the types and the version are mirrored; readFactPack lives on the Deno side.

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
  /** Period-end shares outstanding (cover page count when the balance sheet count is missing). */
  shares_outstanding?: number;
  /** Weighted average diluted shares for the year. */
  shares_diluted?: number;
  equity?: number;
  total_assets?: number;
  /** Field name to the XBRL concept that supplied it, e.g. { revenue: "us-gaap:Revenues" }. */
  concepts?: Record<string, string>;
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
  /** Periodic and 8-K filings in the 12 months up to the latest filing, newest first. */
  filings: FilingRef[];
  /** Closing price on the filing date. Null until a licensed price source exists (SPEC rule 3). */
  price_at_filing: PriceAtFiling | null;
  /** Data the pack could not fill, e.g. "segments", "regions", "owners", "price_at_filing". */
  missing: string[];
  sources: Array<{ name: string; url: string }>;
}
