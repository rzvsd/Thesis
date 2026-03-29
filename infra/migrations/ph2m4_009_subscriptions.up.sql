create table if not exists subscriptions (
  user_id text primary key references users (id) on delete cascade,
  tier text not null default 'FREE' check (tier in ('FREE', 'PRO')),
  revenuecat_app_user_id text unique,
  billing_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_tier on subscriptions (tier);
create index if not exists idx_subscriptions_revenuecat_app_user_id on subscriptions (revenuecat_app_user_id);

create table if not exists deep_dive_daily_usage (
  user_id text not null references users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index if not exists idx_deep_dive_daily_usage_date on deep_dive_daily_usage (usage_date);
