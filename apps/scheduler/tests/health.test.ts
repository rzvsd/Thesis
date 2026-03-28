import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type HealthPayload = {
  status: "ok";
  mode: "scheduled" | "test";
  timezone: string;
  schedule: string;
  sentiment_schedule: string;
  historical_sync_schedule: string;
  next_fire_at?: string;
  next_pulse_fire_at?: string;
  next_sentiment_fire_at?: string;
  next_historical_sync_at?: string;
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
  assert.equal(typeof payload.sentiment_schedule, "string");
  assert.equal(typeof payload.historical_sync_schedule, "string");

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
