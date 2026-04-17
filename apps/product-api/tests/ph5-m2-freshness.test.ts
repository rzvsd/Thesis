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
            event_date: "2026-03-15",
            event_time: "after_market",
            provider: "fixture",
            retrieved_at: "2026-03-15T12:00:00.000Z"
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

async function createVerifiedSession(baseUrl: string): Promise<{ accessToken: string }> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "ph5-m2-freshness@example.com",
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
      email: "ph5-m2-freshness@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");
  return { accessToken: accessToken as string };
}

function sampleDeepDiveReport(jobId: string): JsonObject {
  return {
    report_id: "ph5-m2-report-aapl",
    job_id: jobId,
    schema_version: "3.1",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-01-01T08:00:00.000Z",
    confidence: {
      score: 0.74,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["Demand remains resilient."],
      evidence: []
    },
    trust_metadata: {
      generated_at: "2026-01-01T08:00:00.000Z",
      freshness_state: "fresh",
      evidence_count: 10,
      contradiction_state: "none",
      contradictions: [],
      valuation_state: "available",
      missing_data_notes: [],
      quote_provenance: [],
      thesis_drift: {
        status: "available",
        summary: "Baseline thesis is intact.",
        reasons: ["Revenue trajectory remains stable."]
      }
    },
    kill_switch_conditions: [
      {
        condition_id: "ks_guidance",
        condition_text: "Management guidance is revised downward materially.",
        signal_type: "guidance_revision",
        rationale: "Guidance cuts may break core growth assumptions.",
        direction: "any",
        prompt_version: "m2-fixture-v1"
      },
      {
        condition_id: "ks_sec",
        condition_text: "A material SEC filing contradicts core assumptions.",
        signal_type: "sec_filing",
        rationale: "Regulatory filings are hard evidence against thesis integrity.",
        direction: "any",
        prompt_version: "m2-fixture-v1"
      },
      {
        condition_id: "ks_management",
        condition_text: "Leadership turnover impacts execution risk.",
        signal_type: "management_change",
        rationale: "Leadership disruption can invalidate near-term confidence.",
        direction: "any",
        prompt_version: "m2-fixture-v1"
      }
    ],
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL remains durable with manageable downside risk.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

function snapshotByTicker(
  payload: JsonObject,
  ticker: string
): Record<string, unknown> | undefined {
  const rows = (payload.data ?? []) as Array<Record<string, unknown>>;
  return rows.find((row) => String(row.ticker) === ticker);
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("PH5 M2 freshness transitions persist and freshness-decay alerts route to Names", async () => {
  const openbbMock = await startOpenbbCalendarMock();
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
  process.env.SENTIMENT_YAHOO_BASE_URL = "http://127.0.0.1:0";
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
    const headers = { authorization: `Bearer ${auth.accessToken}` };

    const tokenUpdate = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers,
      body: {
        device_token: "device-token-ph5-m2-1234567890"
      }
    });
    assert.equal(tokenUpdate.status, 200);

    const addTicker = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers,
      body: { ticker: "AAPL" }
    });
    assert.equal(addTicker.status, 200);

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers,
      body: { ticker: "AAPL" }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id;
    assert.equal(typeof jobId, "string");

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" }
    });
    assert.equal(claim.status, 200);

    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: {
        report: sampleDeepDiveReport(jobId as string)
      }
    });
    assert.equal(complete.status, 200);

    const recomputeCurrent = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: "2026-01-05" }
    });
    assert.equal(recomputeCurrent.status, 200);
    const snapshotsCurrent = await requestJson(baseUrl, "/v1/user/monitor-snapshots", { headers });
    const current = snapshotByTicker(snapshotsCurrent.payload, "AAPL");
    assert.equal(current?.freshness_state, "current");
    assert.equal(current?.unreviewed_events_count, 0);

    const recomputeAging = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: "2026-01-20" }
    });
    assert.equal(recomputeAging.status, 200);
    const snapshotsAging = await requestJson(baseUrl, "/v1/user/monitor-snapshots", { headers });
    const aging = snapshotByTicker(snapshotsAging.payload, "AAPL");
    assert.equal(aging?.freshness_state, "aging");

    const calendarSync = await requestJson(baseUrl, "/internal/calendar/sync", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: {
        start_date: "2026-03-01",
        end_date: "2026-03-31"
      }
    });
    assert.equal(calendarSync.status, 200);

    const asOfToday = new Date().toISOString().slice(0, 10);
    const recomputeStale = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: asOfToday }
    });
    assert.equal(recomputeStale.status, 200);
    const snapshotsStale = await requestJson(baseUrl, "/v1/user/monitor-snapshots", { headers });
    const stale = snapshotByTicker(snapshotsStale.payload, "AAPL");
    assert.equal(stale?.freshness_state, "stale");
    assert.ok(Number(stale?.material_events_count ?? 0) >= 1);
    assert.ok(Number(stale?.unreviewed_events_count ?? 0) >= 1);

    const evaluate = await requestJson(baseUrl, "/internal/notifications/kill-switch/evaluate", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: {
        as_of: asOfToday,
        signal_source: "event",
        trigger_key: "fixture-guidance-cut-ref",
        fixtures: [
          {
            ticker: "AAPL",
            signal_type: "guidance_revision",
            value: 1,
            reason_text: "Guidance revised down by 10%."
          }
        ]
      }
    });
    assert.equal(evaluate.status, 200);
    assert.ok(Number(evaluate.payload.matched) >= 1);

    const recomputeTriggered = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: asOfToday }
    });
    assert.equal(recomputeTriggered.status, 200);
    const snapshotsTriggered = await requestJson(baseUrl, "/v1/user/monitor-snapshots", { headers });
    const triggered = snapshotByTicker(snapshotsTriggered.payload, "AAPL");
    assert.equal(triggered?.freshness_state, "triggered");
    assert.equal(typeof triggered?.freshness_reason, "string");

    const freshnessDispatch = await requestJson(baseUrl, "/internal/notifications/freshness-decay", {
      method: "POST",
      headers: { "x-internal-token": "dev-internal-worker-token" },
      body: { as_of: asOfToday }
    });
    assert.equal(freshnessDispatch.status, 200);
    assert.ok(Number(freshnessDispatch.payload.fired) >= 1);
    assert.ok(Number(freshnessDispatch.payload.delivered) >= 1);

    const freshnessDispatchSameDay = await requestJson(
      baseUrl,
      "/internal/notifications/freshness-decay",
      {
        method: "POST",
        headers: { "x-internal-token": "dev-internal-worker-token" },
        body: { as_of: asOfToday }
      }
    );
    assert.equal(freshnessDispatchSameDay.status, 200);
    assert.equal(Number(freshnessDispatchSameDay.payload.fired), 0);

    const freshnessDispatchNextDay = await requestJson(
      baseUrl,
      "/internal/notifications/freshness-decay",
      {
        method: "POST",
        headers: { "x-internal-token": "dev-internal-worker-token" },
        body: { as_of: addDays(asOfToday, 1) }
      }
    );
    assert.equal(freshnessDispatchNextDay.status, 200);
    assert.equal(Number(freshnessDispatchNextDay.payload.fired), 0);

    const freshnessDispatchAfterCooldown = await requestJson(
      baseUrl,
      "/internal/notifications/freshness-decay",
      {
        method: "POST",
        headers: { "x-internal-token": "dev-internal-worker-token" },
        body: { as_of: addDays(asOfToday, 4) }
      }
    );
    assert.equal(freshnessDispatchAfterCooldown.status, 200);
    assert.ok(Number(freshnessDispatchAfterCooldown.payload.fired) >= 1);

    const alerts = await requestJson(baseUrl, "/v1/user/alerts?limit=20", { headers });
    assert.equal(alerts.status, 200);
    const alertRows = (alerts.payload.data ?? []) as Array<Record<string, unknown>>;
    const freshnessAlert = alertRows.find((row) => row.notification_type === "freshness_decay");
    assert.ok(freshnessAlert);
    assert.equal(freshnessAlert?.route, "names");
    assert.equal(freshnessAlert?.category, "thesis_drift");
    assert.equal(typeof freshnessAlert?.reason_text, "string");
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
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
