// Deep Dive job logic behind POST /jobs, GET /jobs/:id and the runner's internal routes.
// Copied from the old handlers in apps/product-api/src/server.ts; queue plumbing replaced by dispatch.ts.
import { apiError, json } from "../../_shared/http.ts";
import { logError, logInfo } from "../../_shared/log.ts";
import type { ArtifactStore } from "./artifacts.ts";
import { assertIncomingAnalysisReport } from "../reports/validation.ts";
import type { JobsStore } from "./store.ts";
import { dispatchJob, type SweepDeps, sweepOnPoll } from "./sweeper.ts";
import type { AnalysisReport, AnalysisRequest, JobRecord, JobStatusResponse, ReportRecord } from "./types.ts";

// The side effects of a stored report. Implemented in effects/ (see wiring.ts); faked in tests.
export interface CompletionEffects {
  enrichIssuer(report: AnalysisReport): Promise<AnalysisReport>;
  audit(eventType: string, payload: Record<string, unknown>, userId?: string): Promise<void>;
  apply(input: {
    report: AnalysisReport;
    userId?: string;
    requestId: string;
    route: string;
    includeMonitorSnapshot: boolean;
  }): Promise<void>;
  findPrior(report: AnalysisReport): Promise<ReportRecord | undefined>;
  // Never throws. Runs after the response.
  filingAlerts(report: AnalysisReport, prior: ReportRecord | undefined): Promise<void>;
}

export interface JobsConfig {
  dailyCap: number;
  reuseFreshnessHours: number;
  precomputeFreshnessHours: number;
  subscriptionTimezone: string;
}

export interface JobsDeps extends SweepDeps {
  store: JobsStore;
  artifacts: ArtifactStore;
  effects: CompletionEffects;
  config: JobsConfig;
  // Work after the response (EdgeRuntime.waitUntil in production).
  background: (work: Promise<unknown>) => void;
}

export const TICKER_RE = /^[A-Z.-]{1,12}$/;
export const MSG_CAP = "Deep Dives are busy today. Please try again tomorrow.";

