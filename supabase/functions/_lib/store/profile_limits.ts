// Tier limits and date helpers for the user, watchlist and holdings features. Owner: M1.
// Copied from apps/product-api/src/server.ts (watchlistLimitForTier, dailyDeepDiveLimitForTier,
// remainingDeepDives, dateInTimeZone, buildUpgradeRequiredPayload). Pure: no database.
import { env } from "../../_shared/env.ts";
import type { Tier } from "./users.ts";

// Sell monitoring, give away reading: followed names are the paid lever.
export function watchlistLimitForTier(tier: Tier): number {
  return tier === "PRO" ? 50 : 3;
}

// Limit for on-demand Deep Dive generation only. -1 = no limit.
export function dailyDeepDiveLimitForTier(tier: Tier): number {
  return tier === "PRO" ? -1 : 1;
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
