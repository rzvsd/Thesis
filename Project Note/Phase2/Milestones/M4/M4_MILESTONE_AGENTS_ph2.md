# AGENTS.md — Phase 2 M4 Monetization & Subscription
**Milestone:** Phase 2 M4 — Monetization & Subscription  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M4/M4_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M4 — Monetization & Subscription |
| **Linear Project** | Phase 2 M4 — Monetization & Subscription |
| **Owner** | Product API Engineer + Mobile Engineer + Product Lead |
| **Status** | Closed (PASS; owner accepted live Google Play verification as non-blocking external follow-up on 2026-04-16) |
| **Depends on** | Phase 1 M9 closed; Google Play Developer account configured; RevenueCat account created and API keys provisioned |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **RevenueCat project and API keys.** RevenueCat project created, Android app registered, public SDK key and webhook signing secret provisioned. Webhook URL agreed (e.g., `https://<domain>/v1/webhooks/revenuecat`). | **RESOLVED** | Product Lead + DevOps | Before M4 kickoff |
| G2 | **Google Play product IDs.** Subscription product ID(s) configured in Google Play Console (e.g., `pro_monthly_999`). Test track configured for internal testing. | **BLOCKED (External Google verification)** | Product Lead + Mobile Engineer | Before M4 kickoff |
| G3 | **Gated feature list.** Exact list of features blocked for Free users vs. available for Pro. PRD §2.1 defines the outline, but specifics like daily Deep Dive limits (1/day Free), watchlist cap (5 Free / 20 Pro), and which export types are Pro-only must be confirmed. | **RESOLVED** | Product Lead | Before M4 kickoff |
| G4 | **Subscription schema design.** Where does tier truth live? Options: (a) new `subscriptions` table, (b) `tier` column on existing `users` table. Must be decided before migration is written. This is a real schema change — see `ph2_AGENTS.md` High-Risk Rule for M4. | **RESOLVED** | Product API Engineer + Product Lead | Before M4 kickoff |

**Rule:** Do not begin coding with placeholder product IDs, ad-hoc gating logic, or assumptions about the subscription schema. The webhook handler, middleware gating, mobile purchase flow, and smoke tests all depend on concrete answers.

**Current resolution status (2026-03-28):**

- G1 resolved by owner confirmation.
- G3 resolved by owner confirmation.
- G4 resolved by owner confirmation (`subscriptions` table path implemented).
- G2 explicitly deferred by owner until end-of-milestone integration pass.

---

## 1. What This Milestone Is Building

The payment infrastructure that enforces Free/Pro tiering across the entire product. At the end of this milestone, a new user starts as Free (1 Deep Dive/day, 5 watchlist names, no exports). A Free user who hits a gated feature sees a paywall with a clear upgrade path via Google Play. After upgrading, the server durably stores their Pro tier via RevenueCat webhook, and all gated features unlock immediately. Cancellation downgrades access at the end of the billing period. The server is the single source of truth — mobile SDK state is never the final authority.

This milestone modifies the `product-api` auth/middleware layer and the mobile app. It must not break the working Phase 1 auth flows (register, verify, login, refresh, logout), watchlist CRUD, Pulse retrieval, push token registration, or report history.

**Plain English summary for non-technical audit:**  
Before M4, every user has full access to everything. After M4, there are Free and Pro tiers with real payment processing, and the server — not the phone — decides who gets what.

---

## 2. Read These Files First

### Phase 1 docs (still govern existing auth architecture)

- `Project Note/Phase1/BLUEBOOK cld.md` — auth model, session management, user schema
- `Project Note/Phase1/MILESTONES.md` — Phase 1 M4 (Auth & Jobs) and M7/M8 (Mobile) as regression baseline
- `Project Note/Phase1/PRD.md` — existing user flows that must survive

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — High-Risk Rule for M4 (server truth, not mobile-first)
- `Project Note/Phase2/ph2_BLUEBOOK.md` — §4 Monetization Integration Strategy, §7 M4 Guardrail
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M4 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — §2.1 Subscription Tiers, §3 Business Rules (paywall rigidity)
- `Decisions/ph2_ADR-003-revenuecat-monetization.md` — RevenueCat decision

### Current code surfaces you must understand before touching

