import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

type MockDateController = {
  setNow: (iso: string) => void;
  restore: () => void;
};

function installMockDate(initialIso: string): MockDateController {
  const RealDate = Date;
  let fixedMs = new RealDate(initialIso).getTime();

  class MockDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedMs);
        return;
      }
      super(...(args as ConstructorParameters<typeof RealDate>));
    }

    static override now(): number {
      return fixedMs;
    }
  }

  (globalThis as unknown as { Date: DateConstructor }).Date =
    MockDate as unknown as DateConstructor;

  return {
    setNow(iso: string): void {
      fixedMs = new RealDate(iso).getTime();
    },
    restore(): void {
      (globalThis as unknown as { Date: DateConstructor }).Date = RealDate;
    }
  };
}

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
): Promise<{ accessToken: string }> {
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
    accessToken: accessToken as string
  };
}

test("M4 daily Deep Dive limit resets after midnight in America/New_York", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    SUBSCRIPTION_TIMEZONE: process.env.SUBSCRIPTION_TIMEZONE
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.SUBSCRIPTION_TIMEZONE = "America/New_York";

  const mockDate = installMockDate("2026-04-15T03:55:00.000Z"); // 23:55 ET.
  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "ph2-m4-reset@example.com");
    const authHeader = { authorization: `Bearer ${session.accessToken}` };

    const firstRequest = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "AAPL" }
    });
    assert.equal(firstRequest.status, 202);

    const secondSameDay = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "MSFT" }
    });
    assert.equal(secondSameDay.status, 403);
    assert.equal(secondSameDay.payload.error, "upgrade_required");
    assert.equal(secondSameDay.payload.feature, "deep_dive_daily_limit");

    mockDate.setNow("2026-04-15T04:05:00.000Z"); // 00:05 ET.
    const afterMidnight = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "NVDA" }
    });
    assert.equal(afterMidnight.status, 202);
  } finally {
    await closeServer(server);
    mockDate.restore();
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.SUBSCRIPTION_TIMEZONE = previous.SUBSCRIPTION_TIMEZONE;
  }
});
