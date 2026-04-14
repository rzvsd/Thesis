# AGENTS.md - Safety M3 Auth Abuse Resistance

**Milestone:** Safety M3  
**Status:** Closed (2026-04-14)  
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

- [x] M3 acceptance criteria in `safety_MILESTONES.md` completed
- [x] `M3_SMOKE_PLAN_safety.md` executed and logged
- [x] Auth integration/regression tests pass

## Closeout Note

- M3 is closed with regression-backed smoke evidence in `Milestones/M3/evidence/M3_SMOKE_EVIDENCE_2026-04-14.md`.
- Implementation includes route-specific auth rate limiting, timed lockout semantics, refresh rotation per use, and token-family revocation on refresh reuse detection.
