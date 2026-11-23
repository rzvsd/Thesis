import { assertEquals } from "jsr:@std/assert@1.0.13";
import { authorize, timingSafeEqual } from "./auth.ts";

const yes = () => Promise.resolve("user-1");
const no = () => Promise.resolve(null);

Deno.test("user mode denies without a token", async () => {
  const r = await authorize(new Request("http://x"), "user", yes);
  assertEquals(r.ok, false);
});

Deno.test("user mode denies a bad token and accepts a good one", async () => {
  const req = new Request("http://x", { headers: { authorization: "Bearer abc" } });
  assertEquals((await authorize(req, "user", no)).ok, false);
  const ok = await authorize(req, "user", yes);
  assertEquals(ok.ok && ok.ctx.userId, "user-1");
});

Deno.test("internal mode denies when no token is configured", async () => {
  Deno.env.delete("INTERNAL_API_TOKEN");
  const req = new Request("http://x", { headers: { "x-internal-token": "" } });
  assertEquals((await authorize(req, "internal")).ok, false);
});

Deno.test("internal mode checks the token", async () => {
  Deno.env.set("INTERNAL_API_TOKEN", "s3cret-test-value");
  const bad = new Request("http://x", { headers: { "x-internal-token": "nope" } });
  const good = new Request("http://x", { headers: { "x-internal-token": "s3cret-test-value" } });
  assertEquals((await authorize(bad, "internal")).ok, false);
  assertEquals((await authorize(good, "internal")).ok, true);
  Deno.env.delete("INTERNAL_API_TOKEN");
});

Deno.test("timingSafeEqual", () => {
  assertEquals(timingSafeEqual("abc", "abc"), true);
  assertEquals(timingSafeEqual("abc", "abd"), false);
  assertEquals(timingSafeEqual("abc", "abcd"), false);
});
