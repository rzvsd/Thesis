// Ported from apps/product-api/tests/auth.test.ts (plus the auth part of safety-m4-security.test.ts),
// driving the new handlers with a fake GoTrue and a memory store.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.13";
import { authConfig } from "../../../_lib/auth/config.ts";
import { checkRateLimit } from "../../../_lib/store/rate_limit.ts";
import { registeredVerifiedUser, setup } from "./test_harness.ts";

for (const mode of ["supabase", "resend"] as const) {
  Deno.test(`[${mode}] auth lifecycle supports register -> verify -> login -> refresh -> logout`, async () => {
    const t = setup({ mode, config: { exposeCodes: true } });
    const email = "m4-auth@example.com";
    const password = "VeryStrongPass1!";

    const register = await t.call("POST", "/auth/register", { email, password });
    assertEquals(register.status, 201);
    assertEquals(register.json.status, "verification_sent");
    assertEquals(register.json.email, email);
    assertEquals(typeof register.json.verification_expires_at, "string");
    // The resend driver knows the code, so it can be exposed outside production. Supabase sends its own.
    if (mode === "resend") assertEquals(register.json.verification_token, t.lastCode(email));
    else assertEquals(register.json.verification_token, undefined);

    const before = await t.call("POST", "/auth/login", { email, password });
    assertEquals(before.status, 401);
    assertEquals(before.json.error, "auth_failed");

    const verify = await t.call("POST", "/auth/verify", { token: t.lastCode(email) });
    assertEquals(verify.status, 200);
    assertEquals(verify.json, { status: "verified" });

    const login = await t.call("POST", "/auth/login", { email, password });
    assertEquals(login.status, 200);
    assertEquals(Object.keys(login.json).sort(), [
      "access_token",
      "access_token_expires_at",
      "refresh_token",
      "refresh_token_expires_at",
      "token_type",
    ]);
    assertEquals(login.json.token_type, "Bearer");
    assertMatch(String(login.json.access_token_expires_at), /^\d{4}-\d{2}-\d{2}T/);

    const refresh = await t.call("POST", "/auth/refresh", { refresh_token: login.json.refresh_token });
    assertEquals(refresh.status, 200);
    const access = String(refresh.json.access_token);
    const rt = String(refresh.json.refresh_token);

    const logout = await t.call("POST", "/auth/logout", undefined, { bearer: access });
    assertEquals(logout.status, 200);
    assertEquals(logout.json, { status: "logged_out" });
    assertEquals(t.fake.accessValid(access), false);

    const after = await t.call("POST", "/auth/refresh", { refresh_token: rt });
    assertEquals(after.status, 401);
    assertEquals(after.json.error, "refresh_failed");
  });
}

Deno.test("refresh reuse detection revokes the token family", async () => {
  const t = setup();
  await registeredVerifiedUser(t, "m3-refresh-reuse@example.com");
  const login = await t.call("POST", "/auth/login", {
    email: "m3-refresh-reuse@example.com",
    password: "VeryStrongPass1!",
  });
  const original = login.json.refresh_token;
  const rotated = await t.call("POST", "/auth/refresh", { refresh_token: original });
  assertEquals(rotated.status, 200);
  const reused = await t.call("POST", "/auth/refresh", { refresh_token: original });
  assertEquals(reused.status, 401);
  assertEquals(reused.json.error, "refresh_failed");
  const afterRevoke = await t.call("POST", "/auth/refresh", { refresh_token: rotated.json.refresh_token });
  assertEquals(afterRevoke.status, 401);
  assertEquals(afterRevoke.json.error, "refresh_failed");
});

Deno.test("lockout enforces 10-fail style policy with auto-unlock window", async () => {
  const t = setup({ config: { lockoutMaxFailures: 3, lockoutWindowSeconds: 60, lockoutDurationSeconds: 1 } });
  const email = "m3-lockout@example.com";
  await registeredVerifiedUser(t, email);
  for (let i = 1; i <= 2; i++) {
    const failure = await t.call("POST", "/auth/login", { email, password: "WrongPassword1!" });
    assertEquals(failure.status, 401);
  }
  const trigger = await t.call("POST", "/auth/login", { email, password: "WrongPassword1!" });
  assertEquals(trigger.status, 423);
  assertEquals(trigger.json.error, "account_locked");
  assertEquals(typeof trigger.json.locked_until, "string");
  assertEquals(trigger.json.retry_after_seconds, 1);

  const lockedRight = await t.call("POST", "/auth/login", { email, password: "VeryStrongPass1!" });
  assertEquals(lockedRight.status, 423);
  assertEquals(lockedRight.json.error, "account_locked");
  // A locked account never reaches GoTrue's password grant.
  const grants = t.fake.calls.filter((c) => c.includes("grant_type=password")).length;
  assertEquals(grants, 3);

  t.advance(1.2);
  const unlocked = await t.call("POST", "/auth/login", { email, password: "VeryStrongPass1!" });
  assertEquals(unlocked.status, 200);
  assertEquals(typeof unlocked.json.access_token, "string");
  assertEquals((await t.store.findUserByEmail(email))!.failedLoginAttempts, 0);
});

