import { assertEquals } from "jsr:@std/assert@1.0.13";
import { call, FakeStore } from "./test_fakes.ts";
import { userRoutes } from "./index.ts";
import { NOTIFICATION_TYPES } from "../../../_lib/store/profile.ts";
import { apiError } from "../../../_shared/http.ts";

function setup() {
  const store = new FakeStore();
  store.addUser("u1", "u1@example.com");
  return { store, routes: userRoutes(store.userDeps()) };
}

// Ported from subscription.test.ts "M4 subscriptions enforce Free/Pro gating and tier updates" (profile parts).
Deno.test("profile returns FREE limits, then PRO limits with billing_period_end", async () => {
  const { store, routes } = setup();
  const free = await call(routes, "GET", "/v1/user/profile", { userId: "u1" });
  assertEquals(free.status, 200);
  assertEquals(free.body.data, {
    user_id: "u1",
    email: "u1@example.com",
    tier: "FREE",
    watchlist_limit: 3,
    daily_deep_dive_limit: 1,
    deep_dives_remaining_today: 1,
  });

  store.usage.set("u1", 1);
  const used = await call(routes, "GET", "/v1/user/profile", { userId: "u1" });
  assertEquals((used.body.data as Record<string, unknown>).deep_dives_remaining_today, 0);

  store.tiers.set("u1", "PRO");
  store.billingEnd.set("u1", "2099-12-31T00:00:00.000Z");
  const pro = await call(routes, "GET", "/v1/user/profile", { userId: "u1" });
  assertEquals(pro.body.data, {
    user_id: "u1",
    email: "u1@example.com",
    tier: "PRO",
    billing_period_end: "2099-12-31T00:00:00.000Z",
    watchlist_limit: 50,
    daily_deep_dive_limit: 5,
    deep_dives_remaining_today: 4,
  });
});

Deno.test("profile is 404 user_not_found without an app.users row", async () => {
  const { routes } = setup();
  const res = await call(routes, "GET", "/v1/user/profile", { userId: "ghost" });
  assertEquals(res.status, 404);
  assertEquals(res.body.error, "user_not_found");
});

// Ported from m5-notifications.test.ts "notification preferences endpoints return and update all M5 notification types".
Deno.test("notification preferences return every type and update one", async () => {
  const { routes } = setup();
  const initial = await call(routes, "GET", "/v1/user/notification-preferences", { userId: "u1" });
  assertEquals(initial.status, 200);
  const data = initial.body.data as { user_id: string; tier: string; preferences: { enabled: boolean }[] };
  assertEquals(data.user_id, "u1");
  assertEquals(data.tier, "FREE");
  assertEquals(data.preferences.length, NOTIFICATION_TYPES.length);
  assertEquals(data.preferences.every((p) => p.enabled), true);

  const updated = await call(routes, "PUT", "/v1/user/notification-preferences", {
    userId: "u1",
    body: {
      preferences: [
        { type: "weekly_digest", enabled: false },
        { type: "kill_switch", quiet_until: "2030-01-01T00:00:00Z" },
      ],
    },
  });
  assertEquals(updated.status, 200);
  const prefs = (updated.body.data as { preferences: Record<string, unknown>[] }).preferences;
  assertEquals(prefs.length, NOTIFICATION_TYPES.length);
  assertEquals(prefs.find((p) => p.type === "weekly_digest"), { type: "weekly_digest", enabled: false });
  assertEquals(prefs.find((p) => p.type === "kill_switch"), {
    type: "kill_switch",
    enabled: true,
    quiet_until: "2030-01-01T00:00:00.000Z",
  });
});

