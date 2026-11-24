// Small fetch-based client for Supabase Auth (GoTrue REST at ${SUPABASE_URL}/auth/v1). Owner: M1 (DECISIONS D6).
// Public calls use the anon key. /admin calls use the service role key. fetch is injectable for tests.
// Never log request bodies, emails or tokens from here (N10).
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../../_shared/env.ts";
import { logError } from "../../_shared/log.ts";

// Supabase Auth rate-limits /token and /verify per caller IP. Every call comes from this function, so without
// forwarding, all users would share one bucket. With a secret API key (AUTH_SUPABASE_SECRET_KEY, "sb_secret_...";
// Supabase refuses custom secret names that start with SUPABASE_)
// and "IP address forwarding" on in Authentication > Rate Limits, we send the end user's IP as sb-forwarded-for.
// Legacy anon/service_role keys do not support forwarding, so without the secret key nothing changes.
const clientIpStore = new AsyncLocalStorage<string>();

export function withClientIp<T>(ip: string, fn: () => T): T {
  return clientIpStore.run(ip, fn);
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface GoTrueUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
}

export interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number; // unix seconds
  user?: GoTrueUser;
}

export interface GoTrueLink {
  user: GoTrueUser;
  hashedToken: string;
  verificationType?: string;
}

export type GoTrueError = { ok: false; status: number; code: string; message: string };
export type GoTrueResult<T> = { ok: true; data: T } | GoTrueError;

// Email OTP types accepted by POST /verify with a token_hash.
export type VerifyType = "signup" | "magiclink" | "recovery" | "invite" | "email";
export type LinkType = "signup" | "magiclink" | "recovery";

export interface GoTrueOptions {
  url?: string;
  anonKey?: string;
  serviceKey?: string;
  secretKey?: string;
  fetch?: FetchFn;
  timeoutMs?: number;
}

type KeyKind = "anon" | "service";

export class GoTrueClient {
  private readonly base: string | undefined;
  private readonly anonKey: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly serviceKey: string | undefined;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(opts: GoTrueOptions = {}) {
    const url = opts.url ?? env("SUPABASE_URL");
    this.base = url ? `${url.replace(/\/+$/, "")}/auth/v1` : undefined;
    this.secretKey = opts.secretKey !== undefined ? usableKey(opts.secretKey) : secretKeyFromEnv();
    this.anonKey = opts.anonKey ?? this.secretKey ?? env("SUPABASE_ANON_KEY");
    this.serviceKey = opts.serviceKey ?? env("SUPABASE_SERVICE_ROLE_KEY");
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  // ---- public (anon key) ----

  passwordGrant(email: string, password: string): Promise<GoTrueResult<GoTrueSession>> {
    return this.call("POST", "/token?grant_type=password", "anon", { email, password });
  }

  refreshGrant(refreshToken: string): Promise<GoTrueResult<GoTrueSession>> {
    return this.call("POST", "/token?grant_type=refresh_token", "anon", { refresh_token: refreshToken });
  }

  logout(accessToken: string, scope: "local" | "global" | "others" = "local"): Promise<GoTrueResult<null>> {
    return this.call("POST", `/logout?scope=${scope}`, "anon", undefined, accessToken);
  }

  getUser(accessToken: string): Promise<GoTrueResult<GoTrueUser>> {
    return this.call("GET", "/user", "anon", undefined, accessToken);
  }

  updateUser(accessToken: string, attrs: { password?: string }): Promise<GoTrueResult<GoTrueUser>> {
    return this.call("PUT", "/user", "anon", attrs, accessToken);
  }

  verify(type: VerifyType, tokenHash: string): Promise<GoTrueResult<GoTrueSession>> {
    return this.call("POST", "/verify", "anon", { type, token_hash: tokenHash });
  }

  // The short email code ({{ .Token }}) with the address it went to (audit V3).
  verifyOtp(type: VerifyType, email: string, token: string): Promise<GoTrueResult<GoTrueSession>> {
    return this.call("POST", "/verify", "anon", { type, email, token: token.trim() });
  }

  // Sends Supabase's "Reset Password" email.
  recover(email: string): Promise<GoTrueResult<null>> {
    return this.call("POST", "/recover", "anon", { email });
  }

  // Sends Supabase's "Confirm signup" email again (new confirmation token).
  resend(type: "signup", email: string): Promise<GoTrueResult<null>> {
    return this.call("POST", "/resend", "anon", { type, email });
  }

  // Sends Supabase's "Magic Link" email. create_user false: never creates an account.
  otp(email: string): Promise<GoTrueResult<null>> {
    return this.call("POST", "/otp", "anon", { email, create_user: false });
  }

  // ---- admin (service role key) ----

  adminCreateUser(attrs: {
    email: string;
    password: string;
    email_confirm?: boolean;
    app_metadata?: Record<string, unknown>;
  }): Promise<GoTrueResult<GoTrueUser>> {
    return this.call("POST", "/admin/users", "service", attrs);
  }

  adminUpdateUser(
    id: string,
    attrs: { password?: string; email_confirm?: boolean; app_metadata?: Record<string, unknown> },
  ): Promise<GoTrueResult<GoTrueUser>> {
    return this.call("PUT", `/admin/users/${encodeURIComponent(id)}`, "service", attrs);
  }

  adminDeleteUser(id: string): Promise<GoTrueResult<null>> {
    return this.call("DELETE", `/admin/users/${encodeURIComponent(id)}`, "service");
  }

  // Creates a token without sending an email. Returns the token hash for our own email text.
  async adminGenerateLink(type: LinkType, email: string): Promise<GoTrueResult<GoTrueLink>> {
    const res = await this.call<Record<string, unknown>>("POST", "/admin/generate_link", "service", {
      type,
      email,
    });
    if (!res.ok) return res;
    const body = res.data ?? {};
    const props = (body.properties ?? {}) as Record<string, unknown>;
    const hashed = body.hashed_token ?? props.hashed_token;
    const userObj = (body.user ?? body) as Record<string, unknown>;
    if (typeof hashed !== "string" || typeof userObj.id !== "string") {
      return { ok: false, status: 502, code: "bad_response", message: "generate_link returned no token" };
    }
    const vt = body.verification_type ?? props.verification_type;
    return {
      ok: true,
      data: {
        user: { id: userObj.id, email: typeof userObj.email === "string" ? userObj.email : undefined },
        hashedToken: hashed,
        verificationType: typeof vt === "string" ? vt : undefined,
      },
    };
  }

  // ---- plumbing ----

  private async call<T>(
    method: string,
    path: string,
    key: KeyKind,
    body?: unknown,
    userToken?: string,
  ): Promise<GoTrueResult<T>> {
    const apiKey = key === "service" ? this.serviceKey : this.anonKey;
    if (!this.base || !apiKey) {
      return { ok: false, status: 503, code: "not_configured", message: "Supabase Auth is not configured." };
    }
    // The new keys (sb_secret_..., sb_publishable_...) are not JWTs: Supabase rejects them on the Authorization
    // header ("Invalid JWT") before the call reaches Auth, so they go on apikey only. Legacy keys are JWTs and
    // keep the bearer copy.
    const bearer = userToken ?? (looksLikeLegacyKey(apiKey) ? apiKey : undefined);
    const headers: Record<string, string> = { apikey: apiKey };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const ip = clientIpStore.getStore();
    if (this.secretKey && apiKey === this.secretKey && ip && IP_LIKE.test(ip)) {
      headers["sb-forwarded-for"] = ip;
    }
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // Deno puts the offending header value in the message, so it is only matched here, never logged.
      const badHeader = err instanceof TypeError && /header/i.test(err.message);
      return badHeader
        ? { ok: false, status: 503, code: "bad_header", message: "An Auth request header was not valid." }
        : { ok: false, status: 503, code: "network_error", message: "Supabase Auth is unreachable." };
    }
    const text = await res.text().catch(() => "");
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (res.ok) return { ok: true, data: parsed as T };
    return { ok: false, status: res.status, ...errorParts(parsed) };
  }
}

