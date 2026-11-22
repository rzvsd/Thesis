import type { ProductApiConfig } from "./config";
import type { JobQueue } from "./queue";
import { createId } from "./security";
import type { ProductStore } from "./store";
import type { ReportRecord } from "./types";

// Covered = the historical sync ingested the ticker from the coverage universe (S&P 500 by default).
const COVERED_SYNC_STATUSES = new Set(["success", "partial"]);
const COVERAGE_LIST_LIMIT = 10_000;

export type DeepDiveRefreshReason = "no_report" | "new_filing" | "expired";

interface PrecomputeRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  queue: JobQueue;
}

export async function listCoveredTickers(store: ProductStore): Promise<string[]> {
  return store.listTickerCoverageTickers(COVERAGE_LIST_LIMIT);
}

export async function isCoveredTicker(store: ProductStore, ticker: string): Promise<boolean> {
  const coverage = await store.getTickerCoverageByTicker(ticker);
  return coverage !== undefined && COVERED_SYNC_STATUSES.has(coverage.last_sync_status);
}

/**
 * New-filing detection for one covered ticker. The Deep Dive fingerprint includes the latest
 * SEC filing period from ticker_coverage, so a new 10-Q/10-K changes the current fingerprint.
 * Returns why a fresh Deep Dive is needed, or undefined when a reusable report already exists.
 */
export async function detectDeepDiveRefresh(
  store: ProductStore,
  input: { ticker: string; currentFingerprint: string; nowIso: string }
): Promise<DeepDiveRefreshReason | undefined> {
  const reusable = await store.findReusableDeepDiveReport({
    ticker: input.ticker,
    fingerprint: input.currentFingerprint,
    nowIso: input.nowIso
  });
  if (reusable) {
    return undefined;
  }
  // Fingerprint format (server.ts deepDiveFingerprint): TICKER|SCHEMA_VERSION|LATEST_PERIOD.
  const schemaVersion = input.currentFingerprint.split("|")[1] ?? "0";
  const latest: ReportRecord | undefined = await store.findLatestComparableDeepDiveReport({
    ticker: input.ticker,
    schemaMajor: Number.parseInt(schemaVersion, 10),
    sinceIso: new Date(0).toISOString()
  });
  if (!latest) {
    return "no_report";
  }
  return latest.fingerprint === input.currentFingerprint ? "expired" : "new_filing";
}

/**
 * Queues system-owned Deep Dive jobs (no user) for covered tickers that need one. The worker
 * stores the result through the normal job-complete path, so user requests reuse it.
 */
export async function runDeepDivePrecompute(
  runtime: PrecomputeRuntime,
  fingerprintFor: (ticker: string, latestPeriod?: string) => string
): Promise<{ queued: Array<{ ticker: string; reason: DeepDiveRefreshReason; job_id: string }>; in_flight: number }> {
  const pending = new Set(await runtime.store.listPendingPrecomputeDeepDiveTickers());
  const slots = Math.min(
    runtime.config.deepDivePrecomputeBatchSize,
    runtime.config.deepDivePrecomputeMaxInFlight - pending.size
  );
  const queued: Array<{ ticker: string; reason: DeepDiveRefreshReason; job_id: string }> = [];
  if (slots <= 0) {
    return { queued, in_flight: pending.size };
  }

  const nowIso = new Date().toISOString();
  for (const ticker of await listCoveredTickers(runtime.store)) {
    if (queued.length >= slots) {
      break;
    }
    if (pending.has(ticker)) {
      continue;
    }
    const coverage = await runtime.store.getTickerCoverageByTicker(ticker);
    const reason = await detectDeepDiveRefresh(runtime.store, {
      ticker,
      currentFingerprint: fingerprintFor(ticker, coverage?.latest_period ?? undefined),
      nowIso
    });
    if (!reason) {
      continue;
    }
    const job = await runtime.store.createJob({ id: createId(), type: "deep_dive", ticker, createdAt: nowIso });
    try {
      await runtime.queue.publish(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queue publish failed";
      await runtime.store.markJobFailed(job.id, new Date().toISOString(), message);
      throw error;
    }
    queued.push({ ticker, reason, job_id: job.id });
  }

  return { queued, in_flight: pending.size + queued.length };
}
