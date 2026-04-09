# M2 Smoke Plan (Phase 5)

**Milestone:** M2 - Thesis Freshness and Decay  
**Owner:** Product API Engineer + Scheduler Engineer + Mobile Engineer  
**Status:** Closed (PASS)

---

## Purpose

Prove that thesis freshness is computed deterministically, surfaced clearly, and delivered as explainable review-needed signals.

---

## Locked Decision Targets

1. Freshness state transitions
2. Material-event counting doctrine
3. Decay alert explainability
4. Names-board rendering consistency

---

## Preconditions

- M1 kill-switch model available
- Monitor snapshots operational
- Names board baseline from Phase 4 is stable

---

## Smoke Steps

1. Seed fresh thesis baseline and verify `current` state.
2. Add fixture events and age timeline to trigger `aging` and `stale`.
3. Trigger matched kill-switch evaluation to reach `triggered` state.
4. Confirm freshness-decay alert rows with reason text.
5. Confirm Names board state markers match backend state.
6. Confirm no regression in existing monitor snapshot paths.

---

## Evidence Required For Closeout

- Freshness transition test output
- API integration coverage output
- Scheduler recompute proof
- Mobile compile and UI evidence
- Regression proof

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | `ph5-m2-freshness.test.ts` validates `current` baseline |
| 2 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | Transition path `current -> aging -> stale` verified |
| 3 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | Kill-switch match + recompute yields `triggered` |
| 4 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | Alert-ledger freshness rows include reason and names route |
| 5 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | Android compile + Names rendering checks passed |
| 6 | PASS | `Project Note/Phase5/Milestones/M2/evidence/2026-04-09_m2_smoke.md` | Full `@thesis/product-api` regression suite passed |
