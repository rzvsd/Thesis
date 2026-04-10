import type { SubscriptionTier } from "./subscription-tier";

export const notificationTypes = [
  "earnings_preview",
  "earnings_war_room",
  "contrarian_alert",
  "kill_switch",
  "freshness_decay",
  "morning_exception_briefing",
  "cross_name_propagation",
  "weekly_digest",
  "market_pulse_ready"
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationPreferenceItem {
  type: NotificationType;
  enabled: boolean;
  quiet_until?: string;
}

export interface NotificationPreferenceView {
  user_id: string;
  tier?: SubscriptionTier;
  preferences: NotificationPreferenceItem[];
}

