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

async function startOpenbbCalendarMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.headers["x-internal-token"] !== "dev-internal-worker-token") {
      sendJson(response, 401, { error: "auth_error" });
      return;
    }
    if (url.pathname !== "/internal/calendar/earnings") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      data: {
        events: [
          {
            ticker: "AAPL",
            event_date: "2026-07-28",
            event_time: "after_market",
            provider: "fixture",
            retrieved_at: "2026-07-27T12:00:00.000Z"
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

async function createVerifiedSession(
  baseUrl: string,
  email: string
): Promise<{ accessToken: string; userId: string }> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email,
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
      email,
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");

  const profile = await requestJson(baseUrl, "/v1/user/profile", {
    headers: {
      authorization: `Bearer ${accessToken as string}`
    }
  });
  assert.equal(profile.status, 200);
  const userId = (profile.payload.data as JsonObject).user_id;
  assert.equal(typeof userId, "string");

  return {
    accessToken: accessToken as string,
    userId: userId as string
  };
}

async function promoteUserToPro(baseUrl: string, userId: string): Promise<void> {
  const promote = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
    method: "POST",
    headers: {
      authorization: "Bearer m4-webhook-secret"
    },
    body: {
      event: {
        type: "INITIAL_PURCHASE",
        app_user_id: userId,
        expiration_at: "2099-12-31T00:00:00.000Z"
      }
    }
  });
  assert.equal(promote.status, 200);
}

async function registerDeviceToken(
  baseUrl: string,
  accessToken: string,
  installationId: string
): Promise<void> {
  const response = await requestJson(baseUrl, "/notifications/device-token", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: {
      installation_id: installationId,
      device_token: `${installationId}-token`,
      platform: "android"
    }
  });
  assert.equal(response.status, 200);
}

async function listAlerts(
  baseUrl: string,
  accessToken: string
): Promise<Array<Record<string, unknown>>> {
  const response = await requestJson(baseUrl, "/v1/user/alerts?limit=50", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  assert.equal(response.status, 200);
  return (response.payload.data ?? []) as Array<Record<string, unknown>>;
}

test("PH5 M4 earnings war-room flow persists lifecycle and supports cadence fallback/recovery", async () => {
  const openbbMock = await startOpenbbCalendarMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL,
    MARKET_PULSE_TICKERS: process.env.MARKET_PULSE_TICKERS,
    MARKET_PULSE_SCHEMA_VERSION: process.env.MARKET_PULSE_SCHEMA_VERSION,
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";
  process.env.REVENUECAT_WEBHOOK_SECRET = "m4-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "ph5-m4-war-room@example.com");
    const authHeader = {
      authorization: `Bearer ${session.accessToken}`
    };

    const watchlistAdd = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "AAPL" }
    });
    assert.equal(watchlistAdd.status, 200);

    await promoteUserToPro(baseUrl, session.userId);
    await registerDeviceToken(baseUrl, session.accessToken, "ph5-m4-android-installation-a");

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        start_date: "2026-07-27",
        end_date: "2026-07-29"
      }
    });
    assert.equal(calendarSync.status, 200);

    const preDispatch = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-27",
        phase: "pre"
      }
    });
    assert.equal(preDispatch.status, 200);
    assert.equal(preDispatch.payload.prepared, 1);

    const preAlerts = await listAlerts(baseUrl, session.accessToken);
    const preAlert = preAlerts.find(
      (row) =>
        row.notification_type === "earnings_war_room" &&
        row.reason_code === "war_room_prepared"
    );
    assert.ok(preAlert, "Expected a war_room_prepared alert");
    const preContext = (preAlert?.context ?? {}) as Record<string, unknown>;
    const warRoomId = preContext.war_room_id;
    assert.equal(typeof warRoomId, "string");

    const warRoomInitial = await requestJson(
      baseUrl,
      `/v1/research/war-room/${warRoomId as string}`,
      {
        headers: authHeader
      }
    );
    assert.equal(warRoomInitial.status, 200);
    const warRoomInitialData = warRoomInitial.payload.data as JsonObject;
    assert.equal(warRoomInitialData.current_cadence_min, 15);
    assert.equal(warRoomInitialData.state, "pre");
    const initialTimeline = (warRoomInitialData.timeline ?? []) as Array<JsonObject>;
    assert.ok(initialTimeline.some((event) => event.event_type === "prepared"));

    const degradedFixture = {
      war_room_id: warRoomId,
      status: "timeout",
      lag_minutes: 21,
      runtime_minutes: 13
    };
    const live1 = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-28",
        phase: "live",
        live_fixtures: [degradedFixture]
      }
    });
    assert.equal(live1.status, 200);

    const live2 = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-28",
        phase: "live",
        live_fixtures: [degradedFixture]
      }
    });
    assert.equal(live2.status, 200);

    const warRoomFallback = await requestJson(
      baseUrl,
      `/v1/research/war-room/${warRoomId as string}`,
      {
        headers: authHeader
      }
    );
    assert.equal(warRoomFallback.status, 200);
    const fallbackData = warRoomFallback.payload.data as JsonObject;
    assert.equal(fallbackData.current_cadence_min, 30);
    assert.equal(fallbackData.state, "live");

    const healthyFixture = {
      war_room_id: warRoomId,
      status: "success",
      lag_minutes: 8,
      runtime_minutes: 7
    };
    for (let index = 0; index < 3; index += 1) {
      const liveHealthy = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
        method: "POST",
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        },
        body: {
          as_of: "2026-07-28",
          phase: "live",
          live_fixtures: [healthyFixture]
        }
      });
      assert.equal(liveHealthy.status, 200);
    }

    const warRoomRecovered = await requestJson(
      baseUrl,
      `/v1/research/war-room/${warRoomId as string}`,
      {
        headers: authHeader
      }
    );
    assert.equal(warRoomRecovered.status, 200);
    const recoveredData = warRoomRecovered.payload.data as JsonObject;
    assert.equal(recoveredData.current_cadence_min, 15);

    const postDispatch = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-29",
        phase: "post"
      }
    });
    assert.equal(postDispatch.status, 200);
    assert.equal(postDispatch.payload.post_closed, 1);

    const warRoomClosed = await requestJson(
      baseUrl,
      `/v1/research/war-room/${warRoomId as string}`,
      {
        headers: authHeader
      }
    );
    assert.equal(warRoomClosed.status, 200);
    const closedData = warRoomClosed.payload.data as JsonObject;
    assert.equal(closedData.state, "closed");
    const closedTimeline = (closedData.timeline ?? []) as Array<JsonObject>;
    assert.ok(
      closedTimeline.some((event) => event.event_type === "deep_dive_queued"),
      "Expected deep_dive_queued timeline event"
    );

    const finalAlerts = await listAlerts(baseUrl, session.accessToken);
    assert.ok(
      finalAlerts.some(
        (row) =>
          row.notification_type === "earnings_war_room" &&
          row.reason_code === "war_room_post_refresh_queued"
      ),
      "Expected post-refresh alert in alert ledger"
    );
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTRY_DSN = previous.SENTRY_DSN;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
    process.env.MARKET_PULSE_TICKERS = previous.MARKET_PULSE_TICKERS;
    process.env.MARKET_PULSE_SCHEMA_VERSION = previous.MARKET_PULSE_SCHEMA_VERSION;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
  }
});

