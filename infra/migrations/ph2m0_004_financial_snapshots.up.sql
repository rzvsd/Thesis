create table if not exists financial_snapshots (
  snapshot_id text primary key,
  ticker text not null,
  period text not null,
  period_type text not null check (period_type in ('quarterly', 'annual')),
  fiscal_year integer not null,
  fiscal_quarter integer null,
  provider text not null,
  filing_date text null,
  retrieved_at timestamptz not null,
  data jsonb not null,
  segments jsonb null,
  analyst_estimates jsonb null,
  guidance jsonb null,
  missing_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticker, period, period_type),
  check (
    (period_type = 'annual' and fiscal_quarter is null)
    or (period_type = 'quarterly' and fiscal_quarter between 1 and 4)
  ),
  check (jsonb_typeof(missing_fields) = 'array')
);

create index if not exists idx_financial_snapshots_ticker
  on financial_snapshots (ticker);

create index if not exists idx_financial_snapshots_ticker_period
  on financial_snapshots (ticker, period);

create index if not exists idx_financial_snapshots_ticker_fiscal_year
  on financial_snapshots (ticker, fiscal_year);
