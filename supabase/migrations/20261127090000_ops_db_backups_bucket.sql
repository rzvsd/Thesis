-- Ops: private Storage bucket for the weekly encrypted database dump (rebuild-backup.yml, jobs/ops/backup_store.mts).
-- The repository is public, so the dump must not be a GitHub run artifact.
-- No storage policies, so only a Supabase secret key can read or write it. 50 MB per file is the free plan's cap.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('db-backups', 'db-backups', false, 52428800, array['application/octet-stream'])
    on conflict (id) do nothing;
  else
    raise notice 'storage schema not present; bucket db-backups not created';
  end if;
end $$;
