# AGENTS.md - Phase 6 M3 Morning Exception Briefing & Macro Stress
**Milestone:** M3 - Morning Exception Briefing & Macro Stress  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M3/M3_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M3 - Morning Exception Briefing & Macro Stress |
| **Linear Project** | PH6 M3 - Morning Exception Briefing & Macro Stress |
| **Owner** | Scheduler Owner + Product Lead |
| **Status** | Planned |
| **Depends on** | M2 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Rebuild Pulse around official macro, canonical events, and bounded context; replace fear/greed.

---

## 2. Scope - What Is In

- [ ] morning exception briefing pipeline
- [ ] Macro Stress snapshot
- [ ] no-material-change output
- [ ] My Names relevance via event/context logic
- [ ] updated pulse smoke coverage

---

## 3. Scope - What Is Out

- [ ] quote-board re-creation
- [ ] licensed intraday market data
- [ ] earnings War Room behavior beyond what Pulse needs

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `scheduler` | briefing generation and macro stress cadence |
| `product-api` | briefing storage and delivery |
| `mobile` | truthful presentation of no-change and omission states |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `MacroStressSnapshot` | official-only stress state |
| `AnalysisReport / pulse payloads` | Phase 6-compatible pulse sections |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M3 - Morning Exception Briefing & Macro Stress

Ticket naming:

```text
[PH6-M3] What is being built
[PH6-M3][BUG] What is broken
[PH6-M3][SPIKE] What is being investigated
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

Step 1: Trigger Morning Exception Briefing in test mode
Step 2: Confirm a valid briefing is stored
Step 3: Confirm Macro Stress validates
Step 4: Run no-material-change fixture and confirm explicit output
Step 5: Confirm no deprecated provider path is needed

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
