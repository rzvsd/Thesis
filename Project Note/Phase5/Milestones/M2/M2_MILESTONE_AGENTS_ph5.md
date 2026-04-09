# AGENTS.md - Phase 5 M2 Thesis Freshness and Decay
**Milestone:** Phase 5 M2 - Thesis Freshness and Decay  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M2/M2_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M2 - Thesis Freshness and Decay |
| **Linear Project** | Phase 5 M2 - Thesis Freshness and Decay |
| **Owner** | Product API Engineer + Scheduler Engineer + Mobile Engineer |
| **Status** | Planned |
| **Depends on** | M1 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Freshness states fixed: `current`, `aging`, `stale`, `triggered` | RESOLVED | Product Lead | Milestone start |
| G2 | Freshness formula includes age, unreviewed events, kill-switch proximity | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G3 | Freshness recompute runs in existing pre-market cycle | RESOLVED | Scheduler Engineer | Milestone start |
| G4 | Freshness signals are explainable and route-safe | RESOLVED | Mobile Engineer + Product API Engineer | Milestone start |
| G5 | All freshness UI states keep the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M2 builds visible conviction freshness so users can detect stale theses before failure events.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_BLUEBOOK.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [ ] Freshness fields in monitor snapshots and contracts
- [ ] Daily recompute with deterministic state transitions
- [ ] Material event counting and unreviewed-event tracking
- [ ] Freshness-decay notifications and alert-ledger entries
- [ ] Names UI freshness rendering

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Morning exception personalization | M3 |
| Earnings event workflow | M4 |
| Cross-name relationship graph | M5 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | Freshness storage and retrieval |
| Scheduler | `apps/scheduler/` | Freshness recompute cycle |
| Mobile | `apps/mobile/android/` | Names freshness display |
| Contracts | `packages/contracts/` | Freshness payload types |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Monitor snapshot freshness fields | Additive | `packages/contracts/src/` |
| Freshness notification payload | Additive | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M2 Change | Why Here |
|---|---|---|---|
| Monitor snapshots | Phase 3 M2 | Extend with freshness state | Preserve monitoring continuity |
| Alert ledger | Phase 4 M2 | Persist decay notifications | Preserve alert auditability |
| Names board ownership | Phase 4 M3 | Render freshness at name level | Keep ownership clear |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M2 - Thesis Freshness and Decay

Naming:
```text
[PH5-M2] What is being built
[PH5-M2][BUG] What is broken
[PH5-M2][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Freshness recomputed | INFO | `{ service, ticker, freshness_state, freshness_score, timestamp }` |
| Freshness alert emitted | INFO | `{ service, ticker, alert_id, unreviewed_events_count, timestamp }` |

---

## 10. Testing Requirements

- [ ] Product API and scheduler typecheck passes
- [ ] Freshness transition unit tests pass
- [ ] Integration tests cover decay alerts
- [ ] Mobile compile passes with freshness rendering
- [ ] Regressions for existing monitor paths pass

Detailed execution lives in `M2_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M2 acceptance criteria in `ph5_MILESTONES.md` are satisfied
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
| Freshness state set | `current`, `aging`, `stale`, `triggered` | No |
| Freshness signal blend | age + unreviewed events + rule proximity | No |
