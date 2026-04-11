# Safety M1 Smoke Evidence (2026-04-11)

## Scope

- Milestone: Safety M1 - API Perimeter Hardening
- Goal: verify timing-safe internal auth checks, oversized JSON guard (`413`), API response security headers, and explicit CORS allowlist behavior.

## Quality Checks

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`53` tests)
3. `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m1-perimeter.test.js` -> pass (`4` tests)

## Revalidation Log (2026-04-11)

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`53` tests)
3. `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m1-perimeter.test.js` (from `apps/product-api`) -> pass (`4` tests)

## Manual Smoke Summary

Using the local node harness against an ephemeral `startServer(0)` runtime:

- Internal route with invalid `x-internal-token` -> `401 unauthorized`
- Internal route with valid token -> `200` (`missing: true`)
- Oversized `/auth/register` payload (`MAX_JSON_BODY_BYTES=128`) -> `413 payload_too_large`
- `/health` response includes:
  - `x-content-type-options: nosniff`
  - `x-frame-options: DENY`
  - `referrer-policy: no-referrer`
  - `content-security-policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
  - `permissions-policy: camera=(), microphone=(), geolocation=()`
- CORS preflight:
  - allowed origin `https://allowed.example` -> `204` + `access-control-allow-origin`
  - blocked origin `https://blocked.example` -> `403 forbidden_origin`

## Acceptance Mapping

- Internal token comparison is timing-safe: pass
- JSON body cap + `413` behavior: pass
- Security headers on API responses: pass
- CORS allowlist + preflight handling: pass
