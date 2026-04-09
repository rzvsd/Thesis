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
      retrieved_at: "2026-03-21T00:00:00.000Z",
      data: {
        events: [
          {
            ticker: "AAPL",
            event_date: "2026-03-23",
            event_time: "after_market",
            provider: "yfinance",
            retrieved_at: "2026-03-21T00:00:00.000Z"
          },
          {
            ticker: "ZZZZ",
            event_date: "2026-03-23",
            event_time: "before_market",
            provider: "yfinance",
            retrieved_at: "2026-03-21T00:00:00.000Z"
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

async function startYahooPriceMock(
  pricesBySymbol: Record<string, number[]>
): Promise<{ server: Server; baseUrl: string }> {
  const callCount = new Map<string, number>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = url.pathname.match(/^\/v8\/finance\/chart\/([^/]+)$/);
    if (!match) {
      sendJson(response, 404, { chart: { result: [] } });
      return;
    }
    const symbol = decodeURIComponent(match[1] ?? "").trim().toUpperCase();
    const configured = pricesBySymbol[symbol];
    if (!configured || configured.length === 0) {
      sendJson(response, 200, {
        chart: {
          result: [
            {
              indicators: {
                quote: [{ close: [] }]
              }
            }
          ]
        }
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
      email: "m5-notifications@example.com",
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
      email: "m5-notifications@example.com",
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

test("M5 calendar sync and earnings preview dispatch use internal routes and respect watchlist data", async () => {
  const openbbMock = await startOpenbbMock();

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
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const auth = await createVerifiedSession(baseUrl);

    await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        device_token: "device-token-for-m5-1234567890"
      }
    });

    await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        ticker: "AAPL"
      }
    });

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        start_date: "2026-03-21",
        end_date: "2026-03-24"
      }
    });

    assert.equal(calendarSync.status, 200);
    assert.equal(calendarSync.payload.source_rows, 2);
    assert.equal(calendarSync.payload.supported_rows, 1);
    assert.equal(calendarSync.payload.events_upserted, 1);

    const earningsPreview = await requestJson(
      baseUrl,
      "/internal/notifications/earnings-preview",
      {
        method: "POST",
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        },
        body: {
          as_of: "2026-03-21"
        }
      }
    );

    assert.equal(earningsPreview.status, 200);
    assert.equal(earningsPreview.payload.attempted, 1);
    assert.equal(earningsPreview.payload.delivered, 1);
    assert.equal(earningsPreview.payload.failed, 0);
    assert.equal(earningsPreview.payload.ticker_count, 1);
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
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
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});

test("notification preferences endpoints return and update all M5 notification types", async () => {
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
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
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
    const initial = await requestJson(baseUrl, "/v1/user/notification-preferences", {
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      }
    });

    assert.equal(initial.status, 200);
    const initialData = initial.payload.data as {
      preferences: Array<{ type: string; enabled: boolean }>;
    };
    assert.equal(initialData.preferences.length, 5);

    const updated = await requestJson(baseUrl, "/v1/user/notification-preferences", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        preferences: [
          {
            type: "weekly_digest",
            enabled: false
          }
        ]
      }
    });

    assert.equal(updated.status, 200);
    const updatedData = updated.payload.data as {
      preferences: Array<{ type: string; enabled: boolean }>;
    };
    const preferences = updatedData.preferences;
    const weeklyDigest = preferences.find((row) => row.type === "weekly_digest");
    assert.equal(weeklyDigest?.enabled, false);
  } finally {
    await closeServer(server);
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
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});

