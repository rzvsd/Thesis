# Phase 5 M4 Execution Log - 2026-04-09

## Scope Executed

- Contracts: War Room payload and notification context wiring.
- Product API: War Room lifecycle endpoints (`pre`/`live`/`post`), cadence transitions, alert-ledger linkage, retrieval route.
- Scheduler: War Room dispatch integration and cadence evaluator coverage.
- Mobile: War Room launch routing (`war_room_id`), model mapping, Research War Room mode/screen, copy integration.
- Docs: M4 milestone + smoke plan status updates.

## Quality Checks

```text
corepack pnpm --filter @thesis/contracts typecheck                           PASS
corepack pnpm --filter @thesis/product-api typecheck                         PASS
corepack pnpm --filter @thesis/scheduler typecheck                           PASS
corepack pnpm --filter @thesis/scheduler test                                PASS (9/9)
corepack pnpm --filter @thesis/product-api test                              PASS (40/40)
corepack pnpm typecheck                                                      PASS
gradlew :app:testDebugUnitTest                                               PASS
```

## M4-Specific Test Evidence

- Product API integration:
  - `apps/product-api/tests/ph5-m4-war-room.test.ts`
  - Validates pre-event creation, deterministic live fallback (`15 -> 30`), deterministic recovery (`30 -> 15`), post-event close, timeline durability, and alert linkage.
- Scheduler cadence unit tests:
  - `apps/scheduler/tests/war-room-cadence.test.ts`
  - Validates fallback/recovery thresholds and per-room state isolation.
- Mobile route + parsing tests:
  - `apps/mobile/android/app/src/test/java/com/thesis/mobile/launch/LaunchDestinationResolverTest.kt`
  - `apps/mobile/android/app/src/test/java/com/thesis/mobile/model/WarRoomViewMapperTest.kt`

## Pending Closeout Items

- Dedicated failure-injection smoke for degraded Pro fallback to legacy `earnings_preview`.
- Device/ADB + Maestro smoke capture in this run window (ADB device list was empty at execution time).

## Closeout Addendum - Device + Failure Injection

Date: 2026-04-09  
Run by: Codex  
Device: `R3CXA03J3LH` (`SM-S928B`)  
Harness: local Product API on `3002` with memory stores, OpenBB calendar mock on `3201`, `adb reverse tcp:3002 tcp:3002`

### Additional Quality Checks

```text
corepack pnpm --filter @thesis/product-api typecheck                         PASS
corepack pnpm --filter @thesis/product-api test                              PASS (41/41)
gradlew :app:installDebug                                                    PASS
```

### Forced Degraded Fallback Proof

- Seeded a Pro test user with followed name `AAPL` and an earnings event on `2026-07-28`.
- Forced War Room preparation failure through the smoke-only, memory-harness-gated `force_fail_user_ids` test hook on `/internal/notifications/earnings-war-room`.
- Verified the War Room preparation response returned the test user in `fallback_user_ids`.
- Dispatched legacy `/internal/notifications/earnings-preview` for that fallback user.
- Verified alert ledger contained `earnings_preview` and did not create a `war_room_prepared` alert for the forced-failure attempt.
- Connected-device Inbox evidence shows `Earnings preview: AAPL`.

Evidence:
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_fallback_inbox_ui.xml`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_fallback_inbox.png`

### War Room Device Proof

- Cold-start launched the app with the route-safe push tuple:
  - `open_tab=research`
  - `notification_type=earnings_war_room`
  - `war_room_id=5916feda-a5d1-4c94-bf00-8ecba305fd90`
  - `ticker=AAPL`
- Verified the connected device rendered Research -> War Room with `Room 5916feda-a5d1-4c94-bf00-8ecba305fd90`, `Ticker: AAPL`, and `Status: PRE`.
- Drove the same War Room through live fallback/recovery and post close using the Product API harness.
- Verified the connected device rendered `Status: CLOSED`, live cadence recovery text, and post-event `DEEP_DIVE_QUEUED` timeline state.

Evidence:
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_coldstart_ui.xml`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_coldstart.png`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed_ui.xml`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed.png`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed_scrolled_ui.xml`
- `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed_scrolled.png`

### Remaining Note

Maestro CLI was not available in the local shell, so this closeout uses direct ADB UI-tree and screenshot evidence from the connected phone. No product or contract acceptance item remains blocked by this.
