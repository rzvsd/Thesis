import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startYahooPriceMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    if (!request.url?.startsWith("/v8/finance/chart/")) {
      sendJson(response, 404, { chart: { result: [] } });
      return;
    }
    sendJson(response, 200, {
      chart: {
        result: [
          {
            indicators: {
              quote: [{ close: [100] }]
            }
          }
        ]
      }
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
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

async function createVerifiedSession(baseUrl: string): Promise<{
  accessToken: string;
}> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m2-monitor@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(register.status, 201);
  const verificationToken = register.payload.verification_token;
  assert.equal(typeof verificationToken, "string");

  const verify = await requestJson(baseUrl, "/auth/verify", {
    method: "POST",
    body: { token: verificationToken as string }
  });
  assert.equal(verify.status, 200);

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "m2-monitor@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");

  return {
    accessToken: accessToken as string
  };
}

test("M2 monitor snapshots persist on deep-dive completion and recompute unresolved followed names", async () => {
  const yahooMock = await startYahooPriceMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTIMENT_YAHOO_BASE_URL: process.env.SENTIMENT_YAHOO_BASE_URL,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL,
    MARKET_PULSE_TICKERS: process.env.MARKET_PULSE_TICKERS,
    MARKET_PULSE_SCHEMA_VERSION: process.env.MARKET_PULSE_SCHEMA_VERSION,
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE,
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.SENTIMENT_YAHOO_BASE_URL = yahooMock.baseUrl;
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const auth = await createVerifiedSession(baseUrl);

    await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: { ticker: "AAPL" }
    });
    await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: { ticker: "MSFT" }
    });

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: {
        type: "deep_dive",
        ticker: "AAPL"
      }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id as string;

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId}/claim`, {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" }
    });
    assert.equal(claim.status, 200);

    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId}/complete`, {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: {
        report: {
          report_id: "report-m2-monitor-aapl",
          job_id: jobId,
          schema_version: "3.1",
          type: "deep_dive",
          ticker: "AAPL",
          generated_at: "2026-04-03T08:00:00.000Z",
          confidence: {
            score: 0.82,
            label: "high",
            limiting_factors: []
          },
          signal: {
            value: "positive",
            reasons: ["Revenue acceleration remains intact."],
            evidence: []
          },
          historical_context: {
            latest_period: "2025-Q4",
            prior_quarter_period: "2025-Q3",
            year_ago_period: "2024-Q4",
            transcript_period: "2025-Q4",
            financial_snapshot_count: 4,
            transcript_count: 2,
            transcript_available: true,
            missing_reasons: []
          },
          trust_metadata: {
            generated_at: "2026-04-03T08:00:00.000Z",
            freshness_state: "fresh",
            evidence_count: 12,
            contradiction_state: "none",
            contradictions: [],
            valuation_state: "available",
            missing_data_notes: [],
            quote_provenance: [],
            thesis_drift: {
              status: "available",
              summary: "Thesis improved on stronger margins.",
              reasons: ["Operating leverage improved."]
            }
          },
          sections: [
            {
              section_id: "thesis_statement",
              title: "Thesis Statement",
              body: "AAPL remains resilient with improving profitability.",
              status: "complete",
              evidence: []
            }
          ],
          flags: [],
          data_sources: ["financial_data"]
        }
      }
    });
    assert.equal(complete.status, 200);

    const snapshotsAfterComplete = await requestJson(baseUrl, "/v1/user/monitor-snapshots", {
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    assert.equal(snapshotsAfterComplete.status, 200);
    const immediateRows = (snapshotsAfterComplete.payload.data ?? []) as Array<Record<string, unknown>>;
    const aaplImmediate = immediateRows.find((row) => row.ticker === "AAPL");
    assert.ok(aaplImmediate, "AAPL snapshot should exist immediately after completion");
    assert.equal(aaplImmediate?.state, "improved");

    const recompute = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: "2026-04-03" }
    });
    assert.equal(recompute.status, 200);

    const snapshots = await requestJson(baseUrl, "/v1/user/monitor-snapshots", {
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    assert.equal(snapshots.status, 200);
    const rows = (snapshots.payload.data ?? []) as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    const byTicker = new Map(rows.map((row) => [String(row.ticker), row]));
    assert.equal(byTicker.get("AAPL")?.state, "improved");
    assert.equal(byTicker.get("MSFT")?.state, "unresolved");
    assert.equal(typeof byTicker.get("AAPL")?.reason, "string");
    assert.equal(typeof byTicker.get("MSFT")?.reason, "string");
  } finally {
    await closeServer(server);
    await closeServer(yahooMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTRY_DSN = previous.SENTRY_DSN;
    process.env.SENTIMENT_YAHOO_BASE_URL = previous.SENTIMENT_YAHOO_BASE_URL;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
    process.env.MARKET_PULSE_TICKERS = previous.MARKET_PULSE_TICKERS;
    process.env.MARKET_PULSE_SCHEMA_VERSION = previous.MARKET_PULSE_SCHEMA_VERSION;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});
