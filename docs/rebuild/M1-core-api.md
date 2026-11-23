# M1 Core API

Read `AGENTS.md` and `contract.md` first.

## Goal

The app logs in, edits the watchlist and reads Pulse and reports with no PC on.

## In scope

- Edge Functions, one per feature: `auth`, `user` (profile, preferences, sync-tier), `account` (delete), `watchlist`, `holdings` (import), `notifications` (device token), `tickers` (search), `pulse` (latest, by date), `reports` (list, by id, note).
- Auth as decided in ADR 3. If Supabase Auth: map `/auth/register`, `/verify`, `/login`, `/refresh`, `/logout`, `/password-reset/*` to it and return the current JSON shapes.
- A seed script that creates the admin test user (PRO, verified). The password comes from an env var, never from the repo.
- A routing layer so the app's paths (`/watchlist`, `/v1/user/profile`, ...) reach the right function under one base URL.
- Debug APK built with the new base URL.

## Out of scope

Deep Dive jobs (M2), data jobs (M3), PDF export, push sending, billing (M4).

## Paths you may touch

`supabase/functions/`, `supabase/migrations/` (new files), `packages/` (shared logic moved out of `apps/product-api`), `docs/rebuild/`.

## ADRs it depends on

1 (Edge Functions), 3 (auth), 6 (keep the contract).

## Steps

1. Move the store queries these routes need into a shared module. Copy; do not delete from `apps/`.
2. Write the functions. Keep each under about 800 lines.
3. Port the existing product-api tests that cover these routes, or run them against the new URL.
4. Seed the admin user and one fixture Pulse issue.
5. Build the APK and log in on a phone on mobile data.

## Exit checks

- Login, profile, watchlist add and remove, ticker search, Pulse latest and report read return the contract shapes.
- The phone works on mobile data with the PC off.

## Report

Function list with line counts, tests ported or run, APK build command, anything in the contract that had to change.
