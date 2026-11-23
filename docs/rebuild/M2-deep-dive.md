# M2 Deep Dive

Read `AGENTS.md` first.

## Goal

A Deep Dive requested in the app runs to the end and shows the report, with no always-on worker.

## In scope

- `jobs` table: id, type, ticker, user, status, attempts, timestamps, report id, error.
- `POST /jobs` and `GET /jobs/:id` in the `jobs` Edge Function, same contract as today.
- `POST /jobs` writes the row, then calls the GitHub API (`repository_dispatch` or `workflow_dispatch`) to start the runner.
- `jobs/deep-dive/`: an Actions workflow and an entry script that loads the job, runs the existing Dexter pipeline, writes the report, and sets the status.
- A sweeper cron every 10 minutes: restart jobs queued too long, fail jobs running too long.
- Daily and per-user Deep Dive limits as today.

## Out of scope

Precompute of covered tickers (M3). Live LLM mode stays off until the owner sets a budget.

## Paths you may touch

`supabase/functions/jobs/`, `supabase/migrations/` (new files), `jobs/deep-dive/`, `.github/workflows/` (new files), `packages/`.

## ADRs it depends on

4 (jobs table + dispatch), 5 (Actions as runner), 10 (Actions minutes).

## Steps

1. Lift the pipeline entry out of `apps/dexter-worker` into a function that takes a job and returns a report. Leave the Redis consumer behind.
2. Write the workflow and the entry script.
3. Store the GitHub token for dispatch in Supabase secrets.
4. Write the sweeper.

## Exit checks

- A Deep Dive for AAPL goes queued, running, complete in under 4 minutes.
- A job for a ticker in the force-fail list ends as failed with an error message.
- The app shows the report.

## Report

Median run time over 5 runs, Actions minutes per run, failure paths tested.
