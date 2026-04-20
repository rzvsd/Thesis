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
): Promise<{ status: number; payload: JsonObject | JsonObject[] }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = (await response.json()) as JsonObject | JsonObject[];
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
      email: "m4-jobs@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(register.status, 201);
  const registerPayload = register.payload as JsonObject;
  const verificationToken = registerPayload.verification_token;
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
      email: "m4-jobs@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const loginPayload = login.payload as JsonObject;
  const accessToken = loginPayload.access_token;
  assert.equal(typeof accessToken, "string");

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token"
  };
}

function sampleReport(jobId: string, reportId: string): JsonObject {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-03-20T12:00:00.000Z",
    confidence: {
      score: 0.68,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "neutral",
      reasons: ["Evidence threshold met."],
      evidence: [
        {
          evidence_id: "ev-1",
          source_type: "article",
          source_name: "fixture-news",
          excerpt: "Revenue growth remained stable.",
          retrieved_at: "2026-03-20T12:00:00.000Z",
          url: "https://example.com/news"
        }
      ]
    },
    historical_context: {
      latest_period: "2025-Q4",
      prior_quarter_period: "2025-Q3",
      year_ago_period: "2024-Q4",
      transcript_period: "2025-Q4",
      financial_snapshot_count: 6,
      transcript_count: 2,
      transcript_available: true,
      missing_reasons: []
    },
    story_header: {
      headline: "AAPL: services strength keeps the thesis intact",
      thesis_summary: "The thesis is intact, but hardware recovery still matters.",
      why_now: "Revenue improved while valuation stayed disciplined.",
      reader_takeaway: "Read what changed first, then check the proof layer.",
      stance_label: "neutral"
    },
    change_summary: {
      previous_view: "Prior thesis watched hardware weakness.",
      current_view: "Current evidence is stable but not decisive.",
      top_changes: [
        {
          title: "Revenue reset the tone",
          direction: "up",
          impact_level: "high",
          why_it_changed: "Revenue improved in the latest period.",
          why_it_matters: "Revenue quality determines whether the thesis can hold."
        }
      ]
    },
    visual_panels: [
      {
        type: "trust_scorecard",
        title: "Trust and Freshness",
        freshness_state: "fresh",
        contradiction_state: "none",
        valuation_state: "available",
        evidence_count: 1
      },
      {
        type: "metric_delta",
        title: "Quarter-over-quarter moves",
        metrics: [
          {
            label: "Revenue",
            current_value: 100,
            reference_value: 90,
            delta_pct: 11.1,
            basis: "qoq",
            direction: "up"
          }
        ]
      }
    ],
    explainers: {
      signal: "Signal explains the directional call.",
      confidence: "Confidence explains the limits.",
      freshness: "Freshness explains whether the report is current.",
      valuation: "Valuation explains the modeled range.",
      omissions: "Omissions explain what is missing."
    },
    watch_items: ["Watch margin quality."],
    coverage_truth: {
      summary: "The report states what it covers and what is missing.",
      covered: ["Latest financial snapshot"],
      missing: ["No major omissions"]
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL thesis statement sample.",
        status: "complete",
        evidence: []
      },
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Sample deep dive report.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture-news"]
  };
}

async function createVerifiedSessionWithEmail(baseUrl: string, email: string): Promise<{
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
  const registerPayload = register.payload as JsonObject;
  const verificationToken = registerPayload.verification_token;
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
  const loginPayload = login.payload as JsonObject;
  const accessToken = loginPayload.access_token;
  assert.equal(typeof accessToken, "string");

  return {
    accessToken: accessToken as string,
    internalToken: process.env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token"
  };
}

test("job lifecycle supports queue -> running -> complete and report retrieval", async () => {
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

  const session = await createVerifiedSession(baseUrl);
  const authHeader = { authorization: `Bearer ${session.accessToken}` };

  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: authHeader,
    body: {
      ticker: "AAPL"
    }
  });
  assert.equal(createJob.status, 202);
  const createdJob = createJob.payload as JsonObject;
  const jobId = createdJob.job_id;
  assert.equal(typeof jobId, "string");
  assert.equal(createdJob.status, "queued");

  const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    }
  });
  assert.equal(claim.status, 200);
  const claimPayload = claim.payload as JsonObject;
  const analysisRequest = claimPayload.analysis_request as JsonObject;
  assert.equal(analysisRequest.job_id, jobId);

  const reportId = "report-m4-1";
  const complete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    },
    body: {
      report: sampleReport(jobId as string, reportId)
    }
  });
  assert.equal(complete.status, 200);

  const readJob = await requestJson(baseUrl, `/jobs/${jobId as string}`, {
    method: "GET",
    headers: authHeader
  });
  assert.equal(readJob.status, 200);
  const readJobPayload = readJob.payload as JsonObject;
  assert.equal(readJobPayload.status, "complete");
  assert.equal(readJobPayload.report_id, reportId);

  const history = await requestJson(baseUrl, "/reports", {
    method: "GET",
    headers: authHeader
  });
  assert.equal(history.status, 200);
  const historyPayload = history.payload as JsonObject[];
  assert.equal(historyPayload.length, 1);
  assert.equal(historyPayload[0]?.report_id, reportId);

  const report = await requestJson(baseUrl, `/reports/${reportId}`, {
    method: "GET",
    headers: authHeader
  });
  assert.equal(report.status, 200);
  const reportPayload = report.payload as JsonObject;
  assert.equal(reportPayload.report_id, reportId);
  assert.equal((reportPayload.story_header as JsonObject).headline, "AAPL: services strength keeps the thesis intact");
  assert.equal(Array.isArray(reportPayload.visual_panels), true);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});

