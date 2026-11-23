import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { FakeGoTrue } from "../auth/testing.ts";
import { createEmailSender, ResendEmailSender, SupabaseEmailSender } from "./index.ts";

Deno.test("createEmailSender: supabase by default, resend on request", () => {
  const gotrue = new FakeGoTrue().client();
  assertEquals(
    createEmailSender({ mode: undefined, gotrue }).provider,
    Deno.env.get("EMAIL_PROVIDER_MODE") === "resend" ? "resend" : "supabase",
  );
  assertEquals(createEmailSender({ mode: "supabase", gotrue }).provider, "supabase");
  assertEquals(createEmailSender({ mode: "RESEND", gotrue }).provider, "resend");
  assertEquals(createEmailSender({ mode: "resend", gotrue }).deletionCodeSource, "app");
  assertEquals(createEmailSender({ mode: "supabase", gotrue }).deletionCodeSource, "supabase");
});

Deno.test("supabase driver: auth emails go through GoTrue, generic send is unsupported", async () => {
  const fake = new FakeGoTrue();
  const gotrue = fake.client();
  await gotrue.adminCreateUser({ email: "a@example.com", password: "VeryStrongPass1!" });
  const s = new SupabaseEmailSender(gotrue);
  assertEquals((await s.verifyEmail("a@example.com")).delivered, true);
  assertEquals((await s.passwordReset("a@example.com")).delivered, true);
  assertEquals((await s.accountDeletionCode("a@example.com")).delivered, true);
  assertEquals(fake.outbox.map((o) => o.kind), ["signup", "recovery", "magiclink"]);
  assertEquals(fake.calls.slice(1), ["POST /resend", "POST /recover", "POST /otp"]);
  assertEquals(await s.send({ to: "a@example.com", subject: "s", text: "t" }), {
    delivered: false,
    provider: "supabase",
    reason: "unsupported",
  });
});

Deno.test("resend driver posts our text with the tagged token hash", async () => {
  const fake = new FakeGoTrue();
  const gotrue = fake.client();
  await gotrue.adminCreateUser({ email: "b@example.com", password: "VeryStrongPass1!" });
  const posts: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const s = new ResendEmailSender(gotrue, {
    apiKey: "re_key",
    from: "Thesis <no-reply@example.test>",
    fetch: (url, init) => {
      posts.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
  });
  const v = await s.verifyEmail("b@example.com");
  assertEquals(v.delivered, true);
  assertEquals(v.code?.startsWith("v1s."), true);
  assertEquals(posts[0].url, "https://api.resend.com/emails");
  assertEquals(posts[0].headers.get("authorization"), "Bearer re_key");
  assertEquals(posts[0].body.to, ["b@example.com"]);
  assertEquals(posts[0].body.subject, "Verify your Thesis account");
  assertStringIncludes(String(posts[0].body.text), v.code!);

  const r = await s.passwordReset("b@example.com");
  assertEquals(r.code?.startsWith("v1r."), true);
  assertEquals(posts[1].body.subject, "Your Thesis password reset code");

  const d = await s.accountDeletionCode("b@example.com", "own-code");
  assertEquals(d.code, "own-code");
  assertEquals(posts[2].body.subject, "Confirm deletion of your Thesis account");
});

Deno.test("resend driver falls back to a magic link code when the signup link is refused", async () => {
  const fake = new FakeGoTrue();
  const gotrue = fake.client();
  await gotrue.adminCreateUser({ email: "c@example.com", password: "VeryStrongPass1!" });
  fake.failNext["POST /admin/generate_link"] = 422;
  const s = new ResendEmailSender(gotrue, {
    apiKey: "k",
    from: "f@example.test",
    fetch: () => Promise.resolve(new Response("{}")),
  });
  const v = await s.verifyEmail("c@example.com");
  assertEquals(v.code?.startsWith("v1m."), true);
});

Deno.test("resend driver without key or sender reports not_configured; HTTP errors are not delivered", async () => {
  const gotrue = new FakeGoTrue().client();
  const none = new ResendEmailSender(gotrue, {});
  assertEquals((await none.send({ to: "x@example.com", subject: "s", text: "t" })).reason, "not_configured");
  const failing = new ResendEmailSender(gotrue, {
    apiKey: "k",
    from: "f@example.test",
    fetch: () => Promise.resolve(new Response("{}", { status: 422 })),
  });
  assertEquals(await failing.send({ to: "x@example.com", subject: "s", text: "t" }), {
    delivered: false,
    provider: "resend",
    reason: "http_422",
  });
  const down = new ResendEmailSender(gotrue, {
    apiKey: "k",
    from: "f@example.test",
    fetch: () => Promise.reject(new Error("offline")),
  });
  assertEquals((await down.send({ to: "x@example.com", subject: "s", text: "t" })).reason, "network_error");
});
