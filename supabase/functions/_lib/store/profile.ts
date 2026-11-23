// Profile, notification preferences and email preferences. Owner: M1.
// Reads app.subscriptions (M4) and app.deep_dive_daily_usage (M2); never writes them.
// SQL from PostgresStore in apps/product-api.
import { db, iso, newId } from "./common.ts";
import { findUserById, type Tier } from "./users.ts";
import {
  dailyDeepDiveLimitForTier,
  dateInTimeZone,
  remainingDeepDives,
  subscriptionTimeZone,
  watchlistLimitForTier,
} from "./profile_limits.ts";

export const NOTIFICATION_TYPES = [
  "earnings_preview",
  "earnings_war_room",
  "contrarian_alert",
  "kill_switch",
  "freshness_decay",
  "morning_exception_briefing",
  "cross_name_propagation",
  "weekly_digest",
  "market_pulse_ready",
  "filing_change",
  "pulse_email",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export interface SubscriptionInfo {
  tier: Tier;
  billingPeriodEnd?: string;
}

// Read only. A missing row means FREE (the old server inserted a FREE row here; that table is M4's now).
export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const rows = await db()`
    select tier, billing_period_end from subscriptions where user_id = ${userId} limit 1`;
  const row = rows[0];
  if (!row) return { tier: "FREE" };
  return { tier: row.tier === "PRO" ? "PRO" : "FREE", billingPeriodEnd: iso(row.billing_period_end) };
}

export async function getDailyDeepDiveUsage(userId: string, usageDate: string): Promise<number> {
  const rows = await db()`
    select request_count from deep_dive_daily_usage
     where user_id = ${userId} and usage_date = ${usageDate}::date
     limit 1`;
  return rows[0]?.request_count ? Number(rows[0].request_count) : 0;
}

export interface UserProfile {
  user_id: string;
  email: string;
  tier: Tier;
  billing_period_end?: string;
  watchlist_limit: number;
  daily_deep_dive_limit: number;
  deep_dives_remaining_today: number;
}

export interface ProfileSources {
  findUser(userId: string): Promise<{ id: string; email: string } | undefined>;
  subscription(userId: string): Promise<SubscriptionInfo>;
  deepDiveUsage(userId: string, usageDate: string): Promise<number>;
}

export const pgProfileSources: ProfileSources = {
  findUser: findUserById,
  subscription: getSubscription,
  deepDiveUsage: getDailyDeepDiveUsage,
};

// Same fields and order as buildUserProfile in the old server. M4's sync-tier route can reuse it.
export async function buildUserProfile(
  userId: string,
  sources: ProfileSources = pgProfileSources,
  now: Date = new Date(),
): Promise<UserProfile | undefined> {
  const user = await sources.findUser(userId);
  if (!user) return undefined;
  const subscription = await sources.subscription(userId);
  const deepDiveLimit = dailyDeepDiveLimitForTier(subscription.tier);
  const usedToday = deepDiveLimit < 0
    ? 0
    : await sources.deepDiveUsage(userId, dateInTimeZone(now, subscriptionTimeZone()));
  return {
    user_id: user.id,
    email: user.email,
    tier: subscription.tier,
    billing_period_end: subscription.billingPeriodEnd,
    watchlist_limit: watchlistLimitForTier(subscription.tier),
    daily_deep_dive_limit: deepDiveLimit,
    deep_dives_remaining_today: remainingDeepDives(deepDiveLimit, usedToday),
  };
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  quietUntil?: string;
}

export interface NotificationPreferenceUpdate {
  type: NotificationType;
  enabled?: boolean;
  quietUntil?: string | null;
}

// Stored rows only. The view fills in defaults for missing types.
export async function getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  const rows = await db()`select * from notification_preferences where user_id = ${userId}`;
  return rows.map((row) => ({
    type: String(row.notification_type) as NotificationType,
    enabled: Boolean(row.enabled),
    quietUntil: iso(row.quiet_until),
  }));
}

// Setting enabled without quiet_until clears quiet_until (old behaviour).
export async function upsertNotificationPreferences(
  userId: string,
  updates: NotificationPreferenceUpdate[],
  updatedAt: string,
): Promise<NotificationPreference[]> {
  const sql = db();
  for (const p of updates) {
    const enabledProvided = typeof p.enabled === "boolean";
    const quietProvided = p.quietUntil !== undefined || enabledProvided;
    const quietValue = p.quietUntil !== undefined ? p.quietUntil : null;
    const enabledValue = enabledProvided ? p.enabled! : null;
    await sql`
      insert into notification_preferences (id, user_id, notification_type, enabled, quiet_until, updated_at, created_at)
      values (${newId()}, ${userId}, ${p.type}, coalesce(${enabledValue}::boolean, true),
              ${quietValue}::timestamptz, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz)
      on conflict (user_id, notification_type) do update set
        enabled = case
          when ${enabledProvided}::boolean then coalesce(${enabledValue}::boolean, notification_preferences.enabled)
          else notification_preferences.enabled
        end,
        quiet_until = case
          when ${quietProvided}::boolean then ${quietValue}::timestamptz
          else notification_preferences.quiet_until
        end,
        updated_at = ${updatedAt}::timestamptz`;
  }
  return getNotificationPreferences(userId);
}

export async function getEmailOptOut(userId: string): Promise<boolean> {
  const rows = await db()`select email_opt_out from user_email_preferences where user_id = ${userId}`;
  return rows[0]?.email_opt_out === true;
}

export async function setEmailOptOut(userId: string, optOut: boolean, updatedAt: string): Promise<void> {
  await db()`
    insert into user_email_preferences (user_id, email_opt_out, updated_at)
    values (${userId}, ${optOut}, ${updatedAt}::timestamptz)
    on conflict (user_id) do update
      set email_opt_out = excluded.email_opt_out,
          updated_at = excluded.updated_at`;
}
