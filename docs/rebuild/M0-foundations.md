# M0 Foundations

Read `AGENTS.md` first.

## Goal

Set up the empty serverless home: a Supabase project, one baseline schema, the API contract, and the folder layout.

## In scope

- Free Supabase project "thesis" (eu-central-1), created only after the owner says yes.
- One baseline SQL schema from the 69 files in `infra/migrations`, for a fresh start (no data migration).
- `docs/rebuild/contract.md`: every endpoint the Android client calls (`apps/mobile/android/app/src/main/java/com/thesis/mobile/network/`), with method, path, auth, and request and response JSON. There are about 43.
- For each endpoint, a note: fast read, write, or long computation. Long ones move to a job.
- Folders: `supabase/` (functions, migrations, config) and `jobs/` (Actions job code).
- CI: type check and lint for `supabase/functions` and `jobs/`.
- Check the free-tier limits on the Supabase and GitHub pricing pages and record them in the contract file.

## Out of scope

- Any Edge Function code beyond a health function.
- Changes to `apps/`.

## Paths you may touch

`supabase/`, `jobs/`, `docs/rebuild/`, `.github/workflows/` (new files only), root config for the new folders.

## ADRs it depends on

7 (fresh start), 9 (repo layout), 10 (repo visibility).

## Steps

1. List the client endpoints and write `contract.md`.
2. Squash migrations into `supabase/migrations/0001_baseline.sql`. Drop tables used only by Redis or the memory store.
3. Create the project, link the Supabase CLI, apply the schema.
4. Add a `health` Edge Function and deploy it.
5. Add CI.

## Exit checks

- `supabase db push` applies the baseline with no error.
- `GET <project>/functions/v1/health` returns 200.
- `contract.md` lists every path found in the Kotlin client.

## Report

Project ref, schema table count, endpoint count by type (read, write, long), limits found.
