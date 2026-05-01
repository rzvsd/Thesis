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
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "test";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "production-jwt-secret-for-auth-test";
  process.env.INTERNAL_WORKER_TOKEN = "production-internal-worker-token-for-auth-test";
  delete process.env.ADMIN_BOOTSTRAP_ENABLED;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  delete process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  delete process.env.ADMIN_BOOTSTRAP_FORCE_PRO;

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
  let accessToken = login.payload.access_token;
  let refreshToken = login.payload.refresh_token;
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
  assert.equal(typeof refresh.payload.refresh_token, "string");
  accessToken = refresh.payload.access_token;
  refreshToken = refresh.payload.refresh_token;

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
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});

test("refresh reuse detection revokes the token family", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "test";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  delete process.env.ADMIN_BOOTSTRAP_ENABLED;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  delete process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  delete process.env.ADMIN_BOOTSTRAP_FORCE_PRO;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m3-refresh-reuse@example.com",
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
      email: "m3-refresh-reuse@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(login.status, 200);
  const originalRefreshToken = login.payload.refresh_token;
  assert.equal(typeof originalRefreshToken, "string");

  const rotated = await requestJson(baseUrl, "/auth/refresh", {
    method: "POST",
    body: {
      refresh_token: originalRefreshToken as string
    }
  });
  assert.equal(rotated.status, 200);
  const rotatedRefreshToken = rotated.payload.refresh_token;
  assert.equal(typeof rotatedRefreshToken, "string");

  const reused = await requestJson(baseUrl, "/auth/refresh", {
    method: "POST",
    body: {
      refresh_token: originalRefreshToken as string
    }
  });
  assert.equal(reused.status, 401);
  assert.equal(reused.payload.error, "refresh_failed");

  const afterFamilyRevoke = await requestJson(baseUrl, "/auth/refresh", {
    method: "POST",
    body: {
      refresh_token: rotatedRefreshToken as string
    }
  });
  assert.equal(afterFamilyRevoke.status, 401);
  assert.equal(afterFamilyRevoke.payload.error, "refresh_failed");

  await closeServer(server);
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});

test("lockout enforces 10-fail style policy with auto-unlock window", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    AUTH_LOCKOUT_MAX_FAILURES: process.env.AUTH_LOCKOUT_MAX_FAILURES,
    AUTH_LOCKOUT_WINDOW_SECONDS: process.env.AUTH_LOCKOUT_WINDOW_SECONDS,
    AUTH_LOCKOUT_DURATION_SECONDS: process.env.AUTH_LOCKOUT_DURATION_SECONDS,
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "test";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.AUTH_LOCKOUT_MAX_FAILURES = "3";
  process.env.AUTH_LOCKOUT_WINDOW_SECONDS = "60";
  process.env.AUTH_LOCKOUT_DURATION_SECONDS = "1";
  process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS = "30";
  delete process.env.ADMIN_BOOTSTRAP_ENABLED;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  delete process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  delete process.env.ADMIN_BOOTSTRAP_FORCE_PRO;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const register = await requestJson(baseUrl, "/auth/register", {
    method: "POST",
    body: {
      email: "m3-lockout@example.com",
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

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const failure = await requestJson(baseUrl, "/auth/login", {
      method: "POST",
      body: {
        email: "m3-lockout@example.com",
        password: "WrongPassword1!"
      }
    });
    assert.equal(failure.status, 401);
  }

  const lockoutTrigger = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "m3-lockout@example.com",
      password: "WrongPassword1!"
    }
  });
  assert.equal(lockoutTrigger.status, 423);
  assert.equal(lockoutTrigger.payload.error, "account_locked");

  const lockedCorrectPassword = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "m3-lockout@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(lockedCorrectPassword.status, 423);
  assert.equal(lockedCorrectPassword.payload.error, "account_locked");

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const loginAfterUnlock = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "m3-lockout@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(loginAfterUnlock.status, 200);
  assert.equal(typeof loginAfterUnlock.payload.access_token, "string");

  await closeServer(server);
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.AUTH_LOCKOUT_MAX_FAILURES = previous.AUTH_LOCKOUT_MAX_FAILURES;
  process.env.AUTH_LOCKOUT_WINDOW_SECONDS = previous.AUTH_LOCKOUT_WINDOW_SECONDS;
  process.env.AUTH_LOCKOUT_DURATION_SECONDS = previous.AUTH_LOCKOUT_DURATION_SECONDS;
  process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS = previous.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});

