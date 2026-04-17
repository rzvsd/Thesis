# AGENTS.md â€” Phase 2 M5 Calendar & Smart Notifications
**Milestone:** Phase 2 M5 â€” Calendar & Smart Notifications  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` â€” read both first.  
**Location:** `Project Note/Phase2/Milestones/M5/M5_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M5 â€” Calendar & Smart Notifications |
| **Linear Project** | Phase 2 M5 â€” Calendar & Smart Notifications |
| **Owner** | Scheduler Engineer + Product API Engineer + Mobile Engineer |
| **Status** | Closed (PASS; strict GitHub CI proof attached on 2026-04-16) |
| **Depends on** | Phase 2 M4 closed; FCM credentials operational (Phase 1 push path already working) |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Calendar data source.** Which provider supplies upcoming earnings dates? (Independent of M0/M1 SEC historical store â€” e.g. OpenBB-wrapped calendar, exchange feed, or other approved API.) What are the endpoints, rate limits, cost, and ToS for server-side use? | **RESOLVED:** yfinance `Calendars` batch source (`yf.Calendars(start,end).get_earnings_calendar()`), filtered to `ticker_coverage` supported universe. No API key, $0. | Data Engineer + Product Lead | Done |
| G2 | **Contrarian alert threshold.** What price move triggers a contrarian alert? (e.g., stock drops â‰¥ 5% while user's thesis was "positive"). Must be a concrete number, not "significant move." | **RESOLVED:** 5% cumulative move from `anchor_price` in opposite direction of thesis. | Product Lead | Done |
| G3 | **Contrarian alert validity window.** How long does an anchor remain active? (e.g., 30 days, 90 days). After expiry, no more alerts fire for that anchor. | **RESOLVED:** 90 days from `anchored_at`. | Product Lead | Done |
| G4 | **Weekly digest delivery channel.** Email, push notification, or in-app? PRD Â§2.5 says "scheduled summary for Pro users" but doesn't specify delivery. Email requires an email service (SendGrid, SES). Push is simpler but limited in content. | **RESOLVED:** FCM push notification with deep-link to digest destination. | Product Lead | Done |
| G5 | **Notification type inventory.** Exact list of notification types users can enable/disable (e.g., earnings_preview, contrarian_alert, weekly_digest, market_pulse_ready). Each type needs a named FCM template. | **RESOLVED:** `earnings_preview`, `contrarian_alert`, `weekly_digest`, `market_pulse_ready` | Product Lead + Mobile Engineer | Done |
| G6 | **Anchor-proof mode.** Can Phase 1 Deep Dive reports create M5 contrarian anchors, or must this wait for Deep Dive v2? | **RESOLVED:** Phase 1 completed Deep Dive reports are valid anchor sources when they carry a signal value. | Product Lead + Engineering Lead | Done |

**Rule:** Do not begin coding with placeholder thresholds, assumed delivery channels, or ad-hoc notification types. The anchor model, scheduler evaluation logic, FCM templates, and preference UI all depend on concrete answers.

---

## 1. What This Milestone Is Building

The proactive intelligence layer that makes the app time-aware and personalized. At the end of this milestone, the app knows when watchlist companies report earnings and nudges the user beforehand. If the market moves against a user's thesis, a contrarian alert fires from a durable server-side anchor â€” never from transient app memory. Pro users receive a weekly digest summarizing the best insights. Users control which notification types they receive.

This milestone adds new tables (`calendar_events`, `contrarian_alert_anchors`, `notification_preferences`), new scheduler cron jobs, new FCM notification templates, and mobile preference UI. It must not break the working Phase 1 push registration, notification receipt, tap-through deep-links, or any existing product flow.

**Plain English summary for non-technical audit:**  
Before M5, the app waits for you to open it. After M5, it comes to you â€” telling you when your companies report, when the market disagrees with your thesis, and giving Pro users a weekly briefing. You control what it tells you, and it never makes up a reason to notify you.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md` â€” FCM push architecture, scheduler, deep-link model
- `Project Note/Phase1/MILESTONES.md` â€” Phase 1 M8 (Push & Notifications) as regression baseline

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` â€” High-Risk Rule for M5 (persisted thesis anchor)
- `Project Note/Phase2/ph2_BLUEBOOK.md` â€” Â§7 M5 Guardrail (anchor model), Â§8 Data Model (`calendar_events`, `contrarian_alert_anchors`)
- `Project Note/Phase2/ph2_MILESTONES.md` â€” Phase 2 M5 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` â€” Â§2.5 Smart Notifications

### Current code surfaces

- `apps/scheduler/src/scheduling.ts` â€” cron and cycle-window logic
- `apps/scheduler/src/server.ts` â€” scheduler entry point (existing Market Pulse cron)
- `apps/product-api/src/server.ts` â€” existing push token registration route
- `apps/product-api/src/store.ts` â€” user and watchlist queries
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/MainViewModel.kt` â€” push handling
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt` â€” API client

---

## 3. Scope â€” What Is In

- [x] **Migration** `infra/migrations/ph2m5_010_calendar_events.up.sql` and `.down.sql` â€” creates `calendar_events` table per Bluebook Â§8 schema
- [x] **Migration** `infra/migrations/ph2m5_011_contrarian_anchors.up.sql` and `.down.sql` â€” creates `contrarian_alert_anchors` table per Bluebook Â§8 schema
- [x] **Migration** `infra/migrations/ph2m5_012_notification_preferences.up.sql` and `.down.sql` â€” creates `notification_preferences` table (user_id, type, enabled, updated_at)
- [x] All three migrations registered in `apps/product-api/src/migrations.ts`
- [x] **Calendar sync cron:** Nightly job (after existing syncs) that fetches upcoming earnings dates from the G1 provider and upserts into `calendar_events`
- [x] **Earnings-preview notification:** When a watchlist ticker has an earnings date within 1 business day, the scheduler sends a personalized FCM push: "MSFT reports tomorrow. Tap to run a Deep Dive." Deep-links to the ticker's Deep Dive screen.
- [x] **Contrarian alert anchor creation:** When a Deep Dive completes and produces a signal (`positive`, `neutral`, `negative`), `product-api` creates a `contrarian_alert_anchors` row with the user, ticker, signal value, **anchor_price**, anchor time, and expiry (G3 window).
- [x] **Contrarian alert evaluation cron:** Scheduler job (daily or more frequent per design) checks active anchors against current market price. If the price move exceeds the G2 threshold in the opposite direction of the thesis signal, fire a push notification.
- [x] **Contrarian alert expiry:** Anchors with `expires_at < now()` are automatically deactivated (`is_active = false`); no alerts fire for expired anchors.
- [x] **Notification preference model:** `GET /v1/user/notification-preferences` and `PUT /v1/user/notification-preferences` endpoints for reading and updating per-type preferences.
- [x] **Mobile notification settings UI:** Settings screen lists each notification type (G5) with toggles. Changes call the preference API.
- [x] **Weekly digest builder:** Scheduled aggregation of the week's top insights (e.g., biggest movers in watchlist, Fear & Greed trend, upcoming earnings). Pro users only.
- [x] **Weekly digest delivery:** Delivered via FCM push on the agreed cadence (e.g., Sunday evening).
- [x] **All notifications deep-link correctly:** Each notification type opens the correct screen in the app.
- [x] **Phase 1 regression:** Push token registration, notification receipt, tap-through to Pulse/target screen, and watchlist personalization all still work.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md â†’ M5`

---

## 4. Scope â€” What Is Out

| Out of scope | Reason |
|---|---|
| Deriving alerts from app memory or last-opened screen | Explicitly forbidden by `ph2_AGENTS.md` |
| In-app notification center / inbox | Not in Phase 2 scope |
| Real-time price streaming for contrarian alerts | Daily evaluation sufficient; real-time is post-launch |
| Fear & Greed UI integration of notifications | M8 scope |
| Calendar UI / calendar screen | Not specified in Phase 2; calendar data powers notifications only |
| Custom notification schedules per user | Not in PRD |
| SMS notifications | Not in PRD |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Infra | `infra/migrations/` | Add `ph2m5_010`, `ph2m5_011`, `ph2m5_012` migration files |
| Product API | `apps/product-api/src/` | Register migrations; add preference endpoints; add anchor creation logic on Deep Dive completion; add calendar query functions |
| Scheduler | `apps/scheduler/src/` | Add calendar sync cron, earnings-preview notification cron, contrarian alert evaluation cron, weekly digest cron |
| Data path | `apps/data-openbb/src/` | Add yfinance `Calendars` batch fetcher and internal sync endpoint for G1 |
| Contracts | `packages/contracts/src/` | Add `CalendarEvent`, `ContrarianAlertAnchor`, `NotificationPreference` contracts if needed |
| Mobile app | `apps/mobile/` | Add notification settings UI with toggles; ensure deep-link handling for new notification types |

**M5 architecture rule:** Contrarian alerts must evaluate durable server-side anchor records in Postgres. Never derive them from temporary mobile state, local storage, or "last viewed report."

---

## 6. Contracts You Are Touching

### `CalendarEvent` â€” NEW

File: `packages/contracts/src/calendar-event.ts`

```typescript
{
  id: string
  ticker: string
  event_type: "earnings" | "dividend" | "split"
  event_date: string           // ISO 8601 date
  event_time?: "before_market" | "after_market" | "during_market"
  provider: string
  retrieved_at: string
}
```

### `ContrarianAlertAnchor` â€” NEW

File: `packages/contracts/src/contrarian-alert-anchor.ts`

```typescript
{
  id: string
  user_id: string
  ticker: string
  report_id?: string           // FK to reports.id, nullable
  signal_value: "positive" | "neutral" | "negative"
  anchor_price: number
  anchored_at: string          // ISO 8601
  expires_at: string           // ISO 8601
  is_active: boolean
}
```

### `NotificationPreference` â€” NEW

```typescript
{
  user_id: string
  preferences: {
    type: string               // e.g. "earnings_preview", "contrarian_alert", "weekly_digest"
    enabled: boolean
  }[]
}
```

**Rules:**
- All new contracts exported from `packages/contracts/src/index.ts`
- `pnpm typecheck` must pass
- Anchor `signal_value` uses the same enum as `ReportSignal.value` from Phase 1 contracts

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M5 â€” Calendar & Smart Notifications

**Ticket naming:**
```
[PH2-M5] What is being built
[PH2-M5][BUG] What is broken
[PH2-M5][SPIKE] What is being investigated
```

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M5] Calendar events migration and schema` | `calendar_events` table created with indexes |
| `[PH2-M5] Contrarian anchors migration and schema` | `contrarian_alert_anchors` table created |
| `[PH2-M5] Notification preferences migration and schema` | `notification_preferences` table created |
| `[PH2-M5] Calendar sync cron` | Nightly sync populates calendar_events with correct earnings dates |
| `[PH2-M5] Earnings-preview notification` | Push fires when watchlist ticker reports within 1 business day |
| `[PH2-M5] Contrarian anchor creation` | Anchor created on Deep Dive completion with correct signal and expiry |
| `[PH2-M5] Contrarian alert evaluation cron` | Alert fires when price move exceeds threshold opposite to thesis |
| `[PH2-M5] Anchor expiry` | Expired anchors deactivated; no alerts after expiry |
| `[PH2-M5] Notification preference endpoints` | GET and PUT for per-type preferences |
| `[PH2-M5] Mobile notification settings UI` | Toggles per notification type in settings |
| `[PH2-M5] Weekly digest builder and delivery` | Pro users receive digest on cadence with correct content |
| `[PH2-M5] Deep-link correctness` | All notification types open the correct screen |
| `[PH2-M5] Phase 1 regression` | Push registration, receipt, and tap-through still work |
| `[PH2-M5] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Never close a ticket without** a passing CI run.

