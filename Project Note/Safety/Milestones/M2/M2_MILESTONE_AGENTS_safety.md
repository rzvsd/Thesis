# AGENTS.md - Safety M2 Runtime and Infra Hardening

**Milestone:** Safety M2  
**Status:** Active  
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

- [ ] M2 acceptance criteria in `safety_MILESTONES.md` completed
- [ ] `M2_SMOKE_PLAN_safety.md` executed and logged
- [ ] Infra/runtime checks documented with evidence
