# Who owns what

This file stops parallel milestones from editing the same file. If a path, table or route is listed for your
milestone, you may create and edit it. Everything else is read-only for you: import it, call it, but do not edit it.
If you need a change in something you do not own, stop and ask the coordinator. It will either make the change
in a small PR into `rebuild`, or tell the owner to.

## Order and parallel work

```
M0 ──┬── M1 ──┬── M4 ──┐
     ├── M2 ──┤        ├── 7 clean days ── M5 (owner's yes)
     └── M3 ──┘────────┘
```

- **Wave 1:** M0 alone.
- **Wave 2:** M1, M2 and M3 at the same time, each in its own thread and branch, after M0 merges into `rebuild`.
  M2 and M3 do not wait for M1: for live checks they create a test user with the Supabase admin API (service role)
  and call their preview function directly. End-to-end checks in the app wait until M1 merges.
- **Wave 3:** M4 starts when M1 merges (it needs users, device tokens and the email module). It can overlap with
  the end of M2 and M3.
- **Wave 4:** M5 starts when M1-M4 are merged and the new system has run 7 days with no manual fix. Deleting old
  servers and the merge to `main` need the owner's yes.

Merging: a milestone PR into `rebuild` is merged by its thread once CI is green and the owner (or the coordinator,
if the owner delegated it) approves. Before merging, update your branch from `rebuild` and re-run CI.
After the merge, the merging thread deploys `api` from `rebuild` (AGENTS rule 9) and applies its migrations.

## Shared files (owner: M0, frozen)

Nobody edits these after M0 without the coordinator's go-ahead. Changes come as one small PR at a time.

- `supabase/config.toml`
- `supabase/functions/api/index.ts`, `app.ts`, `router.ts`
- `supabase/functions/api/features/index.ts` (the registry; M0 already lists every feature module below)
- `supabase/functions/_shared/**` (http, auth guard, db, env, log)
- `supabase/functions/deno.json`
- `supabase/migrations/20261123000000_m0_baseline.sql`
- `jobs/README.md`, `jobs/ops/**`
- `.github/workflows/ci.yml`, `rebuild-ci.yml`, `rebuild-backup.yml`
- `docs/rebuild/AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md`, `contract.md`
- Root config: `package.json`, `pnpm-workspace.yaml`, `eslint.config.mjs`, `.gitignore`, `.gitleaks.toml`

Dependencies: do not edit `deno.json` to add one. Import with a pinned specifier in your own file,
for example `npm:postgres@3.4.5` or `jsr:@std/assert@1.0.13`.

## Files by milestone

Paths are under `supabase/functions/` unless they start with another top folder.

| Milestone | Feature modules (`api/features/<name>/`) | Shared code (`_lib/<name>/`) | Other paths |
| --- | --- | --- | --- |
| M0 | `health` | none | the shared files above |
| M1 | `auth`, `user`, `account`, `watchlist`, `holdings`, `devices`, `tickers`, `pulse`, `reports`, `web` | `store`, `auth`, `email`, `pulse`, `reports` | `edge/worker/**` (Cloudflare Worker), `docs/rebuild/M1-*.md` |
| M2 | `jobs`, `internal-jobs`, `historical` | `jobs` | `jobs/deep-dive/**`, `.github/workflows/rebuild-deep-dive.yml`, in the app only `MainViewModel.kt` (the Deep Dive poll and resume code) and the strings it uses |
| M3 | `research`, `alerts`, `internal-data` | `research`, `evaluators` | `jobs/data/**` (Python), `jobs/daily/**`, `jobs/weekly/**`, `.github/workflows/rebuild-daily.yml`, `rebuild-weekly.yml` |
| M4 | `exports`, `billing`, `internal-push` | `exports`, `push`, `billing` | `jobs/pdf/**`, `.github/workflows/rebuild-pdf.yml` |
| M5 | none new | none new | deletes in `apps/`, `docker-compose.yml`, Dockerfiles, `deploy-production.yml`; app release config and `network_security_config.xml`; `docs/**`; `README.md`; legal drafts; legacy parts of `ci.yml` |

