// Builds the Deep Dive fact pack for one ticker from SEC data (docs/deep-dive/SPEC.md section 7).
// Three requests: the ticker map, submissions and company facts. buildFactPack never throws: on any failure it
// logs and returns null, and the Deep Dive goes on without a pack.
import { logInfo, logWarn } from "../logging";
import { FactIndex, mapAnnualFacts, type AnnualMapping, type CompanyFactsJson } from "./companyfacts";
import { SEC_URLS, SecClient, SecHttpError, type SecClientOptions } from "./sec-client";
import { filingsWindow, latestPeriodicFiling, recentFilings, type SubmissionsJson } from "./submissions";
import { resolveCik } from "./ticker-cik";
import type { AnnualFacts, FactPack } from "./types";

export interface BuildFactPackDeps {
  client?: SecClient;
  clientOptions?: SecClientOptions;
  now?: () => Date;
  jobId?: string;
}

/** Data the pack does not fill yet, whatever the company (SPEC section 3). */
export const ALWAYS_MISSING = ["segments", "regions", "owners", "price_at_filing"];

/** The AnnualFacts fields the latest year is checked for. */
export const ANNUAL_FIELDS = [
  "revenue",
  "gross_profit",
  "operating_income",
  "pretax_income",
  "income_tax",
  "net_income",
  "eps_diluted",
  "operating_cash_flow",
  "capex",
  "free_cash_flow",
  "buybacks",
  "dividends",
  "stock_comp",
  "cash",
  "short_term_investments",
  "debt_total",
  "shares_outstanding",
  "shares_diluted",
  "equity",
  "total_assets"
] as const satisfies ReadonlyArray<keyof AnnualFacts>;

const EMPTY_MAPPING: AnnualMapping = {
  taxonomy: null,
  currency: "USD",
  annual: [],
  restatements: [],
  unmapped: [],
  splits: [],
  droppedCurrencies: []
};

/** "4-for-1", "3-for-2", "1-for-10". */
export function splitRatioText(ratio: number): string {
  const forward = ratio >= 1 ? ratio : 1 / ratio;
  for (const base of [1, 2, 3, 4]) {
    const top = forward * base;
    if (Math.abs(top - Math.round(top)) < 1e-6) {
      return ratio >= 1 ? `${Math.round(top)}-for-${base}` : `${base}-for-${Math.round(top)}`;
    }
  }
  return `${forward}-for-1`;
}

function reason(error: unknown): string {
  if (error instanceof SecHttpError) return `sec_http_${error.status}`;
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}

async function buildOrThrow(ticker: string, deps: BuildFactPackDeps): Promise<FactPack | null> {
  const client =
    deps.client ?? new SecClient({ userAgent: process.env.SEC_USER_AGENT, ...deps.clientOptions });
  const match = await resolveCik(client, ticker);
  if (!match) {
    logWarn("Fact pack skipped: ticker not in the SEC ticker map", { job_id: deps.jobId, ticker });
    return null;
  }

  const [submissions, facts] = await Promise.all([
    client.getJson<SubmissionsJson>(SEC_URLS.submissions(match.cik)),
    client.getJson<CompanyFactsJson>(SEC_URLS.companyFacts(match.cik)).catch((error: unknown) => {
      // A company with no XBRL filings yet (a recent IPO) has no company facts file.
      if (error instanceof SecHttpError && error.status === 404) return null;
      throw error;
    })
  ]);

  const mapping = facts ? mapAnnualFacts(facts) : EMPTY_MAPPING;
  const index = facts ? new FactIndex(facts) : null;
  const filings = recentFilings(submissions, match.cik);
  const latest = latestPeriodicFiling(filings, index, mapping.annual);

  const missing = [...ALWAYS_MISSING];
  if (!facts) missing.push("xbrl_facts");
  else if (!mapping.taxonomy) missing.push("xbrl_mapping");
  if (mapping.taxonomy === "ifrs-full") missing.push("ifrs_mapping");
  if (mapping.annual.length === 0) missing.push("annual");
  if (mapping.droppedCurrencies.length > 0) missing.push("history_before_currency_change");
  if (!latest) missing.push("latest_filing");
  const lastYear = mapping.annual[mapping.annual.length - 1];
  if (lastYear) {
    for (const field of ANNUAL_FIELDS) {
      if (lastYear[field] === undefined) missing.push(field);
    }
  }

  const sources: FactPack["sources"] = [
    { name: "SEC EDGAR company facts (XBRL)", url: SEC_URLS.companyFacts(match.cik) },
    { name: "SEC EDGAR submissions", url: SEC_URLS.submissions(match.cik) }
  ];
  if (latest?.url) sources.push({ name: `${latest.form} filed ${latest.filing_date}`, url: latest.url });
  for (const change of mapping.restatements) {
    sources.push({
      name: `FY${change.fiscal_year} ${change.field} restated in ${change.form} filed ${change.filed}`,
      url: SEC_URLS.archive(match.cik, change.accession)
    });
  }
  for (const split of mapping.splits) {
    sources.push({
      name: `${splitRatioText(split.ratio)} stock split from FY${split.effective_fiscal_year}${
        split.filed ? `, shown in the filing of ${split.filed}` : ""
      }; earlier per-share values and share counts adjusted`,
      url: split.accession ? SEC_URLS.archive(match.cik, split.accession) : SEC_URLS.companyFacts(match.cik)
    });
  }

  const pack: FactPack = {
    version: 1,
    source: "sec_companyfacts",
    ticker: ticker.trim().toUpperCase(),
    cik: match.cik,
    entity_name: facts?.entityName || submissions.name || match.title,
    currency: mapping.currency,
    ...(submissions.fiscalYearEnd ? { fiscal_year_end: submissions.fiscalYearEnd } : {}),
    ...(submissions.sic ? { sic: String(submissions.sic) } : {}),
    ...(submissions.sicDescription ? { sic_description: submissions.sicDescription } : {}),
    ...(submissions.stateOfIncorporation ? { state_of_incorporation: submissions.stateOfIncorporation } : {}),
    retrieved_at: (deps.now ?? (() => new Date()))().toISOString(),
    latest_filing: latest,
    annual: mapping.annual,
    ...(mapping.splits.length > 0 ? { splits: mapping.splits } : {}),
    filings: filingsWindow(filings, latest),
    price_at_filing: null,
    missing,
    sources
  };

  logInfo("Fact pack built", {
    job_id: deps.jobId,
    ticker: pack.ticker,
    cik: pack.cik,
    years: pack.annual.length,
    latest_period: latest?.period_label,
    restatements: mapping.restatements.length,
    splits: mapping.splits.length,
    sec_requests: client.requestCount
  });
  return pack;
}

/** The fact pack for a ticker, or null when SEC has nothing usable or a request failed. Never throws. */
export async function buildFactPack(ticker: string, deps: BuildFactPackDeps = {}): Promise<FactPack | null> {
  try {
    if (typeof ticker !== "string" || ticker.trim().length === 0) return null;
    return await buildOrThrow(ticker, deps);
  } catch (error) {
    logWarn("Fact pack build failed", { job_id: deps.jobId, ticker, reason: reason(error) });
    return null;
  }
}
