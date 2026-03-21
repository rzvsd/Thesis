import { resolve } from "node:path";

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
    tickerFullSyncIntervalSeconds: parseInteger(env.TICKER_FULL_SYNC_INTERVAL_SECONDS, 86400)
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

  return errors;
}
