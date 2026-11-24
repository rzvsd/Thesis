// The api function: strip the platform prefix, match a route, run the auth guard, call the handler.
import {
  type AuthMode,
  authorize,
  directCallAllowed,
  supabaseUserVerifier,
  type UserVerifier,
} from "../_shared/auth.ts";
import { resetDb } from "../_shared/db.ts";
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

// A request that has not answered by its deadline gets a 503 instead of hanging until the platform kills the
// worker (an alerts read hung 87 s and ended as 546 on 2026-11-24). Internal routes run jobs and keep the
// platform's own limit. REQUEST_TIMEOUT_MS overrides the user-route deadline.
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;

export function requestDeadlineMs(mode: AuthMode): number | null {
  if (mode === "internal") return null;
  const n = Number(env("REQUEST_TIMEOUT_MS"));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_REQUEST_TIMEOUT_MS;
}

export class DeadlineExceeded extends Error {
  override name = "DeadlineExceeded";
}

export async function withDeadline<T>(work: Promise<T>, ms: number | null): Promise<T> {
  if (ms === null) return await work;
  let timer: number | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineExceeded(`No answer after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
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

  const started = Date.now();
  try {
    const work = Promise.resolve(
      found.route.handler({ req: capped, url, path, params: found.params, auth: auth.ctx }),
    );
    return await withDeadline(work, requestDeadlineMs(found.route.auth));
  } catch (err) {
    if (err instanceof DeadlineExceeded) {
      // The usual cause is a database connection that stopped answering. Start the next query on a fresh one.
      resetDb();
      logError("Request deadline exceeded", { path: found.route.path, ms: Date.now() - started });
      return apiError(503, "timeout", "The server took too long to answer. Please try again.");
    }
    logError("Unhandled error", {
      path: found.route.path,
      error: err instanceof Error ? err.name : "unknown",
    });
    return apiError(500, "internal_error", "Something went wrong.");
  }
}

export const routeCount = router.size;
