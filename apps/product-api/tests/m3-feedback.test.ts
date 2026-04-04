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
    schema_version: "3.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-04T09:30:00.000Z",
    confidence: {
      score: 0.75,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: ["Margin trend remains resilient."],
      evidence: []
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL remains resilient in base case.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture-financials"]
  };
}

test("M3 report and subscription feedback persist into Product API queue", async () => {
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
    const owner = await createVerifiedSession(baseUrl, "ph3-m3-owner@example.com");
    const other = await createVerifiedSession(baseUrl, "ph3-m3-other@example.com");

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

    const reportId = "ph3-m3-report-001";
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

    const reportFeedback = await requestJson(baseUrl, "/v1/feedback/report", {
      method: "POST",
      headers: ownerAuth,
      body: {
        report_id: reportId,
        code: "confusing",
        source_surface: "deep_dive_report",
        message: "The lead finding needs plainer language."
      }
    });
    assert.equal(reportFeedback.status, 202);
    const reportFeedbackData = reportFeedback.payload.data as JsonObject;
    assert.equal(reportFeedbackData.status, "queued_for_review");
    assert.equal(typeof reportFeedbackData.feedback_id, "string");

    const subscriptionFeedback = await requestJson(baseUrl, "/v1/feedback/subscription", {
      method: "POST",
      headers: ownerAuth,
      body: {
        code: "cancel_price",
        source_surface: "settings_subscription_cancel",
        message: "Need lower monthly option."
      }
    });
    assert.equal(subscriptionFeedback.status, 202);
    const subscriptionFeedbackData = subscriptionFeedback.payload.data as JsonObject;
    assert.equal(subscriptionFeedbackData.status, "queued_for_review");

    const queueAll = await requestJson(baseUrl, "/internal/feedback/queue?limit=20", {
      method: "GET",
      headers: {
        "x-internal-token": owner.internalToken
      }
    });
    assert.equal(queueAll.status, 200);
    const rowsAll = (queueAll.payload.data ?? []) as Array<JsonObject>;
    assert.equal(rowsAll.length, 2);
    const reportRow = rowsAll.find((row) => row.feedback_type === "report");
    const subscriptionRow = rowsAll.find((row) => row.feedback_type === "subscription");
    assert.ok(reportRow);
    assert.ok(subscriptionRow);
    assert.equal(reportRow?.report_id, reportId);
    assert.equal(reportRow?.code, "confusing");
    assert.equal(reportRow?.source_surface, "deep_dive_report");
    assert.equal(reportRow?.user_tier, "FREE");
    assert.equal(reportRow?.triage_status, "new");
    assert.equal(reportRow?.route_status, "pending");
    assert.equal(subscriptionRow?.code, "cancel_price");
    assert.equal(subscriptionRow?.source_surface, "settings_subscription_cancel");

    const queueReportOnly = await requestJson(
      baseUrl,
      "/internal/feedback/queue?limit=20&feedback_type=report",
      {
        method: "GET",
        headers: {
          "x-internal-token": owner.internalToken
        }
      }
    );
    assert.equal(queueReportOnly.status, 200);
    const reportOnlyRows = (queueReportOnly.payload.data ?? []) as Array<JsonObject>;
    assert.equal(reportOnlyRows.length, 1);
    assert.equal(reportOnlyRows[0]?.feedback_type, "report");

    const otherUserBlocked = await requestJson(baseUrl, "/v1/feedback/report", {
      method: "POST",
      headers: otherAuth,
      body: {
        report_id: reportId,
        code: "useful",
        source_surface: "deep_dive_report"
      }
    });
    assert.equal(otherUserBlocked.status, 404);
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});
