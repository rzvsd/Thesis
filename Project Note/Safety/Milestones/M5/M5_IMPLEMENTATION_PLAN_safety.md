# Safety M5 Implementation Plan (Prepared 2026-04-14)

## Goal

Deliver post-core auth enhancements without changing service boundaries:

1. Google OIDC sign-in/sign-up with strict account-linking controls.
2. `apps/product-api/src/server.ts` modular extraction with zero behavior regressions.

## Scope Lock

- In scope: `apps/product-api`, `infra/migrations`, `apps/product-api/tests`, Safety docs.
- Out of scope: new services, mobile auth redesign, non-required auth model rewrites.

## Preconditions

1. M1-M4 are closed with evidence.
2. Admin local auth runbook is available for deterministic manual checks.
3. Account-linking policy is explicitly approved.

## Implementation Slices

### Slice A - OIDC Configuration + Verification Module

- Add OIDC env vars (Google client IDs/audience + issuer allowlist).
- Add startup validation for OIDC config completeness.
- Implement a dedicated verifier module for Google ID token validation.
- Enforce checks: signature, issuer, audience, expiry, `email_verified=true`.

### Slice B - Identity Persistence

- Add migration for identity linkage storage (Google subject binding).
- Keep existing `users` model backward compatible for password users.
- Ensure one-to-one mapping between Google subject and user.

### Slice C - Auth Endpoints

- Add `POST /auth/google` for sign-up/sign-in by validated Google token.
- Add explicit link flow endpoint for password-origin accounts (if required by approved policy).
- Keep session/refresh semantics aligned with existing auth path (rotation + reuse protection).

### Slice D - Regression and Security Tests

- Add M5 integration tests for:
  - new Google signup
  - linked Google sign-in
  - unlinked password-account protection behavior
  - invalid/expired token rejection
- Re-run existing auth/security suites to prove no regressions.

### Slice E - `server.ts` Modular Extraction

- Extract route handlers into modules by domain while preserving route contracts:
  - auth
  - user/profile/subscription
  - jobs/reports
  - internal endpoints
  - watchlist/pulse/scenario
- Keep request parsing, auth guard, rate-limit policy, and error envelope behavior identical.

## Verification Commands

1. `corepack pnpm --filter @thesis/product-api typecheck`
2. `corepack pnpm --filter @thesis/product-api test`
3. `corepack pnpm run security:ci`
4. `corepack pnpm typecheck`
5. `corepack pnpm test`

## Evidence Output

- `Milestones/M5/evidence/M5_SMOKE_EVIDENCE_<date>.md`
- logs for product-api tests/typecheck, security CI, workspace tests/typecheck

## Risk Controls

1. OIDC rollout behind explicit config gate (disabled by default if config missing).
2. No route removals during refactor; only extraction with parity tests.
3. If regression appears, revert to prior route wiring and ship OIDC slice separately.

## Decision Required From Owner

For existing password account with same verified Google email but no prior link:

1. `BLOCK_UNLINKED` (recommended): deny Google sign-in until password-authenticated explicit link.
2. `AUTO_LINK_VERIFIED_EMAIL`: auto-link on first Google sign-in when email is verified.
