// Auth guard. Deny by default (H3): every route declares its auth mode, and the guard runs before the handler.
//   none     - public route (login, register, health, web pages)
//   user     - needs a valid Supabase Auth access token (Authorization: Bearer <token>)
//   internal - needs the internal token in x-internal-token (runner, scheduled jobs)
//   webhook  - the feature module checks its own signature (RevenueCat); the guard only lets it through
import { env } from "./env.ts";

export type AuthMode = "none" | "user" | "internal" | "webhook";

export interface AuthContext {
  mode: AuthMode;
  userId: string | null;
  accessToken: string | null;
}

export type AuthResult = { ok: true; ctx: AuthContext } | {
  ok: false;
  status: number;
  error: string;
  message: string;
};

export type UserVerifier = (accessToken: string) => Promise<string | null>;

// Asks Supabase Auth who owns the token. Returns the auth user id, or null.
export const supabaseUserVerifier: UserVerifier = async (accessToken) => {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const body = await res.json() as { id?: unknown };
  return typeof body.id === "string" ? body.id : null;
};

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

export async function authorize(
  req: Request,
  mode: AuthMode,
  verifyUser: UserVerifier = supabaseUserVerifier,
): Promise<AuthResult> {
  const token = bearer(req);
  if (mode === "none" || mode === "webhook") {
    return { ok: true, ctx: { mode, userId: null, accessToken: token } };
  }
  if (mode === "internal") {
    const expected = env("INTERNAL_API_TOKEN");
    const given = req.headers.get("x-internal-token") ?? "";
    if (!expected || !given || !timingSafeEqual(given, expected)) {
      return { ok: false, status: 401, error: "unauthorized", message: "Internal token mismatch." };
    }
    return { ok: true, ctx: { mode, userId: null, accessToken: null } };
  }
  if (mode === "user") {
    if (!token) return { ok: false, status: 401, error: "unauthorized", message: "Missing access token." };
    const userId = await verifyUser(token);
    if (!userId) {
      return { ok: false, status: 401, error: "unauthorized", message: "Invalid or expired access token." };
    }
    return { ok: true, ctx: { mode, userId, accessToken: token } };
  }
  return { ok: false, status: 500, error: "internal_error", message: "Unknown auth mode." };
}
