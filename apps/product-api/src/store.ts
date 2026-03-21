import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import type {
  AuditEventRecord,
  JobRecord,
  ReportRecord,
  SessionRecord,
  TickerDeltaChange,
  TickerRegistryRecord,
  TickerRegistryUpsertInput,
  TickerSearchResult,
  UserRecord,
  VerificationTokenRecord
} from "./types";

export interface ProductStore {
  createUser(input: { email: string; passwordHash: string }): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  markUserVerified(userId: string, verifiedAt: string): Promise<UserRecord | undefined>;
  updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined>;
  listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>>;
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
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord>;
  findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined>;
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
  deleteReport(id: string): Promise<boolean>;
  listReportsByUser(userId: string): Promise<ReportRecord[]>;
  getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined>;
  getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined>;
  listWatchlistTickersByUser(userId: string): Promise<string[]>;
  addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]>;
  removeWatchlistTicker(userId: string, ticker: string): Promise<string[]>;
  searchTickers(query: string, limit: number): Promise<TickerSearchResult[]>;
  getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined>;
  replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }>;
  applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }>;
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
    verifiedAt: asIsoString(row.verified_at),
    deviceToken: row.device_token ? String(row.device_token) : undefined
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
    cycleStart: asIsoString(row.cycle_start),
    cycleEnd: asIsoString(row.cycle_end),
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

function mapTicker(row: Record<string, unknown>): TickerRegistryRecord {
  return {
    symbol: String(row.symbol),
    companyName: String(row.company_name),
    exchange: String(row.exchange) as TickerRegistryRecord["exchange"],
    listingStatus: String(row.listing_status) as TickerRegistryRecord["listingStatus"],
    isSupported: Boolean(row.is_supported),
    sourceFeed: String(row.source_feed),
    sourceUpdatedAt: asIsoString(row.source_updated_at) ?? new Date().toISOString(),
    lastSyncedAt: asIsoString(row.last_synced_at) ?? new Date().toISOString(),
    rawPayload: (row.raw_payload as Record<string, unknown> | undefined) ?? {}
  };
}

