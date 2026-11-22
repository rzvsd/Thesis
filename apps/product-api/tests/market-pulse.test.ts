import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { supportsMarketPulsePdfExport } from "../src/market-pulse-render";
import { buildMacroNewsPack } from "../src/pulse/macro-news";
import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

type OpenbbMockState = {
  failCompany: boolean;
  failMacro: boolean;
  failTape?: boolean;
  failCalendar?: boolean;
};

type NewsMockState = {
  outage: boolean;
  articles?: Array<Record<string, unknown>>;
};

type YahooMockState = {
  closesByTicker: Record<string, Array<number | null>>;
};

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startOpenbbMock(state: OpenbbMockState): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/internal/calendar/earnings") {
      if (state.failCalendar) {
        sendJson(response, 503, {
          ok: false,
          data: null,
          error_flag: true,
          error_message: "calendar outage"
        });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        data: {
          events: [
            {
              ticker: "AAPL",
              event_type: "earnings",
              event_date: "2026-03-24",
              event_time: "after_market",
              provider: "earnings_calendar",
              retrieved_at: "2026-03-21T08:00:00.000Z",
              reason_text: "Fixture earnings calendar item for watch-next coverage."
            }
          ]
        },
        error_flag: false
      });
      return;
    }

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

    if (url.pathname === "/v1/market/tape") {
      if (state.failTape) {
        sendJson(response, 503, {
          ok: false,
          data: null,
          error_flag: true,
          error_message: "tape outage"
        });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        data: {
          as_of: "2026-03-21",
          coverage_state: "partial",
          summary: "US risk assets were broadly higher on the day.",
          indices: [
            {
              instrument_id: "SP500",
              label: "S&P 500",
              family: "core_index",
              period: "2026-03-21",
              value: 5287.76,
              previous_value: 5158.2,
              daily_change: 129.56,
              daily_change_pct: 2.5118,
              unit: "index",
              direction: "up",
              retrieval: {
                source: {
                  source_id: "FRED_SP500",
                  source_family: "fred",
                  source_name: "FRED S&P 500",
                  source_url: "https://fred.stlouisfed.org/series/SP500",
                  agency: "Federal Reserve Bank of St. Louis",
                  agency_series_id: "SP500"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-03-21"
              },
              missing_fields: []
            },
            {
              instrument_id: "DJIA",
              label: "Dow Jones Industrial Average",
              family: "core_index",
              period: "2026-03-21",
              value: 39606.57,
              previous_value: 39110.31,
              daily_change: 496.26,
              daily_change_pct: 1.269,
              unit: "index",
              direction: "up",
              retrieval: {
                source: {
                  source_id: "FRED_DJIA",
                  source_family: "fred",
                  source_name: "FRED DJIA",
                  source_url: "https://fred.stlouisfed.org/series/DJIA",
                  agency: "Federal Reserve Bank of St. Louis",
                  agency_series_id: "DJIA"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-03-21"
              },
              missing_fields: []
            },
            {
              instrument_id: "NASDAQCOM",
              label: "Nasdaq Composite",
              family: "core_index",
              period: "2026-03-21",
              value: 16708.05,
              previous_value: 16401.84,
              daily_change: 306.21,
              daily_change_pct: 1.867,
              unit: "index",
              direction: "up",
              retrieval: {
                source: {
                  source_id: "FRED_NASDAQCOM",
                  source_family: "fred",
                  source_name: "FRED Nasdaq Composite",
                  source_url: "https://fred.stlouisfed.org/series/NASDAQCOM",
                  agency: "Federal Reserve Bank of St. Louis",
                  agency_series_id: "NASDAQCOM"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-03-21"
              },
              missing_fields: []
            }
          ],
          cross_asset: [
            {
              instrument_id: "VIXCLS",
              label: "VIX",
              family: "volatility",
              period: "2026-03-21",
              value: 17.43,
              previous_value: 18.21,
              daily_change: -0.78,
              daily_change_pct: -4.2834,
              unit: "index",
              direction: "down",
              retrieval: {
                source: {
                  source_id: "FRED_VIXCLS",
                  source_family: "fred",
                  source_name: "FRED VIX",
                  source_url: "https://fred.stlouisfed.org/series/VIXCLS",
                  agency: "Federal Reserve Bank of St. Louis",
                  agency_series_id: "VIXCLS"
                },
                retrieved_at: "2026-03-21T08:00:00.000Z",
                retrieval_status: "fresh",
                source_period: "2026-03-21"
              },
              missing_fields: []
            }
          ],
          retrievals: [
            {
              source: {
                source_id: "FRED_SP500",
                source_family: "fred",
                source_name: "FRED S&P 500",
                source_url: "https://fred.stlouisfed.org/series/SP500",
                agency: "Federal Reserve Bank of St. Louis",
                agency_series_id: "SP500"
              },
              retrieved_at: "2026-03-21T08:00:00.000Z",
              retrieval_status: "fresh",
              source_period: "2026-03-21"
            }
          ],
          omissions: [
            {
              omission_id: "sector-basket-free-path-unavailable",
              family: "sector",
              reason_code: "source_unavailable",
              reason_text: "Sector ETF leadership is not available in the approved free live path for this run.",
              blocking: false
            }
          ]
        },
        error_flag: false
      });
      return;
    }

    if (url.pathname === "/v1/official/structural") {
      sendJson(response, 200, {
        ok: true,
        data: {
          subject_type: "market_pulse",
          subject_id: "US",
          as_of: "2026-03-21",
          coverage_state: "partial",
          summary: "United States structural context remains broadly supportive while policy sensitivity stays in view.",
          observations: [],
          omissions: [],
          retrievals: []
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
    if (url.pathname === "/v1/news" && request.method === "GET") {
      sendJson(response, 200, state.outage
        ? { ok: false, data: [], error_flag: true, error_message: "news outage" }
        : { ok: true, data: state.articles ?? [], error_flag: false });
      return;
    }
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

async function startYahooMock(state: YahooMockState): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const match = /^\/v8\/finance\/chart\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    const ticker = decodeURIComponent(match[1] ?? "").toUpperCase();
    const closes = state.closesByTicker[ticker];
    if (!closes) {
      sendJson(response, 404, {
        chart: {
          result: null,
          error: {
            code: "Not Found"
          }
        }
      });
      return;
    }

    sendJson(response, 200, {
      chart: {
        result: [
          {
            indicators: {
              quote: [
                {
                  close: closes
                }
              ]
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

async function startDexterPulseMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/internal/pulse/brief") {
      sendJson(response, 404, { status: "not_found" });
      return;
    }
    let body = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body || "{}") as {
        report?: MarketPulseReport;
        user_research_state?: MarketPulseReport["user_research_state"];
      };
      const report = parsed.report;
      if (!report) {
        sendJson(response, 422, { error: "validation_failed" });
        return;
      }
      if (!parsed.user_research_state) {
        sendJson(response, 200, {
          analyst: "dexter",
          report
        });
        return;
      }
      const row = {
        ticker: "AAPL",
        company_name: "Apple Inc.",
        previous_close: 171.5,
        latest_price: 174.2,
        change: 2.7,
        change_pct: 1.5743,
        direction: "up" as const,
        reason: "Moved with the broader tape. No company-specific evidence confirmed in approved sources.",
        evidence: [
          {
            evidence_id: "dexter-price-aapl",
            source_type: "financial_data" as const,
            source_name: "Dexter price tracker",
            excerpt: "AAPL: latest close 174.20 versus prior close 171.50.",
            retrieved_at: "2026-03-21T08:15:00.000Z"
          }
        ]
      };
      sendJson(response, 200, {
        analyst: "dexter",
        report: {
          ...report,
          user_research_state: parsed.user_research_state,
          morning_edition: report.morning_edition
            ? {
                ...report.morning_edition,
                portfolio_radar: [row]
              }
            : report.morning_edition,
          sections: {
            ...report.sections,
            portfolio_radar: {
              section_id: "portfolio_radar",
              title: "Your Names",
              body: "AAPL: +1.57%. Moved with the broader tape.",
              status: "complete",
              evidence: row.evidence
            }
          },
          brief_editorial: {
            the_read:
              "Risk appetite improved, but conviction did not reset. Dexter kept the tape read compact and evidence-led while separating market movement from company-specific proof.",
            what_changed_summary:
              "The tape improved, AAPL had an approved price row, and no confirmed company-specific catalyst changed the tracked-name story.",
            why_it_matters:
              "The useful read is portfolio context against the tape, not a trading signal. A better market session can improve context without changing a company thesis.",
            your_names_comment: "AAPL followed the tape rather than a company-specific catalyst.",
            smart_comment:
              "Dexter treated the move as a cleaner market session, not a stronger thesis. Conviction still needs repeated confirmation or company-specific evidence."
          },
          editorial_generation: {
            mode: "deterministic",
            status: "generated",
            source_report_id: report.report_id,
            coverage_notes: ["Dexter mock generated the personalized Pulse brief."]
          }
        }
      });
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
): Promise<{ status: number; payload: JsonObject; headers: Headers }> {
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
    payload,
    headers: response.headers
  };
}

async function requestBinary(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; bytes: Buffer; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.headers
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    bytes: Buffer.from(arrayBuffer),
    headers: response.headers
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

test("market pulse dispatch stores reports, personalizes through research state, and handles degradation/failure", async () => {
  const openbbState: OpenbbMockState = {
    failCompany: false,
    failMacro: false
  };
  const newsState: NewsMockState = {
    outage: false
  };
  const yahooState: YahooMockState = {
    closesByTicker: {
      AAPL: [171.5, null, 174.2]
    }
  };

  const openbbMock = await startOpenbbMock(openbbState);
  const newsMock = await startNewsMock(newsState);
  const yahooMock = await startYahooMock(yahooState);
  const dexterMock = await startDexterPulseMock();

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
    PULSE_DEXTER_BRIEF_ENABLED: process.env.PULSE_DEXTER_BRIEF_ENABLED,
    PULSE_DEXTER_WORKER_BASE_URL: process.env.PULSE_DEXTER_WORKER_BASE_URL,
    PULSE_DEXTER_TIMEOUT_MS: process.env.PULSE_DEXTER_TIMEOUT_MS,
    SENTIMENT_YAHOO_BASE_URL: process.env.SENTIMENT_YAHOO_BASE_URL,
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
  process.env.PULSE_DEXTER_BRIEF_ENABLED = "true";
  process.env.PULSE_DEXTER_WORKER_BASE_URL = dexterMock.baseUrl;
  process.env.PULSE_DEXTER_TIMEOUT_MS = "1000";
  process.env.SENTIMENT_YAHOO_BASE_URL = yahooMock.baseUrl;
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

    const addHolding = await requestJson(baseUrl, "/v1/user/holdings", {
      method: "POST",
      headers: authHeaders,
      body: {
        ticker: "AAPL",
        quantity: 2,
        cost_basis: 170,
        label: "Core manual holding"
      }
    });
    assert.equal(addHolding.status, 200);
    assert.equal((addHolding.payload.data as Record<string, unknown>).ticker, "AAPL");

    const dispatchSuccess = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: "2026-03-21T00:00:00.000Z",
        cycle_end: "2026-03-21T23:59:00.000Z"
      }
    });
    assert.equal(dispatchSuccess.status, 202);

    const firstBaseReport = await waitForPulseReport(
      baseUrl,
      session.accessToken,
      "/pulse/2026-03-21"
    );
    const firstBase = await requestJson(baseUrl, "/pulse/2026-03-21", {
      headers: authHeaders
    });
    assert.equal(firstBase.headers.get("cache-control"), "private, no-store");
    assert.equal(firstBase.headers.get("vary"), "Authorization");
    assert.equal(firstBaseReport.sections.watchlist_overlay, undefined);
    assert.equal(firstBaseReport.user_research_state, undefined);

    const refreshResearchState = await requestJson(baseUrl, "/internal/research-state/refresh", {
      method: "POST",
      headers: internalHeaders,
      body: {
        as_of: "2026-03-21"
      }
    });
    assert.equal(refreshResearchState.status, 200);
    assert.equal(refreshResearchState.payload.users, 1);
    assert.equal(refreshResearchState.payload.names, 1);

    const firstReport = await waitForPulseReport(
      baseUrl,
      session.accessToken,
      "/pulse/2026-03-21"
    );
    const firstRetrieved = await requestJson(baseUrl, "/pulse/2026-03-21", {
      headers: authHeaders
    });
    assert.equal(firstRetrieved.headers.get("cache-control"), "private, no-store");
    assert.equal(firstRetrieved.headers.get("vary"), "Authorization");
    assert.equal(firstReport.sections.macro_stress.status, "complete");
    assert.equal(firstReport.sections.market_tape.status, "data_incomplete");
    assert.equal(firstReport.sections.official_macro_pressure.status, "complete");
    assert.equal(firstReport.sections.canonical_events.status, "complete");
    assert.equal(firstReport.sections.bounded_context.status, "complete");
    assert.equal(firstReport.sections.news_summary?.status, "complete");
    assert.equal(firstReport.sections.market_moves?.status, "complete");
    assert.ok(firstReport.flags.includes("data_incomplete:market_tape"));
    assert.equal(firstReport.sections.watchlist_overlay, undefined);
    assert.ok(firstReport.user_research_state);
    assert.match(firstReport.sections.portfolio_radar?.body ?? "", /AAPL/);
    assert.match(firstReport.sections.portfolio_radar?.body ?? "", /\+1\.57%/);
    const aaplRadarRow = firstReport.morning_edition?.portfolio_radar.find(
      (row) => row.ticker === "AAPL"
    );
    assert.equal(aaplRadarRow?.previous_close, 171.5);
    assert.equal(aaplRadarRow?.latest_price, 174.2);
    assert.equal(Math.round((aaplRadarRow?.change_pct ?? 0) * 100) / 100, 1.57);
    assert.equal(aaplRadarRow?.evidence[0]?.source_name, "Dexter price tracker");
    assert.equal(firstReport.editorial_generation?.coverage_notes[0], "Dexter mock generated the personalized Pulse brief.");
    assert.equal(firstReport.user_research_state?.holdings[0]?.ticker, "AAPL");
    assert.equal(firstReport.editorial_issue?.freshness_state, "baseline");
    assert.match(firstReport.editorial_issue?.lead ?? "", /editorial baseline/);
    assert.ok(firstReport.sections.what_changed);
    assert.ok(firstReport.sections.why_it_matters);
    assert.ok(firstReport.sections.what_to_watch);
    assert.ok(firstReport.sections.signal_vs_noise);
    assert.match(firstReport.sections.what_to_watch?.body ?? "", /AAPL/);
    assert.ok(firstReport.morning_edition);
    assert.equal(firstReport.macro_news?.state, "calm");
    assert.equal(firstReport.sections.macro_news, undefined);
    assert.ok((firstReport.morning_edition?.market_board.length ?? 0) > 0);
    assert.ok((firstReport.morning_edition?.today_catalysts.length ?? 0) > 0);
    assert.ok(firstReport.sections.market_board);
    assert.ok(firstReport.sections.today_catalysts);
    assert.ok(firstReport.sections.portfolio_radar);
    assert.equal(firstReport.sections.headline_digest, undefined);
    if (supportsMarketPulsePdfExport()) {
      const pdfExport = await requestBinary(baseUrl, "/pulse/2026-03-21/export/pdf", {
        headers: authHeaders
      });
      assert.equal(pdfExport.status, 200);
      assert.equal(pdfExport.headers.get("content-type"), "application/pdf");
      assert.match(
        pdfExport.headers.get("content-disposition") ?? "",
        /attachment; filename="thesis-pulse-2026-03-21-/
      );
      assert.equal(pdfExport.bytes.subarray(0, 4).toString("ascii"), "%PDF");
      assert.ok(pdfExport.bytes.length > 2_000);

      const latestPdfExport = await requestBinary(baseUrl, "/pulse/latest/export/pdf", {
        headers: authHeaders
      });
      assert.equal(latestPdfExport.status, 200);
      assert.equal(latestPdfExport.bytes.subarray(0, 4).toString("ascii"), "%PDF");
    }

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
    assert.equal(degradedReport.editorial_issue?.freshness_state, "updated");
    assert.equal(degradedReport.editorial_issue?.prior_cycle_end?.slice(0, 10), "2026-03-21");
    assert.match(degradedReport.sections.what_changed?.body ?? "", /AAPL|Tape comparison/);
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
    assert.equal(latestAfterFailure.headers.get("cache-control"), "private, no-store");
    assert.equal(latestAfterFailure.headers.get("vary"), "Authorization");
    const latestPayload = latestAfterFailure.payload as unknown as MarketPulseReport;
    assert.equal(latestPayload.cycle_end.slice(0, 10), "2026-03-22");

    // M4: approved headlines from news-ingest reach the normal dispatch path and can promote a shock.
    newsState.articles = [
      {
        article_id: "reuters-1",
        source: "Reuters",
        url: "https://example.com/reuters/missile-attack",
        title: "Missile attack near Taiwan Strait rattles markets",
        published_at: "2026-03-24T06:00:00.000Z",
        retrieved_at: "2026-03-24T06:05:00.000Z",
        body_text: "Full article body that must not reach the report.",
        tickers_mentioned: [],
        is_approved_source: true
      },
      {
        article_id: "unapproved-1",
        source: "Random Blog",
        url: "https://example.com/blog/war",
        title: "War rumours spread online",
        published_at: "2026-03-24T05:00:00.000Z",
        retrieved_at: "2026-03-24T06:05:00.000Z",
        body_text: "",
        tickers_mentioned: [],
        is_approved_source: false
      }
    ];
    const dispatchShock = await requestJson(baseUrl, "/internal/pulse/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        cycle_start: "2026-03-24T00:00:00.000Z",
        cycle_end: "2026-03-24T23:59:00.000Z"
      }
    });
    assert.equal(dispatchShock.status, 202);
    const shockReport = await waitForPulseReport(baseUrl, session.accessToken, "/pulse/2026-03-24");
    assert.equal(shockReport.macro_news?.state, "shock");
    assert.deepEqual(
      shockReport.macro_news?.items.map((item) => item.source_name),
      ["Reuters"]
    );
    assert.equal(shockReport.macro_news?.items[0]?.confirmation_state, "reported");
    assert.doesNotMatch(JSON.stringify(shockReport), /must not reach the report/);
  } finally {
    console.error = originalConsoleError;
    if (server) {
      await closeServer(server);
    }
    await closeServer(openbbMock.server);
    await closeServer(newsMock.server);
    await closeServer(yahooMock.server);
    await closeServer(dexterMock.server);
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
  process.env.PULSE_DEXTER_BRIEF_ENABLED = previous.PULSE_DEXTER_BRIEF_ENABLED;
  process.env.PULSE_DEXTER_WORKER_BASE_URL = previous.PULSE_DEXTER_WORKER_BASE_URL;
  process.env.PULSE_DEXTER_TIMEOUT_MS = previous.PULSE_DEXTER_TIMEOUT_MS;
  process.env.SENTIMENT_YAHOO_BASE_URL = previous.SENTIMENT_YAHOO_BASE_URL;
  process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
});

test("macro news does not promote ordinary sector headlines", () => {
  const pack = buildMacroNewsPack({
    asOf: "2026-03-24",
    generatedAt: "2026-03-24T07:00:00.000Z",
    headlineItems: [
      {
        headline: "Technology shares gain after strong chip demand",
        source_name: "Reuters",
        topic: "sector",
        evidence: []
      }
    ],
    macroNewsItems: undefined,
    macroNewsFetchState: "complete",
    macroNewsUnavailableReason: undefined
  });

  assert.equal(pack.items.length, 0);
  assert.equal(pack.state, "calm");
});
