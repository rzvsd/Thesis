# AGENTS.md - Phase 5 M4 Earnings War Room
**Milestone:** Phase 5 M4 - Earnings War Room  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase4/ph4_AGENTS.md`, then `Project Note/Phase5/ph5_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase5/Milestones/M4/M4_MILESTONE_AGENTS_ph5.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 5 M4 - Earnings War Room |
| **Linear Project** | Phase 5 M4 - Earnings War Room |
| **Owner** | Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer |
| **Status** | Closed (PASS; ADB device smoke complete) |
| **Depends on** | M1-M3 complete |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | War Room includes pre, live, and post event phases | RESOLVED | Product Lead | Milestone start |
| G2 | Live cycle defaults to `15 min` with automatic `30 min` fallback under degradation, without adding services | RESOLVED | Scheduler Engineer | Milestone start |
| G3 | Post-event Deep Dive refresh is auto-queued | RESOLVED | Product API Engineer | Milestone start |
| G4 | War Room remains thesis-first and explainable | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G5 | War Room visual execution keeps the same Thesis colors, typography, tone, and component style | RESOLVED | Product Lead + Mobile Engineer | Milestone start |
| G6 | War Room entitlement is Pro-only while Free remains on legacy `earnings_preview` | RESOLVED | Product Lead | Milestone start |
| G7 | War Room deep-link contract includes `war_room_id` with route-safe launch tuple | RESOLVED | Product API Engineer + Mobile Engineer | Milestone start |
| G8 | Fallback trigger and recovery thresholds are deterministic and testable | RESOLVED | Scheduler Engineer | Milestone start |
| G9 | War Room pre/live/post history writes are durable and auditable | RESOLVED | Product API Engineer | Milestone start |
| G10 | M4 cutover policy is coexistence-by-entitlement, not hard replacement | RESOLVED | Product Lead + Engineering Lead | Milestone start |

---

## 1. What This Milestone Is Building

M4 builds the highest-intensity event workflow with one coherent pre/live/post earnings operating surface.

---

## 2. Read These Files First

- `Project Note/Phase5/ph5_AGENTS.md`
- `Project Note/Phase5/ph5_MILESTONES.md`
- `Project Note/Phase5/ph5_PRD.md`
- `Project Note/Phase5/PH5_INTELLIGENCE_MAPPING.md`
- `Project Note/Phase5/Milestones/M1/M1_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M2/M2_MILESTONE_AGENTS_ph5.md`
- `Project Note/Phase5/Milestones/M3/M3_MILESTONE_AGENTS_ph5.md`

---

## 3. Scope - What Is In

- [x] War Room contracts and API surfaces
- [x] Pre-event playbook generation
- [x] Live event accelerated update cycle
- [x] Post-event Deep Dive queue and thesis-delta summary
- [x] Rule re-evaluation and freshness reset
- [x] Mobile War Room rendering and deep-link handling

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Cross-name propagation | M5 |
| Conviction timelines and coherence | M6 |
| Scenario stress cards | M7 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Product API | `apps/product-api/` | War Room payload assembly and post-event orchestration |
| Scheduler | `apps/scheduler/` | Event-window cadence management |
| Dexter Worker | `apps/dexter-worker/` | Playbook synthesis and post-event delta synthesis |
| Mobile | `apps/mobile/android/` | War Room screen and routing |
| Contracts | `packages/contracts/` | War Room payload contracts |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| War Room pre/live/post payload | New | `packages/contracts/src/` |
| War Room route context payload | Additive | `packages/contracts/src/` |
| War Room history/audit payload | New | `packages/contracts/src/` |

War Room durable history shape lock:

- `war_rooms` header: `war_room_id`, `user_id`, `ticker`, `earnings_event_id`, `state`, `current_cadence_min`, `prepared_at`, `closed_at`
- `war_room_timeline_events`: `war_room_event_id`, `war_room_id`, `phase` (`pre`/`live`/`post`), `event_type`, `reason_text`, `source_refs`, `created_at`, optional `alert_ledger_id`, optional `report_id`
- User-facing War Room notifications require linked writes: alert ledger row plus timeline row referencing the same `alert_ledger_id`

---

## 7. Earlier-Phase Wiring Obligations

