import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

const managedEnvKeys = [
  "NODE_ENV",
  "STORE_BACKEND",
  "QUEUE_BACKEND",
  "JWT_SECRET",
  "INTERNAL_WORKER_TOKEN",
  "CORS_ALLOWED_ORIGINS",
  "ADMIN_BOOTSTRAP_ENABLED",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD_HASH"
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

test("production responses include HSTS header", async () => {
  const restoreEnv = setTestEnvironment({
    NODE_ENV: "production",
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
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains"
    );
  } finally {
    await closeServer(server);
    restoreEnv();
  }
});

