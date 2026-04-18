import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

type OpenbbMockState = {
  failCompany: boolean;
  failMacro: boolean;
};

type NewsMockState = {
  outage: boolean;
};

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startOpenbbMock(state: OpenbbMockState): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/v1/official/company") {
      if (state.failCompany) {
        sendJson(response, 503, {
          ok: false,
          data: null,
          error_flag: true,
          error_message: "company outage"
        });
        return;
      }

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
            retrieved_at: "2026-03-21T08:00:00.000Z"
          },
          missing_fields: [],
          canonical_events: [
            {
              id: `filing-${ticker}-2026-03-21`,
              family: "filing_posted",
              subject_type: "ticker",
              subject_id: ticker,
              title: `${ticker} filed a new 8-K`,
              occurred_at: "2026-03-21T11:00:00.000Z",
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
                retrieved_at: "2026-03-21T11:05:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-Q1"
              },
              retrieved_at: "2026-03-21T11:05:00.000Z",
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
      if (state.failMacro) {
        sendJson(response, 503, {
          ok: false,
          data: null,
          error_flag: true,
          error_message: "macro outage"
        });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        data: {
          observations: [
            {
              registry_id: "TREASURY_DAILY_10Y",
              value: 4.21,
              unit: "percent",
              period: "2026-03-21",
              category: "rates",
              retrieval: {
                source: {
                  source_name: "U.S. Treasury",
                  source_url: "https://home.treasury.gov/"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z"
              },
              missing_fields: []
            },
            {
              registry_id: "TREASURY_DAILY_2Y",
              value: 4.08,
              unit: "percent",
              period: "2026-03-21",
              category: "rates",
              retrieval: {
                source: {
                  source_name: "U.S. Treasury",
                  source_url: "https://home.treasury.gov/"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z"
              },
              missing_fields: []
            },
            {
              registry_id: "BLS_CPI_U_ALL_ITEMS",
              value: 308.6,
              unit: "index",
              period: "2026-03",
              category: "inflation",
              retrieval: {
                source: {
                  source_name: "BLS",
                  source_url: "https://www.bls.gov/"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z"
              },
              missing_fields: []
            },
            {
              registry_id: "BLS_UNEMPLOYMENT_RATE",
              value: 3.9,
              unit: "percent",
              period: "2026-03",
              category: "labor",
              retrieval: {
                source: {
                  source_name: "BLS",
                  source_url: "https://www.bls.gov/"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z"
              },
              missing_fields: []
            }
          ],
          canonical_events: [
            {
              id: "macro-cpi-2026-03-21",
              family: "macro_release_published",
              subject_type: "macro_series",
              subject_id: "BLS_CPI_U_ALL_ITEMS",
              title: "CPI update published",
              occurred_at: "2026-03-21T07:30:00.000Z",
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
                retrieved_at: "2026-03-21T07:35:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-03"
              },
              retrieved_at: "2026-03-21T07:35:00.000Z",
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

async function startNewsMock(state: NewsMockState): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/v1/first-party/context" || request.method !== "POST") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    if (state.outage) {
      sendJson(response, 200, {
        ok: false,
        data: {
          context_items: []
        },
        error_flag: true,
        error_message: "context outage"
      });
      return;
    }

    const ticker = "AAPL";
    sendJson(response, 200, {
      ok: true,
      data: {
        context_items: [
          {
            context_id: "ctx-aapl-2026-03-21",
            ticker,
            registry_entry_id: "aapl-ir",
            source_url: "https://investor.apple.com/investor-relations/",
            source_domain: "investor.apple.com",
            page_type: "investor_relations",
            title: "Apple investor update",
            summary: "Apple published a first-party investor update.",
            excerpt: "Apple investor update confirms release cadence.",
            retrieved_at: "2026-03-21T12:05:00.000Z",
            published_at: "2026-03-21T12:00:00.000Z",
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
  internalToken: string;
}> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m6-pulse@example.com",
      password: "VeryStrongPass1!"
    }
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
    body: {
      email: "m6-pulse@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token"
  };
}

async function waitForPulseReport(
  baseUrl: string,
  token: string,
  path: string,
  timeoutMs = 10000
): Promise<MarketPulseReport> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await requestJson(baseUrl, path, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    if (response.status === 200) {
      return response.payload as unknown as MarketPulseReport;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for pulse report at ${path}`);
}

test("market pulse dispatch stores reports, personalizes watchlist overlay, and handles degradation/failure", async () => {
  const openbbState: OpenbbMockState = {
    failCompany: false,
    failMacro: false
  };
  const newsState: NewsMockState = {
    outage: false
  };

  const openbbMock = await startOpenbbMock(openbbState);
  const newsMock = await startNewsMock(newsState);

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
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = openbbMock.baseUrl;
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = newsMock.baseUrl;
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";

  const capturedErrors: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    capturedErrors.push(
      args.map((entry) => String(entry)).join(" ")
    );
    originalConsoleError(...args);
  };

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const session = await createVerifiedSession(baseUrl);

    const authHeaders = { authorization: `Bearer ${session.accessToken}` };
    const internalHeaders = { "x-internal-token": session.internalToken };

    const tokenRegistration = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: authHeaders,
      body: {
        device_token: "fcm_token_1234567890123456"
      }
    });
    assert.equal(tokenRegistration.status, 200);

    const addWatchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeaders,
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(addWatchlist.status, 200);

    const dispatchSuccess = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: "2026-03-21T00:00:00.000Z",
        cycle_end: "2026-03-21T23:59:00.000Z"
      }
    });
    assert.equal(dispatchSuccess.status, 202);

    const firstReport = await waitForPulseReport(
      baseUrl,
      session.accessToken,
      "/pulse/2026-03-21"
    );
    assert.equal(firstReport.sections.macro_stress.status, "complete");
    assert.equal(firstReport.sections.official_macro_pressure.status, "complete");
    assert.equal(firstReport.sections.canonical_events.status, "complete");
    assert.equal(firstReport.sections.bounded_context.status, "complete");
    assert.equal(firstReport.sections.news_summary?.status, "complete");
    assert.equal(firstReport.sections.market_moves?.status, "complete");
    assert.ok(firstReport.sections.watchlist_overlay);
    assert.match(firstReport.sections.watchlist_overlay?.body ?? "", /AAPL/);

    newsState.outage = true;
    const dispatchDegraded = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: "2026-03-22T00:00:00.000Z",
        cycle_end: "2026-03-22T23:59:00.000Z"
      }
    });
    assert.equal(dispatchDegraded.status, 202);

    const degradedReport = await waitForPulseReport(
      baseUrl,
      session.accessToken,
      "/pulse/2026-03-22"
    );
    assert.equal(degradedReport.sections.bounded_context.status, "data_unavailable");
    assert.equal(degradedReport.sections.news_summary?.status, "data_unavailable");
    assert.ok(degradedReport.flags.includes("data_unavailable:bounded_context"));
    const degradedSentryLog = capturedErrors.some((line) =>
      line.includes('"message":"Sentry capture"') &&
      line.includes("Market Pulse degraded with unavailable data")
    );
    assert.equal(degradedSentryLog, true);

    newsState.outage = false;
    const dispatchFail = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: "2026-03-23T00:00:00.000Z",
        cycle_end: "2026-03-23T23:59:00.000Z",
        force_fail: true
      }
    });
    assert.equal(dispatchFail.status, 202);

    await new Promise((resolve) => setTimeout(resolve, 600));

    const missingFailedDay = await requestJson(baseUrl, "/pulse/2026-03-23", {
      headers: authHeaders
    });
    assert.equal(missingFailedDay.status, 404);

    const latestAfterFailure = await requestJson(baseUrl, "/pulse/latest", {
      headers: authHeaders
    });
    assert.equal(latestAfterFailure.status, 200);
    const latestPayload = latestAfterFailure.payload as unknown as MarketPulseReport;
    assert.equal(latestPayload.cycle_end.slice(0, 10), "2026-03-22");
  } finally {
    console.error = originalConsoleError;
    if (server) {
      await closeServer(server);
    }
    await closeServer(openbbMock.server);
    await closeServer(newsMock.server);
  }

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
});
