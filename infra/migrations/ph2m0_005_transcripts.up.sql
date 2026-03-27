create table if not exists transcripts (
  transcript_id text primary key,
  ticker text not null,
  period text not null,
  fiscal_year integer not null,
  fiscal_quarter integer not null check (fiscal_quarter between 1 and 4),
  call_date text null,
  provider text not null,
  retrieved_at timestamptz not null,
  body_text text not null,
  word_count integer not null check (word_count >= 0),
  is_complete boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ticker, period)
);

create index if not exists idx_transcripts_ticker
  on transcripts (ticker);

create index if not exists idx_transcripts_ticker_period
  on transcripts (ticker, period);
