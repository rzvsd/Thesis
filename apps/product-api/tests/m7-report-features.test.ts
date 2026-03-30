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

function sampleDeepDiveReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-03-30T09:30:00.000Z",
    confidence: {
      score: 0.72,
      label: "medium",
      limiting_factors: ["limited_news_coverage"]
    },
    signal: {
      value: "positive",
      reasons: ["Cash flow momentum remains healthy."],
      evidence: []
    },
    valuation: {
      fair_value_mid: 210.0,
      fair_value_low: 178.5,
      fair_value_high: 241.5,
      spot_price: 190.0,
      implied_upside_pct: 10.53,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.095
      }
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL maintains resilient cash generation with moderate upside.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture-financials"]
  };
}

test("M7 notes CRUD and scenario endpoint enforce access and Pro gating", async () => {
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
  process.env.REVENUECAT_WEBHOOK_SECRET = "m7-webhook-secret";
  process.env.REVENUECAT_SERVER_API_KEY = "m7-server-api-key";
  process.env.REVENUECAT_ENTITLEMENT_ID = "pro";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const owner = await createVerifiedSession(baseUrl, "m7-owner@example.com");
    const other = await createVerifiedSession(baseUrl, "m7-other@example.com");

    const ownerAuth = { authorization: `Bearer ${owner.accessToken}` };
    const otherAuth = { authorization: `Bearer ${other.accessToken}` };

    const createJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: ownerAuth,
      body: { ticker: "AAPL" }
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

    const reportId = "m7-report-001";
    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
      method: "POST",
      headers: {
        "x-internal-token": owner.internalToken
      },
      body: {
        report: sampleDeepDiveReport(jobId as string, reportId)
      }
    });
    assert.equal(complete.status, 200);

    const getMissingNote = await requestJson(baseUrl, `/v1/reports/${reportId}/note`, {
      method: "GET",
      headers: ownerAuth
    });
    assert.equal(getMissingNote.status, 404);
    assert.equal(getMissingNote.payload.error, "note_not_found");

    const saveNote = await requestJson(baseUrl, `/v1/reports/${reportId}/note`, {
      method: "PUT",
      headers: ownerAuth,
      body: {
        content: "Track margin progression next quarter."
      }
    });
    assert.equal(saveNote.status, 200);
    const saveData = saveNote.payload.data as JsonObject;
    assert.equal(saveData.content, "Track margin progression next quarter.");

    const getNote = await requestJson(baseUrl, `/v1/reports/${reportId}/note`, {
      method: "GET",
      headers: ownerAuth
    });
    assert.equal(getNote.status, 200);
    const noteData = getNote.payload.data as JsonObject;
    assert.equal(noteData.content, "Track margin progression next quarter.");

    const blockedScenario = await requestJson(baseUrl, `/v1/reports/${reportId}/scenario`, {
      method: "POST",
      headers: ownerAuth,
      body: {
        overrides: {
          wacc: 0.1
        }
      }
    });
    assert.equal(blockedScenario.status, 403);
    assert.equal(blockedScenario.payload.error, "upgrade_required");
    assert.equal(blockedScenario.payload.feature, "what_if_scenario");

    const upgrade = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer m7-webhook-secret"
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

    const runScenario = await requestJson(baseUrl, `/v1/reports/${reportId}/scenario`, {
      method: "POST",
      headers: ownerAuth,
      body: {
        overrides: {
          projection_years: 7,
          terminal_growth_rate: 0.03,
          wacc: 0.11
        }
      }
    });
    assert.equal(runScenario.status, 200);
    assert.equal(runScenario.payload.report_id, reportId);
    const scenario = runScenario.payload.scenario as JsonObject;
    const assumptions = scenario.assumptions as JsonObject;
    assert.equal(assumptions.projection_years, 7);
    assert.equal(assumptions.terminal_growth_rate, 0.03);
    assert.equal(assumptions.wacc, 0.11);

    const otherCannotReadNote = await requestJson(baseUrl, `/v1/reports/${reportId}/note`, {
      method: "GET",
      headers: otherAuth
    });
    assert.equal(otherCannotReadNote.status, 404);

    const otherCannotRunScenario = await requestJson(baseUrl, `/v1/reports/${reportId}/scenario`, {
      method: "POST",
      headers: otherAuth,
      body: {
        overrides: { wacc: 0.12 }
      }
    });
    assert.equal(otherCannotRunScenario.status, 404);
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
