# Safety M5 Smoke Plan

## Purpose

Prove Google OIDC onboarding/auth and `server.ts` modular split ship with no auth regressions.

## Preconditions

1. M1-M4 are closed with evidence.
2. Local auth verification uses admin bootstrap account from `Project Note/Admin/ADMIN_LOGIN_RUNBOOK.md`.
3. OIDC account-linking policy is explicitly approved before implementation begins.

## Smoke Steps

1. Google OIDC new-user signup
   - Valid Google ID token (verified email) creates a user/session.
   - Response returns access/refresh tokens and profile payload.
2. Google OIDC sign-in for existing linked user
   - Valid token for already-linked Google subject signs in successfully.
3. Existing password account linking protection
   - Same email but unlinked Google account is handled per approved policy.
   - No silent unsafe takeover of password-origin account.
4. Token hardening checks
   - Invalid issuer/audience/signature rejected.
   - Expired token rejected.
   - Replay-safe semantics verified for refresh/session behavior after OIDC sign-in.
5. Regression checks for existing auth lane
   - Email/password register -> verify -> login -> refresh -> logout still passes.
   - Lockout, auth route rate limits, refresh reuse detection still pass.
6. `server.ts` modularization regression
   - Route behavior unchanged for core auth/report/subscription endpoints.
   - Contract shape unchanged for existing API responses.

## Required Commands

1. `corepack pnpm --filter @thesis/product-api typecheck`
2. `corepack pnpm --filter @thesis/product-api test`
3. `corepack pnpm run security:ci`
4. `corepack pnpm typecheck`
5. `corepack pnpm test`

## Evidence

- Directory: `Milestones/M5/evidence/`
- Required artifacts:
  - `M5_SMOKE_EVIDENCE_<date>.md`
  - `product_api_typecheck.log`
  - `product_api_test.log`
  - `security_ci.log`
  - `workspace_typecheck.log`
  - `workspace_test.log`
