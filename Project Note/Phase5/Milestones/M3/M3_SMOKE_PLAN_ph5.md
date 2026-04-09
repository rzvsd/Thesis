# M3 Smoke Plan (Phase 5)

**Milestone:** M3 - Morning Exception Briefing  
**Owner:** Scheduler Engineer + Product API Engineer + Mobile Engineer  
**Status:** Planned

---

## Purpose

Prove that morning output is personalized, exception-first, and explicitly informative when nothing changed.

---

## Locked Decision Targets

1. Personalized relevance selection
2. Explicit no-change output
3. Ledger durability of morning briefing
4. Route-safe rendering on Today and Inbox

---

## Preconditions

- M1 and M2 data paths operational
- Morning scheduler cycle runnable in test mode
- Today and Inbox surfaces available from Phase 4

---

## Smoke Steps

1. Seed user with followed names and no overnight relevant events.
2. Run morning cycle and confirm no-change briefing output.
3. Seed overnight relevant events and run cycle again.
4. Confirm exceptions include reason text and resolvable route targets.
5. Confirm briefing entries persist in alert ledger.
6. Confirm Today and Inbox render both output modes correctly.

---

## Evidence Required For Closeout

- Briefing generation test output
- Ledger persistence proof
- Mobile rendering proof
- Dedupe/throttle proof

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

