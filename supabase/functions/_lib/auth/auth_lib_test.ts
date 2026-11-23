import { assertEquals } from "jsr:@std/assert@1.0.13";
import { GoTrueClient, isEmailExists } from "./gotrue.ts";
import { hashOpaqueToken, isOtpCode, mapSession, parseCode } from "./tokens.ts";

function recorder(status: number, body: unknown) {
  const seen: { url: string; headers: Headers; body?: string; method?: string }[] = [];
  const fetch = (url: string, init?: RequestInit) => {
    seen.push({ url, headers: new Headers(init?.headers), body: init?.body as string, method: init?.method });
    return Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status }));
  };
  return { seen, fetch };
}

Deno.test("GoTrue client: anon key for public calls, service key for admin calls", async () => {
  const r = recorder(200, { access_token: "a", refresh_token: "r" });
  const c = new GoTrueClient({
    url: "https://p.supabase.co/",
    anonKey: "anon",
    serviceKey: "svc",
    fetch: r.fetch,
  });
  await c.passwordGrant("a@b.co", "pw");
  await c.adminDeleteUser("u-1");
  await c.logout("user-jwt", "global");
  assertEquals(r.seen[0].url, "https://p.supabase.co/auth/v1/token?grant_type=password");
  assertEquals(r.seen[0].headers.get("apikey"), "anon");
  assertEquals(r.seen[1].url, "https://p.supabase.co/auth/v1/admin/users/u-1");
  assertEquals(r.seen[1].method, "DELETE");
  assertEquals(r.seen[1].headers.get("apikey"), "svc");
  assertEquals(r.seen[1].headers.get("authorization"), "Bearer svc");
  assertEquals(r.seen[2].url, "https://p.supabase.co/auth/v1/logout?scope=global");
  assertEquals(r.seen[2].headers.get("authorization"), "Bearer user-jwt");
});

Deno.test("GoTrue client: parses both error shapes, reports missing config and network errors", async () => {
  const a = new GoTrueClient({
    url: "https://p",
    anonKey: "k",
    serviceKey: "s",
    fetch: recorder(400, { error: "invalid_grant", error_description: "Invalid login credentials" }).fetch,
  });
  const ra = await a.passwordGrant("a@b.co", "x");
  assertEquals(ra.ok ? null : [ra.status, ra.code, ra.message], [
    400,
    "invalid_grant",
    "Invalid login credentials",
  ]);

  const b = new GoTrueClient({
    url: "https://p",
    anonKey: "k",
    serviceKey: "s",
    fetch: recorder(422, { code: 422, error_code: "email_exists", msg: "x" }).fetch,
  });
  const rb = await b.adminCreateUser({ email: "a@b.co", password: "x" });
  assertEquals(!rb.ok && isEmailExists(rb), true);
  const old = {
    ok: false as const,
    status: 422,
    code: "unknown",
    message: "A user with this email address has already been registered",
  };
  assertEquals(isEmailExists(old), true);

  const none = new GoTrueClient({ url: "", anonKey: "", serviceKey: "" });
  const rn = await none.getUser("t");
  assertEquals(rn.ok ? null : rn.code, "not_configured");

  const down = new GoTrueClient({
    url: "https://p",
    anonKey: "k",
    fetch: () => Promise.reject(new Error("x")),
  });
  const rd = await down.refreshGrant("t");
  assertEquals(rd.ok ? null : [rd.status, rd.code], [503, "network_error"]);
});

Deno.test("generate_link reads the flat and the nested response shape", async () => {
  const flat = new GoTrueClient({
    url: "https://p",
    serviceKey: "s",
    fetch:
      recorder(200, { id: "u1", email: "a@b.co", hashed_token: "h1", verification_type: "signup" }).fetch,
  });
  const f = await flat.adminGenerateLink("signup", "a@b.co");
  assertEquals(f.ok && [f.data.user.id, f.data.hashedToken], ["u1", "h1"]);
  const nested = new GoTrueClient({
    url: "https://p",
    serviceKey: "s",
    fetch: recorder(200, { user: { id: "u2" }, properties: { hashed_token: "h2" } }).fetch,
  });
  const n = await nested.adminGenerateLink("recovery", "a@b.co");
  assertEquals(n.ok && [n.data.user.id, n.data.hashedToken], ["u2", "h2"]);
});

Deno.test("mapSession keeps the old AuthTokensResponse fields", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  const out = mapSession({ access_token: "a", refresh_token: "r", expires_at: 1795434000 }, 60, now);
  assertEquals(out, {
    access_token: "a",
    refresh_token: "r",
    token_type: "Bearer",
    access_token_expires_at: new Date(1795434000 * 1000).toISOString(),
    refresh_token_expires_at: "2026-11-23T10:01:00.000Z",
  });
  const viaIn = mapSession({ access_token: "a", refresh_token: "r", expires_in: 900 }, 60, now);
  assertEquals(viaIn.access_token_expires_at, "2026-11-23T10:15:00.000Z");
});

Deno.test("parseCode reads tags and rejects junk", () => {
  assertEquals(parseCode(" v1s.abcdef0123 "), { tag: "v1s", hash: "abcdef0123" });
  assertEquals(parseCode("abcdef0123"), { tag: null, hash: "abcdef0123" });
  assertEquals(parseCode("v1x.abcdef0123"), undefined);
  assertEquals(parseCode("short"), undefined);
  assertEquals(parseCode("has space in it"), undefined);
});

Deno.test("hashOpaqueToken matches the old sha256 hex", async () => {
  assertEquals(
    await hashOpaqueToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("sb-forwarded-for is sent only with the secret key and a client ip", async () => {
  const { GoTrueClient, withClientIp } = await import("./gotrue.ts");
  const seen: Headers[] = [];
  const fetchFn = (_u: string, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  const legacy = new GoTrueClient({ url: "http://a", anonKey: "anon", serviceKey: "svc", fetch: fetchFn });
  await withClientIp("1.2.3.4", () => legacy.recover("x@example.com"));
  const secret = new GoTrueClient({
    url: "http://a",
    secretKey: "sb_secret_x",
    serviceKey: "svc",
    fetch: fetchFn,
  });
  await withClientIp("1.2.3.4", () => secret.recover("x@example.com"));
  await secret.recover("x@example.com");
  if (seen[0].has("sb-forwarded-for")) throw new Error("legacy key must not forward");
  if (seen[1].get("sb-forwarded-for") !== "1.2.3.4" || seen[1].get("apikey") !== "sb_secret_x") {
    throw new Error("secret key must forward the ip");
  }
  if (seen[2].has("sb-forwarded-for")) throw new Error("no ip outside a request");
});

Deno.test("isOtpCode takes the short email code at the lengths Supabase allows (6 to 10 digits)", () => {
  assertEquals(["123456", "12345678", "1234567890"].map(isOtpCode), [true, true, true]);
  assertEquals(["12345", "12345678901", "1234 5678", "v1s.abc", ""].map(isOtpCode), [
    false,
    false,
    false,
    false,
    false,
  ]);
});
