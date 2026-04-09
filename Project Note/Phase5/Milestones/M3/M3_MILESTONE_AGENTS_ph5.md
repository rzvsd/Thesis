# AGENTS.md - Phase 5 M3 Morning Exception Briefing
**Milestone:** Phase 5 M3 - Morning Exception Briefing  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M3/M3_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M3 - Morning Exception Briefing |
| **Linear Project** | Phase 5 M3 - Morning Exception Briefing |
| **Owner** | Scheduler Engineer + Product API Engineer + Mobile Engineer |
| **Status** | Planned |
| **Depends on** | M1 and M2 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Morning briefing must be personalized per user watchlist | RESOLVED | Product Lead | Milestone start |
| G2 | Explicit no-change output is required behavior | RESOLVED | Product Lead | Milestone start |
| G3 | Briefing must be ledger-auditable | RESOLVED | Product API Engineer | Milestone start |
| G4 | Briefing must preserve route safety to app surfaces | RESOLVED | Mobile Engineer | Milestone start |
| G5 | Briefing UI keeps the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

---

## 1. What This Milestone Is Building

M3 upgrades the morning experience to a personalized exception briefing that is useful whether changes occurred or not.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M2/M2_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [ ] Personalized briefing contract and API surface
- [ ] Relevance matching to followed names and rule/freshness context
- [ ] Morning scheduler cycle for per-user briefing output
- [ ] Explicit no-change briefing output path
- [ ] Today and Inbox rendering integration

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Earnings event war-room orchestration | M4 |
| Relationship propagation | M5 |
| Conviction intelligence and scenarios | M6-M7 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Scheduler | `apps/scheduler/` | Morning briefing cycle |
| Product API | `apps/product-api/` | Briefing composition and persistence |
| Mobile | `apps/mobile/android/` | Today and Inbox briefing rendering |
| Contracts | `packages/contracts/` | Briefing payload types |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Morning exception briefing payload | New | `packages/contracts/src/` |
| No-change briefing variant | New | `packages/contracts/src/` |

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M3 Change | Why Here |
|---|---|---|---|
| Market pulse baseline | Phase 1-4 | Personalize with thesis relevance | Increase daily relevance |
| Alert ledger | Phase 4 M2 | Store morning briefing output | Preserve auditability |
| Today/Inbox ownership | Phase 4 M3 | Keep clear ownership while adding briefing mode | Avoid IA drift |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M3 - Morning Exception Briefing

Naming:
```text
[PH5-M3] What is being built
[PH5-M3][BUG] What is broken
[PH5-M3][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Briefing generated | INFO | `{ service, user_id_hash, exceptions_count, timestamp }` |
| No-change briefing emitted | INFO | `{ service, user_id_hash, timestamp }` |
| Briefing delivered | INFO | `{ service, alert_id, destination, timestamp }` |

---

## 10. Testing Requirements

- [ ] Product API and scheduler typecheck passes
- [ ] Briefing composition tests pass for no-change and exception cases
- [ ] Alert-ledger persistence integration tests pass
- [ ] Mobile compile and rendering checks pass
- [ ] Morning cycle dedupe and throttling checks pass

Detailed execution lives in `M3_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [ ] All M3 acceptance criteria in `ph5_MILESTONES.md` are satisfied
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
| No-change output | Mandatory daily output mode | No |
| Delivery channel | Existing alert ledger and push paths | No |
