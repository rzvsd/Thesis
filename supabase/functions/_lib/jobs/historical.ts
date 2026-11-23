// /v1/historical/* and /internal/reports/comparable-latest, which the Deep Dive pipeline reads.
// Copied from apps/product-api/src/routes/public-routes.ts and server.ts. Tables are read only here
// (financial_snapshots, transcripts, ticker_coverage belong to M3).
import { authorize, type UserVerifier } from "../../_shared/auth.ts";
import type { Sql } from "../../_shared/db.ts";
import { env } from "../../_shared/env.ts";
import { apiError, json } from "../../_shared/http.ts";
import type { ArtifactStore } from "./artifacts.ts";
import { assertIncomingAnalysisReport } from "./report-validation.ts";
import type { JobsStore } from "./store.ts";
import { TICKER_RE } from "./service.ts";
import type { AnalysisReport } from "./types.ts";

type Row = Record<string, unknown>;
type Audit = (eventType: string, payload: Record<string, unknown>, userId?: string) => Promise<void>;

function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}
const rec = (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v as Row : undefined;
const strs = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function mapFinancialSnapshot(row: Row) {
  return {
    snapshot_id: String(row.snapshot_id),
    ticker: String(row.ticker),
    period: String(row.period),
    period_type: String(row.period_type),
    fiscal_year: Number(row.fiscal_year),
    fiscal_quarter: row.fiscal_quarter == null ? undefined : Number(row.fiscal_quarter),
    provider: String(row.provider),
    filing_date: row.filing_date == null ? undefined : String(row.filing_date),
    retrieved_at: iso(row.retrieved_at) ?? new Date().toISOString(),
    data: rec(row.data) ?? {},
    segments: Array.isArray(row.segments) ? row.segments : undefined,
    analyst_estimates: rec(row.analyst_estimates),
    guidance: rec(row.guidance),
    missing_fields: strs(row.missing_fields),
  };
}

export function mapTranscript(row: Row) {
  return {
    transcript_id: String(row.transcript_id),
    ticker: String(row.ticker),
    period: String(row.period),
    fiscal_year: Number(row.fiscal_year),
    fiscal_quarter: Number(row.fiscal_quarter),
    call_date: String(row.call_date),
    provider: String(row.provider),
    retrieved_at: iso(row.retrieved_at) ?? new Date().toISOString(),
    body_text: String(row.body_text ?? ""),
    word_count: Number(row.word_count ?? 0),
    is_complete: Boolean(row.is_complete),
  };
}

export function mapCoverage(row: Row) {
  return {
    ticker: String(row.ticker),
    snapshot_count: Number(row.snapshot_count ?? 0),
    transcript_count: Number(row.transcript_count ?? 0),
    latest_period: row.latest_period == null ? null : String(row.latest_period),
    earliest_period: row.earliest_period == null ? null : String(row.earliest_period),
    has_guidance: Boolean(row.has_guidance),
    has_estimates: Boolean(row.has_estimates),
    last_synced_at: iso(row.last_synced_at) ?? new Date().toISOString(),
    last_sync_status: String(row.last_sync_status),
    backfill_tier: Number(row.backfill_tier),
  };
}

export interface HistoricalSource {
  financials(ticker: string): Promise<Row[]>;
  transcripts(ticker: string): Promise<Row[]>;
  coverage(ticker: string): Promise<Row | undefined>;
  // Reviewed 10-Q/10-K excerpts. The old server proxied data-openbb; unset DATA_SERVICE_BASE_URL means missing.
  filingSections(ticker: string): Promise<{ filings: unknown[]; unavailableReason?: string }>;
}

export function postgresHistoricalSource(sql: Sql, fetchFn: typeof fetch = fetch): HistoricalSource {
  return {
    async financials(ticker) {
      const rows = await sql`select * from financial_snapshots where ticker = ${ticker}
        order by fiscal_year desc, fiscal_quarter desc nulls last, period_type asc`;
      return rows.map(mapFinancialSnapshot);
    },
    async transcripts(ticker) {
      const rows = await sql`select * from transcripts where ticker = ${ticker}
        order by fiscal_year desc, fiscal_quarter desc`;
      return rows.map(mapTranscript);
    },
    async coverage(ticker) {
      const [row] = await sql`select * from ticker_coverage where ticker = ${ticker}`;
      return row ? mapCoverage(row) : undefined;
    },
    async filingSections(ticker) {
      const base = env("DATA_SERVICE_BASE_URL");
      if (!base) return { filings: [], unavailableReason: "not_configured" };
      try {
        const res = await fetchFn(`${base}/v1/official/filing-sections?ticker=${encodeURIComponent(ticker)}`);
        const payload = await res.json() as {
          ok?: boolean;
          data?: { filings?: unknown };
          error_message?: string;
        };
        if (res.ok && payload.ok === true && Array.isArray(payload.data?.filings)) {
          return { filings: payload.data.filings };
        }
        return { filings: [], unavailableReason: payload.error_message ?? `HTTP ${res.status}` };
      } catch (err) {
        return { filings: [], unavailableReason: err instanceof Error ? err.message : "network error" };
      }
    },
  };
}

const KINDS = ["financials", "transcripts", "filing-sections", "coverage"] as const;
export type HistoricalKind = typeof KINDS[number];

// Internal token or a user access token. The guard has no "either" mode, so the route is "none" and this
// function checks both.
export async function handleHistorical(
  deps: { source: HistoricalSource; audit: Audit; verifyUser?: UserVerifier },
  input: { req: Request; url: URL; kind: HistoricalKind; requestId: string },
): Promise<Response> {
  const internal = await authorize(input.req, "internal");
  let userId: string | undefined;
  if (!internal.ok) {
    const user = await authorize(input.req, "user", deps.verifyUser);
    if (!user.ok) return apiError(401, "unauthorized", "Authentication required.");
    userId = user.ctx.userId ?? undefined;
  }
  const ticker = input.url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker || !TICKER_RE.test(ticker)) {
    return apiError(
      422,
      "validation_failed",
      "ticker query parameter is required and must be a valid US symbol.",
    );
  }
  const base = {
    request_id: input.requestId,
    route: `/v1/historical/${input.kind}`,
    ticker,
    internal_request: internal.ok,
  };

  if (input.kind === "coverage") {
    const coverage = await deps.source.coverage(ticker);
    await deps.audit("historical.coverage_retrieved", { ...base, found: Boolean(coverage) }, userId);
    return json({ data: coverage ?? null, missing: coverage === undefined });
  }
  if (input.kind === "filing-sections") {
    const { filings, unavailableReason } = await deps.source.filingSections(ticker);
    await deps.audit("historical.filing_sections_retrieved", {
      ...base,
      row_count: filings.length,
      ...(unavailableReason ? { unavailable_reason: unavailableReason } : {}),
    }, userId);
    return json({ data: filings, missing: filings.length === 0 });
  }
  const rows = input.kind === "financials"
    ? await deps.source.financials(ticker)
    : await deps.source.transcripts(ticker);
  await deps.audit(`historical.${input.kind}_retrieved`, { ...base, row_count: rows.length }, userId);
  return json({ data: rows, missing: rows.length === 0 });
}

