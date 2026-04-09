# AGENTS.md - Phase 5 M4 Earnings War Room
**Milestone:** Phase 5 M4 - Earnings War Room  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M4/M4_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M4 - Earnings War Room |
| **Linear Project** | Phase 5 M4 - Earnings War Room |
| **Owner** | Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer |
| **Status** | Planned |
| **Depends on** | M1-M3 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | War Room includes pre, live, and post event phases | RESOLVED | Product Lead | Milestone start |
| G2 | Live cycle defaults to `15 min` with automatic `30 min` fallback under degradation, without adding services | RESOLVED | Scheduler Engineer | Milestone start |
| G3 | Post-event Deep Dive refresh is auto-queued | RESOLVED | Product API Engineer | Milestone start |
| G4 | War Room remains thesis-first and explainable | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G5 | War Room visual execution keeps the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M4 builds the highest-intensity event workflow with one coherent pre/live/post earnings operating surface.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M2/M2_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M3/M3_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [ ] War Room contracts and API surfaces
- [ ] Pre-event playbook generation
- [ ] Live event accelerated update cycle
- [ ] Post-event Deep Dive queue and thesis-delta summary
- [ ] Rule re-evaluation and freshness reset
- [ ] Mobile War Room rendering and deep-link handling

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Cross-name propagation | M5 |
| Conviction timelines and coherence | M6 |
| Scenario stress cards | M7 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | War Room payload assembly and post-event orchestration |
| Scheduler | `apps/scheduler/` | Event-window cadence management |
| Dexter Worker | `apps/dexter-worker/` | Playbook synthesis and post-event delta synthesis |
| Mobile | `apps/mobile/android/` | War Room screen and routing |
| Contracts | `packages/contracts/` | War Room payload contracts |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| War Room pre/live/post payload | New | `packages/contracts/src/` |
| War Room route context payload | Additive | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M4 Change | Why Here |
|---|---|---|---|
| Earnings preview alerts | Phase 2 M5 | Upgrade to War Room entry path | Improve event readiness |
| Thesis drift metadata | Phase 3 M1 | Reuse for post-event delta | Preserve trust explainability |
| Route-safe tab map | Phase 4 M4 | War Room entry must remain route-safe | Avoid dead-end event UX |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M4 - Earnings War Room

Naming:
```text
[PH5-M4] What is being built
[PH5-M4][BUG] What is broken
[PH5-M4][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| War Room prepared | INFO | `{ service, ticker, event_date, war_room_id, timestamp }` |
| War Room live update | INFO | `{ service, ticker, cycle_interval_min, update_count, timestamp }` |
| War Room post-event close | INFO | `{ service, ticker, new_report_id, thesis_delta_status, timestamp }` |

---

## 10. Testing Requirements

- [ ] Product API and scheduler typecheck passes
- [ ] War Room integration tests pass for pre/live/post phases
- [ ] Live-cycle cadence tests validate `15 min` default and `30 min` fallback
- [ ] Deep Dive auto-queue and post-event delta tests pass
- [ ] Mobile compile and War Room route tests pass
- [ ] Earnings baseline regressions pass

Detailed execution lives in `M4_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M4 acceptance criteria in `ph5_MILESTONES.md` are satisfied
- [ ] Smoke plan executed with evidence
- [ ] Required regressions pass
- [ ] Linear tickets closed or explicitly deferred
- [ ] Product Lead sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: TBD
Run by: TBD
Environment: TBD
Result: TBD
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| None yet | - | - | - |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Event workflow model | Pre/live/post single War Room experience | No |
| Live update strategy | `15 min` default cadence with automatic `30 min` fallback inside existing scheduler | No |
