# AGENTS.md - Safety M5 Post-Core Enhancements

**Milestone:** Safety M5  
**Status:** TBD  
**Depends on:** M1, M2, M3, M4 (all closed)

---

## Start Gate

- [x] M1 closed with evidence
- [x] M2 closed with evidence
- [x] M3 closed with evidence
- [ ] M4 closed with evidence

## Scope In

- Google OIDC sign-in/sign-up lane with strict account linking
- `server.ts` modular split for safer audits and route-level review

## Scope Out

- Any new service creation
- Auth model rewrites not required by OIDC integration

## Definition Of Done

- [ ] M5 acceptance criteria defined and approved at kickoff
- [ ] `M5_SMOKE_PLAN_safety.md` updated from placeholder to executable plan
- [ ] Regression coverage proves no auth behavior regressions
