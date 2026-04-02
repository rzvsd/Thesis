# M2 Smoke Plan (Phase 3)

**Milestone:** M2 - Daily Loop, Position Monitoring and Re-engagement  
**Owner:** Mobile Engineer + Scheduler Engineer + Product API Engineer + Product Lead  
**Status:** Planned

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
| 1 | TBD |  |  |
| 2 | TBD |  |  |
| 3 | TBD |  |  |
| 4 | TBD |  |  |
| 5 | TBD |  |  |
| 6 | TBD |  |  |
| 7 | TBD |  |  |
| 8 | TBD |  |  |
| 9 | TBD |  |  |
| 10 | TBD |  |  |
| 11 | TBD |  |  |
