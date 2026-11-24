// SQL for jobs, reports and Deep Dive limits. Queries copied from apps/product-api/src/store.ts
// (PostgresStore), plus the dispatch columns from migration 20261125080500_m2_jobs.sql.
import type { Sql } from "../../_shared/db.ts";
import type { JobRecord, JobType, ReportRecord } from "./types.ts";

export interface JobsStore {
  getJob(id: string): Promise<JobRecord | undefined>;
  // sinceIso undefined = any age.
  findOpenJob(userId: string, ticker: string, sinceIso?: string): Promise<JobRecord | undefined>;
  // Returns undefined when the user already has an open Deep Dive for the ticker (unique index
  // jobs_one_open_deep_dive), so two overlapping requests cannot both create a job.
  createJob(
    input: {
      id: string;
      type: JobType;
      userId?: string;
      ticker?: string;
      createdAt: string;
      followsJobId?: string;
    },
  ): Promise<JobRecord | undefined>;
  // The oldest open Deep Dive run for the ticker that a new request can follow: not a follower itself and not
  // the given user's own job.
  findOpenRunForTicker(ticker: string, excludeUserId: string): Promise<JobRecord | undefined>;
  // Followers of a job that are still waiting.
  listOpenFollowers(jobId: string): Promise<JobRecord[]>;
  // Counts one more runner start for a still-queued job. When previousDispatchedAt is given, the update only
  // happens if nobody else re-dispatched in the meantime (two polls cannot both start a runner).
  markDispatched(
    id: string,
    atIso: string,
    previousDispatchedAt?: string | null,
  ): Promise<JobRecord | undefined>;
  // Atomic claim: only a queued job becomes running, so two runs cannot take one job.
  claimJob(id: string, startedAt: string, runUrl?: string): Promise<JobRecord | undefined>;
  // Fails the job whatever its status (old /internal/jobs/:id/fail behavior).
  markJobFailed(id: string, failedAt: string, errorMessage: string): Promise<JobRecord | undefined>;
  // Fails the job only if it still has the given status (sweeper; never overwrites a finished job).
  failIfStatus(
    id: string,
    status: "queued" | "running",
    failedAt: string,
    errorMessage: string,
  ): Promise<JobRecord | undefined>;
  markJobComplete(id: string, completedAt: string, reportId: string): Promise<JobRecord | undefined>;
  markChecked(id: string, atIso: string): Promise<void>;

  reserveDispatch(usageDate: string, cap: number): Promise<boolean>;
  releaseDispatch(usageDate: string): Promise<void>;
  reserveDailyUsage(userId: string, usageDate: string, limit: number): Promise<boolean>;
  releaseDailyUsage(userId: string, usageDate: string): Promise<void>;
  getSubscriptionTier(userId: string): Promise<"FREE" | "PRO">;
  isSupportedTicker(symbol: string): Promise<boolean>;
  getCoverageLatestPeriod(ticker: string): Promise<string | undefined>;

  createReport(input: ReportRecord): Promise<ReportRecord>;
  deleteReport(id: string): Promise<void>;
  getReport(id: string): Promise<ReportRecord | undefined>;
  findReusableDeepDiveReport(
    input: { ticker: string; fingerprint: string; nowIso: string },
  ): Promise<ReportRecord | undefined>;
  findLatestComparableDeepDiveReport(
    input: { ticker: string; schemaMajor: number; sinceIso: string },
  ): Promise<ReportRecord | undefined>;
}

type Row = Record<string, unknown>;

export const OPEN_JOB_CONSTRAINT = "jobs_one_open_deep_dive";

function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function mapJob(row: Row): JobRecord {
  return {
    id: String(row.id),
    type: String(row.type) as JobType,
    status: String(row.status) as JobRecord["status"],
    userId: row.user_id ? String(row.user_id) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    attempts: Number(row.attempts ?? 0),
    dispatchedAt: iso(row.dispatched_at),
    runUrl: row.run_url ? String(row.run_url) : undefined,
    checkedAt: iso(row.checked_at),
    followsJobId: row.follows_job_id ? String(row.follows_job_id) : undefined,
  };
}

