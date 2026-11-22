import { resolve } from "node:path";
import { existsSync } from "node:fs";

export const DEV_JWT_SECRET = "dev-jwt-secret-change-me";
export const DEV_INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
export const DEV_POSTGRES_PASSWORD = "postgres";

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

function parseCsvRaw(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}

function parseOrigins(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}

export type QueueBackend = "redis" | "memory";
export type StoreBackend = "postgres" | "memory";
export type GoogleOidcLinkPolicy = "BLOCK_UNLINKED" | "AUTO_LINK_VERIFIED_EMAIL";
export type EmailProviderMode = "stub" | "resend";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidEmailSender(value: string): boolean {
  const trimmed = value.trim();
  if (isValidEmail(trimmed)) {
    return true;
  }
  const withDisplayName = trimmed.match(/^.+<([^<>]+)>$/);
  if (!withDisplayName) {
    return false;
  }
  return isValidEmail(withDisplayName[1]?.trim() ?? "");
}

function isLikelyBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

function hasRedisAuthInUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      return false;
    }
    return parsed.password.trim().length > 0;
  } catch {
    return false;
  }
}

function databaseUrlUsesPassword(value: string | undefined, password: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      return false;
    }
    return decodeURIComponent(parsed.password) === password;
  } catch {
    return false;
  }
}

export interface ProductApiConfig {
  port: number;
  nodeEnv: string;
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
  artifactStoreMode: "filesystem" | "s3";
  artifactS3Bucket?: string;
  artifactS3Region?: string;
  artifactS3Endpoint?: string;
  artifactS3AccessKeyId?: string;
  artifactS3SecretAccessKey?: string;
  artifactS3ForcePathStyle: boolean;
  artifactS3Prefix: string;
  artifactRequireDurable: boolean;
  emailProviderMode: EmailProviderMode;
  emailResendApiBaseUrl: string;
  emailResendApiKey?: string;
  emailFromAddress?: string;
  exposeVerificationToken: boolean;
  adminBootstrapRequested: boolean;
  adminBootstrapEnabled: boolean;
  adminBootstrapEmail?: string;
  adminBootstrapPasswordHash?: string;
  adminBootstrapAutoVerify: boolean;
  adminBootstrapForcePro: boolean;
  internalWorkerToken: string;
  corsAllowedOrigins: string[];
  maxJsonBodyBytes: number;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
  authRateLimitWindowSeconds: number;
  authRateLimitLoginMaxRequests: number;
  authRateLimitRegisterMaxRequests: number;
  authRateLimitRefreshMaxRequests: number;
  authLockoutMaxFailures: number;
  authLockoutWindowSeconds: number;
  authLockoutDurationSeconds: number;
  tickerAutoSyncEnabled: boolean;
  tickerAutoSyncRunOnStartup: boolean;
  tickerDeltaSyncIntervalSeconds: number;
  tickerFullSyncIntervalSeconds: number;
  marketPulseDataOpenbbBaseUrl: string;
  marketPulseNewsIngestBaseUrl: string;
  marketPulseTickers: string[];
  marketPulseSchemaVersion: string;
  pulseDexterBriefEnabled: boolean;
  pulseDexterWorkerBaseUrl: string;
  pulseDexterTimeoutMs: number;
  sentimentSchemaVersion: string;
  sentimentYahooBaseUrl: string;
  sentimentFredBaseUrl: string;
  sentimentFredApiKey?: string;
  sentimentBreadthUniverseLimit: number;
  sentimentBreadthConcurrency: number;
  sentimentMinimumAvailableInputs: number;
  deepDiveReuseFreshnessHours: number;
  deepDivePrecomputeFreshnessHours: number;
  deepDivePrecomputeBatchSize: number;
  deepDivePrecomputeMaxInFlight: number;
  subscriptionTimezone: string;
  revenuecatApiBaseUrl: string;
  revenuecatPublicAndroidKey?: string;
  revenuecatServerApiKey?: string;
  revenuecatWebhookSecret?: string;
  revenuecatEntitlementId?: string;
  pushProviderMode: "stub" | "fcm";
  googleApplicationCredentials?: string;
  oidcGoogleEnabled: boolean;
  oidcGoogleClientIds: string[];
  oidcGoogleIssuers: string[];
  oidcGoogleJwksUrl: string;
  oidcGoogleJwksJson?: string;
  oidcGoogleClockSkewSeconds: number;
  oidcGoogleLinkPolicy: GoogleOidcLinkPolicy;
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
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase() || "development";
  const databaseUrl = env.DATABASE_URL;
  const explicitStoreBackend = env.STORE_BACKEND;
  const explicitQueueBackend = env.QUEUE_BACKEND;
  const redisUrl = env.REDIS_URL;
  const adminBootstrapRequested = parseBoolean(env.ADMIN_BOOTSTRAP_ENABLED, false);
  const adminBootstrapEnabled = adminBootstrapRequested && nodeEnv !== "production";

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

