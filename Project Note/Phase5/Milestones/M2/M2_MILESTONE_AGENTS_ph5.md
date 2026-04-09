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
| **Status** | Closed |
| **Depends on** | M1 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Freshness states fixed: `current`, `aging`, `stale`, `triggered` | RESOLVED | Product Lead | Milestone start |
| G2 | Freshness formula includes age, unreviewed events, and recent matched kill-switch evaluations | RESOLVED | Product Lead + Product API Engineer | Milestone start |
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
- `Decisions/ADR-008-phase5-active-intelligence-engine.md`

---

## 3. Scope - What Is In

- [x] Freshness fields in monitor snapshots and contracts
- [x] Daily recompute with deterministic state transitions
- [x] Material event counting and unreviewed-event tracking
- [x] Freshness-decay notifications and alert-ledger entries
- [x] Names UI freshness rendering

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
| Infra | `infra/migrations/` | Freshness schema and constraint updates |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Monitor snapshot freshness fields | Additive | `packages/contracts/src/thesis-monitor-snapshot.ts` |
| Alert-ledger freshness context fields | Additive | `packages/contracts/src/alert-ledger.ts` |
| Notification preference family | Additive | `packages/contracts/src/notification-preference.ts` |

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

- [x] Product API and scheduler typecheck passes
- [x] Freshness transition integration tests pass
- [x] Integration tests cover decay alerts
- [x] Mobile compile passes with freshness rendering
- [x] Regressions for existing monitor paths pass

Detailed execution lives in `M2_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M2 acceptance criteria in `ph5_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets closed or explicitly deferred
- [x] Product Lead sign-off recorded
- [x] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: 2026-04-09
Run by: Codex + swarm reviewers (backend/mobile/docs)
Environment: Local dev (memory-backed Product API tests + Android compileDebugKotlin)
Result: PASS (see evidence/2026-04-09_m2_smoke.md)
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Linear ticket updates skipped | Owner instruction for this run was to keep Linear untouched and close via milestone docs/evidence | N/A | N/A |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Freshness state set | `current`, `aging`, `stale`, `triggered` | No |
| Freshness signal blend | age + unreviewed events + recent matched kill-switch evaluations | No |
| Material-event doctrine in M2 v1 | `earnings calendar events + matched kill-switch evaluations` since last Deep Dive | No |
| Unreviewed count in M2 v1 | `unreviewed_events_count` mirrors M2 material-event count (per-event acknowledgment deferred) | No |
| Freshness alert anti-spam rule | Repeat alerts are suppressed unless same-ticker risk worsens or 72h cooldown elapses | No |
| Freshness routing | `freshness_decay` notifications and ledger items route to `names` | No |
| Milestone close authority | Owner approved docs closeout and GitHub push in-session on 2026-04-09 | No |