---

## 8. Financial and Cost Considerations

### Calendar Data Provider

```
Provider:                            yfinance Calendars batch source (resolved G1)
Additional API calls per night:      ~1 market-wide calendar call + universe filtering
Monthly cost:                        $0
```

### FCM Push Delivery

```
FCM pricing:                         Free for standard push notifications
Push volume estimate:                ~100-1,000 pushes/day (depends on user count and watchlist coverage)
Cost:                                $0
```

### Weekly Digest Delivery (resolved G4)

```
Channel:                             FCM push notification (deep-link into app)
Additional infra:                    None beyond existing FCM path
Monthly cost:                        $0
```

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Calendar sync started | INFO | `{ level, service, message: "Calendar sync started", timestamp }` |
| Calendar sync completed | INFO | `{ level, service, message: "Calendar sync complete", events_upserted, timestamp }` |
| Earnings-preview push sent | INFO | `{ level, service, message: "Earnings preview sent", ticker, user_count, event_date, timestamp }` |
| Contrarian anchor created | INFO | `{ level, service, message: "Anchor created", user_id_hash, ticker, signal_value, expires_at, timestamp }` |
| Contrarian alert evaluation started | INFO | `{ level, service, message: "Alert evaluation started", active_anchor_count, timestamp }` |
| Contrarian alert fired | INFO | `{ level, service, message: "Contrarian alert fired", user_id_hash, ticker, signal_value, price_move_pct, timestamp }` |
| Contrarian anchor expired | INFO | `{ level, service, message: "Anchor expired", anchor_id, ticker, timestamp }` |
| Notification suppressed by preference | INFO | `{ level, service, message: "Notification suppressed", user_id_hash, notification_type, timestamp }` |
| Weekly digest generated | INFO | `{ level, service, message: "Digest generated", pro_user_count, timestamp }` |
| Weekly digest delivery failed | ERROR | `{ level, service, message: "Digest delivery failed", user_id_hash, error_message, timestamp }` |
| Calendar provider failed | ERROR | `{ level, service, message: "Calendar provider failed", provider, error_message, timestamp }` |
| Alert evaluation failed | ERROR | `{ level, service, message: "Alert evaluation failed", error_message, timestamp }` |

