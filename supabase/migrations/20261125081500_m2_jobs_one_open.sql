-- M2: at most one open Deep Dive per user and ticker (H1). Two overlapping POST /jobs requests cannot both
-- create and dispatch a job; the loser gets the winner's job. Additive (AGENTS rule 8).
-- If old duplicates ever exist, the sweep fails the older ones first so the index can be built.
update app.jobs j
   set status = 'failed', completed_at = now(), error_message = 'Superseded by a newer Deep Dive for the same ticker.'
 where j.type = 'deep_dive' and j.user_id is not null and j.status in ('queued', 'running')
   and exists (
     select 1 from app.jobs n
      where n.type = 'deep_dive' and n.user_id = j.user_id and n.ticker = j.ticker
        and n.status in ('queued', 'running') and n.created_at > j.created_at
   );

create unique index if not exists jobs_one_open_deep_dive
  on app.jobs (user_id, ticker)
  where type = 'deep_dive' and user_id is not null and status in ('queued', 'running');