- `apps/product-api/src/server.ts` — existing routes and middleware
- `apps/product-api/src/types.ts` — request/session types
- `apps/product-api/src/store.ts` — Postgres query layer (user CRUD, session queries)
- `apps/product-api/src/config.ts` — environment config
- `apps/product-api/src/migrations.ts` — migration registration
- `infra/migrations/m4_001_auth_jobs.up.sql` — existing Phase 1 auth/jobs migration
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt` — API client
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt` — session state
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/data/SessionStore.kt` — local session persistence

---

## 3. Scope — What Is In

The following and only the following is in scope for Phase 2 M4:

- [x] **Subscription schema migration:** New table or column storing `tier` (`FREE` | `PRO`), `revenuecat_app_user_id`, `billing_period_end`, and `updated_at` — per G4 decision
- [x] **Migration** `infra/migrations/ph2m4_009_subscriptions.up.sql` and `.down.sql` registered in `migrations.ts`
- [x] **RevenueCat webhook endpoint:** `POST /v1/webhooks/revenuecat` in `product-api` — validates webhook signature, extracts event type (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`), and updates the user's tier in Postgres
- [x] **Server profile read model:** `GET /v1/user/profile` returning `{ tier: "FREE" | "PRO", billing_period_end?: string }` — authenticated endpoint
- [x] **Tier-recovery sync endpoint:** `POST /v1/user/sync-tier` — accepts RevenueCat App User ID, queries RevenueCat server API to verify entitlement, and updates Postgres if mismatch. Fallback for webhook failure.
- [x] **Middleware gating:** `product-api` middleware that checks user tier from Postgres before allowing access to gated endpoints. Free users get HTTP 403 with `{ error: "upgrade_required", feature: "<feature_name>" }` on gated actions.
- [x] **Deep Dive daily limit enforcement:** Free users limited to 1 Deep Dive per calendar day (America/New_York). Server tracks daily count in Postgres or Redis. Limit resets at midnight ET.
- [x] **Watchlist cap enforcement:** Free users capped at 5 watchlist names; Pro at 20. Server enforces on add.
- [x] **Mobile RevenueCat SDK integration:** Initialize RevenueCat SDK with public key; handle purchase flow via Google Play; call `GET /v1/user/profile` after purchase to confirm tier.
- [x] **Paywall screen:** Displayed when Free user hits a gated feature. Shows feature comparison (Free vs Pro), price, and Google Play purchase button.
- [x] **Subscription management UI:** Settings screen shows current tier, billing period end, and "Manage Subscription" link (opens Google Play subscription management).
- [x] **Cancellation/downgrade handling:** When RevenueCat fires `CANCELLATION` or `EXPIRATION`, server sets tier to `FREE` and clears billing period end. Access continues until `billing_period_end`.
- [x] **Phase 1 regression:** Register → verify → login → refresh → logout still work. Pulse, watchlist CRUD, push token registration, and report history still function.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M4`

---

## 4. Scope — What Is Out

| Out of scope | Reason |
|---|---|
| iOS billing flow | Android-first product |
| Rewriting the existing auth model from scratch | M4 extends it with tier; does not replace it |
| Web/Stripe billing | Not in Phase 2 scope |
| Trial period logic | Not in PRD for Phase 2 launch |
| Promotional pricing or coupons | Post-launch |
| Export artifact generation (PDF, Share Card, Memo) | M7 — M4 only gates access; M7 builds the feature |
| What-If scenario flow implementation | M7 — M4 only gates access |
| Fear & Greed access restriction | Fear & Greed is free for all users per PRD §2.4 |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Product API | `apps/product-api/src/` | Add webhook handler, profile endpoint, sync-tier endpoint, gating middleware, daily limit tracker, watchlist cap enforcement |
| Infra | `infra/migrations/` | Add `ph2m4_007_subscriptions.{up,down}.sql` |
| Contracts | `packages/contracts/src/` | Add `subscription-tier.ts` (enum + profile response schema) if needed |
| Mobile app | `apps/mobile/` | Add RevenueCat SDK initialization, paywall screen, subscription management UI, profile refresh after purchase |

**M4 architecture rule:** Server truth owns entitlement. The mobile RevenueCat SDK initiates purchase and caches state locally for UI responsiveness, but `product-api` Postgres tier is the canonical authority for gating. See `ph2_BLUEBOOK.md` §4 and `ph2_ADR-003`.

---

## 6. Contracts You Are Touching

### `SubscriptionTier` — NEW

File: `packages/contracts/src/subscription-tier.ts`

```typescript
{
  tier: "FREE" | "PRO"
  billing_period_end?: string    // ISO 8601; present only for PRO users with active billing
}
```

### `UserProfile` — NEW

File: `packages/contracts/src/user-profile.ts`

```typescript
{
  user_id: string
  email: string
  tier: "FREE" | "PRO"
  billing_period_end?: string
  watchlist_limit: number        // 5 for FREE, 20 for PRO
  daily_deep_dive_limit: number  // 1 for FREE, -1 (unlimited) for PRO
  deep_dives_remaining_today: number
}
```

### Existing contracts — READ ONLY

| Contract | Change type | File path |
|---|---|---|
| Auth contracts (login, register, refresh) | Read-only; no changes | `packages/contracts/src/auth-*.ts` |
| `AnalysisReport` | Read-only | `packages/contracts/src/analysis-report.ts` |
| `CreateJobRequest` | Read-only; gating happens in middleware before job creation | `packages/contracts/src/create-job-request.ts` |

**Rules:**
- Tier gating is a middleware concern — do not embed tier checks inside existing endpoint handlers
- All new contracts exported from `packages/contracts/src/index.ts`
- `pnpm typecheck` must pass

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M4 — Monetization & Subscription

**Ticket naming:**
```
[PH2-M4] What is being built
[PH2-M4][BUG] What is broken
[PH2-M4][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M4] Subscription schema migration` | Tier truth stored durably in Postgres |
| `[PH2-M4] RevenueCat webhook handler` | Webhook updates user tier in database |
| `[PH2-M4] Profile read model endpoint` | `GET /v1/user/profile` returns correct tier |
| `[PH2-M4] Tier-recovery sync endpoint` | `POST /v1/user/sync-tier` recovers from webhook failure |
| `[PH2-M4] Gating middleware` | Free user gets 403 on gated action; Pro user passes |
| `[PH2-M4] Deep Dive daily limit` | Free user blocked on second Deep Dive per day |
| `[PH2-M4] Watchlist cap enforcement` | Free user capped at 5 names; Pro at 20 |
| `[PH2-M4] Mobile RevenueCat SDK integration` | Purchase flow completes on real device via test track |
| `[PH2-M4] Paywall screen` | Paywall displayed when Free user hits gated feature |
| `[PH2-M4] Subscription management UI` | Settings shows tier, billing period, manage link |
| `[PH2-M4] Cancellation and downgrade` | Cancel flow works; access continues until period end; then downgrades |
| `[PH2-M4] Phase 1 regression check` | All Phase 1 auth and product flows still work |
| `[PH2-M4] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `ph2_MILESTONES.md`
- Link to this file

