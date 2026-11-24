// Latest periodic filing and the filing list from SEC submissions.
//
// Real shape of https://data.sec.gov/submissions/CIK##########.json (abridged):
//   { cik: "320193", name: "Apple Inc.", tickers: ["AAPL"], exchanges: ["Nasdaq"], sic: "3571",
//     sicDescription: "Electronic Computers", fiscalYearEnd: "0928", stateOfIncorporation: "CA",
//     filings: { recent: { accessionNumber: [...], filingDate: [...], reportDate: [...], form: [...],
//                          items: [...], primaryDocument: [...], ... }, files: [ older pages ] } }
//   The recent arrays are parallel and newest first. items is "" except on 8-Ks ("2.02,9.01").
//   reportDate is the period of report ("" when the form has none).
import type { FactIndex } from "./companyfacts";
import { SEC_URLS } from "./sec-client";
import type { AnnualFacts, FilingRef, LatestFiling } from "./types";

export interface SubmissionsJson {
  cik: string | number;
  name?: string;
  tickers?: string[];
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  stateOfIncorporation?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      items?: string[];
      primaryDocument?: string[];
    };
  };
}

/** Forms that start a new report (SPEC rule 1). Amendments do not move the latest filing. */
const PERIODIC = new Set(["10-K", "10-Q", "20-F", "40-F"]);
const ANNUAL = new Set(["10-K", "20-F", "40-F"]);
/** Forms listed in the pack's filing list, with or without /A. */
const LISTED = new Set(["10-K", "10-Q", "20-F", "40-F", "6-K", "8-K"]);
const DAY_MS = 86_400_000;

export interface RecentFiling extends FilingRef {
  primaryDocument?: string;
}

export function recentFilings(json: SubmissionsJson, cik10: string): RecentFiling[] {
  const recent = json.filings?.recent;
  const accessions = recent?.accessionNumber ?? [];
  const out: RecentFiling[] = [];
  for (let index = 0; index < accessions.length; index += 1) {
    const accession = accessions[index];
    const form = recent?.form?.[index]?.trim().toUpperCase();
    const filingDate = recent?.filingDate?.[index];
    if (!accession || !form || !filingDate) continue;
    const reportDate = recent?.reportDate?.[index]?.trim();
    const items = recent?.items?.[index]?.trim();
    const document = recent?.primaryDocument?.[index]?.trim();
    out.push({
      form,
      filing_date: filingDate,
      ...(reportDate ? { period_end: reportDate } : {}),
      accession,
      ...(items ? { items } : {}),
      url: SEC_URLS.archive(cik10, accession, document || undefined),
      ...(document ? { primaryDocument: document } : {})
    });
  }
  // Newest first, whatever order the file had.
  return out.sort((a, b) => (a.filing_date < b.filing_date ? 1 : a.filing_date > b.filing_date ? -1 : 0));
}

function monthsBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / (DAY_MS * 30.44);
}

/** Fiscal year and period of a filing: its own facts first (fy/fp of any fact with its accession), else from
 *  the annual rows (the fiscal year whose end it matches, or the quarter counted from the last year end). */
export function fiscalPeriodOf(
  filing: RecentFiling,
  index: FactIndex | null,
  annual: AnnualFacts[]
): { fiscal_year: number; fiscal_period: LatestFiling["fiscal_period"] } | null {
  const isAnnual = ANNUAL.has(filing.form);
  const found = index?.fiscalInfoForAccession(filing.accession);
  // A filing's fy is off by more than a year from its period end only when the filer tagged it wrong.
  const endYear = filing.period_end ? Number.parseInt(filing.period_end.slice(0, 4), 10) : undefined;
  const own = found && (endYear === undefined || Math.abs(found.fy - endYear) <= 1) ? found : null;
  if (own) {
    if (isAnnual) return { fiscal_year: own.fy, fiscal_period: "FY" };
    if (own.fp === "Q1" || own.fp === "Q2" || own.fp === "Q3") return { fiscal_year: own.fy, fiscal_period: own.fp };
  }
  const periodEnd = filing.period_end;
  if (!periodEnd) return null;
  if (isAnnual) {
    const row = annual.find((entry) => Math.abs(Date.parse(entry.period_end) - Date.parse(periodEnd)) < 20 * DAY_MS);
    if (row) return { fiscal_year: row.fiscal_year, fiscal_period: "FY" };
    const last = [...annual].reverse().find((entry) => entry.period_end < periodEnd);
    if (last) return { fiscal_year: last.fiscal_year + Math.round(monthsBetween(last.period_end, periodEnd) / 12), fiscal_period: "FY" };
    return { fiscal_year: Number.parseInt(periodEnd.slice(0, 4), 10), fiscal_period: "FY" };
  }
  const last = [...annual].reverse().find((entry) => entry.period_end < periodEnd);
  if (!last) return null;
  const quarter = Math.round(monthsBetween(last.period_end, periodEnd) / 3);
  if (quarter < 1 || quarter > 3) return null;
  return { fiscal_year: last.fiscal_year + 1, fiscal_period: `Q${quarter}` as "Q1" | "Q2" | "Q3" };
}

export function periodLabel(fiscalYear: number, fiscalPeriod: LatestFiling["fiscal_period"]): string {
  return fiscalPeriod === "FY" ? `${fiscalYear}-FY` : `${fiscalYear}-${fiscalPeriod}`;
}

/** The newest 10-K, 10-Q, 20-F or 40-F (not an amendment) with a known period. */
export function latestPeriodicFiling(
  filings: RecentFiling[],
  index: FactIndex | null,
  annual: AnnualFacts[]
): LatestFiling | null {
  for (const filing of filings) {
    if (!PERIODIC.has(filing.form) || !filing.period_end) continue;
    const period = fiscalPeriodOf(filing, index, annual);
    if (!period) continue;
    const { primaryDocument: _document, ...ref } = filing;
    void _document;
    return {
      ...ref,
      period_end: filing.period_end,
      fiscal_year: period.fiscal_year,
      fiscal_period: period.fiscal_period,
      period_label: periodLabel(period.fiscal_year, period.fiscal_period)
    };
  }
  return null;
}

/** 10-K, 10-Q, 20-F, 40-F, 6-K and 8-K (and their /A) filed in the 12 months up to the latest filing, newest first. */
export function filingsWindow(filings: RecentFiling[], latest: LatestFiling | null): FilingRef[] {
  if (!latest) return [];
  const until = Date.parse(latest.filing_date);
  const from = until - 365 * DAY_MS;
  return filings
    .filter((filing) => {
      const base = filing.form.replace(/\/A$/, "");
      const at = Date.parse(filing.filing_date);
      return LISTED.has(base) && at > from && at <= until;
    })
    .map(({ primaryDocument: _document, ...ref }) => {
      void _document;
      return ref;
    });
}
