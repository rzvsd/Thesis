import assert from "node:assert/strict";
import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { startServer } from "../src/server";

type JsonObject = Record<string, unknown>;
type LinkPolicy = "BLOCK_UNLINKED" | "AUTO_LINK_VERIFIED_EMAIL";

const googleIssuer = "https://accounts.google.com";
const googleAudience = "test-google-client-id";
const googleKid = "m5-google-test-kid";
const { publicKey: googlePublicKey, privateKey: googlePrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048
});
const googleJwk = googlePublicKey.export({ format: "jwk" }) as Record<string, unknown>;
if (typeof googleJwk.n !== "string" || typeof googleJwk.e !== "string") {
  throw new Error("Failed to export RSA public key as JWK.");
}
const googleJwksJson = JSON.stringify({
  keys: [
    {
      kty: "RSA",
      kid: googleKid,
      alg: "RS256",
      use: "sig",
      n: googleJwk.n,
      e: googleJwk.e
    }
  ]
});

const envKeys = [
  "NODE_ENV",
  "STORE_BACKEND",
  "QUEUE_BACKEND",
  "AUTH_EXPOSE_VERIFICATION_TOKEN",
  "JWT_SECRET",
  "INTERNAL_WORKER_TOKEN",
  "OIDC_GOOGLE_ENABLED",
  "OIDC_GOOGLE_CLIENT_IDS",
  "OIDC_GOOGLE_ISSUERS",
  "OIDC_GOOGLE_JWKS_JSON",
  "OIDC_GOOGLE_JWKS_URL",
  "OIDC_GOOGLE_LINK_POLICY",
  "ADMIN_BOOTSTRAP_ENABLED",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD_HASH",
  "ADMIN_BOOTSTRAP_AUTO_VERIFY",
  "ADMIN_BOOTSTRAP_FORCE_PRO"
] as const;

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

function captureEnv(): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

async function startOidcServer(
  linkPolicy: LinkPolicy = "BLOCK_UNLINKED"
): Promise<{
  server: ReturnType<typeof startServer>;
  baseUrl: string;
  previousEnv: Record<string, string | undefined>;
}> {
  const previousEnv = captureEnv();
  process.env.NODE_ENV = "test";
  process.env.STORE_BACKEND = "memory";
  process.env.QUEUE_BACKEND = "memory";
  process.env.AUTH_EXPOSE_VERIFICATION_TOKEN = "true";
  process.env.JWT_SECRET = "dev-jwt-secret-change-me";
  process.env.INTERNAL_WORKER_TOKEN = "dev-internal-worker-token";
  process.env.OIDC_GOOGLE_ENABLED = "true";
  process.env.OIDC_GOOGLE_CLIENT_IDS = googleAudience;
  process.env.OIDC_GOOGLE_ISSUERS = googleIssuer;
  process.env.OIDC_GOOGLE_JWKS_JSON = googleJwksJson;
  process.env.OIDC_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
  process.env.OIDC_GOOGLE_LINK_POLICY = linkPolicy;
  delete process.env.ADMIN_BOOTSTRAP_ENABLED;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
  delete process.env.ADMIN_BOOTSTRAP_AUTO_VERIFY;
  delete process.env.ADMIN_BOOTSTRAP_FORCE_PRO;

  const server = startServer(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    previousEnv
  };
}

