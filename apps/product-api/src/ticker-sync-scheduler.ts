import { captureException } from "../../../packages/observability/src/sentry";

import { logError, logInfo, logWarn } from "./logging";
import type { ProductStore } from "./store";
import {
  loadTickerSyncRuntimeConfigFromEnv,
  runTickerRegistrySync,
  type TickerSyncRuntimeConfig
} from "./ticker-registry-sync";

export interface SchedulerOptions {
  enabled: boolean;
  runOnStartup: boolean;
  deltaIntervalSeconds: number;
  fullIntervalSeconds: number;
}

interface TickerSyncScheduler {
  close(): Promise<void>;
}

function toPositiveIntervalSeconds(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadTickerSchedulerOptions(
  env: NodeJS.ProcessEnv = process.env
): SchedulerOptions {
  const enabled = (env.TICKER_AUTO_SYNC_ENABLED ?? "true").toLowerCase();
  const runOnStartup = (env.TICKER_AUTO_SYNC_RUN_ON_STARTUP ?? "true").toLowerCase();
  const deltaIntervalSeconds = Number.parseInt(
    env.TICKER_DELTA_SYNC_INTERVAL_SECONDS ?? "900",
    10
  );
  const fullIntervalSeconds = Number.parseInt(
    env.TICKER_FULL_SYNC_INTERVAL_SECONDS ?? "86400",
    10
  );

  return {
    enabled: ["1", "true", "yes", "on"].includes(enabled),
    runOnStartup: ["1", "true", "yes", "on"].includes(runOnStartup),
    deltaIntervalSeconds: toPositiveIntervalSeconds(deltaIntervalSeconds, 900),
    fullIntervalSeconds: toPositiveIntervalSeconds(fullIntervalSeconds, 86400)
  };
}

async function runScheduledSync(
  store: ProductStore,
  baseConfig: TickerSyncRuntimeConfig,
  mode: "full" | "delta",
  lock: { running: boolean }
): Promise<void> {
  if (lock.running) {
    logWarn("Ticker sync skipped because previous run is still active", {
      mode
    });
    return;
  }

  lock.running = true;
  try {
    await runTickerRegistrySync(store, {
      ...baseConfig,
      mode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticker sync scheduler failure";
    logError("Ticker sync scheduler run failed", {
      mode,
      error_message: message
    });
    captureException(new Error(message), {
      service: "product-api",
      ticker_sync_mode: mode
    });
  } finally {
    lock.running = false;
  }
}

export function startTickerSyncScheduler(
  store: ProductStore,
  options: SchedulerOptions,
  env: NodeJS.ProcessEnv = process.env
): TickerSyncScheduler {
  const baseConfig = loadTickerSyncRuntimeConfigFromEnv(env);
  const lock = { running: false };
  const timers: Array<NodeJS.Timeout> = [];

  if (!options.enabled) {
    logInfo("Ticker auto sync disabled", {});
    return {
      async close(): Promise<void> {
        return Promise.resolve();
      }
    };
  }

  if (options.runOnStartup) {
    void runScheduledSync(store, baseConfig, "full", lock);
    void runScheduledSync(store, baseConfig, "delta", lock);
  }

  timers.push(
    setInterval(() => {
      void runScheduledSync(store, baseConfig, "delta", lock);
    }, options.deltaIntervalSeconds * 1000)
  );
  timers.push(
    setInterval(() => {
      void runScheduledSync(store, baseConfig, "full", lock);
    }, options.fullIntervalSeconds * 1000)
  );

  logInfo("Ticker auto sync scheduler started", {
    delta_interval_seconds: options.deltaIntervalSeconds,
    full_interval_seconds: options.fullIntervalSeconds,
    run_on_startup: options.runOnStartup
  });

  return {
    async close(): Promise<void> {
      for (const timer of timers) {
        clearInterval(timer);
      }
      logInfo("Ticker auto sync scheduler stopped", {});
    }
  };
}