Deno.test("auth routes apply stricter route-specific limits than general routes", async () => {
  Deno.env.delete("RATE_LIMIT_DISABLED");
  Deno.env.set("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS", "2");
  const counts = new Map<string, number>();
  const counter = (key: string) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return Promise.resolve(counts.get(key)!);
  };
  try {
    const t = setup({ rateLimit: (req, rule, key) => checkRateLimit(req, rule, key, counter) });
    for (let i = 1; i <= 2; i++) {
      const r = await t.call("POST", "/auth/login", {
        email: "route-limit@example.com",
        password: "VeryStrongPass1!",
      });
      assertEquals(r.status, 401);
    }
    const limited = await t.call("POST", "/auth/login", {
      email: "route-limit@example.com",
      password: "VeryStrongPass1!",
    });
    assertEquals(limited.status, 429);
    assertEquals(limited.json.error, "rate_limited");
    // Register has its own bucket.
    const reg = await t.call("POST", "/auth/register", { email: "x", password: "y" });
    assertEquals(reg.status, 422);
  } finally {
    Deno.env.delete("AUTH_RATE_LIMIT_LOGIN_MAX_REQUESTS");
  }
});

Deno.test("admin bootstrap creates verified pro user for non-production login", async () => {
  const t = setup({
    config: { bootstrap: { email: "builder@example.com", password: "BuilderPass1!", forcePro: true } },
  });
  const login = await t.call("POST", "/auth/login", {
    email: "builder@example.com",
    password: "BuilderPass1!",
  });
  assertEquals(login.status, 200);
  assertEquals(typeof login.json.access_token, "string");
  const user = await t.store.findUserByEmail("builder@example.com");
  assert(user?.verifiedAt);
  assertEquals(await t.store.getUserTier(user.id), "PRO");
  assertEquals(t.fake.byEmail("builder@example.com")?.appMetadata.thesis_test_account, true);
  // Wrong password: the hook does nothing.
  const wrong = await t.call("POST", "/auth/login", {
    email: "builder@example.com",
    password: "WrongPass99!",
  });
  assertEquals(wrong.status, 401);
});

Deno.test("admin bootstrap is ignored in production", () => {
  const keys = ["THESIS_ENV", "ADMIN_BOOTSTRAP_ENABLED", "ADMIN_BOOTSTRAP_EMAIL", "ADMIN_BOOTSTRAP_PASSWORD"];
  const saved = keys.map((k) => Deno.env.get(k));
  try {
    Deno.env.set("ADMIN_BOOTSTRAP_ENABLED", "true");
    Deno.env.set("ADMIN_BOOTSTRAP_EMAIL", "builder@example.com");
    Deno.env.set("ADMIN_BOOTSTRAP_PASSWORD", "BuilderPass1!");
    Deno.env.set("AUTH_EXPOSE_VERIFICATION_TOKEN", "true");
    Deno.env.set("THESIS_ENV", "production");
    assertEquals(authConfig().bootstrap, null);
    assertEquals(authConfig().exposeCodes, false);
    Deno.env.delete("THESIS_ENV");
    assertEquals(authConfig().bootstrap, null);
    Deno.env.set("THESIS_ENV", "development");
    assertEquals(authConfig().bootstrap?.email, "builder@example.com");
    assertEquals(authConfig().exposeCodes, true);
  } finally {
    keys.forEach((k, i) => saved[i] === undefined ? Deno.env.delete(k) : Deno.env.set(k, saved[i]!));
    Deno.env.delete("AUTH_EXPOSE_VERIFICATION_TOKEN");
  }
});

Deno.test("expired or bad refresh tokens are rejected with refresh_failed", async () => {
  const t = setup();
  const r = await t.call("POST", "/auth/refresh", { refresh_token: "not-a-token" });
  assertEquals(r.status, 401);
  assertEquals(r.json.error, "refresh_failed");
  const missing = await t.call("POST", "/auth/refresh", {});
  assertEquals(missing.status, 422);
});

Deno.test("register: 422 rules, 409 for a known email in app.users or in Supabase Auth", async () => {
  const t = setup();
  assertEquals(
    (await t.call("POST", "/auth/register", { email: "bad", password: "VeryStrongPass1!" })).status,
    422,
  );
  assertEquals((await t.call("POST", "/auth/register", { email: "a@b.co", password: "short" })).status, 422);
  const bad = await t.call("POST", "/auth/register", { email: "a@b.co", password: "short" });
  assertEquals(bad.json.error, "validation_failed");

  assertEquals(
    (await t.call("POST", "/auth/register", { email: "Dup@Example.com", password: "VeryStrongPass1!" }))
      .status,
    201,
  );
  const dup = await t.call("POST", "/auth/register", {
    email: "dup@example.com",
    password: "VeryStrongPass1!",
  });
  assertEquals(dup.status, 409);
  assertEquals(dup.json.error, "email_exists");

  // Auth user exists (made in the dashboard) but no app row: GoTrue says exists -> 409, nothing inserted.
  await t.fake.client().adminCreateUser({ email: "orphan@example.com", password: "VeryStrongPass1!" });
  const orphan = await t.call("POST", "/auth/register", {
    email: "orphan@example.com",
    password: "VeryStrongPass1!",
  });
  assertEquals(orphan.status, 409);
  assertEquals(await t.store.findUserByEmail("orphan@example.com"), undefined);
});

