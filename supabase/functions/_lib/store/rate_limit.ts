// Per-IP rate limits in app.rate_limits (contract "Rate limit", N3). Owner of this module: M1.
// One upsert per request. Fixed windows: key = bucket + ip + method, window = start of the current window.
import { apiError } from "../../_shared/http.ts";
import { env } from "../../_shared/env.ts";
import { timingSafeEqual } from "../../_shared/auth.ts";
import { db } from "./common.ts";

export interface LimitRule {
  bucket: string;
  max: number;
  windowSeconds: number;
}

export type Counter = (key: string, windowStart: string) => Promise<number>;

export const pgCounter: Counter = async (key, windowStart) => {
  const rows = await db()`
    insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  return Number(rows[0]?.count ?? 1);
};

// The Worker sends the caller's IP in x-thesis-client-ip (from cf-connecting-ip). Anyone can call the function URL
// directly and forge that header, so it is trusted only with the Worker's x-thesis-edge-token (secret EDGE_TOKEN,
// set to the same value on the Worker and in Supabase). Without EDGE_TOKEN set, x-forwarded-for is used.
export function clientIp(req: Request): string {
  const expected = env("EDGE_TOKEN");
  const given = req.headers.get("x-thesis-edge-token") ?? "";
  const fromEdge = req.headers.get("x-thesis-client-ip");
  if (fromEdge && expected && given && timingSafeEqual(given, expected)) return fromEdge.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function intEnv(name: string, fallback: number): number {
  const n = Number(env(name));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Defaults match apps/product-api/src/config.ts.
export function rules() {
  const general = intEnv("RATE_LIMIT_WINDOW_SECONDS", 60);
  const auth = intEnv("AUTH_RATE_LIMIT_WINDOW_SECONDS", general);
  return {
    general: { bucket: "general", max: intEnv("RATE_LIMIT_MAX_REQUESTS", 120), windowSeconds: general },
    login: {
      bucket: "auth_login",
      max: intEnv("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS", 10),
      windowSeconds: auth,
    },
    register: {
      bucket: "auth_register",
      max: intEnv("AUTH_RATE_LIMIT_REGISTER_MAX_REQUESTS", 6),
      windowSeconds: auth,
    },
    refresh: {
      bucket: "auth_refresh",
      max: intEnv("AUTH_RATE_LIMIT_REFRESH_MAX_REQUESTS", 12),
      windowSeconds: auth,
    },
  } satisfies Record<string, LimitRule>;
}

// Returns a 429 Response when over the limit, else null. Fails open if the counter errors,
// so a database hiccup never locks everyone out.
export async function checkRateLimit(
  req: Request,
  rule: LimitRule,
  keyPart: string,
  counter: Counter = pgCounter,
  nowMs = Date.now(),
): Promise<Response | null> {
  if (env("RATE_LIMIT_DISABLED") === "1") return null;
  const windowMs = rule.windowSeconds * 1000;
  const start = Math.floor(nowMs / windowMs) * windowMs;
  const key = `${rule.bucket}:${clientIp(req)}:${req.method}:${keyPart}`;
  let count: number;
  try {
    count = await counter(key, new Date(start).toISOString());
  } catch {
    return null;
  }
  if (count <= rule.max) return null;
  const retry = Math.max(1, Math.ceil((start + windowMs - nowMs) / 1000));
  return apiError(429, "rate_limited", "Too many requests. Try again shortly.", {
    retry_after_seconds: retry,
  });
}
