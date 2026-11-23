import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import {
  fetchRevenueCatSubscriberSnapshot,
  hashRevenueCatAppUserId,
  parseRevenueCatWebhookEvent,
  verifyRevenueCatWebhookSecret,
} from "./revenuecat.ts";

const config = {
  serverApiKey: "test-only-key",
  entitlementId: "pro",
  apiBaseUrl: "https://rc.example.test/v1/",
};
const NOW = Date.parse("2026-11-23T00:00:00Z");

Deno.test("parse webhook: nested event, ms and iso expirations, upper-cased type", () => {
  assertEquals(
    parseRevenueCatWebhookEvent({
      event: { type: "renewal", app_user_id: " u1 ", expiration_at_ms: "1795000000000" },
    }),
    {
      eventType: "RENEWAL",
      appUserId: "u1",
      billingPeriodEnd: new Date(1795000000000).toISOString(),
    },
  );
  assertEquals(
    parseRevenueCatWebhookEvent({ event_type: "EXPIRATION", original_app_user_id: "u2" })?.appUserId,
    "u2",
  );
  assertEquals(parseRevenueCatWebhookEvent([]), undefined);
  assertEquals(parseRevenueCatWebhookEvent({ event: { type: "RENEWAL" } }), undefined);
});

Deno.test("secret check", () => {
  assertEquals(verifyRevenueCatWebhookSecret("Bearer s3", "s3"), true);
  assertEquals(verifyRevenueCatWebhookSecret("s3", "s3"), true);
  assertEquals(verifyRevenueCatWebhookSecret("Bearer s4", "s3"), false);
  assertEquals(verifyRevenueCatWebhookSecret(null, "s3"), false);
  assertEquals(verifyRevenueCatWebhookSecret("Bearer s3", undefined), false);
});

Deno.test("snapshot: active entitlement is PRO, expired is FREE, missing is FREE", async () => {
  const answer = (entitlements: unknown) => (url: string, init?: RequestInit) => {
    assertEquals(url, "https://rc.example.test/v1/subscribers/user%201");
    assertEquals(new Headers(init?.headers).get("authorization"), "Bearer test-only-key");
    return Promise.resolve(Response.json({ subscriber: { entitlements } }));
  };
  const active = await fetchRevenueCatSubscriberSnapshot(
    config,
    "user 1",
    answer({ pro: { expires_date: "2026-12-01T00:00:00Z" } }),
    NOW,
  );
  assertEquals(active, { appUserId: "user 1", tier: "PRO", billingPeriodEnd: "2026-12-01T00:00:00.000Z" });
  const expired = await fetchRevenueCatSubscriberSnapshot(
    config,
    "user 1",
    answer({ pro: { expires_date: "2026-11-01T00:00:00Z" } }),
    NOW,
  );
  assertEquals(expired.tier, "FREE");
  assertEquals((await fetchRevenueCatSubscriberSnapshot(config, "user 1", answer({}), NOW)).tier, "FREE");
});

Deno.test("snapshot: missing config or HTTP error throws", async () => {
  await assertRejects(() => fetchRevenueCatSubscriberSnapshot({ apiBaseUrl: "x" }, "u"));
  await assertRejects(() =>
    fetchRevenueCatSubscriberSnapshot(config, "u", () => Promise.resolve(new Response("no", { status: 500 })))
  );
});

Deno.test("hash is 16 hex chars and stable", async () => {
  const h = await hashRevenueCatAppUserId("user-1");
  assertEquals(h.length, 16);
  assertEquals(h, await hashRevenueCatAppUserId("user-1"));
});
