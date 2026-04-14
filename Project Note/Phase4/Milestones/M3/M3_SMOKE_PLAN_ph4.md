# M3 Smoke Plan (Phase 4)

**Milestone:** M3 - Mobile IA V2 and Design-System Preservation  
**Owner:** Mobile Engineer  
**Status:** Closed (PASS; device lane completed in M4)

---

## Purpose

Prove that the Android app has the new 5-tab shell, preserved Thesis styling, and working local routing paths.

---

## Locked Decision Targets

1. 5-tab root map
2. Screen ownership rules
3. Theme-preservation posture
4. Centralized copy location for new IA surfaces

---

## Preconditions

- M2 backend surface is available in code
- Android Studio JBR is available locally
- Current theme tokens remain intact

---

## Smoke Steps

1. Compile the Android app.
2. Confirm five tabs render in code and route through the app shell.
3. Confirm Names consumes watchlist, monitor snapshots, and alert-ledger context.
4. Confirm Inbox consumes alert-ledger history and supports feedback/mute plus existing notification-family quieting.
5. Confirm You still exposes notifications, biometric lock, subscription, and trust guidance.

---

## Evidence Required For Closeout

- Android compile command/result
- Root navigation code paths
- New-screen file paths
- Copy-centralization file path

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json` | `:app:compileDebugKotlin` passes using the local Android Studio JBR. |
| 2 | PASS | `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json` | Root shell now maps to `Today / Names / Research / Inbox / You`. |
| 3 | PASS | `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json` | `NamesScreen` combines watchlist rows with monitor-snapshot and alert-ledger context. |
| 4 | PASS | `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json` | `InboxScreen` renders alert history, supports feedback/mute, and routes quieting through existing notification-family preferences. |
| 5 | PASS | `Project Note/Phase4/Milestones/M3/evidence/2026-04-08/m3-mobile-compile-summary.json` | `You` remains the home for subscription, biometric lock, notification controls, and trust guidance. |
