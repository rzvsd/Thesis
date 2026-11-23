// app.subscriptions reads and writes. Owner: M4 (the table is M4's, OWNERSHIP.md).
// SQL copied from apps/product-api/src/store.ts (getUserSubscription, findUserIdByRevenuecatAppUserId,
// upsertUserSubscription).
import { db, iso } from "../store/common.ts";
import type { SubscriptionRecord } from "./revenuecat.ts";

function mapSubscription(userId: string, row: Record<string, unknown> | undefined): SubscriptionRecord {
  if (!row) return { userId, tier: "FREE" };
  return {
    userId,
    tier: row.tier === "PRO" ? "PRO" : "FREE",
    billingPeriodEnd: iso(row.billing_period_end),
    revenuecatAppUserId: row.revenuecat_app_user_id ? String(row.revenuecat_app_user_id) : undefined,
  };
}

// Like the old store: creates the FREE row when it is missing.
export async function getUserSubscription(userId: string): Promise<SubscriptionRecord> {
  const sql = db();
  await sql`
    insert into subscriptions (user_id, tier, updated_at) values (${userId}, 'FREE', now())
    on conflict (user_id) do nothing`;
  const rows = await sql`select * from subscriptions where user_id = ${userId} limit 1`;
  return mapSubscription(userId, rows[0]);
}

export async function findUserIdByRevenuecatAppUserId(appUserId: string): Promise<string | undefined> {
  const rows = await db()`
    select user_id from subscriptions where revenuecat_app_user_id = ${appUserId} limit 1`;
  return rows[0] ? String(rows[0].user_id) : undefined;
}

export async function upsertUserSubscription(
  input: SubscriptionRecord & { updatedAt: string },
): Promise<SubscriptionRecord> {
  const rows = await db()`
    insert into subscriptions (user_id, tier, revenuecat_app_user_id, billing_period_end, created_at, updated_at)
    values (${input.userId}, ${input.tier}, ${input.revenuecatAppUserId?.trim() || null}, ${
    input.billingPeriodEnd ?? null
  },
            ${input.updatedAt}, ${input.updatedAt})
    on conflict (user_id) do update set
      tier = excluded.tier,
      revenuecat_app_user_id = coalesce(excluded.revenuecat_app_user_id, subscriptions.revenuecat_app_user_id),
      billing_period_end = excluded.billing_period_end,
      updated_at = excluded.updated_at
    returning *`;
  return mapSubscription(input.userId, rows[0]);
}
