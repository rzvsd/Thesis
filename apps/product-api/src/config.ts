import { resolve } from "node:path";
import { existsSync } from "node:fs";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}

export type QueueBackend = "redis" | "memory";
export type StoreBackend = "postgres" | "memory";

export interface ProductApiConfig {
  port: number;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  verificationTokenTtlSeconds: number;
  bcryptCost: number;
  queueBackend: QueueBackend;
  queueKey: string;
  redisUrl?: string;
  storeBackend: StoreBackend;
  databaseUrl?: string;
  autoMigrate: boolean;
  artifactRoot: string;
  emailProviderMode: "stub";
  exposeVerificationToken: boolean;
  internalWorkerToken: string;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
  tickerAutoSyncEnabled: boolean;
  tickerAutoSyncRunOnStartup: boolean;
  tickerDeltaSyncIntervalSeconds: number;
  tickerFullSyncIntervalSeconds: number;
  marketPulseDataOpenbbBaseUrl: string;
  marketPulseNewsIngestBaseUrl: string;
  marketPulseTickers: string[];
  marketPulseSchemaVersion: string;
  deepDiveReuseFreshnessHours: number;
  pushProviderMode: "stub" | "fcm";
  googleApplicationCredentials?: string;
  jobRecoveryEnabled: boolean;
  jobRecoveryRunOnStartup: boolean;
  jobRecoveryIntervalSeconds: number;
  jobRecoveryBatchSize: number;
  jobRecoveryQueuedStaleSeconds: number;
  jobRecoveryRunningTimeoutSeconds: number;
  jobRecoveryRequeueCooldownSeconds: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProductApiConfig {
  const port = parseInteger(env.PORT, 3001);
  const databaseUrl = env.DATABASE_URL;
  const explicitStoreBackend = env.STORE_BACKEND;
  const explicitQueueBackend = env.QUEUE_BACKEND;
  const redisUrl = env.REDIS_URL;

  const storeBackend: StoreBackend = explicitStoreBackend === "postgres"
    ? "postgres"
    : explicitStoreBackend === "memory"
      ? "memory"
      : databaseUrl
        ? "postgres"
        : "memory";

  const queueBackend: QueueBackend = explicitQueueBackend === "redis"
    ? "redis"
    : explicitQueueBackend === "memory"
      ? "memory"
      : redisUrl
        ? "redis"
        : "memory";

  const jwtSecret = env.JWT_SECRET ?? "dev-jwt-secret-change-me";
  const internalWorkerToken = env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token";

  return {
    port,
    jwtSecret,
    accessTokenTtlSeconds: parseInteger(env.ACCESS_TOKEN_TTL_SECONDS, 15 * 60),
    refreshTokenTtlSeconds: parseInteger(env.REFRESH_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60),
    verificationTokenTtlSeconds: parseInteger(env.VERIFICATION_TOKEN_TTL_SECONDS, 24 * 60 * 60),
    bcryptCost: parseInteger(env.BCRYPT_COST, 12),
    queueBackend,
    queueKey: env.REDIS_JOB_QUEUE_KEY ?? "jobs:deep_dive",
    redisUrl,
    storeBackend,
    databaseUrl,
    autoMigrate: parseBoolean(env.AUTO_MIGRATE, true),
    artifactRoot: env.ARTIFACT_ROOT ?? resolve(process.cwd(), "data", "artifacts"),
    emailProviderMode: "stub",
    exposeVerificationToken: parseBoolean(env.AUTH_EXPOSE_VERIFICATION_TOKEN, false),
    internalWorkerToken,
    rateLimitWindowSeconds: parseInteger(env.RATE_LIMIT_WINDOW_SECONDS, 60),
    rateLimitMaxRequests: parseInteger(env.RATE_LIMIT_MAX_REQUESTS, 120),
    tickerAutoSyncEnabled: parseBoolean(env.TICKER_AUTO_SYNC_ENABLED, true),
    tickerAutoSyncRunOnStartup: parseBoolean(env.TICKER_AUTO_SYNC_RUN_ON_STARTUP, true),
    tickerDeltaSyncIntervalSeconds: parseInteger(env.TICKER_DELTA_SYNC_INTERVAL_SECONDS, 900),
    tickerFullSyncIntervalSeconds: parseInteger(env.TICKER_FULL_SYNC_INTERVAL_SECONDS, 86400),
    marketPulseDataOpenbbBaseUrl:
      env.MARKET_PULSE_DATA_OPENBB_BASE_URL?.trim() || "http://data-openbb:3003",
    marketPulseNewsIngestBaseUrl:
      env.MARKET_PULSE_NEWS_INGEST_BASE_URL?.trim() || "http://news-ingest:3004",
    marketPulseTickers: parseCsv(env.MARKET_PULSE_TICKERS, ["AAPL", "MSFT", "TSLA"]),
    marketPulseSchemaVersion: env.MARKET_PULSE_SCHEMA_VERSION?.trim() || "1.0.0",
    deepDiveReuseFreshnessHours: parseInteger(env.DEEP_DIVE_REUSE_FRESHNESS_HOURS, 24),
    pushProviderMode:
      env.PUSH_PROVIDER_MODE?.trim().toLowerCase() === "fcm"
        ? "fcm"
        : "stub",
    googleApplicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || undefined,
    jobRecoveryEnabled: parseBoolean(env.JOB_RECOVERY_ENABLED, true),
    jobRecoveryRunOnStartup: parseBoolean(env.JOB_RECOVERY_RUN_ON_STARTUP, true),
    jobRecoveryIntervalSeconds: parseInteger(env.JOB_RECOVERY_INTERVAL_SECONDS, 30),
    jobRecoveryBatchSize: parseInteger(env.JOB_RECOVERY_BATCH_SIZE, 100),
    jobRecoveryQueuedStaleSeconds: parseInteger(env.JOB_RECOVERY_QUEUED_STALE_SECONDS, 20),
    jobRecoveryRunningTimeoutSeconds: parseInteger(
      env.JOB_RECOVERY_RUNNING_TIMEOUT_SECONDS,
      180
    ),
    jobRecoveryRequeueCooldownSeconds: parseInteger(
      env.JOB_RECOVERY_REQUEUE_COOLDOWN_SECONDS,
      60
    )
  };
}

export function validateConfig(config: ProductApiConfig): string[] {
  const errors: string[] = [];

  if (config.storeBackend === "postgres" && !config.databaseUrl) {
    errors.push("DATABASE_URL is required when STORE_BACKEND=postgres");
  }

  if (config.queueBackend === "redis" && !config.redisUrl) {
    errors.push("REDIS_URL is required when QUEUE_BACKEND=redis");
  }

  if (config.jwtSecret.trim().length < 16) {
    errors.push("JWT_SECRET must be at least 16 characters");
  }

  if (config.internalWorkerToken.trim().length < 16) {
    errors.push("INTERNAL_WORKER_TOKEN must be at least 16 characters");
  }

  if (config.tickerDeltaSyncIntervalSeconds <= 0) {
    errors.push("TICKER_DELTA_SYNC_INTERVAL_SECONDS must be greater than 0");
  }

  if (config.tickerFullSyncIntervalSeconds <= 0) {
    errors.push("TICKER_FULL_SYNC_INTERVAL_SECONDS must be greater than 0");
  }

  if (config.marketPulseTickers.length === 0) {
    errors.push("MARKET_PULSE_TICKERS must include at least one ticker");
  }

  if (config.deepDiveReuseFreshnessHours <= 0) {
    errors.push("DEEP_DIVE_REUSE_FRESHNESS_HOURS must be greater than 0");
  }

  if (config.jobRecoveryIntervalSeconds <= 0) {
    errors.push("JOB_RECOVERY_INTERVAL_SECONDS must be greater than 0");
  }

  if (config.jobRecoveryBatchSize <= 0) {
    errors.push("JOB_RECOVERY_BATCH_SIZE must be greater than 0");
  }

  if (config.jobRecoveryQueuedStaleSeconds <= 0) {
    errors.push("JOB_RECOVERY_QUEUED_STALE_SECONDS must be greater than 0");
  }

  if (config.jobRecoveryRunningTimeoutSeconds <= 0) {
    errors.push("JOB_RECOVERY_RUNNING_TIMEOUT_SECONDS must be greater than 0");
  }

  if (config.jobRecoveryRequeueCooldownSeconds <= 0) {
    errors.push("JOB_RECOVERY_REQUEUE_COOLDOWN_SECONDS must be greater than 0");
  }

  if (config.pushProviderMode === "fcm" && !config.googleApplicationCredentials) {
    errors.push("GOOGLE_APPLICATION_CREDENTIALS is required when PUSH_PROVIDER_MODE=fcm");
  }

  if (
    config.pushProviderMode === "fcm" &&
    config.googleApplicationCredentials &&
    !existsSync(config.googleApplicationCredentials)
  ) {
    errors.push(
      "GOOGLE_APPLICATION_CREDENTIALS file does not exist for PUSH_PROVIDER_MODE=fcm"
    );
  }

  return errors;
}
