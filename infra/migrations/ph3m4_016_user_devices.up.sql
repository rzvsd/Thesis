create table if not exists user_devices (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  installation_id text not null,
  device_token text not null,
  platform text not null default 'android',
  last_seen_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  invalidated_at timestamptz null,
  invalidation_reason text null,
  unique (user_id, installation_id)
);

create index if not exists idx_user_devices_user_active
  on user_devices (user_id)
  where invalidated_at is null;

create unique index if not exists idx_user_devices_active_token
  on user_devices (device_token)
  where invalidated_at is null;

insert into user_devices (
  id,
  user_id,
  installation_id,
  device_token,
  platform,
  last_seen_at,
  created_at,
  updated_at,
  invalidated_at,
  invalidation_reason
)
select
  'legacy-' || u.id,
  u.id,
  'legacy:' || u.id,
  trim(u.device_token),
  'android',
  now(),
  now(),
  now(),
  null,
  null
from users u
where u.device_token is not null
  and length(trim(u.device_token)) > 0
on conflict (user_id, installation_id) do update
set
  device_token = excluded.device_token,
  platform = excluded.platform,
  last_seen_at = excluded.last_seen_at,
  updated_at = excluded.updated_at,
  invalidated_at = null,
  invalidation_reason = null;
