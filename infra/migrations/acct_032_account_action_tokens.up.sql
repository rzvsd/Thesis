create table if not exists account_action_tokens (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('password_reset', 'account_deletion')),
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null
);

create index if not exists idx_account_action_tokens_user_purpose
  on account_action_tokens (user_id, purpose);
