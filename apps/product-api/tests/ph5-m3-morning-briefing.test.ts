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

async function startOpenbbMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/v1/official/company") {
      const ticker = url.searchParams.get("ticker") ?? "AAPL";
      sendJson(response, 200, {
        ok: true,
        data: {
          ticker,
          retrieval: {
            source: {
              source_name: "SEC EDGAR",
              source_url: `https://www.sec.gov/${ticker}`
            },
            retrieved_at: "2026-04-01T08:00:00.000Z"
          },
          missing_fields: [],
          canonical_events: [
            {
              id: `filing-${ticker}-2026-04-01`,
              family: "filing_posted",
              subject_type: "ticker",
              subject_id: ticker,
              title: `${ticker} filed a new 8-K`,
              occurred_at: "2026-04-01T10:00:00.000Z",
              source_state: "official",
              source: {
                source: {
                  source_id: `sec-${ticker}`,
                  source_family: "sec_edgar",
                  source_name: "SEC EDGAR",
                  source_url: `https://www.sec.gov/${ticker}`,
                  agency: "SEC",
                  agency_series_id: ticker
                },
                retrieved_at: "2026-04-01T10:05:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-Q1"
              },
              retrieved_at: "2026-04-01T10:05:00.000Z",
              missing_fields: [],
              metadata: {
                form_type: "8-K"
              }
            }
          ]
        },
        error_flag: false
      });
      return;
    }

    if (url.pathname === "/v1/official/macro") {
      sendJson(response, 200, {
        ok: true,
        data: {
          observations: [
            {
              registry_id: "TREASURY_DAILY_10Y",
              value: 4.12,
              unit: "percent",
              period: "2026-04-01",
              category: "rates",
              retrieval: {
                source: {
                  source_name: "U.S. Treasury",
                  source_url: "https://home.treasury.gov/"
                },
                retrieved_at: "2026-04-01T08:00:00.000Z"
              },
              missing_fields: []
            },
            {
              registry_id: "BLS_UNEMPLOYMENT_RATE",
              value: 3.8,
              unit: "percent",
              period: "2026-04",
              category: "labor",
              retrieval: {
                source: {
                  source_name: "BLS",
                  source_url: "https://www.bls.gov/"
                },
                retrieved_at: "2026-04-01T08:00:00.000Z"
              },
              missing_fields: []
            }
          ],
          canonical_events: [
            {
              id: "macro-cpi-2026-04-01",
              family: "macro_release_published",
              subject_type: "macro_series",
              subject_id: "BLS_CPI_U_ALL_ITEMS",
              title: "CPI update published",
              occurred_at: "2026-04-01T07:30:00.000Z",
              source_state: "official",
              source: {
                source: {
                  source_id: "bls-cpi",
                  source_family: "bls",
                  source_name: "BLS CPI",
                  source_url: "https://www.bls.gov/cpi/",
                  agency: "BLS",
                  agency_series_id: "CUUR0000SA0"
                },
                retrieved_at: "2026-04-01T07:35:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-04"
              },
              retrieved_at: "2026-04-01T07:35:00.000Z",
              missing_fields: [],
              metadata: {
                scope: "daily"
              }
            }
          ]
        },
        error_flag: false
      });
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

async function startNewsMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/v1/first-party/context" || request.method !== "POST") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }
    sendJson(response, 200, {
      ok: true,
      data: {
        context_items: [
          {
            context_id: "ctx-aapl-2026-04-01",
            ticker: "AAPL",
            registry_entry_id: "aapl-ir",
            source_url: "https://investor.apple.com/investor-relations/",
            source_domain: "investor.apple.com",
            page_type: "investor_relations",
            title: "Apple investor update",
            summary: "Apple published a first-party investor update.",
            excerpt: "Apple investor update confirms release cadence.",
            retrieved_at: "2026-04-01T12:01:00.000Z",
            published_at: "2026-04-01T12:00:00.000Z",
            content_hash: "ctx-aapl",
            fetch_state: "fetched",
            rights: {
              rights_class: "first_party_public",
              display_mode: "excerpt_only",
              source_rank: "first_party",
              source_type: "investor_relations",
              can_store_full_text: false,
              can_display_excerpt: true,
              can_display_link: true,
              policy_reason: "Approved first-party source.",
              reviewed_at: "2026-03-01T00:00:00.000Z"
            },
            artifact_ids: [],
            metadata: {
              fixture: true
            }
          }
        ]
      },
      error_flag: false
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

async function startRevenueCatMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || !url.pathname.startsWith("/subscribers/")) {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    sendJson(response, 200, {
      subscriber: {
        entitlements: {
          pro: {
            expires_date: "2099-12-31T00:00:00.000Z"
          }
        }
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
  const userData = profile.payload.data as JsonObject;
  const userId = userData.user_id;
  assert.equal(typeof userId, "string");

  return {
    accessToken: accessToken as string,
    userId: userId as string
  };
}

function sampleDeepDiveReport(jobId: string, ticker: string): JsonObject {
  return {
    report_id: `ph5-m3-report-${ticker.toLowerCase()}`,
    job_id: jobId,
    schema_version: "3.1",
    type: "deep_dive",
    ticker,
    generated_at: "2026-01-01T08:00:00.000Z",
    confidence: {
      score: 0.7,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["Baseline remains valid."],
      evidence: []
    },
    trust_metadata: {
      generated_at: "2026-01-01T08:00:00.000Z",
      freshness_state: "fresh",
      evidence_count: 8,
      contradiction_state: "none",
      contradictions: [],
      valuation_state: "available",
      missing_data_notes: [],
      quote_provenance: [],
      thesis_drift: {
        status: "available",
        summary: "Baseline thesis remains stable.",
        reasons: ["No major contradictions."]
      }
    },
    kill_switch_conditions: [
      {
        condition_id: "ks_guidance",
        condition_text: "Guidance is revised materially lower.",
        signal_type: "guidance_revision",
        rationale: "A guidance cut can break growth assumptions.",
        direction: "any",
        prompt_version: "m3-fixture-v1"
      },
      {
        condition_id: "ks_sec",
        condition_text: "A material SEC filing contradicts assumptions.",
        signal_type: "sec_filing",
        rationale: "Regulatory filings can invalidate baseline assumptions.",
        direction: "any",
        prompt_version: "m3-fixture-v1"
      },
      {
        condition_id: "ks_management",
        condition_text: "Leadership turnover introduces execution risk.",
        signal_type: "management_change",
        rationale: "Leadership disruption can undermine execution confidence.",
        direction: "any",
        prompt_version: "m3-fixture-v1"
      }
    ],
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: `${ticker} remains under active watch.`,
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

async function listAlerts(baseUrl: string, accessToken: string): Promise<Array<Record<string, unknown>>> {
  const response = await requestJson(baseUrl, "/v1/user/alerts?limit=50", {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  assert.equal(response.status, 200);
  return (response.payload.data ?? []) as Array<Record<string, unknown>>;
}

async function waitForAlertType(
  baseUrl: string,
  accessToken: string,
  notificationType: string,
  timeoutMs = 12000
): Promise<Array<Record<string, unknown>>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const alerts = await listAlerts(baseUrl, accessToken);
    if (alerts.some((row) => row.notification_type === notificationType)) {
      return alerts;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for alert type ${notificationType}`);
}

test("PH5 M3 morning briefing sends no-change and exception variants and keeps free pulse path", async () => {
  const openbbMock = await startOpenbbMock();
  const newsMock = await startNewsMock();
  const revenueCatMock = await startRevenueCatMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_SERVER_API_KEY: process.env.REVENUECAT_SERVER_API_KEY,
    REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID,
    REVENUECAT_API_BASE_URL: process.env.REVENUECAT_API_BASE_URL,
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
  process.env.REVENUECAT_WEBHOOK_SECRET = "m4-webhook-secret";
  process.env.REVENUECAT_SERVER_API_KEY = "m4-server-api-key";
  process.env.REVENUECAT_ENTITLEMENT_ID = "pro";
  process.env.REVENUECAT_API_BASE_URL = revenueCatMock.baseUrl;
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = newsMock.baseUrl;
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const internalHeaders = { "x-internal-token": "dev-internal-worker-token" };

  try {
    const proNoChange = await createVerifiedSession(baseUrl, "ph5-m3-pro-no-change@example.com");
    const proException = await createVerifiedSession(baseUrl, "ph5-m3-pro-exception@example.com");
    const freeUser = await createVerifiedSession(baseUrl, "ph5-m3-free@example.com");

    const users = [proNoChange, proException, freeUser];
    for (const user of users) {
      const authHeaders = { authorization: `Bearer ${user.accessToken}` };
      const tokenUpdate = await requestJson(baseUrl, "/notifications/device-token", {
        method: "POST",
        headers: authHeaders,
        body: {
          device_token: `token-${user.userId.slice(-12)}`
        }
      });
      assert.equal(tokenUpdate.status, 200);
    }

    for (const proUser of [proNoChange, proException]) {
      const purchase = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
        method: "POST",
        headers: {
          authorization: "Bearer m4-webhook-secret"
        },
        body: {
          event: {
            type: "INITIAL_PURCHASE",
            app_user_id: proUser.userId,
            expiration_at: "2099-12-31T00:00:00.000Z"
          }
        }
      });
      assert.equal(purchase.status, 200);

      const profile = await requestJson(baseUrl, "/v1/user/profile", {
        headers: {
          authorization: `Bearer ${proUser.accessToken}`
        }
      });
      assert.equal(profile.status, 200);
      const profileData = profile.payload.data as JsonObject;
      assert.equal(profileData.tier, "PRO");
    }

    const exceptionWatchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${proException.accessToken}` },
      body: { ticker: "MSFT" }
    });
    assert.equal(exceptionWatchlist.status, 200);

    const freeWatchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: { authorization: `Bearer ${freeUser.accessToken}` },
      body: { ticker: "AAPL" }
    });
    assert.equal(freeWatchlist.status, 200);

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: { authorization: `Bearer ${proException.accessToken}` },
      body: { ticker: "MSFT" }
    });
    assert.equal(createJob.status, 202);
    const jobId = createJob.payload.job_id;
    assert.equal(typeof jobId, "string");

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
      method: "POST",
      headers: internalHeaders
    });
    assert.equal(claim.status, 200);

    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: internalHeaders,
      body: {
        report: sampleDeepDiveReport(jobId as string, "MSFT")
      }
    });
    assert.equal(complete.status, 200);

    const asOfToday = new Date().toISOString().slice(0, 10);
    const recompute = await requestJson(baseUrl, "/internal/monitor/recompute", {
      method: "POST",
      headers: internalHeaders,
      body: { as_of: asOfToday }
    });
    assert.equal(recompute.status, 200);

    const cycleStart = `${asOfToday}T00:00:00.000Z`;
    const cycleEnd = `${asOfToday}T23:59:00.000Z`;
    const dispatch = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: cycleStart,
        cycle_end: cycleEnd
      }
    });
    assert.equal(dispatch.status, 202);

    const proNoChangeAlerts = await waitForAlertType(
      baseUrl,
      proNoChange.accessToken,
      "morning_exception_briefing"
    );
    const proExceptionAlerts = await waitForAlertType(
      baseUrl,
      proException.accessToken,
      "morning_exception_briefing"
    );
    const freeAlerts = await waitForAlertType(
      baseUrl,
      freeUser.accessToken,
      "market_pulse_ready"
    );

    const noChangeBriefing = proNoChangeAlerts.find(
      (row) => row.notification_type === "morning_exception_briefing"
    ) as Record<string, unknown>;
    const noChangeContext = (noChangeBriefing.context ?? {}) as Record<string, unknown>;
    assert.equal(noChangeContext.briefing_mode, "no_change");
    assert.equal(noChangeContext.exceptions_count, 0);
    assert.equal(noChangeContext.report_date, asOfToday);
    assert.equal(
      proNoChangeAlerts.some((row) => row.notification_type === "market_pulse_ready"),
      false
    );

    const exceptionBriefing = proExceptionAlerts.find(
      (row) => row.notification_type === "morning_exception_briefing"
    ) as Record<string, unknown>;
    const exceptionContext = (exceptionBriefing.context ?? {}) as Record<string, unknown>;
    assert.equal(exceptionContext.briefing_mode, "exceptions_present");
    assert.equal(exceptionContext.lead_route, "names");
    assert.equal(exceptionContext.lead_ticker, "MSFT");
    assert.ok(Number(exceptionContext.exceptions_count ?? 0) >= 1);
    assert.equal(
      proExceptionAlerts.some((row) => row.notification_type === "market_pulse_ready"),
      false
    );

    assert.equal(
      freeAlerts.some((row) => row.notification_type === "morning_exception_briefing"),
      false
    );

    const dispatchDuplicate = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: cycleStart,
        cycle_end: cycleEnd
      }
    });
    assert.ok(
      dispatchDuplicate.status === 200 || dispatchDuplicate.status === 202
    );
    await new Promise((resolve) => setTimeout(resolve, 750));

    const noChangeAfterDuplicate = await listAlerts(baseUrl, proNoChange.accessToken);
    const exceptionAfterDuplicate = await listAlerts(baseUrl, proException.accessToken);
    assert.equal(
      noChangeAfterDuplicate.filter((row) => row.notification_type === "morning_exception_briefing")
        .length,
      1
    );
    assert.equal(
      exceptionAfterDuplicate.filter((row) => row.notification_type === "morning_exception_briefing")
        .length,
      1
    );
  } finally {
    await closeServer(server);
    await closeServer(openbbMock.server);
    await closeServer(newsMock.server);
    await closeServer(revenueCatMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SENTRY_DSN = previous.SENTRY_DSN;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.REVENUECAT_SERVER_API_KEY = previous.REVENUECAT_SERVER_API_KEY;
    process.env.REVENUECAT_ENTITLEMENT_ID = previous.REVENUECAT_ENTITLEMENT_ID;
    process.env.REVENUECAT_API_BASE_URL = previous.REVENUECAT_API_BASE_URL;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
    process.env.MARKET_PULSE_TICKERS = previous.MARKET_PULSE_TICKERS;
    process.env.MARKET_PULSE_SCHEMA_VERSION = previous.MARKET_PULSE_SCHEMA_VERSION;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});
