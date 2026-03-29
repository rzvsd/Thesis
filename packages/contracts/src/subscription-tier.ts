export type SubscriptionTier = "FREE" | "PRO";

export const subscriptionTierSchema = {
  $id: "SubscriptionTier",
  type: "string",
  enum: ["FREE", "PRO"]
} as const;
