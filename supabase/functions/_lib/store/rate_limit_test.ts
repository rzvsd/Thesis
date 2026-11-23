import { assertEquals } from "jsr:@std/assert@1.0.13";
import { checkRateLimit, clientIp } from "./rate_limit.ts";

Deno.test("clientIp trusts the Worker header only with the edge token, never x-forwarded-for (S1)", () => {
  Deno.env.set("EDGE_TOKEN", "edge-test-value");
  const headers = { "x-thesis-client-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" };
  assertEquals(clientIp(new Request("http://x", { headers })), "direct");
  const good = new Request("http://x", { headers: { ...headers, "x-thesis-edge-token": "edge-test-value" } });
  assertEquals(clientIp(good), "1.2.3.4");
  Deno.env.delete("EDGE_TOKEN");
  assertEquals(
    clientIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" } })),
    "9.9.9.9",
  );
});

Deno.test("rate limit returns 429 with retry_after_seconds over the limit", async () => {
  const counts = new Map<string, number>();
  const counter = (key: string, start: string) => {
    const k = `${key}@${start}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    return Promise.resolve(counts.get(k)!);
  };
  const rule = { bucket: "t", max: 2, windowSeconds: 60 };
  const req = new Request("http://x", { method: "POST" });
  const now = 1_700_000_010_000;
  assertEquals(await checkRateLimit(req, rule, "/a", counter, now), null);
  assertEquals(await checkRateLimit(req, rule, "/a", counter, now), null);
  const res = await checkRateLimit(req, rule, "/a", counter, now);
  assertEquals(res?.status, 429);
  const body = await res!.json();
  assertEquals(body.error, "rate_limited");
  assertEquals(typeof body.retry_after_seconds, "number");
});

Deno.test("rate limit fails open when the counter throws", async () => {
  const res = await checkRateLimit(
    new Request("http://x"),
    { bucket: "t", max: 1, windowSeconds: 60 },
    "/a",
    () => Promise.reject(new Error("db down")),
  );
  assertEquals(res, null);
});
