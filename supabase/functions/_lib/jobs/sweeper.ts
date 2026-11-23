// Poll-time sweeper (C1). GET /jobs/:id runs it before answering, so a stuck job is fixed while the app
// waits, at zero Actions minutes. The pg_cron job in the M2 migration covers jobs nobody polls.
import { logInfo } from "../../_shared/log.ts";
import type { Runner } from "./dispatch.ts";
import type { JobsStore } from "./store.ts";
import type { JobRecord } from "./types.ts";

// A runner normally claims within a minute of dispatch; Actions can queue a run for a while.
export const QUEUED_REDISPATCH_MS = 120_000;
export const MAX_DISPATCH_ATTEMPTS = 3;
// The workflow's timeout is 10 minutes; past that the run is gone.
export const RUNNING_TIMEOUT_MS = 10.5 * 60_000;
// After this long running, ask the runner host whether the run still exists.
export const RUN_CHECK_AFTER_MS = 30_000;
export const RUN_CHECK_EVERY_MS = 20_000;

export const MSG_NOT_STARTED = "Deep Dive could not start. Please retry.";
export const MSG_RUNNER_STOPPED = "Deep Dive runner stopped before finishing. Please retry.";

export interface SweepDeps {
  store: JobsStore;
  runner: Runner;
  dailyCap: number;
  now?: () => Date;
}

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type DispatchResult = "started" | "cap_reached" | "lost_race" | "error";

// Starts a runner for a queued job, inside the global daily cap (C2). Every start counts, re-dispatches too.
export async function dispatchJob(
  deps: SweepDeps,
  job: JobRecord,
  previousDispatchedAt?: string | null,
): Promise<DispatchResult> {
  const now = (deps.now ?? (() => new Date()))();
  const day = utcDate(now);
  if (!(await deps.store.reserveDispatch(day, deps.dailyCap))) {
    logInfo("Daily dispatch cap reached", { job_id: job.id });
    return "cap_reached";
  }
  const marked = await deps.store.markDispatched(job.id, now.toISOString(), previousDispatchedAt);
  if (!marked) {
    await deps.store.releaseDispatch(day);
    return "lost_race";
  }
  try {
    await deps.runner.dispatch(job.id);
    logInfo("Runner dispatched", { job_id: job.id, attempt: marked.attempts });
    return "started";
  } catch (err) {
    await deps.store.releaseDispatch(day);
    logInfo("Runner dispatch failed", {
      job_id: job.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return "error";
  }
}

export async function sweepOnPoll(deps: SweepDeps, job: JobRecord): Promise<JobRecord> {
  if (job.type !== "deep_dive") return job;
  const now = (deps.now ?? (() => new Date()))();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  if (job.status === "queued") {
    const last = Date.parse(job.dispatchedAt ?? job.createdAt);
    if (nowMs - last < QUEUED_REDISPATCH_MS) return job;
    if (job.attempts < MAX_DISPATCH_ATTEMPTS) {
      const result = await dispatchJob(deps, job, job.dispatchedAt ?? null);
      // Started, or another poll started it: show the fresh row.
      if (result === "started" || result === "lost_race") return (await deps.store.getJob(job.id)) ?? job;
      // A runner already got its chance and the cap or the host blocks a new one: keep waiting for it;
      // the next poll, or pg_cron after 15 minutes, decides.
      if (job.attempts > 0) return job;
    }
    const failed = await deps.store.failIfStatus(job.id, "queued", nowIso, MSG_NOT_STARTED);
    if (failed) logInfo("Queued job failed by sweeper", { job_id: job.id, attempts: job.attempts });
    return failed ?? (await deps.store.getJob(job.id)) ?? job;
  }

  if (job.status === "running") {
    const started = Date.parse(job.startedAt ?? job.createdAt);
    if (nowMs - started > RUNNING_TIMEOUT_MS) {
      const failed = await deps.store.failIfStatus(job.id, "running", nowIso, MSG_RUNNER_STOPPED);
      if (failed) logInfo("Running job timed out", { job_id: job.id });
      return failed ?? (await deps.store.getJob(job.id)) ?? job;
    }
    const checked = job.checkedAt ? Date.parse(job.checkedAt) : 0;
    if (job.runUrl && nowMs - started > RUN_CHECK_AFTER_MS && nowMs - checked > RUN_CHECK_EVERY_MS) {
      await deps.store.markChecked(job.id, nowIso);
      const state = await deps.runner.runState(job.runUrl);
      if (state === "finished") {
        // The runner reports complete or fail before its run ends, so a finished run with a running job
        // means the run was cancelled or crashed.
        const failed = await deps.store.failIfStatus(job.id, "running", nowIso, MSG_RUNNER_STOPPED);
        if (failed) logInfo("Runner gone, job failed", { job_id: job.id });
        return failed ?? (await deps.store.getJob(job.id)) ?? job;
      }
    }
  }
  return job;
}
