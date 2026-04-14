import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";

import type { ProductApiConfig } from "./config";

type GoogleJwk = {
  kty?: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwksPayload = {
  keys?: GoogleJwk[];
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
};

type JwksCacheEntry = {
  expiresAtMs: number;
  keysByKid: Map<string, GoogleJwk>;
};

const jwksCache = new Map<string, JwksCacheEntry>();
const defaultJwksCacheMs = 5 * 60 * 1000;

export interface VerifiedGoogleIdToken {
  subject: string;
  email: string;
  emailVerified: boolean;
  issuer: string;
  audience: string | string[];
  issuedAt: number;
  expiresAt: number;
}

export class GoogleOidcVerificationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleOidcVerificationError";
    this.code = code;
  }
}

function decodeBase64Url(value: string): Buffer {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    throw new GoogleOidcVerificationError("token_malformed", "Invalid base64url token segment.");
  }
}

function decodeJsonSegment<T>(value: string): T {
  const decoded = decodeBase64Url(value).toString("utf8");
  try {
    return JSON.parse(decoded) as T;
  } catch {
    throw new GoogleOidcVerificationError("token_malformed", "Invalid JSON token segment.");
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedAudience(
  claimAudience: string | string[],
  allowedClientIds: string[]
): boolean {
  if (typeof claimAudience === "string") {
    return allowedClientIds.includes(claimAudience);
  }
  return claimAudience.some((audience) => allowedClientIds.includes(audience));
}

function parseMaxAgeMillis(cacheControlHeader: string | null): number | undefined {
  if (!cacheControlHeader) {
    return undefined;
  }
  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) {
    return undefined;
  }
  const maxAgeSeconds = match[1];
  if (!maxAgeSeconds) {
    return undefined;
  }
  const seconds = Number.parseInt(maxAgeSeconds, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return seconds * 1000;
}

function cacheKey(config: ProductApiConfig): string {
  if (config.oidcGoogleJwksJson) {
    return `inline:${config.oidcGoogleJwksJson}`;
  }
  return `url:${config.oidcGoogleJwksUrl}`;
}

function normalizeJwksKeys(payload: JwksPayload): Map<string, GoogleJwk> {
  const keysByKid = new Map<string, GoogleJwk>();
  for (const key of payload.keys ?? []) {
    if (!key.kid) {
      continue;
    }
    if (key.kty !== "RSA") {
      continue;
    }
    if (!key.n || !key.e) {
      continue;
    }
    keysByKid.set(key.kid, key);
  }
  return keysByKid;
}

async function fetchJwks(config: ProductApiConfig): Promise<JwksCacheEntry> {
  const cacheId = cacheKey(config);
  const existing = jwksCache.get(cacheId);
  const nowMs = Date.now();
  if (existing && existing.expiresAtMs > nowMs) {
    return existing;
  }

  if (config.oidcGoogleJwksJson) {
    let parsed: JwksPayload;
    try {
      parsed = JSON.parse(config.oidcGoogleJwksJson) as JwksPayload;
    } catch {
      throw new GoogleOidcVerificationError("jwks_invalid", "OIDC_GOOGLE_JWKS_JSON is invalid.");
    }

    const inlineEntry: JwksCacheEntry = {
      expiresAtMs: nowMs + defaultJwksCacheMs,
      keysByKid: normalizeJwksKeys(parsed)
    };
    jwksCache.set(cacheId, inlineEntry);
    return inlineEntry;
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      response = await fetch(config.oidcGoogleJwksUrl, {
        method: "GET",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    throw new GoogleOidcVerificationError("jwks_unreachable", "Could not fetch Google JWKS.");
  }

  if (!response.ok) {
    throw new GoogleOidcVerificationError("jwks_unreachable", "Google JWKS request failed.");
  }

  let payload: JwksPayload;
  try {
    payload = (await response.json()) as JwksPayload;
  } catch {
    throw new GoogleOidcVerificationError("jwks_invalid", "Google JWKS response was not JSON.");
  }

  const maxAgeMs = parseMaxAgeMillis(response.headers.get("cache-control")) ?? defaultJwksCacheMs;
  const nextEntry: JwksCacheEntry = {
    expiresAtMs: nowMs + maxAgeMs,
    keysByKid: normalizeJwksKeys(payload)
  };
  jwksCache.set(cacheId, nextEntry);
  return nextEntry;
}

function assertGoogleClaims(
  claims: JwtPayload,
  config: ProductApiConfig
): VerifiedGoogleIdToken {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const skewSeconds = config.oidcGoogleClockSkewSeconds;

  if (!claims.iss || !config.oidcGoogleIssuers.includes(claims.iss)) {
    throw new GoogleOidcVerificationError("invalid_issuer", "Google token issuer is not allowed.");
  }

  if (!claims.aud || !isAllowedAudience(claims.aud, config.oidcGoogleClientIds)) {
    throw new GoogleOidcVerificationError("invalid_audience", "Google token audience is not allowed.");
  }

  if (typeof claims.exp !== "number" || claims.exp + skewSeconds < nowSeconds) {
    throw new GoogleOidcVerificationError("expired_token", "Google token is expired.");
  }

  if (typeof claims.iat !== "number" || claims.iat - skewSeconds > nowSeconds) {
    throw new GoogleOidcVerificationError("invalid_iat", "Google token issued-at is invalid.");
  }

  if (typeof claims.sub !== "string" || claims.sub.trim().length === 0) {
    throw new GoogleOidcVerificationError("invalid_subject", "Google token subject is missing.");
  }

  if (typeof claims.email !== "string" || !isValidEmail(claims.email)) {
    throw new GoogleOidcVerificationError("invalid_email", "Google token email claim is invalid.");
  }

  const emailVerified =
    claims.email_verified === true ||
    (typeof claims.email_verified === "string" && claims.email_verified.toLowerCase() === "true");
  if (!emailVerified) {
    throw new GoogleOidcVerificationError(
      "email_not_verified",
      "Google account email must be verified."
    );
  }

  return {
    subject: claims.sub.trim(),
    email: claims.email.trim().toLowerCase(),
    emailVerified,
    issuer: claims.iss,
    audience: claims.aud,
    issuedAt: claims.iat,
    expiresAt: claims.exp
  };
}

export async function verifyGoogleIdToken(
  config: ProductApiConfig,
  idToken: string
): Promise<VerifiedGoogleIdToken> {
  const token = idToken.trim();
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new GoogleOidcVerificationError("token_malformed", "Google token must have 3 segments.");
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments;
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new GoogleOidcVerificationError("token_malformed", "Google token must have 3 segments.");
  }

  const header = decodeJsonSegment<JwtHeader>(headerSegment);
  if (header.alg !== "RS256") {
    throw new GoogleOidcVerificationError("unsupported_alg", "Google token must use RS256.");
  }
  if (!header.kid) {
    throw new GoogleOidcVerificationError("missing_kid", "Google token header is missing kid.");
  }

  const claims = decodeJsonSegment<JwtPayload>(payloadSegment);
  const jwks = await fetchJwks(config);
  const jwk = jwks.keysByKid.get(header.kid);
  if (!jwk) {
    throw new GoogleOidcVerificationError("key_not_found", "Google token key was not found.");
  }
  if (!jwk.kid || !jwk.n || !jwk.e) {
    throw new GoogleOidcVerificationError("key_not_found", "Google token key was incomplete.");
  }

  const signingInput = Buffer.from(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64Url(signatureSegment);

  let signatureValid = false;
  try {
    const key: JsonWebKey = {
      kty: "RSA",
      kid: jwk.kid,
      n: jwk.n,
      e: jwk.e
    };
    const publicKey = createPublicKey({
      key,
      format: "jwk"
    });
    signatureValid = verifySignature("RSA-SHA256", signingInput, publicKey, signature);
  } catch {
    throw new GoogleOidcVerificationError("invalid_signature", "Google token signature is invalid.");
  }

  if (!signatureValid) {
    throw new GoogleOidcVerificationError("invalid_signature", "Google token signature is invalid.");
  }

  return assertGoogleClaims(claims, config);
}
