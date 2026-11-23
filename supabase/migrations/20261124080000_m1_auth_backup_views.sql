-- M1: let the weekly backup read Supabase Auth users (rebuild audit H11, DECISIONS ADR 16).
--
-- The backup role thesis_backup cannot be given usage on schema "auth" (Supabase owns it). The postgres role can
-- read auth.users and auth.identities, so it owns two plain views in a private schema "ops_backup". Only
-- thesis_backup may use that schema. The views list only the real columns (no generated ones), so the backup can
-- write COPY blocks that load straight back into auth.users and auth.identities on restore.
-- Additive and safe to run twice. No table is created, so no row level security is needed here.

create schema if not exists ops_backup;
revoke all on schema ops_backup from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema ops_backup from anon, authenticated';
  end if;
end $$;

do $$
declare
  t text;
  cols text;
begin
  foreach t in array array['users', 'identities'] loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into cols
      from pg_attribute a
     where a.attrelid = format('auth.%I', t)::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attgenerated = '';
    execute format('create or replace view ops_backup.auth_%s as select %s from auth.%I', t, cols, t);
    execute format('revoke all on ops_backup.auth_%s from public', t);
  end loop;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'thesis_backup') then
    grant usage on schema ops_backup to thesis_backup;
    grant select on ops_backup.auth_users, ops_backup.auth_identities to thesis_backup;
  end if;
end $$;
