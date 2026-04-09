# AGENTS.md - Phase 5 M6 Conviction Intelligence
**Milestone:** Phase 5 M6 - Conviction Intelligence  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M6/M6_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M6 - Conviction Intelligence |
| **Linear Project** | Phase 5 M6 - Conviction Intelligence |
| **Owner** | Product API Engineer + Dexter Engineer + Mobile Engineer |
| **Status** | Planned |
| **Depends on** | M1-M5 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Conviction journal captures key event moments automatically | RESOLVED | Product Lead | Milestone start |
| G2 | Coherence checks run as periodic insight cards, not noisy alerts | RESOLVED | Product Lead | Milestone start |
| G3 | Opposite-case output remains linked to original report context | RESOLVED | Product Lead + Dexter Engineer | Milestone start |
| G4 | Coherence explanations must be evidence-backed and explainable | RESOLVED | Product API Engineer | Milestone start |
| G5 | Conviction surfaces keep the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M6 turns historical behavior into decision-quality intelligence using journals, coherence insights, and opposite-case reasoning.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M5/M5_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [ ] Decision journal persistence and APIs
- [ ] Coherence analyzer outputs
- [ ] Opposite-case prompt and response linkage
- [ ] Monthly insight card output path
- [ ] Mobile conviction/timeline presentation

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Scenario stress execution | M7 |
| Portfolio weighting from brokerage positions | Deferred beyond Phase 5 |
| Community/shared conviction features | Deferred beyond Phase 5 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | Journal storage, coherence APIs |
| Dexter Worker | `apps/dexter-worker/` | Opposite-case and coherence prompts |
| Mobile | `apps/mobile/android/` | Conviction timeline and coherence cards |
| Contracts | `packages/contracts/` | Journal/coherence payloads |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Conviction journal entry | New | `packages/contracts/src/` |
| Coherence insight card | New | `packages/contracts/src/` |
| Opposite-case response linkage | Additive | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M6 Change | Why Here |
|---|---|---|---|
| Report history | Phase 1-3 | Build conviction timelines from report sequence | Reuse existing truth |
| Alert ledger | Phase 4 M2 | Journal key alert interactions | Preserve auditable event chain |
| Research workbench | Phase 4 M3 | Keep opposite-case attached to report context | Avoid context fragmentation |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M6 - Conviction Intelligence

Naming:
```text
[PH5-M6] What is being built
[PH5-M6][BUG] What is broken
[PH5-M6][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Journal entry created | INFO | `{ service, user_id_hash, ticker, event_type, journal_id, timestamp }` |
| Coherence card generated | INFO | `{ service, user_id_hash, overlap_count, contradiction_count, timestamp }` |
| Opposite-case generated | INFO | `{ service, report_id, opposite_case_id, prompt_version, timestamp }` |

---

## 10. Testing Requirements

- [ ] Product API and contracts typecheck passes
- [ ] Journal write/read integration tests pass
- [ ] Coherence output tests pass with deterministic fixtures
- [ ] Opposite-case prompt regression fixtures pass
- [ ] Mobile compile and rendering checks pass

Detailed execution lives in `M6_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M6 acceptance criteria in `ph5_MILESTONES.md` are satisfied
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
| Journal capture policy | Auto-capture at key event moments | No |
| Coherence cadence | Monthly insight card cadence | No |
