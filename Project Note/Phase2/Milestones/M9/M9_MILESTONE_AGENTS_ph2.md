# AGENTS.md - Phase 2 M9 Offline, Security and Launch Prep
**Milestone:** Phase 2 M9 - Offline, Security and Launch Prep  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase2/Milestones/M9/M9_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M9 - Offline, Security and Launch Prep |
| **Linear Project** | Phase 2 M9 - Offline, Security and Launch Prep |
| **Owner** | Mobile Engineer + Product API Engineer + Product Lead |
| **Status** | Ready to Implement (Decision-Locked) |
| **Depends on** | Phase 2 M8 closed; all prior Phase 2 milestones closed |

---

## Gated Pre-Conditions

These decisions are now locked and are part of the implementation contract.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Certificate pinning locks to one approved production API host and pins the **intermediate CA** (current + backup pin). Release builds fail closed on mismatch; debug builds disable pinning. | RESOLVED | Platform Engineer + Product Lead | 2026-04-01 |
| G2 | Cache policy is fixed: latest Pulse only, Deep Dive LRU(25), note-attached reports are pinned (no eviction), Fear & Greed keeps current + 90-day history, no manual clear-cache setting. | RESOLVED | Mobile Engineer + Product Lead | 2026-04-01 |
| G3 | Morning prefetch schedule is fixed: target 06:00 America/New_York with 24h periodic WorkManager + 1h flex (05:30-06:30). If prefetch fails, show last successful timestamp and keep prior cache. | RESOLVED | Mobile Engineer + Product Lead | 2026-04-01 |
| G4 | Biometric lock behavior is fixed: optional toggle (default OFF), lock only after >= 5 minutes background time, and fallback uses `BIOMETRIC_STRONG or DEVICE_CREDENTIAL`. Unsupported devices hide the toggle. | RESOLVED | Mobile Engineer + Product Lead | 2026-04-01 |
| G5 | PostHog minimum launch proof is fixed: 5 dashboards (Acquisition, Engagement, Retention, Monetization, Health) and 3 funnels (Activation, Notification Engagement, Pro Conversion), populated with real smoke data. | RESOLVED | Product Lead + Analytics Owner | 2026-04-01 |

**Rule:** M9 is launch hardening. It is not feature expansion and it is not a UI redesign milestone.

---

## 1. What This Milestone Is Building

M9 hardens the app for real-world release conditions:
- offline report access via local storage with deterministic eviction rules
- scheduled Pulse prefetch at 06:00 America/New_York target with defined flex behavior
- explicit offline freshness visibility and honest fallback behavior
- transport hardening with intermediate-CA certificate pinning (release fail-closed)
- release hardening via obfuscation/minification
- optional biometric lock with device-credential fallback and 5-minute threshold
- launch-grade PostHog dashboards and funnel proof

**Plain English summary for non-technical audit:**  
M9 makes the app resilient and launch-safe: users can still read key content offline, transport is hardened against interception, release builds are protected, and product telemetry is ready for launch decisions.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md`
- `Project Note/Phase1/MILESTONES.md`
- `Project Note/Phase1/PRD.md`

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md`
- `Project Note/Phase2/ph2_BLUEBOOK.md`
- `Project Note/Phase2/ph2_MILESTONES.md` (M9 section)
- `Project Note/Phase2/ph2_PRD.md` (offline behavior and edge-case expectations)
- `Project Note/Phase2/ph2_ROADMAP.md`
- `Project Note/Phase2/Milestones/M9/M9_SMOKE_PLAN_ph2.md`

