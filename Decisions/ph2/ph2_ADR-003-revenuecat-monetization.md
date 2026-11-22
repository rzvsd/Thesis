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
| G1 | RevenueCat project setup and API keys | **OPEN** (owner: configure, see below) |
| G2 | Google Play product IDs and test track | **OPEN** (owner: configure, see below) |
| G3 | Gated feature list (exact Free vs Pro boundaries) | **DECIDED** (audit roadmap item 7, see below) |
| G4 | Subscription schema design (new table vs. column on users) | **DONE** (`subscriptions` table, one row per user) |

## Implementation Status (audit roadmap item 7: billing live, new tiers, one paywall)

Model: sell monitoring, give away reading. Price: Pro $9.99/month plus a yearly plan (yearly price: owner sets it in Play).

### G3: the gated feature list (enforced in `product-api`; the app mirrors it)

| Feature | Free | Pro | Where it is enforced |
|---|---|---|---|
| Daily Market Pulse | Yes | Yes | not gated |
| Read Deep Dives that are pre-computed (covered S&P 500 names, any reusable report) | Yes, no daily limit | Yes | `POST /jobs`: a reused report never counts |
| On-demand Deep Dive generation (no reusable report) | 1 per day | No limit | `POST /jobs`, `dailyDeepDiveLimitForTier` |
| Followed names (watchlist) | 3 | 50 | `POST /watchlist`, `watchlistLimitForTier` |
| Filing-change alert | Headline (title + body) | Headline + full "what changed" (`detail_body`), push and email | alert ledger view returns `detail_locked: true` instead of `detail_body` for Free; Free email is headline only |
| Earnings War Room | No | Yes (followed names) | `GET /v1/research/war-room/{id}`, War Room push recipients |
| Scenario Stress, What-If, Opposite Case, Conviction timeline/insights | No | Yes | existing Pro checks on those routes |
| Deep Dive PDF and investment memo export | No | Yes | `GET /v1/reports/{id}/export/pdf`; the app gates its local PDF/memo/card export |

Every gate answers `403 {"error":"upgrade_required","feature":...}`. The Android app opens one paywall
screen (`ui/screens/PaywallScreen.kt`) for every such answer and from the locked alert detail in the Inbox.

### What the code does now
- Server entitlement: `REVENUECAT_ENTITLEMENT_ID` (env) names the entitlement that means Pro; `sync-tier` reads it via
  `REVENUECAT_SERVER_API_KEY`. Webhooks are authenticated with `REVENUECAT_WEBHOOK_SECRET`.
- Android: `REVENUECAT_PUBLIC_ANDROID_KEY` (Gradle property) turns billing on. Packages come from the RevenueCat
  current offering: by `REVENUECAT_MONTHLY_PRODUCT_ID` / `REVENUECAT_YEARLY_PRODUCT_ID` (Gradle properties, Play
  subscription product ID or `productId:basePlanId`) when set, else by the package type MONTHLY / ANNUAL. No store
  IDs are hard-coded.
- The free trial is not in code. It is a Play base-plan offer, so RevenueCat and the app pick it up as-is.

### What Razvan must configure (G1, G2)
1. RevenueCat project with the Android app (package `com.thesis.mobile`) linked to Play (service-account JSON).
2. Keys: public Android SDK key -> Gradle property `REVENUECAT_PUBLIC_ANDROID_KEY`; secret API key ->
   `REVENUECAT_SERVER_API_KEY`; entitlement identifier (for example `pro`) -> `REVENUECAT_ENTITLEMENT_ID`;
   webhook (URL `https://<api-host>/v1/webhooks/revenuecat`, Authorization header value) ->
   `REVENUECAT_WEBHOOK_SECRET`. The last three are product-api env vars.
3. Play Console: one subscription product with a monthly base plan ($9.99) and a yearly base plan; add the free-trial
   offer to the base plan(s) you want. Optional: put the IDs in `REVENUECAT_MONTHLY_PRODUCT_ID` /
   `REVENUECAT_YEARLY_PRODUCT_ID`.
4. RevenueCat: attach both products to the entitlement; create the current offering with a Monthly and an Annual package.
5. Prove purchase, renewal and cancel on the Play internal test track with license testers: follow
   `docs/runbooks/launch-proof.md` (added by PR #75).

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
