# AGENTS.md - Phase 3 M5 Controlled Beta and Launch Decision
**Milestone:** Phase 3 M5 - Controlled Beta and Launch Decision  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase2/ph2_AGENTS.md`, then `Project Note/Phase3/ph3_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase3/Milestones/M5/M5_MILESTONE_AGENTS_ph3.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 3 M5 - Controlled Beta and Launch Decision |
| **Linear Project** | Phase 3 M5 - Controlled Beta and Launch Decision |
| **Owner** | Product Lead + Engineering Lead + QA Lead + Support Owner |
| **Status** | Planned |
| **Depends on** | Phase 3 M4 closed |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Beta cohort definition is fixed: closed Android beta, invite-only, capped at 100 users, all beta users receive Pro access during the beta period | RESOLVED | Product Lead | Milestone start |
| G2 | Support intake path is fixed: in-app feedback and support contacts persist into `user_feedback_queue`; support owner performs daily triage and raises Linear issues when follow-up is required | RESOLVED | Support Owner + Engineering Lead | Milestone start |
| G3 | Launch scorecard thresholds are fixed: crash-free sessions >= 99.5%, five-pass RC smoke green, no Sev-1 launch blockers open, activation >= 35% of beta invite acceptances, notification disablement < 15% of push-receiving beta users, trust complaints reviewed weekly with no unresolved severe cluster | RESOLVED | Product Lead + Analytics Owner + QA Lead | Milestone start |
| G4 | Go/no-go authority is fixed: Product Lead, Engineering Lead, and QA Lead all sign; any one of the three may veto launch on trust, reliability, or safety grounds | RESOLVED | Product Lead + Engineering Lead | Milestone start |

**Rule:** M5 exists to make launch decision-making explicit. It cannot collapse into a vague review meeting or a launch-by-fatigue decision.

---

## 1. What This Milestone Is Building

M5 turns launch into an operating process instead of a hopeful milestone closeout.

This milestone adds:

- controlled beta structure
- support and issue intake loop
- weekly evidence review cadence
- launch scorecard
- go/no-go checklist
- final launch rehearsal

**Plain English summary for non-technical audit:**  
M5 is the milestone that prevents the team from launching just because they are tired of building.

---

## 2. Read These Files First

### Phase 1 and 2 docs

- `Project Note/Phase1/MILESTONES.md` (M9)
- `Project Note/Phase2/ph2_MILESTONES.md` (M9)
- `Project Note/Phase2/Milestones/M9/M9_MILESTONE_AGENTS_ph2.md`

### Phase 3 docs

- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_ROADMAP.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/Milestones/M5/M5_SMOKE_PLAN_ph3.md`

---

## 3. Scope - What Is In

- [ ] Controlled beta cohort and invite logic
- [ ] Support/feedback intake and triage
- [ ] Weekly beta review cadence and template
- [ ] Launch scorecard with explicit thresholds
- [ ] Go/no-go checklist
- [ ] Final launch rehearsal and sign-off

Full acceptance source: `Project Note/Phase3/ph3_MILESTONES.md -> M5`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| New product features | Phase 3 build milestones are already complete |
| New hardening implementation work unless blocking | M4 should already have closed the implementation gap |
| Unstructured launch-by-feel decision making | Directly against milestone purpose |

---

## 5. Services And Workstreams You Are Working In

| Workstream | What is being changed |
|---|---|
| Product Ops | Beta cohort design, review cadence, launch scorecard |
| Support | Intake ownership, routing, issue tagging |
| QA | Final rehearsal execution, blocker validation |
| Engineering | Launch-blocker closeout confirmation and rollback readiness |
| Analytics | Scorecard population and weekly evidence review |

---

## 6. Phase 1 and 2 Wiring Obligations

| Existing System | Built In | Phase 3 M5 Change | Why Here |
|---|---|---|---|
| Launch hardening baseline | Phase 1 M9 and Phase 2 M9 | Consume and verify rather than assume | Hardening only matters if it survives launch review |
| Monetization and analytics instrumentation | Phase 2 M4, Phase 2 M9, Phase 3 M3 | Feed launch scorecard and beta review | Launch judgment needs commercial and behavioral evidence |
| Real-device and reliability proof | Phase 3 M4 | Convert proof into launch decision | M5 is where evidence becomes action |

---

## 7. Linear Ticket Rules For This Milestone

**Project:** Phase 3 M5 - Controlled Beta and Launch Decision

**Naming:**
```
[PH3-M5] What is being built
[PH3-M5][BUG] What is broken
[PH3-M5][SPIKE] What is being investigated
```

| Ticket | Acceptance Mapping |
|---|---|
| `[PH3-M5] Controlled beta plan` | Beta cohort criteria |
| `[PH3-M5] Support and triage loop` | Feedback intake criteria |
| `[PH3-M5] Launch scorecard` | Scorecard criteria |
| `[PH3-M5] Go/no-go checklist` | Release gate criteria |
| `[PH3-M5] Final launch rehearsal` | Rehearsal/sign-off criteria |

---

## 8. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Beta issue received | INFO | `{ owner, source, category, timestamp }` |
| Launch blocker raised | WARN | `{ owner, blocker_type, severity, timestamp }` |
| Launch blocker unresolved at review | ERROR | `{ owner, blocker_type, timestamp }` |
| Go/no-go decision recorded | INFO | `{ decision, reviewer_group, timestamp }` |

---

## 9. Testing Requirements

- [ ] Final launch rehearsal executed end-to-end
- [ ] Beta intake path verified
- [ ] Launch scorecard populated from real beta or staged rehearsal data
- [ ] Explicit blocker review completed

Detailed execution lives in `M5_SMOKE_PLAN_ph3.md`.

---

## 10. Definition Of Done

- [ ] All M5 acceptance criteria in `ph3_MILESTONES.md` are satisfied
- [ ] Smoke plan executed with evidence
- [ ] Go/no-go checklist completed
- [ ] Product, QA, and Engineering sign-off recorded
- [ ] If go, launch is approved with reasons
- [ ] If no-go, blockers are written and assigned

---

## 11. Smoke Test Log

```text
Date:
Run by:
Environment:
Result:

Notes:
- 
```

---

## 12. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| None yet | - | - | - |

---

## 13. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Beta cohort definition | Closed Android beta, invite-only, capped at 100 users, all beta users receive Pro during beta | No |
| Support intake path | In-app feedback and support contacts persist into `user_feedback_queue`; support owner performs daily triage and raises Linear issues when needed | No |
| Launch scorecard thresholds | Crash-free sessions >= 99.5%, five-pass RC smoke green, no Sev-1 blockers open, activation >= 35% of beta invite acceptances, notification disablement < 15% of push-receiving beta users, and no unresolved severe trust-complaint cluster | No |
| Go/no-go authority | Product Lead, Engineering Lead, and QA Lead all sign; any one of the three may veto on trust, reliability, or safety grounds | No |
