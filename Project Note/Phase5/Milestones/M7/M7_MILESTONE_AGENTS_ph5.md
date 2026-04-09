# AGENTS.md - Phase 5 M7 Scenario Stress Cards
**Milestone:** Phase 5 M7 - Scenario Stress Cards  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M7/M7_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M7 - Scenario Stress Cards |
| **Linear Project** | Phase 5 M7 - Scenario Stress Cards |
| **Owner** | Product API Engineer + Dexter Engineer + Mobile Engineer |
| **Status** | Planned |
| **Depends on** | M1-M6 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Scenario set includes predefined macro templates | RESOLVED | Product Lead | Milestone start |
| G2 | Scenario outputs must include explainable per-name reasoning | RESOLVED | Product Lead + Dexter Engineer | Milestone start |
| G3 | Stress cards suggest kill-switch additions, not automatic writes | RESOLVED | Product Lead | Milestone start |
| G4 | Scenario execution remains within existing service topology | RESOLVED | Engineering Lead | Milestone start |
| G5 | Scenario card UX keeps the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M7 adds one-tap proactive portfolio scenario intelligence for quiet and volatile periods alike.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M6/M6_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [ ] Scenario template contracts and storage
- [ ] Batch scenario evaluator
- [ ] Stress card output APIs
- [ ] Suggested kill-switch rule additions (review-only)
- [ ] Mobile scenario run and result surfaces

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Brokerage position ingestion | Deferred beyond Phase 5 |
| Real-time streaming scenario recompute | Deferred beyond Phase 5 |
| Automated rule creation without user review | Not approved in this milestone |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | Scenario template + execution endpoints |
| Dexter Worker | `apps/dexter-worker/` | Scenario reasoning prompt |
| Mobile | `apps/mobile/android/` | Scenario cards UI and navigation |
| Contracts | `packages/contracts/` | Scenario payload types |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Scenario template definition | New | `packages/contracts/src/` |
| Scenario stress card response | New | `packages/contracts/src/` |
| Suggested kill-switch additions | New | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M7 Change | Why Here |
|---|---|---|---|
| Kill-switch rules | Phase 5 M1 | Suggestions map back to existing rule system | Keep one rule truth |
| Conviction coherence context | Phase 5 M6 | Reuse coherence context for scenario explainability | Improve actionability |
| Phase 4 IA ownership | Phase 4 M3 | Keep scenario surfaces in Research/Today with clear ownership | Avoid screen sprawl |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M7 - Scenario Stress Cards

Naming:
```text
[PH5-M7] What is being built
[PH5-M7][BUG] What is broken
[PH5-M7][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Scenario run started | INFO | `{ service, user_id_hash, scenario_id, timestamp }` |
| Scenario run completed | INFO | `{ service, user_id_hash, scenario_id, impacted_names_count, timestamp }` |
| Scenario suggestions generated | INFO | `{ service, scenario_id, suggestion_count, timestamp }` |

---

## 10. Testing Requirements

- [ ] Product API and contracts typecheck passes
- [ ] Scenario evaluator deterministic tests pass
- [ ] Suggested-rule output tests pass
- [ ] Mobile compile and scenario flow checks pass
- [ ] Regression tests for existing Research flows pass

Detailed execution lives in `M7_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M7 acceptance criteria in `ph5_MILESTONES.md` are satisfied
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
| Template-first strategy | Predefined macro scenarios ship first | No |
| Suggested rules policy | Suggestions are review-only in M7 | No |
