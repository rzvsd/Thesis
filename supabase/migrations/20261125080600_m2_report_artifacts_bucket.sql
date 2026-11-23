-- M2: private Storage bucket for Deep Dive report JSON bodies (ADR 8, N2).
-- No storage policies, so only the service role (the api function) can read or write it.
-- The coordinator gave this one bucket to M2; M4 owns every other bucket.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('report-artifacts', 'report-artifacts', false, 5242880, array['application/json'])
    on conflict (id) do nothing;
  else
    raise notice 'storage schema not present; bucket report-artifacts not created';
  end if;
end $$;
