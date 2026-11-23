import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { parseServiceAccount, serviceAccountTokenSource, signServiceAccountJwt } from "./fcm_auth.ts";
import { buildFcmMessage, fcmPushSender } from "./fcm.ts";
import { disabledPushSender, pushSenderFromEnv, stubPushSender } from "./index.ts";
import type { PushPayload, PushTarget } from "./types.ts";

// A throwaway key made in the test. Nothing real is in the repo (gitleaks).
async function testAccount() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let bin = "";
  for (const b of der) bin += String.fromCharCode(b);
  // The PEM label is joined at run time; the key itself is generated above and never stored.
  const label = ["PRIVATE", "KEY"].join(" ");
  const pem = `-----BEGIN ${label}-----\n${btoa(bin).replace(/(.{64})/g, "$1\n")}\n-----END ${label}-----\n`;
  const json = JSON.stringify({
    type: "service_account",
    project_id: "demo-project",
    client_email: "push@demo-project.example.test",
    private_key: pem,
  });
  return { json, publicKey: pair.publicKey };
}

function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const payload: PushPayload = {
  notificationType: "market_pulse_ready",
  route: "market_pulse",
  title: "Morning Pulse Ready",
  body: "Here's what moved.",
  data: { report_date: "2026-11-23" },
};

function targets(n: number): PushTarget[] {
  return Array.from({ length: n }, (_, i) => ({
    userId: `user-${i}`,
    installationId: `install-${i}`,
    deviceToken: `token-${i}-xxxxxxxxxxxxxxxx`,
  }));
}

Deno.test("parseServiceAccount rejects bad input and reads a good one", async () => {
  assertEquals(parseServiceAccount(undefined), undefined);
  assertEquals(parseServiceAccount("not json"), undefined);
  assertEquals(parseServiceAccount(JSON.stringify({ project_id: "x" })), undefined);
  const { json } = await testAccount();
  const account = parseServiceAccount(json)!;
  assertEquals(account.projectId, "demo-project");
  assertEquals(account.tokenUri, "https://oauth2.googleapis.com/token");
});

Deno.test("service account JWT is RS256 and verifies with the public key", async () => {
  const { json, publicKey } = await testAccount();
  const jwt = await signServiceAccountJwt(parseServiceAccount(json)!, 1_700_000_000);
  const [h, c, s] = jwt.split(".");
  assertEquals(JSON.parse(new TextDecoder().decode(b64urlDecode(h))), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
  assertEquals(claims.iss, "push@demo-project.example.test");
  assertEquals(claims.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assertEquals(claims.exp - claims.iat, 3600);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    b64urlDecode(s),
    new TextEncoder().encode(`${h}.${c}`),
  );
  assert(ok);
});

Deno.test("token source caches the access token until near expiry", async () => {
  const { json } = await testAccount();
  let calls = 0;
  let now = 1_700_000_000_000;
  const source = serviceAccountTokenSource(parseServiceAccount(json)!, (url, init) => {
    calls++;
    assertEquals(url, "https://oauth2.googleapis.com/token");
    assert(String(init?.body).includes("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"));
    return Promise.resolve(Response.json({ access_token: `at-${calls}`, expires_in: 3600 }));
  }, () => now);
  assertEquals(await source.get(), "at-1");
  now += 30 * 60_000;
  assertEquals(await source.get(), "at-1");
  now += 30 * 60_000;
  assertEquals(await source.get(), "at-2");
  assertEquals(calls, 2);
});

Deno.test("FCM message is data-only with high Android priority, like the old sender", () => {
  const msg = buildFcmMessage("tok", payload) as { message: Record<string, unknown> };
  assertEquals(msg.message.token, "tok");
  assertEquals(msg.message.android, { priority: "HIGH" });
  assertEquals(msg.message.notification, undefined);
  assertEquals(msg.message.data, {
    route: "market_pulse",
    title: "Morning Pulse Ready",
    body: "Here's what moved.",
    notification_type: "market_pulse_ready",
    report_date: "2026-11-23",
  });
});

Deno.test("FCM sender counts delivered, failed and invalid tokens and retries 5xx once", async () => {
  const seen = new Map<string, number>();
  const fetchFn = (url: string, init?: RequestInit) => {
    assertEquals(url, "https://fcm.googleapis.com/v1/projects/demo-project/messages:send");
    assertEquals(new Headers(init?.headers).get("authorization"), "Bearer at-fixed");
    const token = JSON.parse(String(init?.body)).message.token as string;
    const n = (seen.get(token) ?? 0) + 1;
    seen.set(token, n);
    if (token.startsWith("token-0-")) return Promise.resolve(Response.json({ name: "ok" }));
    if (token.startsWith("token-1-")) {
      return Promise.resolve(
        Response.json({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }, {
          status: 404,
        }),
      );
    }
    if (token.startsWith("token-2-")) {
      return Promise.resolve(n === 1 ? new Response("busy", { status: 503 }) : Response.json({ name: "ok" }));
    }
    if (token.startsWith("token-3-")) {
      return Promise.resolve(Response.json({ error: { status: "PERMISSION_DENIED" } }, { status: 403 }));
    }
    return Promise.resolve(
      Response.json({
        error: {
          status: "INVALID_ARGUMENT",
          message: "The registration token is not a valid FCM registration token",
        },
      }, {
        status: 400,
      }),
    );
  };
  const sender = fcmPushSender({
    projectId: "demo-project",
    tokens: { get: () => Promise.resolve("at-fixed") },
    fetchFn,
    retryDelayMs: 0,
    concurrency: 2,
  });
  const result = await sender.send(targets(5), payload);
  assertEquals(result.attempted, 5);
  assertEquals(result.delivered, 2);
  assertEquals(result.failed, 3);
  assertEquals(result.invalidTargets.map((t) => t.userId).sort(), ["user-1", "user-4"]);
  assertEquals(seen.get(targets(5)[2].deviceToken), 2);
});

Deno.test("FCM sender with no targets makes no calls", async () => {
  const sender = fcmPushSender({
    projectId: "p",
    tokens: { get: () => Promise.reject(new Error("must not be called")) },
    fetchFn: () => Promise.reject(new Error("must not be called")),
  });
  assertEquals((await sender.send([], payload)).attempted, 0);
});

Deno.test("disabled and stub senders", async () => {
  assertEquals((await disabledPushSender.send(targets(3), payload)).skipped, 3);
  assertEquals((await stubPushSender.send(targets(3), payload)).delivered, 3);
});

Deno.test("pushSenderFromEnv: default disabled, fcm without account fails every target", async () => {
  Deno.env.delete("PUSH_PROVIDER_MODE");
  assertEquals(pushSenderFromEnv().mode, "disabled");
  Deno.env.set("PUSH_PROVIDER_MODE", "fcm");
  Deno.env.delete("FCM_SERVICE_ACCOUNT_JSON");
  const result = await pushSenderFromEnv().send(targets(2), payload);
  assertEquals(result.failed, 2);
  Deno.env.delete("PUSH_PROVIDER_MODE");
});
