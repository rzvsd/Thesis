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
| **Owner** | Dexter Engineer + Scheduler Engineer + Product API Engineer + Mobile Engineer for existing-surface copy/context only |
| **Status** | Closed (PASS) on 2026-04-10; LangSmith prompt registration proof completed on 2026-04-16 |
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
| G6 | Cross-name intelligence is Pro-only; Free users must not receive propagated alerts | RESOLVED | Product Lead | Milestone start |
| G7 | Macro is an event/signal category, not a relationship type; relationship taxonomy remains supplier/competitor/partner/sector | RESOLVED | Product Lead + Product API Engineer | Milestone start |
| G8 | Relationship storage shape is durable and queryable before evaluator implementation | RESOLVED | Product API Engineer | Milestone start |
| G9 | Public/internal interface names are locked before code changes | RESOLVED | Product API Engineer + Scheduler Engineer | Milestone start |
| G10 | No new mobile top-level screen; M5 uses existing Names and Inbox surfaces only | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

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

- [x] Relationship graph contracts and persistence
- [x] Dexter relationship extraction from report content via `AnalysisReport.name_relationships` ingestion
- [x] Propagation evaluator in scheduler
- [x] Propagated alert ledger and push integration
- [x] Confidence-threshold controls and suppressions (`0.70` default with stricter overrides)
- [x] Pro-only entitlement gating for propagated alerts
- [x] Existing Names/Inbox support through alert-ledger route/context and relationship query; no mobile rendering change was needed

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
| Mobile | `apps/mobile/android/` | Existing Names/Inbox context rendering only if needed; no new M5 screen |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Name relationship record | New | `packages/contracts/src/` |
| Propagated exception payload | New | `packages/contracts/src/` |

Locked relationship storage shape:

- `name_relationships` header: `relationship_id`, `user_id`, `source_ticker`, `target_ticker`, `relationship_type`, `confidence`, `state`, `source_report_id`, `prompt_version`, `evidence_text`, `rationale`, `created_at`, `updated_at`, optional `suppressed_at`
- Relationship type enum: `supplier`, `competitor`, `partner`, `sector`
- Relationship state enum: `active`, `suppressed`, `inactive`
- Confidence is stored as `0..1`; alert emission default threshold is `>= 0.70`
- Edges below threshold remain queryable and auditable but do not emit propagated alerts by default
- Macro signals may propagate through qualifying `sector` edges, but `macro` is not a relationship type

Locked M5 interface names:

- Contract file: `packages/contracts/src/name-relationship.ts`
- Internal ingestion endpoint: `POST /internal/name-relationships/ingest`
- Internal propagation endpoint: `POST /internal/notifications/cross-name/evaluate`
- User query endpoint: `GET /v1/names/relationships`
- Alert notification type: `cross_name_propagation`
- Alert category: `macro` only for macro-origin events; otherwise `thesis_drift`
- Alert route: `names` for affected-name context and `inbox` for alert history

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

- [x] Contracts and Product API typecheck passes
- [x] Relationship extraction fixture tests pass
- [x] Propagation evaluator tests pass
- [x] Integration tests cover `0.70` default threshold and stricter override behavior
- [x] Pro entitlement tests pass (Pro receives propagated alerts; Free does not)
- [x] Regression tests for non-propagated unrelated names pass
- [x] Existing Names/Inbox UI remains visually consistent by non-change; mobile was not touched in M5 implementation

Detailed execution lives in `M5_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M5 acceptance criteria in `ph5_MILESTONES.md` are satisfied locally
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets skipped/deferred per owner instruction for this workstream
- [x] Product Lead sign-off recorded by owner closeout instruction on 2026-04-10
- [x] Engineering Lead countersign recorded by owner closeout instruction on 2026-04-10

---

## 12. Smoke Test Log

```text
Date: 2026-04-09
Run by: Codex
Environment: local memory backends, stub push provider, Product API + Scheduler test lanes
Result: PASS for local contracts, Dexter Worker, Product API, and Scheduler smoke

Executed:
- corepack pnpm --filter @thesis/contracts typecheck
- corepack pnpm --filter @thesis/dexter-worker typecheck
- corepack pnpm --filter @thesis/dexter-worker test
- corepack pnpm --filter @thesis/product-api typecheck
- corepack pnpm --filter @thesis/scheduler typecheck
- corepack pnpm --filter @thesis/product-api test
- corepack pnpm --filter @thesis/scheduler test
- git diff --check

Evidence:
- Project Note/Phase5/Milestones/M5/evidence/2026-04-09_m5_execution_log.md
- apps/dexter-worker/tests/pipeline.test.ts
- apps/product-api/tests/ph5-m5-cross-name.test.ts

Note:
- `git diff --check` passed with Windows LF-to-CRLF warnings only.
- LangSmith prompt registration was executed on 2026-04-16 via `corepack pnpm --dir apps/dexter-worker run langsmith:push-prompts`.
- Evidence: `Project Note/Phase5/Milestones/M5/evidence/2026-04-16_langsmith_prompt_push.json`.
- Mobile was not touched; no device or Maestro proof is required for this M5 slice.
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| None open | LangSmith relationship prompt registration proof completed on 2026-04-16 | N/A | N/A |
| Device proof | Mobile was not touched; Names/Inbox behavior is server-ledger context only in this slice | Not required | None |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Relationship taxonomy | supplier/competitor/partner/sector | No |
| Confidence gating | `0.70` default required before propagation alert emission; stricter overrides allowed | No |
| Entitlement | Cross-name propagation alerts are Pro-only | No |
| Macro handling | Macro is a signal/event category that may travel through sector edges, not a relationship type | No |
| Mobile scope | Reuse Names and Inbox; no new M5 top-level screen | No |
