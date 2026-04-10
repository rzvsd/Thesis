# M6 Smoke Plan (Phase 5)

**Milestone:** M6 - Conviction Intelligence  
**Owner:** Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer
**Status:** Closed (PASS) - recheck completed on physical device on 2026-04-10

---

## Purpose

Prove that conviction history and coherence insights are durable, explainable, and behaviorally useful.

---

## Locked Decision Targets

1. Journal event capture completeness
2. Coherence insight explainability
3. Opposite-case report linkage
4. Monthly insight delivery stability
5. Pro-only entitlement behavior
6. Existing Research/You ownership with no new top-level mobile surface

Locked interface names:

- Contract file: `packages/contracts/src/conviction-intelligence.ts`
- Timeline endpoint: `GET /v1/conviction/timeline?ticker=&limit=`
- Insight endpoint: `GET /v1/conviction/insights?limit=`
- Opposite-case create endpoint: `POST /v1/reports/{report_id}/opposite-case`
- Opposite-case read endpoint: `GET /v1/reports/{report_id}/opposite-case`
- Internal coherence evaluator endpoint: `POST /internal/conviction/coherence/evaluate`
- Opposite-case prompt identifier: `thesis-m6-opposite-case`
- Coherence analyzer prompt identifier: `thesis-m6-coherence-analyzer`

Locked storage names:

- `conviction_journal_entries`
- `conviction_insight_cards`
- `opposite_case_reports`

LangSmith note:

- Remote prompt registration proof can be carried as TBD if `LANGSMITH_API_KEY` is unavailable.
- Local prompt manifest, sync hook, and deterministic regression fixtures remain required for closeout.

---

## Preconditions

- M1-M5 event streams are available
- Report history and alert-ledger records are queryable
- Mobile Research and You surfaces are stable
- Pro entitlement checks are available through existing subscription tier state
- Scheduler can call Product API internal endpoints

---

## Smoke Steps

1. Seed conviction events for Deep Dive, kill-switch, freshness, earnings, and cross-name moments; confirm deduped journal timeline.
2. Confirm timeline retrieval filters by user and ticker and orders events by `event_at desc`.
3. Run coherence analysis across multi-name fixture and verify overlap/contradiction/mismatch outputs.
4. Confirm monthly coherence insight card creation with idempotency key `user_id + period_start + period_end + monthly_coherence`.
5. Trigger opposite-case generation and verify linkage to original report, prompt version, same-evidence reuse, and read endpoint.
6. Confirm Free users cannot create/read conviction system outputs while existing report notes/feedback remain unchanged.
7. Confirm timeline and opposite-case rendering in Research and monthly coherence rendering in You using existing Thesis visual language.
8. Confirm no regression to existing Research report paths.

---

## Evidence Required For Closeout

- Journal integration test output
- Coherence fixture output
- Opposite-case linkage proof
- Pro-only gating proof
- Monthly scheduler/idempotency proof
- Mobile render proof
- Regression proof

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` | `PH5 M6 conviction journal, opposite case, coherence, and Pro gating` passed. |
| 2 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` | Timeline assertions validated per-user and per-ticker ordering/filtering. |
| 3 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` | Coherence findings include overlap/contradiction/mismatch with explainable summaries. |
| 4 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` and `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/scheduler_test.log` | Monthly coherence generation and monthly dispatch guard validated. |
| 5 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` | Opposite-case create/read linkage and shared evidence reuse validated. |
| 6 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/product_api_test.log` | Pro-only gating validated while legacy note/feedback flows remain available. |
| 7 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/maestro_smoke_core.log`, `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/maestro_smoke.log`, and `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/report_card/maestro_2026-04-10T13-59-16-550Z/maestro.log` | You-monthly-coherence rendering on physical phone passed; seeded AAPL report-level Research smoke also passed and asserted `Conviction Intelligence`, `Conviction Timeline`, and `Opposite Case`. Screenshot: `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/report_card/report_level_conviction_card_pass.png`. |
| 8 | PASS | `Project Note/Phase5/Milestones/M6/evidence/2026-04-10_m6_recheck/maestro_smoke_core.log` | Research tab baseline path (Deep Dive/War Room/History and Deep Dive entry state) remained stable on physical phone. |
