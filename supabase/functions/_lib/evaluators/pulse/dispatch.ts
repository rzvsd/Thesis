// POST /internal/pulse/dispatch. Copied from apps/product-api/src/server.ts (the route and processMarketPulseJob).
// Body: { cycle_start?, cycle_end?, force_fail?, inputs: { market_tape?, macro?, structural?, companies?,
// first_party?, news?, calendar_events? } } (see inputs.ts). The daily job sends the inputs.
//
// Change from the old server: it answered 202 at once and built the issue later with setImmediate. An Edge
// Function cannot keep working after its response, so the build now runs inside the request and the response
// arrives after the build. Status codes stay: 202 { deduplicated: false, job } for a new job (already complete
// or failed when it is returned), 200 { deduplicated: true, job } when the cycle already has a job that did not fail.
// Pulse emails (dispatchPulseEmails) are M4's and are not sent here.
import { logError, logInfo } from "../../../_shared/log.ts";
import { isMarketPulseReport } from "../../pulse/validate.ts";
import { appendAudit } from "../audit.ts";
import type { EvaluatorDeps } from "../deps.ts";
import { type EvalMeta, type EvalResult, ok, validation } from "../result.ts";
import { createId } from "../util.ts";
import type { MarketPulseReport } from "./contracts.ts";
import { calendarFromInputs, newsFromInputs, parsePulseInputs, type PulseInputs } from "./inputs.ts";
import { notifyPulseReady } from "./notify.ts";
import { buildMarketPulseReport } from "./report_builder.ts";
import type { PulseArtifacts, PulseJobRecord, PulseJobStore } from "./store.ts";
import { assertIncomingMarketPulseReport } from "./validation.ts";

export interface PulseDeps {
  evaluator: EvaluatorDeps;
  jobs: PulseJobStore;
  artifacts: PulseArtifacts;
  // MARKET_PULSE_TICKERS and MARKET_PULSE_SCHEMA_VERSION of the old config.
  tickers: string[];
  schemaVersion: string;
}

export const defaultPulseTickers = ["AAPL", "MSFT", "TSLA"];
export const defaultPulseSchemaVersion = "1.0.0";

// parseCsv from apps/product-api/src/config.ts.
export function parseTickerList(
  value: string | undefined,
  fallback: string[] = defaultPulseTickers,
): string[] {
  if (!value) return fallback;
  const parsed = value.split(",").map((entry) => entry.trim().toUpperCase()).filter((entry) =>
    entry.length > 0
  );
  return parsed.length > 0 ? parsed : fallback;
}

const route = "/internal/pulse/dispatch";

// buildJobStatusResponse of the old server.
export function jobStatusResponse(job: PulseJobRecord): Record<string, unknown> {
  return {
    job_id: job.id,
    type: job.type,
    status: job.status,
    ticker: job.ticker,
    report_id: job.reportId,
    created_at: job.createdAt,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    error_message: job.errorMessage,
  };
}

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function optionalText(value: unknown): string | undefined | false {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return false;
  return value.trim() || undefined;
}

// Edge Functions stop a request after 150 s, so an open build older than this can never finish.
export const STALE_PULSE_JOB_MS = 5 * 60_000;

export function isStalePulseJob(job: PulseJobRecord, now: Date): boolean {
  if (job.status !== "queued" && job.status !== "running") return false;
  const since = Date.parse(job.startedAt ?? job.createdAt);
  return Number.isFinite(since) && now.getTime() - since > STALE_PULSE_JOB_MS;
}

export async function dispatchMarketPulse(
  deps: PulseDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const now = deps.evaluator.now();
  const rawEnd = optionalText(body.cycle_end);
  const rawStart = optionalText(body.cycle_start);
  if (rawEnd === false || rawStart === false) {
    return validation("cycle_start and cycle_end must be valid ISO datetime strings.");
  }
  const cycleEnd = rawEnd || now.toISOString();
  const cycleStart = rawStart || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const forceFail = body.force_fail === true;

  if (!isIsoDateTime(cycleStart) || !isIsoDateTime(cycleEnd)) {
    return validation("cycle_start and cycle_end must be valid ISO datetime strings.");
  }
  if (Date.parse(cycleStart) >= Date.parse(cycleEnd)) {
    return validation("cycle_start must be before cycle_end.");
  }

  const existing = await deps.jobs.findJobByCycleStart(cycleStart);
  if (existing && existing.status !== "failed") {
    // A queued or running build older than the function's wall clock was cut off (no sweeper covers Pulse
    // jobs). Fail it and build again, so a retry of the daily step recovers the cycle.
    if (!isStalePulseJob(existing, now)) {
      return ok({ deduplicated: true, job: jobStatusResponse(existing) });
    }
    await deps.jobs.markJobFailed(existing.id, now.toISOString(), "Pulse build stopped before finishing.");
    logInfo("Stale Pulse job failed before rebuild", { job_id: existing.id });
  }

  const job = await deps.jobs.createJob({
    id: createId(),
    ticker: forceFail ? "FORCE_FAIL" : undefined,
    cycleStart,
    cycleEnd,
    createdAt: now.toISOString(),
  });
  await appendAudit(deps.evaluator.store, "job.queued", {
    request_id: meta.requestId,
    route: meta.route,
    job_id: job.id,
    status: "queued",
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
  });
  logInfo("Pulse job queued", {
    request_id: meta.requestId,
    job_id: job.id,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
  });

  // The response now waits for the build (see the note at the top).
  const finished = await processMarketPulseJob(deps, job, parsePulseInputs(body.inputs));
  return ok({ deduplicated: false, job: jobStatusResponse(finished) }, 202);
}

