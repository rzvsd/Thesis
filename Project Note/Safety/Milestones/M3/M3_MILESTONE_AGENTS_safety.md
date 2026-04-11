# AGENTS.md - Safety M3 Auth Abuse Resistance

**Milestone:** Safety M3  
**Status:** Active  
**Depends on:** M1, M2

---

## Scope In

- Auth route-specific rate limits
- Timed account lockout (`10 failures / 15 min`)
- Refresh token/session rotation on every refresh
- Refresh reuse detection with token-family revocation

## Scope Out

- Google OIDC sign-in/sign-up (M5)
- `server.ts` modular refactor (M5)

## Definition Of Done

- [ ] M3 acceptance criteria in `safety_MILESTONES.md` completed
- [ ] `M3_SMOKE_PLAN_safety.md` executed and logged
- [ ] Auth integration/regression tests pass
