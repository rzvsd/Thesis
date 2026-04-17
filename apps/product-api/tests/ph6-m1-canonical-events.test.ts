import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { CanonicalEvent } from "../../../packages/contracts/src";
import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

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

async function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: JsonObject;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; payload: JsonObject }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = (await response.json()) as JsonObject;
  return {
    status: response.status,
    payload
  };
}

function buildCanonicalEvent(id: string): CanonicalEvent {
  return {
    id,
    family: "filing_posted",
    subject_type: "ticker",
    subject_id: "AAPL",
    title: "AAPL 10-Q filed with SEC",
    occurred_at: "2026-01-30T00:00:00.000Z",
    source_state: "official",
    source: {
      source: {
        source_id: "SEC_COMPANY_AAPL",
        source_family: "sec_edgar",
        source_name: "SEC EDGAR company truth for AAPL",
        source_url: "https://data.sec.gov/submissions/CIK0000320193.json",
        agency: "SEC",
        agency_series_id: "CIK0000320193"
      },
      retrieved_at: "2026-04-17T00:00:00.000Z",
      retrieval_status: "fresh",
      source_period: "2026-01-30"
    },
    retrieved_at: "2026-04-17T00:00:00.000Z",
    missing_fields: [],
    metadata: {
      ticker: "AAPL",
      cik: "0000320193"
    }
  };
}

test("PH6 M1 canonical events ingest and query through internal API", async () => {
  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const unauthorized = await requestJson(baseUrl, "/internal/canonical-events/ingest", {
      method: "POST",
      body: {
        events: [buildCanonicalEvent("event-without-token")]
      }
    });
    assert.equal(unauthorized.status, 401);

    const ingest = await requestJson(baseUrl, "/internal/canonical-events/ingest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        events: [buildCanonicalEvent("official-company-aapl-test")]
      }
    });
    assert.equal(ingest.status, 200);
    assert.equal(ingest.payload.upserted, 1);

    const list = await requestJson(
      baseUrl,
      "/internal/canonical-events?subject_type=ticker&subject_id=AAPL&family=filing_posted",
      {
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        }
      }
    );
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.payload.data));
    const events = list.payload.data as CanonicalEvent[];
    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "official-company-aapl-test");
    assert.equal(events[0]?.source.source.source_family, "sec_edgar");
  } finally {
    await closeServer(server);
  }
});

test("PH6 M1 canonical event ingest rejects malformed payloads", async () => {
  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const malformed = await requestJson(baseUrl, "/internal/canonical-events/ingest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        events: [{ id: "missing-required-fields" }]
      }
    });
    assert.equal(malformed.status, 422);
    assert.equal(malformed.payload.error, "validation_failed");
  } finally {
    await closeServer(server);
  }
});
