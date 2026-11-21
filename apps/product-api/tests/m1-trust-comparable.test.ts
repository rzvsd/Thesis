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

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token"
  };
}

function buildReport(jobId: string, reportId: string, schemaVersion: string, generatedAt: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: schemaVersion,
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: generatedAt,
    confidence: {
      score: 0.61,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "neutral",
      reasons: ["Comparable baseline."],
      evidence: []
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: `Comparable thesis for schema ${schemaVersion}.`,
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

test("internal comparable endpoint returns latest report by ticker + schema major within lookback", async (t) => {
  // The lookback window is measured from "now"; pin the clock near the report dates so the result does not depend on the run date.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-25T12:00:00.000Z") });
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "m1-comparable@example.com");
    const secondSession = await createVerifiedSession(baseUrl, "m1-comparable-2@example.com");
    const authHeader = { authorization: `Bearer ${session.accessToken}` };
    const secondAuthHeader = { authorization: `Bearer ${secondSession.accessToken}` };
    const internalHeader = { "x-internal-token": session.internalToken };

    const firstJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "AAPL" }
    });
    assert.equal(firstJob.status, 202);
    const firstJobId = firstJob.payload.job_id as string;
    await requestJson(baseUrl, `/internal/jobs/${firstJobId}/claim`, {
      method: "POST",
      headers: internalHeader
    });
    await requestJson(baseUrl, `/internal/jobs/${firstJobId}/complete`, {
      method: "POST",
      headers: internalHeader,
      body: {
        report: buildReport(firstJobId, "report-schema2", "2.0", "2026-03-20T09:00:00.000Z")
      }
    });

    const secondJob = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: secondAuthHeader,
      body: { ticker: "AAPL" }
    });
    assert.equal(secondJob.status, 202);
    const secondJobId = secondJob.payload.job_id as string;
    await requestJson(baseUrl, `/internal/jobs/${secondJobId}/claim`, {
      method: "POST",
      headers: internalHeader
    });
    await requestJson(baseUrl, `/internal/jobs/${secondJobId}/complete`, {
      method: "POST",
      headers: internalHeader,
      body: {
        report: buildReport(secondJobId, "report-schema3", "3.0", "2026-03-21T09:00:00.000Z")
      }
    });

    const comparableV2 = await requestJson(
      baseUrl,
      "/internal/reports/comparable-latest?ticker=AAPL&schema_major=2&lookback_days=120",
      {
        method: "GET",
        headers: internalHeader
      }
    );
    assert.equal(comparableV2.status, 200);
    assert.equal(comparableV2.payload.missing, false);
    const v2Data = comparableV2.payload.data as JsonObject;
    assert.equal(v2Data.report_id, "report-schema2");
    assert.equal(v2Data.schema_version, "2.0");
    assert.equal(typeof v2Data.thesis_statement, "string");

    const comparableV3 = await requestJson(
      baseUrl,
      "/internal/reports/comparable-latest?ticker=AAPL&schema_major=3&lookback_days=120",
      {
        method: "GET",
        headers: internalHeader
      }
    );
    assert.equal(comparableV3.status, 200);
    assert.equal(comparableV3.payload.missing, false);
    const v3Data = comparableV3.payload.data as JsonObject;
    assert.equal(v3Data.report_id, "report-schema3");
    assert.equal(v3Data.schema_version, "3.0");

    const none = await requestJson(
      baseUrl,
      "/internal/reports/comparable-latest?ticker=MSFT&schema_major=2&lookback_days=120",
      {
        method: "GET",
        headers: internalHeader
      }
    );
    assert.equal(none.status, 200);
    assert.equal(none.payload.missing, true);
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});