### Current code surfaces

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/`
- `apps/mobile/android/app/build.gradle.kts`
- `apps/mobile/android/app/proguard-rules.pro`
- `apps/product-api/src/server.ts`
- `packages/observability/`

---

## 3. Scope - What Is In

- [ ] Room database with locked retention policy (Pulse latest, Deep Dive LRU(25), note-pinned exceptions, Fear & Greed 90-day history)
- [ ] WorkManager prefetch for Morning Pulse with 06:00 ET target and 05:30-06:30 execution window
- [ ] Offline freshness indicator in user-visible surfaces
- [ ] Certificate pinning for Product API transport path (intermediate pin + backup pin, debug bypass, release fail-closed)
- [ ] Release obfuscation/minification enabled and verified
- [ ] Optional biometric lock can be enabled/disabled with `DEVICE_CREDENTIAL` fallback
- [ ] PostHog launch dashboards and funnel validation ready (5 dashboards + 3 funnels)
- [ ] Full real-device end-to-end smoke run completed

Full acceptance source: `Project Note/Phase2/ph2_MILESTONES.md -> M9`.

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| New product features or new tabs | M9 is hardening only |
| Deep Dive reasoning/model changes | Belongs to M2/M7 paths |
| New data providers | Not required for M9 acceptance |
| CI/CD deployment pipeline redesign | Track separately if requested; not required by current M9 acceptance list |
| Monetization model changes | M4 scope |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile app | `apps/mobile/` | Room cache, WorkManager prefetch, offline UX indicator, biometric lock, release hardening |
| Product API | `apps/product-api/` | Read-only unless needed to expose cache-friendly freshness metadata |
| Observability | `packages/observability/` | Event audit for offline/prefetch/lock paths if required |

---

## 6. Contracts You Are Touching

| Contract | Change type | File |
|---|---|---|
| Existing report/pulse contracts | Read-only by default | `packages/contracts/src/` |

Rule: M9 should avoid contract drift. Contract edits only if a proven blocker exists.

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M9 - Offline, Security and Launch Prep

**Naming:**
```
[PH2-M9] What is being built
[PH2-M9][BUG] What is broken
[PH2-M9][SPIKE] What is being investigated
```

| Ticket | Acceptance mapping |
|---|---|
| `[PH2-M9] Room cache for viewed reports and latest pulse` | Previously viewed reports available in airplane mode |
| `[PH2-M9] WorkManager morning pulse prefetch` | Morning Pulse prefetched and available offline |
| `[PH2-M9] Offline freshness indicator` | Offline badge displays correct freshness |
| `[PH2-M9] Certificate pinning hardening` | MITM proxy attack fails due to pinning |
| `[PH2-M9] Release obfuscation verification` | Release build is obfuscated |
| `[PH2-M9] Biometric lock optional flow` | Biometric lock can be enabled/disabled |
| `[PH2-M9] PostHog launch dashboards and funnels` | PostHog dashboards and funnels show required product signals |
| `[PH2-M9] Real-device end-to-end smoke` | Full end-to-end physical-device test passes |
| `[PH2-M9] Closeout` | Smoke evidence, quality checks, DoD completion |

Never close without test evidence.

---

## 8. Logging and Observability

| Event | Level | Fields |
|---|---|---|
| Offline cache read used | INFO | `{ service, report_id_or_pulse_date, source: "room", timestamp }` |
| Offline cache miss | WARN | `{ service, requested_artifact, timestamp }` |
| Prefetch job scheduled | INFO | `{ service, schedule_timezone, scheduled_time, timestamp }` |
| Prefetch job completed | INFO | `{ service, artifact, latency_ms, timestamp }` |
| Prefetch job failed | ERROR | `{ service, artifact, error_message, timestamp }` |
| Biometric lock enabled/disabled | INFO | `{ service, enabled, timestamp }` |
| Biometric auth failed | WARN | `{ service, reason, timestamp }` |
| Pinning verification failure | ERROR | `{ service, host, error_message, timestamp }` |

No PII, no tokens, no secrets in logs.

---

## 9. Error Handling

| Failure | Expected behavior | Surface |
|---|---|---|
| No network + cached report exists | Show cached content with freshness timestamp | UI |
| No network + no cached content | Show honest no-data/offline guidance | UI |
| Prefetch fails | Keep prior cached artifact, log failure, show freshness age | UI + logs |
| Biometric unavailable on device | Hide lock toggle or show unsupported state | UI |
| Biometric auth repeatedly fails | Fall back to standard app unlock guidance | UI |
| Pinning mismatch | Block request, show network security error, log to telemetry | UI + logs |

---

## 10. Testing Requirements

- [ ] Airplane mode opens previously viewed Deep Dive from cache and validates LRU eviction behavior
- [ ] Airplane mode opens latest cached Morning Pulse
- [ ] Prefetch runs in the 05:30-06:30 America/New_York window and updates cache freshness
- [ ] Offline badge timestamp reflects actual cache freshness
- [ ] MITM proxy run confirms pinning blocks intercepted connection in release and debug bypass works in debug
- [ ] Release build verifies obfuscation is enabled
- [ ] Biometric lock enable/disable and unlock flows verified, including <5 minute background resume and device-credential fallback
- [ ] PostHog dashboard evidence captured for required launch events and all 3 funnels
- [ ] End-to-end physical-device smoke run passes

See detailed execution: `Project Note/Phase2/Milestones/M9/M9_SMOKE_PLAN_ph2.md`.

---

## 11. Rollback Plan

1. Disable Room-backed reads and revert to network-only fetch path.
2. Disable WorkManager prefetch registration.
3. Disable biometric lock feature flag/toggle path.
4. Revert certificate pinning config to baseline transport mode if required for emergency recovery.
5. Re-run baseline Phase 2 M8 smoke to confirm no user-path breakage.

---

## 12. Definition of Done

M9 is done only when all below are true:

- [ ] All M9 acceptance criteria in `ph2_MILESTONES.md` are satisfied
- [ ] M9 smoke plan completed with evidence
- [ ] Real-device verification completed
- [ ] Quality checks pass (`lint`, `typecheck`, relevant tests, release build)
- [ ] Linear tickets closed or explicitly deferred with owner approval
- [ ] Owner sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 13. Smoke Test Log

```text
Date:
Run by:
Environment:
Device:
Result:

Step 1 - Verify cached Deep Dive opens in airplane mode:                 ___
Step 2 - Verify cached Pulse opens in airplane mode:                     ___
Step 3 - Verify prefetch updates Morning Pulse cache:                    ___
Step 4 - Verify offline freshness badge and timestamp:                   ___
Step 5 - Verify certificate pinning blocks MITM path:                    ___
Step 6 - Verify release obfuscation output:                              ___
Step 7 - Verify biometric enable/disable and unlock behavior:            ___
Step 8 - Verify PostHog launch dashboards + funnels evidence:            ___
Step 9 - Full real-device end-to-end smoke pass:                         ___

Notes:
- 
```

---

## 14. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| TBD | Fill only if a validated blocker appears during M9 execution | TBD | TBD |

---

## 15. Decisions Made During This Milestone

| Decision | Outcome | ADR required |
|---|---|---|
| TBD | Fill during implementation | TBD |
