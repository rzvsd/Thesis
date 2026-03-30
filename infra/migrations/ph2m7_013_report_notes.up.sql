create table if not exists report_notes (
  report_id text not null references reports (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index if not exists idx_report_notes_user_id on report_notes (user_id);
create index if not exists idx_report_notes_report_id on report_notes (report_id);

