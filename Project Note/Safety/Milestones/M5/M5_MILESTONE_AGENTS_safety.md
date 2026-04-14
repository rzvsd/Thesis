# AGENTS.md - Safety M5 Post-Core Enhancements

**Milestone:** Safety M5  
**Status:** Ready for owner closeout (implementation complete on 2026-04-14; awaiting approval)  
**Depends on:** M1, M2, M3, M4 (all closed)

---

## Start Gate

- [x] M1 closed with evidence
- [x] M2 closed with evidence
- [x] M3 closed with evidence
- [x] M4 closed with evidence

## Scope In

- Google OIDC sign-in/sign-up lane with strict account linking
- `server.ts` modular split for safer audits and route-level review

## Scope Out

- Any new service creation
- Auth model rewrites not required by OIDC integration

## Definition Of Done

- [x] M5 acceptance criteria defined and approved at kickoff
- [x] `M5_SMOKE_PLAN_safety.md` updated from placeholder to executable plan
- [x] Regression coverage proves no auth behavior regressions
- [x] Route modular extraction landed with regression-backed parity

## Kickoff Readiness

- [x] M5 start gate satisfied (M1-M4 closed with evidence)
- [x] M5 smoke plan upgraded to executable workflow
- [x] Account-linking policy decision confirmed by owner (required before coding OIDC lane)

## Owner Decision Needed Before OIDC Coding

Existing password account + same Google email, but no prior link:

1. `BLOCK_UNLINKED` (recommended): reject Google sign-in with deterministic error until user authenticates by password and links explicitly.
2. `AUTO_LINK_VERIFIED_EMAIL`: link automatically if Google email is verified.

Default preparation assumes `BLOCK_UNLINKED` for safest behavior.

## Progress Log

- 2026-04-14: `BLOCK_UNLINKED` policy implemented for Google OIDC sign-in.
- 2026-04-14: Added explicit `POST /auth/google/link` flow for password-authenticated linking.
- 2026-04-14: Added OIDC verification module, identity persistence migration, and integration tests.
- 2026-04-14: Extracted auth/public route domains from `server.ts` into dedicated modules (`auth-routes.ts`, `public-routes.ts`) with no behavior regressions.
- 2026-04-14: Product API + workspace typecheck/tests + security CI commands executed successfully with evidence logs in `Milestones/M5/evidence/`.

## Execution Plan Reference

- `Milestones/M5/M5_IMPLEMENTATION_PLAN_safety.md`