Deno.test("notification preferences PUT returns 422 for bad input", async () => {
  const { routes } = setup();
  const cases: [unknown, string][] = [
    [{}, "preferences must include at least one notification type update."],
    [{ preferences: [] }, "preferences must include at least one notification type update."],
    [{ preferences: [{ type: "nope", enabled: true }] }, "Unsupported notification type: nope"],
    [{ preferences: [{ enabled: true }] }, "Unsupported notification type: (empty)"],
    [
      { preferences: [{ type: "weekly_digest" }] },
      "preferences for type weekly_digest must include enabled or quiet_until.",
    ],
    [
      { preferences: [{ type: "weekly_digest", enabled: "no", quiet_until: null }] },
      "enabled must be boolean for type weekly_digest.",
    ],
    // Old order: with no quiet_until, a non-boolean enabled reports the missing-field message.
    [
      { preferences: [{ type: "weekly_digest", enabled: "no" }] },
      "preferences for type weekly_digest must include enabled or quiet_until.",
    ],
    [
      { preferences: [{ type: "weekly_digest", quiet_until: "not a date" }] },
      "quiet_until must be a valid ISO timestamp or null for type weekly_digest.",
    ],
  ];
  for (const [body, message] of cases) {
    const res = await call(routes, "PUT", "/v1/user/notification-preferences", { userId: "u1", body });
    assertEquals(res.status, 422);
    assertEquals(res.body, { error: "validation_failed", error_message: message });
  }
});

Deno.test("quiet_until null clears it", async () => {
  const { routes } = setup();
  await call(routes, "PUT", "/v1/user/notification-preferences", {
    userId: "u1",
    body: { preferences: [{ type: "kill_switch", quiet_until: "2030-01-01T00:00:00Z" }] },
  });
  const res = await call(routes, "PUT", "/v1/user/notification-preferences", {
    userId: "u1",
    body: { preferences: [{ type: "kill_switch", quiet_until: null }] },
  });
  const prefs = (res.body.data as { preferences: Record<string, unknown>[] }).preferences;
  assertEquals(prefs.find((p) => p.type === "kill_switch"), { type: "kill_switch", enabled: true });
});

Deno.test("email preferences default to false, update, and reject non-booleans", async () => {
  const { routes } = setup();
  const initial = await call(routes, "GET", "/v1/user/email-preferences", { userId: "u1" });
  assertEquals(initial, { status: 200, body: { data: { email_opt_out: false } } });
  const put = await call(routes, "PUT", "/v1/user/email-preferences", {
    userId: "u1",
    body: { email_opt_out: true },
  });
  assertEquals(put, { status: 200, body: { data: { email_opt_out: true } } });
  const bad = await call(routes, "PUT", "/v1/user/email-preferences", {
    userId: "u1",
    body: { email_opt_out: "yes" },
  });
  assertEquals(bad.status, 422);
  assertEquals(bad.body.error_message, "email_opt_out must be boolean.");
});

Deno.test("a body over MAX_JSON_BODY_BYTES is 413 payload_too_large", async () => {
  const { routes } = setup();
  Deno.env.set("MAX_JSON_BODY_BYTES", "64");
  try {
    const res = await call(routes, "PUT", "/v1/user/email-preferences", {
      userId: "u1",
      body: { email_opt_out: true, pad: "x".repeat(100) },
    });
    assertEquals(res.status, 413);
    assertEquals(res.body, { error: "payload_too_large", error_message: "JSON body must be <= 64 bytes." });
  } finally {
    Deno.env.delete("MAX_JSON_BODY_BYTES");
  }
});

Deno.test("the rate limiter runs first and gets the path as bucket", async () => {
  const store = new FakeStore();
  store.addUser("u1");
  const keys: string[] = [];
  const routes = userRoutes({
    ...store.userDeps(),
    limit: (_req, key) => {
      keys.push(key);
      return Promise.resolve(apiError(429, "rate_limited", "Too many requests.", { retry_after_seconds: 3 }));
    },
  });
  const res = await call(routes, "GET", "/v1/user/profile/", { userId: "u1" });
  assertEquals(res.status, 429);
  assertEquals(res.body.retry_after_seconds, 3);
  assertEquals(keys, ["/v1/user/profile"]);
});
