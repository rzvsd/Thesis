# AGENTS.md - Phase 6 M5 Deep Dive / Scenario Final Cutover & Hardening
**Milestone:** M5 - Deep Dive / Scenario Final Cutover & Hardening  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M5/M5_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M5 - Deep Dive / Scenario Final Cutover & Hardening |
| **Linear Project** | PH6 M5 - Deep Dive / Scenario Final Cutover & Hardening |
| **Owner** | Engineering Lead + Product Lead |
| **Status** | Planned |
| **Depends on** | M4 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Finish the provider-free Deep Dive and Scenario migration, then prove the product still works end to end.

---

## 2. Scope - What Is In

- [ ] Deep Dive cutover to official + first-party substrate
- [ ] scenario / valuation input model without beta dependency
- [ ] compatibility layer for older reports
- [ ] end-to-end smoke proof
- [ ] rollback rehearsal and final dependency proof

---

## 3. Scope - What Is Out

- [ ] new premium data contracts
- [ ] licensed quote re-entry
- [ ] post-phase backlog experiments

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `dexter-worker` | Phase 6 Deep Dive and scenario logic |
| `product-api` | read/write compatibility and end-to-end orchestration |
| `mobile` | omission and provenance-safe rendering |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `AnalysisReport` | Phase 6-compatible read model |
| `scenario payloads` | explicit omission semantics |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M5 - Deep Dive / Scenario Final Cutover & Hardening

Ticket naming:

```text
[PH6-M5] What is being built
[PH6-M5][BUG] What is broken
[PH6-M5][SPIKE] What is being investigated
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

Step 1: Run Deep Dives for 3 names
Step 2: Confirm reports validate without deprecated providers
Step 3: Run a scenario with one omitted market-derived dimension
Step 4: Confirm omission is explicit
Step 5: Run the final dependency scan and confirm clean pass

Steps failed (if any):
Notes:
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| - | - | - |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| - | - | - | - |