function extractThesisStatement(report: AnalysisReport): string | undefined {
  const section = report.sections.find((s) =>
    s.section_id === "thesis_statement" || s.title.trim().toLowerCase() === "thesis statement"
  );
  const body = section?.body?.trim();
  return body && body.length > 0 ? body : undefined;
}

export function toComparableSummary(report: AnalysisReport) {
  return {
    report_id: report.report_id,
    generated_at: report.generated_at,
    schema_version: report.schema_version,
    ticker: report.ticker,
    signal_value: report.signal?.value,
    confidence_label: report.confidence?.label,
    confidence_score: report.confidence?.score,
    thesis_statement: extractThesisStatement(report),
    valuation_mid: report.valuation?.fair_value_mid,
    trust_metadata: report.trust_metadata,
  };
}

function intParam(value: string | null, fallback: number, min: number, max: number): number | undefined {
  if (!value || value.trim() === "") return fallback;
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

// GET /internal/reports/comparable-latest
export async function comparableLatest(
  deps: {
    store: JobsStore;
    artifacts: ArtifactStore;
    enrichIssuer: (r: AnalysisReport) => Promise<AnalysisReport>;
    now?: () => Date;
  },
  url: URL,
): Promise<Response> {
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker || !TICKER_RE.test(ticker)) {
    return apiError(
      422,
      "validation_failed",
      "ticker query parameter is required and must be a valid US symbol.",
    );
  }
  const schemaMajor = Number.parseInt(url.searchParams.get("schema_major")?.trim() || "2", 10);
  if (!Number.isFinite(schemaMajor) || schemaMajor < 1 || schemaMajor > 20) {
    return apiError(422, "validation_failed", "schema_major must be an integer between 1 and 20.");
  }
  const lookbackDays = intParam(url.searchParams.get("lookback_days"), 120, 1, 365);
  if (lookbackDays === undefined) {
    return apiError(422, "validation_failed", "lookback_days must be an integer between 1 and 365.");
  }
  const now = (deps.now ?? (() => new Date()))();
  const sinceIso = new Date(now.getTime() - lookbackDays * 86_400_000).toISOString();
  const missing = json({ missing: true, data: null });
  const found = await deps.store.findLatestComparableDeepDiveReport({ ticker, schemaMajor, sinceIso });
  if (!found) return missing;
  const artifact = await deps.artifacts.readReport(found.artifactKey);
  if (!artifact || !("job_id" in artifact)) return missing;
  let report: AnalysisReport;
  try {
    report = assertIncomingAnalysisReport(artifact);
  } catch {
    return missing;
  }
  report = await deps.enrichIssuer(report);
  return json({ missing: false, data: toComparableSummary(report) });
}
