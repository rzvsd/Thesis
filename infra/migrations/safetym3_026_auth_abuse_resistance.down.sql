drop index if exists idx_sessions_family_id;

alter table if exists sessions
  drop column if exists revoked_reason;

alter table if exists sessions
  drop column if exists replaced_by_session_id;

alter table if exists sessions
  drop column if exists parent_session_id;

alter table if exists sessions
  drop column if exists family_id;

drop index if exists idx_users_locked_until;

alter table if exists users
  drop column if exists locked_until;

alter table if exists users
  drop column if exists failed_login_window_started_at;

alter table if exists users
  drop column if exists failed_login_attempts;
