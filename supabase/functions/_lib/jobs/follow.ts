// One Deep Dive per company per filing (Razvan, 2026-11-24). A request for a ticker that another customer's
// open run already covers does not start a second run: its job "follows" that run and gets a copy of the
// report when it completes. Copying a stored report onto a job is shared with the reuse path in service.ts.
import { logError, logInfo } from "../../_shared/log.ts";
import { assertIncomingAnalysisReport } from "../reports/validation.ts";
import type { JobsDeps } from "./service.ts";
import { MSG_NOT_STARTED, sweepOnPoll } from "./sweeper.ts";
import type { AnalysisReport, JobRecord, ReportRecord } from "./types.ts";

export const ROUTE_POLL = "/jobs/:id";

function stamp(deps: { now?: () => Date }): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

export type AttachResult =
  | { kind: "complete"; job: JobRecord; reportId: string }
  | { kind: "artifact_missing" }
  // Someone else finished or failed the job first; nothing of this attempt is kept.
  | { kind: "lost"; job?: JobRecord };

// Stores a copy of `source` as this job's report and completes the job. Throws on storage errors after cleaning
// up what it created. The copy keeps the source's fingerprint and expiry, as the old reuse path did.
export async function attachReportCopy(
  deps: JobsDeps,
  job: JobRecord,
  source: ReportRecord,
  ctx: { requestId: string; route: string; auditEvent: string },
): Promise<AttachResult> {
  const artifact = await deps.artifacts.readReport(source.artifactKey);
  if (!artifact || !("job_id" in artifact)) return { kind: "artifact_missing" };

  const nowIso = stamp(deps);
  const reportId = crypto.randomUUID();
  let artifactKey: string | undefined;
  let stored = false;
  const cleanup = async () => {
    const tasks: Promise<unknown>[] = [];
    if (stored) tasks.push(deps.store.deleteReport(reportId));
    if (artifactKey) tasks.push(deps.artifacts.deleteReport(artifactKey));
    for (const r of await Promise.allSettled(tasks)) {
      if (r.status === "rejected") logError("Report cleanup warning", { report_id: reportId });
    }
  };
  let report: AnalysisReport;
  let completed: JobRecord | undefined;
  try {
    const enriched = await deps.effects.enrichIssuer(assertIncomingAnalysisReport(artifact));
    report = { ...enriched, report_id: reportId, job_id: job.id, generated_at: nowIso };
    artifactKey = await deps.artifacts.writeReport(report);
    await deps.store.createReport({
      id: reportId,
      jobId: job.id,
      type: report.type,
      ticker: report.ticker,
      schemaVersion: report.schema_version,
      artifactKey,
      fingerprint: source.fingerprint,
      freshnessExpiresAt: source.freshnessExpiresAt,
      createdAt: nowIso,
      isCurrent: true,
    });
    stored = true;
    completed = await deps.store.markJobComplete(job.id, nowIso, reportId);
  } catch (err) {
    await cleanup();
    throw err;
  }
  if (!completed) {
    await cleanup();
    return { kind: "lost", job: await deps.store.getJob(job.id) };
  }

  try {
    await deps.effects.audit(ctx.auditEvent, {
      request_id: ctx.requestId,
      route: ctx.route,
      job_id: completed.id,
      report_id: reportId,
      source_report_id: source.id,
      ticker: completed.ticker,
      fingerprint: source.fingerprint,
    }, completed.userId);
    await deps.effects.apply({
      report,
      userId: completed.userId,
      requestId: ctx.requestId,
      route: ctx.route,
      includeMonitorSnapshot: false,
    });
  } catch {
    logError("Copied report side effects failed", { job_id: completed.id, report_id: reportId });
  }
  return { kind: "complete", job: completed, reportId };
}

// Brings a follower up to date with the run it follows: copies the report once that run is complete, fails
// the follower if that run failed, and otherwise leaves it queued. Polling also keeps the followed run moving
// (re-dispatch, timeouts) even when its own customer has stopped polling.
export async function resolveFollower(
  deps: JobsDeps,
  job: JobRecord,
  requestId = "poll",
): Promise<JobRecord> {
  if (!job.followsJobId || job.status !== "queued") return job;
  let leader = await deps.store.getJob(job.followsJobId);
  if (leader && (leader.status === "queued" || leader.status === "running")) {
    leader = await sweepOnPoll(deps, leader);
  }
  if (leader?.status === "queued" || leader?.status === "running") return job;

  const failWith = async (message: string) =>
    (await deps.store.failIfStatus(job.id, "queued", stamp(deps), message)) ??
      (await deps.store.getJob(job.id)) ?? job;

  if (leader?.status !== "complete" || !leader.reportId) {
    return await failWith(leader?.errorMessage ?? MSG_NOT_STARTED);
  }
  const source = await deps.store.getReport(leader.reportId);
  if (!source) return await failWith(MSG_NOT_STARTED);
  try {
    const result = await attachReportCopy(deps, job, source, {
      requestId,
      route: ROUTE_POLL,
      auditEvent: "job.followed",
    });
    if (result.kind === "complete") {
      logInfo("Followed run's report attached", { job_id: job.id, report_id: result.reportId });
      return result.job;
    }
    if (result.kind === "lost") return result.job ?? job;
    return await failWith("Report artifact missing. Please retry.");
  } catch {
    logError("Attaching the followed report failed", { job_id: job.id });
    return await failWith("Deep Dive could not be finished. Please retry.");
  }
}

// The poll-time check for any Deep Dive job: followers wait on their run, other jobs go through the sweeper.
export function pollJob(deps: JobsDeps, job: JobRecord): Promise<JobRecord> {
  return job.followsJobId ? resolveFollower(deps, job) : sweepOnPoll(deps, job);
}

// After a run completes or fails: give every waiting follower its copy, or fail it. Never throws.
export async function settleFollowers(deps: JobsDeps, leaderId: string, requestId: string): Promise<void> {
  try {
    for (const follower of await deps.store.listOpenFollowers(leaderId)) {
      await resolveFollower(deps, follower, requestId);
    }
  } catch {
    logError("Completing followers failed", { job_id: leaderId });
  }
}
