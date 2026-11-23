# M2 Deep Dive

Read `AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md` and `contract.md` first. Runs in parallel with M1 and M3.

## Goal

A Deep Dive requested in the app runs to the end and shows the report, with no always-on worker.
This milestone proves fixture mode. Live data arrives with M3.

## In scope

- The `jobs` table already exists (from `m4_001_auth_jobs`). Add only missing columns (attempts, dispatched_at,
  run_url). Atomic claim: `update ... where status = 'queued' returning` so two runs cannot take one job.
- `POST /jobs`, `GET /jobs/:id` in feature `jobs`, same contract as today, plus:
  - return the user's running job for the same ticker instead of a new one (H1);
  - daily and per-user limits as today, plus a global daily dispatch cap from `DEEP_DIVE_DAILY_CAP` (C2);
  - **poll-time sweeper** (C1): in `GET /jobs/:id`, re-dispatch a job queued too long, fail a job running too long.
- `pg_cron` job every 10 minutes for jobs nobody polls (fail stale running, mark stale queued). No Actions cron.
- `_lib/jobs/dispatch.ts`: the only place that starts a runner (`workflow_dispatch` with the job id as the only input).
  Swapping the runner later (D1) changes only this file and the entry script.
- Feature `internal-jobs` (H5): claim, complete and fail routes behind the internal token, keeping everything
  `/internal/jobs/:id/complete` does today (validate, store report, fingerprint and expiry, contrarian anchors,
  kill switch rules, name relationships, monitor snapshot, conviction journal, filing-change alerts).
  Feature `historical`: `/v1/historical/*` and `/internal/reports/comparable-latest`, which the pipeline reads.
- Report JSON bodies go to Supabase Storage through its S3 API (N2, ADR 8).
- `jobs/deep-dive/`: entry script that calls claim, runs the existing Dexter pipeline from `apps/dexter-worker`
  (copy the pipeline entry, leave the Redis consumer), then calls complete or fail. It holds only
  `THESIS_INTERNAL_TOKEN` and LLM keys, never a database password (D5).
- `.github/workflows/rebuild-deep-dive.yml`: `workflow_dispatch` only, input `job_id` validated as a UUID, `timeout-minutes: 10`.
- App change (D3): poll up to 6 minutes, resume a running job when the screen reopens. Only `MainViewModel.kt`.

## Out of scope

Precompute of covered tickers (M3). Live LLM mode stays off until the owner sets a budget.

## Paths, tables, routes

See `OWNERSHIP.md`, row M2. Migrations use the `20261125` prefix. Preview function: `api-m2`.
For live checks before M1 merges, create a test user with the admin API and call `api-m2` directly.

## Exit checks

- A Deep Dive for AAPL goes queued, running, complete within the app's 6-minute window, 5 runs in a row.
- Asking again for the same ticker while it runs returns the same job.
- A job for a ticker in the force-fail list ends as failed with an error message.
- A job whose run was cancelled is failed by the poll-time check, and by `pg_cron` when nobody polls.
- The dispatch cap returns the contract's limit error once reached.
- After M1 merges: the app shows the report.

## Report

Median run time over 5 runs, Actions minutes per run, failure paths tested, side effects of complete checked.
