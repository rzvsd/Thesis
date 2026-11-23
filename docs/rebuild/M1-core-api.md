# M1 Core API

Read `AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md` and `contract.md` first. Runs in parallel with M2 and M3.

## Goal

The app logs in, edits the watchlist and reads Pulse and reports through the front door, with no PC on.

## In scope

- **Front door** (D2, H2): a Cloudflare Worker in `edge/worker/` on its free `workers.dev` address. It forwards API
  paths to `.../functions/v1/api/<path>`, serves `/legal/*` and other static HTML, and has a daily cron that calls
  `GET /health?db=1` (keep-alive, H11). Rate limits for public routes can live here or in `app.rate_limits` (N3).
- **Auth** (D6, H9): Supabase Auth behind `/auth/register`, `/verify`, `/login`, `/refresh`, `/logout`,
  `/password-reset/*`, `/auth/google*`. Write the mapping table first (route, Supabase call, response, status codes:
  409 on known email, 423 with `locked_until`, verify token without email, reset revokes sessions) and put it in
  this file. Account delete removes the auth user, the app rows and stored files.
- **Email module** `_lib/email/` with two drivers: Supabase built-in (now) and Resend (when a domain exists).
- Feature modules `auth`, `user`, `account`, `watchlist`, `holdings`, `devices`, `tickers`, `pulse`, `reports`, `web`,
  covering every M1 row in `contract.md` (holdings list, add, delete and import; email preferences; report share;
  `/r/:token` reader; unsubscribe page; web delete-account form).
- **Pulse** (D4): serve the stored issue plus the deterministic brief. No worker or LLM call per request.
- **Store**: copy the Postgres queries these routes need from `apps/product-api/src/store.ts` into `_lib/store/`.
  They run unchanged because the database role's search path is `app`.
- **Tests** (H8): port the product-api tests for these routes so they drive the new handlers (Request in, Response out).
- **Backup of auth users** (H11): the weekly dump covers schema `app` only. Add an export of `auth.users` and
  `auth.identities` to the recovery plan (ask the coordinator to change `jobs/ops/backup.sh`, which M0 owns), and a
  restore drill note. Needed before anyone but the owner signs up.
- Admin seed script (N11): reads the password from an env var, marks the account as a test account, never runs on its own.
- Debug APK: `./gradlew assembleDebug -PAPI_BASE_URL=<worker url>`.

## Out of scope

Jobs and Deep Dive (M2), research data and scheduled jobs (M3), PDF export, push sending, billing (M4).

## Paths, tables, routes

See `OWNERSHIP.md`, row M1. Migrations use the `20261124` prefix. Preview function: `api-m1`.

## Exit checks

- Every M1 route in `contract.md` returns its contract shape through the Worker (list the curl commands).
- The ported tests pass in `rebuild-ci`. Any dropped test has the owner's yes.
- The anon key still cannot read `app` tables; advisor clean.
- The phone logs in, edits the watchlist and reads Pulse on mobile data with the PC off.
- `/legal/*` and the delete-account form render as HTML through the Worker.

## Report

Worker URL, auth mapping table, functions and line counts, tests ported, APK build command, contract changes (should be none).
