# M1 Smoke Plan (Phase 5)

**Milestone:** M1 - Kill-Switch Engine  
**Owner:** Product API Engineer + Scheduler Engineer + Dexter Engineer  
**Status:** Closed (PASS)

---

## Purpose

Prove that thesis break conditions can be extracted, stored, evaluated, and delivered as explainable exceptions.

---

## Locked Decision Targets

1. Falsifiable condition extraction quality
2. Durable rule persistence ownership
3. Evaluation cadence and idempotency
4. Alert-ledger integration compatibility

---

## Preconditions

- Deep Dive completion flow is operational
- Alert ledger APIs are operational
- Scheduler local test environment is runnable

---

## Smoke Steps

1. Complete Deep Dive and trigger condition extraction.
2. Confirm 3-5 rules persist for user+ticker.
3. Execute evaluator against deterministic event fixtures.
4. Confirm matched rules create alert-ledger rows and push payload context.
5. Confirm non-matches do not emit alerts.
6. Confirm legacy contrarian path still passes.

---

## Evidence Required For Closeout

- Contract paths
- Migration paths
- Integration test proof
- Scheduler evaluator proof
- Regression proof for legacy contrarian path

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | Deep Dive completion ingests kill-switch conditions and creates durable rules |
| 2 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | 3-5 typed rules persisted for user+ticker in integration flow |
| 3 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | Evaluator run with deterministic fixtures (`signal_source=event`) |
| 4 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | Matched rules created alert-ledger rows and push payload context |
| 5 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | Non-matches and second-run idempotency produced no duplicate alerts |
| 6 | PASS | `Project Note/Phase5/Milestones/M1/evidence/2026-04-08_m1_smoke.md` | Legacy contrarian evaluation path still passed |

LangSmith closeout addendum (2026-04-16):
- Remote prompt registration executed successfully.
- Evidence: `Project Note/Phase5/Milestones/M1/evidence/2026-04-16_langsmith_prompt_push.json`.