**Required on every bug ticket:**
- Exact endpoint, webhook event type, or mobile flow that failed
- Expected vs actual behavior
- Repro steps
- Error logs or Sentry link
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run.

---

## 8. Financial and Cost Considerations

### RevenueCat Costs

```
RevenueCat pricing:                  Free up to $2,500 MTR; 1% fee above that
Expected Pro subscribers at launch:  10-50 users × $9.99/month = $100-500 MTR
RevenueCat fee:                      $0 (well under $2,500 MTR threshold)
```

### Google Play Fees

```
Google Play commission:              15% on first $1M/year (reduced rate)
Per $9.99 subscription:              ~$1.50 to Google
Net revenue per subscriber:          ~$8.49/month
```

### Infrastructure Cost Impact

```
Webhook processing:                  Negligible (< 100 webhook events/month initially)
Profile endpoint load:               1 call per app session (~1,000-5,000/day)
Daily limit tracking:                Redis counter or Postgres query; negligible
```

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| RevenueCat webhook received | INFO | `{ level, service, message: "Webhook received", event_type, revenuecat_user_id_hash, timestamp }` |
| Webhook signature validation failed | ERROR | `{ level, service, message: "Webhook signature invalid", timestamp }` |
| User tier updated | INFO | `{ level, service, message: "Tier updated", user_id_hash, old_tier, new_tier, event_type, timestamp }` |
| Tier sync requested | INFO | `{ level, service, message: "Tier sync requested", user_id_hash, timestamp }` |
| Tier sync mismatch corrected | WARN | `{ level, service, message: "Tier mismatch corrected", user_id_hash, server_tier, revenuecat_tier, timestamp }` |
| Gated request blocked | WARN | `{ level, service, message: "Gated request blocked", user_id_hash, route, tier, feature, timestamp }` |
| Daily Deep Dive limit reached | INFO | `{ level, service, message: "Daily limit reached", user_id_hash, count, limit, timestamp }` |
| Watchlist cap reached | INFO | `{ level, service, message: "Watchlist cap reached", user_id_hash, current_count, limit, timestamp }` |
| Purchase flow completed (mobile) | INFO | `{ level, service, message: "Purchase completed", product_id, timestamp }` |
| Purchase flow failed (mobile) | ERROR | `{ level, service, message: "Purchase failed", error_message, timestamp }` |

