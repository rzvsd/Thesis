// Token helpers: GoTrue session -> old AuthTokensResponse, our code tags, opaque tokens.
import type { GoTrueSession, VerifyType } from "./gotrue.ts";

// Same fields as packages/contracts AuthTokensResponse and old issueTokens.
export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  access_token_expires_at: string;
  refresh_token_expires_at: string;
}

export function mapSession(
  s: GoTrueSession,
  refreshTtlSeconds: number,
  now = new Date(),
): AuthTokensResponse {
  const accessExp = typeof s.expires_at === "number"
    ? new Date(s.expires_at * 1000)
    : new Date(now.getTime() + (typeof s.expires_in === "number" ? s.expires_in : 3600) * 1000);
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    token_type: "Bearer",
    access_token_expires_at: accessExp.toISOString(),
    refresh_token_expires_at: new Date(now.getTime() + refreshTtlSeconds * 1000).toISOString(),
  };
}

// The code a user types is a Supabase token hash with a short tag in front, so the server knows the
// GoTrue verify type without an email. The Supabase email templates print the same tag before {{ .TokenHash }}.
//   v1s.  signup confirmation  -> verify type "signup"     (/auth/verify)
//   v1m.  magic link (fallback) -> verify type "magiclink" (/auth/verify)
//   v1r.  password recovery     -> verify type "recovery"  (/auth/password-reset/confirm)
//   v1d.  account deletion      -> verify type "magiclink" (/auth/delete-account/confirm)
export type CodeTag = "v1s" | "v1m" | "v1r" | "v1d";

export const TAG_TYPES: Record<CodeTag, VerifyType> = {
  v1s: "signup",
  v1m: "magiclink",
  v1r: "recovery",
  v1d: "magiclink",
};

export function tagCode(tag: CodeTag, tokenHash: string): string {
  return `${tag}.${tokenHash}`;
}

const HASH_RE = /^[A-Za-z0-9_-]{8,200}$/;

// Returns the tag (or null when untagged) and the token hash, or undefined when the code is malformed.
export function parseCode(code: string): { tag: CodeTag | null; hash: string } | undefined {
  const trimmed = code.trim();
  const m = /^(v1[smrd])\.(.+)$/.exec(trimmed);
  const tag = m ? (m[1] as CodeTag) : null;
  const hash = m ? m[2] : trimmed;
  if (!HASH_RE.test(hash)) return undefined;
  return { tag, hash };
}

export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Same as old security.ts createOpaqueToken / hashOpaqueToken.
export function createOpaqueToken(sizeBytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(sizeBytes)));
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function secondsUntilIso(isoTimestamp: string, nowMs = Date.now()): number {
  const t = Date.parse(isoTimestamp);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - nowMs) / 1000));
}
