# Thesis - Safety AGENTS.md

**Scope:** Safety phase milestones (M1-M5).  
**Inherits from:** Root `AGENTS.md`.

---

## Who You Are

You are the coding agent for the Safety phase.

Your job is to implement verified security controls and preserve existing architecture boundaries.  
You do not invent new services or hidden product policy.

---

## Read Order Before Work

1. Root `AGENTS.md`
2. `safety_MILESTONES.md`
3. Current milestone file under `Safety/Milestones/M#/`
4. `vibe_code_safety.md` for source audit context

---

## Safety Phase Rules

1. Fix exploitable risks before maintainability refactors.
2. Preserve existing service topology (`product-api`, `scheduler`, `contracts`, mobile).
3. Keep changes additive where possible; avoid unnecessary contract breaks.
4. Every hardening change must have smoke evidence.
5. Any control that can impact auth/session semantics needs regression coverage.

---

## Locked Decisions

1. Account lockout policy: timed lock (`10 failures / 15 min`, auto-unlock).
2. Refresh policy: rotate refresh token/session on every refresh, detect reuse.
3. CORS/TLS posture: strict now (explicit allowlist + documented production TLS/HSTS).
4. Google auth and `server.ts` split are delivered in M5 and must be preserved in future changes.

---

## Definition Of Done (Per Milestone)

1. Acceptance criteria in `safety_MILESTONES.md` are complete.
2. Milestone smoke plan is executed and logged.
3. Required typecheck/tests pass.
4. Deferrals are explicit (not implicit).
