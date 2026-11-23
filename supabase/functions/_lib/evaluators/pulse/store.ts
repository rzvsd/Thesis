// Jobs and report rows for the Pulse build. app.jobs and app.reports are M2's tables; the old server wrote
// market_pulse rows into them, and M1's GET /pulse/* reads them back (_lib/store/pulse.ts), so the columns
// and SQL are copied from PostgresStore in apps/product-api/src/store.ts. Report bodies go to Storage
// through M1's artifacts module (_lib/reports/artifacts.ts).
import type { Sql } from "../../../_shared/db.ts";
import { readArtifact, writeArtifact } from "../../reports/artifacts.ts";
import { getLatestReportByType } from "../../store/pulse.ts";

export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface PulseJobRecord {
  id: string;
  type: "market_pulse";
  status: JobStatus;
  userId?: string;
  ticker?: string;
  reportId?: string;
  cycleStart?: string;
  cycleEnd?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface PulseReportRow {
  id: string;
  jobId: string;
  schemaVersion: string;
  artifactKey: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface PulseJobStore {
  findJobByCycleStart(cycleStart: string): Promise<PulseJobRecord | undefined>;
  createJob(input: {
    id: string;
    ticker?: string;
    cycleStart: string;
    cycleEnd: string;
    createdAt: string;
  }): Promise<PulseJobRecord>;
  markJobRunning(id: string, startedAt: string): Promise<PulseJobRecord | undefined>;
  markJobComplete(id: string, completedAt: string, reportId: string): Promise<PulseJobRecord | undefined>;
  markJobFailed(id: string, failedAt: string, errorMessage: string): Promise<PulseJobRecord | undefined>;
  // Artifact key of the newest market_pulse report, for the editorial delta.
  latestPulseArtifactKey(): Promise<string | undefined>;
  createReport(input: PulseReportRow): Promise<void>;
  deleteReport(id: string): Promise<void>;
}

// Storage for report bodies. Tests inject a memory version.
export interface PulseArtifacts {
  write(report: { generated_at: string; report_id: string }): Promise<string>;
  read(artifactKey: string): Promise<unknown | undefined>;
}

export const storageArtifacts: PulseArtifacts = {
  write: (report) => writeArtifact(report),
  read: (artifactKey) => readArtifact(artifactKey),
};

type Row = Record<string, unknown>;
type Params = Parameters<Sql["unsafe"]>[1];

function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

export function mapJob(row: Row): PulseJobRecord {
  return {
    id: String(row.id),
    type: "market_pulse",
    status: String(row.status) as JobStatus,
    userId: row.user_id ? String(row.user_id) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    cycleStart: iso(row.cycle_start),
    cycleEnd: iso(row.cycle_end),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
  };
}

export class PostgresPulseJobStore implements PulseJobStore {
  constructor(private readonly sql: () => Sql) {}

  private async q(text: string, params: unknown[]): Promise<Row[]> {
    return (await this.sql().unsafe(text, params as Params)) as unknown as Row[];
  }

  private async one(text: string, params: unknown[]): Promise<PulseJobRecord | undefined> {
    const rows = await this.q(text, params);
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  findJobByCycleStart(cycleStart: string) {
    return this.one(
      `select * from jobs where type = 'market_pulse' and cycle_start = $1::timestamptz
        order by created_at desc limit 1`,
      [cycleStart],
    );
  }

  async createJob(
    input: { id: string; ticker?: string; cycleStart: string; cycleEnd: string; createdAt: string },
  ) {
    const job = await this.one(
      `insert into jobs (id, type, status, user_id, ticker, cycle_start, cycle_end, created_at)
       values ($1, 'market_pulse', 'queued', null, $2, $3::timestamptz, $4::timestamptz, $5::timestamptz)
       returning *`,
      [input.id, input.ticker ?? null, input.cycleStart, input.cycleEnd, input.createdAt],
    );
    if (!job) throw new Error("Job insert returned no row.");
    return job;
  }

  markJobRunning(id: string, startedAt: string) {
    return this.one(
      `update jobs set status = 'running', started_at = coalesce(started_at, $2::timestamptz), error_message = null
        where id = $1 and status = 'queued' returning *`,
      [id, startedAt],
    );
  }

  markJobComplete(id: string, completedAt: string, reportId: string) {
    return this.one(
      `update jobs set status = 'complete', started_at = coalesce(started_at, $2::timestamptz),
         completed_at = $2::timestamptz, error_message = null, report_id = $3
        where id = $1 and status in ('queued', 'running') returning *`,
      [id, completedAt, reportId],
    );
  }

  markJobFailed(id: string, failedAt: string, errorMessage: string) {
    return this.one(
      `update jobs set status = 'failed', started_at = coalesce(started_at, $2::timestamptz),
         completed_at = $2::timestamptz, error_message = $3
        where id = $1 returning *`,
      [id, failedAt, errorMessage],
    );
  }

  async latestPulseArtifactKey() {
    return (await getLatestReportByType("market_pulse"))?.artifactKey;
  }

  async createReport(input: PulseReportRow) {
    await this.q(
      `insert into reports (id, job_id, type, ticker, schema_version, artifact_key, fingerprint,
         freshness_expires_at, created_at, is_current, llm_usage)
       values ($1, $2, 'market_pulse', null, $3, $4, null, null, $5::timestamptz, $6, null)`,
      [input.id, input.jobId, input.schemaVersion, input.artifactKey, input.createdAt, input.isCurrent],
    );
  }

  // Like the old deleteReport: drop the row and clear the job's pointer to it.
  async deleteReport(id: string) {
    await this.sql().begin(async (tx) => {
      const deleted = await tx.unsafe("delete from reports where id = $1 returning job_id", [id]);
      if (deleted.length > 0) await tx.unsafe("update jobs set report_id = null where report_id = $1", [id]);
    });
  }
}
