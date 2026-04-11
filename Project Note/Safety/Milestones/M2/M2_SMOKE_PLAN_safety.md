# Safety M2 Smoke Plan

## Purpose

Prove runtime blast-radius reduction and production network safety posture.

## Steps

1. Validate service containers run as non-root.
2. Validate Postgres and Redis are not publicly exposed in production profile.
3. Validate Redis production auth is enforced.
4. Validate TLS termination and HSTS behavior from deployed endpoint.

## Evidence

- Compose/runtime config snippets
- Port reachability checks
- Deployment verification notes in `Milestones/M2/evidence/`

## Execution Log - 2026-04-11

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`55` tests)
3. `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m2-runtime.test.js` -> pass (`1` test)
4. Runtime smoke stack checks (isolated `tmp/m2-smoke.env`) -> pass for steps 1-3:
   - product-api runtime user: `1000` / `node`
   - Redis/Postgres host bindings: `127.0.0.1` only
   - Redis auth: `NOAUTH` without password, `PONG` with password
5. Step 4 (TLS/HSTS) -> pass in local production profile:
   - app-level HSTS behavior validated by `safety-m2-runtime.test.ts`
   - termination and deployed edge verification path documented in `M2_TLS_HSTS_RUNBOOK_safety.md`
