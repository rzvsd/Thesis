# Safety M1 Smoke Plan

## Purpose

Prove API perimeter protections are active and deterministic.

## Steps

1. Verify invalid internal token path behaves correctly with timing-safe compare implementation.
2. Submit oversized JSON payload and confirm `413 Payload Too Large`.
3. Verify required response security headers on representative endpoints.
4. Verify CORS preflight and allowlist behavior for approved and rejected origins.

## Evidence

- API test output
- Manual curl/httpie command output
- Notes saved in `Milestones/M1/evidence/`

## Execution Log - 2026-04-11

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`53` tests)
3. `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m1-perimeter.test.js` -> pass (`4` tests)
4. Manual smoke commands executed and captured in:
   `Milestones/M1/evidence/M1_SMOKE_EVIDENCE_2026-04-11.md`
