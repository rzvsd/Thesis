# AGENTS.md - M7 Android MVP
**Milestone:** M7 - Android MVP  
**Inherits from:** Root `AGENTS.md` - read that first.  
**Location:** `Milestones/M7/M7_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M7 - Android MVP |
| **Linear Project** | M7 - Android MVP |
| **Owner** | Mobile Engineer + Product Lead |
| **Status** | Closed with owner-approved M8 carry-over (updated 2026-03-23) |
| **Depends on** | M6 complete; ADR-003 accepted; minimum Android version documented (API 26); FCM configured; PostHog mobile project configured; legal disclaimer approved |

---

## 1. What This Milestone Is Building

M7 delivers the first real Android product experience for both user-facing surfaces: Company Deep Dive and Market Pulse. A new user can install the app on a physical Android device, register/login, request and read Deep Dive reports, open Market Pulse briefings, and manage watchlist entries without engineering assistance.

The milestone is complete only when UX states are production-honest: progress states exist, failure states are explicit, connectivity loss is handled, and no smoke-path step crashes the app. M7 also establishes product observability from the mobile side through PostHog events and at least one PostHog feature flag.

**Plain English summary for non-technical audit:**  
M7 puts the product in a real user's hand and proves they can use it end-to-end on Android.

---

## 2. Scope - What Is In

The following and only the following is in scope for M7:

- [x] App installs and launches on a physical Android device running minimum supported OS (API 26)
- [x] New user can register, verify email, and reach home screen without assistance
- [x] Login, logout, and silent token refresh all work on device
- [x] Ticker search returns results and Deep Dive request works end-to-end
- [x] Progress screen is shown during report generation (no blank loading state)
- [ ] Deep Dive report renders all sections, evidence references, confidence score, and signal
- [x] Tapping an evidence reference opens source URL in browser
- [x] Market Pulse home screen shows latest briefing on app open
- [x] Push notification arrives when new briefing is ready
- [x] Tapping push notification opens the briefing correctly
- [x] Watchlist add/view/remove works correctly from mobile
- [x] Settings screen supports notifications on/off and Android notification-settings link behavior
- [x] Deep Dive failure state shows clear error + retry action (no blank screen, no crash)
- [x] Offline state shows connectivity message (no crash)
- [x] App is crash-free on all smoke-test paths
- [x] PostHog receives key events: registration, login, Deep Dive requested, Deep Dive viewed, Pulse viewed
- [x] At least one feature is gated by a PostHog feature flag

Full deliverables and acceptance criteria: `MILESTONES.md -> M7`

---

## 3. Scope - What Is Out

Do not touch the following during M7. Raise a Linear ticket and flag it if you believe something needs to change - do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| iOS app implementation | Product is Android-first in v1 (ADR-003) |
| Web client implementation | Not part of milestone sequence |
| Monetization, billing, plan enforcement, quotas | Product question still open in PRD; not required to complete M7 acceptance |
| Per-user Market Pulse scheduler behavior in backend | Scheduler is already owned by M6 and remains fixed-time |
| User-selectable Market Pulse delivery time | v1 is fixed at `06:30 America/New_York` wall-clock time (DST-aware), fixed for all users |
| Multi-device push token model | v1 uses single durable token on `users.device_token` |
| Deep changes to Dexter/OpenBB/news-ingest pipelines | M7 consumes existing surfaces; data-plane ownership is in prior milestones |
| Re-architecture of Product API auth model | M4 auth contract is already established and must be consumed, not replaced |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Mobile app | `apps/mobile/` | Build Android user flows: auth, Deep Dive request/progress/report, Pulse home/history, watchlist, settings, error/empty states |
| Product API integration layer | `apps/product-api/` | Only endpoint/support updates required for mobile acceptance and parity (no architectural rework) |
| Contracts | `packages/contracts/` | Consume typed API contracts from mobile; only versioned updates if a proven gap blocks acceptance |
| Observability | `packages/observability/` and mobile analytics wiring | Ensure PostHog event emission and feature flag integration are visible and testable |
| Integration tests | `tests/integration/` | Add mobile-facing API and lifecycle coverage where automation is feasible |

**M7 architecture rule:** Mobile calls Product API only. Mobile never calls OpenBB, news-ingest, or Dexter directly.  
**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

M7 primarily consumes existing contracts from prior milestones. Treat them as read-only unless an implementation gap blocks acceptance and a versioned change is explicitly approved.

| Contract | Change type | File path |
|---|---|---|
| `AuthRegisterRequest` | Read-only consumer | `packages/contracts/src/auth-register-request.ts` |
| `AuthLoginRequest` | Read-only consumer | `packages/contracts/src/auth-login-request.ts` |
| `AuthRefreshRequest` | Read-only consumer | `packages/contracts/src/auth-refresh-request.ts` |
| `AuthTokensResponse` | Read-only consumer | `packages/contracts/src/auth-tokens-response.ts` |
| `TickerSearchResult` | Read-only consumer | `packages/contracts/src/ticker-search-result.ts` |
| `CreateJobRequest` | Read-only consumer | `packages/contracts/src/create-job-request.ts` |
| `JobStatusResponse` | Read-only consumer | `packages/contracts/src/job-status-response.ts` |
| `AnalysisReport` | Read-only consumer | `packages/contracts/src/analysis-report.ts` |
| `ReportSection` | Read-only consumer | `packages/contracts/src/report-section.ts` |
| `EvidenceItem` | Read-only consumer | `packages/contracts/src/evidence-item.ts` |
| `ReportListItem` | Read-only consumer | `packages/contracts/src/report-list-item.ts` |
| `MarketPulseReport` | Read-only consumer | `packages/contracts/src/market-pulse-report.ts` |
| `ServiceResponse` | Read-only consumer | `packages/contracts/src/service-response.ts` |

**Rules:**
- Do not invent mobile-only JSON shapes that bypass `packages/contracts`
- If a contract must change, version it first and prove all consumers compile
- Preserve evidence and disclaimer surfaces exactly as defined in PRD and BLUEBOOK

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M7 - Android MVP

**Ticket naming:**
```
[M7] What is being built
[M7][BUG] What is broken
[M7][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[M7] Android install and launch` | App installs and launches on physical Android device |
| `[M7] On-device registration and verification` | New user can register, verify email, and reach home screen |
| `[M7] On-device auth lifecycle` | Login, logout, and silent token refresh work correctly |
| `[M7] Ticker search and Deep Dive request` | Search + request flow works end-to-end |
| `[M7] Deep Dive progress UX` | Progress screen shown during generation |
| `[M7] Deep Dive report rendering` | All report sections, confidence, signal, and evidence render |
| `[M7] Evidence link handoff` | Evidence tap opens source URL in browser |
| `[M7] Pulse home render` | Latest Market Pulse shows on app open |
| `[M7] Push receive + open behavior` | Push arrives and opens correct briefing |
| `[M7] Watchlist mobile CRUD` | Add/view/remove watchlist works correctly |
| `[M7] Settings notification controls` | Notifications on/off and Android notification-settings link work correctly |
| `[M7] Deep Dive failure UX` | Clear error + retry, no blank screen/crash |
| `[M7] Offline UX` | Connectivity message shown with no crash |
| `[M7] Crash-free smoke path` | No crashes on smoke steps |
| `[M7] PostHog core event emission` | Required events appear in PostHog |
| `[M7] PostHog feature flag gating` | Feature flag hides/shows designated feature |
| `[M7] M7 smoke closeout` | Full smoke checklist completed and logged |

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `MILESTONES.md` it satisfies
- Link to this file

**Required on every bug ticket:**
- Steps to reproduce (exact device actions and build version)
- Expected vs actual behavior
- Screen/service where failure happened
- Logcat snippet and/or Sentry link
- Severity: `P1 - Blocker` / `P2 - High` / `P3 - Normal`

**Never close a ticket without** passing test evidence and relevant smoke-step proof.

---

## 7. Logging for This Milestone

M7 must make mobile behavior observable without logging secrets or PII.

| Event | Level | Fields |
|---|---|---|
| App launched | INFO | `{ level, service:"mobile-app", message, app_version, device_os, timestamp }` |
| Auth login succeeded/failed | INFO/ERROR | `{ level, service:"mobile-app", message, route, status_code, timestamp }` |
| Deep Dive request submitted | INFO | `{ level, service:"mobile-app", message, ticker, job_id?, timestamp }` |
| Deep Dive render completed | INFO | `{ level, service:"mobile-app", message, report_id, ticker, timestamp }` |
| Pulse opened | INFO | `{ level, service:"mobile-app", message, pulse_date, timestamp }` |
| Push received/opened | INFO | `{ level, service:"mobile-app", message, notification_id, timestamp }` |
| Offline request blocked | WARN | `{ level, service:"mobile-app", message, route, timestamp }` |
| App crash/unhandled exception | ERROR | `{ level, service:"mobile-app", message, stack_hash, timestamp }` |

Format: `{ level, service, message, job_id?, timestamp }` - no exceptions.  
Never log access tokens, refresh tokens, passwords, email verification tokens, or PII.
Local credential files used for M7 validation (for example `secrets/firebase-admin.json`) are local-only, must remain gitignored, and must never be committed or pushed to GitHub.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Login/register request fails | Show clear user message and keep user in valid state (no crash) | UI + mobile logs + Sentry |
| Token refresh fails | Force clean logout and return to auth screen | UI + mobile logs |
| Deep Dive request fails | Show explicit failure message with retry action | UI + mobile logs + Sentry |
| Deep Dive loads slowly | Show progress state; never show blank screen | UI |
| Device offline | Show connectivity message; queue no invalid request | UI + mobile logs |
| Push received but deep link fails | Open app safely to fallback Pulse screen and log warning | UI + mobile logs + Sentry |
| PostHog unavailable | App behavior remains functional; analytics failure is non-blocking | mobile logs |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

M7 testing must prove real device usability, not only API connectivity.

- [ ] Unit tests for auth/session manager logic (token storage, refresh, logout behavior)
- [ ] Unit tests for API client error mapping and retry-safe flows
- [ ] Unit tests for report/pulse rendering state models
- [ ] Instrumented/UI test for register -> verify -> login -> home
- [x] Instrumented/UI test for Deep Dive search -> request -> progress -> report render
- [ ] Instrumented/UI test for watchlist add/remove
- [ ] Instrumented/UI test for offline error state and retry recovery
- [ ] Integration test for mobile-authenticated report history retrieval
- [ ] Integration test for push payload open routing
- [x] Manual smoke test on physical Android device exactly as defined in `MILESTONES.md -> M7`
- [x] PostHog verification test for required events and feature flag gating
- [x] Crash-free verification across all smoke paths

Test files live in: `apps/mobile/tests/`  
Cross-service tests live in: `tests/integration/`  
Golden fixtures are not required unless a data-plane contract is changed.

CI must pass before any PR merges.

## 9A. M7+ E2E Automation Scope (Maestro Only)

M7+ automation is intentionally narrow and acceptance-focused.

- Use **Maestro only** for mobile smoke automation in this phase
- Do **not** introduce Appium in M7+
- Do **not** build a broad test framework; automate only M7 smoke-critical flows
- Store flows and outputs in `qa/maestro/` (preferred) so evidence is centralized and easy to audit
- Keep execution simple: one setup command and one smoke command (wrapper scripts in package scripts are required)

Target operator flow for M7+ closeout:

1. `pnpm qa:maestro:prepare`
2. `pnpm qa:maestro:smoke`

---

## 10. Definition of Done

M7 is not done until every item below is checked:

- [ ] All 17 acceptance criteria in `MILESTONES.md -> M7` are satisfied
- [x] Smoke test executed in full on a physical Android device - results documented in Section 11
- [ ] All automated tests passing in CI
- [x] All M7 Linear tickets are closed or explicitly deferred
- [x] Deferred items logged as new Linear tickets mapped to next milestone
- [ ] Rollback procedure confirmed (previous APK distribution path validated)
- [x] PostHog events verified in dashboard for required user actions
- [x] Feature flag gating verified in app behavior
- [x] Owner signs off
- [x] Engineering Lead countersigns

**A successful demo is not done. A merged branch is not done. This checklist complete is done.**

Sign-off recorded on 2026-03-23 by project owner (Rzv_sd), with approval to close M7 closeout items on their behalf.

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md -> M7` exactly as written. Record results here.

```text
Date: 2026-03-22
Run by: Codex + Rzv_sd
Environment: physical Android device (SM-S928B, Android 16), local docker stack
Result: PASS with one owner-approved deferral to M8 (`RZV-113`)

Evidence artifacts:
  - Root quality checks:
    - corepack pnpm lint -> PASS
    - corepack pnpm typecheck -> PASS
    - corepack pnpm test -> PASS (rerun 2026-03-23 after fixing M6 integration date-collision test isolation)
  - Maestro prepare:
    - prepare command PASS, device install PASS, adb reverse applied
  - Passing Maestro flows:
    - qa/maestro/output/2026-03-22T20-32-44-883Z/summary.json (m7_home_pulse_on_open.yaml)
    - qa/maestro/output/2026-03-22T20-33-42-498Z/summary.json (m7_assert_pulse_screen.yaml)
    - qa/maestro/output/2026-03-22T20-34-08-714Z/summary.json (m7_notification_settings_link.yaml)
    - qa/maestro/output/2026-03-22T20-35-10-312Z/summary.json (m7_offline_connectivity.yaml)
    - qa/maestro/output/2026-03-22T20-38-56-454Z/summary.json (m7_search_run_deepdive.yaml)
    - qa/maestro/output/2026-03-22T20-40-09-400Z/summary.json (m7_evidence_link.yaml)
    - qa/maestro/output/2026-03-22T20-55-38-375Z/summary.json (m7_register_verify_login.yaml, stabilized)
    - qa/maestro/output/2026-03-22T21-01-12-420Z/summary.json (m7_deepdive_failure.yaml, deterministic failure+retry)
    - qa/maestro/output/2026-03-22T21-07-59-120Z/summary.json (m7_smoke.yaml, full pass)
    - qa/maestro/output/2026-03-22T21-09-28-016Z/summary.json (m7_auth_invalid_login.yaml, auth error visibility)
    - qa/maestro/output/2026-03-22T21-16-02-007Z/summary.json (fresh closeout rerun)
    - qa/maestro/output/2026-03-22T21-38-15-626Z/summary.json (full smoke pass with PostHog enabled)
    - qa/maestro/output/2026-03-22T21-43-30-280Z/summary.json (explicit Deep Dive request path for PostHog)
    - qa/maestro/output/2026-03-22T21-53-03-207Z/summary.json (deterministic silent-refresh proof under short TTL)
  - Real push evidence:
    - docker compose logs product-api include provider=fcm attempted=1 delivered=1 failed=0
    - user confirmed receipt + tap-through opens app
  - 2026-03-23 closeout re-verification:
    - corepack pnpm lint -> PASS
    - corepack pnpm typecheck -> PASS
    - corepack pnpm test -> PASS
    - latest attempted Deep Dive full-render Maestro proofs remain red:
      - qa/maestro/output/2026-03-22T21-54-47-127Z/summary.json
      - qa/maestro/output/2026-03-22T21-57-40-356Z/summary.json
    - those failures stay explicitly deferred to M8 via RZV-113; they are not counted as fresh M7 regressions

Historical red checks from early cycle are resolved and replaced by the green artifacts listed above.
```

Open closeout items before marking M7 done:
- No new engineering blockers remain for branch validation. Strict doctrine closeout still differs from literal "all 17 criteria complete" because Deep Dive full-render proof is owner-approved carry-over `RZV-113` for M8, and GitHub CI / rollback proof remain separate formal gates.

---

## 12. Decisions Made During This Milestone

Log any product or architecture decisions made during M7. Significant decisions require an ADR.

| Decision | What was decided | ADR required? |
|---|---|---|
| Mobile platform baseline | Kotlin Native Android for v1 (ADR-003) | No - already accepted |
| Minimum Android version | Android 8.0 (API 26) baseline | No - already in ADR-003/PRD |
| Push token model | v1 uses single durable `users.device_token` from Product API | No - already established in M6 doctrine |
| Mobile boundary | Mobile uses Product API only; no direct calls to data plane services | No - already in BLUEBOOK |
| Transitional shim policy | `apps/mobile` Node health shim is temporary for baseline compatibility during implementation; real M7 source of truth is Kotlin Android app and shim is removed or relocated after M7 stabilization | No - implementation decision within existing doctrine |

---

## 13. Known Issues and Deferrals

Log anything discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| iOS app implementation | Android-first scope for v1 | - | Post-launch |
| Billing/pricing enforcement in app | PRD open question; not required for M7 acceptance | - | Future monetization milestone |
| Plan-based Deep Dive quotas | PRD open question; policy not finalized | - | Future monetization milestone |
| User-selectable notification time | v1 remains fixed at `06:30 America/New_York` wall-clock time (DST-aware), fixed for all users | - | Later milestone |
| Multi-device push token management | v1 single-token model is intentional | - | Post-launch |
| Deep Dive full report rendering proof moved to M8 | Owner-approved deferral during M7 closeout; full deterministic render-proof hardening is tracked in M8 backlog | RZV-113 | M8 |
