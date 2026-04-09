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

async function startOpenbbMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.headers["x-internal-token"] !== "dev-internal-worker-token") {
      sendJson(response, 401, {
        ok: false,
        data: null,
        error_flag: true,
        error_code: "AUTH_ERROR",
        error_message: "internal authentication required"
      });
      return;
    }

    if (url.pathname !== "/internal/calendar/earnings") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      error_flag: false,
      provider: "yfinance",
      retrieved_at: "2026-04-06T00:00:00.000Z",
      data: {
        events: [
          {
            ticker: "AAPL",
            event_date: "2026-04-09",
            event_time: "after_market",
            provider: "yfinance",
            retrieved_at: "2026-04-06T00:00:00.000Z"
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

async function startYahooPriceMock(): Promise<{ server: Server; baseUrl: string }> {
  const callCount = new Map<string, number>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = url.pathname.match(/^\/v8\/finance\/chart\/([^/]+)$/);
    if (!match) {
      sendJson(response, 404, { chart: { result: [] } });
      return;
    }
    const symbol = decodeURIComponent(match[1] ?? "").trim().toUpperCase();
    const pricesBySymbol: Record<string, number[]> = { AAPL: [100, 90] };
    const configured = pricesBySymbol[symbol];
    if (!configured || configured.length === 0) {
      sendJson(response, 200, {
        chart: { result: [{ indicators: { quote: [{ close: [] }] } }] }
      });
      return;
    }
    const currentCall = callCount.get(symbol) ?? 0;
    const index = Math.min(currentCall, configured.length - 1);
    const price = configured[index] as number;
    callCount.set(symbol, currentCall + 1);
    sendJson(response, 200, {
      chart: {
        result: [
          {
            indicators: {
              quote: [{ close: [price] }]
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
      email: "ph4-m2-alerts@example.com",
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
      email: "ph4-m2-alerts@example.com",
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

function sampleDeepDiveReport(jobId: string): JsonObject {
  return {
    report_id: "ph4-m2-report-aapl",
    job_id: jobId,
    schema_version: "3.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-06T12:00:00.000Z",
    confidence: {
      score: 0.74,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["Margin profile remains resilient."],
      evidence: []
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL remains resilient in the base case.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture-financials"]
  };
}

test("Phase 4 M2 alert ledger persists notification history and supports list/filter/actions", async () => {
  const openbbMock = await startOpenbbMock();
  const yahooMock = await startYahooPriceMock();

  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL,
    MARKET_PULSE_TICKERS: process.env.MARKET_PULSE_TICKERS,
    MARKET_PULSE_SCHEMA_VERSION: process.env.MARKET_PULSE_SCHEMA_VERSION,
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    SENTIMENT_YAHOO_BASE_URL: process.env.SENTIMENT_YAHOO_BASE_URL,
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.REVENUECAT_WEBHOOK_SECRET = "dev-revenuecat-secret";
  process.env.SENTIMENT_YAHOO_BASE_URL = yahooMock.baseUrl;
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const auth = await createVerifiedSession(baseUrl);

    const headers = {
      authorization: `Bearer ${auth.accessToken}`
    };

    const registerToken = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers,
      body: {
        device_token: "device-token-ph4-m2-1234567890",
        installation_id: "install-ph4-m2"
      }
    });
    assert.equal(registerToken.status, 200);

    const watchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers,
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(watchlist.status, 200);

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        start_date: "2026-04-06",
        end_date: "2026-04-10"
      }
    });
    assert.equal(calendarSync.status, 200);

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers,
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id;
    assert.equal(typeof jobId, "string");

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      }
    });
    assert.equal(claim.status, 200);

    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        report: sampleDeepDiveReport(jobId as string)
      }
    });
    assert.equal(complete.status, 200);

    const earningsPreview = await requestJson(baseUrl, "/internal/notifications/earnings-preview", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-08"
      }
    });
    assert.equal(earningsPreview.status, 200);
    assert.equal(earningsPreview.payload.delivered, 1);

    const contrarian = await requestJson(baseUrl, "/internal/notifications/contrarian/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-08"
      }
    });
    assert.equal(contrarian.status, 200);
    assert.equal(contrarian.payload.fired, 1);

    const alerts = await requestJson(baseUrl, "/v1/user/alerts?limit=10", {
      headers
    });
    assert.equal(alerts.status, 200);
    const alertRows = (alerts.payload.data ?? []) as Array<JsonObject>;
    assert.equal(alertRows.length, 2);

    const earningsAlert = alertRows.find((row) => row.notification_type === "earnings_preview");
    const contrarianAlert = alertRows.find((row) => row.notification_type === "contrarian_alert");
    assert.ok(earningsAlert);
    assert.ok(contrarianAlert);
    assert.equal(earningsAlert?.category, "earnings");
    assert.equal(earningsAlert?.route, "research");
    assert.equal(typeof earningsAlert?.reason_text, "string");
    assert.equal(contrarianAlert?.category, "thesis_drift");
    assert.equal(contrarianAlert?.route, "research");
    assert.equal(typeof contrarianAlert?.reason_text, "string");

    const earningsOnly = await requestJson(baseUrl, "/v1/user/alerts?category=earnings&limit=10", {
      headers
    });
    assert.equal(earningsOnly.status, 200);
    const earningsRows = (earningsOnly.payload.data ?? []) as Array<JsonObject>;
    assert.equal(earningsRows.length, 1);
    assert.equal(earningsRows[0]?.notification_type, "earnings_preview");

    const alertId = String(earningsAlert?.id);
    const alertDetail = await requestJson(baseUrl, `/v1/user/alerts/${alertId}`, {
      headers
    });
    assert.equal(alertDetail.status, 200);
    const alertData = alertDetail.payload.data as JsonObject;
    assert.equal(alertData.notification_type, "earnings_preview");
    assert.equal(alertData.route, "research");

    const feedback = await requestJson(baseUrl, `/v1/user/alerts/${alertId}/feedback`, {
      method: "POST",
      headers,
      body: {
        feedback: "useful"
      }
    });
    assert.equal(feedback.status, 200);
    assert.equal((feedback.payload.data as JsonObject).feedback_state, "useful");

    const muted = await requestJson(baseUrl, `/v1/user/alerts/${alertId}/mute`, {
      method: "POST",
      headers
    });
    assert.equal(muted.status, 200);
    assert.equal(typeof (muted.payload.data as JsonObject).muted_at, "string");

    const preferences = await requestJson(baseUrl, "/v1/user/notification-preferences", {
      headers
    });
    assert.equal(preferences.status, 200);
    const preferenceRows = ((preferences.payload.data as JsonObject)?.preferences ?? []) as Array<JsonObject>;
    assert.equal(preferenceRows.length, 5);
    const earningsPreference = preferenceRows.find((row) => row.type === "earnings_preview");
    assert.equal(earningsPreference?.enabled, true);
    assert.equal(typeof earningsPreference?.quiet_until, "string");

    const earningsPreviewWhileQuiet = await requestJson(baseUrl, "/internal/notifications/earnings-preview", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-08"
      }
    });
    assert.equal(earningsPreviewWhileQuiet.status, 200);
    assert.equal(earningsPreviewWhileQuiet.payload.delivered, 0);

    const updatedPreferences = await requestJson(baseUrl, "/v1/user/notification-preferences", {
      method: "PUT",
      headers,
      body: {
        preferences: [
          {
            type: "weekly_digest",
            enabled: false
          }
        ]
      }
    });
    assert.equal(updatedPreferences.status, 200);
    const updatedRows = ((updatedPreferences.payload.data as JsonObject)?.preferences ?? []) as Array<JsonObject>;
    const weeklyDigest = updatedRows.find((row) => row.type === "weekly_digest");
    assert.equal(weeklyDigest?.enabled, false);
    assert.equal(weeklyDigest?.quiet_until, undefined);
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
    await closeServer(yahooMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTRY_DSN = previous.SENTRY_DSN;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
    process.env.MARKET_PULSE_TICKERS = previous.MARKET_PULSE_TICKERS;
    process.env.MARKET_PULSE_SCHEMA_VERSION = previous.MARKET_PULSE_SCHEMA_VERSION;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.SENTIMENT_YAHOO_BASE_URL = previous.SENTIMENT_YAHOO_BASE_URL;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});
