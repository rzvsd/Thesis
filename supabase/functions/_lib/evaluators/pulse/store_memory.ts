// In-memory PulseJobStore and PulseArtifacts for tests. Same rules as the SQL in store.ts.
import { artifactKeyFor } from "../../reports/artifacts.ts";
import type { PulseArtifacts, PulseJobRecord, PulseJobStore, PulseReportRow } from "./store.ts";

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryPulseJobStore implements PulseJobStore {
  jobs: PulseJobRecord[] = [];
  reports: PulseReportRow[] = [];

  findJobByCycleStart(cycleStart: string) {
    const at = Date.parse(cycleStart);
    const rows = this.jobs.filter((j) => j.cycleStart && Date.parse(j.cycleStart) === at)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(rows[0] ? clone(rows[0]) : undefined);
  }

  createJob(input: { id: string; ticker?: string; cycleStart: string; cycleEnd: string; createdAt: string }) {
    const job: PulseJobRecord = {
      id: input.id,
      type: "market_pulse",
      status: "queued",
      ticker: input.ticker,
      cycleStart: new Date(input.cycleStart).toISOString(),
      cycleEnd: new Date(input.cycleEnd).toISOString(),
      createdAt: input.createdAt,
    };
    this.jobs.push(job);
    return Promise.resolve(clone(job));
  }

  private update(id: string, when: (j: PulseJobRecord) => boolean, change: Partial<PulseJobRecord>) {
    const job = this.jobs.find((j) => j.id === id && when(j));
    if (!job) return Promise.resolve(undefined);
    Object.assign(job, change);
    return Promise.resolve(clone(job));
  }

  markJobRunning(id: string, startedAt: string) {
    const job = this.jobs.find((j) => j.id === id);
    return this.update(id, (j) => j.status === "queued", {
      status: "running",
      startedAt: job?.startedAt ?? startedAt,
      errorMessage: undefined,
    });
  }

  markJobComplete(id: string, completedAt: string, reportId: string) {
    const job = this.jobs.find((j) => j.id === id);
    return this.update(id, (j) => j.status === "queued" || j.status === "running", {
      status: "complete",
      startedAt: job?.startedAt ?? completedAt,
      completedAt,
      errorMessage: undefined,
      reportId,
    });
  }

  markJobFailed(id: string, failedAt: string, errorMessage: string) {
    const job = this.jobs.find((j) => j.id === id);
    return this.update(id, () => true, {
      status: "failed",
      startedAt: job?.startedAt ?? failedAt,
      completedAt: failedAt,
      errorMessage,
    });
  }

  latestPulseArtifactKey() {
    const latest = [...this.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return Promise.resolve(latest?.artifactKey);
  }

  createReport(input: PulseReportRow) {
    if (this.reports.some((r) => r.id === input.id)) throw new Error("duplicate report id");
    this.reports.push(clone(input));
    return Promise.resolve();
  }

  deleteReport(id: string) {
    this.reports = this.reports.filter((r) => r.id !== id);
    for (const job of this.jobs) if (job.reportId === id) job.reportId = undefined;
    return Promise.resolve();
  }
}

// Stores bodies under the real artifact key convention.
export class MemoryPulseArtifacts implements PulseArtifacts {
  objects = new Map<string, unknown>();
  reads: string[] = [];

  write(report: { generated_at: string; report_id: string }) {
    const key = artifactKeyFor(report);
    this.objects.set(key, clone(report));
    return Promise.resolve(key);
  }

  read(artifactKey: string) {
    this.reads.push(artifactKey);
    return Promise.resolve(this.objects.has(artifactKey) ? clone(this.objects.get(artifactKey)) : undefined);
  }
}
