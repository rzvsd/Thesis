import type { SubscriptionTier } from "./subscription-tier";

export interface UserProfile {
  user_id: string;
  email: string;
  tier: SubscriptionTier;
  billing_period_end?: string;
  watchlist_limit: number;
  daily_deep_dive_limit: number;
  deep_dives_remaining_today: number;
}

export const userProfileSchema = {
  $id: "UserProfile",
  type: "object",
  additionalProperties: false,
  required: [
    "user_id",
    "email",
    "tier",
    "watchlist_limit",
    "daily_deep_dive_limit",
    "deep_dives_remaining_today"
  ],
  properties: {
    user_id: { type: "string", minLength: 1 },
    email: { type: "string", minLength: 3 },
    tier: {
      type: "string",
      enum: ["FREE", "PRO"]
    },
    billing_period_end: { type: "string", format: "date-time" },
    watchlist_limit: { type: "integer", minimum: 1 },
    daily_deep_dive_limit: { type: "integer" },
    deep_dives_remaining_today: { type: "integer", minimum: -1 }
  }
} as const;
