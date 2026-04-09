alter table notification_preferences
  add column if not exists quiet_until timestamptz null;

create index if not exists idx_notification_preferences_quiet_until
  on notification_preferences (notification_type, quiet_until);
