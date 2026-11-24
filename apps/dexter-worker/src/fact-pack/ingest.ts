// Sends a fact pack's annual rows and the latest period to POST /internal/financials/ingest, so
// app.financial_snapshots and app.ticker_coverage follow the filing the Deep Dive read. Best effort: 10 s,
// one try, failures are logged (never the token) and the run goes on.
import { logInfo, logWarn } from "../logging";
import type { FetchLike } from "./sec-client";
import type { AnnualFacts, FactPack } from "./types";

export const FINANCIALS_INGEST_PATH = "/internal/financials/ingest";
const MAX_SNAPSHOTS = 40;

export interface IngestSnapshot {
  period: string;
  period_type: "annual";
  fiscal_year: number;
  filing_date?: string;
  data: Record<string, number>;
  missing_fields: string[];
}

export interface IngestBody {
  ticker: string;
  provider: "sec_companyfacts";
  latest_period: string | null;
  snapshots: IngestSnapshot[];
}

/** Canonical snapshot keys (packages/contracts CanonicalFinancialSnapshot.data) from one annual row. */
export const CANONICAL_KEYS = [
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
  "total_assets"
] as const;

function percent(part: number | undefined, whole: number | undefined): number | undefined {
  if (part === undefined || whole === undefined || whole === 0) return undefined;
  return Math.round((part / whole) * 10_000) / 100;
}

export function snapshotFromAnnual(row: AnnualFacts): IngestSnapshot {
  const values: Record<(typeof CANONICAL_KEYS)[number], number | undefined> = {
    revenue: row.revenue,
    gross_profit: row.gross_profit,
    gross_margin: percent(row.gross_profit, row.revenue),
    operating_income: row.operating_income,
    operating_margin: percent(row.operating_income, row.revenue),
    net_income: row.net_income,
    eps_diluted: row.eps_diluted,
    operating_cash_flow: row.operating_cash_flow,
    capital_expenditure: row.capex,
    free_cash_flow: row.free_cash_flow,
    cash_and_equivalents: row.cash,
    debt_total: row.debt_total,
    shares_outstanding: row.shares_outstanding,
    shareholders_equity: row.equity,
    total_assets: row.total_assets
  };
  const data: Record<string, number> = {};
  const missing: string[] = [];
  for (const key of CANONICAL_KEYS) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value)) data[key] = value;
    else missing.push(key);
  }
  return {
    period: `${row.fiscal_year}-FY`,
    period_type: "annual",
    fiscal_year: row.fiscal_year,
    ...(row.filing_date ? { filing_date: row.filing_date } : {}),
    data,
    missing_fields: missing
  };
}

export function ingestBodyFromPack(pack: FactPack): IngestBody {
  return {
    ticker: pack.ticker,
    provider: "sec_companyfacts",
    latest_period: pack.latest_filing?.period_label ?? null,
    snapshots: pack.annual.slice(-MAX_SNAPSHOTS).map(snapshotFromAnnual)
  };
}

export interface IngestTarget {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Returns true when the API accepted the rows. Never throws. */
export async function postFinancialsIngest(
  pack: FactPack,
  target: IngestTarget,
  jobId?: string
): Promise<boolean> {
  const body = ingestBodyFromPack(pack);
  if (body.snapshots.length === 0 && body.latest_period === null) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs ?? 10_000);
  try {
    const fetchImpl = target.fetchImpl ?? ((input, init) => fetch(input, init));
    const response = await fetchImpl(`${target.baseUrl.replace(/\/$/, "")}${FINANCIALS_INGEST_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": target.token },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    await response.body?.cancel().catch(() => undefined);
    if (!response.ok) {
      logWarn("Financials ingest refused", { job_id: jobId, ticker: pack.ticker, status: response.status });
      return false;
    }
    logInfo("Financials ingested", {
      job_id: jobId,
      ticker: pack.ticker,
      snapshots: body.snapshots.length,
      latest_period: body.latest_period ?? undefined
    });
    return true;
  } catch (error) {
    logWarn("Financials ingest failed", {
      job_id: jobId,
      ticker: pack.ticker,
      reason: error instanceof Error ? error.name : "unknown"
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