// A key must be one header-safe token. A pasted value with a line break or an invisible character inside makes
// fetch throw before anything is sent (seen live 2026-11-24: every call with the secret key failed that way).
const KEY_SHAPE = /^[\x21-\x7e]+$/;
const IP_LIKE = /^[0-9A-Fa-f:.]{2,45}$/;

function usableKey(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && KEY_SHAPE.test(v) ? v : undefined;
}

// AUTH_SUPABASE_SECRET_KEY when it is usable, else the platform's own secret key (SUPABASE_SECRET_KEYS, a JSON
// object of named keys: "default" first, then any). Never logs a value.
function secretKeyFromEnv(): string | undefined {
  const own = env("AUTH_SUPABASE_SECRET_KEY");
  const usable = usableKey(own);
  if (own && !usable) {
    logError(
      "AUTH_SUPABASE_SECRET_KEY is not a usable API key (line break or hidden character); ignoring it",
    );
  }
  if (usable) return usable;
  const all = env("SUPABASE_SECRET_KEYS");
  if (!all) return undefined;
  try {
    const keys = JSON.parse(all) as Record<string, unknown>;
    const names = ["default", ...Object.keys(keys).filter((k) => k !== "default")];
    for (const name of names) {
      const key = typeof keys[name] === "string" ? usableKey(keys[name] as string) : undefined;
      if (key) return key;
    }
  } catch {
    logError("SUPABASE_SECRET_KEYS is not valid JSON; using the legacy anon key");
  }
  return undefined;
}

// Legacy anon/service_role keys are JWTs (three base64url parts, header starts "eyJ").
function looksLikeLegacyKey(key: string): boolean {
  return key.startsWith("eyJ") && key.split(".").length === 3;
}

// GoTrue error bodies come in two shapes: { code, error_code, msg } and { error, error_description }.
function errorParts(body: unknown): { code: string; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = [b.error_code, b.error, b.code].find((v) => typeof v === "string") as string | undefined;
  const message = [b.msg, b.message, b.error_description].find((v) => typeof v === "string") as
    | string
    | undefined;
  return { code: code ?? "unknown", message: message ?? "" };
}

export function isEmailExists(err: GoTrueError): boolean {
  return err.code === "email_exists" || err.code === "user_already_exists" ||
    /already (been )?registered/i.test(err.message);
}

export function isWeakPassword(err: GoTrueError): boolean {
  return err.code === "weak_password" || /password should be/i.test(err.message);
}

let shared: GoTrueClient | null = null;

export function gotrueFromEnv(): GoTrueClient {
  if (!shared) shared = new GoTrueClient();
  return shared;
}
