# AGENTS.md - Safety M1 API Perimeter Hardening

**Milestone:** Safety M1  
**Status:** Active  
**Depends on:** None

---

## Scope In

- Timing-safe internal token comparison
- Request-body size cap with `413`
- Security response headers
- Explicit CORS allowlist and preflight handling

## Scope Out

- Auth lockout/rotation logic (M3)
- Docker/runtime exposure controls (M2)
- CI security gates (M4)

## Definition Of Done

- [ ] M1 acceptance criteria in `safety_MILESTONES.md` completed
- [ ] `M1_SMOKE_PLAN_safety.md` executed and logged
- [ ] Product API tests/typecheck pass
