// Tier limits and date helpers for the user, watchlist and holdings features. Owner: M1.
// Copied from apps/product-api/src/server.ts (watchlistLimitForTier, dailyDeepDiveLimitForTier,
// remainingDeepDives, dateInTimeZone, buildUpgradeRequiredPayload). Pure: no database.
import { env } from "../../_shared/env.ts";
import type { Tier } from "./users.ts";

// Sell monitoring, give away reading: followed names are the paid lever.
export function watchlistLimitForTier(tier: Tier): number {
  return tier === "PRO" ? 50 : 3;
}

// Limit for on-demand Deep Dive generation only. -1 = no limit (no tier uses it now).
// Audit S8: Pro had no limit, so one account could use up the shared daily cap. Pro gets 5 a day by default,
// DEEP_DIVE_PRO_DAILY_LIMIT changes it. A reused report never counts.
export const DEFAULT_PRO_DAILY_DEEP_DIVES = 5;

export function dailyDeepDiveLimitForTier(tier: Tier): number {
  if (tier !== "PRO") return 1;
  const n = Number(env("DEEP_DIVE_PRO_DAILY_LIMIT"));
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_PRO_DAILY_DEEP_DIVES;
}

export function remainingDeepDives(limit: number, usedToday: number): number {
  if (limit < 0) return -1;
  return Math.max(0, limit - usedToday);
}

// Old config: SUBSCRIPTION_TIMEZONE, default America/New_York.
export function subscriptionTimeZone(): string {
  return env("SUBSCRIPTION_TIMEZONE")?.trim() || "America/New_York";
}

// YYYY-MM-DD in the given zone.
export function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function upgradeRequiredBody(feature: string, errorMessage: string): Record<string, unknown> {
  return { error: "upgrade_required", feature, error_message: errorMessage };
}