export class InMemoryStore implements ProductStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly verificationTokensByHash = new Map<string, VerificationTokenRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly jobs = new Map<string, JobRecord>();
  private readonly reports = new Map<string, ReportRecord>();
  private readonly tickerRegistry = new Map<string, TickerRegistryRecord>();
  private readonly watchlists = new Map<string, Set<string>>();
  private readonly auditEvents: AuditEventRecord[] = [];

  constructor() {
    const now = new Date().toISOString();
    const seed: TickerRegistryRecord[] = [
      {
        symbol: "AAPL",
        companyName: "Apple Inc. Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "MSFT",
        companyName: "Microsoft Corporation Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      },
      {
        symbol: "TSLA",
        companyName: "Tesla, Inc. Common Stock",
        exchange: "NASDAQ",
        listingStatus: "active",
        isSupported: true,
        sourceFeed: "memory_seed",
        sourceUpdatedAt: now,
        lastSyncedAt: now,
        rawPayload: {}
      }
    ];
    for (const entry of seed) {
      this.tickerRegistry.set(entry.symbol, entry);
    }
  }

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

  async updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    user.deviceToken = deviceToken;
    return user;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const targets: Array<{ userId: string; deviceToken: string }> = [];
    for (const user of this.users.values()) {
      if (user.deviceToken && user.deviceToken.trim().length > 0) {
        targets.push({
          userId: user.id,
          deviceToken: user.deviceToken
        });
      }
    }
    return targets;
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
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const job: JobRecord = {
      id: input.id,
      type: input.type,
      status: "queued",
      userId: input.userId,
      ticker: input.ticker,
      cycleStart: input.cycleStart,
      cycleEnd: input.cycleEnd,
      createdAt: input.createdAt
    };
    this.jobs.set(input.id, job);
    return job;
  }

  async findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined> {
    for (const job of this.jobs.values()) {
      if (job.type === type && job.cycleStart === cycleStart) {
        return job;
      }
    }
    return undefined;
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
    if (!job || (job.status !== "queued" && job.status !== "running")) {
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

  async deleteReport(id: string): Promise<boolean> {
    const report = this.reports.get(id);
    if (!report) {
      return false;
    }

    this.reports.delete(id);
    for (const job of this.jobs.values()) {
      if (job.reportId === id) {
        job.reportId = undefined;
      }
    }
    return true;
  }

  async listReportsByUser(userId: string): Promise<ReportRecord[]> {
    return [...this.reports.values()]
      .filter((report) => {
        const job = this.jobs.get(report.jobId);
        return job?.userId === userId;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) => report.type === type)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined> {
    return [...this.reports.values()]
      .filter((report) => report.type === type && report.createdAt.startsWith(date))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async listWatchlistTickersByUser(userId: string): Promise<string[]> {
    const set = this.watchlists.get(userId);
    if (!set) {
      return [];
    }
    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]> {
    const normalizedTicker = input.ticker.trim().toUpperCase();
    let set = this.watchlists.get(input.userId);
    if (!set) {
      set = new Set<string>();
      this.watchlists.set(input.userId, set);
    }
    set.add(normalizedTicker);
    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async removeWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
    const set = this.watchlists.get(userId);
    if (!set) {
      return [];
    }

    set.delete(ticker.trim().toUpperCase());
    if (set.size === 0) {
      this.watchlists.delete(userId);
      return [];
    }

    return [...set].sort((left, right) => left.localeCompare(right));
  }

  async searchTickers(query: string, limit: number): Promise<TickerSearchResult[]> {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    return [...this.tickerRegistry.values()]
      .filter(
        (entry) =>
          entry.isSupported &&
          entry.listingStatus === "active" &&
          (entry.symbol.includes(normalized) ||
            entry.companyName.toUpperCase().includes(normalized))
      )
      .slice(0, limit)
      .map((entry) => ({
        symbol: entry.symbol,
        company_name: entry.companyName,
        exchange: entry.exchange
      }));
  }

  async getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined> {
    const normalized = symbol.trim().toUpperCase();
    const entry = this.tickerRegistry.get(normalized);
    if (!entry || !entry.isSupported || entry.listingStatus !== "active") {
      return undefined;
    }
    return entry;
  }

  async replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }> {
    const incomingSymbols = new Set<string>();
    for (const entry of input.entries) {
      const symbol = entry.symbol.trim().toUpperCase();
      incomingSymbols.add(symbol);
      this.tickerRegistry.set(symbol, {
        symbol,
        companyName: entry.companyName,
        exchange: entry.exchange,
        listingStatus: entry.listingStatus,
        isSupported: entry.isSupported,
        sourceFeed: entry.sourceFeed || input.sourceFeed,
        sourceUpdatedAt: entry.sourceUpdatedAt,
        lastSyncedAt: input.syncedAt,
        rawPayload: entry.rawPayload ?? {}
      });
    }

    let deactivated = 0;
    for (const [symbol, existing] of this.tickerRegistry.entries()) {
      if (!incomingSymbols.has(symbol) && existing.listingStatus === "active") {
        this.tickerRegistry.set(symbol, {
          ...existing,
          listingStatus: "delisted",
          isSupported: false,
          sourceFeed: input.sourceFeed,
          lastSyncedAt: input.syncedAt
        });
        deactivated += 1;
      }
    }

    return {
      upserted: input.entries.length,
      deactivated
    };
  }

  async applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }> {
    let added = 0;
    let deleted = 0;
    let updated = 0;
    let renamed = 0;

    for (const change of input.changes) {
      const symbol = change.symbol.trim().toUpperCase();
      if (!symbol) {
        continue;
      }

      const existing = this.tickerRegistry.get(symbol);
      if (change.type === "add") {
        this.tickerRegistry.set(symbol, {
          symbol,
          companyName: change.companyName ?? existing?.companyName ?? symbol,
          exchange: change.exchange ?? existing?.exchange ?? "NASDAQ",
          listingStatus: "active",
          isSupported: true,
          sourceFeed: change.sourceFeed,
          sourceUpdatedAt: change.sourceUpdatedAt,
          lastSyncedAt: input.syncedAt,
          rawPayload: change.rawPayload ?? {}
        });
        if (existing) {
          updated += 1;
        } else {
          added += 1;
        }
        continue;
      }

      if (change.type === "delete") {
        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            listingStatus: "delisted",
            isSupported: false,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
          deleted += 1;
        }
        continue;
      }

      if (change.type === "name_change") {
        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            companyName: change.newCompanyName ?? change.companyName ?? existing.companyName,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
          updated += 1;
        }
        continue;
      }

      if (change.type === "symbol_change") {
        const nextSymbol = change.newSymbol?.trim().toUpperCase();
        if (!nextSymbol) {
          continue;
        }

        if (existing) {
          this.tickerRegistry.set(symbol, {
            ...existing,
            listingStatus: "delisted",
            isSupported: false,
            sourceFeed: change.sourceFeed,
            sourceUpdatedAt: change.sourceUpdatedAt,
            lastSyncedAt: input.syncedAt,
            rawPayload: change.rawPayload ?? existing.rawPayload
          });
        }

        this.tickerRegistry.set(nextSymbol, {
          symbol: nextSymbol,
          companyName:
            change.newCompanyName ??
            change.companyName ??
            existing?.companyName ??
            nextSymbol,
          exchange: change.exchange ?? existing?.exchange ?? "NASDAQ",
          listingStatus: "active",
          isSupported: true,
          sourceFeed: change.sourceFeed,
          sourceUpdatedAt: change.sourceUpdatedAt,
          lastSyncedAt: input.syncedAt,
          rawPayload: change.rawPayload ?? {}
        });
        renamed += 1;
      }
    }

    return {
      added,
      deleted,
      updated,
      renamed
    };
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

  async updateUserDeviceToken(
    userId: string,
    deviceToken: string | undefined
  ): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "update users set device_token = $2 where id = $1 returning *",
      [userId, deviceToken ?? null]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapUser(row) : undefined;
  }

  async listUsersWithDeviceToken(): Promise<Array<{ userId: string; deviceToken: string }>> {
    const result = await this.pool.query(
      `select id, device_token
         from users
        where device_token is not null
          and length(trim(device_token)) > 0`
    );
    return result.rows.map((row) => ({
      userId: String(row.id),
      deviceToken: String(row.device_token)
    }));
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
    cycleStart?: string;
    cycleEnd?: string;
    createdAt: string;
  }): Promise<JobRecord> {
    const result = await this.pool.query(
      `insert into jobs (id, type, status, user_id, ticker, cycle_start, cycle_end, created_at)
       values ($1, $2, 'queued', $3, $4, $5, $6, $7)
       returning *`,
      [
        input.id,
        input.type,
        input.userId ?? null,
        input.ticker ?? null,
        input.cycleStart ?? null,
        input.cycleEnd ?? null,
        input.createdAt
      ]
    );
    return mapJob(result.rows[0] as Record<string, unknown>);
  }

  async findJobByTypeAndCycleStart(
    type: JobRecord["type"],
    cycleStart: string
  ): Promise<JobRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from jobs
        where type = $1
          and cycle_start = $2::timestamptz
        order by created_at desc
        limit 1`,
      [type, cycleStart]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapJob(row) : undefined;
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

  async deleteReport(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const deleteResult = await client.query(
        "delete from reports where id = $1 returning job_id",
        [id]
      );
      if ((deleteResult.rowCount ?? 0) === 0) {
        await client.query("rollback");
        return false;
      }

      await client.query("update jobs set report_id = null where report_id = $1", [id]);
      await client.query("commit");
      return true;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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

  async getLatestReportByType(type: JobRecord["type"]): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from reports
        where type = $1
        order by created_at desc
        limit 1`,
      [type]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async getReportByTypeAndDate(
    type: JobRecord["type"],
    date: string
  ): Promise<ReportRecord | undefined> {
    const result = await this.pool.query(
      `select *
         from reports
        where type = $1
          and (created_at at time zone 'UTC')::date = $2::date
        order by created_at desc
        limit 1`,
      [type, date]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapReport(row) : undefined;
  }

  async listWatchlistTickersByUser(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      `select ticker
         from watchlists
        where user_id = $1
        order by ticker asc`,
      [userId]
    );
    return result.rows.map((row) => String(row.ticker));
  }

  async addWatchlistTicker(input: {
    id: string;
    userId: string;
    ticker: string;
    addedAt: string;
  }): Promise<string[]> {
    await this.pool.query(
      `insert into watchlists (id, user_id, ticker, added_at)
       values ($1, $2, $3, $4)
       on conflict (user_id, ticker) do update
         set added_at = excluded.added_at`,
      [input.id, input.userId, input.ticker.trim().toUpperCase(), input.addedAt]
    );
    return this.listWatchlistTickersByUser(input.userId);
  }

  async removeWatchlistTicker(userId: string, ticker: string): Promise<string[]> {
    await this.pool.query(
      "delete from watchlists where user_id = $1 and ticker = $2",
      [userId, ticker.trim().toUpperCase()]
    );
    return this.listWatchlistTickersByUser(userId);
  }

  async searchTickers(query: string, limit: number): Promise<TickerSearchResult[]> {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    const likeValue = `%${normalized}%`;
    const symbolPrefix = `${normalized}%`;
    const result = await this.pool.query(
      `select symbol, company_name, exchange
         from ticker_registry
        where is_supported = true
          and listing_status = 'active'
          and (upper(symbol) like $1 or upper(company_name) like $1)
        order by
          case
            when upper(symbol) = $2 then 0
            when upper(symbol) like $3 then 1
            else 2
          end,
          symbol asc
        limit $4`,
      [likeValue, normalized, symbolPrefix, limit]
    );

    return result.rows.map((row) => ({
      symbol: String(row.symbol),
      company_name: String(row.company_name),
      exchange: String(row.exchange) as TickerSearchResult["exchange"]
    }));
  }

  async getSupportedTicker(symbol: string): Promise<TickerRegistryRecord | undefined> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    const result = await this.pool.query(
      `select *
         from ticker_registry
        where symbol = $1
          and is_supported = true
          and listing_status = 'active'`,
      [normalized]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapTicker(row) : undefined;
  }

  async replaceTickerRegistry(input: {
    entries: TickerRegistryUpsertInput[];
    sourceFeed: string;
    syncedAt: string;
  }): Promise<{ upserted: number; deactivated: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const entry of input.entries) {
        const symbol = entry.symbol.trim().toUpperCase();
        if (!symbol) {
          continue;
        }

        await client.query(
          `insert into ticker_registry (
             symbol,
             company_name,
             exchange,
             listing_status,
             is_supported,
             source_feed,
             source_updated_at,
             last_synced_at,
             raw_payload
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           on conflict (symbol) do update set
             company_name = excluded.company_name,
             exchange = excluded.exchange,
             listing_status = excluded.listing_status,
             is_supported = excluded.is_supported,
             source_feed = excluded.source_feed,
             source_updated_at = excluded.source_updated_at,
             last_synced_at = excluded.last_synced_at,
             raw_payload = excluded.raw_payload`,
          [
            symbol,
            entry.companyName,
            entry.exchange,
            entry.listingStatus,
            entry.isSupported,
            entry.sourceFeed || input.sourceFeed,
            entry.sourceUpdatedAt,
            input.syncedAt,
            JSON.stringify(entry.rawPayload ?? {})
          ]
        );
      }

      const symbols = input.entries
        .map((entry) => entry.symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0);
      const deactivateResult = await client.query(
        `update ticker_registry
            set listing_status = 'delisted',
                is_supported = false,
                source_feed = $1,
                last_synced_at = $2
          where listing_status = 'active'
            and not (symbol = any($3::text[]))`,
        [input.sourceFeed, input.syncedAt, symbols.length > 0 ? symbols : ["__NONE__"]]
      );

      await client.query("commit");
      return {
        upserted: input.entries.length,
        deactivated: deactivateResult.rowCount ?? 0
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async applyTickerDelta(input: {
    changes: TickerDeltaChange[];
    syncedAt: string;
  }): Promise<{
    added: number;
    deleted: number;
    updated: number;
    renamed: number;
  }> {
    let added = 0;
    let deleted = 0;
    let updated = 0;
    let renamed = 0;

    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const change of input.changes) {
        const symbol = change.symbol.trim().toUpperCase();
        if (!symbol) {
          continue;
        }

        if (change.type === "add") {
          await client.query(
            `insert into ticker_registry (
               symbol,
               company_name,
               exchange,
               listing_status,
               is_supported,
               source_feed,
               source_updated_at,
               last_synced_at,
               raw_payload
             )
             values ($1, $2, $3, 'active', true, $4, $5, $6, $7::jsonb)
             on conflict (symbol) do update set
               company_name = excluded.company_name,
               exchange = excluded.exchange,
               listing_status = 'active',
               is_supported = true,
               source_feed = excluded.source_feed,
               source_updated_at = excluded.source_updated_at,
               last_synced_at = excluded.last_synced_at,
               raw_payload = excluded.raw_payload`,
            [
              symbol,
              change.companyName ?? symbol,
              change.exchange ?? "NASDAQ",
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          added += 1;
          continue;
        }

        if (change.type === "delete") {
          const result = await client.query(
            `update ticker_registry
                set listing_status = 'delisted',
                    is_supported = false,
                    source_feed = $2,
                    source_updated_at = $3,
                    last_synced_at = $4,
                    raw_payload = $5::jsonb
              where symbol = $1`,
            [
              symbol,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          if ((result.rowCount ?? 0) > 0) {
            deleted += 1;
          }
          continue;
        }

        if (change.type === "name_change") {
          const result = await client.query(
            `update ticker_registry
                set company_name = $2,
                    source_feed = $3,
                    source_updated_at = $4,
                    last_synced_at = $5,
                    raw_payload = $6::jsonb
              where symbol = $1`,
            [
              symbol,
              change.newCompanyName ?? change.companyName ?? symbol,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          if ((result.rowCount ?? 0) > 0) {
            updated += 1;
          }
          continue;
        }

        if (change.type === "symbol_change") {
          const currentResult = await client.query(
            "select * from ticker_registry where symbol = $1",
            [symbol]
          );
          const current = currentResult.rows[0] as Record<string, unknown> | undefined;
          const nextSymbol = change.newSymbol?.trim().toUpperCase();
          if (!nextSymbol) {
            continue;
          }

          if (current) {
            await client.query(
              `update ticker_registry
                  set listing_status = 'delisted',
                      is_supported = false,
                      source_feed = $2,
                      source_updated_at = $3,
                      last_synced_at = $4,
                      raw_payload = $5::jsonb
                where symbol = $1`,
              [
                symbol,
                change.sourceFeed,
                change.sourceUpdatedAt,
                input.syncedAt,
                JSON.stringify(change.rawPayload ?? {})
              ]
            );
          }

          const companyName =
            change.newCompanyName ??
            change.companyName ??
            (current ? String(current.company_name) : nextSymbol);
          const exchange =
            change.exchange ??
            (current ? (String(current.exchange) as TickerRegistryRecord["exchange"]) : "NASDAQ");

          await client.query(
            `insert into ticker_registry (
               symbol,
               company_name,
               exchange,
               listing_status,
               is_supported,
               source_feed,
               source_updated_at,
               last_synced_at,
               raw_payload
             )
             values ($1, $2, $3, 'active', true, $4, $5, $6, $7::jsonb)
             on conflict (symbol) do update set
               company_name = excluded.company_name,
               exchange = excluded.exchange,
               listing_status = 'active',
               is_supported = true,
               source_feed = excluded.source_feed,
               source_updated_at = excluded.source_updated_at,
               last_synced_at = excluded.last_synced_at,
               raw_payload = excluded.raw_payload`,
            [
              nextSymbol,
              companyName,
              exchange,
              change.sourceFeed,
              change.sourceUpdatedAt,
              input.syncedAt,
              JSON.stringify(change.rawPayload ?? {})
            ]
          );
          renamed += 1;
        }
      }

      await client.query("commit");
      return {
        added,
        deleted,
        updated,
        renamed
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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
