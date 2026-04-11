# Safety M2 Smoke Evidence (2026-04-11)

## Scope

- Milestone: Safety M2 - Runtime and Infra Hardening
- Goal: verify non-root runtime user, private DB/Redis host bindings, Redis auth enforcement, and TLS/HSTS posture.

## Validation Commands

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`55` tests)
3. `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m2-runtime.test.js` (from `apps/product-api`) -> pass (`1` test)
4. Runtime smoke stack (isolated):
   - `docker compose --env-file tmp/m2-smoke.env up -d --no-build redis postgres product-api`
   - `docker compose --env-file tmp/m2-smoke.env exec -T product-api sh -lc 'id -u; id -un'`
   - `docker compose --env-file tmp/m2-smoke.env ps --format json`
   - `docker compose --env-file tmp/m2-smoke.env exec -T redis sh -lc 'redis-cli ping'`
   - `docker compose --env-file tmp/m2-smoke.env exec -T redis sh -lc 'redis-cli -a \"$REDIS_PASSWORD\" ping'`
   - `docker compose --env-file tmp/m2-smoke.env down`

## Runtime Smoke Results

1. Non-root runtime user: pass
   - `id -u` => `1000`
   - `id -un` => `node`
2. DB/Redis host bindings are localhost-only: pass
   - Redis publishers => `127.0.0.1:6379->6379`
   - Postgres publishers => `127.0.0.1:5432->5432`
3. Redis auth posture in production-mode stack: pass
   - `redis-cli ping` (no auth) => `NOAUTH Authentication required`
   - `redis-cli -a "$REDIS_PASSWORD" ping` => `PONG`
4. HSTS verification:
   - App-level production HSTS behavior test: pass (`safety-m2-runtime.test.ts`)
   - TLS termination path and deployed edge verification checklist: documented (`M2_TLS_HSTS_RUNBOOK_safety.md`)

## TLS/HSTS Documentation

- Path and verification checklist documented in:
  - `Milestones/M2/M2_TLS_HSTS_RUNBOOK_safety.md`

## Acceptance Mapping

- Product API container runs as non-root: pass
- Production compose/runtime does not expose Redis/Postgres publicly: pass
- Redis auth posture is locked for production runtime: pass
- TLS/HSTS termination path documented and verified: pass (local production scope)
