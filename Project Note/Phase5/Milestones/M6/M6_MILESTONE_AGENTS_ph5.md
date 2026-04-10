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
| **Owner** | Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer |
| **Status** | Closed (PASS) on 2026-04-10; LangSmith remote prompt registration remains TBD |
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
| G6 | Conviction system is Pro-only; existing Free report notes/feedback remain unchanged | RESOLVED | Product Lead | Milestone start |
| G7 | No new top-level mobile screen; Research owns report-level conviction and You owns monthly profile/coherence | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G8 | Journal storage shape is durable and deduped before event-write implementation | RESOLVED | Product API Engineer | Milestone start |
| G9 | Coherence card storage shape is durable and auditable before scheduler implementation | RESOLVED | Product API Engineer + Scheduler Engineer | Milestone start |
| G10 | Opposite-case storage is linked to original report and prompt version | RESOLVED | Dexter Engineer + Product API Engineer | Milestone start |
| G11 | Public/internal interface names are locked before code changes | RESOLVED | Product API Engineer | Milestone start |
| G12 | LangSmith remote prompt registration may remain TBD if credentials are unavailable; local manifest, sync hook, and regression fixtures are mandatory | RESOLVED | Dexter Engineer | Milestone closeout |

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

- [x] Decision journal persistence and APIs
- [x] Coherence analyzer outputs
- [x] Opposite-case prompt and response linkage
- [x] Monthly insight card output path
- [x] Scheduler monthly coherence evaluation
- [x] Mobile conviction/timeline presentation in existing Research/You surfaces

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
| Scheduler | `apps/scheduler/` | Monthly coherence evaluation trigger |
| Dexter Worker | `apps/dexter-worker/` | Opposite-case and coherence prompts |
| Mobile | `apps/mobile/android/` | Conviction timeline and coherence cards |
| Contracts | `packages/contracts/` | Journal/coherence payloads |
| Infra | `infra/migrations/` | Journal, insight, and opposite-case tables |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| Conviction journal entry | New | `packages/contracts/src/conviction-intelligence.ts` |
| Coherence insight card | New | `packages/contracts/src/conviction-intelligence.ts` |
| Opposite-case response linkage | New | `packages/contracts/src/conviction-intelligence.ts` |

Locked M6 storage shape:

- Journal table: `conviction_journal_entries`
- Journal required fields: `journal_entry_id`, `user_id`, `ticker`, `event_type`, `source_type`, `source_id`, `event_at`, `title`, `summary`, `thesis_snapshot`, `evidence_refs`, `created_at`, `updated_at`
- Journal optional linkage fields: `report_id`, `alert_ledger_id`, `war_room_id`, `monitor_snapshot_key`, `opposite_case_id`
- Journal event types: `deep_dive_generated`, `kill_switch_alert_fired`, `freshness_decay_alert_fired`, `earnings_war_room_closed`, `cross_name_alert_fired`, `alert_feedback_recorded`, `opposite_case_generated`
- Journal source types: `report`, `alert_ledger`, `war_room`, `monitor_snapshot`, `opposite_case`
- Journal dedupe key: `user_id + event_type + source_type + source_id`
- Insight table: `conviction_insight_cards`
- Insight required fields: `insight_id`, `user_id`, `period_start`, `period_end`, `insight_type`, `status`, `title`, `summary`, `findings`, `source_journal_entry_ids`, `generated_at`, `created_at`, `updated_at`
- Insight type enum: `monthly_coherence`
- Insight finding type enum: `overlap`, `contradiction`, `mismatch`
- Insight status enum: `generated`, `degraded`, `failed`
- Opposite-case table: `opposite_case_reports`
- Opposite-case required fields: `opposite_case_id`, `user_id`, `source_report_id`, `ticker`, `prompt_version`, `thesis_summary`, `opposite_case_summary`, `key_points`, `shared_evidence_refs`, `decisive_factors`, `generated_at`, `created_at`
- Evidence reference shape: `{ kind, ref_id, label?, ticker?, captured_at? }`, where `kind` is one of `report`, `journal_entry`, `alert_ledger`, `war_room`, `monitor_snapshot`, `name_relationship`, `evidence_item`

Locked M6 interface names:

