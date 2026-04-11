# AGENTS.md - Safety M2 Runtime and Infra Hardening

**Milestone:** Safety M2  
**Status:** Closed (2026-04-11, local scope)  
**Depends on:** M1

---

## Scope In

- Non-root container user for runtime
- Production compose/network exposure hardening for DB/Redis
- Redis production auth posture
- TLS/HSTS deployment posture documentation and verification

## Scope Out

- Auth lockout/refresh semantics (M3)
- CI security gates (M4)

## Definition Of Done

- [x] M2 acceptance criteria in `safety_MILESTONES.md` completed
- [x] `M2_SMOKE_PLAN_safety.md` executed and logged
- [x] Infra/runtime checks documented with evidence

## Closeout Note

- This milestone is closed for local/non-VPS scope.
- TLS/HSTS app behavior is validated in production-mode runtime tests and documented for deployed edge verification when VPS/edge is introduced.
