# Safety M4 Smoke Evidence (2026-04-14)

## Scope

- Milestone: Safety M4 - Verification and CI Security Gates
- Goal: prove security integration coverage, CI security gates, and startup guard enforcement.

## Validation Commands

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`65` tests)
3. `corepack pnpm run security:audit` -> pass (`--audit-level critical`)
4. `corepack pnpm run security:sast` -> pass (`SAST baseline: pass`)
5. `corepack pnpm typecheck` -> pass
6. `corepack pnpm test` -> pass

## M4 Smoke Coverage (Automated)

M4 smoke-plan scenarios are covered by Product API security tests:

1. Unauthenticated access blocked:
   - `M4 security: protected routes reject unauthenticated requests` -> pass
2. IDOR prevention on report access:
   - `M4 security: IDOR protection prevents cross-user report access` -> pass
3. Oversized payload handling:
   - `M4 security: oversized payloads are rejected with 413` -> pass
4. Token expiry paths:
   - `M4 security: expired access and refresh tokens are rejected` -> pass
5. Insecure production startup guard:
   - `M4 security: startup guard fails on insecure production redis auth config` -> pass

## CI Gate Verification

- CI workflow now includes:
  - `Security | Dependency Audit (critical)` -> `corepack pnpm run security:audit`
  - `Security | Secret Scan (gitleaks)` -> gitleaks container scan with `.gitleaks.toml`
  - `Security | SAST Baseline` -> `corepack pnpm run security:sast`

## Artifacts

- Evidence log directory:
  - `Milestones/M4/evidence/2026-04-14_m4/`
- Captured logs:
  - `product_api_typecheck.log`
  - `product_api_test.log`
  - `security_audit.log`
  - `security_sast.log`
  - `workspace_typecheck.log`
  - `workspace_test.log`

## Acceptance Mapping

- Security integration tests exist for auth/IDOR/oversize/token expiry paths: pass
- CI runs vulnerability audit gate: pass
- CI runs secret scan and SAST baseline: pass
- Production startup fails on insecure config values: pass
