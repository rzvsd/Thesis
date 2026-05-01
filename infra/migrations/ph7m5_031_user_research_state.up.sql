create table if not exists user_research_holdings (
  user_id text not null references users (id) on delete cascade,
  ticker text not null,
  quantity numeric,
  cost_basis numeric,
  label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

create index if not exists idx_user_research_holdings_user
  on user_research_holdings (user_id);

create table if not exists user_research_states (
  state_id text primary key,
  user_id text not null references users (id) on delete cascade,
  as_of date not null,
  generated_at timestamptz not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, as_of)
);

create index if not exists idx_user_research_states_user_as_of
  on user_research_states (user_id, as_of desc);

