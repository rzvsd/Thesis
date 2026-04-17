# AGENTS.md — Phase 6 M4 Earnings State & War Room Substrate
**Milestone:** M4 — Earnings State & War Room Substrate  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` — read both first.  
**Location:** `Phase6/M4/M4_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M4 — Earnings State & War Room Substrate |
| **Linear Project** | PH6 M4 — Earnings State & War Room Substrate |
| **Owner** | Product API Owner + AI/Reasoning Engineer |
| **Status** | Planned |
| **Depends on** | M3 complete |

---

## 1. What This Milestone Is Building

Use estimated/confirmed/actual state and first-party artifacts to power earnings workflows.

---

## 2. Scope — What Is In

- [ ] three-state earnings model
- [ ] event-window triggers
- [ ] War Room evidence pack
- [ ] earnings alert reason paths
- [ ] transcript-optional workflow support

---

## 3. Scope — What Is Out

- [ ] new paid earnings calendar vendor
- [ ] transcript-as-required-core-path
- [ ] market-price-heavy event windows

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `product-api` | earnings state and War Room APIs |
| `scheduler` | event-window orchestration |
| `dexter-worker` | follow-up questions and contradiction summaries |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `EarningsEventState` | estimated/confirmed/actual |
| `CallArtifact` | earnings materials |
| `alert payloads` | reason path compatibility |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M4 — Earnings State & War Room Substrate

Ticket naming:

```text
[PH6-M4] What is being built
[PH6-M4][BUG] What is broken
[PH6-M4][SPIKE] What is being investigated
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

Step 1: Seed estimated and confirmed events in test mode
Step 2: Confirm the API distinguishes the states
Step 3: Trigger a results artifact and confirm actual state
Step 4: Open War Room payload and confirm transcript is optional
Step 5: Confirm alert reason paths are present

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
