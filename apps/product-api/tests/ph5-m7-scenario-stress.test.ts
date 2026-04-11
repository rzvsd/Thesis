import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

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
      authorization: "Bearer ph5-m7-webhook-secret"
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

function mapImpactsByTicker(rows: JsonObject[]): Map<string, JsonObject> {
  const map = new Map<string, JsonObject>();
  for (const row of rows) {
    const ticker = String(row.ticker ?? "");
    map.set(ticker, row);
  }
  return map;
}

function mapSuggestionSignatures(rows: JsonObject[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    set.add(
      `${String(row.ticker ?? "")}|${String(row.signal_type ?? "")}|${String(row.direction ?? "")}`
    );
  }
  return set;
}

test("PH5 M7 scenario stress templates, run/read flow, determinism, and Pro gating", async () => {
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
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SENTRY_DSN = "https://public@example.com/1";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_TICKERS = "AAPL,MSFT,NVDA";
  process.env.MARKET_PULSE_SCHEMA_VERSION = "1.0.0";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";
  process.env.REVENUECAT_WEBHOOK_SECRET = "ph5-m7-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const pro = await createVerifiedSession(baseUrl, "ph5-m7-pro@example.com");
    const proNoNames = await createVerifiedSession(baseUrl, "ph5-m7-pro-empty@example.com");
    const free = await createVerifiedSession(baseUrl, "ph5-m7-free@example.com");
    await promoteUserToPro(baseUrl, pro.userId);
    await promoteUserToPro(baseUrl, proNoNames.userId);

    await addWatchlistTicker(baseUrl, pro.accessToken, "AAPL");
    await addWatchlistTicker(baseUrl, pro.accessToken, "MSFT");
    await addWatchlistTicker(baseUrl, pro.accessToken, "NVDA");

    const proAuth = { authorization: `Bearer ${pro.accessToken}` };
    const proNoNamesAuth = { authorization: `Bearer ${proNoNames.accessToken}` };
    const freeAuth = { authorization: `Bearer ${free.accessToken}` };

    const templates = await requestJson(baseUrl, "/v1/scenarios/templates", {
      headers: proAuth
    });
    assert.equal(templates.status, 200);
    const templateRows = (templates.payload.data ?? []) as JsonObject[];
    const templateIds = templateRows.map((row) => String(row.scenario_id));
    assert.deepEqual(templateIds, [
      "rates_higher_for_longer",
      "recession_in_6m",
      "usd_up_10",
      "ai_hype_burst",
      "oil_120_spike"
    ]);

    const runOne = await requestJson(baseUrl, "/v1/scenarios/runs", {
      method: "POST",
      headers: proAuth,
      body: {
        scenario_id: "rates_higher_for_longer",
        as_of: "2026-07-14"
      }
    });
    assert.equal(runOne.status, 200);
    const runOneData = runOne.payload.data as JsonObject;
    const runOneHeader = runOneData.run as JsonObject;
    assert.equal(runOneHeader.scenario_id, "rates_higher_for_longer");
    assert.equal(runOneHeader.run_mode, "manual");
    const route = runOneHeader.route as JsonObject;
    assert.equal(route.open_tab, "research");
    assert.equal(route.scenario_id, "rates_higher_for_longer");
    const runId = String(runOneHeader.scenario_run_id ?? "");
    assert.ok(runId.length > 0);

    const runOneRead = await requestJson(baseUrl, `/v1/scenarios/runs/${runId}`, {
      headers: proAuth
    });
    assert.equal(runOneRead.status, 200);
    const runOneReadHeader = ((runOneRead.payload.data as JsonObject).run ?? {}) as JsonObject;
    assert.equal(runOneReadHeader.scenario_run_id, runId);

    const runTwo = await requestJson(baseUrl, "/v1/scenarios/runs", {
      method: "POST",
      headers: proAuth,
      body: {
        scenario_id: "rates_higher_for_longer",
        as_of: "2026-07-14"
      }
    });
    assert.equal(runTwo.status, 200);

    const runOneImpacts = (((runOne.payload.data as JsonObject).impacts ?? []) as JsonObject[]).sort(
      (left, right) => String(left.ticker).localeCompare(String(right.ticker))
    );
    const runTwoImpacts = (((runTwo.payload.data as JsonObject).impacts ?? []) as JsonObject[]).sort(
      (left, right) => String(left.ticker).localeCompare(String(right.ticker))
    );
    const runOneImpactMap = mapImpactsByTicker(runOneImpacts);
    const runTwoImpactMap = mapImpactsByTicker(runTwoImpacts);
    assert.deepEqual([...runOneImpactMap.keys()].sort(), [...runTwoImpactMap.keys()].sort());
    for (const ticker of runOneImpactMap.keys()) {
      const first = runOneImpactMap.get(ticker) as JsonObject;
      const second = runTwoImpactMap.get(ticker) as JsonObject;
      assert.equal(first.impact_level, second.impact_level);
      assert.equal(first.thesis_break_likelihood, second.thesis_break_likelihood);
      const firstScore = Number(first.stress_score);
      const secondScore = Number(second.stress_score);
      assert.ok(Math.abs(firstScore - secondScore) <= 0.02);
    }

    const runOneSuggestions = mapSuggestionSignatures(
      ((runOne.payload.data as JsonObject).rule_suggestions ?? []) as JsonObject[]
    );
    const runTwoSuggestions = mapSuggestionSignatures(
      ((runTwo.payload.data as JsonObject).rule_suggestions ?? []) as JsonObject[]
    );
    assert.deepEqual([...runOneSuggestions].sort(), [...runTwoSuggestions].sort());

    const freeRunBlocked = await requestJson(baseUrl, "/v1/scenarios/runs", {
      method: "POST",
      headers: freeAuth,
      body: {
        scenario_id: "rates_higher_for_longer",
        as_of: "2026-07-14"
      }
    });
    assert.equal(freeRunBlocked.status, 403);
    assert.equal(freeRunBlocked.payload.error, "upgrade_required");
    assert.equal(freeRunBlocked.payload.feature, "scenario_stress");

    const freeReadBlocked = await requestJson(baseUrl, `/v1/scenarios/runs/${runId}`, {
      headers: freeAuth
    });
    assert.equal(freeReadBlocked.status, 403);

    const noNamesRun = await requestJson(baseUrl, "/v1/scenarios/runs", {
      method: "POST",
      headers: proNoNamesAuth,
      body: {
        scenario_id: "oil_120_spike",
        as_of: "2026-07-14"
      }
    });
    assert.equal(noNamesRun.status, 200);
    const noNamesData = noNamesRun.payload.data as JsonObject;
    const noNamesRunHeader = noNamesData.run as JsonObject;
    assert.equal(noNamesRunHeader.total_names, 0);
    assert.equal(noNamesRunHeader.impacted_names, 0);
    assert.equal(((noNamesData.impacts ?? []) as JsonObject[]).length, 0);
    assert.match(String(noNamesRunHeader.summary ?? ""), /No critical scenario stress detected/i);
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
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
  }
});
