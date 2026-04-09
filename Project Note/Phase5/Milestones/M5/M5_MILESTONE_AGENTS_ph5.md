# AGENTS.md - Phase 5 M5 Cross-Name Intelligence
**Milestone:** Phase 5 M5 - Cross-Name Intelligence  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M5/M5_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M5 - Cross-Name Intelligence |
| **Linear Project** | Phase 5 M5 - Cross-Name Intelligence |
| **Owner** | Dexter Engineer + Scheduler Engineer + Product API Engineer |
| **Status** | Planned |
| **Depends on** | M1-M4 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Relationship types include supplier, competitor, partner, sector | RESOLVED | Product Lead | Milestone start |
| G2 | Relationship confidence thresholding is required with default propagation threshold `0.70` | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G3 | Propagated alerts require explanation chain | RESOLVED | Product Lead | Milestone start |
| G4 | Relationship provenance must be persisted | RESOLVED | Dexter Engineer | Milestone start |
| G5 | Propagation UI outputs keep the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M5 adds second-order portfolio intelligence by propagating material events through a relationship graph.

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

- [ ] Relationship graph contracts and persistence
- [ ] Dexter relationship extraction from report content
- [ ] Propagation evaluator in scheduler
- [ ] Propagated alert ledger and push integration
- [ ] Confidence-threshold controls and suppressions (`0.70` default with stricter overrides)

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Decision journal and coherence analysis | M6 |
| Scenario stress cards | M7 |
| Holdings-sync based weighting | Deferred beyond Phase 5 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Dexter Worker | `apps/dexter-worker/` | Relationship extraction prompt |
| Product API | `apps/product-api/` | Relationship graph persistence + query |
| Scheduler | `apps/scheduler/` | Propagation evaluator jobs |
| Contracts | `packages/contracts/` | Relationship + propagation payloads |
| Infra | `infra/migrations/` | Relationship tables and indices |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Name relationship record | New | `packages/contracts/src/` |
| Propagated exception payload | New | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M5 Change | Why Here |
|---|---|---|---|
| Alert ledger | Phase 4 M2 | Add propagated exception records | Preserve alert auditability |
| Kill-switch semantics | Phase 5 M1 | Reuse for propagated risk mapping | Consistent exception language |
| Names/Inbox ownership | Phase 4 M3 | Keep propagation outputs in clear surfaces | Avoid ownership drift |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M5 - Cross-Name Intelligence

Naming:
```text
[PH5-M5] What is being built
[PH5-M5][BUG] What is broken
[PH5-M5][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Relationship extracted | INFO | `{ service, source_ticker, target_ticker, relationship_type, confidence, report_id, timestamp }` |
| Propagation evaluated | INFO | `{ service, source_event_id, candidate_count, emitted_count, timestamp }` |
| Propagated alert emitted | INFO | `{ service, alert_id, source_ticker, affected_ticker, relationship_type, timestamp }` |

---

## 10. Testing Requirements

- [ ] Contracts and Product API typecheck passes
- [ ] Relationship extraction fixture tests pass
- [ ] Propagation evaluator tests pass
- [ ] Integration tests cover `0.70` default threshold and stricter override behavior
- [ ] Regression tests for non-propagated unrelated names pass

Detailed execution lives in `M5_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M5 acceptance criteria in `ph5_MILESTONES.md` are satisfied
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
| Relationship taxonomy | supplier/competitor/partner/sector | No |
| Confidence gating | `0.70` default required before propagation alert emission; stricter overrides allowed | No |
