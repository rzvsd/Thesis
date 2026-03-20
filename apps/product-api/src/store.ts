import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import type {
  AuditEventRecord,
  JobRecord,
  ReportRecord,
  SessionRecord,
  UserRecord,
  VerificationTokenRecord
} from "./types";

export interface ProductStore {
  createUser(input: { email: string; passwordHash: string }): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined>;
  createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord>;
  consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined>;
  createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<SessionRecord>;
  getSessionById(id: string): Promise<SessionRecord | undefined>;
  revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined>;
  createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    createdAt: string;
  }): Promise<JobRecord>;
  getJob(id: string): Promise<JobRecord | undefined>;
  markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined>;
  markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined>;
  markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined>;
  createReport(input: ReportRecord): Promise<ReportRecord>;
  getReportById(id: string): Promise<ReportRecord | undefined>;
  listReportsByUser(userId: string): Promise<ReportRecord[]>;
  appendAuditEvent(input: AuditEventRecord): Promise<void>;
  close(): Promise<void>;
}

function asIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    verifiedAt: asIsoString(row.verified_at)
  };
}

function mapVerificationToken(row: Record<string, unknown>): VerificationTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    consumedAt: asIsoString(row.consumed_at)
  };
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    expiresAt: asIsoString(row.expires_at) ?? new Date().toISOString(),
    revokedAt: asIsoString(row.revoked_at)
  };
}

function mapJob(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    type: String(row.type) as JobRecord["type"],
    status: String(row.status) as JobRecord["status"],
    userId: row.user_id ? String(row.user_id) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
    reportId: row.report_id ? String(row.report_id) : undefined,
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    startedAt: asIsoString(row.started_at),
    completedAt: asIsoString(row.completed_at),
    errorMessage: row.error_message ? String(row.error_message) : undefined
  };
}

function mapReport(row: Record<string, unknown>): ReportRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    type: String(row.type) as ReportRecord["type"],
    ticker: row.ticker ? String(row.ticker) : undefined,
    schemaVersion: String(row.schema_version),
    artifactKey: String(row.artifact_key),
    createdAt: asIsoString(row.created_at) ?? new Date().toISOString(),
    isCurrent: Boolean(row.is_current)
  };
}

