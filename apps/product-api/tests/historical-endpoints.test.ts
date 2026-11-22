import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

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

async function createVerifiedSession(baseUrl: string): Promise<string> {
  const email = `m1-historical-${Date.now()}@example.com`;
  const password = "VeryStrongPass1!";
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: { email, password }
  });
  assert.equal(register.status, 201);
  const verificationToken = register.payload.verification_token;
  assert.equal(typeof verificationToken, "string");

  const verify = await requestJson(baseUrl, "/auth/verify", {
    method: "POST",
    body: {
      token: verificationToken as string
    }
  });
  assert.equal(verify.status, 200);

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: { email, password }
  });
  assert.equal(login.status, 200);
  const token = login.payload.access_token;
  assert.equal(typeof token, "string");
  return token as string;
}

test("historical endpoints support auth and internal-token retrieval with graceful missing envelopes", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const unauthorized = await requestJson(baseUrl, "/v1/historical/financials?ticker=AAPL");
  assert.equal(unauthorized.status, 401);

  const accessToken = await createVerifiedSession(baseUrl);
  const authHeaders = { authorization: `Bearer ${accessToken}` };

  const financials = await requestJson(baseUrl, "/v1/historical/financials?ticker=AAPL", {
    headers: authHeaders
  });
  assert.equal(financials.status, 200);
  assert.equal(financials.payload.missing, false);
  assert.ok(Array.isArray(financials.payload.data));
  const rows = financials.payload.data as JsonObject[];
  assert.ok(rows.length >= 1);
  assert.equal(rows[0]?.ticker, "AAPL");

  const missingFinancials = await requestJson(baseUrl, "/v1/historical/financials?ticker=ZZZZ", {
    headers: authHeaders
  });
  assert.equal(missingFinancials.status, 200);
  assert.equal(missingFinancials.payload.missing, true);
  assert.deepEqual(missingFinancials.payload.data, []);

  const internalHeaders = {
    "x-internal-token": "dev-internal-worker-token"
  };
  const transcripts = await requestJson(baseUrl, "/v1/historical/transcripts?ticker=AAPL", {
    headers: internalHeaders
  });
  assert.equal(transcripts.status, 200);
  assert.equal(transcripts.payload.missing, false);
  assert.ok(Array.isArray(transcripts.payload.data));

  const coverage = await requestJson(baseUrl, "/v1/historical/coverage?ticker=AAPL", {
    headers: authHeaders
  });
  assert.equal(coverage.status, 200);
  assert.equal(coverage.payload.missing, false);
  const coveragePayload = coverage.payload.data as JsonObject;
  assert.equal(coveragePayload.ticker, "AAPL");

  const missingCoverage = await requestJson(baseUrl, "/v1/historical/coverage?ticker=ZZZZ", {
    headers: authHeaders
  });
  assert.equal(missingCoverage.status, 200);
  assert.equal(missingCoverage.payload.missing, true);
  assert.equal(missingCoverage.payload.data, null);

  const invalidTicker = await requestJson(baseUrl, "/v1/historical/coverage?ticker=bad ticker", {
    headers: authHeaders
  });
  assert.equal(invalidTicker.status, 422);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});

test("historical filing-sections endpoint proxies reviewed SEC excerpts from data-openbb", async () => {
  const { createServer } = await import("node:http");
  let upstreamOk = true;
  const upstream = createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    if (!request.url?.startsWith("/v1/official/filing-sections?ticker=MSFT") || !upstreamOk) {
      response.end(JSON.stringify({ ok: false, error_flag: true, error_message: "SEC EDGAR filing documents are unavailable." }));
      return;
    }
    response.end(JSON.stringify({
      ok: true,
      error_flag: false,
      data: {
        ticker: "MSFT",
        retrieved_at: "2026-03-15T08:00:00.000Z",
        filings: [{ form: "10-Q", period: "2025-12-31", source_url: "https://www.sec.gov/x", sections: [] }]
      }
    }));
  });
  upstream.listen(0);
  await once(upstream, "listening");

  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

  const server = startServer(0);
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const internalHeaders = { "x-internal-token": "dev-internal-worker-token" };
  try {
    const found = await requestJson(baseUrl, "/v1/historical/filing-sections?ticker=MSFT", { headers: internalHeaders });
    assert.equal(found.status, 200);
    assert.equal(found.payload.missing, false);
    assert.equal((found.payload.data as JsonObject[])[0]?.form, "10-Q");

    upstreamOk = false;
    const unavailable = await requestJson(baseUrl, "/v1/historical/filing-sections?ticker=MSFT", { headers: internalHeaders });
    assert.equal(unavailable.status, 200);
    assert.equal(unavailable.payload.missing, true);
    assert.deepEqual(unavailable.payload.data, []);
  } finally {
    await closeServer(server);
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
