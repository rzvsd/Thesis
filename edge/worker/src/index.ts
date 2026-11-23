// Thesis front door (DECISIONS D2, H2, H11).
// A Cloudflare Worker on its free workers.dev address. It forwards every request to the Supabase `api`
// Edge Function, puts HTML content types back (Supabase rewrites text/html to text/plain without a
// custom domain), and pings /health?db=1 once a day so the free project does not pause.
// Plain TypeScript, no dependencies. Docs: docs/rebuild/M1-worker.md.

// Minimal Cloudflare types, declared here so `deno check` works without @cloudflare/workers-types.
export interface Env {
  API_ORIGIN?: string;
  API_FUNCTION?: string;
  // Optional Worker secret (wrangler secret put EDGE_TOKEN). Sent upstream as x-thesis-edge-token.
  EDGE_TOKEN?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

export interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

export type FetchFn = (input: Request) => Promise<Response>;

export const DEFAULT_ORIGIN = "https://oizahjzcowflmrffoxjg.supabase.co";
export const DEFAULT_FUNCTION = "api";

// Headers that belong to one connection and must not be forwarded (RFC 9110 7.6.1), plus host.
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
];

// Header contract with the api (see docs/rebuild/M1-worker.md).
const H_CONTENT_TYPE = "x-thesis-content-type";
const H_CSP = "x-thesis-csp";
const H_CLIENT_IP = "x-thesis-client-ip";
const H_EDGE_TOKEN = "x-thesis-edge-token";

function origin(env: Env): string {
  return (env.API_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

// Only `api` or a preview `api-mN`, so a bad var cannot send traffic to another function.
function functionName(env: Env): string {
  const name = env.API_FUNCTION || DEFAULT_FUNCTION;
  return /^api(-m\d)?$/.test(name) ? name : DEFAULT_FUNCTION;
}

function jsonError(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, error_message: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Maps an incoming path to the api's path. Returns null for /functions/v1/<other function>.
// The app's paths sit at the root (/auth/login, /legal/terms). A request that already carries
// /functions/v1/<our function> is stripped once so it is not prefixed twice.
export function upstreamPath(pathname: string, fn: string): string | null {
  const prefix = `/functions/v1/${fn}`;
  let path = pathname;
  if (path === prefix || path.startsWith(prefix + "/")) {
    path = path.slice(prefix.length);
  } else if (path === "/functions/v1" || path.startsWith("/functions/v1/")) {
    return null;
  }
  if (path === "/") path = "";
  return `${prefix}${path}`;
}

function requestHeaders(req: Request, env: Env): Headers {
  const h = new Headers();
  for (const [k, v] of req.headers) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.includes(key)) continue;
    // Callers may not set our own x-thesis-* headers.
    if (key.startsWith("x-thesis-")) continue;
    h.set(k, v);
  }
  const ip = req.headers.get("cf-connecting-ip");
  if (ip) h.set(H_CLIENT_IP, ip.trim());
  if (env.EDGE_TOKEN) h.set(H_EDGE_TOKEN, env.EDGE_TOKEN);
  return h;
}

// Copies upstream headers and applies the HTML fix.
export function responseHeaders(upstream: Headers): Headers {
  const h = new Headers();
  for (const [k, v] of upstream) {
    if (!HOP_BY_HOP.includes(k.toLowerCase())) h.set(k, v);
  }
  const htmlType = upstream.get(H_CONTENT_TYPE);
  if (htmlType) {
    h.set("content-type", htmlType);
    // Any content-security-policy on a marked response is Supabase's (it sandboxes the page).
    // The api's own policy travels as x-thesis-csp.
    h.delete("content-security-policy");
    const csp = upstream.get(H_CSP);
    if (csp) h.set("content-security-policy", csp);
  }
  // Never leak the contract headers to the browser.
  for (const k of [...h.keys()]) {
    if (k.toLowerCase().startsWith("x-thesis-")) h.delete(k);
  }
  return h;
}

export async function forward(
  req: Request,
  env: Env,
  fetchFn: FetchFn,
): Promise<Response> {
  const url = new URL(req.url);
  const path = upstreamPath(url.pathname, functionName(env));
  if (path === null) return jsonError(404, "not_found", "Not found.");
  const target = `${origin(env)}${path}${url.search}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: requestHeaders(req, env),
    body: hasBody ? req.body : undefined,
    redirect: "manual",
  };
  if (hasBody && req.body) init.duplex = "half"; // needed for streamed bodies outside Workers
  let upstream: Response;
  try {
    upstream = await fetchFn(new Request(target, init));
  } catch {
    console.log(
      JSON.stringify({ event: "upstream_error", method: req.method }),
    );
    return jsonError(
      502,
      "service_unavailable",
      "The service is unavailable. Try again shortly.",
    );
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream.headers),
  });
}

// Daily keep-alive (H11): one request that touches the database. Logs the status only.
export async function keepAlive(env: Env, fetchFn: FetchFn): Promise<number> {
  const url = `${origin(env)}/functions/v1/${functionName(env)}/health?db=1`;
  try {
    const res = await fetchFn(new Request(url, { method: "GET" }));
    await res.body?.cancel();
    console.log(JSON.stringify({ event: "keep_alive", status: res.status }));
    return res.status;
  } catch {
    console.log(JSON.stringify({ event: "keep_alive", status: 0 }));
    return 0;
  }
}

export function createWorker(fetchFn: FetchFn = (r) => fetch(r)) {
  return {
    fetch(req: Request, env: Env, _ctx?: ExecutionContext): Promise<Response> {
      return forward(req, env ?? {}, fetchFn);
    },
    scheduled(
      _controller: ScheduledController,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<void> {
      const done = keepAlive(env ?? {}, fetchFn).then(() => {});
      ctx.waitUntil(done);
      return done;
    },
  };
}

export default createWorker();
