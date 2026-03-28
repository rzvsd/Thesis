import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";

import type {
  AnalysisReport,
  AnalysisRequest,
  AuthLoginRequest,
  AuthRefreshRequest,
  AuthRegisterRequest,
  AuthTokensResponse,
  CreateJobRequest,
  JobStatusResponse,
  MarketPulseReport,
  ReportListItem
} from "../../../packages/contracts/src";
import { captureException, initSentry } from "../../../packages/observability/src/sentry";

import { FilesystemArtifactStore } from "./artifact-store";
import { loadConfig, validateConfig, type ProductApiConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";
import { createJobQueue, type JobQueue } from "./queue";
import { createRateLimiter, type RateLimiter } from "./rate-limit";
import {
  createId,
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword
} from "./security";
import { createProductStore } from "./store-factory";
import type { ProductStore } from "./store";
import { assertIncomingAnalysisReport } from "./report-validation";
import { assertIncomingMarketPulseReport } from "./market-pulse-validation";
import { buildMarketPulseReport, withWatchlistOverlay } from "./market-pulse";
import { PushNotifier } from "./push";
import { startTickerSyncScheduler } from "./ticker-sync-scheduler";
import { startJobRecoveryScheduler } from "./job-recovery-scheduler";
import type { AuditEventRecord, JobRecord } from "./types";

type HealthPayload = { status: "ok" };

interface AuthContext {
  userId: string;
  sessionId: string;
}

interface Runtime {
  config: ProductApiConfig;
  store: ProductStore;
  queue: JobQueue;
  rateLimiter: RateLimiter;
  artifactStore: FilesystemArtifactStore;
  pushNotifier: PushNotifier;
  close: () => Promise<void>;
}

interface RequestMeta {
  requestId: string;
  pathname: string;
}

const serviceName = "product-api";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractClientIp(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

function routeBucket(pathname: string): string {
  if (pathname.startsWith("/jobs/")) {
    return "/jobs/:id";
  }

  if (pathname.startsWith("/reports/")) {
    return "/reports/:id";
  }

  if (pathname.startsWith("/pulse/")) {
    return "/pulse/:date";
  }

  if (pathname.startsWith("/watchlist/")) {
    return "/watchlist/:ticker";
  }

  return pathname;
}

function parseBearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function hasInternalToken(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers["x-internal-token"];
  if (typeof header !== "string") {
    return false;
  }
  return header === expectedToken;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({} as T);
        return;
      }

      try {
        resolve(JSON.parse(body) as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function buildJobStatusResponse(job: JobRecord): JobStatusResponse {
  return {
    job_id: job.id,
    type: job.type,
    status: job.status,
    ticker: job.ticker,
    report_id: job.reportId,
    created_at: job.createdAt,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    error_message: job.errorMessage
  };
}

function buildReportListItem(report: {
  id: string;
  jobId: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  schemaVersion: string;
  createdAt: string;
}): ReportListItem {
  return {
    report_id: report.id,
    job_id: report.jobId,
    type: report.type,
    ticker: report.ticker,
    schema_version: report.schemaVersion,
    created_at: report.createdAt
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function normalizeDateInput(value: string): string | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function deepDiveFingerprint(input: {
  ticker: string;
  schemaVersion: string;
  latestPeriod?: string;
}): string {
  const latestPeriod = input.latestPeriod?.trim().toUpperCase() || "LATEST_UNKNOWN";
  return `${input.ticker.trim().toUpperCase()}|${input.schemaVersion.trim()}|${latestPeriod}`;
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

function isMarketPulseReport(report: unknown): report is MarketPulseReport {
  if (!isObject(report)) {
    return false;
  }
  if (typeof report.report_id !== "string" || typeof report.generated_at !== "string") {
    return false;
  }
  if (!isObject(report.sections)) {
    return false;
  }
  return (
    isObject(report.sections.market_moves) &&
    isObject(report.sections.macro_releases) &&
    isObject(report.sections.rates_fx_commodities) &&
    isObject(report.sections.news_summary) &&
    isObject(report.sections.uncertainty_flags)
  );
}

async function cleanupStoredReport(
  runtime: Runtime,
  reportId: string,
  artifactKey: string | undefined
): Promise<void> {
  const cleanupTasks: Promise<unknown>[] = [];

  if (artifactKey) {
    cleanupTasks.push(runtime.artifactStore.deleteReport(artifactKey));
  }

  cleanupTasks.push(runtime.store.deleteReport(reportId));

  const results = await Promise.allSettled(cleanupTasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      logWarn("Report cleanup warning", {
        error_message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        report_id: reportId,
        artifact_key: artifactKey
      });
    }
  });
}

async function authenticateAccessToken(
  runtime: Runtime,
  request: IncomingMessage
): Promise<AuthContext | undefined> {
  const token = parseBearerToken(request);
  if (!token) {
    return undefined;
  }

  const claims = verifyAuthToken(token, runtime.config.jwtSecret);
  if (!claims || claims.typ !== "access") {
    return undefined;
  }

  const session = await runtime.store.getSessionById(claims.sid);
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    return undefined;
  }

  if (Date.parse(session.expiresAt) <= Date.now()) {
    return undefined;
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid
  };
}

async function authenticateAnyToken(
  runtime: Runtime,
  token: string
): Promise<AuthContext | undefined> {
  const claims = verifyAuthToken(token, runtime.config.jwtSecret);
  if (!claims) {
    return undefined;
  }

  const session = await runtime.store.getSessionById(claims.sid);
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    return undefined;
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid
  };
}

async function appendAudit(
  runtime: Runtime,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const auditEvent: AuditEventRecord = {
    id: createId(),
    eventType,
    payload,
    userId,
    createdAt: new Date().toISOString()
  };
  await runtime.store.appendAuditEvent(auditEvent);
}

async function issueTokens(
  runtime: Runtime,
  userId: string,
  sessionId: string,
  refreshTokenExpiresAt: string
): Promise<AuthTokensResponse> {
  const accessToken = signAuthToken(
    {
      sub: userId,
      sid: sessionId,
      typ: "access"
    },
    runtime.config.accessTokenTtlSeconds,
    runtime.config.jwtSecret
  );

  const refreshExpiryUnix = Math.floor(Date.parse(refreshTokenExpiresAt) / 1000);
  const refreshTtlSeconds = Math.max(
    1,
    refreshExpiryUnix - Math.floor(Date.now() / 1000)
  );
  const refreshToken = signAuthToken(
    {
      sub: userId,
      sid: sessionId,
      typ: "refresh"
    },
    refreshTtlSeconds,
    runtime.config.jwtSecret
  );

  return {
    access_token: accessToken.token,
    refresh_token: refreshToken.token,
    token_type: "Bearer",
    access_token_expires_at: accessToken.expiresAt,
    refresh_token_expires_at: refreshTokenExpiresAt
  };
}

async function processMarketPulseJob(
  runtime: Runtime,
  job: JobRecord
): Promise<void> {
  const startedAt = new Date().toISOString();
  const running = await runtime.store.markJobRunning(job.id, startedAt);
  if (!running) {
    return;
  }

  await appendAudit(
    runtime,
    "job.running",
    {
      route: "/internal/pulse/dispatch",
      job_id: running.id,
      status: "running"
    },
    running.userId
  );

  const fallbackCycleEnd = new Date().toISOString();
  const fallbackCycleStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cycleStart = running.cycleStart ?? fallbackCycleStart;
  const cycleEnd = running.cycleEnd ?? fallbackCycleEnd;

  try {
    if (running.ticker === "FORCE_FAIL") {
      throw new Error("Forced market pulse failure");
    }

    const pulseReport = await buildMarketPulseReport({
      cycleStart,
      cycleEnd,
      schemaVersion: runtime.config.marketPulseSchemaVersion,
      tickers: runtime.config.marketPulseTickers,
      dataOpenbbBaseUrl: runtime.config.marketPulseDataOpenbbBaseUrl,
      newsIngestBaseUrl: runtime.config.marketPulseNewsIngestBaseUrl
    });
    const report = assertIncomingMarketPulseReport(pulseReport);

    let artifactKey: string | undefined;
    try {
      artifactKey = await runtime.artifactStore.writeReport(report);
      await runtime.store.createReport({
        id: report.report_id,
        jobId: running.id,
        type: "market_pulse",
        schemaVersion: report.schema_version,
        artifactKey,
        createdAt: report.cycle_end,
        isCurrent: true
      });

      const completed = await runtime.store.markJobComplete(
        running.id,
        new Date().toISOString(),
        report.report_id
      );
      if (!completed) {
        await cleanupStoredReport(runtime, report.report_id, artifactKey);
        await runtime.store.markJobFailed(
          running.id,
          new Date().toISOString(),
          "Job was not found for completion."
        );
        return;
      }

      await appendAudit(
        runtime,
        "job.complete",
        {
          route: "/internal/pulse/dispatch",
          job_id: completed.id,
          report_id: report.report_id,
          status: "complete"
        },
        completed.userId
      );

      const unavailableFlags = report.flags.filter((flag) =>
        flag.startsWith("data_unavailable:")
      );
      if (unavailableFlags.length > 0) {
        const message = "Market Pulse degraded with unavailable data";
        captureException(new Error(message), {
          service: serviceName,
          job_id: completed.id,
          report_id: report.report_id,
          cycle_start: report.cycle_start,
          cycle_end: report.cycle_end,
          unavailable_flags: unavailableFlags
        });
      }

      let headline: string | undefined = undefined;
      const firstNewsTitle = report.sections.news_summary.evidence?.[0]?.excerpt;
      if (firstNewsTitle) {
        headline = firstNewsTitle;
      }

      const pushTargets = await runtime.store.listUsersWithDeviceToken();
      const pushResult = await runtime.pushNotifier.sendMarketPulseReady(pushTargets, {
        reportDate: report.cycle_end.slice(0, 10),
        headline
      });

      logInfo("Market Pulse push delivery attempted", {
        job_id: completed.id,
        attempted: pushResult.attempted,
        delivered: pushResult.delivered,
        failed: pushResult.failed,
        provider: pushResult.provider
      });

      for (const invalidUserId of pushResult.invalidTargets) {
        await runtime.store.updateUserDeviceToken(invalidUserId, undefined);
      }

      if (pushResult.failed > 0) {
        const error = new Error("Push delivery partially failed");
        captureException(error, {
          service: serviceName,
          job_id: completed.id,
          attempted: pushResult.attempted,
          delivered: pushResult.delivered,
          failed: pushResult.failed
        });
      }

      await appendAudit(
        runtime,
        "market_pulse.push_delivery",
        {
          route: "/internal/pulse/dispatch",
          job_id: completed.id,
          attempted: pushResult.attempted,
          delivered: pushResult.delivered,
          failed: pushResult.failed,
          provider: pushResult.provider
        },
        completed.userId
      );
    } catch (error) {
      if (artifactKey) {
        await cleanupStoredReport(runtime, report.report_id, artifactKey);
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market Pulse processing failed";
    const failed = await runtime.store.markJobFailed(
      running.id,
      new Date().toISOString(),
      message
    );

    await appendAudit(
      runtime,
      "job.failed",
      {
        route: "/internal/pulse/dispatch",
        job_id: running.id,
        status: "failed",
        error_message: message
      },
      failed?.userId
    );

    captureException(new Error(message), {
      service: serviceName,
      job_id: running.id
    });
  }
}

async function createRuntime(config: ProductApiConfig): Promise<Runtime> {
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`Invalid configuration: ${configErrors.join("; ")}`);
  }

  initSentry({
    enabled: Boolean(process.env.SENTRY_DSN),
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development"
  });

  const store = await createProductStore(config);
  const queue = await createJobQueue({
    backend: config.queueBackend,
    queueKey: config.queueKey,
    redisUrl: config.redisUrl
  });
  const rateLimiter = await createRateLimiter({
    backend: config.queueBackend,
    redisUrl: config.redisUrl,
    windowSeconds: config.rateLimitWindowSeconds,
    maxRequests: config.rateLimitMaxRequests
  });
  const artifactStore = new FilesystemArtifactStore(config.artifactRoot);
  const pushNotifier = new PushNotifier({
    provider: config.pushProviderMode,
    googleApplicationCredentials: config.googleApplicationCredentials
  });
  const tickerSyncScheduler =
    config.storeBackend === "postgres" && config.tickerAutoSyncEnabled
      ? startTickerSyncScheduler(
        store,
        {
          enabled: config.tickerAutoSyncEnabled,
          runOnStartup: config.tickerAutoSyncRunOnStartup,
          deltaIntervalSeconds: config.tickerDeltaSyncIntervalSeconds,
          fullIntervalSeconds: config.tickerFullSyncIntervalSeconds
        },
        process.env
      )
      : undefined;
  const jobRecoveryScheduler = startJobRecoveryScheduler(store, queue, config);

  return {
    config,
    store,
    queue,
    rateLimiter,
    artifactStore,
    pushNotifier,
    close: async () => {
      await Promise.all([
        tickerSyncScheduler?.close() ?? Promise.resolve(),
        jobRecoveryScheduler.close(),
        store.close(),
        queue.close(),
        rateLimiter.close()
      ]);
    }
  };
}

export function startServer(port: number = loadConfig().port): Server {
  const config = {
    ...loadConfig(),
    port
  };
  const runtimePromise = createRuntime(config);

  const server = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    const meta: RequestMeta = {
      requestId: request.headers["x-request-id"]?.toString() ?? randomUUID(),
      pathname
    };

    if (method === "GET" && pathname === "/health") {
      const payload: HealthPayload = { status: "ok" };
      sendJson(response, 200, payload);
      return;
    }

    let runtime: Runtime;
    try {
      runtime = await runtimePromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime initialization failed";
      logError("Runtime initialization failed", {
        request_id: meta.requestId,
        error_message: message
      });
      captureException(new Error(message), {
        service: serviceName,
        request_id: meta.requestId
      });
      sendJson(response, 500, {
        error: "service_unavailable",
        error_message: "Product API runtime failed to initialize"
      });
      return;
    }

    try {
      if (!pathname.startsWith("/internal/")) {
        const rateLimit = await runtime.rateLimiter.check(
          extractClientIp(request),
          `${method}:${routeBucket(pathname)}`
        );
        if (!rateLimit.allowed) {
          logWarn("Rate limit exceeded", {
            request_id: meta.requestId,
            route: pathname
          });
          sendJson(response, 429, {
            error: "rate_limited",
            error_message: "Rate limit exceeded. Please retry later.",
            retry_after_seconds: rateLimit.retryAfterSeconds
          });
          return;
        }
      }

      if (method === "POST" && pathname === "/auth/register") {
        const body = await readJsonBody<AuthRegisterRequest>(request);
        const email = normalizeEmail(body.email ?? "");
        const password = body.password ?? "";

        if (!isValidEmail(email) || password.length < 8) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "A valid email and password (min 8 chars) are required."
          });
          return;
        }

        const passwordHash = await hashPassword(password, runtime.config.bcryptCost);
        const user = await runtime.store.createUser({
          email,
          passwordHash
        });

        if (!user) {
          sendJson(response, 409, {
            error: "email_exists",
            error_message: "An account with this email already exists."
          });
          return;
        }

        const rawVerificationToken = createOpaqueToken(32);
        const now = new Date();
        const verificationExpiresAt = new Date(
          now.getTime() + runtime.config.verificationTokenTtlSeconds * 1000
        ).toISOString();

        await runtime.store.createVerificationToken({
          id: createId(),
          userId: user.id,
          tokenHash: hashOpaqueToken(rawVerificationToken),
          createdAt: now.toISOString(),
          expiresAt: verificationExpiresAt
        });

        await appendAudit(
          runtime,
          "auth.registered",
          {
            request_id: meta.requestId,
            route: pathname
          },
          user.id
        );

        logInfo("Verification email sent", {
          request_id: meta.requestId,
          user_id: user.id,
          provider: runtime.config.emailProviderMode
        });

        sendJson(response, 201, {
          status: "verification_sent",
          email: user.email,
          verification_token: runtime.config.exposeVerificationToken
            ? rawVerificationToken
            : undefined,
          verification_expires_at: verificationExpiresAt
        });
        return;
      }

      if (method === "POST" && pathname === "/auth/verify") {
        const body = await readJsonBody<{ token?: string }>(request);
        const token = body.token?.trim();
        if (!token) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "token is required"
          });
          return;
        }

        const consumedToken = await runtime.store.consumeVerificationToken(
          hashOpaqueToken(token),
          new Date().toISOString()
        );
        if (!consumedToken) {
          sendJson(response, 400, {
            error: "invalid_verification_token",
            error_message: "The verification token is invalid or expired."
          });
          return;
        }

        const user = await runtime.store.markUserVerified(
          consumedToken.userId,
          new Date().toISOString()
        );
        if (!user) {
          sendJson(response, 404, {
            error: "user_not_found",
            error_message: "User not found for verification token."
          });
          return;
        }

        await appendAudit(
          runtime,
          "auth.verified",
          {
            request_id: meta.requestId,
            route: pathname
          },
          user.id
        );

        sendJson(response, 200, {
          status: "verified"
        });
        return;
      }

      if (method === "POST" && pathname === "/auth/login") {
        const body = await readJsonBody<AuthLoginRequest>(request);
        const email = normalizeEmail(body.email ?? "");
        const password = body.password ?? "";
        if (!isValidEmail(email) || password.length < 8) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "A valid email and password are required."
          });
          return;
        }

        const user = await runtime.store.findUserByEmail(email);
        if (!user || !user.verifiedAt || !(await verifyPassword(password, user.passwordHash))) {
          sendJson(response, 401, {
            error: "auth_failed",
            error_message: "Invalid credentials."
          });
          return;
        }

        const now = new Date();
        const refreshTokenExpiresAt = new Date(
          now.getTime() + runtime.config.refreshTokenTtlSeconds * 1000
        ).toISOString();
        const session = await runtime.store.createSession({
          id: createId(),
          userId: user.id,
          createdAt: now.toISOString(),
          expiresAt: refreshTokenExpiresAt
        });

        const tokens = await issueTokens(
          runtime,
          user.id,
          session.id,
          refreshTokenExpiresAt
        );

        await appendAudit(
          runtime,
          "auth.login_succeeded",
          {
            request_id: meta.requestId,
            route: pathname
          },
          user.id
        );

        sendJson(response, 200, tokens);
        return;
      }

      if (method === "POST" && pathname === "/auth/refresh") {
        const body = await readJsonBody<AuthRefreshRequest>(request);
        const refreshToken = body.refresh_token?.trim();
        if (!refreshToken) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "refresh_token is required."
          });
          return;
        }

        const claims = verifyAuthToken(refreshToken, runtime.config.jwtSecret);
        if (!claims || claims.typ !== "refresh") {
          sendJson(response, 401, {
            error: "refresh_failed",
            error_message: "Refresh token is invalid or expired."
          });
          return;
        }

        const session = await runtime.store.getSessionById(claims.sid);
        if (!session || session.revokedAt || session.userId !== claims.sub) {
          sendJson(response, 401, {
            error: "refresh_failed",
            error_message: "Refresh session is invalid."
          });
          return;
        }

        if (Date.parse(session.expiresAt) <= Date.now()) {
          sendJson(response, 401, {
            error: "refresh_failed",
            error_message: "Refresh session expired."
          });
          return;
        }

        const tokens = await issueTokens(
          runtime,
          session.userId,
          session.id,
          session.expiresAt
        );

        await appendAudit(
          runtime,
          "auth.access_refreshed",
          {
            request_id: meta.requestId,
            route: pathname
          },
          session.userId
        );

        sendJson(response, 200, tokens);
        return;
      }

      if (method === "POST" && pathname === "/auth/logout") {
        const bearerToken = parseBearerToken(request);
        const body = await readJsonBody<{ refresh_token?: string }>(request);
        const token = bearerToken ?? body.refresh_token;
        if (!token) {
          sendJson(response, 401, {
            error: "unauthorized",
            error_message: "A valid token is required to logout."
          });
          return;
        }

        const auth = await authenticateAnyToken(runtime, token);
        if (!auth) {
          sendJson(response, 401, {
            error: "unauthorized",
            error_message: "A valid token is required to logout."
          });
          return;
        }

        await runtime.store.revokeSession(auth.sessionId, new Date().toISOString());
        await appendAudit(
          runtime,
          "auth.logout_completed",
          {
            request_id: meta.requestId,
            route: pathname
          },
          auth.userId
        );

        sendJson(response, 200, {
          status: "logged_out"
        });
        return;
      }

      if (pathname.startsWith("/internal/")) {
        const internalToken = request.headers["x-internal-token"]?.toString();
        if (internalToken !== runtime.config.internalWorkerToken) {
          sendJson(response, 401, {
            error: "unauthorized",
            error_message: "Internal token mismatch."
          });
          return;
        }

        if (method === "POST" && pathname === "/internal/pulse/dispatch") {
          const body = await readJsonBody<{
            cycle_start?: string;
            cycle_end?: string;
            force_fail?: boolean;
          }>(request);
          const cycleEnd = body.cycle_end?.trim() || new Date().toISOString();
          const cycleStart =
            body.cycle_start?.trim() ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const forceFail = body.force_fail === true;

          if (!isIsoDateTime(cycleStart) || !isIsoDateTime(cycleEnd)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "cycle_start and cycle_end must be valid ISO datetime strings."
            });
            return;
          }

          if (Date.parse(cycleStart) >= Date.parse(cycleEnd)) {
            sendJson(response, 422, {
              error: "validation_failed",
              error_message: "cycle_start must be before cycle_end."
            });
            return;
          }

          const existing = await runtime.store.findJobByTypeAndCycleStart(
            "market_pulse",
            cycleStart
          );
          if (existing && existing.status !== "failed") {
            sendJson(response, 200, {
              deduplicated: true,
              job: buildJobStatusResponse(existing)
            });
            return;
          }

          const createdAt = new Date().toISOString();
          const job = await runtime.store.createJob({
            id: createId(),
            type: "market_pulse",
            ticker: forceFail ? "FORCE_FAIL" : undefined,
            cycleStart,
            cycleEnd,
            createdAt
          });

          await appendAudit(runtime, "job.queued", {
            request_id: meta.requestId,
            route: pathname,
            job_id: job.id,
            status: "queued",
            cycle_start: cycleStart,
            cycle_end: cycleEnd
          });

          logInfo("Pulse job queued", {
            request_id: meta.requestId,
            job_id: job.id,
            cycle_start: cycleStart,
            cycle_end: cycleEnd
          });

          setImmediate(() => {
            void processMarketPulseJob(runtime, job);
          });

          sendJson(response, 202, {
            deduplicated: false,
            job: buildJobStatusResponse(job)
          });
          return;
        }

        const parts = pathname.split("/").filter(Boolean);
        if (parts.length === 4 && parts[0] === "internal" && parts[1] === "jobs") {
          const jobId = parts[2];
          const action = parts[3];
          if (!jobId) {
            sendJson(response, 404, { status: "not_found" });
            return;
          }

          if (method === "POST" && action === "claim") {
            const running = await runtime.store.markJobRunning(
              jobId,
              new Date().toISOString()
            );
            if (!running) {
              sendJson(response, 409, {
                error: "job_not_claimable",
                error_message: "Job is not queued or does not exist."
              });
              return;
            }

            const analysisRequest: AnalysisRequest = {
              request_id: createId(),
              type: running.type,
              ticker: running.ticker,
              user_id: running.userId,
              job_id: running.id,
              requested_at: new Date().toISOString()
            };
            await appendAudit(runtime, "job.running", {
              request_id: meta.requestId,
              route: pathname,
              job_id: running.id,
              status: "running"
            }, running.userId);

            sendJson(response, 200, {
              job: buildJobStatusResponse(running),
              analysis_request: analysisRequest
            });
            return;
          }

          if (method === "POST" && action === "complete") {
            const body = await readJsonBody<{ report?: AnalysisReport }>(request);
            if (!body.report) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "A valid report payload with matching job_id is required."
              });
              return;
            }
            const validationErrors: string[] = [];
            let report: AnalysisReport;
            try {
              report = assertIncomingAnalysisReport(body.report);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown report validation error";
              validationErrors.push(...message.split("; ").filter((entry) => entry.length > 0));
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "Report failed schema validation before storage.",
                validation_errors: validationErrors
              });
              return;
            }

            if (report.job_id !== jobId) {
              sendJson(response, 422, {
                error: "validation_failed",
                error_message: "A valid report payload with matching job_id is required."
              });
              return;
            }

            let artifactKey: string | undefined;
            try {
              const reportFingerprint =
                report.type === "deep_dive" && report.ticker
                  ? deepDiveFingerprint({
                    ticker: report.ticker,
                    schemaVersion: report.schema_version,
                    latestPeriod: report.historical_context?.latest_period
                  })
                  : undefined;
              const freshnessExpiresAt = reportFingerprint
                ? addHours(new Date().toISOString(), runtime.config.deepDiveReuseFreshnessHours)
                : undefined;

              artifactKey = await runtime.artifactStore.writeReport(report);
              await runtime.store.createReport({
                id: report.report_id,
                jobId: report.job_id,
                type: report.type,
                ticker: report.ticker,
                schemaVersion: report.schema_version,
                artifactKey,
                fingerprint: reportFingerprint,
                freshnessExpiresAt,
                createdAt: report.generated_at,
                isCurrent: true
              });
              const completed = await runtime.store.markJobComplete(
                jobId,
                new Date().toISOString(),
                report.report_id
              );
              if (!completed) {
                await cleanupStoredReport(runtime, report.report_id, artifactKey);
                await runtime.store.markJobFailed(
                  jobId,
                  new Date().toISOString(),
                  "Job was not found for completion."
                );
                sendJson(response, 404, {
                  error: "job_not_found",
                  error_message: "Job was not found for completion."
                });
                return;
              }

              await appendAudit(runtime, "job.complete", {
                request_id: meta.requestId,
                route: pathname,
                job_id: completed.id,
                report_id: report.report_id,
                status: "complete"
              }, completed.userId);

              sendJson(response, 200, {
                status: "ok",
                report_id: report.report_id
              });
              return;
            } catch (error) {
              if (artifactKey) {
                await cleanupStoredReport(runtime, report.report_id, artifactKey);
              }

              const message = error instanceof Error ? error.message : "Report completion failed";
              const failed = await runtime.store.markJobFailed(
                jobId,
                new Date().toISOString(),
                message
              );
              captureException(new Error(message), {
                service: serviceName,
                job_id: jobId
              });
              sendJson(response, failed ? 500 : 404, {
                error: failed ? "internal_error" : "job_not_found",
                error_message: failed
                  ? "Product API failed to finalize the report."
                  : "Job was not found for completion."
              });
              return;
            }
          }

          if (method === "POST" && action === "fail") {
            const body = await readJsonBody<{ error_message?: string }>(request);
            const errorMessage = body.error_message?.trim() || "Dexter worker reported a failure.";
            const failed = await runtime.store.markJobFailed(
              jobId,
              new Date().toISOString(),
              errorMessage
            );
            if (!failed) {
              sendJson(response, 404, {
                error: "job_not_found",
                error_message: "Job was not found for failure update."
              });
              return;
            }

            await appendAudit(runtime, "job.failed", {
              request_id: meta.requestId,
              route: pathname,
              job_id: failed.id,
              status: "failed",
              error_message: errorMessage
            }, failed.userId);

            captureException(new Error(errorMessage), {
              service: serviceName,
              job_id: failed.id
            });

            sendJson(response, 200, {
              status: "ok"
            });
            return;
          }
        }

        sendJson(response, 404, { status: "not_found" });
        return;
      }

      if (
        method === "GET" &&
        (pathname === "/v1/historical/financials" ||
          pathname === "/v1/historical/transcripts" ||
          pathname === "/v1/historical/coverage")
      ) {
        const internalRequest = hasInternalToken(request, runtime.config.internalWorkerToken);
        const historicalAuth = internalRequest
          ? undefined
          : await authenticateAccessToken(runtime, request);
        if (!internalRequest && !historicalAuth) {
          sendJson(response, 401, {
            error: "unauthorized",
            error_message: "Authentication required."
          });
          return;
        }

        const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker query parameter is required and must be a valid US symbol."
          });
          return;
        }

        if (pathname === "/v1/historical/financials") {
          const snapshots = await runtime.store.listHistoricalFinancialSnapshotsByTicker(ticker);
          await appendAudit(
            runtime,
            "historical.financials_retrieved",
            {
              request_id: meta.requestId,
              route: pathname,
              ticker,
              internal_request: internalRequest,
              row_count: snapshots.length
            },
            historicalAuth?.userId
          );
          sendJson(response, 200, {
            data: snapshots,
            missing: snapshots.length === 0
          });
          return;
        }

        if (pathname === "/v1/historical/transcripts") {
          const transcripts = await runtime.store.listHistoricalTranscriptsByTicker(ticker);
          await appendAudit(
            runtime,
            "historical.transcripts_retrieved",
            {
              request_id: meta.requestId,
              route: pathname,
              ticker,
              internal_request: internalRequest,
              row_count: transcripts.length
            },
            historicalAuth?.userId
          );
          sendJson(response, 200, {
            data: transcripts,
            missing: transcripts.length === 0
          });
          return;
        }

        const coverage = await runtime.store.getTickerCoverageByTicker(ticker);
        await appendAudit(
          runtime,
          "historical.coverage_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker,
            internal_request: internalRequest,
            found: Boolean(coverage)
          },
          historicalAuth?.userId
        );
        sendJson(response, 200, {
          data: coverage ?? null,
          missing: coverage === undefined
        });
        return;
      }

      const auth = await authenticateAccessToken(runtime, request);
      if (!auth) {
        sendJson(response, 401, {
          error: "unauthorized",
          error_message: "Authentication required."
        });
        return;
      }

      if (method === "POST" && pathname === "/notifications/device-token") {
        const body = await readJsonBody<{ device_token?: string | null }>(request);
        const rawToken = body.device_token;
        const normalizedToken =
          typeof rawToken === "string" && rawToken.trim().length > 0
            ? rawToken.trim()
            : undefined;

        if (normalizedToken && normalizedToken.length < 16) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "device_token must be at least 16 characters."
          });
          return;
        }

        const updated = await runtime.store.updateUserDeviceToken(auth.userId, normalizedToken);
        if (!updated) {
          sendJson(response, 404, {
            error: "user_not_found",
            error_message: "User not found."
          });
          return;
        }

        await appendAudit(
          runtime,
          "notification.device_token_updated",
          {
            request_id: meta.requestId,
            route: pathname,
            has_token: Boolean(normalizedToken)
          },
          auth.userId
        );

        sendJson(response, 200, {
          status: "ok",
          has_device_token: Boolean(normalizedToken)
        });
        return;
      }

      if (method === "GET" && pathname === "/watchlist") {
        const tickers = await runtime.store.listWatchlistTickersByUser(auth.userId);
        sendJson(response, 200, {
          data: tickers
        });
        return;
      }

      if (method === "POST" && pathname === "/watchlist") {
        const body = await readJsonBody<{ ticker?: string }>(request);
        const ticker = body.ticker?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const supportedTicker = await runtime.store.getSupportedTicker(ticker);
        if (!supportedTicker) {
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        const current = await runtime.store.listWatchlistTickersByUser(auth.userId);
        if (!current.includes(ticker) && current.length >= 20) {
          sendJson(response, 422, {
            error: "watchlist_limit_reached",
            error_message: "Watchlist limit is 20 tickers."
          });
          return;
        }

        const updated = await runtime.store.addWatchlistTicker({
          id: createId(),
          userId: auth.userId,
          ticker,
          addedAt: new Date().toISOString()
        });

        await appendAudit(
          runtime,
          "watchlist.ticker_added",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker,
            watchlist_size: updated.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: updated
        });
        return;
      }

      if (method === "DELETE" && pathname.startsWith("/watchlist/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "watchlist") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const ticker = parts[1]?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const updated = await runtime.store.removeWatchlistTicker(auth.userId, ticker);
        await appendAudit(
          runtime,
          "watchlist.ticker_removed",
          {
            request_id: meta.requestId,
            route: pathname,
            ticker,
            watchlist_size: updated.length
          },
          auth.userId
        );

        sendJson(response, 200, {
          data: updated
        });
        return;
      }

      if (method === "GET" && pathname === "/pulse/latest") {
        const reportMetadata = await runtime.store.getLatestReportByType("market_pulse");
        if (!reportMetadata) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "No Market Pulse report is available yet."
          });
          return;
        }

        const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
        if (!report || !isMarketPulseReport(report)) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Market Pulse report artifact missing."
          });
          return;
        }

        const watchlistTickers = await runtime.store.listWatchlistTickersByUser(auth.userId);
        const personalized = withWatchlistOverlay(report, watchlistTickers);

        await appendAudit(
          runtime,
          "pulse.report_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportMetadata.id,
            watchlist_size: watchlistTickers.length
          },
          auth.userId
        );

        sendJson(response, 200, personalized);
        return;
      }

      if (method === "GET" && pathname.startsWith("/pulse/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "pulse") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const reportDate = normalizeDateInput(parts[1] ?? "");
        if (!reportDate) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "date must be in YYYY-MM-DD format."
          });
          return;
        }

        const reportMetadata = await runtime.store.getReportByTypeAndDate("market_pulse", reportDate);
        if (!reportMetadata) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Market Pulse report not found for the requested date."
          });
          return;
        }

        const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
        if (!report || !isMarketPulseReport(report)) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Market Pulse report artifact missing."
          });
          return;
        }

        const watchlistTickers = await runtime.store.listWatchlistTickersByUser(auth.userId);
        const personalized = withWatchlistOverlay(report, watchlistTickers);

        await appendAudit(
          runtime,
          "pulse.report_retrieved",
          {
            request_id: meta.requestId,
            route: pathname,
            report_id: reportMetadata.id,
            date: reportDate,
            watchlist_size: watchlistTickers.length
          },
          auth.userId
        );

        sendJson(response, 200, personalized);
        return;
      }

      if (method === "GET" && (pathname === "/tickers/search" || pathname === "/tickers")) {
        const query = url.searchParams.get("q")?.trim() ?? "";
        if (!query) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "query parameter q is required."
          });
          return;
        }

        logInfo("Ticker search requested", {
          request_id: meta.requestId,
          user_id: auth.userId,
          query
        });

        const results = await runtime.store.searchTickers(query, 25);
        if (results.length === 0) {
          logWarn("Ticker not found", {
            request_id: meta.requestId,
            user_id: auth.userId,
            query,
            reason: "no_supported_match"
          });
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        logInfo("Ticker search succeeded", {
          request_id: meta.requestId,
          user_id: auth.userId,
          query,
          result_count: results.length
        });
        sendJson(response, 200, {
          data: results
        });
        return;
      }

      if (method === "POST" && pathname === "/jobs") {
        const body = await readJsonBody<CreateJobRequest>(request);
        const ticker = body.ticker?.trim().toUpperCase();
        if (!ticker || !/^[A-Z.-]{1,12}$/.test(ticker)) {
          sendJson(response, 422, {
            error: "validation_failed",
            error_message: "ticker must be a valid US symbol."
          });
          return;
        }

        const supportedTicker = await runtime.store.getSupportedTicker(ticker);
        if (!supportedTicker) {
          logWarn("Ticker not found or unsupported for Deep Dive request", {
            request_id: meta.requestId,
            user_id: auth.userId,
            ticker
          });
          sendJson(response, 404, {
            error: "ticker_not_found",
            error_message: "Ticker not found in supported NYSE/NASDAQ universe."
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const coverage = await runtime.store.getTickerCoverageByTicker(ticker);
        const fingerprint = deepDiveFingerprint({
          ticker,
          schemaVersion: "2.0",
          latestPeriod: coverage?.latest_period ?? undefined
        });
        const reusable = await runtime.store.findReusableDeepDiveReport({
          ticker,
          fingerprint,
          nowIso
        });

        if (reusable) {
          const reuseJob = await runtime.store.createJob({
            id: createId(),
            type: "deep_dive",
            userId: auth.userId,
            ticker,
            createdAt: nowIso
          });
          const completed = await runtime.store.markJobComplete(
            reuseJob.id,
            nowIso,
            reusable.id
          );
          if (!completed) {
            sendJson(response, 500, {
              error: "internal_error",
              error_message: "Failed to attach reusable report."
            });
            return;
          }

          await appendAudit(
            runtime,
            "job.reused",
            {
              request_id: meta.requestId,
              route: pathname,
              job_id: completed.id,
              report_id: reusable.id,
              ticker,
              fingerprint
            },
            auth.userId
          );

          logInfo("Deep dive report reused", {
            request_id: meta.requestId,
            user_id: auth.userId,
            job_id: completed.id,
            report_id: reusable.id,
            ticker,
            fingerprint
          });

          sendJson(response, 200, buildJobStatusResponse(completed));
          return;
        }

        const createdAt = nowIso;
        const job = await runtime.store.createJob({
          id: createId(),
          type: "deep_dive",
          userId: auth.userId,
          ticker,
          createdAt
        });

        try {
          await runtime.queue.publish(job.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Queue publish failed";
          const failedJob = await runtime.store.markJobFailed(
            job.id,
            new Date().toISOString(),
            message
          );
          await appendAudit(runtime, "job.failed", {
            request_id: meta.requestId,
            route: pathname,
            job_id: job.id,
            status: "failed",
            error_message: message
          }, auth.userId);
          captureException(new Error(message), {
            service: serviceName,
            job_id: job.id
          });
          sendJson(response, 503, {
            error: "queue_unavailable",
            error_message: "Job could not be queued.",
            job: failedJob ? buildJobStatusResponse(failedJob) : undefined
          });
          return;
        }

        await appendAudit(runtime, "job.queued", {
          request_id: meta.requestId,
          route: pathname,
          job_id: job.id,
          ticker,
          status: "queued"
        }, auth.userId);

        logInfo("Job queued", {
          request_id: meta.requestId,
          user_id: auth.userId,
          job_id: job.id,
          ticker
        });

        sendJson(response, 202, buildJobStatusResponse(job));
        return;
      }

      if (method === "GET" && pathname.startsWith("/jobs/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "jobs") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const jobId = parts[1];
        if (!jobId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const job = await runtime.store.getJob(jobId);
        if (!job || job.userId !== auth.userId) {
          sendJson(response, 404, {
            error: "job_not_found",
            error_message: "Job not found."
          });
          return;
        }

        sendJson(response, 200, buildJobStatusResponse(job));
        return;
      }

      if (method === "GET" && pathname === "/reports") {
        const reports = await runtime.store.listReportsByUser(auth.userId);
        const payload = reports.map(buildReportListItem);
        sendJson(response, 200, payload);
        return;
      }

      if (method === "GET" && pathname.startsWith("/reports/")) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "reports") {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const reportId = parts[1];
        if (!reportId) {
          sendJson(response, 404, { status: "not_found" });
          return;
        }

        const reportMetadata = await runtime.store.getReportById(reportId);
        if (!reportMetadata) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const hasAccess = await runtime.store.hasReportAccessForUser(auth.userId, reportMetadata.id);
        if (!hasAccess) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report not found."
          });
          return;
        }

        const report = await runtime.artifactStore.readReport(reportMetadata.artifactKey);
        if (!report) {
          sendJson(response, 404, {
            error: "report_not_found",
            error_message: "Report artifact missing."
          });
          return;
        }

        await appendAudit(runtime, "report.retrieved", {
          request_id: meta.requestId,
          route: pathname,
          job_id: reportMetadata.jobId,
          report_id: reportMetadata.id
        }, auth.userId);

        sendJson(response, 200, report);
        return;
      }

      sendJson(response, 404, { status: "not_found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown product-api failure";
      logError("Unhandled request failure", {
        request_id: meta.requestId,
        route: meta.pathname,
        error_message: message
      });
      captureException(new Error(message), {
        service: serviceName,
        request_id: meta.requestId,
        route: meta.pathname
      });
      sendJson(response, 500, {
        error: "internal_error",
        error_message: "Product API failed to process the request."
      });
    }
  });

  server.on("listening", () => {
    logInfo("Service started", {
      port
    });
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    logError("Server error", {
      error_message: message
    });
  });

  server.on("close", () => {
    runtimePromise
      .then((runtime) => runtime.close())
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Runtime close failed";
        logWarn("Runtime close warning", {
          error_message: message
        });
      });
  });

  return server.listen(port);
}

if (require.main === module) {
  startServer();
}
