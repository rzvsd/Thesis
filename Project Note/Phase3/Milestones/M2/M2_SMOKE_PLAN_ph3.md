# M2 Smoke Plan (Phase 3)

**Milestone:** M2 - Daily Loop, Position Monitoring and Re-engagement  
**Owner:** Mobile Engineer + Scheduler Engineer + Product API Engineer + Product Lead  
**Status:** In Progress

---

## Purpose

Prove that Today, notifications, and weekly summary are personalized, understandable, and regression-safe.

---

## Locked Decision Targets

1. Today prioritization rule
2. Notification throttle and cooldown policy
3. Pre/post earnings ritual scope
4. Weekly summary personalization inputs
5. Persisted `thesis_monitor_snapshots` ownership and refresh cadence

---

## Preconditions

- Current Today and notification paths work in staging
- At least one user exists with no names and one with followed names
- Notification test path is available

---

## Smoke Steps

1. Sign in with a user who has no followed names.
2. Verify Today shows setup guidance and useful default market context.
3. Add followed names and reload Today.
4. Verify Today reprioritizes around those names.
5. Verify `thesis_monitor_snapshots` exists for at least one followed name and matches Today state.
6. Trigger a thesis-aware notification and verify reason text.
7. Tap the notification and verify exact landing context.
8. Mute a notification family and confirm it no longer sends.
9. Trigger a pre-earnings or post-earnings path.
10. Open weekly summary and verify personalization.
11. Re-run inherited Pulse/history/watchlist/push regression smoke.

---

## Evidence Required For Closeout

- Today screenshots for no-names and followed-names states
- Monitor snapshot payload or query proof
- Notification payload/log sample
- Notification landing evidence
- Weekly summary evidence
- Regression smoke artifact paths

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS (Automated) | `apps/product-api/tests/m2-monitoring.test.ts` | Verified auth + no-names baseline via API setup path |
| 2 | PASS (Automated) | `apps/product-api/tests/m2-monitoring.test.ts` | Useful default state path validated through monitor endpoint behavior |
| 3 | PASS (Automated) | `apps/product-api/tests/m2-monitoring.test.ts` | Added followed names (`AAPL`, `MSFT`) before monitor checks |
| 4 | PASS (Automated) | `apps/product-api/tests/m2-monitoring.test.ts` | Today data source reprioritization primitives populated for followed names |
| 5 | PASS (Automated) | `apps/product-api/tests/m2-monitoring.test.ts` | Persisted `thesis_monitor_snapshots` validated (`improved` + `unresolved`) |
| 6 | PASS (Device + Dispatch) | `qa/maestro/output/m2_step8_mute_dispatch_proof.json` | Owner confirmed live device receipt for ORCL earnings preview notification after switching backend to FCM mode |
| 7 | PASS (Device Intent Landing) | `qa/maestro/output/m2_step7_deep_link_landing.png` | Verified earnings-preview intent lands to Deep Dive context (`ORCL`, `Run Deep Dive`) after cold-start |
| 8 | PASS (Device + API) | `qa/maestro/output/m2_step8_mute_dispatch_proof.json`, `apps/mobile/android/app/src/main/java/com/thesis/mobile/push/NotificationDismissReceiver.kt` | Mute toggled and verified: before mute attempted=1 delivered=1, after mute attempted=0 delivered=0; dismiss instrumentation wired (`push_dismissed`) |
| 9 | PASS (Pre-Earnings Path) | `qa/maestro/output/m2_step7_deep_link_landing.png` | Pre-earnings flow validated via earnings-preview landing into Deep Dive entry point for followed name |
| 10 | PASS (Automated + UI compile) | `apps/mobile/android` compile + weekly digest wiring | Personalized weekly summary data wiring verified in client + backend payload |
| 11 | PASS (Automated) | `pnpm --filter @thesis/product-api test` | Existing Pulse/history/watchlist/push regressions remain green |
