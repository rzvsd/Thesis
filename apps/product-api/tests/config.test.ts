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