Format: `{ level, service, message, ...fields, timestamp }`  
Never log full user IDs, API keys, or push tokens.

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Calendar provider unavailable | Sync fails; existing calendar data retained; Sentry alert | Logs (ERROR) + Sentry |
| Calendar data has wrong earnings date | Advisory data; notification says "expected"; no trade-triggering | Logs |
| Contrarian anchor missing for a user | No alert fires; this is expected if user hasn't run a Deep Dive | Logs (INFO) |
| Price data unavailable for alert evaluation | Skip that anchor for this evaluation cycle; retry next cycle | Logs (WARN) |
| FCM push delivery fails | Retry once; log failure; user misses notification but app remains functional | Logs (ERROR) + Sentry |
| Deep-link opens wrong screen | Blocker â€” notification tap must land correctly; test on real device | UI + Linear |
| Preference endpoint unavailable | Mobile shows cached preferences; retries on next open | Logs (WARN) |
| Weekly digest builder fails | Pro users miss one digest; Sentry alerts; next week retries | Logs (ERROR) + Sentry |
| Anchor expiry job doesn't run | Expired anchors accumulate but don't fire (evaluated anchors check `expires_at`); clean up in next run | Logs (WARN) |
| Migration breaks existing tables | Must not happen â€” all new tables; no ALTER on Phase 1 tables | CI + smoke test |

