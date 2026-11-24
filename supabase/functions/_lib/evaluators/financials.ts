// POST /internal/financials/ingest (new in Deep Dive 2.0; not in contract.md, which is frozen).
// The Deep Dive runner sends the annual rows of the SEC fact pack it built (apps/dexter-worker/src/fact-pack)
// and the latest filing's period label. This upserts app.financial_snapshots on (ticker, period, period_type)
// and app.ticker_coverage, so POST /jobs finds the same period the report was stored under (one report per
// company per filing) and the precompute planner sees the company as covered.
import { logInfo } from "../../_shared/log.ts";
import type { EvalMeta, EvalResult } from "./result.ts";
import { ok, validation } from "./result.ts";
import { isPlainRecord } from "./util.ts";

export const FINANCIALS_PROVIDER = "sec_companyfacts";
export const MAX_SNAPSHOTS = 40;

/** Keys of CanonicalFinancialSnapshot.data the route accepts. Margins are percent numbers (46.2 = 46.2%). */
export const SNAPSHOT_DATA_KEYS = [
  "revenue",
  "gross_profit",
  "gross_margin",
  "operating_income",
  "operating_margin",
  "net_income",
  "eps_diluted",
  "operating_cash_flow",
  "capital_expenditure",
  "free_cash_flow",
  "cash_and_equivalents",
  "debt_total",
  "shares_outstanding",
  "shareholders_equity",
  "total_assets",
] as const;

const DATA_KEYS = new Set<string>(SNAPSHOT_DATA_KEYS);
const BODY_KEYS = new Set(["ticker", "provider", "latest_period", "snapshots"]);
const SNAPSHOT_KEYS = new Set([
  "period",
  "period_type",
  "fiscal_year",
  "filing_date",
  "data",
  "missing_fields",
]);
const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,11}$/;
const ANNUAL_PERIOD_RE = /^(\d{4})-FY$/;
const LATEST_PERIOD_RE = /^\d{4}-(FY|Q[1-3])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface FinancialSnapshotRow {
  snapshotId: string;
  ticker: string;
  period: string;
  periodType: "annual";
  fiscalYear: number;
  provider: string;
  filingDate?: string;
  retrievedAt: string;
  data: Record<string, number>;
  missingFields: string[];
}

export interface FinancialsIngestResult {
  upserted: number;
  snapshotCount: number;
  latestPeriod: string | null;
  earliestPeriod: string | null;
}

export interface FinancialsStore {
  // One transaction: upsert the rows, then the coverage row from the stored rows. latestPeriod null keeps the
  // coverage row's current latest_period.
  ingestFinancials(input: {
    ticker: string;
    rows: FinancialSnapshotRow[];
    latestPeriod: string | null;
    nowIso: string;
  }): Promise<FinancialsIngestResult>;
}

export interface FinancialsDeps {
  store: FinancialsStore;
  now: () => Date;
  audit: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
}

function unknownKeys(record: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(record).filter((key) => !allowed.has(key));
}

function isRealDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

type Parsed = { ok: true; rows: FinancialSnapshotRow[] } | { ok: false; message: string };

