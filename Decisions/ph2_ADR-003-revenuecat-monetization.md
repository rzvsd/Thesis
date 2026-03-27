# ph2_ADR-003: Subscription Middleware Strategy

## Status
Accepted

## Context
Phase 2 (M4) introduces paywalls. The product must support a Free tier and a Pro tier ($9.99/mo). Handling raw billing integrations (Google Play Billing for Android, Stripe for Web/Email) requires substantial engineering overhead for receipt validation, subscription state syncing, trial management, and cross-platform entitlement logic.

## Decision
We will use **RevenueCat** as the single source of truth for subscription state and entitlement management.
- The Android client will use the RevenueCat SDK to handle the purchase UX and Google Play communication.
- RevenueCat servers will fire secure webhooks to `product-api` when a subscription is purchased, renewed, canceled, or expired.
- `product-api` will maintain a durable `tier: FREE | PRO` state in Postgres (schema design is an open sub-decision — see below).
- Access to premium endpoints (export, scenarios, unlimited Deep Dives) will be blocked at the `product-api` router level by a custom middleware that checks the Postgres user tier.
- A fallback `POST /v1/user/sync-tier` endpoint will allow the mobile app to trigger a server-side verification pull from RevenueCat, recovering from webhook failures without requiring the user to "Restore Purchases" manually.
- `GET /v1/user/profile` will expose the effective tier, limits, and billing period end to the mobile app.

## Open Sub-Decisions

These are tracked as Gated Pre-Conditions in `M4_MILESTONE_AGENTS_ph2.md`.

| # | Decision | Status |
|---|---|---|
| G1 | RevenueCat project setup and API keys | **OPEN** |
| G2 | Google Play product IDs and test track | **OPEN** |
| G3 | Gated feature list (exact Free vs Pro boundaries) | **OPEN** |
| G4 | Subscription schema design (new table vs. column on users) | **OPEN** |

## Consequences
**Positive:**
- Massively reduces time-to-market for the payment gateway.
- RevenueCat abstracts all the complexity of Google Play receipt verification.
- Makes the transition to an eventual iOS app seamless, as Apple subscriptions will merge into the same RevenueCat user ID.
- Sync-tier fallback ensures webhook failures don't permanently block users from their paid tier.

**Negative:**
- Vendor lock-in to RevenueCat.
- RevenueCat takes a small percentage fee (usually <1%) of tracked revenue.
- If the webhook delivery fails and the user does not open the app (triggering sync-tier), there is a delay before Pro access is granted.

## Revisit Condition

Re-evaluate this ADR if:
- RevenueCat pricing changes significantly
- Direct Google Play Billing API becomes simpler to implement
- iOS launch requires a different subscription architecture
- Revenue exceeds $2,500 MTR and RevenueCat fees become material