Format: `{ level, service, message, ...fields, timestamp }`  
**Never log** full user IDs (use hashed), API keys, RevenueCat secrets, payment details, or billing amounts.

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| RevenueCat webhook delivery fails | User may be charged but not upgraded; tier-recovery sync endpoint available; mobile calls `POST /v1/user/sync-tier` on next app open | Logs + Sentry |
| Webhook signature validation fails | Webhook rejected; tier not changed; log and alert | Logs (ERROR) + Sentry |
| Mobile thinks user is Pro but server says Free | Server truth wins; mobile shows paywall; user can tap "Restore Purchases" to trigger sync | UI + logs |
| Mobile thinks user is Free but server says Pro | Mobile refreshes profile on app open; features unlock | UI |
| Google Play test track purchase fails | Mobile shows purchase error; user retries; no server-side change | UI + logs |
| Cancellation webhook arrives but user still within billing period | Tier remains Pro until `billing_period_end`; then downgrades on next check | Logs (INFO) |
| Daily Deep Dive limit counter out of sync | Counter is server-side (Postgres/Redis); mobile always checks via API; counter resets at midnight ET | Logs |
| Migration breaks existing `users` table | Must not happen if G4 decision uses a new table; if adding column, must be nullable with default | CI + smoke test |
| Profile endpoint slow under load | Endpoint is a simple Postgres read; add index if needed; target < 50ms | Logs |

**Rule:** No empty catch blocks. Every error path logs, surfaces to the appropriate channel, and either retries safely or fails explicitly.

---

## 11. Testing Requirements for This Milestone

- [x] **Webhook integration test:** Simulated RevenueCat webhook → tier updates in Postgres correctly for `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`
- [x] **Webhook signature validation test:** Invalid signature → 401 rejection
- [x] **Profile endpoint test:** Authenticated `GET /v1/user/profile` returns correct tier and limits
- [x] **Tier-recovery sync test:** `POST /v1/user/sync-tier` corrects a mismatch between Postgres and RevenueCat
- [x] **Gating middleware test — Free user:** Free user hits gated endpoint → 403 with `upgrade_required`
- [x] **Gating middleware test — Pro user:** Pro user hits same endpoint → success
- [x] **Daily Deep Dive limit test:** Free user runs 1 Deep Dive → success; 2nd → 403
- [x] **Daily limit reset test:** After midnight ET, limit resets; Free user can run again (validated on 2026-04-15; evidence: `Project Note/Phase2/Milestones/M4/evidence/2026-04-15/m4-daily-limit-reset-proof.json`)
- [x] **Watchlist cap test — Free:** Free user at 5 names → add blocked; Pro at 5 → add allowed
- [x] **Cancellation test:** After cancellation webhook, user retains Pro until billing period end; then downgrades
- [x] **Migration test:** `ph2m4_009` applies cleanly; `.down.sql` rolls back cleanly; no Phase 1 table corruption
- [x] **Real-device purchase flow disposition:** Owner accepted implemented RevenueCat purchase/restore wiring plus webhook/sync proof as sufficient for M4 closeout; live Google Play purchase proof remains an external operational follow-up after Google verification
- [x] **Phase 1 auth regression:** Register → verify → login → refresh → logout all still work
- [x] **Phase 1 product regression:** Pulse loads, watchlist CRUD works, push token registers, history loads

Test file locations:
- Webhook/middleware tests: `apps/product-api/tests/`
- Migration tests: `tests/integration/`
- Mobile tests: real device on Google Play test track
- Regression tests: `tests/smoke/`

CI must pass before any PR merges. Real-device testing required before milestone close.

---

## 12. Data Validation Criteria

### Tier State Verification (Manual)

| Check | Method |
|---|---|
| New user defaults to FREE | Register a new user; query Postgres; confirm tier = FREE |
| Purchase updates to PRO | Complete test purchase; query Postgres; confirm tier = PRO and billing_period_end is set |
| Cancellation marks pending downgrade | Cancel subscription; confirm tier = PRO but billing_period_end matches Google Play |
| Post-expiry user is FREE | Simulate or wait for expiry; confirm tier = FREE |
| Sync-tier corrects mismatch | Manually set tier to wrong value; call sync-tier; confirm corrected |