  const jwtSecret = env.JWT_SECRET ?? DEV_JWT_SECRET;
  const internalWorkerToken = env.INTERNAL_WORKER_TOKEN ?? DEV_INTERNAL_WORKER_TOKEN;
  const rateLimitWindowSeconds = parseInteger(env.RATE_LIMIT_WINDOW_SECONDS, 60);
  const rateLimitMaxRequests = parseInteger(env.RATE_LIMIT_MAX_REQUESTS, 120);
  const authRateLimitWindowSeconds = parseInteger(
    env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    rateLimitWindowSeconds
  );
  const authRateLimitLoginMaxRequests = parseInteger(env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS, 10);
  const authRateLimitRegisterMaxRequests = parseInteger(
    env.AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS,
    6
  );
  const authRateLimitRefreshMaxRequests = parseInteger(
    env.AUTH_RATE_LIMIT_REFRESH_MAX_REQUESTS,
    12
  );
  const authLockoutMaxFailures = parseInteger(env.AUTH_LOCKOUT_MAX_FAILURES, 10);
  const authLockoutWindowSeconds = parseInteger(env.AUTH_LOCKOUT_WINDOW_SECONDS, 15 * 60);
  const authLockoutDurationSeconds = parseInteger(
    env.AUTH_LOCKOUT_DURATION_SECONDS,
    15 * 60
  );
  const artifactStoreModeRaw = env.ARTIFACT_STORE_MODE?.trim().toLowerCase();
  const artifactStoreMode: "filesystem" | "s3" =
    artifactStoreModeRaw === "s3"
      ? "s3"
      : artifactStoreModeRaw === "filesystem"
        ? "filesystem"
        : env.ARTIFACT_S3_BUCKET?.trim()
          ? "s3"
          : "filesystem";
  const oidcGoogleEnabled = parseBoolean(env.OIDC_GOOGLE_ENABLED, false);
  const oidcGoogleClientIds = parseCsvRaw(env.OIDC_GOOGLE_CLIENT_IDS, []);
  const oidcGoogleIssuers = parseCsvRaw(env.OIDC_GOOGLE_ISSUERS, [
    "https://accounts.google.com",
    "accounts.google.com"
  ]);
  const oidcGoogleJwksUrl =
    env.OIDC_GOOGLE_JWKS_URL?.trim() || "https://www.googleapis.com/oauth2/v3/certs";
  const oidcGoogleJwksJson = env.OIDC_GOOGLE_JWKS_JSON?.trim() || undefined;
  const oidcGoogleClockSkewSeconds = parseInteger(env.OIDC_GOOGLE_CLOCK_SKEW_SECONDS, 60);
  const oidcGoogleLinkPolicyRaw = env.OIDC_GOOGLE_LINK_POLICY?.trim().toUpperCase();
  const oidcGoogleLinkPolicy: GoogleOidcLinkPolicy =
    oidcGoogleLinkPolicyRaw === "AUTO_LINK_VERIFIED_EMAIL"
      ? "AUTO_LINK_VERIFIED_EMAIL"
      : "BLOCK_UNLINKED";

