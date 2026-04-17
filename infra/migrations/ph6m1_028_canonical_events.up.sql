create table if not exists canonical_events (
  id text primary key,
  family text not null,
  subject_type text not null,
  subject_id text not null,
  title text not null,
  occurred_at timestamptz not null,
  source_state text not null,
  source jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canonical_events_subject_occurred_idx
  on canonical_events (subject_type, subject_id, occurred_at desc);

create index if not exists canonical_events_family_occurred_idx
  on canonical_events (family, occurred_at desc);
