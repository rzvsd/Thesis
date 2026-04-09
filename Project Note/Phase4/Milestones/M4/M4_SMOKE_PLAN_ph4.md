# M4 Smoke Plan (Phase 4)

**Milestone:** M4 - Deep Links, Smoke, Quality, and Evidence  
**Owner:** Mobile Engineer + QA Lead  
**Status:** PASS - local lane and device lane completed

---

## Purpose

Prove that the new Phase 4 routing is wired end to end locally and prepare the final device/Maestro lane for closeout.

---

## Locked Decision Targets

1. Phase 4 route-target map
2. Local quality-check set for touched services
3. Device proof runner and evidence location

---

## Preconditions

- Product API code compiles and test suite is runnable
- Android Studio JBR is available locally
- Phase 4 milestone evidence folders exist

---

## Smoke Steps

1. Run workspace typecheck.
2. Run Product API typecheck.
3. Run Product API test coverage including alert-ledger flows.
4. Compile Android with the local Android Studio JBR.
5. Confirm push routing code supports `Today / Names / Research / Inbox / You`.
6. Run the Phase 4 Maestro smoke on the owner-provided Android device and record the artifacts.

---

## Evidence Required For Closeout

- Workspace typecheck proof
- Product API typecheck/test proof
- Android compile proof
- Route-map summary
- Device-pass note with Maestro artifact paths

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json` | `corepack pnpm typecheck` passes. |
| 2 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json` | `corepack pnpm --filter @thesis/product-api typecheck` passes. |
| 3 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json` | Product API tests pass, including Phase 4 alert-ledger coverage. |
| 4 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json` | Android `:app:compileDebugKotlin` passes with the local Android Studio JBR. |
| 5 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-local-smoke-summary.json` | Launch/push handlers now recognize `today`, `names`, `research`, `inbox`, and `you`, and carry `alert_id`. |
| 6 | PASS | `Project Note/Phase4/Milestones/M4/evidence/2026-04-08/m4-device-smoke-summary.json` | Maestro smoke passed on Android device `R3CXA03J3LH`; summary/log artifacts are linked from the evidence JSON. |
