import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

const managedEnvKeys = [
  "NODE_ENV",
  "STORE_BACKEND",
  "QUEUE_BACKEND",
  "AUTH_EXPOSE_VERIFICATION_TOKEN",
  "JWT_SECRET",
  "INTERNAL_WORKER_TOKEN",
  "MAX_JSON_BODY_BYTES",
  "RATE_LIMIT_WINDOW_SECONDS",
  "RATE_LIMIT_MAX_REQUESTS",
  "AUTH_RATE_LIMIT_WINDOW_SECONDS",
  "AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS",
  "ACCESS_TOKEN_TTL_SECONDS",
  "REFRESH_TOKEN_TTL_SECONDS",
  "ADMIN_BOOTSTRAP_ENABLED",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD_HASH",
  "ADMIN_BOOTSTRAP_AUTO_VERIFY",
  "ADMIN_BOOTSTRAP_FORCE_PRO",
  "REDIS_URL"
] as const;

function setTestEnvironment(
  overrides: Partial<Record<(typeof managedEnvKeys)[number], string>>
): () => void {
  const previous = new Map<string, string | undefined>();
  for (const key of managedEnvKeys) {
    previous.set(key, process.env[key]);
  }

  for (const key of managedEnvKeys) {
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

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

async function createVerifiedSession(
  baseUrl: string,
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email,
      password
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
      password
    }
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.payload.access_token, "string");
  assert.equal(typeof login.payload.refresh_token, "string");

  return {
    accessToken: String(login.payload.access_token),
    refreshToken: String(login.payload.refresh_token)
  };
}

function sampleReport(jobId: string): JsonObject {
  return {
    report_id: `report-${jobId}`,
    job_id: jobId,
    schema_version: "1.0.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-04-14T12:00:00.000Z",
    confidence: {
      score: 0.61,
      label: "medium",
      limiting_factors: []
    },
    signal: {
      value: "neutral",
      reasons: ["Security integration fixture report."],
      evidence: [
        {
          evidence_id: "ev-security-1",
          source_type: "article",
          source_name: "fixture",
          excerpt: "Sample evidence excerpt.",
          retrieved_at: "2026-04-14T12:00:00.000Z"
        }
      ]
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "Fixture report for IDOR validation.",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: ["fixture"]
  };
}

test("M4 security: protected routes reject unauthenticated requests", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    AUTH_EXPOSE_VERIFICATION_TOKEN: "true",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "200",
    AUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: "50",
    ADMIN_BOOTSTRAP_ENABLED: undefined,
    ADMIN_BOOTSTRAP_EMAIL: undefined,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: undefined,
    ADMIN_BOOTSTRAP_FORCE_PRO: undefined
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthorized = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.payload.error, "unauthorized");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("M4 security: IDOR protection prevents cross-user report access", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    AUTH_EXPOSE_VERIFICATION_TOKEN: "true",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "200",
    AUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: "50",
    ADMIN_BOOTSTRAP_ENABLED: undefined,
    ADMIN_BOOTSTRAP_EMAIL: undefined,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: undefined,
    ADMIN_BOOTSTRAP_FORCE_PRO: undefined
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await createVerifiedSession(baseUrl, "m4-idor-owner@example.com", "VeryStrongPass1!");
    const other = await createVerifiedSession(baseUrl, "m4-idor-other@example.com", "VeryStrongPass1!");

    const jobCreate = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.accessToken}`
      },
      body: {
        ticker: "AAPL"
      }
    });
    assert.equal(jobCreate.status, 202);
    const jobId = String(jobCreate.payload.job_id);

    const claim = await requestJson(baseUrl, `/internal/jobs/${jobId}/claim`, {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      }
    });
    assert.equal(claim.status, 200);

    const complete = await requestJson(baseUrl, `/internal/jobs/${jobId}/complete`, {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        report: sampleReport(jobId)
      }
    });
    assert.equal(complete.status, 200);

    const ownerReports = await requestJson(baseUrl, "/reports", {
      method: "GET",
      headers: {
        authorization: `Bearer ${owner.accessToken}`
      }
    });
    assert.equal(ownerReports.status, 200);
    const reportRows = ownerReports.payload as unknown as unknown[];
    assert.ok(reportRows.length >= 1);
    const reportId = String((reportRows[0] as JsonObject).report_id);

    const blocked = await requestJson(baseUrl, `/reports/${reportId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${other.accessToken}`
      }
    });
    assert.equal(blocked.status, 404);
    assert.equal(blocked.payload.error, "report_not_found");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("M4 security: oversized payloads are rejected with 413", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    AUTH_EXPOSE_VERIFICATION_TOKEN: "true",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    MAX_JSON_BODY_BYTES: "128",
    ADMIN_BOOTSTRAP_ENABLED: undefined,
    ADMIN_BOOTSTRAP_EMAIL: undefined,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: undefined,
    ADMIN_BOOTSTRAP_FORCE_PRO: undefined
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await requestJson(baseUrl, "/auth/register", {
      method: "POST",
      body: {
        email: `${"oversized-email".repeat(30)}@example.com`,
        password: "VeryStrongPass1!"
      }
    });
    assert.equal(response.status, 413);
    assert.equal(response.payload.error, "payload_too_large");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("M4 security: expired access and refresh tokens are rejected", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    AUTH_EXPOSE_VERIFICATION_TOKEN: "true",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    ACCESS_TOKEN_TTL_SECONDS: "1",
    REFRESH_TOKEN_TTL_SECONDS: "1",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "200",
    AUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: "50",
    ADMIN_BOOTSTRAP_ENABLED: undefined,
    ADMIN_BOOTSTRAP_EMAIL: undefined,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: undefined,
    ADMIN_BOOTSTRAP_FORCE_PRO: undefined
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const session = await createVerifiedSession(baseUrl, "m4-expiry@example.com", "VeryStrongPass1!");

    await new Promise((resolve) => setTimeout(resolve, 1300));

    const expiredAccess = await requestJson(baseUrl, "/v1/user/profile", {
      method: "GET",
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });
    assert.equal(expiredAccess.status, 401);
    assert.equal(expiredAccess.payload.error, "unauthorized");

    const expiredRefresh = await requestJson(baseUrl, "/auth/refresh", {
      method: "POST",
      body: {
        refresh_token: session.refreshToken
      }
    });
    assert.equal(expiredRefresh.status, 401);
    assert.equal(expiredRefresh.payload.error, "refresh_failed");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("M4 security: startup guard fails on insecure production redis auth config", () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "production",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "redis",
    REDIS_URL: "redis://redis:6379/0",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    ADMIN_BOOTSTRAP_ENABLED: undefined,
    ADMIN_BOOTSTRAP_EMAIL: undefined,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: undefined,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: undefined,
    ADMIN_BOOTSTRAP_FORCE_PRO: undefined
  });

  try {
    assert.throws(
      () => startServer(0),
      /REDIS_URL must include password auth when NODE_ENV=production and QUEUE_BACKEND=redis/
    );
  } finally {
    restoreEnv();
  }
});