Deno.test("register stores one app.users row keyed by the auth user id, no password hash", async () => {
  const t = setup();
  await t.call("POST", "/auth/register", { email: "row@example.com", password: "VeryStrongPass1!" });
  const user = await t.store.findUserByEmail("row@example.com");
  const authUser = t.fake.byEmail("row@example.com");
  assertEquals(user?.id, authUser?.id);
  assertEquals(user?.authUserId, authUser?.id);
  assertEquals(user?.verifiedAt, undefined);
  assertEquals(authUser?.confirmed, false);
});

Deno.test("verify: 422 without token, 400 for bad, reused or wrong-kind codes, 404 without app row", async () => {
  const t = setup();
  assertEquals((await t.call("POST", "/auth/verify", {})).status, 422);
  const bad = await t.call("POST", "/auth/verify", { token: "v1s.deadbeefdeadbeef" });
  assertEquals(bad.status, 400);
  assertEquals(bad.json.error, "invalid_verification_token");
  assertEquals((await t.call("POST", "/auth/verify", { token: "!!" })).status, 400);

  await t.call("POST", "/auth/register", { email: "v@example.com", password: "VeryStrongPass1!" });
  const code = t.lastCode("v@example.com");
  // A reset-tagged code is never accepted here.
  assertEquals((await t.call("POST", "/auth/verify", { token: code.replace("v1s.", "v1r.") })).status, 400);
  // Untagged hash works as a signup confirmation.
  assertEquals((await t.call("POST", "/auth/verify", { token: code.slice(4) })).status, 200);
  assertEquals((await t.call("POST", "/auth/verify", { token: code })).status, 400);

  await t.fake.client().adminCreateUser({ email: "norow@example.com", password: "VeryStrongPass1!" });
  await t.fake.client().resend("signup", "norow@example.com");
  const noRow = await t.call("POST", "/auth/verify", { token: t.lastCode("norow@example.com") });
  assertEquals(noRow.status, 404);
  assertEquals(noRow.json.error, "user_not_found");
});

Deno.test("verify does not leave the Supabase verify session open", async () => {
  const t = setup();
  await registeredVerifiedUser(t, "s@example.com");
  const open = [...t.fake.sessions.values()].filter((s) => !s.revoked);
  assertEquals(open.length, 0);
});

Deno.test("login: 422 rules and 503 when Supabase Auth is down (no failed attempt counted)", async () => {
  const t = setup();
  assertEquals((await t.call("POST", "/auth/login", { email: "x@y.co", password: "short" })).status, 422);
  const id = await registeredVerifiedUser(t, "down@example.com");
  t.fake.failNext["POST /token"] = 500;
  const r = await t.call("POST", "/auth/login", { email: "down@example.com", password: "VeryStrongPass1!" });
  assertEquals(r.status, 503);
  assertEquals((await t.store.findUserById(id))!.failedLoginAttempts, 0);
});

Deno.test("logout: bearer wins over body, refresh token in body works, no token is 401", async () => {
  const t = setup();
  await registeredVerifiedUser(t, "lo@example.com");
  const a = await t.call("POST", "/auth/login", { email: "lo@example.com", password: "VeryStrongPass1!" });
  const b = await t.call("POST", "/auth/login", { email: "lo@example.com", password: "VeryStrongPass1!" });
  const r = await t.call("POST", "/auth/logout", { refresh_token: b.json.refresh_token }, {
    bearer: String(a.json.access_token),
  });
  assertEquals(r.status, 200);
  assertEquals(t.fake.accessValid(String(a.json.access_token)), false);
  assertEquals(t.fake.accessValid(String(b.json.access_token)), true);

  const viaBody = await t.call("POST", "/auth/logout", { refresh_token: b.json.refresh_token });
  assertEquals(viaBody.status, 200);
  assertEquals(t.fake.accessValid(String(b.json.access_token)), false);

  const none = await t.call("POST", "/auth/logout", {});
  assertEquals(none.status, 401);
  assertEquals(none.json.error, "unauthorized");
  const stale = await t.call("POST", "/auth/logout", undefined, { bearer: String(a.json.access_token) });
  assertEquals(stale.status, 401);
});

Deno.test("google routes answer 404 not_found while OIDC is off", async () => {
  const t = setup();
  for (const path of ["/auth/google", "/auth/google/link"]) {
    const r = await t.call("POST", path, { id_token: "x" });
    assertEquals(r.status, 404);
    assertEquals(r.json, { status: "not_found" });
  }
});
