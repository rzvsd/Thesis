# M3 Smoke Plan (Phase 3)

**Milestone:** M3 - Monetization, Growth Instrumentation and Feedback  
**Owner:** Product Lead + Product API Engineer + Mobile Engineer + Analytics Owner  
**Status:** Complete

---

## Purpose

Prove that premium value is understandable, conversion paths are instrumented, and feedback loops are operational.

---

## Locked Decision Targets

1. Free vs Pro product boundary
2. Growth event taxonomy and required properties
3. Feedback taxonomy
4. Experiment scope
5. Product API-owned `user_feedback_queue` sink

---

## Preconditions

- Existing entitlement flow works in staging
- Analytics project is configured and accessible
- Feedback endpoints and UI paths are available

---

## Smoke Steps

1. Hit a premium boundary as a free user.
2. Verify paywall messaging explains premium value.
3. Run staging upgrade flow and verify server truth.
4. Run restore flow and verify server truth.
5. Submit report feedback.
6. Submit cancel or downgrade feedback.
7. Confirm both submissions land in `user_feedback_queue` with expected routing metadata.
8. Validate required events appear with expected properties.
9. Validate dashboards and funnels populate from smoke events.
10. Re-run auth/profile/entitlement regression smoke.

---

## Evidence Required For Closeout

- Paywall screenshots
- Staging purchase/restore evidence
- Feedback submission evidence
- Queue persistence evidence
- Dashboard/funnel screenshots or links
- Regression smoke artifact paths

---

## Current Execution Notes

- Automated backend proof completed:
  - `corepack pnpm --filter @thesis/product-api typecheck`
  - `corepack pnpm --filter @thesis/product-api test`
  - Coverage includes `apps/product-api/tests/m3-feedback.test.ts`
- Mobile compile proof completed:
  - `JAVA_HOME=\"C:\\Program Files\\Android\\Android Studio\\jbr\" .\\gradlew.bat :app:compileDebugKotlin`
- Device-side paywall + feedback flow was validated on a physical Android phone with seeded FREE-tier boundary conditions.
- PostHog dashboard/funnel validation is owner-approved for this cycle.
- 2026-04-16 re-check: strict staging purchase/restore closeout was initially blocked by a blank Android `REVENUECAT_PUBLIC_ANDROID_KEY` and a sideloaded phone install. The Android key is now configured and Android debug Kotlin compile passed.
- 2026-04-17 identity normalization: Android package identity is now standardized on `com.thesis.mobile`; legacy `com.voltfinance.voltapp` override logic has been removed from active build configuration and is kept only as historical evidence context.
- 2026-04-16 closeout run: staging upgrade and restore server truth were validated via Product API RevenueCat webhook contract for a fresh FREE user (`INITIAL_PURCHASE` -> `PRO`, `EXPIRATION` -> `FREE`, `UNCANCELLATION` -> `PRO`). Evidence: `Project Note/Phase3/Milestones/M3/evidence/2026-04-16/m3-staging-upgrade-restore-validation.json`.
- 2026-04-16 physical-device paywall evidence captured in logged-in app state (`Upgrade to Pro`, `Monthly`, `Yearly`, `Restore`) under `Project Note/Phase3/Milestones/M3/evidence/2026-04-16/`.
- 2026-04-17 canonical-package push proof completed on a physical Android phone: a freshly logged-in `com.thesis.mobile` build received a live weekly-digest FCM notification after device-token sync and webhook-driven `PRO` upgrade. Evidence: `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_push_dispatch.json`, `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_push_profile_after_upgrade.json`, `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_push_notification_ui.xml`, `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_push_notification_shade.png`, and `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_push_notification_dumpsys.txt`.
- 2026-04-17 optional paywall replay on `com.thesis.mobile` showed `Monthly` and `Yearly` still disabled after `Refresh offers`; logcat confirms RevenueCat offerings are empty because Play Store products are not registered in the RevenueCat dashboard. Evidence: `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3-checkout-maestro-output/screenshots/ph3_m3_closeout_paywall_ready.png`, `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3-checkout-maestro-output/screenshots/ph3_m3_closeout_after_monthly_tap.png`, and `Project Note/Phase3/Milestones/M3/evidence/2026-04-17/m3_checkout_revenuecat_logcat.txt`.

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_summary.json` | FREE user hit premium boundary with `feature=watchlist_cap` (`403 upgrade_required`) |
| 2 | PASS | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_paywall_screenshot.png` | Paywall rendered with premium value framing and monthly/yearly options |
| 3 | PASS | `Project Note/Phase3/Milestones/M3/evidence/2026-04-16/m3-staging-upgrade-restore-validation.json` | Server-authoritative upgrade path validated (`FREE` -> `PRO`) using RevenueCat webhook contract with entitlement-limits proof |
| 4 | PASS | `Project Note/Phase3/Milestones/M3/evidence/2026-04-16/m3-staging-upgrade-restore-validation.json` | Restore path validated after expiry transition (`PRO` -> `FREE` -> `PRO`) with billing period end and limits restored |
| 5 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_smoke.json` | Report feedback submitted and accepted (`queued_for_review`) |
| 6 | PASS | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_manual_feedback_verify.json` | Cancel/downgrade feedback path submitted; win-back prompt behavior observed as expected |
| 7 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_smoke.json` | Both report + subscription rows persisted with expected metadata, triage and route statuses |
| 8 | PASS | `Project Note/Phase3/Milestones/M3/M3_EVENT_SEMANTICS_ph3.md` | Event semantics and required properties are locked and validated against instrumentation paths |
| 9 | PASS (Owner-approved) | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_closeout_note.md` | Owner approved PostHog dashboard/funnel validation for this cycle |
| 10 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_auth_profile_regression.json` | Auth/profile/entitlement regression checks passed; 2026-04-17 canonical push replay added fresh device-side confirmation |
