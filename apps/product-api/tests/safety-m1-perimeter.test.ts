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
  "JWT_SECRET",
  "INTERNAL_WORKER_TOKEN",
  "CORS_ALLOWED_ORIGINS",
  "MAX_JSON_BODY_BYTES",
  "ADMIN_BOOTSTRAP_ENABLED",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD_HASH",
  "ADMIN_BOOTSTRAP_AUTO_VERIFY",
  "ADMIN_BOOTSTRAP_FORCE_PRO"
] as const;

function setTestEnvironment(overrides: Partial<Record<(typeof managedEnvKeys)[number], string>>): () => void {
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

async function parseJson(response: Response): Promise<JsonObject> {
  return (await response.json()) as JsonObject;
}

test("internal endpoints require internal token and accept valid token", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    CORS_ALLOWED_ORIGINS: "https://allowed.example"
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const path = "/internal/reports/comparable-latest?ticker=AAPL";

    const rejected = await fetch(`${baseUrl}${path}`, {
      headers: {
        "x-internal-token": "wrong-token"
      }
    });
    const rejectedPayload = await parseJson(rejected);
    assert.equal(rejected.status, 401);
    assert.equal(rejectedPayload.error, "unauthorized");

    const accepted = await fetch(`${baseUrl}${path}`, {
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      }
    });
    const acceptedPayload = await parseJson(accepted);
    assert.equal(accepted.status, 200);
    assert.equal(acceptedPayload.missing, true);
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("oversized JSON payloads return 413", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    MAX_JSON_BODY_BYTES: "128",
    CORS_ALLOWED_ORIGINS: "https://allowed.example"
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: `${"very-large-email".repeat(30)}@example.com`,
        password: "VeryStrongPass1!"
      })
    });
    const payload = await parseJson(response);

    assert.equal(response.status, 413);
    assert.equal(payload.error, "payload_too_large");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("security headers are present on API responses", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    CORS_ALLOWED_ORIGINS: "https://allowed.example"
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

test("CORS preflight enforces allowlist", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "test",
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "memory",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token",
    CORS_ALLOWED_ORIGINS: "https://allowed.example"
  });

  const server = startServer(0);
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const allowedPreflight = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        origin: "https://allowed.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,authorization"
      }
    });
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers.get("access-control-allow-origin"),
      "https://allowed.example"
    );
    assert.equal(
      allowedPreflight.headers.get("access-control-allow-methods"),
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );

    const deniedPreflight = await fetch(`${baseUrl}/auth/login`, {
      method: "OPTIONS",
      headers: {
        origin: "https://blocked.example",
        "access-control-request-method": "POST"
      }
    });
    const deniedPayload = await parseJson(deniedPreflight);
    assert.equal(deniedPreflight.status, 403);
    assert.equal(deniedPayload.error, "forbidden_origin");
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});