  return {
    port,
    nodeEnv,
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
    artifactStoreMode,
    artifactS3Bucket: env.ARTIFACT_S3_BUCKET?.trim() || undefined,
    artifactS3Region: env.ARTIFACT_S3_REGION?.trim() || undefined,
    artifactS3Endpoint: env.ARTIFACT_S3_ENDPOINT?.trim() || undefined,
    artifactS3AccessKeyId: env.ARTIFACT_S3_ACCESS_KEY_ID?.trim() || undefined,
    artifactS3SecretAccessKey: env.ARTIFACT_S3_SECRET_ACCESS_KEY?.trim() || undefined,
    artifactS3ForcePathStyle: parseBoolean(env.ARTIFACT_S3_FORCE_PATH_STYLE, false),
    artifactS3Prefix: env.ARTIFACT_S3_PREFIX?.trim() || "reports",
    artifactRequireDurable: parseBoolean(env.ARTIFACT_REQUIRE_DURABLE, false),
    emailProviderMode:
      env.EMAIL_PROVIDER_MODE?.trim().toLowerCase() === "resend"
        ? "resend"
        : "stub",
    emailResendApiBaseUrl:
      env.EMAIL_RESEND_API_BASE_URL?.trim() || "https://api.resend.com",
    emailResendApiKey: env.EMAIL_RESEND_API_KEY?.trim() || undefined,
    emailFromAddress: env.EMAIL_FROM_ADDRESS?.trim() || undefined,
    exposeVerificationToken: parseBoolean(env.AUTH_EXPOSE_VERIFICATION_TOKEN, false),
    adminBootstrapRequested,
    adminBootstrapEnabled,
    adminBootstrapEmail: env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || undefined,
    adminBootstrapPasswordHash: env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() || undefined,
    adminBootstrapAutoVerify: parseBoolean(env.ADMIN_BOOTSTRAP_AUTO_VERIFY, true),
    adminBootstrapForcePro: parseBoolean(env.ADMIN_BOOTSTRAP_FORCE_PRO, true),
    internalWorkerToken,
    corsAllowedOrigins: parseOrigins(env.CORS_ALLOWED_ORIGINS, [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ]),
    maxJsonBodyBytes: parseInteger(env.MAX_JSON_BODY_BYTES, 1024 * 1024),
    rateLimitWindowSeconds,
    rateLimitMaxRequests,
    authRateLimitWindowSeconds,
    authRateLimitLoginMaxRequests,
    authRateLimitRegisterMaxRequests,
    authRateLimitRefreshMaxRequests,
    authLockoutMaxFailures,
    authLockoutWindowSeconds,
    authLockoutDurationSeconds,
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
    pulseDexterBriefEnabled: parseBoolean(env.PULSE_DEXTER_BRIEF_ENABLED, false),
    pulseDexterWorkerBaseUrl:
      env.PULSE_DEXTER_WORKER_BASE_URL?.trim() ||
      env.DEXTER_WORKER_BASE_URL?.trim() ||
      "http://dexter-worker:3002",
    pulseDexterTimeoutMs: parseInteger(env.PULSE_DEXTER_TIMEOUT_MS, 6000),
    sentimentSchemaVersion: env.SENTIMENT_SCHEMA_VERSION?.trim() || "1.0.0",
    sentimentYahooBaseUrl:
      env.SENTIMENT_YAHOO_BASE_URL?.trim() || "https://query1.finance.yahoo.com",
    sentimentFredBaseUrl:
      env.SENTIMENT_FRED_BASE_URL?.trim() || "https://api.stlouisfed.org/fred",
    sentimentFredApiKey: env.SENTIMENT_FRED_API_KEY?.trim() || undefined,
    sentimentBreadthUniverseLimit: parseInteger(env.SENTIMENT_BREADTH_UNIVERSE_LIMIT, 500),
    sentimentBreadthConcurrency: parseInteger(env.SENTIMENT_BREADTH_CONCURRENCY, 8),
    sentimentMinimumAvailableInputs: parseInteger(env.SENTIMENT_MIN_AVAILABLE_INPUTS, 3),
    deepDiveReuseFreshnessHours: parseInteger(env.DEEP_DIVE_REUSE_FRESHNESS_HOURS, 24),
    // Pre-computed Deep Dives stay valid until the next filing changes the fingerprint (cap: ~1 quarter).
    deepDivePrecomputeFreshnessHours: parseInteger(env.DEEP_DIVE_PRECOMPUTE_FRESHNESS_HOURS, 2160),
    // LLM budget is not decided yet: generate few reports per run; 0 disables pre-compute.
    deepDivePrecomputeBatchSize: parseInteger(env.DEEP_DIVE_PRECOMPUTE_BATCH_SIZE, 10),
    deepDivePrecomputeMaxInFlight: parseInteger(env.DEEP_DIVE_PRECOMPUTE_MAX_IN_FLIGHT, 2),
    subscriptionTimezone: env.SUBSCRIPTION_TIMEZONE?.trim() || "America/New_York",
    revenuecatApiBaseUrl: env.REVENUECAT_API_BASE_URL?.trim() || "https://api.revenuecat.com/v1",
    revenuecatPublicAndroidKey: env.REVENUECAT_PUBLIC_ANDROID_KEY?.trim() || undefined,
    revenuecatServerApiKey: env.REVENUECAT_SERVER_API_KEY?.trim() || undefined,
    revenuecatWebhookSecret: env.REVENUECAT_WEBHOOK_SECRET?.trim() || undefined,
    revenuecatEntitlementId: env.REVENUECAT_ENTITLEMENT_ID?.trim() || undefined,
    pushProviderMode:
      env.PUSH_PROVIDER_MODE?.trim().toLowerCase() === "fcm"
        ? "fcm"
        : "stub",
    googleApplicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || undefined,
    oidcGoogleEnabled,
    oidcGoogleClientIds,
    oidcGoogleIssuers,
    oidcGoogleJwksUrl,
    oidcGoogleJwksJson,
    oidcGoogleClockSkewSeconds,
    oidcGoogleLinkPolicy,
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

  const isValidCorsOrigin = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      return parsed.pathname === "/" && parsed.search.length === 0 && parsed.hash.length === 0;
    } catch {
      return false;
    }
  };

  const isValidTimeZone = (value: string): boolean => {
    try {
      new Intl.DateTimeFormat("en-CA", {
        timeZone: value
      }).format(new Date());
      return true;
    } catch {
      return false;
    }
  };

  if (config.storeBackend === "postgres" && !config.databaseUrl) {
    errors.push("DATABASE_URL is required when STORE_BACKEND=postgres");
  }

  if (config.artifactStoreMode === "s3") {
    if (!config.artifactS3Bucket) {
      errors.push("ARTIFACT_S3_BUCKET is required when ARTIFACT_STORE_MODE=s3");
    }
    if (!config.artifactS3Region) {
      errors.push("ARTIFACT_S3_REGION is required when ARTIFACT_STORE_MODE=s3");
    }
    if (Boolean(config.artifactS3AccessKeyId) !== Boolean(config.artifactS3SecretAccessKey)) {
      errors.push(
        "ARTIFACT_S3_ACCESS_KEY_ID and ARTIFACT_S3_SECRET_ACCESS_KEY must be set together"
      );
    }
  }

  if (config.artifactStoreMode === "filesystem" && config.artifactRequireDurable) {
    errors.push(
      "ARTIFACT_STORE_MODE=s3 is required when ARTIFACT_REQUIRE_DURABLE=true"
    );
  }

  if (config.emailProviderMode === "resend") {
    if (!config.emailResendApiKey) {
      errors.push("EMAIL_RESEND_API_KEY is required when EMAIL_PROVIDER_MODE=resend");
    }
    if (!config.emailFromAddress) {
      errors.push("EMAIL_FROM_ADDRESS is required when EMAIL_PROVIDER_MODE=resend");
    } else if (!isValidEmailSender(config.emailFromAddress)) {
      errors.push("EMAIL_FROM_ADDRESS must be a valid sender address");
    }
    try {
      const parsed = new URL(config.emailResendApiBaseUrl);
      if (parsed.protocol !== "https:") {
        errors.push("EMAIL_RESEND_API_BASE_URL must use https");
      }
    } catch {
      errors.push("EMAIL_RESEND_API_BASE_URL must be a valid URL");
    }
  }

  if (config.queueBackend === "redis" && !config.redisUrl) {
    errors.push("REDIS_URL is required when QUEUE_BACKEND=redis");
  }

  if (
    config.nodeEnv === "production" &&
    config.queueBackend === "redis" &&
    (!config.redisUrl || !hasRedisAuthInUrl(config.redisUrl))
  ) {
    errors.push(
      "REDIS_URL must include password auth when NODE_ENV=production and QUEUE_BACKEND=redis"
    );
  }

  if (config.nodeEnv === "production" && config.jwtSecret === DEV_JWT_SECRET) {
    errors.push("JWT_SECRET must not use the local development default when NODE_ENV=production");
  }

  if (
    config.nodeEnv === "production" &&
    config.internalWorkerToken === DEV_INTERNAL_WORKER_TOKEN
  ) {
    errors.push(
      "INTERNAL_WORKER_TOKEN must not use the local development default when NODE_ENV=production"
    );
  }

  if (config.nodeEnv === "production" && config.exposeVerificationToken) {
    errors.push("AUTH_EXPOSE_VERIFICATION_TOKEN must be false when NODE_ENV=production");
  }

  if (
    config.nodeEnv === "production" &&
    databaseUrlUsesPassword(config.databaseUrl, DEV_POSTGRES_PASSWORD)
  ) {
    errors.push("DATABASE_URL must not use the default postgres password when NODE_ENV=production");
  }

  if (config.jwtSecret.trim().length < 16) {
    errors.push("JWT_SECRET must be at least 16 characters");
  }

  if (config.internalWorkerToken.trim().length < 16) {
    errors.push("INTERNAL_WORKER_TOKEN must be at least 16 characters");
  }

  if (config.maxJsonBodyBytes <= 0) {
    errors.push("MAX_JSON_BODY_BYTES must be greater than 0");
  }

  if (config.rateLimitWindowSeconds <= 0) {
    errors.push("RATE_LIMIT_WINDOW_SECONDS must be greater than 0");
  }

  if (config.rateLimitMaxRequests <= 0) {
    errors.push("RATE_LIMIT_MAX_REQUESTS must be greater than 0");
  }

  if (config.authRateLimitWindowSeconds <= 0) {
    errors.push("AUTH_RATE_LIMIT_WINDOW_SECONDS must be greater than 0");
  }

  if (config.authRateLimitLoginMaxRequests <= 0) {
    errors.push("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS must be greater than 0");
  }

  if (config.authRateLimitRegisterMaxRequests <= 0) {
    errors.push("AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS must be greater than 0");
  }

  if (config.authRateLimitRefreshMaxRequests <= 0) {
    errors.push("AUTH_RATE_LIMIT_REFRESH_MAX_REQUESTS must be greater than 0");
  }

  if (config.authLockoutMaxFailures <= 0) {
    errors.push("AUTH_LOCKOUT_MAX_FAILURES must be greater than 0");
  }

  if (config.authLockoutWindowSeconds <= 0) {
    errors.push("AUTH_LOCKOUT_WINDOW_SECONDS must be greater than 0");
  }

  if (config.authLockoutDurationSeconds <= 0) {
    errors.push("AUTH_LOCKOUT_DURATION_SECONDS must be greater than 0");
  }

  if (config.corsAllowedOrigins.length === 0) {
    errors.push("CORS_ALLOWED_ORIGINS must include at least one origin");
  }

  if (config.corsAllowedOrigins.some((origin) => origin === "*")) {
    errors.push("CORS_ALLOWED_ORIGINS must not include wildcard origins");
  }

  for (const origin of config.corsAllowedOrigins) {
    if (!isValidCorsOrigin(origin)) {
      errors.push(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
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

  if (config.sentimentBreadthUniverseLimit <= 0) {
    errors.push("SENTIMENT_BREADTH_UNIVERSE_LIMIT must be greater than 0");
  }

  if (config.sentimentBreadthConcurrency <= 0) {
    errors.push("SENTIMENT_BREADTH_CONCURRENCY must be greater than 0");
  }

  if (config.sentimentMinimumAvailableInputs <= 0) {
    errors.push("SENTIMENT_MIN_AVAILABLE_INPUTS must be greater than 0");
  }

  if (config.deepDiveReuseFreshnessHours <= 0) {
    errors.push("DEEP_DIVE_REUSE_FRESHNESS_HOURS must be greater than 0");
  }

  if (config.deepDivePrecomputeFreshnessHours <= 0) {
    errors.push("DEEP_DIVE_PRECOMPUTE_FRESHNESS_HOURS must be greater than 0");
  }

  if (config.deepDivePrecomputeBatchSize < 0 || config.deepDivePrecomputeMaxInFlight < 0) {
    errors.push("DEEP_DIVE_PRECOMPUTE_BATCH_SIZE and DEEP_DIVE_PRECOMPUTE_MAX_IN_FLIGHT must be 0 or greater");
  }

  if (config.subscriptionTimezone.trim().length === 0) {
    errors.push("SUBSCRIPTION_TIMEZONE must not be empty");
  } else if (!isValidTimeZone(config.subscriptionTimezone)) {
    errors.push("SUBSCRIPTION_TIMEZONE must be a valid IANA timezone");
  }

  if (
    Boolean(config.revenuecatServerApiKey) !== Boolean(config.revenuecatEntitlementId)
  ) {
    errors.push(
      "REVENUECAT_SERVER_API_KEY and REVENUECAT_ENTITLEMENT_ID must be set together"
    );
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

  if (config.adminBootstrapEnabled) {
    if (!config.adminBootstrapEmail || !isValidEmail(config.adminBootstrapEmail)) {
      errors.push("ADMIN_BOOTSTRAP_EMAIL must be a valid email when ADMIN_BOOTSTRAP_ENABLED=true");
    }

    if (!config.adminBootstrapPasswordHash) {
      errors.push(
        "ADMIN_BOOTSTRAP_PASSWORD_HASH is required when ADMIN_BOOTSTRAP_ENABLED=true"
      );
    } else if (!isLikelyBcryptHash(config.adminBootstrapPasswordHash)) {
      errors.push(
        "ADMIN_BOOTSTRAP_PASSWORD_HASH must be a valid bcrypt hash when ADMIN_BOOTSTRAP_ENABLED=true"
      );
    }
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

  if (config.oidcGoogleEnabled && config.oidcGoogleClientIds.length === 0) {
    errors.push("OIDC_GOOGLE_CLIENT_IDS must include at least one client ID when OIDC_GOOGLE_ENABLED=true");
  }

  if (config.oidcGoogleEnabled && config.oidcGoogleIssuers.length === 0) {
    errors.push("OIDC_GOOGLE_ISSUERS must include at least one issuer when OIDC_GOOGLE_ENABLED=true");
  }

  if (config.oidcGoogleClockSkewSeconds < 0 || config.oidcGoogleClockSkewSeconds > 300) {
    errors.push("OIDC_GOOGLE_CLOCK_SKEW_SECONDS must be between 0 and 300");
  }

  if (config.oidcGoogleEnabled) {
    try {
      const parsed = new URL(config.oidcGoogleJwksUrl);
      if (parsed.protocol !== "https:") {
        errors.push("OIDC_GOOGLE_JWKS_URL must use https");
      }
    } catch {
      errors.push("OIDC_GOOGLE_JWKS_URL must be a valid URL");
    }

    if (config.oidcGoogleJwksJson) {
      try {
        const parsed = JSON.parse(config.oidcGoogleJwksJson) as { keys?: unknown };
        if (!Array.isArray(parsed.keys)) {
          errors.push("OIDC_GOOGLE_JWKS_JSON must include a keys array");
        }
      } catch {
        errors.push("OIDC_GOOGLE_JWKS_JSON must be valid JSON");
      }
    }
  }

  return errors;
}