**Rule:** No empty catch blocks. Every error path logs and surfaces appropriately.

---

## 11. Testing Requirements for This Milestone

- [x] **Migration tests:** All three migrations apply and roll back cleanly
- [x] **Calendar sync integration test:** Fetcher retrieves and upserts earnings dates correctly
- [x] **Earnings-preview notification test:** Watchlist ticker with tomorrow's earnings triggers push
- [x] **Anchor creation test:** Deep Dive completion creates an anchor with correct fields
- [x] **Contrarian alert evaluation test â€” alert fires:** Price move exceeds threshold opposite to signal â†’ push sent
- [x] **Contrarian alert evaluation test â€” no fire:** Price move is within threshold â†’ no push
- [x] **Anchor expiry test:** Expired anchor is deactivated; no alert fires
- [x] **Preference endpoint tests:** GET returns defaults; PUT updates; push respects disabled types
- [x] **Deep-link test per notification type:** Each type opens correct screen on real device
- [x] **Weekly digest content test:** Digest contains expected sections (top movers, F&G trend, upcoming earnings)
- [x] **Weekly digest delivery test:** Delivery reaches Pro user via FCM push (resolved G4 channel)
- [x] **Phase 1 push regression:** Token registration, notification receipt, and Pulse tap-through still work
- [x] **Phase 1 watchlist regression:** Watchlist CRUD and personalization still work

CI must pass before any PR merges. Real-device push testing required.

---

## 12. Rollback Plan

