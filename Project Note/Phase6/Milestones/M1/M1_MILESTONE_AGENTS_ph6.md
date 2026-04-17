# AGENTS.md - Phase 6 M1 Official Truth Data Plane
**Milestone:** M1 - Official Truth Data Plane  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M1/M1_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M1 - Official Truth Data Plane |
| **Linear Project** | PH6 M1 - Official Truth Data Plane |
| **Owner** | Data Platform Engineer |
| **Status** | Planned |
| **Depends on** | M0 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Build SEC and official macro adapters as the canonical production substrate.

---

## 2. Scope - What Is In

- [ ] SEC company truth adapters
- [ ] official macro adapters
- [ ] canonical filing and macro event normalization
- [ ] golden fixtures and missing-data tests
- [ ] no-provider-key smoke path

---

## 3. Scope - What Is Out

- [ ] rights-aware text storage
- [ ] first-party IR fetch logic
- [ ] mobile presentation changes

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `data-openbb` | official/public-source adapters only |
| `scheduler` | official refresh jobs |
| `product-api` | canonical event persistence |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `CanonicalEvent` | new typed event substrate |
| `existing company/macro contracts` | provider-agnostic official-source semantics |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M1 - Official Truth Data Plane

Ticket naming:

```text
[PH6-M1] What is being built
[PH6-M1][BUG] What is broken
[PH6-M1][SPIKE] What is being investigated
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

Step 1: Start the official-source adapters
Step 2: Request company truth for AAPL, MSFT, and TSLA
Step 3: Confirm payloads validate and include missing-field truth
Step 4: Request approved macro scope and confirm validation
Step 5: Remove deprecated provider keys and confirm the smoke still passes

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
