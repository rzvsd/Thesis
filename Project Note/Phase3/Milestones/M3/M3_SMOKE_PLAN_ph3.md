# M3 Smoke Plan (Phase 3)

**Milestone:** M3 - Monetization, Growth Instrumentation and Feedback  
**Owner:** Product Lead + Product API Engineer + Mobile Engineer + Analytics Owner  
**Status:** Planned

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
