# M7 Smoke Plan (Phase 5)

**Milestone:** M7 - Scenario Stress Cards  
**Owner:** Product API Engineer + Dexter Engineer + Mobile Engineer  
**Status:** Closed (PASS; connected-device ADB smoke captured)

---

## Purpose

Prove that scenario stress cards deliver deterministic, explainable, and actionable portfolio-wide intelligence.

---

## Locked Decision Targets

1. Scenario template validity
2. Evaluator determinism
3. Actionable stress output quality
4. Suggested rule recommendation quality
5. Pro/Free entitlement enforcement
6. Scenario route/deep-link recovery
7. M7 v1 run mode (user-triggered only)
8. Thesis visual-language preservation on scenario surfaces

---

## Preconditions

- M1 and M6 outputs are available
- Scenario templates are seeded
- Mobile scenario surfaces are build-ready
- Pro and Free fixture users are available for entitlement verification
- Determinism fixtures pin `scenario_id`, `scenario_template_version`, `as_of_date`, and thesis snapshot

---

## Smoke Steps

1. Execute baseline scenario template for seeded portfolio by user-triggered request to `POST /v1/scenarios/runs`.
2. Confirm per-name impact output and explanation chain.
3. Confirm portfolio summary and impacted-thesis list.
4. Confirm suggested kill-switch additions are present and reviewable.
5. Re-run same scenario and verify deterministic envelope:
6. impacted ticker set must match exactly.
7. per-ticker `impact_level` and `thesis_break_likelihood` must match exactly.
8. suggested rule set by `ticker + signal_type + direction` must match exactly.
9. numeric score fields may vary only within `+/-0.02`.
10. Confirm Free users are blocked from scenario run/read while Pro users succeed.
11. Confirm scenario card routes to affected names with no dead ends.
12. Confirm no scheduler-owned scenario cron/job/push exists and no run is created without user-triggered request.
13. Confirm scenario surfaces preserve existing Thesis colors, typography, tone, and component style.

---

## Evidence Required For Closeout

- Scenario execution integration tests
- Determinism repeat-run proof
- Suggestion quality fixture output
- Mobile compile and route proof
- Pro/Free entitlement proof
- Scheduler-deferral proof
- Device screenshot proof for Thesis visual-language continuity

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | User-triggered `POST /v1/scenarios/runs` verified |
| 2 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Per-name impacts and rationale fields validated |
| 3 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Run summary + impacted-thesis output validated |
| 4 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Rule suggestions generated and review-only |
| 5 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Repeat-run determinism verified |
| 6 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Impacted ticker set exact match verified |
| 7 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | `impact_level` and `thesis_break_likelihood` exact enum match verified |
| 8 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Suggestion signature set exact match verified |
| 9 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Numeric score variance bounded to `+/-0.02` |
| 10 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts` | Pro allowed, Free blocked for run/read |
| 11 | PASS | `apps/mobile/android/app/src/test/java/com/thesis/mobile/launch/LaunchDestinationResolverTest.kt`, `Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_coldstart_ui.xml`, `Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_after_refresh_ui.xml` | Route tuple resolves to Research + Stress flow on device |
| 12 | PASS | `apps/product-api/tests/ph5-m7-scenario-stress.test.ts`, scheduler source audit (`apps/scheduler/**`) | No scheduler-owned scenario cron/job/push path in M7 v1 |
| 13 | PASS | `Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_coldstart.png`, `Project Note/Phase5/Milestones/M7/evidence/2026-04-11_m7_device_scenario_after_refresh.png` | Device render preserves Thesis visual language |
