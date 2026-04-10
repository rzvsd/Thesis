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
      authorization: "Bearer m5-webhook-secret"
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

async function completeDeepDiveWithRelationships(
  baseUrl: string,
  accessToken: string,
  reportId: string,
  relationships: Array<Record<string, unknown>>
): Promise<void> {
  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
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
      report: {
        report_id: reportId,
        job_id: jobId as string,
        schema_version: "3.0",
        type: "deep_dive",
        ticker: "AAPL",
        generated_at: "2026-04-09T12:00:00.000Z",
        confidence: {
          score: 0.77,
          label: "medium",
          limiting_factors: []
        },
        signal: {
          value: "positive",
          reasons: ["Fixture thesis remains intact."],
          evidence: []
        },
        name_relationships: relationships,
        sections: [
          {
            section_id: "thesis_statement",
            title: "Thesis Statement",
            body: "AAPL remains a monitored thesis in this fixture.",
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
}

async function evaluateCrossName(
  baseUrl: string,
  body: JsonObject
): Promise<{ status: number; payload: JsonObject }> {
  return requestJson(baseUrl, "/internal/notifications/cross-name/evaluate", {
    method: "POST",
    headers: {
      "x-internal-token": "dev-internal-worker-token"
    },
    body
  });
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

test("PH5 M5 cross-name relationships persist and propagate only to qualifying Pro users", async () => {
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
  process.env.REVENUECAT_WEBHOOK_SECRET = "m5-webhook-secret";

  const server = startServer(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const pro = await createVerifiedSession(baseUrl, "ph5-m5-pro@example.com");
    const free = await createVerifiedSession(baseUrl, "ph5-m5-free@example.com");
    await promoteUserToPro(baseUrl, pro.userId);
    await registerDeviceToken(baseUrl, pro.accessToken, "ph5-m5-pro-installation");
    await registerDeviceToken(baseUrl, free.accessToken, "ph5-m5-free-installation");
    await addWatchlistTicker(baseUrl, pro.accessToken, "AAPL");
    await addWatchlistTicker(baseUrl, free.accessToken, "AAPL");

    await completeDeepDiveWithRelationships(baseUrl, pro.accessToken, "ph5-m5-pro-report", [
      {
        source_ticker: "NVDA",
        target_ticker: "AAPL",
        relationship_type: "supplier",
        confidence: 0.86,
        evidence_text: "NVDA supplier exposure appears in the thesis evidence.",
        rationale: "Supplier weakness can affect AAPL's hardware thesis.",
        prompt_version: "ph5-m5-fixture-v1"
      },
      {
        source_ticker: "MSFT",
        target_ticker: "AAPL",
        relationship_type: "competitor",
        confidence: 0.74,
        evidence_text: "MSFT competes for AI platform attention.",
        rationale: "Competitive AI platform moves can change AAPL thesis pressure.",
        prompt_version: "ph5-m5-fixture-v1"
      },
      {
        source_ticker: "TSLA",
        target_ticker: "AAPL",
        relationship_type: "partner",
        confidence: 0.65,
        evidence_text: "TSLA partner edge is intentionally low confidence.",
        rationale: "Low confidence edge should remain queryable but quiet.",
        prompt_version: "ph5-m5-fixture-v1"
      },
      {
        source_ticker: "QQQ",
        target_ticker: "AAPL",
        relationship_type: "sector",
        confidence: 0.91,
        evidence_text: "AAPL thesis is exposed to mega-cap technology sector conditions.",
        rationale: "Macro technology stress can affect AAPL's multiple and demand assumptions.",
        prompt_version: "ph5-m5-fixture-v1"
      }
    ]);

    await completeDeepDiveWithRelationships(baseUrl, free.accessToken, "ph5-m5-free-report", [
      {
        source_ticker: "NVDA",
        target_ticker: "AAPL",
        relationship_type: "supplier",
        confidence: 0.86,
        evidence_text: "Free user has the same relationship but no Pro propagation.",
        rationale: "Entitlement gating should block propagated alerts.",
        prompt_version: "ph5-m5-fixture-v1"
      }
    ]);

    const relationships = await requestJson(
      baseUrl,
      "/v1/names/relationships?state=active&limit=20",
      {
        headers: {
          authorization: `Bearer ${pro.accessToken}`
        }
      }
    );
    assert.equal(relationships.status, 200);
    const relationshipRows = (relationships.payload.data ?? []) as Array<JsonObject>;
    assert.equal(relationshipRows.length, 4);
    assert.ok(relationshipRows.some((row) => row.relationship_type === "supplier"));
    assert.ok(relationshipRows.every((row) => typeof row.evidence_text === "string"));

    const defaultThreshold = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "nvda-supplier-guidance-cut",
      fixtures: [
        {
          source_ticker: "NVDA",
          signal_type: "guidance_revision",
          reason_text: "NVDA supplier guidance weakened overnight."
        }
      ]
    });
    assert.equal(defaultThreshold.status, 200);
    assert.equal(defaultThreshold.payload.evaluated, 2);
    assert.equal(defaultThreshold.payload.matched, 1);
    assert.equal(defaultThreshold.payload.suppressed, 1);

    const proAlerts = await listAlerts(baseUrl, pro.accessToken);
    const supplierAlert = proAlerts.find((row) => row.notification_type === "cross_name_propagation");
    assert.ok(supplierAlert);
    assert.equal(supplierAlert?.route, "names");
    assert.equal(supplierAlert?.category, "thesis_drift");
    assert.match(String(supplierAlert?.reason_text), /NVDA/i);
    const supplierContext = supplierAlert?.context as JsonObject;
    assert.equal(supplierContext.source_ticker, "NVDA");
    assert.equal(supplierContext.affected_ticker, "AAPL");
    assert.equal(supplierContext.relationship_type, "supplier");

    const freeAlerts = await listAlerts(baseUrl, free.accessToken);
    assert.equal(
      freeAlerts.filter((row) => row.notification_type === "cross_name_propagation").length,
      0
    );

    const strictCompetitorThreshold = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "msft-strict-threshold",
      confidence_threshold: 0.8,
      fixtures: [
        {
          source_ticker: "MSFT",
          signal_type: "news_sentiment",
          reason_text: "MSFT platform sentiment changed."
        }
      ]
    });
    assert.equal(strictCompetitorThreshold.status, 200);
    assert.equal(strictCompetitorThreshold.payload.evaluated, 0);
    assert.equal(strictCompetitorThreshold.payload.matched, 0);

    const competitorDefaultThreshold = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "msft-default-threshold",
      fixtures: [
        {
          source_ticker: "MSFT",
          signal_type: "news_sentiment",
          reason_text: "MSFT competitive signal may affect AAPL."
        }
      ]
    });
    assert.equal(competitorDefaultThreshold.status, 200);
    assert.equal(competitorDefaultThreshold.payload.evaluated, 1);
    assert.equal(competitorDefaultThreshold.payload.matched, 1);

    const lowConfidencePartner = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "tsla-low-confidence",
      fixtures: [
        {
          source_ticker: "TSLA",
          signal_type: "news_sentiment",
          reason_text: "TSLA signal should remain below the default M5 threshold."
        }
      ]
    });
    assert.equal(lowConfidencePartner.status, 200);
    assert.equal(lowConfidencePartner.payload.evaluated, 0);
    assert.equal(lowConfidencePartner.payload.matched, 0);

    const macroOnNonSector = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "nvda-macro-non-sector",
      fixtures: [
        {
          source_ticker: "NVDA",
          signal_type: "macro_regime",
          event_category: "macro",
          reason_text: "Macro events must not travel through supplier edges."
        }
      ]
    });
    assert.equal(macroOnNonSector.status, 200);
    assert.equal(macroOnNonSector.payload.evaluated, 0);
    assert.equal(macroOnNonSector.payload.matched, 0);

    const macroSector = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "qqq-macro-sector",
      fixtures: [
        {
          source_ticker: "QQQ",
          signal_type: "macro_regime",
          event_category: "macro",
          reason_text: "Technology sector stress can affect AAPL assumptions."
        }
      ]
    });
    assert.equal(macroSector.status, 200);
    assert.equal(macroSector.payload.evaluated, 1);
    assert.equal(macroSector.payload.matched, 1);

    const updatedAlerts = await listAlerts(baseUrl, pro.accessToken);
    const macroAlert = updatedAlerts.find((row) => {
      const context = row.context as JsonObject | undefined;
      return (
        row.notification_type === "cross_name_propagation" &&
        row.category === "macro" &&
        context?.source_ticker === "QQQ"
      );
    });
    assert.ok(macroAlert);
    assert.equal((macroAlert?.context as JsonObject).relationship_type, "sector");

    const unrelated = await evaluateCrossName(baseUrl, {
      as_of: "2026-04-09",
      signal_source: "event",
      trigger_key: "amzn-unrelated",
      fixtures: [
        {
          source_ticker: "AMZN",
          signal_type: "news_sentiment",
          reason_text: "AMZN should not propagate without a stored edge."
        }
      ]
    });
    assert.equal(unrelated.status, 200);
    assert.equal(unrelated.payload.evaluated, 0);
    assert.equal(unrelated.payload.matched, 0);
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
