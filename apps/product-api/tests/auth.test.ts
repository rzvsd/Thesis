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

test("auth lifecycle supports register -> verify -> login -> refresh -> logout", async () => {
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

  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m4-auth@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(register.status, 201);
  const verificationToken = register.payload.verification_token;
  assert.equal(typeof verificationToken, "string");

  const loginBeforeVerify = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "m4-auth@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(loginBeforeVerify.status, 401);

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
      email: "m4-auth@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const accessToken = login.payload.access_token;
  const refreshToken = login.payload.refresh_token;
  assert.equal(typeof accessToken, "string");
  assert.equal(typeof refreshToken, "string");

  const refresh = await requestJson(baseUrl, "/auth/refresh", {
    method: "POST",
    body: {
      refresh_token: refreshToken as string
    }
  });
  assert.equal(refresh.status, 200);
  assert.equal(typeof refresh.payload.access_token, "string");

  const logout = await requestJson(baseUrl, "/auth/logout", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken as string}`
    }
  });
  assert.equal(logout.status, 200);

  const refreshAfterLogout = await requestJson(baseUrl, "/auth/refresh", {
    method: "POST",
    body: {
      refresh_token: refreshToken as string
    }
  });
  assert.equal(refreshAfterLogout.status, 401);

  await closeServer(server);
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
});
