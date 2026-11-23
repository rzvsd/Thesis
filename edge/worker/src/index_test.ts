import { assertEquals } from "jsr:@std/assert@1.0.13";
import { createWorker, type Env, type ExecutionContext, upstreamPath } from "./index.ts";

const env: Env = { API_ORIGIN: "https://up.example", API_FUNCTION: "api" };

// A fake upstream that records each request and answers with the given response.
function fakeUpstream(answer: (req: Request) => Response | Promise<Response>) {
  const seen: Request[] = [];
  const fn = async (req: Request) => {
    seen.push(req);
    return await answer(req);
  };
  return { seen, fn };
}

Deno.test("path mapping keeps the query string", async () => {
  const up = fakeUpstream(() => new Response("{}", { headers: { "content-type": "application/json" } }));
  const w = createWorker(up.fn);
  const res = await w.fetch(
    new Request("https://door.example/auth/login?x=1&y=two"),
    env,
  );
  assertEquals(res.status, 200);
  assertEquals(
    up.seen[0].url,
    "https://up.example/functions/v1/api/auth/login?x=1&y=two",
  );
  assertEquals(up.seen[0].redirect, "manual");
});

Deno.test("path mapping: root, prefixed paths, preview function, other functions", () => {
  assertEquals(upstreamPath("/", "api"), "/functions/v1/api");
  assertEquals(
    upstreamPath("/legal/terms", "api"),
    "/functions/v1/api/legal/terms",
  );
  assertEquals(
    upstreamPath("/functions/v1/api/health", "api"),
    "/functions/v1/api/health",
  );
  assertEquals(upstreamPath("/functions/v1/api", "api"), "/functions/v1/api");
  assertEquals(upstreamPath("/functions/v1/api-m1/health", "api"), null);
  assertEquals(upstreamPath("/functions/v1/other", "api"), null);
  assertEquals(upstreamPath("/apix", "api"), "/functions/v1/api/apix");
});

Deno.test("API_FUNCTION cannot point the Worker at another function (S6)", async () => {
  const up = fakeUpstream(() => new Response("ok"));
  const w = createWorker(up.fn);
  await w.fetch(new Request("https://door.example/health"), {
    ...env,
    API_FUNCTION: "api-m1",
  });
  await w.fetch(new Request("https://door.example/health"), {
    ...env,
    API_FUNCTION: "evil/../x",
  });
  await w.fetch(new Request("https://door.example/health"), {});
  assertEquals(up.seen[0].url, "https://up.example/functions/v1/api/health");
  assertEquals(up.seen[1].url, "https://up.example/functions/v1/api/health");
  assertEquals(
    up.seen[2].url,
    "https://oizahjzcowflmrffoxjg.supabase.co/functions/v1/api/health",
  );
});

Deno.test("internal routes are 404 at the front door and never reach the api (S9)", async () => {
  const up = fakeUpstream(() => new Response("ok"));
  const w = createWorker(up.fn);
  for (const path of ["/internal/push/send", "/internal", "/functions/v1/api/internal/pulse/dispatch"]) {
    const res = await w.fetch(new Request(`https://door.example${path}`, { method: "POST" }), env);
    assertEquals(res.status, 404);
    await res.body?.cancel();
  }
  const ok = await w.fetch(new Request("https://door.example/internalx"), env);
  assertEquals(ok.status, 200);
  await ok.body?.cancel();
  assertEquals(up.seen.length, 1);
});

Deno.test("other /functions/v1 paths are 404 and never reach the api", async () => {
  const up = fakeUpstream(() => new Response("ok"));
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/functions/v1/x"),
    env,
  );
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, "not_found");
  assertEquals(up.seen.length, 0);
});

Deno.test("headers: hop-by-hop and spoofed x-thesis-* are stripped, client ip comes from cf-connecting-ip", async () => {
  const up = fakeUpstream(() => new Response("ok"));
  const req = new Request("https://door.example/watchlist", {
    method: "POST",
    headers: {
      "authorization": "Bearer abc",
      "content-type": "application/json",
      "connection": "keep-alive",
      "keep-alive": "timeout=5",
      "x-thesis-client-ip": "6.6.6.6",
      "x-thesis-edge-token": "forged",
      "cf-connecting-ip": "203.0.113.9",
    },
    body: JSON.stringify({ ticker: "AAPL" }),
  });
  await createWorker(up.fn).fetch(req, env);
  const got = up.seen[0];
  assertEquals(got.method, "POST");
  assertEquals(got.headers.get("authorization"), "Bearer abc");
  assertEquals(got.headers.get("connection"), null);
  assertEquals(got.headers.get("keep-alive"), null);
  assertEquals(got.headers.get("x-thesis-client-ip"), "203.0.113.9");
  assertEquals(got.headers.get("x-thesis-edge-token"), null);
  assertEquals(await got.json(), { ticker: "AAPL" });
});