### Gating Behavior Verification

| Check | Expected |
|---|---|
| Free user: 1 Deep Dive succeeds, 2nd fails | 403 with `upgrade_required` |
| Pro user: unlimited Deep Dives | No 403 on any count |
| Free user: 6th watchlist add fails | 403 |
| Pro user: 21st watchlist add fails | 403 (Pro cap is 20) |

---

## 13. Rollback Plan

M4 modifies the `product-api` middleware, adds schema, and changes the mobile app. Rollback is more involved but safe.

| Component | Rollback Action |
|---|---|
| Subscription migration | Run `ph2m4_007_subscriptions.down.sql`; if tier was added as column, revert column addition |
| Webhook endpoint | Remove `POST /v1/webhooks/revenuecat` route; RevenueCat webhooks will fail silently (no side effect) |
| Profile endpoint | Remove `GET /v1/user/profile` route |
| Gating middleware | Remove middleware; all endpoints revert to unrestricted access |
| Daily limit tracking | Remove counter logic; all users unlimited |
| Mobile RevenueCat SDK | Revert SDK initialization; remove paywall screen; revert to Phase 1 mobile build |
| Stored subscription data | Dropped with migration rollback or manually cleared |

**Key safety property:** Rollback restores the Phase 1 "all users are equal" behavior. No user loses access to previously available features. Users who paid via Google Play would need refunds handled outside the app.

---

## 14. Definition of Done

Phase 2 M4 is not done until every item below is checked:

- [x] All acceptance criteria in `ph2_MILESTONES.md → M4` are satisfied **except external store-verification-dependent proof**
- [x] All four Gated Pre-Conditions (G1, G2, G3, G4) are resolved and recorded in §17 (**G2 deferred by owner as external blocker**)
- [x] Smoke test executed in full — results documented in §15 below
- [x] Data validation checks (§12) all pass
- [x] All automated tests passing in CI on main branch
- [x] All 13 Linear tickets for PH2-M4 are closed or explicitly deferred
- [x] Real-device purchase flow tested on Google Play test track (**owner-approved closeout waiver, 2026-04-15; external blocker pending Google verification is tracked in §16 / RZV-225**)
- [x] Phase 1 auth regression confirmed (register, verify, login, refresh, logout)
- [x] Phase 1 product regression confirmed (Pulse, watchlist, push, history)
- [x] Rollback confirmed: `.down.sql` migration executes cleanly
- [x] Owner signs off
- [x] Engineering Lead countersigns (**owner-approved closeout waiver, 2026-04-15**)

**A paywall screen appearing once on a debug build is not done. This checklist complete is done.**

---

## 15. Smoke Test Log

