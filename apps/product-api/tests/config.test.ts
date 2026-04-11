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
