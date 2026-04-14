# M2 Smoke Plan (Phase 4)

**Milestone:** M2 - Inbox and Notification Ledger Backend  
**Owner:** Product API Engineer + Contracts Owner  
**Status:** Closed (PASS)

---

## Purpose

Prove that alert history is durable, typed, queryable, and compatible with existing notification settings.

---

## Locked Decision Targets

1. Alert ledger persistence owner
2. Public alert-ledger contract names
3. Exact route-target semantics in push payloads
4. Compatibility with existing notification-family preferences

---

## Preconditions

- Product API test environment is runnable
- Mock providers exist for earnings calendar and price movement paths
- Notification preference endpoints already exist from earlier phases

---

## Smoke Steps

1. Register and verify a user.
2. Register a device token and add a followed ticker.
3. Trigger earnings-preview and contrarian notification flows.
4. Confirm `/v1/user/alerts` returns durable rows.
5. Confirm category filtering narrows the alert list correctly.
6. Confirm alert feedback and mute endpoints update the stored row.
7. Confirm existing notification preferences still read and update correctly.

---

## Evidence Required For Closeout

- Product API typecheck proof
- Integration-test proof
- Migration file paths
- Contract file paths

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `apps/product-api/tests/ph4-m2-alert-ledger.test.ts` | Test creates a verified session before exercising alert flows. |
| 2 | PASS | `apps/product-api/tests/ph4-m2-alert-ledger.test.ts` | Test registers a device token and adds `AAPL` to the watchlist. |
| 3 | PASS | `apps/product-api/tests/ph4-m2-alert-ledger.test.ts` | Earnings-preview and contrarian-evaluation flows are both triggered in the suite. |
| 4 | PASS | `Project Note/Phase4/Milestones/M2/evidence/2026-04-08/m2-api-smoke-summary.json` | `GET /v1/user/alerts` returns durable alert-ledger rows. |
| 5 | PASS | `Project Note/Phase4/Milestones/M2/evidence/2026-04-08/m2-api-smoke-summary.json` | Category filter path is asserted in the integration test. |
| 6 | PASS | `Project Note/Phase4/Milestones/M2/evidence/2026-04-08/m2-api-smoke-summary.json` | Feedback and mute update the stored alert row successfully. |
| 7 | PASS | `Project Note/Phase4/Milestones/M2/evidence/2026-04-08/m2-api-smoke-summary.json` | Existing notification-preference read/write compatibility is still covered. |