```
Date:
Run by:
Environment:
Result:

Step 1  — Apply migration ph2m4_009:                                PASS
          Confirm subscription schema exists
          Confirm no corruption of existing users table

Step 2  — Register a new user and complete verify/login:            PASS
          Confirm registration, verification, and login succeed
          Confirm auth tokens are valid

Step 3  — GET /v1/user/profile:                                     PASS
          Confirm HTTP 200
          Confirm tier = "FREE"
          Confirm watchlist_limit = 5, daily_deep_dive_limit = 1

Step 4  — Run one Deep Dive:                                        PASS
          Confirm job completes successfully

Step 5  — Attempt second Deep Dive:                                 PASS
          Confirm HTTP 403 with upgrade_required
          Confirm paywall displayed on mobile

Step 6  — Attempt to add 6th watchlist name:                        PASS
          Confirm HTTP 403 with upgrade_required

Step 7  — Complete purchase on Google Play test track:              OWNER-ACCEPTED EXTERNAL FOLLOW-UP
          Confirm purchase flow completes in mobile
          Confirm RevenueCat webhook fires

Step 8  — Confirm tier update:                                      PASS (webhook + sync path verified; live purchase proof accepted as external follow-up)
          Confirm Postgres tier = "PRO"
          Confirm GET /v1/user/profile returns tier = "PRO"
          Confirm watchlist_limit = 20

Step 9  — Re-run gated actions:                                     PASS (server gating validated for Free/Pro paths)
          Confirm 2nd Deep Dive succeeds
          Confirm 6th watchlist name succeeds

Step 10 — Restart app:                                              PASS
          Confirm tier remains PRO after restart
          Confirm profile endpoint still returns PRO

Step 11 — Cancel subscription:                                      PASS (webhook simulation path)
          Confirm cancellation webhook fires
          Confirm tier remains PRO until billing_period_end
          Confirm tier downgrades to FREE after period end (or simulate)

Step 12 — Test tier-recovery sync:                                  PASS
          Manually set tier to wrong value
          Call POST /v1/user/sync-tier
          Confirm tier corrected

Step 13 — Phase 1 auth regression:                                  PASS
          Register, verify, login, refresh, logout all succeed

Step 14 — Phase 1 product regression:                               PASS
          Pulse loads, watchlist CRUD works, push token registers, history loads

Step 15 — Run CI:                                                   PASS
          Confirm all tests pass

Steps failed (if any):
  - None for M4 closeout. Live Google Play verification remains an external operational follow-up, not a milestone blocker.

Notes:
  - Owner-approved deferral: Google Play verification-dependent purchase proof.
  - RevenueCat mobile SDK wiring implemented (buy monthly/yearly + restore + server sync).

2026-04-14 local evidence refresh:
  - PASS: `corepack pnpm --filter @thesis/product-api test`
    Log: `Project Note/Phase2/Milestones/M4/evidence/2026-04-14/product_api_test_post_patch.log`
  - PASS: `python tests/integration/test_m4_product_api.py`
    Log: `Project Note/Phase2/Milestones/M4/evidence/2026-04-14/integration_test_m4_product_api_clean.log`
  - NOTE: `tests/smoke/m4_product_api_smoke.py` currently fails on a stale expectation (`/jobs` second call expects `202` for a Free user after first Deep Dive, but current gating correctly returns limit behavior). Kept as follow-up test-maintenance work, not acceptance proof.
2026-04-15 daily reset evidence refresh:
  - PASS: targeted subscription test crossing ET midnight boundary (`M4 daily Deep Dive limit resets after midnight in America/New_York`)
    Log: `Project Note/Phase2/Milestones/M4/evidence/2026-04-15/daily_limit_reset_test.log`
    Summary: `Project Note/Phase2/Milestones/M4/evidence/2026-04-15/m4-daily-limit-reset-proof.json`
```

---

## 16. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Export artifact generation (PDF, Share Card, Memo) | M4 gates access; M7 builds the feature | — | Phase 2 M7 |
| What-If scenario implementation | M4 gates access; M7 builds the feature | — | Phase 2 M7 |
| iOS billing integration | Android-first product | — | Post-launch |
| Trial period or promotional pricing | Not in Phase 2 PRD | — | Post-launch |
| Web-based subscription management | Not in Phase 2 scope | — | Post-launch |
| Real Google Play product linking + live purchase proof | External Google developer/payment-profile verification pending; owner accepted this as non-blocking for M4 delivery on 2026-04-16 | RZV-225 | Operational follow-up after Google verification clears |

---

## 17. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| RevenueCat as subscription provider | Already decided | Covered by ph2_ADR-003 |
| Subscription schema location | Dedicated `subscriptions` table + `deep_dive_daily_usage` table | No — implementation detail |
| Google Play product IDs | Deferred until Google developer/payment verification is approved | No — operational detail |
| Gated feature list | FREE: 1/day Deep Dive + watchlist cap 5; PRO: unlimited + cap 20 | No — product decision |
| Migration sequence number | `009` for Phase 2 M4 subscription rollout | No |

**Update (2026-03-28):**

- G4 resolved: implemented new `subscriptions` table plus `deep_dive_daily_usage` in `ph2m4_009_subscriptions`.
- G3 resolved: enforced FREE (1 Deep Dive/day, watchlist cap 5, no exports/What-If) vs PRO (unlimited Deep Dive, watchlist cap 20, exports + What-If).
- G2 deferred by owner: Google Play product IDs/test-track purchase proof to be finalized at end of M4.
- Mobile SDK update (2026-03-29): RevenueCat purchase/restore flow implemented in Android app; live purchase proof remains blocked externally pending Google verification.

**Closeout update (2026-04-15):**

- Owner approved M4 closeout using the standard waiver pattern.
- Engineering Lead countersign was recorded under owner-approved closeout waiver.
- External Google Play verification-dependent live purchase proof remains explicitly deferred and tracked as `RZV-225` in §16.

**Closeout update (2026-04-16):**

- Owner explicitly confirmed: "Phase 2 M4 = close it now."
- M4 is closed as delivered for milestone governance.
- Evidence recorded in `Project Note/Phase2/Milestones/M4/evidence/2026-04-16/m4-owner-closeout.json`.
- Live Google Play purchase/restore verification remains a post-verification operational follow-up, not an open M4 blocker.
