// Small HTTP helpers shared by the M1 user, watchlist, holdings, devices and tickers features.
import { apiError } from "../../../_shared/http.ts";
import { env } from "../../../_shared/env.ts";
import { checkRateLimit, rules } from "../../../_lib/store/rate_limit.ts";

// Returns a 429 Response when the caller is over the limit, else null.
export type Limiter = (req: Request, bucketKey: string) => Promise<Response | null>;

export const generalLimit: Limiter = (req, key) => checkRateLimit(req, rules().general, key);
export const noLimit: Limiter = () => Promise.resolve(null);

// Rate-limit key for a path: the router accepts a trailing slash, the bucket ignores it.
export function bucketOf(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

// Old server: MAX_JSON_BODY_BYTES, default 1 MiB.
function maxJsonBodyBytes(): number {
  const n = Number(env("MAX_JSON_BODY_BYTES"));
  return Number.isInteger(n) && n > 0 ? n : 1024 * 1024;
}

export type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; response: Response };

// Like the old readJsonBody: an empty body is {}, a body over the limit is 413 payload_too_large.
// Invalid JSON throws, which the app turns into 500 internal_error (as the old server did).
export async function readJsonBody(req: Request): Promise<BodyResult> {
  const limit = maxJsonBodyBytes();
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > limit) {
    return {
      ok: false,
      response: apiError(413, "payload_too_large", `JSON body must be <= ${limit} bytes.`),
    };
  }
  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return { ok: true, body: {} };
  const parsed: unknown = JSON.parse(text);
  if (parsed === null) throw new TypeError("JSON body is null");
  if (typeof parsed !== "object" || Array.isArray(parsed)) return { ok: true, body: {} };
  return { ok: true, body: parsed as Record<string, unknown> };
}

export function validationFailed(message: string): Response {
  return apiError(422, "validation_failed", message);
}
