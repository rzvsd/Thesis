## Phase 5 Stabilization Plan: Builder Login + Persistent Access (Acceptance Draft)
**Status:** Closed (implemented and accepted for local/dev scope, 2026-04-11)  
**Scope:** Local and dev safety-first stabilization, no production behavior changes

### Summary
This plan removes login/onboarding friction that blocks testing speed while preserving production-safe behavior.

### Implementation Changes
1. Product API (non-production builder bootstrap)
- Added dev-only bootstrap config (`enabled`, `email`, `password hash`, `auto verify`, `force Pro`).
- Kept `/auth/login` external contract unchanged.
- Added bootstrap safety guard so bootstrap is ignored outside non-production.
- Kept this behavior internal and env-gated (no public bootstrap endpoint).

2. Mobile session/onboarding behavior
- Session-expired and logout flows now clear auth tokens without resetting onboarding completion.
- Onboarding remains first-launch behavior, not token-lifecycle behavior.
- No design-language change was introduced.

3. Documentation and local runbook
- `.env.example` now documents bootstrap keys.
- This admin note records behavior, safety controls, and verification snapshot.

### Public Interfaces / Contracts
- External API contracts: no breaking changes.
- Internal config surface: additive env keys only.
- Existing auth, subscription, and navigation contracts remain intact.

### Test Plan and Acceptance
1. API tests
- Builder auto-provision + verify + Pro tier path in non-production.
- Production ignores bootstrap even when env keys are present.
- Existing register/verify/login/refresh/logout flow unchanged.

2. Mobile behavior
- Session expiry and logout no longer replay onboarding if already completed.

Acceptance criteria:
- No repeated onboarding due to token expiry.
- No repeated API setup loop for normal builder usage.
- Builder credentials are usable in non-production.
- Production auth behavior remains unchanged.

### Assumptions and Defaults
- Non-production only behavior for admin bootstrap.
- Builder credentials are env-configured, never hardcoded.
- `.env` remains local and git-ignored.

### Implemented Safety Controls (Auditor View)
- `ADMIN_BOOTSTRAP_ENABLED` is honored only in non-production.
- In production (`NODE_ENV=production`), bootstrap is ignored and warning-logged.
- Enabled bootstrap requires valid email + valid bcrypt hash.
- No additional public API route was introduced.

### Local Verification Snapshot
- Product API typecheck: PASS.
- Product API targeted auth/config tests: PASS.
- Android compile/unit test in this environment: BLOCKED (`JAVA_HOME` missing).