test("protected routes return 401 and rate limit returns 429", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.RATE_LIMIT_MAX_REQUESTS = "1";
  process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
  process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = "60";
  process.env.AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS = "1";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const unauthorized = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    body: {
      ticker: "AAPL"
    }
  });
  assert.equal(unauthorized.status, 401);

  const firstRegister = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "ratelimit-a@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(firstRegister.status, 201);

  const secondRegister = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "ratelimit-b@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(secondRegister.status, 429);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.RATE_LIMIT_MAX_REQUESTS = previous.RATE_LIMIT_MAX_REQUESTS;
  process.env.RATE_LIMIT_WINDOW_SECONDS = previous.RATE_LIMIT_WINDOW_SECONDS;
  process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = previous.AUTH_RATE_LIMIT_WINDOW_SECONDS;
  process.env.AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS = previous.AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS;
});

test("internal fail endpoint marks job as failed", async () => {
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

  const session = await createVerifiedSession(baseUrl);
  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: { authorization: `Bearer ${session.accessToken}` },
    body: { ticker: "AAPL" }
  });
  assert.equal(createJob.status, 202);
  const createdJob = createJob.payload as JsonObject;
  const jobId = createdJob.job_id as string;

  const fail = await requestJson(baseUrl, `/internal/jobs/${jobId}/fail`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    },
    body: {
      error_message: "forced failure"
    }
  });
  assert.equal(fail.status, 200);

  const status = await requestJson(baseUrl, `/jobs/${jobId}`, {
    method: "GET",
    headers: { authorization: `Bearer ${session.accessToken}` }
  });
  assert.equal(status.status, 200);
  const statusPayload = status.payload as JsonObject;
  assert.equal(statusPayload.status, "failed");
  assert.equal(statusPayload.error_message, "forced failure");

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});

test("failed jobs do not leave a partial report retrievable after a late complete callback", async () => {
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

  const session = await createVerifiedSession(baseUrl);
  const authHeader = { authorization: `Bearer ${session.accessToken}` };

  const createJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: authHeader,
    body: {
      ticker: "AAPL"
    }
  });
  assert.equal(createJob.status, 202);
  const createdJob = createJob.payload as JsonObject;
  const jobId = createdJob.job_id;
  assert.equal(typeof jobId, "string");

  const claim = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/claim`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    }
  });
  assert.equal(claim.status, 200);

  const fail = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/fail`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    },
    body: {
      error_message: "forced failure"
    }
  });
  assert.equal(fail.status, 200);

  const lateComplete = await requestJson(baseUrl, `/internal/jobs/${jobId as string}/complete`, {
    method: "POST",
    headers: {
      "x-internal-token": session.internalToken
    },
    body: {
      report: sampleReport(jobId as string, "report-after-fail")
    }
  });
  assert.equal(lateComplete.status, 404);

  const status = await requestJson(baseUrl, `/jobs/${jobId as string}`, {
    method: "GET",
    headers: authHeader
  });
  assert.equal(status.status, 200);
  const statusPayload = status.payload as JsonObject;
  assert.equal(statusPayload.status, "failed");
  assert.ok(!statusPayload.report_id);

  const history = await requestJson(baseUrl, "/reports", {
    method: "GET",
    headers: authHeader
  });
  assert.equal(history.status, 200);
  const historyPayload = history.payload as JsonObject[];
  assert.equal(historyPayload.length, 0);

  const report = await requestJson(baseUrl, "/reports/report-after-fail", {
    method: "GET",
    headers: authHeader
  });
  assert.equal(report.status, 404);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});