test("M5 contrarian evaluation fires from persisted anchors and deactivates fired anchors", async () => {
  const yahooMock = await startYahooPriceMock({
    AAPL: [100, 90]
  });
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
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.SENTIMENT_YAHOO_BASE_URL = yahooMock.baseUrl;
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const auth = await createVerifiedSession(baseUrl);

    const registerToken = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        device_token: "device-token-contrarian-1234567890"
      }
    });
    assert.equal(registerToken.status, 200);

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        type: "deep_dive",
        ticker: "AAPL"
      }
    });
    assert.equal(createJob.status, 202);
    const createPayload = createJob.payload as JsonObject;
    const jobId = createPayload.job_id;
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
        report: {
          report_id: "report-contrarian-aapl",
          job_id: jobId,
          schema_version: "2.0",
          type: "deep_dive",
          ticker: "AAPL",
          generated_at: "2026-03-21T12:00:00.000Z",
          confidence: {
            score: 0.7,
            label: "medium",
            limiting_factors: []
          },
          signal: {
            value: "positive",
            reasons: ["Thesis positive for test anchor"],
            evidence: []
          },
          historical_context: {
            latest_period: "2025-Q4",
            prior_quarter_period: "2025-Q3",
            year_ago_period: "2024-Q4",
            transcript_period: "2025-Q4",
            financial_snapshot_count: 4,
            transcript_count: 1,
            transcript_available: true,
            missing_reasons: []
          },
          sections: [
            {
              section_id: "thesis_statement",
              title: "Thesis",
              body: "Test thesis",
              status: "complete",
              evidence: []
            }
          ],
          flags: [],
          data_sources: ["fixture"]
        }
      }
    });
    assert.equal(complete.status, 200);

    const evaluate = await requestJson(baseUrl, "/internal/notifications/contrarian/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-03-21"
      }
    });
    assert.equal(evaluate.status, 200);
    assert.equal(evaluate.payload.fired, 1);
    assert.equal(evaluate.payload.attempted, 1);
    assert.equal(evaluate.payload.delivered, 1);
    assert.equal(evaluate.payload.failed, 0);

    const secondEvaluate = await requestJson(
      baseUrl,
      "/internal/notifications/contrarian/evaluate",
      {
        method: "POST",
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        },
        body: {
          as_of: "2026-03-21"
        }
      }
    );
    assert.equal(secondEvaluate.status, 200);
    assert.equal(secondEvaluate.payload.fired, 0);
  } finally {
    await closeServer(server);
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
    process.env.SENTIMENT_YAHOO_BASE_URL = previous.SENTIMENT_YAHOO_BASE_URL;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});

test("M5 weekly digest skips non-Sunday and delivers for Pro users on Sunday", async () => {
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
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.REVENUECAT_WEBHOOK_SECRET = "dev-revenuecat-secret";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const auth = await createVerifiedSession(baseUrl);

    const registerToken = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      },
      body: {
        device_token: "device-token-weekly-1234567890"
      }
    });
    assert.equal(registerToken.status, 200);

    const profile = await requestJson(baseUrl, "/v1/user/profile", {
      method: "GET",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      }
    });
    assert.equal(profile.status, 200);
    const profilePayload = profile.payload as {
      data: { user_id: string; tier: string };
    };
    assert.equal(profilePayload.data.tier, "FREE");

    const toPro = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer dev-revenuecat-secret"
      },
      body: {
        type: "INITIAL_PURCHASE",
        app_user_id: profilePayload.data.user_id,
        expiration_at: "2026-04-21T00:00:00.000Z"
      }
    });
    assert.equal(toPro.status, 200);

    const profileAfterPro = await requestJson(baseUrl, "/v1/user/profile", {
      method: "GET",
      headers: {
        authorization: `Bearer ${auth.accessToken}`
      }
    });
    assert.equal(profileAfterPro.status, 200);
    const proPayload = profileAfterPro.payload as { data: { tier: string } };
    assert.equal(proPayload.data.tier, "PRO");

    const nonSunday = await requestJson(baseUrl, "/internal/notifications/weekly-digest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        digest_date: "2026-03-23"
      }
    });
    assert.equal(nonSunday.status, 200);
    assert.equal(nonSunday.payload.status, "skipped");

    const sunday = await requestJson(baseUrl, "/internal/notifications/weekly-digest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        digest_date: "2026-03-22"
      }
    });
    assert.equal(sunday.status, 200);
    assert.equal(sunday.payload.status, "ok");
    assert.equal(sunday.payload.attempted, 1);
    assert.equal(sunday.payload.delivered, 1);
  } finally {
    await closeServer(server);
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
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});