function encodeJwtSegment(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function createGoogleIdToken(input: {
  subject: string;
  email: string;
  issuer?: string;
  audience?: string | string[];
  issuedAt?: number;
  expiresAt?: number;
  emailVerified?: boolean;
  kid?: string;
}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = encodeJwtSegment({
    alg: "RS256",
    kid: input.kid ?? googleKid,
    typ: "JWT"
  });
  const payload = encodeJwtSegment({
    iss: input.issuer ?? googleIssuer,
    aud: input.audience ?? googleAudience,
    exp: input.expiresAt ?? nowSeconds + 600,
    iat: input.issuedAt ?? nowSeconds - 5,
    sub: input.subject,
    email: input.email,
    email_verified: input.emailVerified ?? true
  });
  const signingInput = `${header}.${payload}`;
  const signature = signBytes("RSA-SHA256", Buffer.from(signingInput), googlePrivateKey).toString(
    "base64url"
  );
  return `${signingInput}.${signature}`;
}

async function createPasswordSession(baseUrl: string, email: string, password: string): Promise<{
  accessToken: string;
}> {
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
  const accessToken = login.payload.access_token;
  assert.equal(typeof accessToken, "string");
  return {
    accessToken: accessToken as string
  };
}

test("M5 Google OIDC creates new user and supports linked sign-in", async () => {
  const runtime = await startOidcServer("BLOCK_UNLINKED");
  try {
    const token = createGoogleIdToken({
      subject: "google-sub-new-user",
      email: "m5-google-new-user@example.com"
    });

    const first = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: { id_token: token }
    });
    assert.equal(first.status, 200);
    assert.equal(typeof first.payload.access_token, "string");

    const second = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: { id_token: token }
    });
    assert.equal(second.status, 200);
    assert.equal(typeof second.payload.refresh_token, "string");

    const profile = await requestJson(runtime.baseUrl, "/v1/user/profile", {
      method: "GET",
      headers: {
        authorization: `Bearer ${String(second.payload.access_token)}`
      }
    });
    assert.equal(profile.status, 200);
    const profileData = profile.payload.data as JsonObject;
    assert.equal(profileData.email, "m5-google-new-user@example.com");
  } finally {
    await closeServer(runtime.server);
    restoreEnv(runtime.previousEnv);
  }
});

test("M5 Google OIDC blocks unlinked existing password account with BLOCK_UNLINKED", async () => {
  const runtime = await startOidcServer("BLOCK_UNLINKED");
  try {
    await createPasswordSession(
      runtime.baseUrl,
      "m5-google-blocked@example.com",
      "VeryStrongPass1!"
    );

    const googleAttempt = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: {
        id_token: createGoogleIdToken({
          subject: "google-sub-blocked",
          email: "m5-google-blocked@example.com"
        })
      }
    });
    assert.equal(googleAttempt.status, 409);
    assert.equal(googleAttempt.payload.error, "google_link_required");
  } finally {
    await closeServer(runtime.server);
    restoreEnv(runtime.previousEnv);
  }
});

test("M5 Google explicit link endpoint links account and enables OIDC sign-in", async () => {
  const runtime = await startOidcServer("BLOCK_UNLINKED");
  try {
    const session = await createPasswordSession(
      runtime.baseUrl,
      "m5-google-link@example.com",
      "VeryStrongPass1!"
    );
    const idToken = createGoogleIdToken({
      subject: "google-sub-link",
      email: "m5-google-link@example.com"
    });

    const blocked = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: { id_token: idToken }
    });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.payload.error, "google_link_required");

    const link = await requestJson(runtime.baseUrl, "/auth/google/link", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.accessToken}`
      },
      body: { id_token: idToken }
    });
    assert.equal(link.status, 200);
    assert.equal(link.payload.status, "linked");

    const googleLogin = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: { id_token: idToken }
    });
    assert.equal(googleLogin.status, 200);
    assert.equal(typeof googleLogin.payload.access_token, "string");
  } finally {
    await closeServer(runtime.server);
    restoreEnv(runtime.previousEnv);
  }
});

test("M5 Google OIDC rejects invalid and expired tokens", async () => {
  const runtime = await startOidcServer("BLOCK_UNLINKED");
  try {
    const invalidIssuer = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: {
        id_token: createGoogleIdToken({
          subject: "google-sub-invalid-iss",
          email: "m5-google-invalid@example.com",
          issuer: "https://evil.example.com"
        })
      }
    });
    assert.equal(invalidIssuer.status, 401);
    assert.equal(invalidIssuer.payload.error, "google_token_invalid");
    assert.equal(invalidIssuer.payload.error_code, "invalid_issuer");

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expired = await requestJson(runtime.baseUrl, "/auth/google", {
      method: "POST",
      body: {
        id_token: createGoogleIdToken({
          subject: "google-sub-expired",
          email: "m5-google-expired@example.com",
          issuedAt: nowSeconds - 7200,
          expiresAt: nowSeconds - 3600
        })
      }
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.payload.error, "google_token_invalid");
    assert.equal(expired.payload.error_code, "expired_token");
  } finally {
    await closeServer(runtime.server);
    restoreEnv(runtime.previousEnv);
  }
});
