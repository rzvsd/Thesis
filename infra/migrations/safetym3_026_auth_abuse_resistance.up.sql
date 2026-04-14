alter table if exists users
  add column if not exists failed_login_attempts integer not null default 0;

alter table if exists users
  add column if not exists failed_login_window_started_at timestamptz null;

alter table if exists users
  add column if not exists locked_until timestamptz null;

create index if not exists idx_users_locked_until
  on users (locked_until);

alter table if exists sessions
  add column if not exists family_id text;

alter table if exists sessions
  add column if not exists parent_session_id text null references sessions (id) on delete set null;

alter table if exists sessions
  add column if not exists replaced_by_session_id text null references sessions (id) on delete set null;

alter table if exists sessions
  add column if not exists revoked_reason text null;

update sessions
   set family_id = id
 where family_id is null;

alter table if exists sessions
  alter column family_id set not null;

create index if not exists idx_sessions_family_id
  on sessions (family_id);
