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
| **Status** | Closed (PASS; ADB device smoke complete) |
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
| G6 | M7 v1 executes user-triggered runs only; optional scheduled runs are deferred beyond Phase 5 | RESOLVED | Product Lead + Engineering Lead | Milestone start |
| G7 | Stress cards are Pro-only in M7; Free users cannot run or view scenario stress outputs | RESOLVED | Product Lead | Milestone start |
| G8 | M7 route/deep-link contract is lockable before mobile implementation | RESOLVED | Product API Engineer + Mobile Engineer | Milestone start |

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

- [x] Scenario template contracts and storage
- [x] Batch scenario evaluator
- [x] Stress card output APIs
- [x] Suggested kill-switch rule additions (review-only)
- [x] Mobile scenario run and result surfaces
- [x] Pro/Free stress-card entitlement enforcement
- [x] Scenario route/deep-link handling for result restoration

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Brokerage position ingestion | Deferred beyond Phase 5 |
| Real-time streaming scenario recompute | Deferred beyond Phase 5 |
| Automated rule creation without user review | Not approved in this milestone |
| Optional scheduled scenario runs | Deferred beyond Phase 5 M7 v1 |

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
| Scenario template definition | New | `packages/contracts/src/scenario-stress.ts` |
| Scenario stress run request/response | New | `packages/contracts/src/scenario-stress.ts` |
| Suggested kill-switch additions | New | `packages/contracts/src/scenario-stress.ts` |

Locked M7 storage and interface names:

- Contract file: `packages/contracts/src/scenario-stress.ts`
- Template table: `scenario_stress_templates`
- Run table: `scenario_stress_runs`
- Per-name impact table: `scenario_stress_impacts`
- Rule suggestion table: `scenario_stress_rule_suggestions`
- Template list endpoint: `GET /v1/scenarios/templates`
- Scenario run endpoint: `POST /v1/scenarios/runs`
- Scenario run read endpoint: `GET /v1/scenarios/runs/{scenario_run_id}`
- Scenario route tuple (M7 lock): `open_tab=research`, `scenario_id`, `scenario_run_id`
- Optional route keys: `ticker`, `rule_id`
- Scenario execution mode in M7 v1: user-triggered only
- Scenario entitlement in M7: Pro-only (Free is blocked from run/read endpoints)

Locked M7 template set (v1):

- `rates_higher_for_longer`
- `recession_in_6m`
- `usd_up_10`
- `ai_hype_burst`
- `oil_120_spike`

Locked M7 deterministic envelope:

- For the same `scenario_id`, `scenario_template_version`, `as_of_date`, and user thesis snapshot, the following must be stable across repeated runs:
- impacted ticker set (exact match)
- per-ticker `impact_level` and `thesis_break_likelihood` (exact enum match)
- suggested rule set by `ticker + signal_type + direction` (exact match)
- numeric score fields may vary only within `+/-0.02`

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M7 Change | Why Here |
|---|---|---|---|
| Kill-switch rules | Phase 5 M1 | Suggestions map back to existing rule system | Keep one rule truth |
| Conviction coherence context | Phase 5 M6 | Reuse coherence context for scenario explainability | Improve actionability |
| Phase 4 IA ownership | Phase 4 M3 | Keep scenario surfaces in Research/Today with clear ownership; no new top-level tab | Avoid screen sprawl |

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

- [x] Product API and contracts typecheck passes
- [x] Scenario evaluator deterministic tests pass
- [x] Suggested-rule output tests pass
- [x] Pro/Free scenario entitlement tests pass
- [x] Mobile compile and scenario flow checks pass
- [x] M7 proves no scheduler-owned scenario run path in v1
- [x] Mobile scenario surfaces prove Thesis visual-language continuity
- [x] Regression tests for existing Research flows pass

Detailed execution lives in `M7_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M7 acceptance criteria in `ph5_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets explicitly deferred per workspace rule
- [x] Product Lead sign-off recorded (owner closeout instruction in active thread, 2026-04-11)
- [x] Engineering Lead countersign recorded (owner-approved M7 close request in active thread, 2026-04-11)

---

## 12. Smoke Test Log

```text
Date: 2026-04-11
Run by: Codex (main rollout)
Environment: Local product-api + contracts + full workspace typecheck; Android Gradle + connected ADB device `R3CXA03J3LH`
Result: PASS (backend, mobile compile, and connected-device smoke complete)

Executed:
- corepack pnpm --filter @thesis/contracts typecheck
- corepack pnpm --filter @thesis/product-api typecheck
- corepack pnpm --filter @thesis/product-api test
- corepack pnpm typecheck
- gradlew :app:testDebugUnitTest
- gradlew :app:installDebug
- ADB cold-start launch with `open_tab=research`, `scenario_id=rates_higher_for_longer`, `scenario_run_id=8d49f5a8-4021-4db0-8c6b-88bb97cd6d3a`, `ticker=AAPL`

Evidence:
- Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_execution_log.md
- Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_coldstart_ui.xml
- Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_coldstart.png
- Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_after_refresh_ui.xml
- Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_after_refresh.png
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Optional scheduled scenario runs | Deferred by M7 lock to keep v1 user-triggered and deterministic | OWNER-WAIVED (Linear skipped by workspace rule) | Post-Phase5 |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Template-first strategy | Predefined macro scenarios ship first | No |
| Suggested rules policy | Suggestions are review-only in M7 | No |
| Scenario run mode | M7 v1 is user-triggered only; optional scheduled runs deferred | No |
| Entitlement | Stress cards are Pro-only in M7 | No |
