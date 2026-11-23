# M3 Scheduled data

Read `AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md` and `contract.md` first. Runs in parallel with M1 and M2.

## Goal

The data the app shows is fresh every day, computed by scheduled jobs, and every research screen reads stored results.

## In scope

- **The full job list from `apps/scheduler/src/server.ts`** (H6), about 18 jobs, not 8. Including: Pulse issue and
  per-user brief (D4), macro stress, sentiment, prices, headlines, ticker registry sync, historical sync, calendar
  sync, earnings preview, earnings war room, kill switch, cross-name, monitor recompute, freshness decay, filing-change
  alerts, contrarian, precompute for covered tickers; weekly: digest, monthly coherence, official-source refresh.
- Lift the evaluators that sit in `server.ts` (lines about 6068-8450, behind `/internal/` routes) into `_lib/evaluators/`.
  Expose them as feature `internal-data` routes behind the internal token.
- **One daily workflow with steps** (`rebuild-daily.yml`) and **one weekly** (`rebuild-weekly.yml`), not one workflow
  per job. Each step calls an internal route or runs a Python script in `jobs/data/`. Manual run button on both.
- Daylight saving (N6): two UTC cron entries and a local-time check for 06:30 America/New_York. Every step is safe to run twice for one market date.
- Precompute (N7): one step that loops tickers in process, with a per-run cap. Never one dispatch per ticker.
- Python (N5): `data-openbb` and `news-ingest` fetch logic as scripts in `jobs/data/`; in-process rate limiter instead of
  Redis; retries with backoff; dependency cache; `FINBASE_READ_TOKEN` for the private fork. Fixture mode stays default.
  Scripts write through internal routes. Only if that is too slow, use the `thesis_jobs` role with grants on its own tables.
- Feature `research` and `alerts`: every M3 read route in `contract.md` (macro stress, sentiment, conviction, alerts list,
  mute and feedback, monitor snapshots, scenarios, opposite case, war room, earnings state, name relationships, feedback).
  Any route marked "long" in the contract returns the stored result.
- Database size (N1): `pg_cron` trims `audit_events` older than 90 days (ask the coordinator: the table is M0's) and keep
  transcript text out of Postgres or capped. Record the size after a full day.

## Out of scope

PDFs and push sending (M4).

## Paths, tables, routes

See `OWNERSHIP.md`, row M3. Migrations use the `20261126` prefix. Preview function: `api-m3`.

## Exit checks

- The daily workflow runs on schedule for 3 days with no manual step, under 15 minutes a run.
- A new Pulse issue and per-user briefs appear each morning.
- Every M3 route in `contract.md` returns its shape.
- Database size after 3 days is recorded and under 250 MB.

## Report

Step list with minutes per run, monthly minute estimate against `DECISIONS.md` D7, routes added, database size.
