// Test helpers for M1 handlers (H8: Request in, Response out, no database).
import type { AuthContext } from "../../_shared/auth.ts";
import type { RouteContext } from "../../api/router.ts";

export function ctx(
  req: Request,
  opts: { userId?: string | null; params?: Record<string, string>; accessToken?: string } = {},
): RouteContext {
  const url = new URL(req.url);
  const auth: AuthContext = {
    mode: opts.userId ? "user" : "none",
    userId: opts.userId ?? null,
    accessToken: opts.accessToken ?? (opts.userId ? "test-access-token" : null),
  };
  return { req, url, path: url.pathname, params: opts.params ?? {}, auth };
}

export function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: HeadersInit = {},
): Request {
  const h = new Headers(headers);
  if (body !== undefined) h.set("content-type", "application/json");
  return new Request(`http://test${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
