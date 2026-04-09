# M2 Smoke Plan (Phase 5)

**Milestone:** M2 - Thesis Freshness and Decay  
**Owner:** Product API Engineer + Scheduler Engineer + Mobile Engineer  
**Status:** Planned

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
3. Trigger rule proximity to reach `triggered` state.
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
| 1 | PENDING | TBD | - |
| 2 | PENDING | TBD | - |
| 3 | PENDING | TBD | - |
| 4 | PENDING | TBD | - |
| 5 | PENDING | TBD | - |
| 6 | PENDING | TBD | - |

