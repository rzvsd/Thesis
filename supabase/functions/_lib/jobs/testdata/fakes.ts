// In-memory fakes for the jobs tests. Behavior mirrors the SQL in ../store.ts.
import type { ArtifactStore } from "../artifacts.ts";
import { toArtifactKey } from "../artifacts.ts";
import type { Runner, RunState } from "../dispatch.ts";
import type { CompletionEffects, JobsDeps } from "../service.ts";
import type { JobsStore } from "../store.ts";
import type { AnalysisReport, JobRecord, ReportRecord } from "../types.ts";

export class FakeStore implements JobsStore {
  jobs = new Map<string, JobRecord>();
  reports = new Map<string, ReportRecord>();
  dispatches = new Map<string, number>();
  usage = new Map<string, number>();
  tiers = new Map<string, "FREE" | "PRO">();
  tickers = new Set(["AAPL", "MSFT", "FAIL"]);

  getJob(id: string) {
    const j = this.jobs.get(id);
    return Promise.resolve(j ? { ...j } : undefined);
  }
  findOpenJob(userId: string, ticker: string, sinceIso: string) {
    const open = [...this.jobs.values()]
      .filter((j) =>
        j.userId === userId && j.ticker === ticker && (j.status === "queued" || j.status === "running") &&
        j.createdAt >= sinceIso
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(open[0] ? { ...open[0] } : undefined);
  }
  createJob(
    input: {
      id: string;
      type: "deep_dive" | "market_pulse";
      userId?: string;
      ticker?: string;
      createdAt: string;
    },
  ) {
    const job: JobRecord = { ...input, status: "queued", attempts: 0 };
    this.jobs.set(job.id, job);
    return Promise.resolve({ ...job });
  }
  private update(id: string, ok: (j: JobRecord) => boolean, patch: (j: JobRecord) => Partial<JobRecord>) {
    const j = this.jobs.get(id);
    if (!j || !ok(j)) return Promise.resolve(undefined);
    Object.assign(j, patch(j));
    return Promise.resolve({ ...j });
  }
  markDispatched(id: string, atIso: string, previous?: string | null) {
    return this.update(
      id,
      (j) => j.status === "queued" && (previous === undefined || (j.dispatchedAt ?? null) === previous),
      (j) => ({ attempts: j.attempts + 1, dispatchedAt: atIso }),
    );
  }
  claimJob(id: string, startedAt: string, runUrl?: string) {
    return this.update(id, (j) => j.status === "queued", (j) => ({
      status: "running",
      startedAt: j.startedAt ?? startedAt,
      errorMessage: undefined,
      runUrl: runUrl ?? j.runUrl,
    }));
  }
  markJobFailed(id: string, at: string, errorMessage: string) {
    return this.update(id, () => true, (j) => ({
      status: "failed",
      startedAt: j.startedAt ?? at,
      completedAt: at,
      errorMessage,
    }));
  }
  failIfStatus(id: string, status: "queued" | "running", at: string, errorMessage: string) {
    return this.update(id, (j) => j.status === status, (j) => ({
      status: "failed",
      startedAt: j.startedAt ?? at,
      completedAt: at,
      errorMessage,
    }));
  }
  markJobComplete(id: string, at: string, reportId: string) {
    return this.update(id, (j) => j.status === "queued" || j.status === "running", (j) => ({
      status: "complete",
      startedAt: j.startedAt ?? at,
      completedAt: at,
      errorMessage: undefined,
      reportId,
    }));
  }
  async markChecked(id: string, atIso: string) {
    await this.update(id, () => true, () => ({ checkedAt: atIso }));
  }
  reserveDispatch(day: string, cap: number) {
    const n = this.dispatches.get(day) ?? 0;
    if (n >= cap) return Promise.resolve(false);
    this.dispatches.set(day, n + 1);
    return Promise.resolve(true);
  }
  releaseDispatch(day: string) {
    this.dispatches.set(day, Math.max(0, (this.dispatches.get(day) ?? 0) - 1));
    return Promise.resolve();
  }
  reserveDailyUsage(userId: string, day: string, limit: number) {
    const k = `${userId}|${day}`;
    const n = this.usage.get(k) ?? 0;
    if (n >= limit) return Promise.resolve(false);
    this.usage.set(k, n + 1);
    return Promise.resolve(true);
  }
  releaseDailyUsage(userId: string, day: string) {
    const k = `${userId}|${day}`;
    this.usage.set(k, Math.max(0, (this.usage.get(k) ?? 0) - 1));
    return Promise.resolve();
  }
  getSubscriptionTier(userId: string) {
    return Promise.resolve(this.tiers.get(userId) ?? "FREE");
  }
  isSupportedTicker(symbol: string) {
    return Promise.resolve(this.tickers.has(symbol));
  }
  getCoverageLatestPeriod(_ticker: string) {
    return Promise.resolve(undefined);
  }
  createReport(input: ReportRecord) {
    this.reports.set(input.id, { ...input });
    return Promise.resolve({ ...input });
  }
  deleteReport(id: string) {
    this.reports.delete(id);
    return Promise.resolve();
  }
  getReport(id: string) {
    return Promise.resolve(this.reports.get(id));
  }
  findReusableDeepDiveReport(input: { ticker: string; fingerprint: string; nowIso: string }) {
    const found = [...this.reports.values()].find((r) =>
      r.type === "deep_dive" && r.ticker === input.ticker && r.fingerprint === input.fingerprint &&
      (r.freshnessExpiresAt ?? "") > input.nowIso &&
      [...this.jobs.values()].some((j) => j.reportId === r.id && j.status === "complete")
    );
    return Promise.resolve(found);
  }
  findLatestComparableDeepDiveReport(input: { ticker: string; schemaMajor: number; sinceIso: string }) {
    const found = [...this.reports.values()]
      .filter((r) =>
        r.ticker === input.ticker && r.schemaVersion.split(".")[0] === String(input.schemaMajor) &&
        r.createdAt >= input.sinceIso
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return Promise.resolve(found);
  }
}

export class FakeRunner implements Runner {
  dispatched: string[] = [];
  fail = false;
  state: RunState = "active";
  dispatch(jobId: string) {
    if (this.fail) return Promise.reject(new Error("down"));
    this.dispatched.push(jobId);
    return Promise.resolve();
  }
  runState(_runUrl: string) {
    return Promise.resolve(this.state);
  }
}

export class FakeArtifacts implements ArtifactStore {
  objects = new Map<string, AnalysisReport>();
  writeReport(report: AnalysisReport) {
    const key = toArtifactKey(report);
    this.objects.set(key, structuredClone(report));
    return Promise.resolve(key);
  }
  readReport(key: string) {
    const r = this.objects.get(key);
    return Promise.resolve(r ? structuredClone(r) : undefined);
  }
  deleteReport(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

export class FakeEffects implements CompletionEffects {
  audits: string[] = [];
  applied: Array<{ reportId: string; includeMonitorSnapshot: boolean }> = [];
  alerts = 0;
  enrichIssuer(report: AnalysisReport) {
    return Promise.resolve(report);
  }
  audit(eventType: string) {
    this.audits.push(eventType);
    return Promise.resolve();
  }
  apply(input: { report: AnalysisReport; includeMonitorSnapshot: boolean }) {
    this.applied.push({
      reportId: input.report.report_id,
      includeMonitorSnapshot: input.includeMonitorSnapshot,
    });
    return Promise.resolve();
  }
  findPrior(_report: AnalysisReport) {
    return Promise.resolve(undefined);
  }
  filingAlerts() {
    this.alerts++;
    return Promise.resolve();
  }
}

export function fakeDeps(overrides: Partial<JobsDeps> = {}) {
  const store = new FakeStore();
  const runner = new FakeRunner();
  const artifacts = new FakeArtifacts();
  const effects = new FakeEffects();
  const clock = { now: new Date("2026-11-25T12:00:00Z") };
  const pending: Promise<unknown>[] = [];
  const deps: JobsDeps = {
    store,
    runner,
    artifacts,
    effects,
    dailyCap: 15,
    now: () => clock.now,
    config: {
      dailyCap: 15,
      reuseFreshnessHours: 24,
      precomputeFreshnessHours: 2160,
      subscriptionTimezone: "America/New_York",
    },
    background: (p) => pending.push(p),
    ...overrides,
  };
  return { deps, store, runner, artifacts, effects, clock, pending };
}
