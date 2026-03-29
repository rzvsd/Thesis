import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
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

function decodeJwtSub(token: string): string {
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const payload = JSON.parse(
    Buffer.from(parts[1] ?? "", "base64url").toString("utf8")
  ) as JsonObject;
  const subject = payload.sub;
  assert.equal(typeof subject, "string");
  return subject as string;
}

async function createVerifiedSession(
  baseUrl: string,
  email: string = "ph2-m4-subscription@example.com"
): Promise<{ accessToken: string; userId: string }> {
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
    userId: decodeJwtSub(accessToken as string)
  };
}

async function startRevenueCatMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || !url.pathname.startsWith("/subscribers/")) {
      sendJson(response, 404, { status: "not_found" });
      return;
    }

    const appUserId = decodeURIComponent(url.pathname.replace("/subscribers/", ""));
    sendJson(response, 200, {
      subscriber: {
        original_app_user_id: appUserId,
        entitlements: {
          pro: {
            expires_date: "2099-12-31T00:00:00.000Z"
          }
        }
      }
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

test("M4 subscriptions enforce Free/Pro gating and tier updates", async () => {
  const revenueCatMock = await startRevenueCatMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_SERVER_API_KEY: process.env.REVENUECAT_SERVER_API_KEY,
    REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID,
    REVENUECAT_API_BASE_URL: process.env.REVENUECAT_API_BASE_URL
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.REVENUECAT_WEBHOOK_SECRET = "m4-webhook-secret";
  process.env.REVENUECAT_SERVER_API_KEY = "m4-server-api-key";
  process.env.REVENUECAT_ENTITLEMENT_ID = "pro";
  process.env.REVENUECAT_API_BASE_URL = revenueCatMock.baseUrl;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const session = await createVerifiedSession(baseUrl);
    const authHeader = { authorization: `Bearer ${session.accessToken}` };

    const initialProfile = await requestJson(baseUrl, "/v1/user/profile", {
      headers: authHeader
    });
    assert.equal(initialProfile.status, 200);
    const initialData = initialProfile.payload.data as JsonObject;
    assert.equal(initialData.tier, "FREE");
    assert.equal(initialData.watchlist_limit, 5);
    assert.equal(initialData.daily_deep_dive_limit, 1);
    assert.equal(initialData.deep_dives_remaining_today, 1);

    const watchlistSeed = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"];
    for (const ticker of watchlistSeed) {
      const added = await requestJson(baseUrl, "/watchlist", {
        method: "POST",
        headers: authHeader,
        body: { ticker }
      });
      assert.equal(added.status, 200);
    }

    const blockedWatchlist = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "META" }
    });
    assert.equal(blockedWatchlist.status, 403);
    assert.equal(blockedWatchlist.payload.error, "upgrade_required");
    assert.equal(blockedWatchlist.payload.feature, "watchlist_cap");

    const deepDiveRace = await Promise.all([
      requestJson(baseUrl, "/jobs", {
        method: "POST",
        headers: authHeader,
        body: { ticker: "AAPL" }
      }),
      requestJson(baseUrl, "/jobs", {
        method: "POST",
        headers: authHeader,
        body: { ticker: "MSFT" }
      })
    ]);
    const acceptedDeepDive = deepDiveRace.find((response) => response.status === 202);
    const blockedDeepDive = deepDiveRace.find((response) => response.status === 403);
    assert.ok(acceptedDeepDive);
    assert.ok(blockedDeepDive);
    assert.equal(blockedDeepDive.payload.error, "upgrade_required");
    assert.equal(blockedDeepDive.payload.feature, "deep_dive_daily_limit");

    const initialPurchase = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer m4-webhook-secret"
      },
      body: {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: session.userId,
          expiration_at: "2099-12-31T00:00:00.000Z"
        }
      }
    });
    assert.equal(initialPurchase.status, 200);

    const proProfile = await requestJson(baseUrl, "/v1/user/profile", {
      headers: authHeader
    });
    assert.equal(proProfile.status, 200);
    const proData = proProfile.payload.data as JsonObject;
    assert.equal(proData.tier, "PRO");
    assert.equal(proData.watchlist_limit, 20);
    assert.equal(proData.daily_deep_dive_limit, -1);

    const watchlistAfterUpgrade = await requestJson(baseUrl, "/watchlist", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "META" }
    });
    assert.equal(watchlistAfterUpgrade.status, 200);

    const secondDeepDiveAfterUpgrade = await requestJson(baseUrl, "/jobs", {
      method: "POST",
      headers: authHeader,
      body: { ticker: "MSFT" }
    });
    assert.equal(secondDeepDiveAfterUpgrade.status, 202);

    const cancellation = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer m4-webhook-secret"
      },
      body: {
        event: {
          type: "CANCELLATION",
          app_user_id: session.userId,
          expiration_at: "2099-12-31T00:00:00.000Z"
        }
      }
    });
    assert.equal(cancellation.status, 200);

    const cancelProfile = await requestJson(baseUrl, "/v1/user/profile", {
      headers: authHeader
    });
    assert.equal(cancelProfile.status, 200);
    const cancelData = cancelProfile.payload.data as JsonObject;
    assert.equal(cancelData.tier, "PRO");
    assert.equal(typeof cancelData.billing_period_end, "string");

    const expiration = await requestJson(baseUrl, "/v1/webhooks/revenuecat", {
      method: "POST",
      headers: {
        authorization: "Bearer m4-webhook-secret"
      },
      body: {
        event: {
          type: "EXPIRATION",
          app_user_id: session.userId
        }
      }
    });
    assert.equal(expiration.status, 200);

    const freeProfileAgain = await requestJson(baseUrl, "/v1/user/profile", {
      headers: authHeader
    });
    assert.equal(freeProfileAgain.status, 200);
    const freeAgainData = freeProfileAgain.payload.data as JsonObject;
    assert.equal(freeAgainData.tier, "FREE");

    const syncTier = await requestJson(baseUrl, "/v1/user/sync-tier", {
      method: "POST",
      headers: authHeader,
      body: {
        revenuecat_app_user_id: session.userId
      }
    });
    assert.equal(syncTier.status, 200);
    const syncData = syncTier.payload.data as JsonObject;
    assert.equal(syncData.tier, "PRO");
  } finally {
    await closeServer(server);
    await closeServer(revenueCatMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.REVENUECAT_SERVER_API_KEY = previous.REVENUECAT_SERVER_API_KEY;
    process.env.REVENUECAT_ENTITLEMENT_ID = previous.REVENUECAT_ENTITLEMENT_ID;
    process.env.REVENUECAT_API_BASE_URL = previous.REVENUECAT_API_BASE_URL;
  }
});