test("M2 reuse returns a cloned report for a second user without queueing a new run", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    DEEP_DIVE_REUSE_FRESHNESS_HOURS: process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS = "24";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const sessionA = await createVerifiedSessionWithEmail(baseUrl, "m2-reuse-a@example.com");
  const sessionB = await createVerifiedSessionWithEmail(baseUrl, "m2-reuse-b@example.com");

  const createA = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: { authorization: `Bearer ${sessionA.accessToken}` },
    body: { ticker: "AAPL" }
  });
  assert.equal(createA.status, 202);
  const jobIdA = (createA.payload as JsonObject).job_id as string;

  const claimA = await requestJson(baseUrl, `/internal/jobs/${jobIdA}/claim`, {
    method: "POST",
    headers: { "x-internal-token": sessionA.internalToken }
  });
  assert.equal(claimA.status, 200);

  const reportId = "report-m2-reuse-1";
  const completeA = await requestJson(baseUrl, `/internal/jobs/${jobIdA}/complete`, {
    method: "POST",
    headers: { "x-internal-token": sessionA.internalToken },
    body: { report: sampleReport(jobIdA, reportId) }
  });
  assert.equal(completeA.status, 200);

  const createB = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: { authorization: `Bearer ${sessionB.accessToken}` },
    body: { ticker: "AAPL" }
  });
  assert.equal(createB.status, 200);
  const createBPayload = createB.payload as JsonObject;
  assert.equal(createBPayload.status, "complete");
  const reusedReportId = createBPayload.report_id as string;
  const reusedJobId = createBPayload.job_id as string;
  assert.equal(typeof reusedReportId, "string");
  assert.equal(typeof reusedJobId, "string");
  assert.notEqual(reusedReportId, reportId);
  assert.notEqual(reusedJobId, jobIdA);

  const reportsB = await requestJson(baseUrl, "/reports", {
    method: "GET",
    headers: { authorization: `Bearer ${sessionB.accessToken}` }
  });
  assert.equal(reportsB.status, 200);
  const reportRows = reportsB.payload as JsonObject[];
  assert.ok(reportRows.some((row) => row.report_id === reusedReportId));
  assert.ok(!reportRows.some((row) => row.report_id === reportId));

  const getReportB = await requestJson(baseUrl, `/reports/${reusedReportId}`, {
    method: "GET",
    headers: { authorization: `Bearer ${sessionB.accessToken}` }
  });
  assert.equal(getReportB.status, 200);
  const getReportBPayload = getReportB.payload as JsonObject;
  assert.equal(getReportBPayload.report_id, reusedReportId);
  assert.equal(getReportBPayload.job_id, reusedJobId);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS = previous.DEEP_DIVE_REUSE_FRESHNESS_HOURS;
});

test("M2 reuse excludes failed-origin reports and queues a fresh run", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    DEEP_DIVE_REUSE_FRESHNESS_HOURS: process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS = "24";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const sessionA = await createVerifiedSessionWithEmail(baseUrl, "m2-reuse-failed-a@example.com");
  const sessionB = await createVerifiedSessionWithEmail(baseUrl, "m2-reuse-failed-b@example.com");

  const createA = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: { authorization: `Bearer ${sessionA.accessToken}` },
    body: { ticker: "AAPL" }
  });
  assert.equal(createA.status, 202);
  const jobIdA = (createA.payload as JsonObject).job_id as string;

  const claimA = await requestJson(baseUrl, `/internal/jobs/${jobIdA}/claim`, {
    method: "POST",
    headers: { "x-internal-token": sessionA.internalToken }
  });
  assert.equal(claimA.status, 200);

  const reportId = "report-m2-reuse-failed-1";
  const completeA = await requestJson(baseUrl, `/internal/jobs/${jobIdA}/complete`, {
    method: "POST",
    headers: { "x-internal-token": sessionA.internalToken },
    body: { report: sampleReport(jobIdA, reportId) }
  });
  assert.equal(completeA.status, 200);

  const failA = await requestJson(baseUrl, `/internal/jobs/${jobIdA}/fail`, {
    method: "POST",
    headers: { "x-internal-token": sessionA.internalToken },
    body: { error_message: "Late failure after completion." }
  });
  assert.equal(failA.status, 200);

  const createB = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers: { authorization: `Bearer ${sessionB.accessToken}` },
    body: { ticker: "AAPL" }
  });
  assert.equal(createB.status, 202);
  const createBPayload = createB.payload as JsonObject;
  assert.equal(createBPayload.status, "queued");
  assert.equal(typeof createBPayload.job_id, "string");

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.DEEP_DIVE_REUSE_FRESHNESS_HOURS = previous.DEEP_DIVE_REUSE_FRESHNESS_HOURS;
});
