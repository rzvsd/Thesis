import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig, validateConfig } from "../src/config";

test("invalid SUBSCRIPTION_TIMEZONE fails startup validation", () => {
  const config = loadConfig({
    ...process.env,
    SUBSCRIPTION_TIMEZONE: "Mars/Base"
  });

  const errors = validateConfig(config);
  assert.ok(
    errors.includes("SUBSCRIPTION_TIMEZONE must be a valid IANA timezone")
  );
});

test("admin bootstrap requires bcrypt hash when enabled", () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "development",
    ADMIN_BOOTSTRAP_ENABLED: "true",
    ADMIN_BOOTSTRAP_EMAIL: "builder@example.com",
    ADMIN_BOOTSTRAP_PASSWORD_HASH: "not-a-hash"
  });

  const errors = validateConfig(config);
  assert.ok(
    errors.includes(
      "ADMIN_BOOTSTRAP_PASSWORD_HASH must be a valid bcrypt hash when ADMIN_BOOTSTRAP_ENABLED=true"
    )
  );
});

test("CORS allowlist rejects wildcard origins", () => {
  const config = loadConfig({
    ...process.env,
    CORS_ALLOWED_ORIGINS: "https://allowed.example,*"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("CORS_ALLOWED_ORIGINS must not include wildcard origins"));
});

test("MAX_JSON_BODY_BYTES must be greater than zero", () => {
  const config = loadConfig({
    ...process.env,
    MAX_JSON_BODY_BYTES: "0"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("MAX_JSON_BODY_BYTES must be greater than 0"));
});

test("production redis queue requires auth in REDIS_URL", () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "production",
    QUEUE_BACKEND: "redis",
    REDIS_URL: "redis://redis:6379/0"
  });

  const errors = validateConfig(config);
  assert.ok(
    errors.includes(
      "REDIS_URL must include password auth when NODE_ENV=production and QUEUE_BACKEND=redis"
    )
  );
});

test("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS must be greater than zero", () => {
  const config = loadConfig({
    ...process.env,
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: "0"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS must be greater than 0"));
});

test("AUTH_LOCKOUT_DURATION_SECONDS must be greater than zero", () => {
  const config = loadConfig({
    ...process.env,
    AUTH_LOCKOUT_DURATION_SECONDS: "0"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("AUTH_LOCKOUT_DURATION_SECONDS must be greater than 0"));
});

test("OIDC requires at least one client id when enabled", () => {
  const config = loadConfig({
    ...process.env,
    OIDC_GOOGLE_ENABLED: "true",
    OIDC_GOOGLE_CLIENT_IDS: "   "
  });

  const errors = validateConfig(config);
  assert.ok(
    errors.includes(
      "OIDC_GOOGLE_CLIENT_IDS must include at least one client ID when OIDC_GOOGLE_ENABLED=true"
    )
  );
});

test("OIDC requires https jwks url when enabled", () => {
  const config = loadConfig({
    ...process.env,
    OIDC_GOOGLE_ENABLED: "true",
    OIDC_GOOGLE_CLIENT_IDS: "test-client",
    OIDC_GOOGLE_JWKS_URL: "http://localhost:3000/jwks"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("OIDC_GOOGLE_JWKS_URL must use https"));
});

test("resend mode requires API key", () => {
  const config = loadConfig({
    ...process.env,
    EMAIL_PROVIDER_MODE: "resend",
    EMAIL_FROM_ADDRESS: "alerts@example.com",
    EMAIL_RESEND_API_KEY: ""
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("EMAIL_RESEND_API_KEY is required when EMAIL_PROVIDER_MODE=resend"));
});

test("resend mode requires valid sender address", () => {
  const config = loadConfig({
    ...process.env,
    EMAIL_PROVIDER_MODE: "resend",
    EMAIL_RESEND_API_KEY: "resend_test_key",
    EMAIL_FROM_ADDRESS: "invalid-sender",
    EMAIL_RESEND_API_BASE_URL: "https://api.resend.com"
  });

  const errors = validateConfig(config);
  assert.ok(errors.includes("EMAIL_FROM_ADDRESS must be a valid sender address"));
});
