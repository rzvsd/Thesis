// Google OAuth access token for FCM, from a service account, with WebCrypto only (no firebase-admin).
// Flow: sign a JWT (RS256) with the service account key, trade it at oauth2.googleapis.com for an access token.
// The token is cached per isolate until a minute before it expires.

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Parses FCM_SERVICE_ACCOUNT_JSON. Undefined when missing or malformed. Never logs the value.
export function parseServiceAccount(raw: string | undefined): ServiceAccount | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectId = parsed.project_id;
    const clientEmail = parsed.client_email;
    const privateKey = parsed.private_key;
    if (typeof projectId !== "string" || typeof clientEmail !== "string" || typeof privateKey !== "string") {
      return undefined;
    }
    const tokenUri = typeof parsed.token_uri === "string" ? parsed.token_uri : DEFAULT_TOKEN_URI;
    return { projectId, clientEmail, privateKey, tokenUri };
  } catch {
    return undefined;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function signServiceAccountJwt(
  account: ServiceAccount,
  nowSeconds: number,
  scope = FCM_SCOPE,
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.clientEmail,
    scope,
    aud: account.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

export interface AccessTokenSource {
  get(): Promise<string>;
}

export function serviceAccountTokenSource(
  account: ServiceAccount,
  fetchFn: FetchLike = fetch,
  now: () => number = Date.now,
): AccessTokenSource {
  let cached: { token: string; expiresAt: number } | undefined;
  return {
    async get() {
      if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
      const assertion = await signServiceAccountJwt(account, Math.floor(now() / 1000));
      const res = await fetchFn(account.tokenUri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`Google token exchange failed with HTTP ${res.status}`);
      }
      const body = await res.json() as { access_token?: unknown; expires_in?: unknown };
      if (typeof body.access_token !== "string") throw new Error("Google token response has no access_token");
      const ttl = typeof body.expires_in === "number" ? body.expires_in : 3600;
      cached = { token: body.access_token, expiresAt: now() + ttl * 1000 };
      return cached.token;
    },
  };
}