async function previousPulseReport(deps: PulseDeps, jobId: string): Promise<MarketPulseReport | undefined> {
  try {
    const key = await deps.jobs.latestPulseArtifactKey();
    if (!key) return undefined;
    const artifact = await deps.artifacts.read(key);
    return isMarketPulseReport(artifact) ? artifact as MarketPulseReport : undefined;
  } catch (error) {
    logError("Previous Market Pulse unavailable for editorial delta", {
      job_id: jobId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return undefined;
  }
}

// Old cleanupStoredReport. M1's artifacts module has no delete, so the Storage object stays; with no
// reports row pointing at it, nothing serves it.
async function cleanupStoredReport(deps: PulseDeps, reportId: string): Promise<void> {
  try {
    await deps.jobs.deleteReport(reportId);
  } catch (error) {
    logError("Report cleanup warning", {
      report_id: reportId,
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function processMarketPulseJob(
  deps: PulseDeps,
  job: PulseJobRecord,
  inputs: PulseInputs,
): Promise<PulseJobRecord> {
  const store = deps.evaluator.store;
  const nowIso = () => deps.evaluator.now().toISOString();
  const running = await deps.jobs.markJobRunning(job.id, nowIso());
  if (!running) return job;
  await appendAudit(store, "job.running", { route, job_id: running.id, status: "running" }, running.userId);

  const cycleStart = running.cycleStart ??
    new Date(deps.evaluator.now().getTime() - 86_400_000).toISOString();
  const cycleEnd = running.cycleEnd ?? nowIso();

  try {
    if (running.ticker === "FORCE_FAIL") {
      throw new Error("Forced market pulse failure");
    }

    const previousReport = await previousPulseReport(deps, running.id);
    const calendar = calendarFromInputs(inputs, nowIso());
    if (calendar.fetchState === "data_unavailable") {
      logInfo("Market Pulse earnings calendar unavailable", {
        job_id: running.id,
        error: calendar.unavailableReason,
      });
    }
    // M4 (old milestone): approved-source headlines feed the headline digest and macro/geopolitical news pack.
    const news = newsFromInputs(inputs);
    if (news.unavailableReason) {
      logInfo("Market Pulse approved headlines unavailable", {
        job_id: running.id,
        error: news.unavailableReason,
      });
    }

    const pulseReport = buildMarketPulseReport({
      cycleStart,
      cycleEnd,
      schemaVersion: deps.schemaVersion,
      tickers: deps.tickers,
      inputs,
      previousReport,
      calendarEvents: calendar.events,
      calendarFetchState: calendar.fetchState,
      calendarUnavailableReason: calendar.unavailableReason,
      headlineItems: news.headlineItems,
      macroNewsFetchState: news.fetchState,
      macroNewsUnavailableReason: news.unavailableReason,
    });
    const report = assertIncomingMarketPulseReport(pulseReport);

    let stored = false;
    try {
      const artifactKey = await deps.artifacts.write(report);
      await deps.jobs.createReport({
        id: report.report_id,
        jobId: running.id,
        schemaVersion: report.schema_version,
        artifactKey,
        createdAt: report.cycle_end,
        isCurrent: true,
      });
      stored = true;

      const completed = await deps.jobs.markJobComplete(running.id, nowIso(), report.report_id);
      if (!completed) {
        await cleanupStoredReport(deps, report.report_id);
        return await deps.jobs.markJobFailed(running.id, nowIso(), "Job was not found for completion.") ??
          running;
      }
      await appendAudit(store, "job.complete", {
        route,
        job_id: completed.id,
        report_id: report.report_id,
        status: "complete",
      }, completed.userId);

      const unavailableFlags = report.flags.filter((flag) => flag.startsWith("data_unavailable:"));
      if (unavailableFlags.length > 0) {
        logError("Market Pulse degraded with unavailable data", {
          job_id: completed.id,
          report_id: report.report_id,
          unavailable_flags: unavailableFlags.join(","),
        });
      }

      const push = await notifyPulseReady(deps.evaluator, report);
      logInfo("Market Pulse push delivery attempted", { job_id: completed.id, ...push });
      if (push.failed > 0) {
        logError("Push delivery partially failed", { job_id: completed.id, ...push });
      }
      await appendAudit(
        store,
        "market_pulse.push_delivery",
        { route, job_id: completed.id, ...push },
        completed.userId,
      );
      return completed;
    } catch (error) {
      if (stored) await cleanupStoredReport(deps, report.report_id);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market Pulse processing failed";
    const failed = await deps.jobs.markJobFailed(running.id, nowIso(), message);
    await appendAudit(store, "job.failed", {
      route,
      job_id: running.id,
      status: "failed",
      error_message: message,
    }, failed?.userId);
    logError("Market Pulse job failed", { job_id: running.id, error_message: message });
    return failed ?? running;
  }
}
