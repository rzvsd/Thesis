import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { appPath, handle } from "./app.ts";
import { Router } from "./router.ts";
import { features } from "./features/index.ts";
import { healthHandler } from "./features/health/index.ts";

const noUser = () => Promise.resolve(null);

Deno.test("appPath strips platform and preview prefixes", () => {
  assertEquals(appPath("/functions/v1/api/health"), "/health");
  assertEquals(appPath("/api-m2/v1/jobs"), "/v1/jobs");
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