test("M4 sync-tier rejects RevenueCat app user ids not bound to the caller", async () => {
  const revenueCatMock = await startRevenueCatMock();
  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_SERVER_API_KEY: process.env.REVENUECAT_SERVER_API_KEY,
    REVENUECAT_ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID,
    REVENUECAT_API_BASE_URL: process.env.REVENUECAT_API_BASE_URL
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.REVENUECAT_WEBHOOK_SECRET = "m4-webhook-secret";
  process.env.REVENUECAT_SERVER_API_KEY = "m4-server-api-key";
  process.env.REVENUECAT_ENTITLEMENT_ID = "pro";
  process.env.REVENUECAT_API_BASE_URL = revenueCatMock.baseUrl;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const sessionA = await createVerifiedSession(baseUrl, "ph2-m4-sync-a@example.com");
    const sessionB = await createVerifiedSession(baseUrl, "ph2-m4-sync-b@example.com");

    const syncTier = await requestJson(baseUrl, "/v1/user/sync-tier", {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionA.accessToken}`
      },
      body: {
        revenuecat_app_user_id: sessionB.userId
      }
    });
    assert.equal(syncTier.status, 403);
    assert.equal(syncTier.payload.error, "forbidden");

    const profile = await requestJson(baseUrl, "/v1/user/profile", {
      headers: {
        authorization: `Bearer ${sessionA.accessToken}`
      }
    });
    assert.equal(profile.status, 200);
    assert.equal((profile.payload.data as JsonObject).tier, "FREE");
  } finally {
    await closeServer(server);
    await closeServer(revenueCatMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.REVENUECAT_WEBHOOK_SECRET = previous.REVENUECAT_WEBHOOK_SECRET;
    process.env.REVENUECAT_SERVER_API_KEY = previous.REVENUECAT_SERVER_API_KEY;
    process.env.REVENUECAT_ENTITLEMENT_ID = previous.REVENUECAT_ENTITLEMENT_ID;
    process.env.REVENUECAT_API_BASE_URL = previous.REVENUECAT_API_BASE_URL;
  }
});