function parseSnapshots(raw: unknown[], ticker: string, nowIso: string): Parsed {
  const rows: FinancialSnapshotRow[] = [];
  const periods = new Set<string>();
  for (const [index, entry] of raw.entries()) {
    const at = `snapshots[${index}]`;
    if (!isPlainRecord(entry)) return { ok: false, message: `${at} must be an object.` };
    const extra = unknownKeys(entry, SNAPSHOT_KEYS);
    if (extra.length > 0) return { ok: false, message: `${at} has unknown fields: ${extra.join(", ")}.` };
    const period = typeof entry.period === "string" ? entry.period.trim().toUpperCase() : "";
    const match = ANNUAL_PERIOD_RE.exec(period);
    if (!match) return { ok: false, message: `${at}.period must look like 2025-FY.` };
    if (periods.has(period)) return { ok: false, message: `${at}.period ${period} is listed twice.` };
    periods.add(period);
    if (entry.period_type !== "annual") return { ok: false, message: `${at}.period_type must be annual.` };
    const fiscalYear = entry.fiscal_year;
    if (typeof fiscalYear !== "number" || !Number.isInteger(fiscalYear) || fiscalYear !== Number(match[1])) {
      return { ok: false, message: `${at}.fiscal_year must be the year in period.` };
    }
    let filingDate: string | undefined;
    if (entry.filing_date !== undefined && entry.filing_date !== null) {
      if (typeof entry.filing_date !== "string" || !isRealDate(entry.filing_date)) {
        return { ok: false, message: `${at}.filing_date must be YYYY-MM-DD.` };
      }
      filingDate = entry.filing_date;
    }
    if (!isPlainRecord(entry.data)) return { ok: false, message: `${at}.data must be an object.` };
    const data: Record<string, number> = {};
    for (const [key, value] of Object.entries(entry.data)) {
      if (!DATA_KEYS.has(key)) return { ok: false, message: `${at}.data.${key} is not a known field.` };
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, message: `${at}.data.${key} must be a finite number.` };
      }
      data[key] = value;
    }
    const missing = entry.missing_fields;
    if (
      !Array.isArray(missing) || missing.length > SNAPSHOT_DATA_KEYS.length ||
      !missing.every((field) => typeof field === "string" && DATA_KEYS.has(field) && !(field in data))
    ) {
      return { ok: false, message: `${at}.missing_fields must list known fields that data does not have.` };
    }
    rows.push({
      snapshotId: `sec-${ticker}-${period}`,
      ticker,
      period,
      periodType: "annual",
      fiscalYear,
      provider: FINANCIALS_PROVIDER,
      ...(filingDate ? { filingDate } : {}),
      retrievedAt: nowIso,
      data,
      missingFields: [...new Set(missing as string[])],
    });
  }
  return { ok: true, rows };
}

// Body: { ticker, provider: "sec_companyfacts", latest_period, snapshots: [...] }. Strict: unknown fields,
// bad values and more than 40 snapshots are 422.
export async function ingestFinancials(
  deps: FinancialsDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const extra = unknownKeys(body, BODY_KEYS);
  if (extra.length > 0) return validation(`Unknown fields: ${extra.join(", ")}.`);
  const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  if (!TICKER_RE.test(ticker)) return validation("ticker must be a valid symbol.");
  if (body.provider !== FINANCIALS_PROVIDER) return validation(`provider must be ${FINANCIALS_PROVIDER}.`);
  let latestPeriod: string | null = null;
  if (body.latest_period !== null && body.latest_period !== undefined) {
    const value = typeof body.latest_period === "string" ? body.latest_period.trim().toUpperCase() : "";
    if (!LATEST_PERIOD_RE.test(value)) return validation("latest_period must look like 2025-FY or 2026-Q1.");
    latestPeriod = value;
  }
  if (!Array.isArray(body.snapshots)) return validation("snapshots must be an array.");
  if (body.snapshots.length > MAX_SNAPSHOTS) {
    return validation(`snapshots must have at most ${MAX_SNAPSHOTS} entries.`);
  }
  if (body.snapshots.length === 0 && latestPeriod === null) {
    return validation("Send at least one snapshot or a latest_period.");
  }

  const nowIso = deps.now().toISOString();
  const parsed = parseSnapshots(body.snapshots, ticker, nowIso);
  if (!parsed.ok) return validation(parsed.message);

  const result = await deps.store.ingestFinancials({ ticker, rows: parsed.rows, latestPeriod, nowIso });
  const counts = {
    ticker,
    upserted: result.upserted,
    snapshot_count: result.snapshotCount,
    latest_period: result.latestPeriod,
    earliest_period: result.earliestPeriod,
  };
  await deps.audit("financials.ingested", { request_id: meta.requestId, route: meta.route, ...counts })
    .catch(() => undefined);
  logInfo("Financials ingested", counts);
  return ok({ status: "ok", ...counts });
}
