# M4 Smoke Plan (Phase 5)

**Milestone:** M4 - Earnings War Room  
**Owner:** Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer  
**Status:** Planned

---

## Purpose

Prove that earnings event windows run with coherent pre/live/post behavior and thesis-delta closure.

---

## Locked Decision Targets

1. Pre-event playbook completeness
2. Live-cycle stability with `15 min` default and `30 min` fallback
3. Post-event auto-close workflow
4. Route-safe mobile entry and continuation

---

## Preconditions

- M1-M3 outputs are operational
- Earnings calendar event detection is stable
- Mobile build lane and device lane are available

---

## Smoke Steps

1. Seed upcoming event and confirm pre-event War Room generation.
2. Confirm pre-event payload contains thesis-linked watch items and active rules.
3. Simulate live window updates and verify `15 min` default cadence and automatic `30 min` fallback behavior.
4. Confirm post-event Deep Dive auto-queue and thesis delta output.
5. Confirm freshness reset and rule re-evaluation.
6. Confirm War Room routes from push and in-app entry points.

---

## Evidence Required For Closeout

- Pre/live/post integration test output
- Scheduler cycle proof
- Cadence default/fallback transition proof
- Post-event queue and delta proof
- Mobile compile and route proof
- Device smoke proof

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
