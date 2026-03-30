import type { SubscriptionTier } from "./subscription-tier";

export const notificationTypes = [
  "earnings_preview",
  "contrarian_alert",
  "weekly_digest",
  "market_pulse_ready"
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationPreferenceItem {
  type: NotificationType;
  enabled: boolean;
}

export interface NotificationPreferenceView {
  user_id: string;
  tier?: SubscriptionTier;
  preferences: NotificationPreferenceItem[];
}

