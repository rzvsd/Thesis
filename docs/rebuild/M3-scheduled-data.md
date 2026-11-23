# M3 Scheduled data

Read `AGENTS.md` first.

## Goal

The data the app shows is fresh every day, computed by scheduled jobs that write to Postgres.

## In scope

- Actions cron workflows for: daily Pulse issue, macro stress, sentiment, prices, headlines, ticker registry sync, filing change alerts, Deep Dive precompute for covered tickers.
- `data-openbb` and `news-ingest` logic as Python scripts that write to Postgres. No HTTP servers.
- Read endpoints for the data these jobs make: macro stress, sentiment, conviction, alerts (list, mute, feedback), monitor snapshots, scenarios, opposite case, war room, feedback.
- Any endpoint that M0 marked "long" moves to a job and the endpoint returns the stored result.

## Out of scope

PDFs and push sending (M4).

## Paths you may touch

`jobs/`, `.github/workflows/` (new files), `supabase/functions/`, `supabase/migrations/` (new files), `packages/`.

## ADRs it depends on

2 (Python for jobs), 5 (Actions as runner), 10 (Actions minutes).

## Steps

1. One workflow per job, each with its own schedule and a manual run button.
2. Move the fetch logic out of the Python services. Keep the fixture mode switch.
3. Write the read endpoints with the contract shapes.
4. Keep total Actions minutes under the free limit; record minutes per job.

## Exit checks

- Each job runs on schedule for 3 days with no manual step.
- A new Pulse issue appears each morning.
- Every remaining contract endpoint returns its shape.

## Report

Job list with schedule and minutes per run, monthly minute estimate, endpoints added.
