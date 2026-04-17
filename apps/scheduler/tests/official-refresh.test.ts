import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function closeServer(server: Server): Promise<void> {
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

async function startDataOpenbbMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/v1/official/company") {
      const ticker = url.searchParams.get("ticker") ?? "AAPL";
      sendJson(response, 200, {
        ok: true,
        error_flag: false,
        provider: "sec_edgar",
        data: {
          canonical_events: [
            {
              id: `official-company-${ticker.toLowerCase()}-test`,
              family: "filing_posted",
              subject_type: "ticker",
              subject_id: ticker,
              title: `${ticker} filing`,
              occurred_at: "2026-01-30T00:00:00.000Z",
              source_state: "official",
              source: {
                source: {
                  source_id: `SEC_COMPANY_${ticker}`,
                  source_family: "sec_edgar",
                  source_name: `SEC EDGAR company truth for ${ticker}`,
                  source_url: "https://data.sec.gov/submissions/",
                  agency: "SEC"
                },
                retrieved_at: "2026-04-17T00:00:00.000Z",
                retrieval_status: "fresh"
              },
              retrieved_at: "2026-04-17T00:00:00.000Z",
              missing_fields: [],
              metadata: { ticker }
            }
          ]
        }
      });
      return;
    }
    if (url.pathname === "/v1/official/macro") {
      sendJson(response, 200, {
        ok: true,
        error_flag: false,
        provider: "official_public_macro",
        data: {
          canonical_events: [
            {
              id: "official-macro-treasury-test",
              family: "macro_release_published",
              subject_type: "macro_series",
              subject_id: "TREASURY_DAILY_10Y",
              title: "Daily Treasury Rates - 10 Yr official observation published",
              occurred_at: "2026-04-17T00:00:00.000Z",
              source_state: "official",
              source: {
                source: {
                  source_id: "TREASURY_DAILY_10Y",
                  source_family: "treasury",
                  source_name: "Daily Treasury Rates - 10 Yr",
                  source_url: "https://home.treasury.gov/",
                  agency: "U.S. Treasury"
                },
                retrieved_at: "2026-04-17T00:00:00.000Z",
                retrieval_status: "fresh"
              },
              retrieved_at: "2026-04-17T00:00:00.000Z",
              missing_fields: [],
              metadata: { registry_key: "TREASURY_DAILY_10Y" }
            }
          ]
        }
      });
      return;
    }
    sendJson(response, 404, { status: "not_found" });
  });
  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function startProductApiMock(): Promise<{
  server: Server;
  baseUrl: string;
  ingestedEvents: unknown[];
}> {
  const ingestedEvents: unknown[] = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.headers["x-internal-token"] !== "dev-internal-worker-token") {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/internal/canonical-events/ingest") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { events?: unknown[] };
      ingestedEvents.push(...(body.events ?? []));
      sendJson(response, 200, {
        status: "accepted",
        upserted: body.events?.length ?? 0
      });
      return;
    }
    sendJson(response, 404, { status: "not_found" });
  });
  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, ingestedEvents };
}

test("POST /internal/official/refresh fetches official source events and ingests them", async () => {
  const dataOpenbb = await startDataOpenbbMock();
  const productApi = await startProductApiMock();
  const originalEnv = {
    DATA_OPENBB_INTERNAL_BASE_URL: process.env.DATA_OPENBB_INTERNAL_BASE_URL,
    PRODUCT_API_INTERNAL_BASE_URL: process.env.PRODUCT_API_INTERNAL_BASE_URL,
    SCHEDULER_OFFICIAL_SOURCE_TICKERS: process.env.SCHEDULER_OFFICIAL_SOURCE_TICKERS,
    SCHEDULER_TEST_MODE: process.env.SCHEDULER_TEST_MODE
  };
  process.env.DATA_OPENBB_INTERNAL_BASE_URL = dataOpenbb.baseUrl;
  process.env.PRODUCT_API_INTERNAL_BASE_URL = productApi.baseUrl;
  process.env.SCHEDULER_OFFICIAL_SOURCE_TICKERS = "AAPL,MSFT,TSLA";
  process.env.SCHEDULER_TEST_MODE = "true";

  const scheduler = startServer(0);
  await once(scheduler, "listening");
  const address = scheduler.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/internal/official/refresh`, {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      }
    });
    const payload = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(payload.status, "accepted");
    assert.equal(payload.company_events, 3);
    assert.equal(payload.macro_events, 1);
    assert.equal(productApi.ingestedEvents.length, 4);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await closeServer(scheduler);
    await closeServer(dataOpenbb.server);
    await closeServer(productApi.server);
  }
});
