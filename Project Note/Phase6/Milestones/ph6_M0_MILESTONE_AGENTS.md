# AGENTS.md — Phase 6 M0 Dependency Audit & Cutover Plan
**Milestone:** M0 — Dependency Audit & Cutover Plan  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` — read both first.  
**Location:** `Phase6/M0/M0_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M0 — Dependency Audit & Cutover Plan |
| **Linear Project** | PH6 M0 — Dependency Audit & Cutover Plan |
| **Owner** | Platform Architect + Engineering Lead |
| **Status** | Planned |
| **Depends on** | Phase 5 docs and current repo inventory |

---

## 1. What This Milestone Is Building

Inventory and guard every deprecated provider assumption before implementation spreads.

---

## 2. Scope — What Is In

- [ ] dependency inventory for protected production paths
- [ ] Phase 6 doc pack creation and linkage
- [ ] ADR drafting for the final architecture phase
- [ ] CI / local guardrail for deprecated imports or required envs
- [ ] migration matrix per surface
- [ ] secret and env deprecation inventory

---

## 3. Scope — What Is Out

- [ ] official adapter implementation
- [ ] first-party fetch implementation
- [ ] new mobile UI work beyond doc-linked compatibility notes

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `repo-wide docs` | phase docs and override notes |
| `CI` | dependency scan and guardrail |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `n/a` | Documentation and policy milestone |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M0 — Dependency Audit & Cutover Plan

Ticket naming:

```text
[PH6-M0] What is being built
[PH6-M0][BUG] What is broken
[PH6-M0][SPIKE] What is being investigated
```

Every ticket must include:

- service touched
- contract touched (if any)
- `ph6_MILESTONES.md` acceptance criterion it satisfies
- whether the work removes or audits a deprecated dependency assumption

Never close a ticket without the relevant smoke proof or test evidence.

---

## 7. Logging For This Milestone

Phase 6 logs remain structured JSON.

Minimum additional requirement for this milestone:

- if a path degrades because of source coverage, rights state, or deprecated dependency fallback pressure, that reason must be visible in the log context

Never log secrets, tokens, or unreviewed full text.

---

## 8. Error Handling For This Milestone

- No empty catch blocks
- Every failed job or fetch must surface the responsible service and failure reason
- Rights violations are treated as real failures, not silent warnings
- Deprecated-provider fallback is not an acceptable hidden recovery path

---

## 9. Testing Requirements For This Milestone

- milestone-specific contract validation where applicable
- smoke proof against the Phase 6 ruleset
- deprecated dependency guard passing for affected paths
- golden fixtures or deterministic test data where appropriate

---

## 10. Definition of Done

- [ ] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied
- [ ] Smoke test executed in full and recorded below
- [ ] CI passes
- [ ] Deprecated dependency check passes
- [ ] Rollback path confirmed
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date:
Run by:
Environment:
Result:

Step 1: Run the dependency scan
Step 2: Confirm all known deprecated provider references are surfaced
Step 3: Add a temporary forbidden import in test mode
Step 4: Confirm the guard fails
Step 5: Remove the temporary import and confirm the guard passes

Steps failed (if any):
Notes:
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| — | — | — |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| — | — | — | — |
