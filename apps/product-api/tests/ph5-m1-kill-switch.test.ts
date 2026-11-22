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

async function startEodPriceMock(
  pricesBySymbol: Record<string, number[]>
): Promise<{ server: Server; baseUrl: string }> {
  const callCount = new Map<string, number>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/v1/market/eod-prices") {
      sendJson(response, 404, { ok: false, data: null, error_flag: true });
      return;
    }
    const symbols = (url.searchParams.get("tickers") ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => symbol.length > 0);
    const prices = symbols.map((symbol) => {
      const configured = pricesBySymbol[symbol];
      if (!configured || configured.length === 0) {
        return { ticker: symbol, available: false, reason: "price_not_found" };
      }
      const currentCall = callCount.get(symbol) ?? 0;
      const index = Math.min(currentCall, configured.length - 1);
      callCount.set(symbol, currentCall + 1);
      return { ticker: symbol, available: true, close: configured[index] as number, as_of: "2026-03-20" };
    });
    sendJson(response, 200, {
      ok: true,
      data: { provider: "test", price_type: "end_of_day", prices },
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

async function createVerifiedSession(baseUrl: string): Promise<{ accessToken: string }> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "ph5-m1-kill-switch@example.com",
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
      email: "ph5-m1-kill-switch@example.com",
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
    report_id: "ph5-m1-report-aapl",
    job_id: jobId,
    schema_version: "3.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-08T12:00:00.000Z",
    confidence: {
      score: 0.76,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["Operating leverage remains intact."],
      evidence: []
    },
    kill_switch_conditions: [
      {
        condition_id: "ks_price_against_signal",
        condition_text: "Price moves 5% against the thesis anchor.",
        signal_type: "price_move_pct",
        rationale: "Catch rapid divergence versus thesis direction.",
        threshold_value: 5,
        threshold_unit: "pct",
        direction: "against_signal",
        prompt_version: "m5-kill-switch-fixture-v1"
      },
      {
        condition_id: "ks_guidance_revision",
        condition_text: "Management guidance is revised downward materially.",
        signal_type: "guidance_revision",
        rationale: "Guidance cuts can invalidate base-case assumptions.",
        direction: "any",
        prompt_version: "m5-kill-switch-fixture-v1"
      },
      {
        condition_id: "ks_sec_material_filing",
        condition_text: "A material SEC filing contradicts core thesis assumptions.",
        signal_type: "sec_filing",
        rationale: "Hard-signal filing evidence should trigger review.",
        direction: "any",
        prompt_version: "m5-kill-switch-fixture-v1"
      }
    ],
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
    data_sources: ["fixture"]
  };
}

test("PH5 M1 kill-switch rules persist, evaluate idempotently, and write alert-ledger records", async () => {
  const priceMock = await startEodPriceMock({
    AAPL: [100, 100, 90]
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
    PRICE_SERVICE_BASE_URL: process.env.PRICE_SERVICE_BASE_URL,
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
  process.env.PRICE_SERVICE_BASE_URL = priceMock.baseUrl;
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
        device_token: "device-token-ph5-m1-1234567890"
      }
    });
    assert.equal(registerToken.status, 200);

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

    const evaluate = await requestJson(baseUrl, "/internal/notifications/kill-switch/evaluate", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        as_of: "2026-04-08",
        signal_source: "event",
        trigger_key: "fixture-guidance-cut",
        fixtures: [
          {
            ticker: "AAPL",
            signal_type: "guidance_revision",
            value: 1,
            reason_text: "Guidance reduced by 12% versus prior midpoint."
          }
        ]
      }
    });
    assert.equal(evaluate.status, 200);
    assert.ok(Number(evaluate.payload.evaluated) >= 3);
    assert.ok(Number(evaluate.payload.matched) >= 1);
    assert.ok(Number(evaluate.payload.delivered) >= 1);

    const alerts = await requestJson(baseUrl, "/v1/user/alerts?limit=20", {
      headers
    });
    assert.equal(alerts.status, 200);
    const alertRows = (alerts.payload.data ?? []) as Array<JsonObject>;
    const killSwitchAlert = alertRows.find((row) => row.notification_type === "kill_switch");
    assert.ok(killSwitchAlert);
    assert.equal(killSwitchAlert?.category, "thesis_drift");
    assert.equal(killSwitchAlert?.route, "research");
    assert.equal(typeof killSwitchAlert?.reason_text, "string");

    const secondEvaluate = await requestJson(
      baseUrl,
      "/internal/notifications/kill-switch/evaluate",
      {
        method: "POST",
        headers: {
          "x-internal-token": "dev-internal-worker-token"
        },
        body: {
          as_of: "2026-04-08",
          signal_source: "event",
          trigger_key: "fixture-guidance-cut",
          fixtures: [
            {
              ticker: "AAPL",
              signal_type: "guidance_revision",
              value: 1
            }
          ]
        }
      }
    );
    assert.equal(secondEvaluate.status, 200);
    assert.equal(secondEvaluate.payload.matched, 0);
    assert.ok(Number(secondEvaluate.payload.skipped) >= 3);

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
    assert.equal(typeof contrarian.payload.fired, "number");
  } finally {
    await closeServer(server);
    await closeServer(priceMock.server);
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
    process.env.PRICE_SERVICE_BASE_URL = previous.PRICE_SERVICE_BASE_URL;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
  }
});