Deno.test("no cf-connecting-ip means no client ip header; edge token sent when set", async () => {
  const up = fakeUpstream(() => new Response("ok"));
  const req = new Request("https://door.example/health", {
    headers: { "x-thesis-client-ip": "1.1.1.1" },
  });
  await createWorker(up.fn).fetch(req, { ...env, EDGE_TOKEN: "t0k" });
  assertEquals(up.seen[0].headers.get("x-thesis-client-ip"), null);
  assertEquals(up.seen[0].headers.get("x-thesis-edge-token"), "t0k");
});

Deno.test("CORS preflight passes through", async () => {
  const up = fakeUpstream((r) =>
    new Response(null, {
      status: r.method === "OPTIONS" ? 204 : 500,
      headers: { "access-control-allow-origin": "*" },
    })
  );
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/auth/login", { method: "OPTIONS" }),
    env,
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

Deno.test("HTML fix: content type restored, Supabase CSP removed, api CSP and own headers kept", async () => {
  const up = fakeUpstream(() =>
    new Response("<p>hi</p>", {
      headers: {
        "content-type": "text/plain",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-thesis-content-type": "text/html; charset=utf-8",
        "x-thesis-csp": "default-src 'self'; style-src 'unsafe-inline'",
        "cache-control": "public, max-age=300",
        "x-robots-tag": "noindex",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    })
  );
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/legal/terms"),
    env,
  );
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(
    res.headers.get("content-security-policy"),
    "default-src 'self'; style-src 'unsafe-inline'",
  );
  assertEquals(res.headers.get("x-thesis-content-type"), null);
  assertEquals(res.headers.get("x-thesis-csp"), null);
  assertEquals(res.headers.get("cache-control"), "public, max-age=300");
  assertEquals(res.headers.get("x-robots-tag"), "noindex");
  assertEquals(res.headers.get("referrer-policy"), "no-referrer");
  assertEquals(res.headers.get("x-content-type-options"), "nosniff");
  assertEquals(await res.text(), "<p>hi</p>");
});

Deno.test("HTML fix without x-thesis-csp drops the Supabase CSP and sets none", async () => {
  const up = fakeUpstream(() =>
    new Response("<p>hi</p>", {
      headers: {
        "content-type": "text/plain",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-thesis-content-type": "text/html; charset=utf-8",
      },
    })
  );
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/r/tok"),
    env,
  );
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(res.headers.get("content-security-policy"), null);
});

Deno.test("non-HTML responses keep their headers and status untouched", async () => {
  const up = fakeUpstream(() =>
    new Response('{"error":"x"}', {
      status: 409,
      headers: {
        "content-type": "application/json",
        "content-security-policy": "default-src 'none'",
      },
    })
  );
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/auth/register"),
    env,
  );
  assertEquals(res.status, 409);
  assertEquals(res.headers.get("content-type"), "application/json");
  assertEquals(
    res.headers.get("content-security-policy"),
    "default-src 'none'",
  );
  assertEquals(await res.text(), '{"error":"x"}');
});

Deno.test("redirects pass through unfollowed", async () => {
  const up = fakeUpstream(() =>
    new Response(null, {
      status: 302,
      headers: { location: "https://accounts.example/x" },
    })
  );
  const res = await createWorker(up.fn).fetch(
    new Request("https://door.example/auth/google"),
    env,
  );
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "https://accounts.example/x");
});

Deno.test("upstream network failure is a 502 JSON error", async () => {
  const w = createWorker(() => Promise.reject(new TypeError("connection refused")));
  const res = await w.fetch(new Request("https://door.example/watchlist"), env);
  assertEquals(res.status, 502);
  assertEquals(await res.json(), {
    error: "service_unavailable",
    error_message: "The service is unavailable. Try again shortly.",
  });
});

Deno.test("scheduled keep-alive calls GET /health?db=1 on the api", async () => {
  const up = fakeUpstream(() => new Response('{"status":"ok"}'));
  const waited: Promise<unknown>[] = [];
  const ctx: ExecutionContext = { waitUntil: (p) => void waited.push(p) };
  await createWorker(up.fn).scheduled(
    { cron: "17 4 * * *", scheduledTime: 0 },
    env,
    ctx,
  );
  assertEquals(waited.length, 1);
  assertEquals(up.seen.length, 1);
  assertEquals(up.seen[0].method, "GET");
  assertEquals(
    up.seen[0].url,
    "https://up.example/functions/v1/api/health?db=1",
  );
  assertEquals(up.seen[0].headers.get("x-thesis-edge-token"), null);
});

Deno.test("scheduled keep-alive sends the edge token so the api answers it (S1)", async () => {
  const up = fakeUpstream(() => new Response('{"status":"ok"}'));
  const ctx: ExecutionContext = { waitUntil: () => {} };
  await createWorker(up.fn).scheduled(
    { cron: "17 4 * * *", scheduledTime: 0 },
    { ...env, EDGE_TOKEN: "edge-test-value" },
    ctx,
  );
  assertEquals(up.seen[0].headers.get("x-thesis-edge-token"), "edge-test-value");
});

Deno.test("scheduled keep-alive survives an upstream failure", async () => {
  const ctx: ExecutionContext = { waitUntil: () => {} };
  const w = createWorker(() => Promise.reject(new Error("down")));
  await w.scheduled({ cron: "17 4 * * *", scheduledTime: 0 }, env, ctx);
});
