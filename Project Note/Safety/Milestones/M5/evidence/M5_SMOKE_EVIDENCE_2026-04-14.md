# M5 Smoke Evidence - 2026-04-14

## Scope Verified

- Google OIDC sign-up/sign-in lane with `BLOCK_UNLINKED` policy.
- Explicit password-authenticated account linking endpoint.
- `server.ts` modular extraction completed for domain route modules:
  - `apps/product-api/src/routes/auth-routes.ts`
  - `apps/product-api/src/routes/public-routes.ts`
- No regressions observed in existing auth/session/security flows.

## Commands Executed

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`71` tests, `0` failures)
3. `corepack pnpm run security:ci` -> pass
4. `corepack pnpm typecheck` -> pass
5. `corepack pnpm test` -> pass

## Security CI Notes

- `pnpm audit --audit-level critical` completed and did not fail the gate.
- Current audit summary reported open vulnerabilities below critical threshold; tracked for follow-up hardening backlog.
- SAST baseline passed with no high-confidence findings.

## M5 OIDC-Specific Test Outcomes

- `M5 Google OIDC creates new user and supports linked sign-in` -> pass
- `M5 Google OIDC blocks unlinked existing password account with BLOCK_UNLINKED` -> pass
- `M5 Google explicit link endpoint links account and enables OIDC sign-in` -> pass
- `M5 Google OIDC rejects invalid and expired tokens` -> pass

## Result

- OIDC lane is implemented and regression-backed on local environment.
- Route modularization is implemented with parity preserved by full smoke/test matrix.

## Artifacts

- `Milestones/M5/evidence/product_api_typecheck.log`
- `Milestones/M5/evidence/product_api_test.log`
- `Milestones/M5/evidence/security_ci.log`
- `Milestones/M5/evidence/workspace_typecheck.log`
- `Milestones/M5/evidence/workspace_test.log`
