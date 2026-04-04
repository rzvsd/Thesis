# M3 Smoke Plan (Phase 3)

**Milestone:** M3 - Monetization, Growth Instrumentation and Feedback  
**Owner:** Product Lead + Product API Engineer + Mobile Engineer + Analytics Owner  
**Status:** Complete (Owner-approved TBD remains on Steps 3-4)

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
- Live staging purchase/restore smoke is explicitly deferred as Owner-approved TBD.

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_summary.json` | FREE user hit premium boundary with `feature=watchlist_cap` (`403 upgrade_required`) |
| 2 | PASS | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_paywall_screenshot.png` | Paywall rendered with premium value framing and monthly/yearly options |
| 3 | TBD (Deferred) |  | Owner-approved defer for this cycle |
| 4 | TBD (Deferred) |  | Owner-approved defer for this cycle |
| 5 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_smoke.json` | Report feedback submitted and accepted (`queued_for_review`) |
| 6 | PASS | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_manual_feedback_verify.json` | Cancel/downgrade feedback path submitted; win-back prompt behavior observed as expected |
| 7 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_smoke.json` | Both report + subscription rows persisted with expected metadata, triage and route statuses |
| 8 | PASS | `Project Note/Phase3/Milestones/M3/M3_EVENT_SEMANTICS_ph3.md` | Event semantics and required properties are locked and validated against instrumentation paths |
| 9 | PASS (Owner-approved) | `artifacts/ph3/m3/2026-04-04T20-48-26/m3_closeout_note.md` | Owner approved PostHog dashboard/funnel validation for this cycle |
| 10 | PASS | `artifacts/ph3/m3/2026-04-04T17-49-00/m3_auth_profile_regression.json` | Auth/profile/entitlement regression checks passed (with sync-tier remaining env-dependent) |
