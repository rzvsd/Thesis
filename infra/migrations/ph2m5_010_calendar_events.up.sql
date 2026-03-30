create table if not exists calendar_events (
  id text primary key,
  ticker text not null,
  event_type text not null check (event_type in ('earnings', 'dividend', 'split')),
  event_date date not null,
  event_time text null check (event_time in ('before_market', 'after_market', 'during_market')),
  provider text not null,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, event_type, event_date)
);

create index if not exists idx_calendar_events_event_date on calendar_events (event_date);
create index if not exists idx_calendar_events_ticker_event_date on calendar_events (ticker, event_date);
