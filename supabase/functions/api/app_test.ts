import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { appPath, capBody, handle } from "./app.ts";
import { Router } from "./router.ts";
import { features } from "./features/index.ts";
import { healthHandler } from "./features/health/index.ts";

const noUser = () => Promise.resolve(null);

Deno.test("appPath strips the platform prefix", () => {
  assertEquals(appPath("/functions/v1/api/health"), "/health");
  assertEquals(appPath("/api/v1/jobs"), "/v1/jobs");
  assertEquals(appPath("/api-m2/v1/jobs"), "/api-m2/v1/jobs");
  assertEquals(appPath("/functions/v1/api"), "/");
  assertEquals(appPath("/v1/user/profile"), "/v1/user/profile");
  assertEquals(appPath("/apiary/x"), "/apiary/x");
});

Deno.test("health returns the old shape without auth", async () => {
  const res = await handle(new Request("http://x/functions/v1/api/health"), noUser);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "ok");
  assert(body.modes && typeof body.modes.push === "string");
});

Deno.test("health db probe failure is 503", async () => {
  const h = healthHandler(() => Promise.reject(new Error("down")));
  const url = new URL("http://x/health?db=1");
  const res = await h({
    req: new Request(url),
    url,
    path: "/health",
    params: {},
    auth: { mode: "none", userId: null, accessToken: null },
  });
  assertEquals(res.status, 503);
  assertEquals((await res.json()).db.ok, false);
});

Deno.test("unknown route is 404 with the old body", async () => {
  const res = await handle(new Request("http://x/functions/v1/api/nope"), noUser);
  assertEquals(res.status, 404);
  assertEquals(await res.json(), { status: "not_found" });
});

Deno.test("registry has every planned feature and no duplicate routes", () => {
  assertEquals(features.length, 20);
  const r = new Router(features);
  assert(r.size >= 1);
});

Deno.test("router refuses duplicate routes across features", () => {
  const h = () => new Response("x");
  assertThrows(() =>
    new Router([
      { name: "a", owner: "M1", routes: [{ method: "GET", path: "/x", auth: "none", handler: h }] },
      { name: "b", owner: "M2", routes: [{ method: "GET", path: "/x", auth: "none", handler: h }] },
    ])
  );
});

Deno.test("router prefers static segments and reads params", () => {
  const h = () => new Response("x");
  const r = new Router([{
    name: "a",
    owner: "M1",
    routes: [
      { method: "GET", path: "/v1/reports/:id", auth: "user", handler: h },
      { method: "GET", path: "/v1/reports/latest", auth: "user", handler: h },
    ],
  }]);
  const m = r.match("GET", "/v1/reports/latest");
  assert(m.kind === "found" && m.route.path === "/v1/reports/latest");
  const p = r.match("GET", "/v1/reports/abc%20d");
  assert(p.kind === "found" && p.params.id === "abc d");
  assertEquals(r.match("POST", "/v1/reports/1").kind, "method_not_allowed");
});

Deno.test("with EDGE_TOKEN set, only the Worker and internal callers get past the function URL (S1)", async () => {
  Deno.env.set("EDGE_TOKEN", "edge-test-value");
  Deno.env.set("INTERNAL_API_TOKEN", "internal-test-value");
  try {
    const direct = await handle(new Request("http://x/functions/v1/api/health"), noUser);
    assertEquals(direct.status, 404);
    assertEquals(await direct.json(), { status: "not_found" });
    const forged = await handle(
      new Request("http://x/functions/v1/api/health", { headers: { "x-thesis-edge-token": "wrong" } }),
      noUser,
    );
    assertEquals(forged.status, 404);
    await forged.body?.cancel();
    const edge = await handle(
      new Request("http://x/functions/v1/api/health", {
        headers: { "x-thesis-edge-token": "edge-test-value" },
      }),
      noUser,
    );
    assertEquals(edge.status, 200);
    await edge.body?.cancel();
    const internal = await handle(
      new Request("http://x/functions/v1/api/health", {
        headers: { "x-internal-token": "internal-test-value" },
      }),
      noUser,
    );
    assertEquals(internal.status, 200);
    await internal.body?.cancel();
  } finally {
    Deno.env.delete("EDGE_TOKEN");
    Deno.env.delete("INTERNAL_API_TOKEN");
  }
});

Deno.test("OPTIONS gets no CORS answer (S11)", async () => {
  const res = await handle(new Request("http://x/functions/v1/api/health", { method: "OPTIONS" }), noUser);
  assert(res.status === 404 || res.status === 405);
  assertEquals(res.headers.get("access-control-allow-origin"), null);
  await res.body?.cancel();
});

Deno.test("capBody refuses a body over the limit, streamed or declared (S12)", async () => {
  const big = new Request("http://x", { method: "POST", body: "x".repeat(2048) });
  const refused = await capBody(big, 1024);
  assert(refused instanceof Response);
  assertEquals(refused.status, 413);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < 4; i++) c.enqueue(new Uint8Array(400));
      c.close();
    },
  });
  const streamed = await capBody(new Request("http://x", { method: "POST", body: stream }), 1024);
  assert(streamed instanceof Response);
  assertEquals(streamed.status, 413);
  const ok = await capBody(new Request("http://x", { method: "POST", body: '{"a":1}' }), 1024);
  assert(ok instanceof Request);
  assertEquals(await ok.json(), { a: 1 });
});
