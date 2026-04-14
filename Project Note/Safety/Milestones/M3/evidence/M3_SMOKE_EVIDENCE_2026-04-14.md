# Safety M3 Smoke Evidence (2026-04-14)

## Scope

- Milestone: Safety M3 - Auth Abuse Resistance
- Goal: prove route-specific auth rate limits, timed lockout, refresh rotation on every use, and refresh reuse family revocation.

## Validation Commands

1. `corepack pnpm --filter @thesis/product-api typecheck` -> pass
2. `corepack pnpm --filter @thesis/product-api test` -> pass (`60` tests)

## M3 Smoke Coverage (Automated)

M3 smoke-plan scenarios are covered by Product API auth tests:

1. Auth route-specific thresholds:
   - `auth routes apply stricter route-specific limits than general routes` -> pass
2. Timed lockout + auto-unlock:
   - `lockout enforces 10-fail style policy with auto-unlock window` -> pass
3. Refresh rotation invalidates prior token:
   - `auth lifecycle supports register -> verify -> login -> refresh -> logout` -> pass
4. Refresh reuse detection and family revocation:
   - `refresh reuse detection revokes the token family` -> pass

## Acceptance Mapping

- Auth endpoints have stricter route-specific rate limits: pass
- Timed account lockout is enforced (`10 failures / 15 min`): pass
- `/auth/refresh` rotates refresh token/session every use: pass
- Refresh reuse detection revokes token family safely: pass
