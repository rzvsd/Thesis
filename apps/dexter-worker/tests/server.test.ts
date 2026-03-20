import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

async function closeServer(server: ReturnType<typeof startServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("POST /v1/analyze returns an AnalysisReport for a valid fixture request", async () => {
  process.env.DEXTER_FIXTURE_MODE = "true";
  const server = startServer(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/analyze`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      request_id: "req-msft",
      type: "deep_dive",
      ticker: "MSFT",
      job_id: "job-msft",
      requested_at: "2026-03-15T12:00:00.000Z"
    })
  });
  const payload = (await response.json()) as {
    ticker: string;
    sections: Array<{ body: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ticker, "MSFT");
  assert.ok(payload.sections.every((section) => section.body.trim().length > 0));

  await closeServer(server);
});

test("POST /v1/analyze returns validation errors for an invalid request", async () => {
  process.env.DEXTER_FIXTURE_MODE = "true";
  const server = startServer(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/analyze`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      request_id: "req-invalid",
      type: "market_pulse",
      job_id: "job-invalid",
      requested_at: "2026-03-15T12:00:00.000Z"
    })
  });
  const payload = (await response.json()) as {
    error: string;
    validation_errors: string[];
  };

  assert.equal(response.status, 422);
  assert.equal(payload.error, "validation_failed");
  assert.ok(payload.validation_errors.length > 0);

  await closeServer(server);
});
