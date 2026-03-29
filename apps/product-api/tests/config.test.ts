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
