// Password reset: request is always 202; confirm verifies the recovery code with GoTrue, sets the password,
// revokes every session, clears the lockout and marks the user verified.
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { registeredVerifiedUser, setup } from "./test_harness.ts";

const MESSAGE = "If an account exists for this email, we sent a reset code. It expires in 1 hour.";

for (const mode of ["supabase", "resend"] as const) {
  Deno.test(`[${mode}] password reset revokes sessions, clears lockout and allows the new password`, async () => {
    const t = setup({ mode, config: { lockoutMaxFailures: 2 } });
    const email = "reset@example.com";
    await registeredVerifiedUser(t, email);
    const session = await t.call("POST", "/auth/login", { email, password: "VeryStrongPass1!" });
    await t.call("POST", "/auth/login", { email, password: "Wrong-password-1" });
    const lockedRes = await t.call("POST", "/auth/login", { email, password: "Wrong-password-1" });
    assertEquals(lockedRes.status, 423);

    const req = await t.call("POST", "/auth/password-reset/request", { email });
    assertEquals(req.status, 202);
    assertEquals(req.json, { status: "reset_requested", message: MESSAGE });
    const code = t.lastCode(email);
    assert(code.startsWith("v1r."));

    const done = await t.call("POST", "/auth/password-reset/confirm", {
      token: code,
      new_password: "BrandNewPass2!",
    });
    assertEquals(done.status, 200);
    assertEquals(done.json, { status: "password_reset" });
    assertEquals(t.fake.accessValid(String(session.json.access_token)), false);
    const refreshOld = await t.call("POST", "/auth/refresh", { refresh_token: session.json.refresh_token });
    assertEquals(refreshOld.status, 401);

    assertEquals((await t.call("POST", "/auth/login", { email, password: "VeryStrongPass1!" })).status, 401);
    assertEquals((await t.call("POST", "/auth/login", { email, password: "BrandNewPass2!" })).status, 200);
    // Single use.
    const again = await t.call("POST", "/auth/password-reset/confirm", {
      token: code,
      new_password: "Other-Pass-3",
    });
    assertEquals(again.status, 400);
    assertEquals(again.json.error, "invalid_reset_token");
  });
}

Deno.test("password reset request: same 202 for unknown email, no email sent; 422 for bad email", async () => {
  const t = setup({ mode: "resend" });
  const r = await t.call("POST", "/auth/password-reset/request", { email: "nobody@example.com" });
  assertEquals(r.status, 202);
  assertEquals(r.json, { status: "reset_requested", message: MESSAGE });
  assertEquals(t.mail.length, 0);
  assertEquals(t.fake.calls.length, 0);
  const bad = await t.call("POST", "/auth/password-reset/request", { email: "nope" });
  assertEquals(bad.status, 422);
  assertEquals(bad.json.error, "validation_failed");
});

Deno.test("password reset request exposes the code only when allowed and known (resend driver)", async () => {
  const t = setup({ mode: "resend", config: { exposeCodes: true } });
  await registeredVerifiedUser(t, "expose@example.com");
  const r = await t.call("POST", "/auth/password-reset/request", { email: "expose@example.com" });
  assertEquals(r.json.reset_token, t.lastCode("expose@example.com"));
});

Deno.test("password reset confirm marks an unverified user verified", async () => {
  const t = setup();
  await t.call("POST", "/auth/register", { email: "unv@example.com", password: "VeryStrongPass1!" });
  await t.call("POST", "/auth/password-reset/request", { email: "unv@example.com" });
  const r = await t.call("POST", "/auth/password-reset/confirm", {
    token: t.lastCode("unv@example.com"),
    new_password: "BrandNewPass2!",
  });
  assertEquals(r.status, 200);
  assert((await t.store.findUserByEmail("unv@example.com"))?.verifiedAt);
  assertEquals(
    (await t.call("POST", "/auth/login", { email: "unv@example.com", password: "BrandNewPass2!" })).status,
    200,
  );
});

Deno.test("password reset confirm: 422 rules, 400 for bad or wrong-kind codes", async () => {
  const t = setup();
  assertEquals((await t.call("POST", "/auth/password-reset/confirm", { token: "x" })).status, 422);
  assertEquals(
    (await t.call("POST", "/auth/password-reset/confirm", { new_password: "LongEnough1" })).status,
    422,
  );
  const bad = await t.call("POST", "/auth/password-reset/confirm", {
    token: "v1r.abcdefabcdef",
    new_password: "LongEnough1",
  });
  assertEquals(bad.status, 400);
  assertEquals(bad.json.error, "invalid_reset_token");

  await registeredVerifiedUser(t, "kind@example.com");
  await t.call("POST", "/auth/password-reset/request", { email: "kind@example.com" });
  const code = t.lastCode("kind@example.com");
  // A deletion-tagged code is never accepted as a reset code.
  const wrongTag = await t.call("POST", "/auth/password-reset/confirm", {
    token: code.replace("v1r.", "v1d."),
    new_password: "LongEnough1",
  });
  assertEquals(wrongTag.status, 400);
});

Deno.test("password reset takes the 6-digit code with the email (V3)", async () => {
  const t = setup();
  const email = "reset-otp@example.com";
  await registeredVerifiedUser(t, email);
  assertEquals((await t.call("POST", "/auth/password-reset/request", { email })).status, 202);
  const otp = [...t.fake.outbox].reverse().find((e) => e.email === email && e.kind === "recovery")!.otp;
  const res = await t.call("POST", "/auth/password-reset/confirm", {
    token: otp,
    email,
    new_password: "AnotherStrongPass2!",
  });
  assertEquals(res.status, 200);
  const login = await t.call("POST", "/auth/login", { email, password: "AnotherStrongPass2!" });
  assertEquals(login.status, 200);
});