| Existing System | Built In | Phase 5 M4 Change | Why Here |
|---|---|---|---|
| Earnings preview alerts | Phase 2 M5 | Coexist by entitlement; retain as Free path and degraded fallback while Pro routes to War Room | Safe monetization + resilient cutover |
| Thesis drift metadata | Phase 3 M1 | Reuse for post-event delta | Preserve trust explainability |
| Route-safe tab map | Phase 4 M4 | War Room entry must remain route-safe | Avoid dead-end event UX |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 5 M4 - Earnings War Room

Naming:
```text
[PH5-M4] What is being built
[PH5-M4][BUG] What is broken
[PH5-M4][SPIKE] What is being investigated
```

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| War Room prepared | INFO | `{ service, ticker, event_date, war_room_id, timestamp }` |
| War Room live update | INFO | `{ service, ticker, cycle_interval_min, update_count, timestamp }` |
| War Room cadence transition | WARN | `{ service, ticker, war_room_id, from_interval_min, to_interval_min, trigger_type, consecutive_count, timestamp }` |
| War Room post-event close | INFO | `{ service, ticker, new_report_id, thesis_delta_status, timestamp }` |

---

## 10. Testing Requirements

- [x] Product API and scheduler typecheck passes
- [x] War Room integration tests pass for pre/live/post phases
- [x] Live-cycle cadence tests validate deterministic fallback triggers and deterministic recovery thresholds
- [x] Deep Dive auto-queue and post-event delta tests pass
- [x] Mobile compile and War Room route tests pass, including `war_room_id` parse and launch continuity
- [x] Tier-gating tests pass (Pro War Room vs Free legacy earnings preview)
- [x] Coexistence cutover tests pass (War Room generation failure -> legacy fallback path)
- [x] Earnings baseline regressions pass

Detailed execution lives in `M4_SMOKE_PLAN_ph5.md`.

---

## 11. Definition Of Done

- [x] All M4 acceptance criteria in `ph5_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Required regressions pass
- [x] Linear tickets skipped/deferred per owner instruction for this workstream
- [x] Product Lead sign-off recorded (owner approval in Codex session on 2026-04-09)
- [x] Engineering Lead countersign recorded (owner-approved closeout instruction in Codex session on 2026-04-09)

---

## 12. Smoke Test Log

```text
Date: 2026-04-09
Run by: Codex
Environment: local memory backends + Android unit-test lane + connected ADB device R3CXA03J3LH
Result: PASS for code/integration and ADB device smoke

Executed:
- corepack pnpm --filter @thesis/product-api typecheck
- corepack pnpm --filter @thesis/contracts typecheck
- corepack pnpm --filter @thesis/scheduler typecheck
- corepack pnpm --filter @thesis/scheduler test
- corepack pnpm --filter @thesis/product-api test
- corepack pnpm typecheck
- gradlew :app:testDebugUnitTest
- gradlew :app:installDebug
- ADB cold-start launch with open_tab=research, notification_type=earnings_war_room, war_room_id=5916feda-a5d1-4c94-bf00-8ecba305fd90, ticker=AAPL
- ADB Inbox fallback render check for forced degraded Pro fallback to legacy earnings_preview
- ADB War Room lifecycle render check after live fallback/recovery and post close

Evidence:
- Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_execution_log.md
- Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_coldstart.png
- Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_fallback_inbox.png
- Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed.png
- Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed_scrolled.png

Note:
- Maestro CLI was not available in the local shell; device proof was captured through direct ADB UI-tree and screenshot evidence.
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Maestro CLI run | Maestro binary was not available in the local shell; direct ADB device proof was captured instead | Not required for M4 closure | Optional future tooling follow-up |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Event workflow model | Pre/live/post single War Room experience | No |
| Live update strategy | `15 min` default cadence with automatic `30 min` fallback inside existing scheduler | No |
| Fallback trigger doctrine | Fallback/recovery thresholds are deterministic and fixture-testable | No |
| Monetization and cutover | Pro receives War Room; Free remains on legacy preview; degraded fallback stays legacy in M4 | No |
| Route contract | War Room launch payload requires `open_tab=research`, `notification_type=earnings_war_room`, `war_room_id`, `ticker` | No |
