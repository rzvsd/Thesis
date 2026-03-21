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
  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m5-search@example.com",
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
      email: "m5-search@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const token = login.payload.access_token;
  assert.equal(typeof token, "string");
  return token as string;
}

test("ticker search endpoint enforces auth and returns supported symbols", async () => {
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

  const unauthorized = await requestJson(baseUrl, "/tickers/search?q=AAPL");
  assert.equal(unauthorized.status, 401);

  const accessToken = await createVerifiedSession(baseUrl);
  const headers = { authorization: `Bearer ${accessToken}` };

  const found = await requestJson(baseUrl, "/tickers/search?q=AAPL", {
    headers
  });
  assert.equal(found.status, 200);
  const foundPayload = found.payload.data as JsonObject[];
  assert.ok(Array.isArray(foundPayload));
  assert.equal(foundPayload[0]?.symbol, "AAPL");

  const missing = await requestJson(baseUrl, "/tickers/search?q=ZZZZZZ", {
    headers
  });
  assert.equal(missing.status, 404);

  const unsupportedJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers,
    body: {
      ticker: "ZZZZZZ"
    }
  });
  assert.equal(unsupportedJob.status, 404);

  const supportedJob = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    headers,
    body: {
      ticker: "AAPL"
    }
  });
  assert.equal(supportedJob.status, 202);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});
