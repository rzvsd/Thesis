import { captureException } from "../../../packages/observability/src/sentry";

import type { ProductApiConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";
import type { JobQueue } from "./queue";
import type { ProductStore } from "./store";

interface JobRecoveryState {
  running: boolean;
  lastRequeueAtMs: Map<string, number>;
}

interface JobRecoveryScheduler {
  close(): Promise<void>;
  runNow(): Promise<JobRecoverySummary | undefined>;
}

export interface JobRecoverySummary {
  queuedCandidates: number;
  requeued: number;
  cooldownSkipped: number;
  timedOutCandidates: number;
  markedFailed: number;
}

function toPositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nowIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export async function runJobRecoveryPass(
  store: ProductStore,
  queue: JobQueue,
  config: ProductApiConfig,
  state: Pick<JobRecoveryState, "lastRequeueAtMs">
): Promise<JobRecoverySummary> {
  const currentMs = Date.now();
  const queuedCutoffIso = nowIso(
    currentMs - toPositiveNumber(config.jobRecoveryQueuedStaleSeconds, 20) * 1000
  );
  const runningCutoffIso = nowIso(
    currentMs - toPositiveNumber(config.jobRecoveryRunningTimeoutSeconds, 180) * 1000
  );
  const batchSize = toPositiveNumber(config.jobRecoveryBatchSize, 100);
  const cooldownMs = toPositiveNumber(config.jobRecoveryRequeueCooldownSeconds, 60) * 1000;

  const queuedCandidates = await store.listRecoverableQueuedDeepDiveJobs(
    queuedCutoffIso,
    batchSize
  );
  let requeued = 0;
  let cooldownSkipped = 0;
  for (const job of queuedCandidates) {
    const lastQueuedAt = state.lastRequeueAtMs.get(job.id);
    if (typeof lastQueuedAt === "number" && currentMs - lastQueuedAt < cooldownMs) {
      cooldownSkipped += 1;
      continue;
    }

    try {
      await queue.publish(job.id);
      state.lastRequeueAtMs.set(job.id, currentMs);
      requeued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError("Queue recovery requeue failed", {
        job_id: job.id,
        error_message: message
      });
      captureException(new Error(message), {
        service: "product-api",
        job_id: job.id,
        queue_recovery_phase: "requeue"
      });
    }
  }

  const timedOutCandidates = await store.listTimedOutRunningDeepDiveJobs(
    runningCutoffIso,
    batchSize
  );
  let markedFailed = 0;
  for (const job of timedOutCandidates) {
    const message = `Job exceeded running timeout (${config.jobRecoveryRunningTimeoutSeconds}s) and was failed by recovery watchdog.`;
    const failed = await store.markJobFailed(job.id, nowIso(currentMs), message);
    if (failed) {
      markedFailed += 1;
      logError("Queue recovery marked stale running job as failed", {
        job_id: job.id,
        error_message: message
      });
      captureException(new Error(message), {
        service: "product-api",
        job_id: job.id,
        queue_recovery_phase: "running_timeout"
      });
    }
  }

  for (const [jobId, timestamp] of state.lastRequeueAtMs.entries()) {
    if (currentMs - timestamp >= cooldownMs * 2) {
      state.lastRequeueAtMs.delete(jobId);
    }
  }

  return {
    queuedCandidates: queuedCandidates.length,
    requeued,
    cooldownSkipped,
    timedOutCandidates: timedOutCandidates.length,
    markedFailed
  };
}

export function startJobRecoveryScheduler(
  store: ProductStore,
  queue: JobQueue,
  config: ProductApiConfig
): JobRecoveryScheduler {
  if (!config.jobRecoveryEnabled || config.queueBackend !== "redis") {
    logInfo("Job recovery scheduler disabled", {
      enabled: config.jobRecoveryEnabled,
      queue_backend: config.queueBackend
    });
    return {
      async close(): Promise<void> {
        return Promise.resolve();
      },
      async runNow(): Promise<JobRecoverySummary | undefined> {
        return undefined;
      }
    };
  }

  const state: JobRecoveryState = {
    running: false,
    lastRequeueAtMs: new Map<string, number>()
  };
  const intervalMs = toPositiveNumber(config.jobRecoveryIntervalSeconds, 30) * 1000;

  const runNow = async (): Promise<JobRecoverySummary | undefined> => {
    if (state.running) {
      logWarn("Job recovery pass skipped because previous pass is still active", {});
      return undefined;
    }

    state.running = true;
    try {
      const summary = await runJobRecoveryPass(store, queue, config, state);
      if (summary.requeued > 0 || summary.markedFailed > 0) {
        logWarn("Job recovery pass completed with corrections", {
          queued_candidates: summary.queuedCandidates,
          requeued: summary.requeued,
          cooldown_skipped: summary.cooldownSkipped,
          running_candidates: summary.timedOutCandidates,
          marked_failed: summary.markedFailed
        });
      }
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError("Job recovery pass failed", {
        error_message: message
      });
      captureException(new Error(message), {
        service: "product-api",
        queue_recovery_phase: "scheduler"
      });
      return undefined;
    } finally {
      state.running = false;
    }
  };

  if (config.jobRecoveryRunOnStartup) {
    void runNow();
  }

  const timer = setInterval(() => {
    void runNow();
  }, intervalMs);
  timer.unref?.();

  logInfo("Job recovery scheduler started", {
    run_on_startup: config.jobRecoveryRunOnStartup,
    interval_seconds: config.jobRecoveryIntervalSeconds,
    queued_stale_seconds: config.jobRecoveryQueuedStaleSeconds,
    running_timeout_seconds: config.jobRecoveryRunningTimeoutSeconds,
    batch_size: config.jobRecoveryBatchSize,
    requeue_cooldown_seconds: config.jobRecoveryRequeueCooldownSeconds
  });

  return {
    async close(): Promise<void> {
      clearInterval(timer);
      logInfo("Job recovery scheduler stopped", {});
    },
    runNow
  };
}
