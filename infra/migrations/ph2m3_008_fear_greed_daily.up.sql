create table if not exists fear_greed_daily (
  id text primary key,
  market_date date not null unique,
  score numeric(5,2) not null,
  label text not null,
  sub_scores jsonb not null,
  missing_inputs jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fear_greed_daily_market_date on fear_greed_daily (market_date);
create index if not exists idx_fear_greed_daily_calculated_at on fear_greed_daily (calculated_at);
