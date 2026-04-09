# M4 Smoke Plan (Phase 5)

**Milestone:** M4 - Earnings War Room  
**Owner:** Product API Engineer + Scheduler Engineer + Dexter Engineer + Mobile Engineer  
**Status:** Closed (PASS; ADB device smoke captured; owner approval recorded)

---

## Purpose

Prove that earnings event windows run with coherent pre/live/post behavior and thesis-delta closure.

---

## Locked Decision Targets

1. Pre-event playbook completeness
2. Live-cycle stability with deterministic `15 min` default and `30 min` fallback/recovery thresholds
3. Post-event auto-close workflow
4. Route-safe mobile entry and continuation with `war_room_id`
5. Pro-only entitlement with Free legacy preview continuity
6. Auditable pre/live/post history persistence linked to alert history

---

## Preconditions

- M1-M3 outputs are operational
- Earnings calendar event detection is stable
- Mobile build lane and device lane are available

---

## Smoke Steps

1. Seed upcoming event and confirm pre-event War Room generation.
2. Confirm pre-event payload contains thesis-linked watch items and active rules.
3. Simulate two consecutive live-cycle failures and verify `15 -> 30` fallback transition.
4. Simulate three consecutive healthy cycles and verify `30 -> 15` recovery transition.
5. Confirm post-event Deep Dive auto-queue and thesis delta output.
6. Confirm freshness reset and rule re-evaluation.
7. Confirm War Room routes from push and in-app entry points using payload with `war_room_id`.
8. Confirm Pro receives War Room while Free receives legacy `earnings_preview`.
9. Force War Room preparation failure for Pro and confirm degraded fallback uses legacy `earnings_preview`.
10. Confirm durable history rows exist for pre/live/post with linkage to alert-ledger IDs when notifications were sent.

---

## Evidence Required For Closeout

- Pre/live/post integration test output
- Scheduler cycle proof
- Cadence default/fallback/recovery transition proof
- Post-event queue and delta proof
- Mobile compile and route proof (`war_room_id` launch included)
- Entitlement and degraded-fallback proof (Pro vs Free and War Room-failure fallback)
- Durable history persistence proof with alert-ledger linkage
- Device smoke proof

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts` | Seeded event + pre-window generation validated |
| 2 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts` | Pre payload contains rule-linked context and war-room id |
| 3 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts`, `apps/scheduler/tests/war-room-cadence.test.ts` | Two degraded cycles force `15 -> 30` |
| 4 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts`, `apps/scheduler/tests/war-room-cadence.test.ts` | Three healthy cycles recover `30 -> 15` |
| 5 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts` | Post phase queues Deep Dive and records timeline event |
| 6 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts` | Freshness reset + post recheck writes verified |
| 7 | PASS | `apps/mobile/android/app/src/test/java/com/thesis/mobile/launch/LaunchDestinationResolverTest.kt`, `apps/mobile/android/app/src/test/java/com/thesis/mobile/model/WarRoomViewMapperTest.kt`, `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_coldstart.png`, `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed.png`, `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_war_room_closed_scrolled.png` | Route-safe launch + `war_room_id` parsing validated; connected-device cold start rendered pre/live/post War Room state |
| 8 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts`, `apps/product-api/tests/subscription.test.ts`, `apps/product-api/tests/m5-notifications.test.ts` | Pro War Room + Free legacy preview path preserved |
| 9 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts`, `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_device_fallback_inbox.png`, `Project Note/Phase5/Milestones/M4/evidence/2026-04-09_m4_execution_log.md` | Dedicated failure-injection proof completed; Pro degraded fallback produced legacy `earnings_preview` and rendered in Inbox |
| 10 | PASS | `apps/product-api/tests/ph5-m4-war-room.test.ts` | Durable pre/live/post timeline with alert linkage verified |

Device note: Maestro CLI was not available in the local shell on 2026-04-09, so closeout evidence uses direct ADB launch/UI-tree/screenshot capture against the connected device `R3CXA03J3LH`.