| Component | Rollback Action |
|---|---|
| Migrations | Run `.down.sql` for `012`, `011`, `010` in reverse order; drops all three new tables |
| Calendar sync cron | Remove cron entry from scheduler |
| Alert evaluation cron | Remove cron entry from scheduler |
| Weekly digest cron | Remove cron entry from scheduler |
| Preference endpoints | Remove routes from `product-api` |
| FCM templates | Templates can remain (unused); or remove from FCM console |
| Mobile settings UI | Revert to Phase 1 settings screen |
| Contracts | Remove new contract files; update `index.ts` |

**Key safety property:** Rollback removes all M5 functionality. Phase 1 push, deep-links, and all existing product flows remain unaffected because M5 is purely additive.

---

## 13. Definition of Done

- [x] All acceptance criteria in `ph2_MILESTONES.md â†’ M5` are satisfied
- [x] All six Gated Pre-Conditions (G1â€“G6) resolved and recorded in Â§16
- [x] Smoke test executed in full â€” results documented in Â§14 below
- [x] All automated tests passing in CI (strict GitHub proof attached: M5 merge CI run `23733187318` passed; latest main CI run `24411847146` also passed)
- [x] All 14 Linear tickets for PH2-M5 are closed or explicitly deferred
- [x] Real-device push notification tested for every notification type
- [x] Deep-link correctness verified on real device for every notification type
- [x] Phase 1 push and watchlist regression confirmed
- [x] Rollback confirmed: all three `.down.sql` migrations execute cleanly
- [x] Owner signs off
- [x] Engineering Lead countersigns (**owner-approved closeout waiver, 2026-04-15**)

**A single push notification appearing on a debug device is not done. This checklist complete is done.**

---

## 14. Smoke Test Log

```
Date: 2026-03-29 to 2026-03-30
Run by: Codex (implementation, automated smoke, and real-device validation)
Environment: Local `test` branch; product-api local stack; real FCM delivery to Android device `R3CXA03J3LH`; Maestro-driven device checks plus throwaway Postgres rollback rehearsal
Result: Technical PASS (automated suite + real-device notification/deep-link sweep + rollback rehearsal all passed). Owner-approved milestone closeout recorded; GitHub CI for this exact change set remains a follow-up proof item.

Step 1  â€” Apply migrations ph2m5_010, 011, 012:                    PASS
          Confirm calendar_events, contrarian_alert_anchors, notification_preferences tables exist
          Rehearsed on throwaway DB `thesis_m5_rollback`; all three `.up.sql` files applied cleanly

Step 2  â€” Run calendar sync:                                        AUTOMATED PASS
          Confirm earnings dates upserted for supported universe
          Confirm no errors in logs

Step 3  â€” Enable notifications and register device token:           AUTOMATED PASS
          Confirm token registration succeeds

Step 4  â€” Add a watchlist ticker with upcoming earnings:            AUTOMATED PASS
          Confirm earnings date exists in calendar_events

Step 5  â€” Trigger earnings-preview notification path:               PASS
          Confirm push delivered to device
          Confirm notification content includes ticker and earnings date
          Confirm tap-through opens Deep Dive screen for that ticker

Step 6  â€” Run a Deep Dive and confirm anchor creation:              AUTOMATED PASS
          Confirm contrarian_alert_anchors row created
          Confirm signal_value matches report signal
          Confirm expires_at is G3 window from now

Step 7  â€” Simulate price move exceeding G2 threshold:               AUTOMATED PASS
          Confirm contrarian alert push fires
          Confirm notification says "Your thesis on [TICKER] ([signal]) is diverging"
          Confirm tap-through opens correct screen

Step 8  â€” Verify anchor expiry:                                     PASS
          Set an anchor's expires_at to the past
          Run evaluation â€” confirm no alert fires
          Confirm is_active = false

Step 9  â€” Open notification settings in mobile:                     PASS
          Confirm all notification types listed with toggles
          Toggle one off â€” confirm PUT call succeeds

Step 10 â€” Trigger same notification type again:                     PASS
          Confirm notification NOT delivered (preference respected)

Step 11 â€” Toggle preference back on:                                PASS
          Confirm next notification IS delivered

Step 12 â€” Trigger weekly digest:                                    PASS
          Confirm digest generated for Pro users
          Confirm content includes expected sections
          Confirm delivery via FCM push channel

Step 13 â€” Phase 1 push regression:                                  PASS
          Confirm device token registration still works
          Confirm Pulse notification receipt still works
          Confirm tap-through lands on correct screen

Step 14 â€” Phase 1 watchlist regression:                             PASS
          Confirm watchlist CRUD works
          Confirm watchlist personalization still drives notifications

Step 15 â€” Run CI:                                                   PASS (GitHub Actions)
          M5 merge CI run `23733187318` passed on `fe0f2544058425c77475d1b619a5b7a4085d6eff`.
          Latest main CI run `24411847146` also passed on `ee995822d543f1801b35f8da8ce7dbc29cf955f4`.

Steps failed (if any):
  - None in the technical M5 validation sweep.

Notes:
  - `pnpm lint` and `pnpm typecheck` passed locally at repo root.
  - Full CI step-sequence re-run evidence was captured in `Project Note/Phase2/Milestones/M5/evidence/2026-04-15/` (`security:audit`, gitleaks, `security:sast`, lint, typecheck, targeted test proof).
  - Strict GitHub CI evidence captured in `Project Note/Phase2/Milestones/M5/evidence/2026-04-16/m5-github-ci-proof.json`.
  - Android compile/lint passed locally with `JAVA_HOME` set to Android Studio JBR.
  - Real-device notification types verified: `earnings_preview`, `contrarian_alert`, `weekly_digest`, `market_pulse_ready`.
  - Real-device tap-through verified: earnings preview -> Deep Dive screen, contrarian alert -> Deep Dive screen, weekly digest -> home/pulse destination, market pulse ready -> home/pulse destination.
  - Preference suppression verified end-to-end: disabled `earnings_preview` produced no device notification; re-enabling restored delivery.
  - Weekly digest body text was confirmed in the Android notification hierarchy artifact even though Samsung's collapsed shade made one exact-text Maestro assertion flaky. Evidence artifact: `C:\Users\razva\.maestro\tests\2026-03-29_235025\commands-(m5_weekly_digest_content.yaml).json`
  - Real-device Maestro evidence directories include `qa/maestro/output/2026-03-29T20-32-00-195Z/` and the temporary M5 closeout flows in `qa/maestro/output/`.
  - Rollback rehearsal passed on throwaway database `thesis_m5_rollback`: `ph2m5_012`, `ph2m5_011`, and `ph2m5_010` all rolled back cleanly and the created tables were absent afterward.
```

