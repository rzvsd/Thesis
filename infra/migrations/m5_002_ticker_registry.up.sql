create table if not exists ticker_registry (
  symbol text primary key,
  company_name text not null,
  exchange text not null check (exchange in ('NASDAQ', 'NYSE')),
  listing_status text not null check (listing_status in ('active', 'delisted', 'suspended')),
  is_supported boolean not null default true,
  source_feed text not null,
  source_updated_at timestamptz not null,
  last_synced_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_ticker_registry_exchange on ticker_registry (exchange);
create index if not exists idx_ticker_registry_supported on ticker_registry (is_supported);
create index if not exists idx_ticker_registry_company_name_lower on ticker_registry ((lower(company_name)));
