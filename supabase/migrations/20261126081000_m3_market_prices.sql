-- M3: end-of-day closes written by the daily data job (POST /internal/data/prices/ingest).
-- Evaluators (kill switch, contrarian) read the latest close per ticker from here instead of calling a price server.
-- Additive only. RLS on, no grants to anon or authenticated (AGENTS rule 6).
create table if not exists app.market_prices_daily (
  ticker text not null,
  market_date date not null,
  close numeric not null check (close > 0),
  provider text not null,
  retrieved_at timestamptz not null default now(),
  primary key (ticker, market_date)
);
alter table app.market_prices_daily enable row level security;
create index if not exists idx_market_prices_daily_date on app.market_prices_daily (market_date desc);
grant select, insert, update, delete on app.market_prices_daily to thesis_api;
