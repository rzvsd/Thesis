// Account deletion: DELETE /v1/account and the web delete-account flow. The old server had no tests for
// these routes; these follow apps/product-api/src/routes/account-routes.ts.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { registeredVerifiedUser, setup } from "../auth/test_harness.ts";
import { STORE_SUBSCRIPTION_NOTICE } from "./delete.ts";

Deno.test("DELETE /v1/account deletes the auth user, app rows and files; FREE has no store notice", async () => {
  const t = setup();
  const id = await registeredVerifiedUser(t, "del@example.com");
  const login = await t.call("POST", "/auth/login", {
    email: "del@example.com",
    password: "VeryStrongPass1!",
  });
  const r = await t.call("DELETE", "/v1/account", undefined, { userId: id });
  assertEquals(r.status, 200);
  assertEquals(r.json, { status: "deleted" });
  assertEquals(t.fake.users.has(id), false);
  assertEquals(t.fake.accessValid(String(login.json.access_token)), false);
  assertEquals(await t.store.findUserById(id), undefined);
  assertEquals(t.store.strippedUserIds, [id]);
  assertEquals(t.store.deletedUserIds, [id]);
  assertEquals(t.filesDeleted, [id]);
  const audit = t.store.audit.find((a) => a.eventType === "account.deleted");
  assertEquals(audit?.userId, undefined);
  assertEquals(audit?.payload, { deleted_user_id: id, via: "app", had_paid_tier: false });
  // The email is free again.
  assertEquals(
    (await t.call("POST", "/auth/register", { email: "del@example.com", password: "VeryStrongPass1!" }))
      .status,
    201,
  );
});

Deno.test("DELETE /v1/account returns the store subscription notice for a paid tier", async () => {
  const t = setup();
  const id = await registeredVerifiedUser(t, "pro@example.com");
  await t.store.setProTier(id);
  const r = await t.call("DELETE", "/v1/account", undefined, { userId: id });
  assertEquals(r.json, { status: "deleted", store_subscription_notice: STORE_SUBSCRIPTION_NOTICE });
});

Deno.test("DELETE /v1/account fails (500 via app.ts) and keeps app rows when the auth delete fails", async () => {
  const t = setup();
  const id = await registeredVerifiedUser(t, "keep@example.com");
  t.fake.failNext[`DELETE /admin/users/${id}`] = 500;
  let threw = false;
  try {
    await t.call("DELETE", "/v1/account", undefined, { userId: id });
  } catch {
    threw = true;
  }
  assert(threw);
  assert(await t.store.findUserById(id));
});

Deno.test("GET /auth/delete-account renders the old form posting to the absolute path", async () => {
  const t = setup();
  const r = await t.call("GET", "/auth/delete-account");
  assertEquals(r.status, 200);
  assertEquals(r.res.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(r.res.headers.get("x-thesis-content-type"), "text/html; charset=utf-8");
  assertEquals(r.res.headers.get("cache-control"), "no-store");
  assertStringIncludes(r.res.headers.get("x-thesis-csp") ?? "", "form-action 'self'");
  assertStringIncludes(r.text, "<title>Delete your Thesis account</title>");
  assertStringIncludes(r.text, `<form method="post" action="/auth/delete-account">`);
  assertStringIncludes(r.text, `name="email"`);
  assertStringIncludes(r.text, STORE_SUBSCRIPTION_NOTICE);
});

Deno.test("POST /auth/delete-account: 422 HTML for a bad email, same page for known and unknown", async () => {
  const t = setup({ mode: "resend" });
  const bad = await t.call("POST", "/auth/delete-account", undefined, { form: { email: "nope" } });
  assertEquals(bad.status, 422);
  assertStringIncludes(bad.text, "Please enter a valid email.");

  await registeredVerifiedUser(t, "web@example.com");
  const sentBefore = t.mail.length;
  const unknown = await t.call("POST", "/auth/delete-account", undefined, {
    form: { email: "ghost@example.com" },
  });
  const known = await t.call("POST", "/auth/delete-account", undefined, {
    form: { email: "Web@Example.com" },
  });
  assertEquals(unknown.status, 200);
  assertEquals(known.status, 200);
  assertEquals(unknown.text, known.text);
  assertStringIncludes(known.text, `<form method="post" action="/auth/delete-account/confirm">`);
  assertEquals(t.mail.length, sentBefore + 1);
  assertEquals(t.mail.at(-1)?.subject, "Confirm deletion of your Thesis account");
});

Deno.test("[resend] web deletion with our own code: single use, then the account is gone", async () => {
  const t = setup({ mode: "resend" });
  const id = await registeredVerifiedUser(t, "own@example.com");
  await t.call("POST", "/auth/delete-account", undefined, { form: { email: "own@example.com" } });
  const code = t.lastCode("own@example.com");
  assertEquals(t.store.tokens.length, 1);
  assert(t.store.tokens[0].tokenHash !== code); // stored hashed
  const r = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: { token: code } });
  assertEquals(r.status, 200);
  assertStringIncludes(r.text, "Your Thesis account and its personal data have been deleted.");
  assertEquals(t.fake.users.has(id), false);
  assertEquals(await t.store.findUserById(id), undefined);
  const again = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: { token: code } });
  assertEquals(again.status, 400);
  assertStringIncludes(again.text, "The confirmation code is invalid or expired.");
});

Deno.test("[resend] a new deletion code supersedes the old one", async () => {
  const t = setup({ mode: "resend" });
  await registeredVerifiedUser(t, "sup@example.com");
  await t.call("POST", "/auth/delete-account", undefined, { form: { email: "sup@example.com" } });
  const first = t.lastCode("sup@example.com");
  await t.call("POST", "/auth/delete-account", undefined, { form: { email: "sup@example.com" } });
  const r = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: { token: first } });
  assertEquals(r.status, 400);
});

Deno.test("[supabase] web deletion uses a Supabase magic link OTP tagged v1d", async () => {
  const t = setup({ mode: "supabase" });
  const id = await registeredVerifiedUser(t, "sb@example.com");
  await t.call("POST", "/auth/delete-account", undefined, { form: { email: "sb@example.com" } });
  const code = t.lastCode("sb@example.com");
  assert(code.startsWith("v1d."));
  assertEquals(t.store.tokens.length, 0);
  assert(t.fake.calls.some((c) => c.startsWith("POST /otp")));
  const r = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: { token: code } });
  assertEquals(r.status, 200);
  assertEquals(t.fake.users.has(id), false);
});

Deno.test("delete confirm rejects a password reset code and empty input", async () => {
  const t = setup({ mode: "supabase" });
  const id = await registeredVerifiedUser(t, "mix@example.com");
  await t.call("POST", "/auth/password-reset/request", { email: "mix@example.com" });
  const reset = t.lastCode("mix@example.com");
  const r = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: { token: reset } });
  assertEquals(r.status, 400);
  const empty = await t.call("POST", "/auth/delete-account/confirm", undefined, { form: {} });
  assertEquals(empty.status, 400);
  assert(t.fake.users.has(id));
});
