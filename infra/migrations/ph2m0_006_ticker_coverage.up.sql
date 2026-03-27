create table if not exists ticker_coverage (
  ticker text primary key,
  snapshot_count integer not null default 0 check (snapshot_count >= 0),
  transcript_count integer not null default 0 check (transcript_count >= 0),
  latest_period text null,
  earliest_period text null,
  has_guidance boolean not null default false,
  has_estimates boolean not null default false,
  last_synced_at timestamptz not null,
  last_sync_status text not null check (last_sync_status in ('success', 'partial', 'failed')),
  backfill_tier integer not null check (backfill_tier in (1, 2, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
