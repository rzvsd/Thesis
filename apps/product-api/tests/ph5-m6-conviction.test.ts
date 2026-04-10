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
      authorization: "Bearer m6-webhook-secret"
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

async function addWatchlistTicker(
  baseUrl: string,
  accessToken: string,
  ticker: string
): Promise<void> {
  const response = await requestJson(baseUrl, "/watchlist", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: { ticker }
  });
  assert.equal(response.status, 200);
}

function sampleDeepDiveReport(input: {
  jobId: string;
  reportId: string;
  ticker: string;
  signal: "positive" | "negative" | "neutral";
  thesis: string;
  generatedAt: string;
  relationships?: Array<Record<string, unknown>>;
}): JsonObject {
  return {
    report_id: input.reportId,
    job_id: input.jobId,
    schema_version: "3.0",
    type: "deep_dive",
    ticker: input.ticker,
    generated_at: input.generatedAt,
    confidence: {
      score: 0.82,
      label: "high",
      limiting_factors: []
    },
    signal: {
      value: input.signal,
      reasons: [`${input.ticker} thesis depends on AI infrastructure margin durability.`],
      evidence: [
        {
          evidence_id: `${input.reportId}-evidence-1`,
          source_type: "financial_data",
          source_name: "fixture-financials",
          excerpt: "AI infrastructure margin durability evidence.",
          retrieved_at: input.generatedAt
        }
      ]
    },
    kill_switch_conditions: [
      {
        condition_id: "ks_management_change",
        condition_text: "Key management change weakens execution confidence.",
        signal_type: "management_change",
        rationale: "The thesis depends on execution continuity.",
        prompt_version: "m6-kill-switch-fixture-v1"
      },
      {
        condition_id: "ks_guidance",
        condition_text: "Guidance revision undermines the thesis.",
        signal_type: "guidance_revision",
        rationale: "The thesis depends on forward guidance quality.",
        prompt_version: "m6-kill-switch-fixture-v1"
      },
      {
        condition_id: "ks_news",
        condition_text: "Material negative news contradicts the thesis.",
        signal_type: "news_sentiment",
        rationale: "The thesis depends on evidence staying intact.",
        prompt_version: "m6-kill-switch-fixture-v1"
      }
    ],
    name_relationships: input.relationships ?? [],
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: input.thesis,
        status: "complete",
        evidence: [
          {
            evidence_id: `${input.reportId}-section-evidence`,
            source_type: "article",
            source_name: "fixture-news",
            excerpt: input.thesis,
            retrieved_at: input.generatedAt
          }
        ]
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

async function completeDeepDive(
  baseUrl: string,
  accessToken: string,
  input: {
    reportId: string;
    ticker: string;
    signal: "positive" | "negative" | "neutral";
    thesis: string;
    generatedAt: string;
    relationships?: Array<Record<string, unknown>>;
  }
): Promise<void> {
  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    body: { ticker: input.ticker }
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
      report: sampleDeepDiveReport({
        jobId: jobId as string,
        ...input
      })
    }
  });
  assert.equal(complete.status, 200);
}

