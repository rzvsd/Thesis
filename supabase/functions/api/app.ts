// The api function: strip the platform prefix, match a route, run the auth guard, call the handler.
import { authorize, supabaseUserVerifier, type UserVerifier } from "../_shared/auth.ts";
import { apiError, json } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { features } from "./features/index.ts";
import { Router } from "./router.ts";

const router = new Router(features);

// Requests arrive as /functions/v1/<name>/<path> or /<name>/<path> (name is api or a preview api-mN).
// The Worker front door sends the app's own paths, so a bare path is also accepted.
export function appPath(pathname: string): string {
  const stripped = pathname.replace(/^\/functions\/v1/, "").replace(/^\/api(-m\d)?(?=\/|$)/, "");
  return stripped === "" ? "/" : stripped;
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization,content-type,x-request-id,x-internal-token,apikey,x-client-info",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export async function handle(
  req: Request,
  verifyUser: UserVerifier = supabaseUserVerifier,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  const url = new URL(req.url);
  const path = appPath(url.pathname);
  const found = router.match(req.method, path);
  if (found.kind === "not_found") return json({ status: "not_found" }, 404);
  if (found.kind === "method_not_allowed") return apiError(405, "method_not_allowed");

  const auth = await authorize(req, found.route.auth, verifyUser);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  try {
    return await found.route.handler({ req, url, path, params: found.params, auth: auth.ctx });
  } catch (err) {
    logError("Unhandled error", {
      path: found.route.path,
      error: err instanceof Error ? err.name : "unknown",
    });
    return apiError(500, "internal_error", "Something went wrong.");
  }
}

export const routeCount = router.size;
