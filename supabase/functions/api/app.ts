// The api function: strip the platform prefix, match a route, run the auth guard, call the handler.
import {
  type AuthMode,
  authorize,
  directCallAllowed,
  supabaseUserVerifier,
  type UserVerifier,
} from "../_shared/auth.ts";
import { env } from "../_shared/env.ts";
import { apiError, json } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { features } from "./features/index.ts";
import { Router } from "./router.ts";

const router = new Router(features);

// Requests arrive as /functions/v1/api/<path> or /api/<path>.
// The Worker front door sends the app's own paths, so a bare path is also accepted.
export function appPath(pathname: string): string {
  const stripped = pathname.replace(/^\/functions\/v1/, "").replace(/^\/api(?=\/|$)/, "");
  return stripped === "" ? "/" : stripped;
}

// Audit S12: one cap on every request body, checked before any handler reads it. Internal routes carry job
// payloads (Pulse, prices, Deep Dive reports), so they get more room. MAX_JSON_BODY_BYTES is the user-route cap.
const MIB = 1024 * 1024;

function bodyLimit(mode: AuthMode): number {
  if (mode === "internal") return 16 * MIB;
  const n = Number(env("MAX_JSON_BODY_BYTES"));
  return Number.isInteger(n) && n > 0 ? n : MIB;
}

const tooLarge = (limit: number) =>
  apiError(413, "payload_too_large", `Request body must be <= ${limit} bytes.`);

// Returns the request with its body read into memory (at most `limit` bytes), or a 413.
export async function capBody(req: Request, limit: number): Promise<Request | Response> {
  if (!req.body || req.method === "GET" || req.method === "HEAD") return req;
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await req.body.cancel();
    return tooLarge(limit);
  }
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return tooLarge(limit);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return new Request(req.url, { method: req.method, headers: req.headers, body: bytes });
}

export async function handle(
  req: Request,
  verifyUser: UserVerifier = supabaseUserVerifier,
): Promise<Response> {
  // Audit S1: the direct function address answers only the Worker and the internal callers.
  // Audit S11: no CORS answer; there is no browser client, so OPTIONS falls through to 404 or 405.
  if (!directCallAllowed(req)) {
    await req.body?.cancel();
    return json({ status: "not_found" }, 404);
  }
  const url = new URL(req.url);
  const path = appPath(url.pathname);
  const found = router.match(req.method, path);
  if (found.kind === "not_found") return json({ status: "not_found" }, 404);
  if (found.kind === "method_not_allowed") return apiError(405, "method_not_allowed");

  const auth = await authorize(req, found.route.auth, verifyUser);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const capped = await capBody(req, bodyLimit(found.route.auth));
  if (capped instanceof Response) return capped;

  try {
    return await found.route.handler({ req: capped, url, path, params: found.params, auth: auth.ctx });
  } catch (err) {
    logError("Unhandled error", {
      path: found.route.path,
      error: err instanceof Error ? err.name : "unknown",
    });
    return apiError(500, "internal_error", "Something went wrong.");
  }
}

export const routeCount = router.size;