test("PH5 M6 conviction journal, opposite case, coherence, and Pro gating", async () => {
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
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT,NVDA";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";
  process.env.REVENUECAT_WEBHOOK_SECRET = "m6-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const pro = await createVerifiedSession(baseUrl, "ph5-m6-pro@example.com");
    const free = await createVerifiedSession(baseUrl, "ph5-m6-free@example.com");
    const proAuth = { authorization: `Bearer ${pro.accessToken}` };
    const freeAuth = { authorization: `Bearer ${free.accessToken}` };

    await promoteUserToPro(baseUrl, pro.userId);
    await registerDeviceToken(baseUrl, pro.accessToken, "ph5-m6-pro-installation");
    await addWatchlistTicker(baseUrl, pro.accessToken, "AAPL");
    await addWatchlistTicker(baseUrl, pro.accessToken, "MSFT");

    await completeDeepDive(baseUrl, pro.accessToken, {
      reportId: "ph5-m6-aapl-report",
      ticker: "AAPL",
      signal: "positive",
      thesis:
        "AAPL remains positive because AI infrastructure margin durability should compound services growth.",
      generatedAt: "2026-01-10T09:30:00.000Z",
      relationships: [
        {
          source_ticker: "NVDA",
          target_ticker: "AAPL",
          relationship_type: "supplier",
          confidence: 0.88,
          evidence_text: "NVDA supply pressure can affect AAPL hardware margin assumptions.",
          rationale: "AAPL's AI hardware thesis depends on durable supplier health.",
          prompt_version: "ph5-m6-relationship-fixture-v1"
        }
      ]
    });
    await completeDeepDive(baseUrl, pro.accessToken, {
      reportId: "ph5-m6-msft-report",
      ticker: "MSFT",
      signal: "negative",
      thesis:
        "MSFT is negative because AI infrastructure margin durability may compress cloud returns.",
      generatedAt: "2026-01-11T09:30:00.000Z"
    });

    const freeJobReportId = "ph5-m6-free-report";
    await completeDeepDive(baseUrl, free.accessToken, {
      reportId: freeJobReportId,
      ticker: "AAPL",
      signal: "positive",
      thesis: "Free report remains accessible for notes but not conviction outputs.",
      generatedAt: "2026-01-12T09:30:00.000Z"
    });

    const initialTimeline = await requestJson(baseUrl, "/v1/conviction/timeline?ticker=AAPL", {
      headers: proAuth
    });
    assert.equal(initialTimeline.status, 200);
    assert.equal(((initialTimeline.payload.data as unknown[]) ?? []).length, 1);

    const freshnessDispatch = await requestJson(baseUrl, "/internal/notifications/freshness-decay", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: { as_of: "2026-04-10", user_ids: [pro.userId] }
    });
    assert.equal(freshnessDispatch.status, 200);
    assert.ok(Number(freshnessDispatch.payload.fired) >= 1);

    const killSwitch = await requestJson(baseUrl, "/internal/notifications/kill-switch/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-10",
        signal_source: "event",
        trigger_key: "m6-kill-switch-fixture",
        fixtures: [
          {
            ticker: "AAPL",
            signal_type: "management_change",
            reason_text: "Fixture management change triggered the AAPL rule."
          }
        ]
      }
    });
    assert.equal(killSwitch.status, 200);
    assert.ok(Number(killSwitch.payload.matched) >= 1);

    const crossName = await requestJson(baseUrl, "/internal/notifications/cross-name/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-10",
        signal_source: "event",
        trigger_key: "m6-cross-name-fixture",
        fixtures: [
          {
            source_ticker: "NVDA",
            signal_type: "guidance_revision",
            reason_text: "NVDA supplier guidance changed."
          }
        ]
      }
    });
    assert.equal(crossName.status, 200);
    assert.equal(Number(crossName.payload.matched), 1);

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

    const warRoomPre = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-27",
        phase: "pre"
      }
    });
    assert.equal(warRoomPre.status, 200);
    assert.equal(Number(warRoomPre.payload.prepared), 1);

    const warRoomPost = await requestJson(baseUrl, "/internal/notifications/earnings-war-room", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-07-29",
        phase: "post"
      }
    });
    assert.equal(warRoomPost.status, 200);
    assert.equal(Number(warRoomPost.payload.post_closed), 1);

    const alerts = await requestJson(baseUrl, "/v1/user/alerts?limit=50", {
      headers: proAuth
    });
    assert.equal(alerts.status, 200);
    const alertRows = (alerts.payload.data ?? []) as Array<JsonObject>;
    const usefulAlert = alertRows.find((row) => row.notification_type === "kill_switch");
    assert.ok(usefulAlert);
    const feedback = await requestJson(
      baseUrl,
      `/v1/user/alerts/${String(usefulAlert.id)}/feedback`,
      {
        method: "POST",
        headers: proAuth,
        body: { feedback: "useful" }
      }
    );
    assert.equal(feedback.status, 200);

    const oppositeCase = await requestJson(
      baseUrl,
      "/v1/reports/ph5-m6-aapl-report/opposite-case",
      {
        method: "POST",
        headers: proAuth
      }
    );
    assert.equal(oppositeCase.status, 200);
    const oppositeData = oppositeCase.payload.data as JsonObject;
    assert.equal(oppositeData.source_report_id, "ph5-m6-aapl-report");
    assert.equal(oppositeData.prompt_version, "thesis-m6-opposite-case");

    const readOppositeCase = await requestJson(
      baseUrl,
      "/v1/reports/ph5-m6-aapl-report/opposite-case",
      {
        headers: proAuth
      }
    );
    assert.equal(readOppositeCase.status, 200);

    const coherence = await requestJson(baseUrl, "/internal/conviction/coherence/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        period_start: "2026-01-01",
        period_end: "2026-12-31",
        user_ids: [pro.userId]
      }
    });
    assert.equal(coherence.status, 200);
    assert.equal(Number(coherence.payload.evaluated_users), 1);
    assert.equal(Number(coherence.payload.generated), 1);

    const timeline = await requestJson(baseUrl, "/v1/conviction/timeline?ticker=AAPL&limit=50", {
      headers: proAuth
    });
    assert.equal(timeline.status, 200);
    const timelineRows = (timeline.payload.data ?? []) as Array<JsonObject>;
    const eventTypes = new Set(timelineRows.map((row) => row.event_type));
    assert.ok(eventTypes.has("deep_dive_generated"));
    assert.ok(eventTypes.has("freshness_decay_alert_fired"));
    assert.ok(eventTypes.has("kill_switch_alert_fired"));
    assert.ok(eventTypes.has("cross_name_alert_fired"));
    assert.ok(eventTypes.has("earnings_war_room_closed"));
    assert.ok(eventTypes.has("alert_feedback_recorded"));
    assert.ok(eventTypes.has("opposite_case_generated"));

    const dedupeTimeline = await requestJson(
      baseUrl,
      "/v1/conviction/timeline?ticker=AAPL&limit=50",
      {
        headers: proAuth
      }
    );
    assert.equal(dedupeTimeline.status, 200);
    assert.equal(
      ((dedupeTimeline.payload.data ?? []) as unknown[]).length,
      timelineRows.length
    );

    const insights = await requestJson(baseUrl, "/v1/conviction/insights?limit=10", {
      headers: proAuth
    });
    assert.equal(insights.status, 200);
    const insight = ((insights.payload.data ?? []) as Array<JsonObject>)[0];
    assert.ok(insight);
    assert.equal(insight.insight_type, "monthly_coherence");
    const findings = (insight.findings ?? []) as Array<JsonObject>;
    assert.ok(findings.some((finding) => finding.finding_type === "overlap"));
    assert.ok(findings.some((finding) => finding.finding_type === "contradiction"));

    const blockedTimeline = await requestJson(baseUrl, "/v1/conviction/timeline", {
      headers: freeAuth
    });
    assert.equal(blockedTimeline.status, 403);

    const blockedOppositeCase = await requestJson(
      baseUrl,
      `/v1/reports/${freeJobReportId}/opposite-case`,
      {
        method: "POST",
        headers: freeAuth
      }
    );
    assert.equal(blockedOppositeCase.status, 403);

    const freeNote = await requestJson(baseUrl, `/v1/reports/${freeJobReportId}/note`, {
      method: "PUT",
      headers: freeAuth,
      body: {
        content: "Free note path still works."
      }
    });
    assert.equal(freeNote.status, 200);
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