export class InMemoryStore implements ProductStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly verificationTokensByHash = new Map<string, VerificationTokenRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly jobs = new Map<string, JobRecord>();
  private readonly reports = new Map<string, ReportRecord>();
  private readonly auditEvents: AuditEventRecord[] = [];

  async createUser(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | undefined> {
    const normalizedEmail = input.email.toLowerCase();
    if (this.usersByEmail.has(normalizedEmail)) {
      return undefined;
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const user: UserRecord = {
      id,
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      createdAt: now
    };
    this.users.set(id, user);
    this.usersByEmail.set(normalizedEmail, id);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? this.users.get(userId) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }

    user.verifiedAt = verifiedAt;
    return user;
  }

  async createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord> {
    const token: VerificationTokenRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt
    };
    this.verificationTokensByHash.set(input.tokenHash, token);
    return token;
  }

  async consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined> {
    const token = this.verificationTokensByHash.get(tokenHash);
    if (!token) {
      return undefined;
    }

    if (token.consumedAt) {
      return undefined;
    }

    if (Date.parse(token.expiresAt) <= Date.now()) {
      return undefined;
    }

    token.consumedAt = consumedAt;
    return token;
  }

  async createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: input.id,
      userId: input.userId,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt
    };
    this.sessions.set(input.id, session);
    return session;
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(id);
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.revokedAt = revokedAt;
    return session;
  }

  async createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const job: JobRecord = {
      id: input.id,
      type: input.type,
      status: "queued",
      userId: input.userId,
      ticker: input.ticker,
      createdAt: input.createdAt
    };
    this.jobs.set(input.id, job);
    return job;
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    return this.jobs.get(id);
  }

  async markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job || job.status !== "queued") {
      return undefined;
    }

    job.status = "running";
    job.startedAt = startedAt;
    job.errorMessage = undefined;
    return job;
  }

  async markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job) {
      return undefined;
    }

    job.status = "failed";
    if (!job.startedAt) {
      job.startedAt = failedAt;
    }
    job.completedAt = failedAt;
    job.errorMessage = errorMessage;
    return job;
  }

  async markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined> {
    const job = this.jobs.get(id);
    if (!job) {
      return undefined;
    }

    job.status = "complete";
    if (!job.startedAt) {
      job.startedAt = completedAt;
    }
    job.completedAt = completedAt;
    job.reportId = reportId;
    job.errorMessage = undefined;
    return job;
  }

  async createReport(input: ReportRecord): Promise<ReportRecord> {
    this.reports.set(input.id, input);
    return input;
  }

  async getReportById(id: string): Promise<ReportRecord | undefined> {
    return this.reports.get(id);
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    return [...this.reports.values()]
      .filter((report) => {
        const job = this.jobs.get(report.jobId);
        return job?.userId === userId;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async appendAuditEvent(input: AuditEventRecord): Promise<void> {
    this.auditEvents.push(input);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

export class PostgresStore implements ProductStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl
    });
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | undefined> {
    try {
      const result = await this.pool.query(
        `insert into users (id, email, password_hash, created_at)
         values ($1, $2, $3, $4)
         returning *`,
        [randomUUID(), input.email.toLowerCase(), input.passwordHash, new Date().toISOString()]
      );
      return mapUser(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query("select * from users where email = $1", [
      email.toLowerCase()
    ]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query("select * from users where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set verified_at = $2 where id = $1 returning *",
      [userId, verifiedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async createVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<VerificationTokenRecord> {
    const result = await this.pool.query(
      `insert into verification_tokens (id, user_id, token_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [input.id, input.userId, input.tokenHash, input.createdAt, input.expiresAt]
    );
    return mapVerificationToken(result.rows[0] as Record<string, unknown>);
  }

  async consumeVerificationToken(
    tokenHash: string,
    consumedAt: string
  ): Promise<VerificationTokenRecord | undefined> {
    const result = await this.pool.query(
      `update verification_tokens
         set consumed_at = $2
       where token_hash = $1
         and consumed_at is null
         and expires_at > now()
       returning *`,
      [tokenHash, consumedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapVerificationToken(row) : undefined;
  }

  async createSession(input: {
    id: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<SessionRecord> {
    const result = await this.pool.query(
      `insert into sessions (id, user_id, created_at, expires_at)
       values ($1, $2, $3, $4)
       returning *`,
      [input.id, input.userId, input.createdAt, input.expiresAt]
    );
    return mapSession(result.rows[0] as Record<string, unknown>);
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query("select * from sessions where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
  }

  async revokeSession(sessionId: string, revokedAt: string): Promise<SessionRecord | undefined> {
    const result = await this.pool.query(
      `update sessions
         set revoked_at = coalesce(revoked_at, $2)
       where id = $1
       returning *`,
      [sessionId, revokedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSession(row) : undefined;
  }

  async createJob(input: {
    id: string;
    type: JobRecord["type"];
    userId?: string;
    ticker?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const result = await this.pool.query(
      `insert into jobs (id, type, status, user_id, ticker, created_at)
       values ($1, $2, 'queued', $3, $4, $5)
       returning *`,
      [input.id, input.type, input.userId ?? null, input.ticker ?? null, input.createdAt]
    );
    return mapJob(result.rows[0] as Record<string, unknown>);
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    const result = await this.pool.query("select * from jobs where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async markJobRunning(id: string, startedAt: string): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'running',
             started_at = coalesce(started_at, $2),
             error_message = null
       where id = $1
         and status = 'queued'
       returning *`,
      [id, startedAt]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async markJobFailed(
    id: string,
    failedAt: string,
    errorMessage: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'failed',
             started_at = coalesce(started_at, $2),
             completed_at = $2,
             error_message = $3
       where id = $1
       returning *`,
      [id, failedAt, errorMessage]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async markJobComplete(
    id: string,
    completedAt: string,
    reportId: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `update jobs
         set status = 'complete',
             started_at = coalesce(started_at, $2),
             completed_at = $2,
             error_message = null,
             report_id = $3
       where id = $1
         and status in ('queued', 'running')
       returning *`,
      [id, completedAt, reportId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
  }

  async createReport(input: ReportRecord): Promise<ReportRecord> {
    const result = await this.pool.query(
      `insert into reports (id, job_id, type, ticker, schema_version, artifact_key, created_at, is_current)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        input.id,
        input.jobId,
        input.type,
        input.ticker ?? null,
        input.schemaVersion,
        input.artifactKey,
        input.createdAt,
        input.isCurrent
      ]
    );
    return mapReport(result.rows[0] as Record<string, unknown>);
  }

  async getReportById(id: string): Promise<ReportRecord | undefined> {
    const result = await this.pool.query("select * from reports where id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    const result = await this.pool.query(
      `select r.*
         from reports r
         join jobs j on j.id = r.job_id
        where j.user_id = $1
        order by r.created_at desc`,
      [userId]
    );
    return result.rows.map((row) => mapReport(row as Record<string, unknown>));
  }

  async appendAuditEvent(input: AuditEventRecord): Promise<void> {
    await this.pool.query(
      `insert into audit_events (id, user_id, event_type, payload, created_at)
       values ($1, $2, $3, $4::jsonb, $5)`,
      [
        input.id,
        input.userId ?? null,
        input.eventType,
        JSON.stringify(input.payload),
        input.createdAt
      ]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