export function mapReport(row: Row): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as JobType,
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    freshnessExpiresAt: iso(row.freshness_expires_at),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    isCurrent: row.is_current !== false,
    llmUsage: row.llm_usage && typeof row.llm_usage === "object"
      ? row.llm_usage as Record<string, unknown>
      : undefined,
  };
}

const one = (rows: Row[]) => rows[0];

export function postgresJobsStore(sql: Sql): JobsStore {
  return {
    async getJob(id) {
      const row = one(await sql`select * from jobs where id = ${id}`);
      return row ? mapJob(row) : undefined;
    },

    async findOpenJob(userId, ticker, sinceIso) {
      const row = one(
        await sql`select * from jobs
          where user_id = ${userId} and ticker = ${ticker} and type = 'deep_dive'
            and status in ('queued', 'running')
            and created_at >= ${sinceIso ?? "1970-01-01T00:00:00Z"}
          order by created_at desc limit 1`,
      );
      return row ? mapJob(row) : undefined;
    },

    async createJob(input) {
      try {
        const row = one(
          await sql`insert into jobs (id, type, status, user_id, ticker, created_at, follows_job_id)
            values (${input.id}, ${input.type}, 'queued', ${input.userId ?? null}, ${input.ticker ?? null},
                    ${input.createdAt}, ${input.followsJobId ?? null})
            returning *`,
        );
        return mapJob(row);
      } catch (err) {
        const e = err as { code?: string; constraint_name?: string };
        if (e.code === "23505" && e.constraint_name === OPEN_JOB_CONSTRAINT) return undefined;
        throw err;
      }
    },

    async findOpenRunForTicker(ticker, excludeUserId) {
      const row = one(
        await sql`select * from jobs
          where type = 'deep_dive' and ticker = ${ticker} and status in ('queued', 'running')
            and follows_job_id is null and user_id is distinct from ${excludeUserId}
          order by created_at asc limit 1`,
      );
      return row ? mapJob(row) : undefined;
    },

    async listOpenFollowers(jobId) {
      const rows = await sql`select * from jobs where follows_job_id = ${jobId} and status = 'queued'
          order by created_at asc limit 500`;
      return rows.map(mapJob);
    },

    async markDispatched(id, atIso, previousDispatchedAt) {
      const guard = previousDispatchedAt === undefined;
      const row = one(
        await sql`update jobs set attempts = attempts + 1, dispatched_at = ${atIso}
          where id = ${id} and status = 'queued'
            and (${guard} or dispatched_at is not distinct from ${previousDispatchedAt ?? null}::timestamptz)
          returning *`,
      );
      return row ? mapJob(row) : undefined;
    },

    async claimJob(id, startedAt, runUrl) {
      const row = one(
        await sql`update jobs
           set status = 'running', started_at = coalesce(started_at, ${startedAt}), error_message = null,
               run_url = coalesce(${runUrl ?? null}, run_url)
         where id = ${id} and status = 'queued'
         returning *`,
      );
      return row ? mapJob(row) : undefined;
    },

    async markJobFailed(id, failedAt, errorMessage) {
      const row = one(
        await sql`update jobs
           set status = 'failed', started_at = coalesce(started_at, ${failedAt}), completed_at = ${failedAt},
               error_message = ${errorMessage}
         where id = ${id}
         returning *`,
      );
      return row ? mapJob(row) : undefined;
    },

    async failIfStatus(id, status, failedAt, errorMessage) {
      const row = one(
        await sql`update jobs
           set status = 'failed', started_at = coalesce(started_at, ${failedAt}), completed_at = ${failedAt},
               error_message = ${errorMessage}
         where id = ${id} and status = ${status}
         returning *`,
      );
      return row ? mapJob(row) : undefined;
    },

    async markJobComplete(id, completedAt, reportId) {
      const row = one(
        await sql`update jobs
           set status = 'complete', started_at = coalesce(started_at, ${completedAt}),
               completed_at = ${completedAt}, error_message = null, report_id = ${reportId}
         where id = ${id} and status in ('queued', 'running')
         returning *`,
      );
      return row ? mapJob(row) : undefined;
    },

    async markChecked(id, atIso) {
      await sql`update jobs set checked_at = ${atIso} where id = ${id}`;
    },

    async reserveDispatch(usageDate, cap) {
      const rows = await sql`insert into deep_dive_dispatch_daily (usage_date, dispatch_count, updated_at)
          values (${usageDate}::date, 1, now())
          on conflict (usage_date) do update set
            dispatch_count = deep_dive_dispatch_daily.dispatch_count + 1, updated_at = now()
          where deep_dive_dispatch_daily.dispatch_count < ${cap}
          returning dispatch_count`;
      return rows.length > 0;
    },

    async releaseDispatch(usageDate) {
      await sql`update deep_dive_dispatch_daily
          set dispatch_count = greatest(dispatch_count - 1, 0), updated_at = now()
          where usage_date = ${usageDate}::date`;
    },

    async reserveDailyUsage(userId, usageDate, limit) {
      const now = new Date().toISOString();
      const rows =
        await sql`insert into deep_dive_daily_usage (user_id, usage_date, request_count, created_at,
            updated_at)
          values (${userId}, ${usageDate}::date, 1, ${now}, ${now})
          on conflict (user_id, usage_date) do update set
            request_count = deep_dive_daily_usage.request_count + 1, updated_at = excluded.updated_at
          where deep_dive_daily_usage.request_count < ${limit}
          returning request_count`;
      return rows.length > 0;
    },

    async releaseDailyUsage(userId, usageDate) {
      await sql`update deep_dive_daily_usage
          set request_count = greatest(request_count - 1, 0), updated_at = now()
          where user_id = ${userId} and usage_date = ${usageDate}::date`;
    },

    // Read only: the subscriptions table belongs to M4. No row means FREE, as before.
    async getSubscriptionTier(userId) {
      const row = one(await sql`select tier from subscriptions where user_id = ${userId} limit 1`);
      return row && String(row.tier) === "PRO" ? "PRO" : "FREE";
    },

    async isSupportedTicker(symbol) {
      const rows = await sql`select 1 from ticker_registry
          where symbol = ${symbol} and is_supported = true and listing_status = 'active' limit 1`;
      return rows.length > 0;
    },

    async getCoverageLatestPeriod(ticker) {
      const row = one(await sql`select latest_period from ticker_coverage where ticker = ${ticker} limit 1`);
      return row?.latest_period ? String(row.latest_period) : undefined;
    },

    async createReport(input) {
      const row = one(
        await sql`insert into reports (id, job_id, type, ticker, schema_version, artifact_key, fingerprint,
              freshness_expires_at, created_at, is_current, llm_usage)
          values (${input.id}, ${input.jobId}, ${input.type}, ${input.ticker ?? null}, ${input.schemaVersion},
                  ${input.artifactKey}, ${input.fingerprint ?? null}, ${input.freshnessExpiresAt ?? null},
                  ${input.createdAt}, ${input.isCurrent},
                  ${input.llmUsage ? sql.json(input.llmUsage as never) : null})
          returning *`,
      );
      return mapReport(row);
    },

    async deleteReport(id) {
      await sql`delete from reports where id = ${id}`;
    },

    async getReport(id) {
      const row = one(await sql`select * from reports where id = ${id}`);
      return row ? mapReport(row) : undefined;
    },

    async findReusableDeepDiveReport({ ticker, fingerprint, nowIso }) {
      const row = one(
        await sql`select r.* from reports r
          where r.type = 'deep_dive' and r.ticker = ${ticker} and r.fingerprint = ${fingerprint}
            and r.freshness_expires_at > ${nowIso}::timestamptz
            and exists (select 1 from jobs j where j.report_id = r.id and j.status = 'complete')
          order by r.created_at desc limit 1`,
      );
      return row ? mapReport(row) : undefined;
    },

    async findLatestComparableDeepDiveReport({ ticker, schemaMajor, sinceIso }) {
      const row = one(
        await sql`select r.* from reports r
          where r.type = 'deep_dive' and r.ticker = ${ticker}
            and split_part(r.schema_version, '.', 1) = ${String(schemaMajor)}
            and r.created_at >= ${sinceIso}::timestamptz
            and exists (select 1 from jobs j where j.report_id = r.id and j.status = 'complete')
          order by r.created_at desc limit 1`,
      );
      return row ? mapReport(row) : undefined;
    },
  };
}
