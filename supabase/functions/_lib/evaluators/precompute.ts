// POST /internal/deep-dive/precompute. Logic copied from apps/product-api/src/deep-dive-precompute.ts.
// Finds covered tickers whose Deep Dive is missing, expired or behind a new filing, and creates system jobs
// (no user) for them, so later user requests reuse the stored report.
//
// Rebuild change (audit N7, DECISIONS D7): this route only CREATES the jobs. It never starts a runner per
// ticker. The daily workflow claims and runs the returned jobs one by one in its own step, with a small cap.
// So precompute never spends the user dispatch cap (DEEP_DIVE_DAILY_CAP) and never starts one Actions run each.
import type { Sql } from "../../_shared/db.ts";
import { env } from "../../_shared/env.ts";
import { deepDiveFingerprint } from "../jobs/service.ts";
import type { JobsStore } from "../jobs/store.ts";
import type { EvalMeta, EvalResult } from "./result.ts";
import { ok, validation } from "./result.ts";

export type DeepDiveRefreshReason = "no_report" | "new_filing" | "expired";

const COVERAGE_LIST_LIMIT = 10_000;
// Same string as DEEP_DIVE_SCHEMA_VERSION in _lib/jobs/service.ts (2.1: reports carry fact_pack).
const SCHEMA_VERSION = "2.1";

export interface PrecomputeStore {
  listCoveredTickers(limit: number): Promise<string[]>;
  listPendingPrecomputeTickers(): Promise<string[]>;
  jobs: Pick<
    JobsStore,
    | "createJob"
    | "getCoverageLatestPeriod"
    | "findReusableDeepDiveReport"
    | "findLatestComparableDeepDiveReport"
  >;
}

export interface PrecomputeDeps {
  store: PrecomputeStore;
  now: () => Date;
  batchSize: number;
  maxInFlight: number;
  audit: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
}

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Old defaults: batch 10, in flight 2. The in-workflow runner also caps per run (PRECOMPUTE_PER_RUN).
export function precomputeLimitsFromEnv(): { batchSize: number; maxInFlight: number } {
  return {
    batchSize: intEnv("DEEP_DIVE_PRECOMPUTE_BATCH_SIZE", 10),
    maxInFlight: intEnv("DEEP_DIVE_PRECOMPUTE_MAX_IN_FLIGHT", 2),
  };
}

export function postgresPrecomputeStore(sql: Sql, jobs: PrecomputeStore["jobs"]): PrecomputeStore {
  return {
    async listCoveredTickers(limit) {
      const rows = await sql.unsafe(
        `select ticker
           from ticker_coverage
          where last_sync_status in ('success', 'partial')
          order by backfill_tier asc, ticker asc
          limit $1`,
        [Math.max(1, limit)],
      );
      return rows.map((row) => String(row.ticker).trim().toUpperCase());
    },
    async listPendingPrecomputeTickers() {
      const rows = await sql.unsafe(
        `select distinct ticker
           from jobs
          where type = 'deep_dive'
            and user_id is null
            and status in ('queued', 'running')
            and ticker is not null`,
      );
      return rows.map((row) => String(row.ticker));
    },
    jobs,
  };
}

// Returns why a fresh Deep Dive is needed, or undefined when a reusable report already exists.
export async function detectDeepDiveRefresh(
  store: PrecomputeStore,
  input: { ticker: string; currentFingerprint: string; nowIso: string },
): Promise<DeepDiveRefreshReason | undefined> {
  const reusable = await store.jobs.findReusableDeepDiveReport({
    ticker: input.ticker,
    fingerprint: input.currentFingerprint,
    nowIso: input.nowIso,
  });
  if (reusable) return undefined;
  // Fingerprint format: TICKER|SCHEMA_VERSION|LATEST_PERIOD.
  const schemaVersion = input.currentFingerprint.split("|")[1] ?? "0";
  const latest = await store.jobs.findLatestComparableDeepDiveReport({
    ticker: input.ticker,
    schemaMajor: Number.parseInt(schemaVersion, 10),
    sinceIso: new Date(0).toISOString(),
  });
  if (!latest) return "no_report";
  return latest.fingerprint === input.currentFingerprint ? "expired" : "new_filing";
}

// Body: { limit? } caps how many jobs this call creates (the workflow asks for what it will run now).
export async function runDeepDivePrecompute(
  deps: PrecomputeDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  let batch = deps.batchSize;
  if (body.limit !== undefined) {
    const limit = body.limit;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0 || limit > 50) {
      return validation("limit must be an integer between 0 and 50.");
    }
    batch = Math.min(batch, limit);
  }

  const pending = new Set(await deps.store.listPendingPrecomputeTickers());
  const slots = Math.min(batch, deps.maxInFlight - pending.size);
  const queued: Array<{ ticker: string; reason: DeepDiveRefreshReason; job_id: string }> = [];

  if (slots > 0) {
    const nowIso = deps.now().toISOString();
    for (const ticker of await deps.store.listCoveredTickers(COVERAGE_LIST_LIMIT)) {
      if (queued.length >= slots) break;
      if (pending.has(ticker)) continue;
      const latestPeriod = await deps.store.jobs.getCoverageLatestPeriod(ticker);
      const reason = await detectDeepDiveRefresh(deps.store, {
        ticker,
        currentFingerprint: deepDiveFingerprint({ ticker, schemaVersion: SCHEMA_VERSION, latestPeriod }),
        nowIso,
      });
      if (!reason) continue;
      const job = await deps.store.jobs.createJob({
        id: crypto.randomUUID(),
        type: "deep_dive",
        ticker,
        createdAt: nowIso,
      });
      if (!job) continue;
      queued.push({ ticker, reason, job_id: job.id });
    }
  }

  const inFlight = pending.size + queued.length;
  await deps.audit("deep_dive.precompute_queued", {
    request_id: meta.requestId,
    route: meta.route,
    queued: queued.length,
    in_flight: inFlight,
  }).catch(() => undefined);
  return ok({ status: "accepted", queued: queued.length, in_flight: inFlight, jobs: queued });
}
