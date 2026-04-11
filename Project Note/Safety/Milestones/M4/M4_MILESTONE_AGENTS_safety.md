# AGENTS.md - Safety M4 Verification and CI Security Gates

**Milestone:** Safety M4  
**Status:** Active  
**Depends on:** M1, M2, M3

---

## Scope In

- Security-focused integration test suite
- CI vulnerability audit gate
- CI secret scan + SAST baseline gate
- Production startup guards for insecure config

## Scope Out

- Google OIDC (M5)
- `server.ts` modularization (M5)

## Definition Of Done

- [ ] M4 acceptance criteria in `safety_MILESTONES.md` completed
- [ ] `M4_SMOKE_PLAN_safety.md` executed and logged
- [ ] CI gates visible and passing