Each milestone owns its own milestone file in `docs/rebuild/` and may add notes there.
M1 owns the `web` feature for HTML that the Worker cannot serve statically; the Worker itself is in `edge/worker/`.

## Routes

`contract.md` has an "Owner" column for every route. Register a route only in a feature module you own.
The router refuses to start if two modules register the same method and path, and `rebuild-ci` tests that.

## Tables

All tables are in schema `app`. "Owns" means: only this milestone may alter the table (add columns, indexes,
grants). Any milestone's code may read or write rows through the `api` function when its feature needs it.

| Owner | Tables |
| --- | --- |
| M0 | `audit_events`, `rate_limits` (M3 owns the 90-day `pg_cron` trim of `audit_events`, migration `20261126083000_m3_audit_trim.sql`) |
| M1 | `users`, `sessions`, `verification_tokens`, `account_action_tokens`, `user_google_identities`, `user_devices`, `user_email_preferences`, `notification_preferences`, `watchlists`, `user_research_holdings`, `report_notes`, `report_shares` |
| M2 | `jobs`, `deep_dive_daily_usage`, `reports` |
| M3 | `ticker_registry`, `ticker_coverage`, `financial_snapshots`, `transcripts`, `calendar_events`, `canonical_events`, `call_artifacts`, `first_party_context_items`, `name_relationships`, `conviction_insight_cards`, `conviction_journal_entries`, `scenario_stress_templates`, `scenario_stress_runs`, `scenario_stress_impacts`, `scenario_stress_rule_suggestions`, `fear_greed_daily`, `alert_ledger`, `contrarian_alert_anchors`, `kill_switch_rules`, `kill_switch_evaluations`, `thesis_monitor_snapshots`, `war_rooms`, `war_room_timeline_events`, `opposite_case_reports`, `user_research_states`, `user_feedback_queue` |
| M4 | `subscriptions`, Storage buckets and their policies |

New tables: the milestone that creates one owns it. Name new tables so the owner is clear from the feature.

## Migrations

- File name: `supabase/migrations/<timestamp>_<mN>_<what>.sql`.
- Each milestone uses its own timestamp day so files never collide and keep a stable order:
  M1 `20261124xxxxxx`, M2 `20261125xxxxxx`, M3 `20261126xxxxxx`, M4 `20261127xxxxxx`, M5 `20261128xxxxxx`.
  Use the real time of day for the last six digits.
- A migration touches only tables its milestone owns, and is additive (AGENTS rule 8).
- Every `create table` is followed by `alter table ... enable row level security` in the same file.
- Apply to the hosted project in file-name order. If an earlier-named file lands after a later one was applied,
  apply it on its own; it cannot conflict because tables are owned by one milestone.

## Supabase secrets and functions

| Owner | Secrets (names only, values set in the dashboard) | Functions |
| --- | --- | --- |
| M0 | `INTERNAL_API_TOKEN` | `api` (deployed from `rebuild` only) |
| M1 | `RESEND_API_KEY` (later), `EMAIL_FROM` | `api-m1` preview |
| M2 | `GITHUB_DISPATCH_TOKEN`, `DEEP_DIVE_DAILY_CAP` | `api-m2` preview |
| M3 | none expected | `api-m3` preview |
| M4 | `FCM_SERVICE_ACCOUNT_JSON`, `REVENUECAT_WEBHOOK_SECRET` | `api-m4` preview |

GitHub Actions secrets: `THESIS_API_URL`, `THESIS_INTERNAL_TOKEN` (M2 and M3 jobs), LLM keys (M2), `FINBASE_READ_TOKEN` (M3),
`BACKUP_DB_URL` and `BACKUP_PASSPHRASE` (M0 backup). Never add the `postgres` password to GitHub.