test("auth routes apply stricter route-specific limits than general routes", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS: process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "test";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.RATE_LIMIT_MAX_REQUESTS = "100";
  process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
  process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = "60";
  process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS = "2";
  delete process.env.ADMIN_BOOTSTRAP_ENABLED;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  delete process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  delete process.env.ADMIN_BOOTSTRAP_FORCE_PRO;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const loginAttempt = await requestJson(baseUrl, "/auth/login", {
      method: "POST",
      body: {
        email: "route-limit@example.com",
        password: "VeryStrongPass1!"
      }
    });
    assert.equal(loginAttempt.status, 401);
  }

  const loginLimited = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "route-limit@example.com",
      password: "VeryStrongPass1!"
    }
  });
  assert.equal(loginLimited.status, 429);

  const genericRoute = await requestJson(baseUrl, "/jobs", {
    method: "POST",
    body: {
      ticker: "AAPL"
    }
  });
  assert.equal(genericRoute.status, 401);

  await closeServer(server);
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.RATE_LIMIT_MAX_REQUESTS = previous.RATE_LIMIT_MAX_REQUESTS;
  process.env.RATE_LIMIT_WINDOW_SECONDS = previous.RATE_LIMIT_WINDOW_SECONDS;
  process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = previous.AUTH_RATE_LIMIT_WINDOW_SECONDS;
  process.env.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS = previous.AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});

test("admin bootstrap creates verified pro user for non-production login", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "development";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "false";
  process.env.JWT_SECRET = "production-jwt-secret-for-auth-test";
  process.env.INTERNAL_WORKER_TOKEN = "production-internal-worker-token-for-auth-test";
  process.env.ADMIN_BOOTSTRAP_ENABLED = "true";
  process.env.ADMIN_BOOTSTRAP_EMAIL = "builder@example.com";
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH =
    "$2a$12$y7qTn4TtWvaOFr1iJB0eauN024sJFu0giXzoa0a7b58iANgkTcFi.";
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = "true";
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = "true";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "builder@example.com",
      password: "BuilderPass1!"
    }
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.payload.access_token, "string");

  const profile = await requestJson(baseUrl, "/v1/user/profile", {
    method: "GET",
    headers: {
      authorization: `Bearer ${String(login.payload.access_token)}`
    }
  });
  assert.equal(profile.status, 200);
  const profileData = profile.payload.data as JsonObject;
  assert.equal(profileData.tier, "PRO");

  await closeServer(server);
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});

test("admin bootstrap is ignored in production", async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STORE_BACKEND: process.env.STORE_BACKEND,
    QUEUE_BACKEND: process.env.QUEUE_BACKEND,
    AUTH_EXPOSE_VERIFICATION_TOKEN: process.env.AUTH_EXPOSE_VERIFICATION_TOKEN,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_WORKER_TOKEN: process.env.INTERNAL_WORKER_TOKEN,
    ADMIN_BOOTSTRAP_ENABLED: process.env.ADMIN_BOOTSTRAP_ENABLED,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
    ADMIN_BOOTSTRAP_AUTO_VERIFY: process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY,
    ADMIN_BOOTSTRAP_FORCE_PRO: process.env.ADMIN_BOOTSTRAP_FORCE_PRO
  };
  process.env.NODE_ENV = "production";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "false";
  process.env.JWT_SECRET = "production-jwt-secret-for-auth-test";
  process.env.INTERNAL_WORKER_TOKEN = "production-internal-worker-token-for-auth-test";
  process.env.ADMIN_BOOTSTRAP_ENABLED = "true";
  process.env.ADMIN_BOOTSTRAP_EMAIL = "builder@example.com";
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH =
    "$2a$12$y7qTn4TtWvaOFr1iJB0eauN024sJFu0giXzoa0a7b58iANgkTcFi.";
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = "true";
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = "true";

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const login = await requestJson(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      email: "builder@example.com",
      password: "BuilderPass1!"
    }
  });
  assert.equal(login.status, 401);

  await closeServer(server);
  process.env.NODE_ENV = previous.NODE_ENV;
  process.env.STORE_BACKEND = previous.STORE_BACKEND;
  process.env.QUEUE_BACKEND = previous.QUEUE_BACKEND;
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = previous.AUTH_EXPOSE_VERIFICATION_TOKEN;
  process.env.JWT_SECRET = previous.JWT_SECRET;
  process.env.INTERNAL_WORKER_TOKEN = previous.INTERNAL_WORKER_TOKEN;
  process.env.ADMIN_BOOTSTRAP_ENABLED = previous.ADMIN_BOOTSTRAP_ENABLED;
  process.env.ADMIN_BOOTSTRAP_EMAIL = previous.ADMIN_BOOTSTRAP_EMAIL;
  process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = previous.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY = previous.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  process.env.ADMIN_BOOTSTRAP_FORCE_PRO = previous.ADMIN_BOOTSTRAP_FORCE_PRO;
});
