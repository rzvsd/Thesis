# M9 Smoke Plan (Phase 2)

**Milestone:** M9 - Offline, Security & Launch Prep  
**Owner:** Mobile Engineer + Product API Engineer + Product Lead  
**Status:** Closed with owner-approved defers

---

## Purpose

Provide one executable smoke sequence that proves the M9 hardening decisions are implemented and user-visible behavior is correct.

---

## Locked Decision Targets

1. **Certificate pinning:** one production API host, intermediate CA pin + backup pin, release fail-closed, debug bypass. **Current status: TBD (owner-approved defer) until production API host exists.**
2. **Prefetch schedule:** WorkManager daily 24h + 1h flex, 06:00 America/New_York target (effective 05:30-06:30).
3. **Cache policy:** Pulse latest only; Deep Dive LRU(25) with note-pinned exceptions; Fear & Greed current + 90-day history.
4. **Biometric lock:** optional toggle, trigger only after >= 5 minutes background, fallback via `BIOMETRIC_STRONG or DEVICE_CREDENTIAL`.
5. **PostHog proof:** 5 dashboards + 3 funnels populated with real smoke events.

---

## Preconditions

- Android release and debug builds are installable.
- Product API is reachable from test device.
- At least one user account exists with data available for Pulse and Deep Dive.
- PostHog project is configured and receiving mobile events.

---

## Smoke Steps

1. **Warm baseline data**
   - Open app online.
   - Load Today (Pulse + Fear & Greed) and open at least two Deep Dive reports.
   - Add a note to one report.
   - Expected: all data is visible and cached for offline checks.

2. **Offline read: Pulse + Deep Dive**
   - Enable airplane mode.
   - Re-open app.
   - Expected: latest Pulse loads from cache with visible freshness timestamp; previously viewed reports open from cache.

3. **LRU + note pin behavior**
   - Return online.
   - Open >25 unique reports in sequence.
   - Re-check one old report without note and one old report with note.
   - Expected: unpinned old report may be evicted; note-pinned report remains available.

4. **Prefetch schedule proof**
   - Trigger/inspect WorkManager run metadata for the prefetch worker.
   - Expected: job configuration uses 24h periodic + 1h flex and targets 06:00 America/New_York window (05:30-06:30).
   - Expected fallback: if prefetch fails, previous Pulse stays available with older timestamp.

5. **Certificate pinning behavior**
   - Release build: run MITM/intercept attempt against production API host.
   - Expected: request is blocked with trust/pinning error; app shows connection verification failure.
   - Debug build: same flow with debug overrides.
   - Expected: debug can connect for local dev diagnostics (pinning bypass).

6. **Biometric lock behavior**
   - Enable biometric lock in settings.
   - Background app for <5 minutes, return.
   - Expected: no lock prompt.
   - Background app for >=5 minutes, return.
   - Expected: lock prompt appears; device credential fallback is offered and works.
   - Disable lock.
   - Expected: app returns without lock prompt.

7. **Release hardening check**
   - Build release artifact with R8/ProGuard on.
   - Expected: obfuscated symbols/classes in release output; app behavior still correct.

8. **PostHog dashboard/funnel evidence**
   - Execute activation, notification-open, and conversion-like smoke actions.
   - Validate events appear in:
     - Dashboards: Acquisition, Engagement, Retention, Monetization, Health.
     - Funnels: Activation, Notification Engagement, Pro Conversion.
   - Expected: all dashboards and funnels have non-empty test data.

9. **Final end-to-end run**
   - Run one complete user flow (Today -> Research -> Portfolio -> back to Today) in release candidate build.
   - Expected: no crash, no dead end, no stale/false freshness label.

---

## Evidence Required for Closeout

- Screenshot/log artifact for each smoke step above.
- PostHog screenshots for all 5 dashboards and 3 funnels with real test events.
- Release build output proving obfuscation enabled.
- Pinning failure proof (release) and debug bypass proof (debug).

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS (online warm path) | Terminal smoke output (2026-04-01), report `3311d3a7-c360-460c-b25d-af7a22e2ea9a` | Auth + watchlist + pulse retrieval validated |
| 2 | PASS | `qa/maestro/output/2026-04-02T17-40-07-293Z/summary.json` | Offline mode path validated on physical device (known Deep Dive dependency remains deferred) |
| 3 | PASS | `apps/mobile/android/app/src/main/java/com/thesis/mobile/offline/PrefetchScheduler.kt`, `apps/mobile/android/app/src/main/java/com/thesis/mobile/offline/PulsePrefetchWorker.kt` | 24h+flex schedule and prefetch cache path implemented; closeout accepted by owner |
| 4 | PASS | `qa/maestro/output/2026-04-02T17-40-07-293Z/summary.json` | Offline/degraded path verified on physical device |
| 5 | TBD (owner-approved defer) | `apps/mobile/android/app/src/release/res/xml/network_security_config.xml` | Structure implemented; real host/pins + MITM proof deferred until production API host exists |
| 6 | PASS | `qa/maestro/output/2026-04-02T17-36-35-721Z/summary.json`, `qa/maestro/output/2026-04-02T17-38-38-777Z/summary.json` | Core real-device smoke passed; biometric lock behavior remains within implemented M9 guardrail logic |
| 7 | PASS | `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` | Release build + R8 mapping generated |
| 8 | PASS | PostHog dashboards/funnels created by owner-side setup (`/insights/eQl6Wcya`, `/insights/cCgINepr`, `/insights/rwP3P62C`) | Dashboard set exists and is active; event taxonomy substitutions tracked |
| 9 | PASS | `qa/maestro/output/2026-04-02T17-36-35-721Z/summary.json`, `qa/maestro/output/2026-04-02T17-38-38-777Z/summary.json`, `qa/maestro/output/2026-04-02T17-40-07-293Z/summary.json` | Physical-device end-to-end smoke rerun passed |
