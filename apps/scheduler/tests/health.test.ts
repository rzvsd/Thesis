import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { loadConfig, startServer, validateConfig } from "../src/server";

type HealthPayload = {
  status: "ok";
  mode: "scheduled" | "test";
  timezone: string;
  schedule: string;
  macro_stress_schedule: string;
  sentiment_schedule: string;
  historical_sync_schedule: string;
  calendar_sync_schedule: string;
  earnings_preview_schedule: string;
  contrarian_eval_schedule: string;
  weekly_digest_schedule: string;
  next_fire_at?: string;
  next_pulse_fire_at?: string;
  next_macro_stress_fire_at?: string;
  next_sentiment_fire_at?: string;
  next_historical_sync_at?: string;
  next_calendar_sync_at?: string;
  next_earnings_preview_at?: string;
  next_contrarian_eval_at?: string;
  next_weekly_digest_at?: string;
};

test("GET /health returns the expected payload", async () => {
  const server = startServer(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const payload = (await response.json()) as HealthPayload;

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(typeof payload.mode, "string");
  assert.equal(typeof payload.timezone, "string");
  assert.equal(typeof payload.schedule, "string");
  assert.equal(typeof payload.macro_stress_schedule, "string");
  assert.equal(typeof payload.sentiment_schedule, "string");
  assert.equal(typeof payload.historical_sync_schedule, "string");
  assert.equal(typeof payload.calendar_sync_schedule, "string");
  assert.equal(typeof payload.earnings_preview_schedule, "string");
  assert.equal(typeof payload.contrarian_eval_schedule, "string");
  assert.equal(typeof payload.weekly_digest_schedule, "string");

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test("production validation rejects local internal token and test mode", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    SCHEDULER_TEST_MODE: "true"
  });

  const errors = validateConfig(config);

  assert.ok(
    errors.includes(
      "INTERNAL_WORKER_TOKEN must not use the local development default when NODE_ENV=production"
    )
  );
  assert.ok(
    errors.includes(
      "SCHEDULER_TEST_MODE must be false when NODE_ENV=production unless THESIS_ALLOW_PRODUCTION_FIXTURES=true"
    )
  );
});

test("scheduler test fire delay does not enable test mode by itself", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    INTERNAL_WORKER_TOKEN: "production-internal-worker-token",
    SCHEDULER_TEST_MODE: "false",
    SCHEDULER_TEST_FIRE_IN_SECONDS: "120"
  });

  assert.equal(config.testMode, false);
  assert.equal(config.testFireInSeconds, 120);
  assert.deepEqual(validateConfig(config), []);
});
