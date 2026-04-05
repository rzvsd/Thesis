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

async function createVerifiedSession(baseUrl: string, email: string): Promise<{
  accessToken: string;
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

  const profile = await requestJson(baseUrl, "/v1/user/profile", {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken as string}`
    }
  });
  assert.equal(profile.status, 200);
  const profilePayload = profile.payload as { data: { user_id: string } };

  return {
    accessToken: accessToken as string,
    userId: profilePayload.data.user_id
  };
}

test("M4 push model supports multiple active devices per user and installation-level unregister", async () => {
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    PUSH_PROVIDER_MODE: process.env.PUSH_PROVIDER_MODE,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    TICKER_AUTO_SYNC_ENABLED: process.env.TICKER_AUTO_SYNC_ENABLED,
    TICKER_AUTO_SYNC_RUN_ON_STARTUP: process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL,
    MARKET_PULSE_NEWS_INGEST_BASE_URL: process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL
  };

  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.PUSH_PROVIDER_MODE = "stub";
  process.env.REVENUECAT_WEBHOOK_SECRET = "dev-revenuecat-secret";
  process.env.TICKER_AUTO_SYNC_ENABLED = "false";
  process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = "false";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = "http://127.0.0.1:0";
  process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = "http://127.0.0.1:0";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const session = await createVerifiedSession(baseUrl, "m4-push-devices@example.com");
    const authHeader = { authorization: `Bearer ${session.accessToken}` };

    const promote = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer dev-revenuecat-secret"
      },
      body: {
        type: "INITIAL_PURCHASE",
        app_user_id: session.userId,
        expiration_at: "2026-05-30T00:00:00.000Z"
      }
    });
    assert.equal(promote.status, 200);

    const registerA = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: authHeader,
      body: {
        installation_id: "android-installation-a",
        device_token: "device-token-installation-a-1234567890",
        platform: "android"
      }
    });
    assert.equal(registerA.status, 200);

    const registerB = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: authHeader,
      body: {
        installation_id: "android-installation-b",
        device_token: "device-token-installation-b-1234567890",
        platform: "android"
      }
    });
    assert.equal(registerB.status, 200);

    const digestWithTwoDevices = await requestJson(baseUrl, "/internal/notifications/weekly-digest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        digest_date: "2026-03-22"
      }
    });
    assert.equal(digestWithTwoDevices.status, 200);
    const digestWithTwoDevicesPayload = digestWithTwoDevices.payload as JsonObject;
    assert.equal(digestWithTwoDevicesPayload.attempted, 2);
    assert.equal(digestWithTwoDevicesPayload.delivered, 2);
    assert.equal(digestWithTwoDevicesPayload.failed, 0);

    const unregisterB = await requestJson(baseUrl, "/notifications/device-token", {
      method: "POST",
      headers: authHeader,
      body: {
        installation_id: "android-installation-b",
        device_token: null,
        platform: "android"
      }
    });
    assert.equal(unregisterB.status, 200);

    const digestAfterUnregister = await requestJson(baseUrl, "/internal/notifications/weekly-digest", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        digest_date: "2026-03-22"
      }
    });
    assert.equal(digestAfterUnregister.status, 200);
    const digestAfterUnregisterPayload = digestAfterUnregister.payload as JsonObject;
    assert.equal(digestAfterUnregisterPayload.attempted, 1);
    assert.equal(digestAfterUnregisterPayload.delivered, 1);
    assert.equal(digestAfterUnregisterPayload.failed, 0);
  } finally {
    await closeServer(server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.PUSH_PROVIDER_MODE = previous.PUSH_PROVIDER_MODE;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.TICKER_AUTO_SYNC_ENABLED = previous.TICKER_AUTO_SYNC_ENABLED;
    process.env.TICKER_AUTO_SYNC_RUN_ON_STARTUP = previous.TICKER_AUTO_SYNC_RUN_ON_STARTUP;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
    process.env.MARKET_PULSE_NEWS_INGEST_BASE_URL = previous.MARKET_PULSE_NEWS_INGEST_BASE_URL;
  }
});
