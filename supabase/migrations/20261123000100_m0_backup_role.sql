-- M0: read-only role for the weekly backup (rebuild audit H11).
-- NOLOGIN here. The owner turns on login with a strong password in the dashboard only when the
-- backup workflow is wanted, and stores the pooler URL as the BACKUP_DB_URL Actions secret.
-- It can read app data but write nothing.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'thesis_backup') then
    create role thesis_backup nologin bypassrls;
  end if;
end $$;
grant usage on schema app to thesis_backup;
grant select on all tables in schema app to thesis_backup;
grant select on all sequences in schema app to thesis_backup;
alter default privileges in schema app grant select on tables to thesis_backup;
alter default privileges in schema app grant select on sequences to thesis_backup;
