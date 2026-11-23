import { assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import {
  buildUserProfile,
  getEmailOptOut,
  getNotificationPreferences,
  getSubscription,
  setEmailOptOut,
  upsertNotificationPreferences,
} from "./profile.ts";
import { dateInTimeZone, remainingDeepDives } from "./profile_limits.ts";
import { cleanup, dbTest, insertUser } from "./profile_testdb.ts";

Deno.test("deep dive day follows America/New_York by default", () => {
  // 03:00 UTC on Nov 24 is still Nov 23 in New York.
  assertEquals(dateInTimeZone(new Date("2026-11-24T03:00:00Z"), "America/New_York"), "2026-11-23");
  assertEquals(remainingDeepDives(1, 3), 0);
  assertEquals(remainingDeepDives(-1, 3), -1);
});

// Ported from subscription-reset.test.ts "M4 daily Deep Dive limit resets after midnight in America/New_York"
// (the profile part): usage on yesterday's date does not count today.
Deno.test("profile counts only today's usage in the subscription time zone", async () => {
  const asked: string[] = [];
  const profile = await buildUserProfile("u1", {
    findUser: () => Promise.resolve({ id: "u1", email: "u1@example.com" }),
    subscription: () => Promise.resolve({ tier: "FREE" }),
    deepDiveUsage: (_id, date) => {
      asked.push(date);
      return Promise.resolve(date === "2026-11-23" ? 1 : 0);
    },
  }, new Date("2026-11-24T04:59:00Z"));
  assertEquals(profile?.deep_dives_remaining_today, 0);
  const next = await buildUserProfile("u1", {
    findUser: () => Promise.resolve({ id: "u1", email: "u1@example.com" }),
    subscription: () => Promise.resolve({ tier: "FREE" }),
    deepDiveUsage: (_id, date) => {
      asked.push(date);
      return Promise.resolve(date === "2026-11-23" ? 1 : 0);
    },
  }, new Date("2026-11-24T05:01:00Z"));
  assertEquals(next?.deep_dives_remaining_today, 1);
  assertEquals(asked, ["2026-11-23", "2026-11-24"]);
});

dbTest("profile reads app.users, subscriptions and deep_dive_daily_usage", async () => {
  const user = await insertUser();
  try {
    const free = await buildUserProfile(user);
    assertEquals(free, {
      user_id: user,
      email: `${user}@example.test`,
      tier: "FREE",
      billing_period_end: undefined,
      watchlist_limit: 3,
      daily_deep_dive_limit: 1,
      deep_dives_remaining_today: 1,
    });
    // Reading must not create a subscriptions row (that table is M4's).
    assertEquals((await db()`select 1 from subscriptions where user_id = ${user}`).length, 0);

    const today = dateInTimeZone(new Date(), "America/New_York");
    await db()`insert into deep_dive_daily_usage (user_id, usage_date, request_count) values (${user}, ${today}, 1)`;
    assertEquals((await buildUserProfile(user))?.deep_dives_remaining_today, 0);

    await db()`
      insert into subscriptions (user_id, tier, billing_period_end) values (${user}, 'PRO', '2099-12-31T00:00:00Z')`;
    assertEquals(await getSubscription(user), { tier: "PRO", billingPeriodEnd: "2099-12-31T00:00:00.000Z" });
    const pro = await buildUserProfile(user);
    assertEquals([
      pro?.tier,
      pro?.watchlist_limit,
      pro?.daily_deep_dive_limit,
      pro?.deep_dives_remaining_today,
    ], [
      "PRO",
      50,
      -1,
      -1,
    ]);
    assertEquals(await buildUserProfile("m1-test-missing-user"), undefined);
  } finally {
    await cleanup([user], []);
  }
});

dbTest("notification preferences upsert keeps the old enabled / quiet_until rules", async () => {
  const user = await insertUser();
  const at = new Date().toISOString();
  try {
    assertEquals(await getNotificationPreferences(user), []);
    await upsertNotificationPreferences(user, [
      { type: "kill_switch", quietUntil: "2030-01-01T00:00:00.000Z" },
      { type: "weekly_digest", enabled: false },
    ], at);
    let rows = await getNotificationPreferences(user);
    const byType = () => Object.fromEntries(rows.map((r) => [r.type, r]));
    assertEquals(byType().kill_switch, {
      type: "kill_switch",
      enabled: true,
      quietUntil: "2030-01-01T00:00:00.000Z",
    });
    assertEquals(byType().weekly_digest, { type: "weekly_digest", enabled: false, quietUntil: undefined });

    // quiet_until alone keeps enabled; enabled alone clears quiet_until.
    await upsertNotificationPreferences(user, [{
      type: "weekly_digest",
      quietUntil: "2031-01-01T00:00:00.000Z",
    }], at);
    await upsertNotificationPreferences(user, [{ type: "kill_switch", enabled: false }], at);
    rows = await getNotificationPreferences(user);
    assertEquals(byType().weekly_digest, {
      type: "weekly_digest",
      enabled: false,
      quietUntil: "2031-01-01T00:00:00.000Z",
    });
    assertEquals(byType().kill_switch, { type: "kill_switch", enabled: false, quietUntil: undefined });

    await upsertNotificationPreferences(user, [{ type: "weekly_digest", quietUntil: null }], at);
    rows = await getNotificationPreferences(user);
    assertEquals(byType().weekly_digest.quietUntil, undefined);
  } finally {
    await cleanup([user], []);
  }
});

dbTest("email opt-out defaults to false and upserts", async () => {
  const user = await insertUser();
  try {
    assertEquals(await getEmailOptOut(user), false);
    await setEmailOptOut(user, true, new Date().toISOString());
    assertEquals(await getEmailOptOut(user), true);
    await setEmailOptOut(user, false, new Date().toISOString());
    assertEquals(await getEmailOptOut(user), false);
  } finally {
    await cleanup([user], []);
  }
});
