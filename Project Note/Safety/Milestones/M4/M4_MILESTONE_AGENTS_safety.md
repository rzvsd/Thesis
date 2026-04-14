# AGENTS.md - Safety M4 Verification and CI Security Gates

**Milestone:** Safety M4  
**Status:** Closed (2026-04-14)  
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

- [x] M4 acceptance criteria in `safety_MILESTONES.md` completed
- [x] `M4_SMOKE_PLAN_safety.md` executed and logged
- [x] CI gates visible and passing

## Closeout Note

- M4 is closed with smoke evidence in `Milestones/M4/evidence/M4_SMOKE_EVIDENCE_2026-04-14.md`.
- Security verification now covers auth protection, IDOR prevention, oversized payload handling, token expiry paths, CI security gates, and startup guard enforcement.
