drop index if exists idx_notification_preferences_quiet_until;

alter table notification_preferences
  drop column if exists quiet_until;
