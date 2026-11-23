# M0 Foundations

Read `AGENTS.md`, `OWNERSHIP.md` and `DECISIONS.md` first.

## Goal

An empty, locked serverless home that M1, M2 and M3 can build on at the same time.

## In scope

- Free Supabase project `thesis` (eu-central-1). Created 2026-11-23, ref `oizahjzcowflmrffoxjg`.
- Baseline schema `supabase/migrations/20261123000000_m0_baseline.sql`, built by applying all 35 up-migrations
  to a scratch Postgres in the order of `apps/product-api/src/migrations.ts` and dumping the result (N8).
- Database lock (C3): every table in schema `app`, row level security on with no policies, no grants to
  `anon`, `authenticated` or `public`. Server roles `thesis_api` and `thesis_jobs`.
- Auth columns for D6: `users.password_hash` nullable, `users.auth_user_id` linked to `auth.users`.
- `docs/rebuild/contract.md` from the server's full route list (not only the Kotlin client), with audience,
  auth mode, kind (read, write, long) and owner milestone for every route.
- The single `api` function skeleton (H3): router, feature registry with every planned module as an empty stub,
  shared auth guard that denies by default, JSON helpers, database client, `health` route.
  `verify_jwt = false`; the guard checks auth per route.
- `jobs/` layout and `jobs/ops/` backup script; `.github/workflows/rebuild-backup.yml` (weekly, dormant until its secrets exist).
- Slim CI (C2): path filters and `cancel-in-progress` in `ci.yml`; new `rebuild-ci.yml` for `supabase/` and `jobs/`.
- Revised rules files: `AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md`, M1-M5.

## Out of scope

Feature routes (M1-M4). Changes to `apps/`.

## Exit checks

- The baseline applies to the hosted project with no error.
- A request with the public key to `/rest/v1/users` returns no app data, and the security advisor shows no errors.
- `GET https://oizahjzcowflmrffoxjg.supabase.co/functions/v1/api/health` returns 200, and `?db=1` reaches the `app` schema.
- `contract.md` lists every route in `server.ts` and `routes/`, and every path the Kotlin client calls.
- `rebuild-ci` passes: format, lint, type check and tests for `supabase/functions`.

## Report

Project ref, table count, route count by audience and kind, limits found, advisor result.

### Result (2026-11-23)

- Project `thesis`, ref `oizahjzcowflmrffoxjg`, eu-central-1, free plan.
- Baseline: 44 tables in `app` (43 existing plus `rate_limits`), 186 constraints, 148 indexes. All 44 have RLS on with
  no policies. `anon` and `authenticated` have no usage on schema `app`. Schema dump of the baseline file equals the
  dump of the 35 old migrations, except the `users` auth columns and `rate_limits`.
- Applied to the hosted project through the Supabase connector as three parts (`m0_baseline_part1_tables`,
  `m0_baseline_part2_tables_keys`, `m0_baseline_part3_indexes_rls_roles`; part 3 also holds the backup role).
  The repo file is the source of truth; the parts are the same SQL without the idempotency wrappers.
- `GET .../functions/v1/api/health?db=1` returns 200 with `app_tables: 44`, so the search path reaches `app`.
- `GET /rest/v1/users` with the publishable key returns 404 "Could not find the table public.users". App data is not exposed.
- Security advisor: no errors, no warnings. 44 INFO notes "RLS enabled, no policy", which is the intended deny-all.
- Routes: 100 on the server (app 60, web 9, webhook 1, internal 30; read 41, write 37, long 22). Kotlin client: 47 calls.
- Limits: see `DECISIONS.md`.
