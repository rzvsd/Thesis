import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

async function closeServer(server: ReturnType<typeof startServer>): Promise<void> {
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
    method: string;
    body?: JsonObject;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; payload: JsonObject }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
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

async function createVerifiedSession(baseUrl: string, email: string): Promise<{
  accessToken: string;
  internalToken: string;
  userId: string;
}> {
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
    body: {
      token: verificationToken as string
    }
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

  const payload = JSON.parse(
    Buffer.from((accessToken as string).split(".")[1] ?? "", "base64url").toString("utf8")
  ) as JsonObject;
  const userId = payload.sub;
  assert.equal(typeof userId, "string");

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token",
    userId: userId as string
  };
}

function sampleLegacyDeepDiveReport(
  jobId: string,
  reportId: string,
  ticker: string
): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "1.0.0",
    type: "deep_dive",
    ticker,
    generated_at: "2026-04-18T08:00:00.000Z",
    confidence: {
      score: 0.64,
      label: "medium",
      limiting_factors: ["legacy_fixture"]
    },
    signal: {
      value: "neutral",
      reasons: ["Legacy report kept for compatibility validation."],
      evidence: []
    },
    valuation: {
      fair_value_mid: 305.0,
      fair_value_low: 274.5,
      fair_value_high: 335.5,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.098,
        beta: 1.11
      }
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Legacy report artifact remains readable after the Phase 6 M5 cutover.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["historical:sec_edgar"]
  };
}

test("PH6 M5 scenario cutover keeps legacy report readable and returns explicit omissions", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_SERVER_API_KEY: process.env.REVENUECAT_SERVER_API_KEY,
    REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.REVENUECAT_WEBHOOK_SECRET = "ph6-m5-webhook-secret";
  process.env.REVENUECAT_SERVER_API_KEY = "ph6-m5-server-api-key";
  process.env.REVENUECAT_ENTITLEMENT_ID = "pro";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const owner = await createVerifiedSession(baseUrl, "ph6-m5-owner@example.com");
    const authHeader = { authorization: `Bearer ${owner.accessToken}` };

    const upgrade = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer ph6-m5-webhook-secret"
      },
      body: {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: owner.userId,
          expiration_at: "2099-12-31T00:00:00.000Z"
        }
      }
    });
    assert.equal(upgrade.status, 200);

    const reportIdsByTicker = new Map<string, string>();
    const smokeTickers = ["AAPL", "MSFT", "TSLA"] as const;
    for (const [index, ticker] of smokeTickers.entries()) {
      const createJob = await requestJson(baseUrl, "/jobs", {
        method: "POST",
        headers: authHeader,
        body: { ticker }
      });
      assert.equal(createJob.status, 202);
      const jobId = createJob.payload.job_id;
      assert.equal(typeof jobId, "string");

      const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
        method: "POST",
        headers: {
          "x-internal-token": owner.internalToken
        }
      });
      assert.equal(claim.status, 200);

      const reportId = `ph6-m5-report-legacy-${index + 1}`;
      const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
        method: "POST",
        headers: {
          "x-internal-token": owner.internalToken
        },
        body: {
          report: sampleLegacyDeepDiveReport(jobId as string, reportId, ticker)
        }
      });
      assert.equal(complete.status, 200);
      reportIdsByTicker.set(ticker, reportId);
    }

    for (const ticker of smokeTickers) {
      const reportId = reportIdsByTicker.get(ticker);
      assert.equal(typeof reportId, "string");
      const readLegacy = await requestJson(baseUrl, `/reports/${reportId as string}`, {
        method: "GET",
        headers: authHeader
      });
      assert.equal(readLegacy.status, 200);
      assert.equal(readLegacy.payload.schema_version, "1.0.0");
      assert.equal(readLegacy.payload.ticker, ticker);
    }

    const scenarioReportId = reportIdsByTicker.get("MSFT");
    assert.equal(typeof scenarioReportId, "string");
    const scenario = await requestJson(baseUrl, `/v1/reports/${scenarioReportId as string}/scenario`, {
      method: "POST",
      headers: authHeader,
      body: {
        overrides: {
          projection_years: 7,
          terminal_growth_rate: 0.03,
          wacc: 0.11
        }
      }
    });
    assert.equal(scenario.status, 200);
    assert.equal(scenario.payload.report_id, scenarioReportId);
    assert.equal(scenario.payload.deterministic_model, "phase6_deterministic_v1");

    const omissions = scenario.payload.omissions as JsonObject[];
    assert.ok(Array.isArray(omissions));
    assert.ok(
      omissions.some((item) => item.omission_code === "market_beta_omitted")
    );
    assert.ok(
      omissions.some((item) => item.omission_code === "legacy_beta_ignored")
    );
    assert.ok(
      omissions.some((item) => item.omission_code === "spot_reference_unavailable")
    );

    const base = scenario.payload.base as JsonObject;
    const baseAssumptions = (base.assumptions ?? {}) as JsonObject;
    assert.equal(baseAssumptions.beta, undefined);
    const scenarioBlock = scenario.payload.scenario as JsonObject;
    assert.equal(scenarioBlock.implied_upside_pct, undefined);
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.REVENUECAT_SERVER_API_KEY = previous.REVENUECAT_SERVER_API_KEY;
    process.env.REVENUECAT_ENTITLEMENT_ID = previous.REVENUECAT_ENTITLEMENT_ID;
  }
});
