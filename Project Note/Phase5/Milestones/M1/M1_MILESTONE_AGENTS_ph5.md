# AGENTS.md - Phase 5 M1 Kill-Switch Engine
**Milestone:** Phase 5 M1 - Kill-Switch Engine  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M1 - Kill-Switch Engine |
| **Linear Project** | Phase 5 M1 - Kill-Switch Engine |
| **Owner** | Product API Engineer + Scheduler Engineer + Dexter Engineer |
| **Status** | Closed (one explicit TBD) |
| **Depends on** | Phase 4 delivered and stable |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Rule extraction format fixed to 3-5 falsifiable conditions | RESOLVED | Product Lead + Dexter Engineer | Milestone start |
| G2 | Rule persistence remains Product API-owned | RESOLVED | Product API Engineer | Milestone start |
| G3 | Rule evaluation cadence is daily pre-market plus event-triggered | RESOLVED | Scheduler Engineer | Milestone start |
| G4 | Existing contrarian alert path remains backward-compatible | RESOLVED | Product API Engineer | Milestone start |
| G5 | Any user-facing changes keep the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M1 establishes durable thesis break-condition monitoring from Deep Dive output through alert delivery.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_BLUEBOOK.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Decisions/ADR-008-phase5-active-intelligence-engine.md`

---

## 3. Scope - What Is In

- [x] Kill-switch contracts under `packages/contracts`
- [x] Rule persistence models and migration wiring
- [x] Dexter rule-extractor prompt and trace metadata
- [x] Scheduler evaluator jobs and idempotent handling
- [x] Alert-ledger integration for rule matches
- [x] Backward-compatible contrarian behavior

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Freshness scoring | M2 |
| Morning exception briefing | M3 |
| Cross-name relationship propagation | M5 |
| Conviction and scenario systems | M6-M7 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Contracts | `packages/contracts/` | Rule/evaluation payload types |
| Product API | `apps/product-api/` | Rule storage + alert generation surfaces |
| Scheduler | `apps/scheduler/` | Evaluation orchestration |
| Dexter Worker | `apps/dexter-worker/` | Condition extraction prompt |
| Infra | `infra/migrations/` | Rule tables and indices |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Kill-switch rule item | New | `packages/contracts/src/` |
| Rule evaluation result | New | `packages/contracts/src/` |
| Rule-match alert context | Additive | `packages/contracts/src/alert-ledger.ts` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M1 Change | Why Here |
|---|---|---|---|
| Alert ledger durability | Phase 4 M2 | Add kill-switch reasoned records | Preserve auditable alerts |
| Deep-link route safety | Phase 4 M4 | Ensure new alert destinations remain route-safe | No dead-end routing |
| Contrarian alerts | Phase 2 M5 | Keep compatible behavior while expanding rule model | Avoid regression |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M1 - Kill-Switch Engine

Naming:
```text
[PH5-M1] What is being built
[PH5-M1][BUG] What is broken
[PH5-M1][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Rule extracted | INFO | `{ service, report_id, ticker, rule_count, prompt_version, timestamp }` |
| Rule evaluated | INFO | `{ service, rule_id, outcome, signal_source, timestamp }` |
| Rule matched | INFO | `{ service, rule_id, alert_id, ticker, timestamp }` |

---

## 10. Testing Requirements

- [x] Product API typecheck passes
- [x] Scheduler tests pass for evaluator flow
- [x] Dexter extraction fixture tests pass
- [x] Product API integration tests cover rule storage/evaluation/alerts
- [x] Legacy contrarian regression tests pass

Detailed execution lives in `M1_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M1 acceptance criteria in `ph5_MILESTONES.md` are satisfied except one explicit TBD
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets explicitly deferred per milestone instruction
- [x] Product Lead sign-off recorded (owner instruction in active thread, 2026-04-09)
- [x] Engineering Lead countersign waived for test GitHub checkpoint

---

## 12. Smoke Test Log

```text
Date: 2026-04-08
Run by: Codex + sub-agent discovery lanes
Environment: Local dev (memory-store test harness, stub push, deterministic mocks)
Result: PASS (all M1 smoke steps satisfied; sign-off pending)
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| LangSmith prompt push not executed in this environment | `LANGSMITH_API_KEY` unavailable locally, so `langsmith:push-prompts` cannot run | TBD | M1 closeout checklist |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Rule count per thesis | 3-5 falsifiable conditions | No |
| Service topology | No new services introduced | Covered by ADR-008 |
| Kill-switch notification family | Added as `kill_switch` (separate from `contrarian_alert`) | No |
| Daily evaluator cadence | Scheduled from existing pre-market monitor/earnings-prep scheduler path | No |
