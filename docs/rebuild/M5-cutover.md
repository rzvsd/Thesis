# M5 Cutover and cleanup

Read `AGENTS.md` and `DECISIONS.md` first. Starts when M1-M4 are merged and the new system has run
**7 days with no manual fix**. Deleting old servers and merging `rebuild` into `main` need the owner's yes.

## Goal

The repo holds only the serverless system, the app release build points at it, and the docs say what really runs.

## In scope

- **Runner decision** (D1): the owner confirms the Deep Dive runner before any public launch. Record it.
- **Release build** (D3, H4): `API_BASE_URL_RELEASE` points at the Worker; drop certificate pinning for the managed
  hosts in `network_security_config.xml`.
- **Legal texts** (N10): add Supabase, Cloudflare, GitHub and the email provider to the processor list.
- **Admin seed** (N11): remove the test admin account before launch.
- Delete the always-on servers, one PR per service: `apps/product-api` server code, `apps/dexter-worker` queue and
  HTTP server, `apps/data-openbb` and `apps/news-ingest` HTTP servers, `apps/scheduler`, `apps/mobile` Node shim.
  Keep the tests (H8): they move to the new handlers or are already ported.
- Delete `docker-compose.yml`, the Dockerfiles, `deploy-production.yml`, and the legacy parts of `ci.yml`.
- Update `docs/CURRENT_STATE.md`, `README.md`, the architecture docs, and write ADR files from `DECISIONS.md`.
- Optional: the owner's own domain as a route on the Worker (no Supabase custom domain needed).

## Rollback

The real rollback for users is the base URL. The app points at the Worker, so the Worker can be repointed without
a new APK. There is no deployed old backend to fall back to.

## Exit checks

- No code in the repo needs an always-on server.
- CI is green.
- The release app works end to end on a phone on mobile data.
- The owner approved the merge of `rebuild` into `main`.

## Report

Lines removed, services removed, docs updated, ADRs written, runner decision.