export function buildJobStatusResponse(job: JobRecord): JobStatusResponse {
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

export function deepDiveFingerprint(input: { ticker: string; schemaVersion: string; latestPeriod?: string }) {
  const latestPeriod = input.latestPeriod?.trim().toUpperCase() || "LATEST_UNKNOWN";
  return `${input.ticker.trim().toUpperCase()}|${input.schemaVersion.trim()}|${latestPeriod}`;
}

// Limit for on-demand generation only. -1 = no limit. Same as the old server.
export function dailyDeepDiveLimitForTier(tier: "FREE" | "PRO"): number {
  return tier === "PRO" ? -1 : 1;
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}

function stamp(deps: { now?: () => Date }): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function upgradeRequired(feature: string, message: string): Response {
  return json({ error: "upgrade_required", feature, error_message: message }, 403);
}

async function cleanupStoredReport(deps: JobsDeps, reportId: string, artifactKey?: string) {
  const tasks: Promise<unknown>[] = [deps.store.deleteReport(reportId)];
  if (artifactKey) tasks.push(deps.artifacts.deleteReport(artifactKey));
  for (const r of await Promise.allSettled(tasks)) {
    if (r.status === "rejected") logError("Report cleanup warning", { report_id: reportId });
  }
}

// POST /jobs
export async function createDeepDiveJob(
  deps: JobsDeps,
  input: { userId: string; ticker: unknown; requestId: string },
): Promise<Response> {
  const route = "/jobs";
  const ticker = typeof input.ticker === "string" ? input.ticker.trim().toUpperCase() : "";
  const userId = input.userId;
  if (!ticker || !TICKER_RE.test(ticker)) {
    return apiError(422, "validation_failed", "ticker must be a valid US symbol.");
  }
  if (!(await deps.store.isSupportedTicker(ticker))) {
    return apiError(404, "ticker_not_found", "Ticker not found in supported NYSE/NASDAQ universe.");
  }

  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();

  // Same user, same ticker, still open: hand back that job (H1). The app resumes polling it.
  const open = await openJobResponse(deps, userId, ticker);
  if (open) return open;

  const tier = await deps.store.getSubscriptionTier(userId);
  const limit = dailyDeepDiveLimitForTier(tier);
  const usageDate = dateInTimeZone(now, deps.config.subscriptionTimezone);

  const fingerprint = deepDiveFingerprint({
    ticker,
    schemaVersion: "2.0",
    latestPeriod: await deps.store.getCoverageLatestPeriod(ticker),
  });
  const reusable = await deps.store.findReusableDeepDiveReport({ ticker, fingerprint, nowIso });
  if (reusable) {
    return await reuseReport(deps, { userId, ticker, reusable, nowIso, requestId: input.requestId, route });
  }

  // Only on-demand generation counts against the daily limit; a reused report is free to read.
  let usageReserved = false;
  if (limit > 0) {
    if (!(await deps.store.reserveDailyUsage(userId, usageDate, limit))) {
      return upgradeRequired(
        "deep_dive_daily_limit",
        `Daily Deep Dive limit reached for ${tier} tier (${limit}/day).`,
      );
    }
    usageReserved = true;
  }
  const release = async () => {
    if (usageReserved) await deps.store.releaseDailyUsage(userId, usageDate);
  };

  let job: JobRecord | undefined;
  try {
    job = await deps.store.createJob({
      id: crypto.randomUUID(),
      type: "deep_dive",
      userId,
      ticker,
      createdAt: nowIso,
    });
  } catch (err) {
    await release();
    throw err;
  }
  if (!job) {
    // An overlapping request created the job first: give back that one.
    await release();
    return (await openJobResponse(deps, userId, ticker)) ?? queueUnavailable();
  }

  const result = await dispatchJob(deps, job, null);
  if (result !== "started") {
    await release();
    const message = result === "cap_reached" ? MSG_CAP : "Job could not be queued.";
    const failed = await deps.store.markJobFailed(job.id, stamp(deps), message);
    await deps.effects.audit("job.failed", {
      request_id: input.requestId,
      route,
      job_id: job.id,
      status: "failed",
      error_message: message,
    }, userId);
    return json({
      error: "queue_unavailable",
      error_message: message,
      job: failed ? buildJobStatusResponse(failed) : undefined,
    }, 503);
  }

  await deps.effects.audit("job.queued", {
    request_id: input.requestId,
    route,
    job_id: job.id,
    ticker,
    status: "queued",
  }, userId);
  logInfo("Job queued", { user_id: userId, job_id: job.id });
  const fresh = (await deps.store.getJob(job.id)) ?? job;
  return json(buildJobStatusResponse(fresh), 202);
}

// The user's open Deep Dive for the ticker, after the poll-time check, as a 202; undefined when none is open.
async function openJobResponse(
  deps: JobsDeps,
  userId: string,
  ticker: string,
): Promise<Response | undefined> {
  const open = await deps.store.findOpenJob(userId, ticker);
  if (!open) return undefined;
  const swept = await sweepOnPoll(deps, open);
  if (swept.status !== "queued" && swept.status !== "running") return undefined;
  logInfo("Open job returned", { user_id: userId, job_id: swept.id });
  return json(buildJobStatusResponse(swept), 202);
}

function queueUnavailable(): Response {
  return json({ error: "queue_unavailable", error_message: "Job could not be queued." }, 503);
}

async function reuseReport(
  deps: JobsDeps,
  input: {
    userId: string;
    ticker: string;
    reusable: ReportRecord;
    nowIso: string;
    requestId: string;
    route: string;
  },
): Promise<Response> {
  const { userId, ticker, reusable, nowIso } = input;
  const reuseJob = await deps.store.createJob({
    id: crypto.randomUUID(),
    type: "deep_dive",
    userId,
    ticker,
    createdAt: nowIso,
  });
  if (!reuseJob) return (await openJobResponse(deps, userId, ticker)) ?? queueUnavailable();
  const artifact = await deps.artifacts.readReport(reusable.artifactKey);
  if (!artifact || !("job_id" in artifact)) {
    await deps.store.markJobFailed(reuseJob.id, stamp(deps), "Reusable report artifact missing.");
    return apiError(404, "report_not_found", "Reusable report artifact missing.");
  }

  const reportId = crypto.randomUUID();
  let artifactKey: string | undefined;
  try {
    const source = await deps.effects.enrichIssuer(assertIncomingAnalysisReport(artifact));
    const report: AnalysisReport = {
      ...source,
      report_id: reportId,
      job_id: reuseJob.id,
      generated_at: nowIso,
    };
    artifactKey = await deps.artifacts.writeReport(report);
    const persisted = await deps.store.createReport({
      id: report.report_id,
      jobId: reuseJob.id,
      type: report.type,
      ticker: report.ticker,
      schemaVersion: report.schema_version,
      artifactKey,
      fingerprint: reusable.fingerprint,
      freshnessExpiresAt: reusable.freshnessExpiresAt,
      createdAt: report.generated_at,
      isCurrent: true,
    });
    const completed = await deps.store.markJobComplete(reuseJob.id, nowIso, persisted.id);
    if (!completed) {
      await cleanupStoredReport(deps, persisted.id, artifactKey);
      await deps.store.markJobFailed(reuseJob.id, stamp(deps), "Failed to attach reusable report.");
      return apiError(500, "internal_error", "Failed to attach reusable report.");
    }
    await deps.effects.audit("job.reused", {
      request_id: input.requestId,
      route: input.route,
      job_id: completed.id,
      report_id: persisted.id,
      ticker,
      fingerprint: reusable.fingerprint,
    }, userId);
    await deps.effects.apply({
      report,
      userId,
      requestId: input.requestId,
      route: input.route,
      includeMonitorSnapshot: false,
    });
    logInfo("Deep dive report reused", { user_id: userId, job_id: completed.id, report_id: persisted.id });
    return json(buildJobStatusResponse(completed), 200);
  } catch (err) {
    if (artifactKey) await cleanupStoredReport(deps, reportId, artifactKey);
    const message = err instanceof Error ? err.message : "Reusable report handling failed";
    await deps.store.markJobFailed(reuseJob.id, stamp(deps), message);
    logError("Reuse failed", { job_id: reuseJob.id });
    return apiError(500, "internal_error", "Failed to attach reusable report.");
  }
}

// GET /jobs/:id. Someone else's job is a 404, as before.
export async function getDeepDiveJob(deps: JobsDeps, input: { userId: string; jobId: string }) {
  const job = await deps.store.getJob(input.jobId);
  if (!job || job.userId !== input.userId) return apiError(404, "job_not_found", "Job not found.");
  const swept = await sweepOnPoll(deps, job);
  return json(buildJobStatusResponse(swept), 200);
}

// POST /internal/jobs/:id/claim
export async function claimJob(
  deps: JobsDeps,
  input: { jobId: string; runUrl?: string; requestId: string },
): Promise<Response> {
  const runUrl =
    typeof input.runUrl === "string" && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/
        .test(input.runUrl)
      ? input.runUrl
      : undefined;
  const running = await deps.store.claimJob(input.jobId, stamp(deps), runUrl);
  if (!running) return apiError(409, "job_not_claimable", "Job is not queued or does not exist.");
  const analysisRequest: AnalysisRequest = {
    request_id: crypto.randomUUID(),
    type: running.type,
    ticker: running.ticker,
    user_id: running.userId,
    job_id: running.id,
    requested_at: stamp(deps),
  };
  await deps.effects.audit("job.running", {
    request_id: input.requestId,
    route: "/internal/jobs/:id/claim",
    job_id: running.id,
    status: "running",
  }, running.userId);
  return json({ job: buildJobStatusResponse(running), analysis_request: analysisRequest }, 200);
}

// POST /internal/jobs/:id/complete
export async function completeJob(
  deps: JobsDeps,
  input: { jobId: string; body: { report?: unknown; llm_usage?: unknown } | null; requestId: string },
): Promise<Response> {
  const route = "/internal/jobs/:id/complete";
  const { jobId } = input;
  if (!input.body?.report) {
    return apiError(422, "validation_failed", "A valid report payload with matching job_id is required.");
  }
  let report: AnalysisReport;
  try {
    report = assertIncomingAnalysisReport(input.body.report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown report validation error";
    return apiError(422, "validation_failed", "Report failed schema validation before storage.", {
      validation_errors: message.split("; ").filter((e) => e.length > 0),
    });
  }
  report = await deps.effects.enrichIssuer(report);
  if (report.job_id !== jobId) {
    return apiError(422, "validation_failed", "A valid report payload with matching job_id is required.");
  }

  // Retries are safe: a runner whose first complete call succeeded but lost the answer sends the same report
  // again. That gets the same 200, and nothing already stored is rewritten or deleted.
  const job = await deps.store.getJob(jobId);
  if (!job) return apiError(404, "job_not_found", "Job was not found for completion.");
  if (job.status === "complete") {
    return job.reportId === report.report_id
      ? json({ status: "ok", report_id: report.report_id }, 200)
      : apiError(404, "job_not_found", "Job was not found for completion.");
  }
  if (job.status !== "queued" && job.status !== "running") {
    return apiError(404, "job_not_found", "Job was not found for completion.");
  }
  const existingReport = await deps.store.getReport(report.report_id);
  if (existingReport && existingReport.jobId !== jobId) {
    return apiError(422, "validation_failed", "report_id is already used by another job.");
  }

  // Only what this attempt created is cleaned up on error.
  let createdArtifactKey: string | undefined;
  let createdReport = false;
  let prior: ReportRecord | undefined;
  let completed: JobRecord | undefined;
  try {
    prior = await deps.effects.findPrior(report);
    if (!existingReport) {
      const fingerprint = report.type === "deep_dive" && report.ticker
        ? deepDiveFingerprint({
          ticker: report.ticker,
          schemaVersion: report.schema_version,
          latestPeriod: report.historical_context?.latest_period,
        })
        : undefined;
      // Jobs without a user are scheduled pre-computes: they stay reusable until the next filing.
      const hours = job.userId ? deps.config.reuseFreshnessHours : deps.config.precomputeFreshnessHours;
      const freshnessExpiresAt = fingerprint ? addHours(stamp(deps), hours) : undefined;
      const llmUsage = input.body.llm_usage && typeof input.body.llm_usage === "object"
        ? input.body.llm_usage as Record<string, unknown>
        : undefined;
      createdArtifactKey = await deps.artifacts.writeReport(report);
      await deps.store.createReport({
        id: report.report_id,
        jobId: report.job_id,
        type: report.type,
        ticker: report.ticker,
        schemaVersion: report.schema_version,
        artifactKey: createdArtifactKey,
        fingerprint,
        freshnessExpiresAt,
        createdAt: report.generated_at,
        isCurrent: true,
        llmUsage,
      });
      createdReport = true;
    }
    completed = await deps.store.markJobComplete(jobId, stamp(deps), report.report_id);
    if (!completed) {
      // The sweeper failed the job in the meantime. Keep its state; drop what this attempt stored.
      if (createdReport) await cleanupStoredReport(deps, report.report_id, createdArtifactKey);
      else if (createdArtifactKey) await deps.artifacts.deleteReport(createdArtifactKey).catch(() => {});
      return apiError(404, "job_not_found", "Job was not found for completion.");
    }
  } catch (err) {
    if (createdReport) await cleanupStoredReport(deps, report.report_id, createdArtifactKey);
    else if (createdArtifactKey) await deps.artifacts.deleteReport(createdArtifactKey).catch(() => {});
    const message = err instanceof Error ? err.message : "Report completion failed";
    const at = stamp(deps);
    const failed = (await deps.store.failIfStatus(jobId, "running", at, message)) ??
      (await deps.store.failIfStatus(jobId, "queued", at, message));
    logError("Job completion failed", { job_id: jobId });
    return failed
      ? apiError(500, "internal_error", "Product API failed to finalize the report.")
      : apiError(404, "job_not_found", "Job was not found for completion.");
  }

  // The report is stored and the job is complete. A side-effect error is logged; it must not undo that.
  try {
    await deps.effects.audit("job.complete", {
      request_id: input.requestId,
      route,
      job_id: completed.id,
      report_id: report.report_id,
      status: "complete",
    }, completed.userId);
    await deps.effects.apply({
      report,
      userId: completed.userId,
      requestId: input.requestId,
      route,
      includeMonitorSnapshot: true,
    });
  } catch {
    logError("Completion side effects failed", { job_id: jobId, report_id: report.report_id });
  }

  // After the response so the runner is not held by delivery; never throws.
  deps.background(deps.effects.filingAlerts(report, prior));
  logInfo("Job complete", { job_id: jobId, report_id: report.report_id });
  return json({ status: "ok", report_id: report.report_id }, 200);
}

// POST /internal/jobs/:id/fail
export async function failJob(
  deps: JobsDeps,
  input: { jobId: string; errorMessage: unknown; requestId: string },
): Promise<Response> {
  const raw = typeof input.errorMessage === "string" ? input.errorMessage.trim() : "";
  const errorMessage = (raw || "Dexter worker reported a failure.").slice(0, 2000);
  const at = stamp(deps);
  // Only an open job can fail. A late fail call must not overwrite a report that was already stored.
  const failed = (await deps.store.failIfStatus(input.jobId, "running", at, errorMessage)) ??
    (await deps.store.failIfStatus(input.jobId, "queued", at, errorMessage));
  if (!failed) {
    const existing = await deps.store.getJob(input.jobId);
    if (!existing) return apiError(404, "job_not_found", "Job was not found for failure update.");
    return json({ status: "ok" }, 200);
  }
  await deps.effects.audit("job.failed", {
    request_id: input.requestId,
    route: "/internal/jobs/:id/fail",
    job_id: failed.id,
    status: "failed",
    error_message: errorMessage,
  }, failed.userId);
  logInfo("Job failed by runner", { job_id: failed.id });
  return json({ status: "ok" }, 200);
}
