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
            event_date: "2026-08-01",
            event_time: "after_market",
            provider: "calendar_partner",
            timing_state: "estimated",
            source_state: "derived",
            source_ref: {
              source: "calendar_partner_feed"
            },
            reason_text: "Calendar feed estimate pending issuer confirmation.",
            retrieved_at: "2026-07-31T12:00:00.000Z"
          },
          {
            ticker: "AAPL",
            event_date: "2026-08-02",
            event_time: "after_market",
            provider: "sec_official",
            timing_state: "confirmed",
            source_state: "official",
            source_ref: {
              source: "sec_filing_notice"
            },
            reason_text: "Issuer timing confirmed via official source.",
            retrieved_at: "2026-07-31T12:05:00.000Z"
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
      authorization: "Bearer ph6-m4-webhook-secret"
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

test("PH6 M4 earnings state and war room evidence pack expose typed state with transcript optional", async () => {
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
  process.env.REVENUECAT_WEBHOOK_SECRET = "ph6-m4-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "ph6-m4-earnings-state@example.com");
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
    await registerDeviceToken(baseUrl, session.accessToken, "ph6-m4-android-installation");

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        start_date: "2026-07-31",
        end_date: "2026-08-05"
      }
    });
    assert.equal(calendarSync.status, 200);

    const initialStateResponse = await requestJson(
      baseUrl,
      "/v1/research/earnings/state?as_of=2026-08-01&tickers=AAPL&window_past_days=3&window_ahead_days=10",
      { headers: authHeader }
    );
    assert.equal(initialStateResponse.status, 200);
    const initialData = initialStateResponse.payload.data as JsonObject;
    const initialStates = (initialData.states ?? []) as Array<JsonObject>;
    assert.equal(initialStates.length, 1);
    assert.equal(initialStates[0]?.timing_state, "confirmed");
    assert.equal(initialStates[0]?.source_state, "official");
    const initialConflict = initialStates[0]?.conflict as JsonObject;
    assert.equal(initialConflict?.has_conflict, true);
    const eventId = initialStates[0]?.earnings_event_id;
    assert.equal(typeof eventId, "string");

    const ingestArtifacts = await requestJson(baseUrl, "/internal/first-party/context/ingest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        call_artifacts: [
          {
            artifact_id: "artifact-aapl-release",
            ticker: "AAPL",
            event_id: eventId,
            artifact_type: "earnings_release",
            title: "Apple Q3 Earnings Release",
            source_url: "https://investor.apple.com/results",
            source_domain: "investor.apple.com",
            published_at: "2026-08-02T20:05:00.000Z",
            retrieved_at: "2026-08-02T20:06:00.000Z",
            completeness_state: "complete",
            rights: {
              rights_class: "first_party_public",
              display_mode: "excerpt_only",
              source_rank: "first_party",
              source_type: "investor_relations",
              can_store_full_text: false,
              can_display_excerpt: true,
              can_display_link: true,
              policy_reason: "Issuer-hosted release page.",
              reviewed_at: "2026-08-02T20:06:00.000Z"
            },
            metadata: {
              fixture: "ph6-m4"
            }
          }
        ]
      }
    });
    assert.equal(ingestArtifacts.status, 200);

    const actualStateResponse = await requestJson(
      baseUrl,
      "/v1/research/earnings/state?as_of=2026-08-02&tickers=AAPL&window_past_days=3&window_ahead_days=10",
      { headers: authHeader }
    );
    assert.equal(actualStateResponse.status, 200);
    const actualData = actualStateResponse.payload.data as JsonObject;
    const actualStates = (actualData.states ?? []) as Array<JsonObject>;
    assert.equal(actualStates.length, 1);
    assert.equal(actualStates[0]?.timing_state, "actual");
    assert.equal(actualStates[0]?.evidence_state, "release_artifact");
    assert.equal(actualStates[0]?.has_transcript, false);

    const preDispatch = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-08-02",
        phase: "pre"
      }
    });
    assert.equal(preDispatch.status, 200);
    assert.equal(preDispatch.payload.prepared, 1);

    const alerts = await listAlerts(baseUrl, session.accessToken);
    const warRoomAlert = alerts.find(
      (row) =>
        row.notification_type === "earnings_war_room" &&
        row.reason_code === "war_room_prepared"
    );
    assert.ok(warRoomAlert, "Expected war_room_prepared alert with state context.");
    const warRoomContext = (warRoomAlert?.context ?? {}) as JsonObject;
    assert.equal(warRoomContext.earnings_timing_state, "actual");
    assert.equal(warRoomContext.earnings_source_state, "official");
    const warRoomId = warRoomContext.war_room_id;
    assert.equal(typeof warRoomId, "string");

    const warRoomPayload = await requestJson(
      baseUrl,
      `/v1/research/war-room/${warRoomId as string}`,
      { headers: authHeader }
    );
    assert.equal(warRoomPayload.status, 200);
    const warRoomData = warRoomPayload.payload.data as JsonObject;
    const earningsState = warRoomData.earnings_state as JsonObject;
    assert.equal(earningsState.timing_state, "actual");
    const evidencePack = warRoomData.evidence_pack as JsonObject;
    const releaseArtifact = evidencePack.release_artifact as JsonObject;
    assert.equal(releaseArtifact.artifact_id, "artifact-aapl-release");
    const transcript = evidencePack.transcript as JsonObject;
    assert.equal(transcript.available, false);
    const baseline = evidencePack.baseline as JsonObject;
    assert.equal(typeof baseline.kind, "string");
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
