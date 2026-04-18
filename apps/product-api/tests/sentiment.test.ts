import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startOfficialMacroMock(): Promise<{
  server: Server;
  baseUrl: string;
  requests: URL[];
}> {
  const requests: URL[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/v1/official/macro") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    requests.push(url);
    sendJson(response, 200, {
      ok: true,
      data: {
        observations: [
          {
            registry_id: "TREASURY_DAILY_10Y",
            value: 4.2,
            unit: "percent",
            period: "2026-03-20",
            category: "rates",
            retrieval: {
              source: {
                source_name: "U.S. Treasury",
                source_url: "https://home.treasury.gov/"
              },
              retrieved_at: "2026-03-20T08:00:00.000Z"
            },
            missing_fields: []
          },
          {
            registry_id: "BLS_UNEMPLOYMENT_RATE",
            value: 3.9,
            unit: "percent",
            period: "2026-03",
            category: "labor",
            retrieval: {
              source: {
                source_name: "BLS",
                source_url: "https://www.bls.gov/"
              },
              retrieved_at: "2026-03-20T08:00:00.000Z"
            },
            missing_fields: []
          },
          {
            registry_id: "BEA_REAL_GDP",
            value: 1.8,
            unit: "percent",
            period: "2026-Q1",
            category: "growth",
            retrieval: {
              source: {
                source_name: "BEA",
                source_url: "https://www.bea.gov/"
              },
              retrieved_at: "2026-03-20T08:00:00.000Z"
            },
            missing_fields: []
          }
        ],
        canonical_events: []
      },
      error_flag: false
    });
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests
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

async function createVerifiedSession(baseUrl: string): Promise<string> {
  const email = `m3-macro-${Date.now()}@example.com`;
  const password = "VeryStrongPass1!";
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: { email, password }
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
    body: { email, password }
  });
  assert.equal(login.status, 200);
  const token = login.payload.access_token;
  assert.equal(typeof token, "string");
  return token as string;
}

test("internal macro-stress dispatch stores deterministic snapshots and serves current/history", async () => {
  const macroMock = await startOfficialMacroMock();

  const previous = {
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    MARKET_PULSE_DATA_OPENBB_BASE_URL: process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL
  };
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = macroMock.baseUrl;

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const accessToken = await createVerifiedSession(baseUrl);
    const authHeaders = { authorization: `Bearer ${accessToken}` };
    const internalHeaders = { "x-internal-token": "dev-internal-worker-token" };

    const firstDispatch = await requestJson(baseUrl, "/internal/macro-stress/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-20"
      }
    });
    assert.equal(firstDispatch.status, 200);
    assert.ok(["created", "updated"].includes(String(firstDispatch.payload.status)));
    assert.equal(typeof firstDispatch.payload.state, "string");

    const current = await requestJson(baseUrl, "/v1/macro-stress/current", {
      headers: authHeaders
    });
    assert.equal(current.status, 200);
    const currentData = current.payload.data as JsonObject;
    assert.equal(currentData.as_of, "2026-03-20");
    assert.equal(typeof currentData.state, "string");
    assert.equal(typeof currentData.summary, "string");

    const firstHistory = await requestJson(baseUrl, "/v1/macro-stress/history?days=90", {
      headers: authHeaders
    });
    assert.equal(firstHistory.status, 200);
    const firstRows = firstHistory.payload.data as JsonObject[];
    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0]?.as_of, "2026-03-20");

    const legacyDispatch = await requestJson(baseUrl, "/internal/sentiment/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-20"
      }
    });
    assert.equal(legacyDispatch.status, 200);
    assert.equal(typeof legacyDispatch.payload.score, "number");

    const legacyCurrent = await requestJson(baseUrl, "/v1/sentiment/current", {
      headers: authHeaders
    });
    assert.equal(legacyCurrent.status, 200);
    const legacyCurrentData = legacyCurrent.payload.data as JsonObject;
    assert.equal(legacyCurrentData.market_date, "2026-03-20");

    const weekendDispatch = await requestJson(baseUrl, "/internal/macro-stress/dispatch", {
      method: "POST",
      headers: internalHeaders,
      body: {
        market_date: "2026-03-21"
      }
    });
    assert.equal(weekendDispatch.status, 200);
    assert.equal(weekendDispatch.payload.status, "skipped");

    assert.ok(macroMock.requests.length >= 1);
  } finally {
    if (server) {
      await closeServer(server);
    }
    await closeServer(macroMock.server);
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
    process.env.MARKET_PULSE_DATA_OPENBB_BASE_URL = previous.MARKET_PULSE_DATA_OPENBB_BASE_URL;
  }
});

test("internal macro-stress dispatch rejects impossible calendar dates", async () => {
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

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    const response = await requestJson(baseUrl, "/internal/macro-stress/dispatch", {
      method: "POST",
      headers: {
        "x-internal-token": "dev-internal-worker-token"
      },
      body: {
        market_date: "2026-02-30"
      }
    });

    assert.equal(response.status, 422);
    assert.equal(response.payload.error, "validation_failed");
  } finally {
    if (server) {
      await closeServer(server);
    }
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});

test("macro-stress history returns HTTP 200 with empty data when no rows exist", async () => {
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

  let server: Server | undefined;
  try {
    server = startServer(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const accessToken = await createVerifiedSession(baseUrl);
    const response = await requestJson(baseUrl, "/v1/macro-stress/history?days=90", {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.payload, {
      data: []
    });
  } finally {
    if (server) {
      await closeServer(server);
    }
    process.env.STORE_BACKEND = previous.STORE_BACKEND;
    process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
    process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
    process.env.JWT_SECRET = previous.JWT_SECRET;
    process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  }
});
