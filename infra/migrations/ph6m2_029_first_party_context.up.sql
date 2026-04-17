create table if not exists first_party_context_items (
  context_id text primary key,
  ticker text not null,
  event_id text,
  source_url text not null,
  source_domain text not null,
  page_type text not null,
  fetch_state text not null,
  rights jsonb not null,
  payload jsonb not null,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists first_party_context_items_ticker_retrieved_idx
  on first_party_context_items (ticker, retrieved_at desc);

create index if not exists first_party_context_items_event_idx
  on first_party_context_items (event_id)
  where event_id is not null;

create table if not exists call_artifacts (
  artifact_id text primary key,
  ticker text not null,
  event_id text,
  context_id text,
  source_url text not null,
  source_domain text not null,
  artifact_type text not null,
  completeness_state text not null,
  rights jsonb not null,
  payload jsonb not null,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_artifacts_ticker_retrieved_idx
  on call_artifacts (ticker, retrieved_at desc);

create index if not exists call_artifacts_event_idx
  on call_artifacts (event_id)
  where event_id is not null;
