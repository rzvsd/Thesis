// Builds the real dependencies for the Deep Dive routes. Tests build their own fakes instead.
import { db } from "../../_shared/db.ts";
import { env } from "../../_shared/env.ts";
import { logError } from "../../_shared/log.ts";
import { supabaseStorageArtifacts } from "./artifacts.ts";
import { githubActionsRunner } from "./dispatch.ts";
import {
  appendAudit,
  applyCompletionEffects,
  dispatchFilingChangeAlerts,
  type EffectsDeps,
  enrichAnalysisReportIssuer,
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

// Latest close for contrarian anchors and price-move kill switches. The price data arrives with M3 (its
// research tables and daily job). Until it is wired here, a missing price skips the anchor, exactly as the
// old server did when its price service was down.
function latestClose(_ticker: string): Promise<number | undefined> {
  return Promise.resolve(undefined);
}

export function completionEffects(deps: EffectsDeps): CompletionEffects {
  return {
    enrichIssuer: (report) => enrichAnalysisReportIssuer(deps.store, report),
    audit: (eventType, payload, userId) => appendAudit(deps.store, eventType, payload, userId),
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
    latestClose,
    notifier: noopNotifier,
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
      precomputeFreshnessHours: intEnv("DEEP_DIVE_PRECOMPUTE_FRESHNESS_HOURS", 2160),
      subscriptionTimezone: env("SUBSCRIPTION_TIMEZONE") ?? "America/New_York",
    },
    background,
  };
}

export function historicalDeps(): {
  source: HistoricalSource;
  audit: (eventType: string, payload: Record<string, unknown>, userId?: string) => Promise<void>;
} {
  const sql = db();
  const store = postgresEffectsStore(sql);
  return {
    source: postgresHistoricalSource(sql),
    audit: (eventType, payload, userId) => appendAudit(store, eventType, payload, userId),
  };
}
