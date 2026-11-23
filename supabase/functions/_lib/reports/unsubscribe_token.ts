// Signed email unsubscribe tokens. Owner: M1. Ported from apps/product-api/src/filing-change-alerts.ts.
// Format: base64url(userId) + "." + base64url(HMAC-SHA256(secret, "email-unsubscribe:" + userId)).
// The secret is EMAIL_LINK_SECRET. Set it to the old server's JWT_SECRET so links in old emails keep working.
// Emails from M3 (Pulse, digests) and M4 (filing alerts) build links with unsubscribeUrl(userId).
import { env } from "../../_shared/env.ts";
import { timingSafeEqual } from "../../_shared/auth.ts";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | undefined {
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

async function signature(secret: string, userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`email-unsubscribe:${userId}`));
  return toBase64Url(new Uint8Array(sig));
}

function linkSecret(secret?: string): string | undefined {
  return secret ?? env("EMAIL_LINK_SECRET");
}

// Returns undefined when EMAIL_LINK_SECRET is not set.
export async function signUnsubscribeToken(userId: string, secret?: string): Promise<string | undefined> {
  const key = linkSecret(secret);
  if (!key) return undefined;
  return `${toBase64Url(encoder.encode(userId))}.${await signature(key, userId)}`;
}

export async function verifyUnsubscribeToken(token: string, secret?: string): Promise<string | undefined> {
  const key = linkSecret(secret);
  if (!key) return undefined;
  const [encodedUserId, sig] = token.split(".");
  if (!encodedUserId || !sig) return undefined;
  const userId = fromBase64Url(encodedUserId);
  if (userId === undefined) return undefined;
  const expected = await signature(key, userId);
  return timingSafeEqual(expected, sig) ? userId : undefined;
}

// Full link for emails: `${PUBLIC_API_BASE_URL}/v1/email/unsubscribe?token=...`, or undefined when either
// PUBLIC_API_BASE_URL or EMAIL_LINK_SECRET is unset (the old server then left the link out).
export async function unsubscribeUrl(userId: string): Promise<string | undefined> {
  const base = env("PUBLIC_API_BASE_URL")?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  const token = await signUnsubscribeToken(userId);
  return token ? `${base}/v1/email/unsubscribe?token=${token}` : undefined;
}
