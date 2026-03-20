import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { compare, hash } from "bcryptjs";

export interface AuthTokenClaims {
  sub: string;
  sid: string;
  typ: "access" | "refresh";
  iat: number;
  exp: number;
}

interface TokenHeader {
  alg: "HS256";
  typ: "JWT";
}

function toBase64Url(value: Buffer | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf-8") : value;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const padding = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return Buffer.from(normalized, "base64");
}

export function hashPassword(password: string, cost: number): Promise<string> {
  return hash(password, cost);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export function createOpaqueToken(length: number = 32): string {
  return toBase64Url(randomBytes(length));
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createId(): string {
  return randomUUID();
}

export function signAuthToken(
  input: Omit<AuthTokenClaims, "iat" | "exp">,
  ttlSeconds: number,
  secret: string
): { token: string; expiresAt: string; claims: AuthTokenClaims } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const claims: AuthTokenClaims = {
    ...input,
    iat: issuedAt,
    exp: expiresAt
  };
  const header: TokenHeader = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const token = `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
  return {
    token,
    claims,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

export function verifyAuthToken(token: string, secret: string): AuthTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const expected = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const provided = fromBase64Url(encodedSignature);
  if (provided.length !== expected.length || !expected.equals(provided)) {
    return null;
  }

  let claims: AuthTokenClaims;
  try {
    claims = JSON.parse(fromBase64Url(encodedPayload).toString("utf-8")) as AuthTokenClaims;
  } catch {
    return null;
  }

  if (!claims.sub || !claims.sid || !claims.typ || !claims.exp || !claims.iat) {
    return null;
  }

  if (!["access", "refresh"].includes(claims.typ)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    return null;
  }

  return claims;
}
