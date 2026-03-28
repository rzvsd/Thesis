import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function buildSeries(start: number, length = 260, step = 1): number[] {
  return Array.from({ length }, (_, index) => Number((start + index * step).toFixed(4)));
}

async function startMarketDataMock(): Promise<{ server: Server; baseUrl: string }> {
  const seriesBySymbol: Record<string, number[]> = {
    "^VIX": buildSeries(20, 260, 0.05),
    "^GSPC": buildSeries(4000, 260, 2),
    SPY: buildSeries(450, 260, 0.3),
    TLT: buildSeries(95, 260, -0.05),
    AAPL: buildSeries(180, 260, 0.4)
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname.startsWith("/v8/finance/chart/")) {
      const rawSymbol = url.pathname.split("/").pop() ?? "";
      const symbol = decodeURIComponent(rawSymbol);
      const series = seriesBySymbol[symbol];
      if (!series) {
        sendJson(response, 404, { error: "symbol_not_found" });
        return;
      }

      sendJson(response, 200, {
        chart: {
          result: [
            {
              timestamp: series.map((_, index) => 1_700_000_000 + index * 86_400),
              indicators: {
                quote: [
                  {
                    close: series
                  }
                ]
              }
            }
          ]
        }
      });
      return;
    }

    if (url.pathname === "/series/observations") {
      const seriesId = url.searchParams.get("series_id") ?? "";
      if (seriesId === "BAMLH0A0HYM2") {
        sendJson(response, 200, {
          observations: [
            {
              date: "2026-03-20",
              value: "3.20"
            }
          ]
        });
        return;
      }

      if (seriesId === "T10Y2Y") {
        sendJson(response, 200, {
          observations: [
            {
              date: "2026-03-20",
              value: "0.45"
            }
          ]
        });
        return;
      }

      sendJson(response, 404, { error: "series_not_found" });
      return;
    }

    sendJson(response, 404, { status: "not_found" });
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

async function createVerifiedSession(baseUrl: string): Promise<string> {
  const email = `m3-sentiment-${Date.now()}@example.com`;
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

test("internal sentiment dispatch stores deterministic snapshots and serves current/history", async () => {
  const marketMock = await startMarketDataMock();

  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTIMENT_YAHOO_BASE_URL: process.env.SENTIMENT_YAHOO_BASE_URL,
    SENTIMENT_FRED_BASE_URL: process.env.SENTIMENT_FRED_BASE_URL,
    SENTIMENT_FRED_API_KEY: process.env.SENTIMENT_FRED_API_KEY,
    SENTIMENT_BREADTH_UNIVERSE_LIMIT: process.env.SENTIMENT_BREADTH_UNIVERSE_LIMIT,
    SENTIMENT_BREADTH_CONCURRENCY: process.env.SENTIMENT_BREADTH_CONCURRENCY,
    SENTIMENT_MIN_AVAILABLE_INPUTS: process.env.SENTIMENT_MIN_AVAILABLE_INPUTS
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTIMENT_YAHOO_BASE_URL = marketMock.baseUrl;
  process.env.SENTIMENT_FRED_BASE_URL = marketMock.baseUrl;
  process.env.SENTIMENT_FRED_API_KEY = "fred-test-key";
  process.env.SENTIMENT_BREADTH_UNIVERSE_LIMIT = "3";
  process.env.SENTIMENT_BREADTH_CONCURRENCY = "1";
  process.env.SENTIMENT_MIN_AVAILABLE_INPUTS = "3";

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const accessToken = await createVerifiedSession(baseUrl);
    const authHeaders = { authorization: `Bearer ${accessToken}` };
    const internalHeaders = { "x-internal-token": "dev-internal-worker-token" };

    const firstDispatch = await requestJson(baseUrl, "/internal/sentiment/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-20"
      }
    });
    assert.equal(firstDispatch.status, 200);
    assert.ok(["created", "updated"].includes(String(firstDispatch.payload.status)));

    const current = await requestJson(baseUrl, "/v1/sentiment/current", {
      headers: authHeaders
    });
    assert.equal(current.status, 200);
    const currentData = current.payload.data as JsonObject;
    assert.equal(currentData.market_date, "2026-03-20");
    assert.equal(typeof currentData.score, "number");
    assert.equal(typeof currentData.label, "string");
    assert.ok((currentData.score as number) >= 0);
    assert.ok((currentData.score as number) <= 100);

    const firstHistory = await requestJson(baseUrl, "/v1/sentiment/history?days=90", {
      headers: authHeaders
    });
    assert.equal(firstHistory.status, 200);
    const firstRows = firstHistory.payload.data as JsonObject[];
    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0]?.market_date, "2026-03-20");

    const secondDispatch = await requestJson(baseUrl, "/internal/sentiment/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-20"
      }
    });
    assert.equal(secondDispatch.status, 200);

    const secondHistory = await requestJson(baseUrl, "/v1/sentiment/history?days=90", {
      headers: authHeaders
    });
    assert.equal(secondHistory.status, 200);
    const secondRows = secondHistory.payload.data as JsonObject[];
    assert.equal(secondRows.length, 1);
    assert.equal(secondRows[0]?.market_date, "2026-03-20");
    assert.equal(secondRows[0]?.score, firstRows[0]?.score);

    const weekendDispatch = await requestJson(baseUrl, "/internal/sentiment/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-21"
      }
    });
    assert.equal(weekendDispatch.status, 200);
    assert.equal(weekendDispatch.payload.status, "skipped");
  } finally {
    if (server) {
      await closeServer(server);
    }
    await closeServer(marketMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTIMENT_YAHOO_BASE_URL = previous.SENTIMENT_YAHOO_BASE_URL;
    process.env.SENTIMENT_FRED_BASE_URL = previous.SENTIMENT_FRED_BASE_URL;
    process.env.SENTIMENT_FRED_API_KEY = previous.SENTIMENT_FRED_API_KEY;
    process.env.SENTIMENT_BREADTH_UNIVERSE_LIMIT = previous.SENTIMENT_BREADTH_UNIVERSE_LIMIT;
    process.env.SENTIMENT_BREADTH_CONCURRENCY = previous.SENTIMENT_BREADTH_CONCURRENCY;
    process.env.SENTIMENT_MIN_AVAILABLE_INPUTS = previous.SENTIMENT_MIN_AVAILABLE_INPUTS;
  }
});

test("sentiment history returns HTTP 200 with empty data when no rows exist", async () => {
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

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const accessToken = await createVerifiedSession(baseUrl);
    const response = await requestJson(baseUrl, "/v1/sentiment/history?days=90", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.payload, {
      data: []
    });
  } finally {
    if (server) {
      await closeServer(server);
    }
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});
