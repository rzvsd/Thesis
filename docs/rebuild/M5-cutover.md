# M5 Cutover and cleanup

Read `AGENTS.md` first.

## Goal

The repo holds only the serverless system, and the docs say what really runs.

## In scope

- Delete the always-on servers: `apps/product-api` server code, `apps/dexter-worker` queue and HTTP server, `apps/data-openbb` and `apps/news-ingest` HTTP servers, `apps/scheduler`, `apps/mobile` Node shim.
- Delete `docker-compose.yml`, the Dockerfiles, and the SSH deploy workflow.
- Update `docs/CURRENT_STATE.md`, `README.md` and the architecture docs.
- Write the real ADRs from the plan's ADR discussions, as the owner decided them.
- Optional: `api.<domain>` on Cloudflare DNS pointing to the Supabase API.
- Release build settings for the new base URL.

## Out of scope

New features.

## Paths you may touch

Everything, but only to delete or document. No new behaviour.

## ADRs it depends on

All.

## Steps

1. Check that nothing outside `apps/` imports the code to delete.
2. Delete in one PR per service, so each can be reverted alone.
3. Update the docs.

## Exit checks

- No code in the repo needs an always-on server.
- CI is green.
- The app works end to end on a phone on mobile data.

## Report

Lines removed, services removed, docs updated, ADRs written.