- Contract file: `packages/contracts/src/conviction-intelligence.ts`
- Timeline endpoint: `GET /v1/conviction/timeline?ticker=&limit=`
- Insight endpoint: `GET /v1/conviction/insights?limit=`
- Opposite-case create endpoint: `POST /v1/reports/{report_id}/opposite-case`
- Opposite-case read endpoint: `GET /v1/reports/{report_id}/opposite-case`
- Internal coherence evaluator endpoint: `POST /internal/conviction/coherence/evaluate`
- Monthly coherence idempotency key: `user_id + period_start + period_end + monthly_coherence`
- Monthly coherence period: previous calendar month
- Monthly coherence scheduler trigger: first scheduler cycle on or after the first calendar day of the month, `America/New_York`
- Manual smoke trigger: internal coherence endpoint accepts explicit `period_start` and `period_end`
- Opposite-case prompt identifier: `thesis-m6-opposite-case`
- Coherence analyzer prompt identifier: `thesis-m6-coherence-analyzer`

Locked M6 mobile ownership:

- Research owns opposite-case generation, opposite-case reading, and per-report conviction timeline entry points.
- You owns monthly coherence/profile cards and conviction-learning controls.
- No new top-level tab is introduced in M6.
- Push is not introduced in M6; monthly coherence is a stored card, not a noisy alert.
- All updated user surfaces must preserve the same Thesis colors, typography, tone, and component style.

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M6 Change | Why Here |
|---|---|---|---|
| Report history | Phase 1-3 | Build conviction timelines from report sequence | Reuse existing truth |
| Alert ledger | Phase 4 M2 | Journal key alert interactions | Preserve auditable event chain |
| Research workbench | Phase 4 M3 | Keep opposite-case attached to report context | Avoid context fragmentation |
| Freshness state | Phase 5 M2 | Journal freshness decay alerts and review-needed moments | Preserve stale-conviction history |
| War Room | Phase 5 M4 | Journal post-event closure and thesis delta moments | Preserve event-window learning |
| Cross-name intelligence | Phase 5 M5 | Journal propagated exception moments | Preserve second-order learning |

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
| Journal entry created | INFO | `{ service, user_id_hash, ticker, event_type, journal_entry_id, source_type, source_id, timestamp }` |
| Coherence card generated | INFO | `{ service, user_id_hash, insight_id, period_start, period_end, overlap_count, contradiction_count, mismatch_count, timestamp }` |
| Opposite-case generated | INFO | `{ service, report_id, opposite_case_id, prompt_version, timestamp }` |

---

## 10. Testing Requirements

- [x] Product API and contracts typecheck passes
- [x] Journal write/read integration tests pass
- [x] Coherence output tests pass with deterministic fixtures
- [x] Opposite-case prompt regression fixtures pass
- [x] Scheduler idempotency test for monthly coherence trigger passes
- [x] Mobile compile and rendering checks pass

Detailed execution lives in `M6_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M6 acceptance criteria in `ph5_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets explicitly skipped/deferred per owner instruction for this local closeout
- [x] Product Lead sign-off recorded via owner instruction to proceed on 2026-04-10
- [x] Engineering Lead countersign not required for this local-only closeout; no GitHub push performed in this step

---

## 12. Smoke Test Log

```text
Date: 2026-04-10
Run by: Codex
Environment: local + Android physical device (serial: R3CXA03J3LH)
Result: PASS - backend/contracts/scheduler/dexter checks passed; Android compile/unit + core device smoke passed; seeded physical-device Maestro run confirmed report-level Conviction Intelligence, Conviction Timeline, and Opposite Case rendering in Research.
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| LangSmith prompt registration proof | If `LANGSMITH_API_KEY` is unavailable in the implementation environment, remote prompt registration cannot be proven; local manifest, sync hook, and prompt fixtures are still required | Not required per owner instruction unless Linear resumes | M6 closeout or TBD follow-up |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Journal capture policy | Auto-capture at key event moments | No |
| Coherence cadence | Monthly insight card cadence | No |
| Entitlement | Conviction system outputs are Pro-only; existing Free report notes and feedback remain unchanged | No |
| Mobile scope | Reuse Research and You; no new top-level screen | No |
| Prompt registration | Local prompt fixtures are required; remote LangSmith registration may be carried as TBD without credentials | No |
