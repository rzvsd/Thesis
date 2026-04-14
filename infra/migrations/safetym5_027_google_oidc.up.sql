create table if not exists user_google_identities (
  user_id text primary key references users (id) on delete cascade,
  google_subject text not null unique,
  email text not null,
  linked_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_user_google_identities_subject
  on user_google_identities (google_subject);
