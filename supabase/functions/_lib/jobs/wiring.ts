// Builds the real dependencies for the Deep Dive routes. Tests build their own fakes instead.
import { db, type Sql } from "../../_shared/db.ts";
import { env } from "../../_shared/env.ts";
import { logError } from "../../_shared/log.ts";
import { supabaseStorageArtifacts } from "./artifacts.ts";
import { githubActionsRunner } from "./dispatch.ts";
import { pushSenderFromEnv } from "../push/index.ts";
import { enrichAnalysisReportIssuer, fetchStructuralContext } from "../reports/issuer.ts";
import { appendAuditEvent, getSupportedTicker } from "../store/reports.ts";
import {
  applyCompletionEffects,
  dispatchFilingChangeAlerts,
  type EffectsDeps,
  findPriorDeepDive,
  noopNotifier,
  postgresEffectsStore,
} from "./effects/index.ts";
import { type HistoricalSource, postgresHistoricalSource } from "./historical.ts";
import type { CompletionEffects, JobsDeps } from "./service.ts";
import { postgresJobsStore } from "./store.ts";

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function requestIdOf(req: Request): string {
  const given = req.headers.get("x-request-id") ?? "";
  return /^[\w.-]{1,100}$/.test(given) ? given : crypto.randomUUID();
}

// Work that runs after the response. Edge Functions keep the worker alive for it (contract findings).
export function background(work: Promise<unknown>): void {
  const guarded = work.catch(() => logError("Background work failed"));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(guarded);
}

// Latest close for contrarian anchors and price-move kill switches, from M3's app.market_prices_daily (filled by
// its daily price job). Same rule as M3's evaluator price query: the newest close no older than 5 days. No price,
// or a failed query, skips the anchor, exactly as the old server did when its price service was down.
export const LATEST_CLOSE_MAX_AGE_DAYS = 5;

export function postgresLatestClose(
  sql: Sql,
  now: () => Date = () => new Date(),
): (ticker: string) => Promise<number | undefined> {
  return async (ticker) => {
    const asOf = now().toISOString().slice(0, 10);
    try {
      const rows = await sql`select close from market_prices_daily
          where ticker = ${ticker.trim().toUpperCase()}
            and market_date <= ${asOf}::date
            and market_date >= ${asOf}::date - ${LATEST_CLOSE_MAX_AGE_DAYS}::int
          order by market_date desc limit 1`;
      const close = Number(rows[0]?.close);
      return Number.isFinite(close) && close > 0 ? close : undefined;
    } catch {
      logError("Latest close lookup failed", { ticker });
      return undefined;
    }
  };
}

export function completionEffects(deps: EffectsDeps): CompletionEffects {
  return {
    // A failed enrichment never blocks completion (the old server degraded the same way).
    enrichIssuer: (report) =>
      enrichAnalysisReportIssuer({ getSupportedTicker, fetchStructuralContext }, report)
        .catch(() => report),
    audit: appendAuditEvent,
    apply: (input) => applyCompletionEffects(deps, input),
    findPrior: (report) => findPriorDeepDive(deps.store, report),
    filingAlerts: (report, prior) => dispatchFilingChangeAlerts(deps, { report, prior }),
  };
}

export function jobsDeps(): JobsDeps {
  const sql = db();
  const artifacts = supabaseStorageArtifacts();
  const effectsDeps: EffectsDeps = {
    store: postgresEffectsStore(sql),
    latestClose: postgresLatestClose(sql),
    // Push goes through M4's sender (PUSH_PROVIDER_MODE, disabled by default). Email stays a no-op for now.
    notifier: { ...noopNotifier, sendPush: (targets, payload) => pushSenderFromEnv().send(targets, payload) },
    readReport: (key) => artifacts.readReport(key),
  };
  return {
    store: postgresJobsStore(sql),
    artifacts,
    runner: githubActionsRunner(),
    effects: completionEffects(effectsDeps),
    dailyCap: intEnv("DEEP_DIVE_DAILY_CAP", 15),
    config: {
      dailyCap: intEnv("DEEP_DIVE_DAILY_CAP", 15),
      reuseFreshnessHours: intEnv("DEEP_DIVE_REUSE_FRESHNESS_HOURS", 24),
      // Safety cap only: a new filing ends reuse earlier by changing the fingerprint. 182.5 days covers the
      // longest gap between two filings (Q3 10-Q to a late 10-K), so the cap does not end reuse before it.
      precomputeFreshnessHours: intEnv("DEEP_DIVE_PRECOMPUTE_FRESHNESS_HOURS", 4380),
      // No filing period known yet: reuse the newest fresh report for the ticker if younger than this (a quarter).
      unknownCoverageReuseHours: intEnv("DEEP_DIVE_UNKNOWN_COVERAGE_REUSE_HOURS", 2160),
      subscriptionTimezone: env("SUBSCRIPTION_TIMEZONE") ?? "America/New_York",
    },
    background,
  };
}

export function historicalDeps(): {
  source: HistoricalSource;
  audit: (eventType: string, payload: Record<string, unknown>, userId?: string) => Promise<void>;
} {
  return {
    source: postgresHistoricalSource(db()),
    audit: appendAuditEvent,
  };
}