---

## 15. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| In-app notification center / inbox | Not in Phase 2 scope | â€” | Post-launch |
| Real-time price streaming for contrarian alerts | Daily evaluation sufficient for MVP | â€” | Post-launch |
| Calendar screen / UI for browsing events | Calendar data powers notifications only in Phase 2 | â€” | Post-launch |
| Multi-channel notification delivery (email + push) | Start with one channel per G4 decision | â€” | Post-launch |

---

## 16. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Calendar data source | yfinance `Calendars` batch source (`yf.Calendars(...).get_earnings_calendar()`), nightly sync, filtered to `ticker_coverage` universe | No â€” operational |
| Contrarian alert threshold | 5% cumulative move from `anchor_price` opposite to thesis signal | No â€” product rule |
| Alert validity window | 90 days from `anchored_at` | No â€” product rule |
| Digest delivery channel | FCM push only in M5 (no email service in scope) | No â€” operational |
| Notification type inventory | `earnings_preview`, `contrarian_alert`, `weekly_digest`, `market_pulse_ready` | No â€” product decision |
| Anchor-proof mode | Phase 1 completed reports are valid anchor sources when signal exists | No â€” milestone doctrine |
| Migration sequence numbers | `010`, `011`, `012` continuing from M4's `009` | No |

**Closeout update (2026-04-15):**

- Owner approved M5 closeout with CI proof acceptance for GitHub-run confirmation on push.
- Engineering Lead countersign was recorded under owner-approved closeout waiver.
- CI evidence artifacts were refreshed in `Project Note/Phase2/Milestones/M5/evidence/2026-04-15/`.

**Closeout update (2026-04-16):**

- The previous "accepted on push" CI waiver is superseded by strict GitHub Actions evidence.
- Primary M5 merge proof: `ci` run `23733187318` passed on commit `fe0f2544058425c77475d1b619a5b7a4085d6eff`.
- Current main proof: `ci` run `24411847146` passed on commit `ee995822d543f1801b35f8da8ce7dbc29cf955f4`.
- Evidence recorded in `Project Note/Phase2/Milestones/M5/evidence/2026-04-16/m5-github-ci-proof.json`.