test("PH5 M4 degraded War Room preparation falls back to legacy preview for Pro users", async () => {
  const openbbMock = await startOpenbbCalendarMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL,
    MARKET_PULSE_TICKERS: process.env.MARKET_PULSE_TICKERS,
    MARKET_PULSE_SCHEMA_VERSION: process.env.MARKET_PULSE_SCHEMA_VERSION,
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";
  process.env.REVENUECAT_WEBHOOK_SECRET = "m4-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "ph5-m4-war-room-fallback@example.com");
    const authHeader = {
      authorization: `Bearer ${session.accessToken}`
    };

    const watchlistAdd = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "AAPL" }
    });
    assert.equal(watchlistAdd.status, 200);

    await promoteUserToPro(baseUrl, session.userId);
    await registerDeviceToken(baseUrl, session.accessToken, "ph5-m4-android-installation-b");

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        start_date: "2026-07-27",
        end_date: "2026-07-29"
      }
    });
    assert.equal(calendarSync.status, 200);

    const warRoomDispatch = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-27",
        phase: "pre",
        force_fail_user_ids: [session.userId]
      }
    });
    assert.equal(warRoomDispatch.status, 200);
    assert.equal(warRoomDispatch.payload.prepared, 0);
    assert.deepEqual(warRoomDispatch.payload.fallback_user_ids, [session.userId]);

    const previewDispatch = await requestJson(baseUrl, "/internal/notifications/earnings-preview", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-27",
        user_ids: warRoomDispatch.payload.fallback_user_ids as string[]
      }
    });
    assert.equal(previewDispatch.status, 200);
    assert.equal(previewDispatch.payload.fallback_user_count, 1);
    assert.equal(previewDispatch.payload.ticker_count, 1);

    const alerts = await listAlerts(baseUrl, session.accessToken);
    assert.ok(
      alerts.some(
        (row) =>
          row.notification_type === "earnings_preview" &&
          row.reason_code === "earnings_preview_due"
      ),
      "Expected fallback earnings_preview alert for Pro user"
    );
    assert.ok(
      !alerts.some(
        (row) =>
          row.notification_type === "earnings_war_room" &&
          row.reason_code === "war_room_prepared"
      ),
      "Forced failure should suppress war_room_prepared alert"
    );
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTRY_DSN = previous.SENTRY_DSN;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
    process.env.MARKET_PULSE_TICKERS = previous.MARKET_PULSE_TICKERS;
    process.env.MARKET_PULSE_SCHEMA_VERSION = previous.MARKET_PULSE_SCHEMA_VERSION;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
  }
});
