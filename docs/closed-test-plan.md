# Closed test plan (audit roadmap item 9)

Status: plan and instrumentation ready. Recruiting testers is the owner's job.

## 1. Goal

Learn if real investors come back to Thesis without being asked, and if some of them pay.

The test answers five questions:

| # | Question | Metric |
|---|----------|--------|
| 1 | Do testers come back after one week? | Day-7 retention |
| 2 | Is the Pulse a weekly habit? | Pulse opens per active tester per week |
| 3 | Do testers commit to names? | Names followed per tester (watchlist size) |
| 4 | Does the paywall convince people to try Pro? | Paywall view to trial start |
| 5 | Do trials turn into money? | Trial to paid |

## 2. Cohort

- Size: 20 to 50 investors. Invite about 60, because some will not install.
- Profile: self-directed investors who already read filings, earnings notes or newsletters. No friends and family who will not use the product.
- Length: 4 weeks of use. Day-7 retention needs the first 7 days of each tester. Trial to paid needs the trial length plus a few days.
- Device: Android only (the Play closed-testing track).

## 3. Play Console: closed-testing track setup

1. Play Console > the Thesis app > Testing > Closed testing > Create track (or use the default "Closed testing - Alpha" track). Name it, for example, `investor-closed-test`.
2. Testers tab > Create email list. Add the tester Google account emails. Keep this list only in Play Console. Do not copy it into PostHog or the repo.
3. Set the feedback channel (email address or URL) on the same tab.
4. Build a release bundle with analytics and billing turned on. In `apps/mobile/android/gradle.properties` or with `-P` flags:
   - `POSTHOG_ENABLED=true`
   - `POSTHOG_API_KEY=<project API key>` (public ingest key, `phc_...`)
   - `POSTHOG_HOST=<https://us.i.posthog.com or https://eu.i.posthog.com>` (owner choice, matches the PostHog project region)
   - `REVENUECAT_PUBLIC_ANDROID_KEY=<public SDK key>`
   - Then `.\gradlew.bat :app:bundleRelease`.
5. Releases > Create new release on the closed track. Upload the `.aab`. Write release notes.
6. Subscriptions: in Play Console > Monetize > Subscriptions, give the Pro base plan a free-trial offer (owner picks length, for example 7 days). Make sure the RevenueCat offering points at that product.
7. License testing (Setup > License testing): add the owner's own account only, so the owner can test purchases without being charged. Do not add testers here, or their purchases will be test purchases and "trial to paid" will be meaningless.
8. Review and roll out the release. Copy the opt-in link from the Testers tab. Testers must open it, accept, then install from Play.
9. Note: if the developer account is a personal account created after November 2023, Play requires a closed test with at least 12 testers for 14 days before production access. This test can count toward it.

## 4. Message to testers (draft)

> DRAFT - requires legal review before publication
>
> Subject: You are invited to the Thesis closed test
>
> Hi <first name>,
>
> Thank you for agreeing to try Thesis. It is a research app for investors. It gives you a daily Pulse and deep research on the companies you follow.
>
> **How to join**
> 1. Open this link on your Android phone with the Google account you gave us: <opt-in link>
> 2. Tap "Become a tester", then install Thesis from Google Play.
> 3. Create an account and follow a few names you care about.
>
> **What we ask**
> - Use Thesis the way you normally would, for 4 weeks. There is no daily task.
> - Tell us what is useful and what is not: <feedback channel>.
>
> **What we measure, and what we do not**
> - The app sends usage events to our analytics tool (PostHog). Examples: the app opened, the Pulse opened, a name was followed, the upgrade screen was shown.
> - Events are linked to a random account ID, not to your name or email.
> - We do not send your email, your password or any payment details to analytics. Payments are handled by Google Play.
> - You can stop at any time. Uninstall the app and reply to this email to ask us to delete your account and its data.
>
> **Paid plan**
> Thesis Pro has a free trial. If you start a trial and do not cancel it in Google Play, you will be charged at the end of the trial. You decide. Joining the test does not require a payment.
>
> Thank you,
> Razvan

Link the privacy policy in the store listing before rollout.

## 5. Events used in this test

All events come from the Android app (`MobileTelemetry`, PostHog `/capture/`), except the RevenueCat ones in section 5.2. No event carries email, password, name or payment data.

### 5.1 App events

| Event | Where | Properties used here |
|-------|-------|----------------------|
| `app_opened` | `MainActivity.onCreate` | `source` |
| `$identify` | `MainViewModel.refreshUserProfile` (app start with a session, and after login) | `$anon_distinct_id` = installation ID |
| `pulse_opened` | `MainViewModel.refreshPulse` / `loadPulseByDate` / cache fallback | `report_id`, `source` (`network`, `cache`, ...) |
| `watchlist_ticker_added` | `MainViewModel.addWatchlistTicker` | `ticker`, `watchlist_size` (new in this PR) |
| `watchlist_ticker_removed` | `MainViewModel.removeWatchlistTicker` | `ticker`, `watchlist_size` (new in this PR) |
| `paywall_shown` | `MainViewModel.requestFeatureUpgrade` | `feature` |
| `paywall_cta_clicked` | `MainViewModel.startPurchase` | `feature`, `package_type` |
| `purchase_started` | `MainViewModel.startPurchase` | `package_type`, `identifier` |
| `purchase_completed` | `MainViewModel.startPurchase` | `tier`, `package_type`, `period_type` (new in this PR: `TRIAL`, `INTRO` or `NORMAL`) |
| `purchase_failed` | `MainViewModel.startPurchase` | `feature`, `reason` |

Identity: before login, events use the installation ID. After login, events use the user ID (JWT `sub`). The `$identify` event merges the two, so one tester is one person in PostHog. RevenueCat uses the same user ID as its app user ID.

Known limits:
- `pulse_opened` also fires when the app loads the Pulse on start (the Today tab is the default tab). Read it as "Pulse loaded for this tester", not "tapped the Pulse".
- The You tab can start a purchase without showing the paywall. Those purchases have `paywall_cta_clicked.feature = general_upgrade` and no `paywall_shown` before them.
- The app cannot see what happens after a trial ends. Trial to paid comes from RevenueCat (5.2).

### 5.2 RevenueCat events (no code, dashboard setup)

1. RevenueCat > Project > Integrations > PostHog. Paste the same PostHog project API key and host.
2. Keep the default event names. Confirm them on the integration page after setup. Expected: `rc_trial_started_event`, `rc_trial_converted_event`, `rc_trial_cancelled_event`, `rc_initial_purchase_event`, `rc_renewal_event`, `rc_cancellation_event`, `rc_expiration_event`.
3. RevenueCat sends these with the app user ID as `distinct_id`, which is the same user ID the app uses. Sandbox purchases are marked by RevenueCat; filter them out (see 6.0).

Server side: `packages/observability` has only a disabled PostHog stub, and `product-api` sends no PostHog events. Nothing is needed there for this test.

## 6. PostHog insights to build

Put all insights on one dashboard named "Closed test".

### 6.0 Cohort and global filters

- Cohort "Closed testers": persons who performed `$identify` at least once, and whose first `app_opened` is on or after the rollout date. Add a person property filter later if needed.
- Every insight below: filter to cohort "Closed testers". Filter out internal users (PostHog > Settings > "Filter out internal and test users", add the owner's user ID).
- For RevenueCat events, exclude sandbox: property `environment` is not `SANDBOX` (confirm the property name on one real event).

### 6.1 Day-7 retention

- Insight type: Retention.
- Start event: `app_opened` (first time). Return event: `app_opened`.
- Period: Day. Show 0 to 14 days. Read the "Day 7" column.
- Also build a weekly version (Period: Week) for week 1 to week 4.

### 6.2 Pulse opens per week

- Insight type: Trends.
- Series A: `pulse_opened`, Total count, interval Week.
- Series B: `pulse_opened`, Unique users, interval Week.
- Formula: `A / B` = Pulse opens per active tester per week.
- Breakdown (optional): `source`.

### 6.3 Names followed

- Insight type: Trends.
- Series: `watchlist_ticker_added`, aggregation "Unique users", interval Week. This is "testers who followed at least one name".
- Second insight: Trends, `watchlist_ticker_added` and `watchlist_ticker_removed`, property `watchlist_size`, aggregation "Median" (property value), interval Week. This is "names followed per tester".
- Also: SQL insight (HogQL) for the latest size per person:
  ```sql
  SELECT person_id, argMax(properties.watchlist_size, timestamp) AS names_followed
  FROM events
  WHERE event IN ('watchlist_ticker_added', 'watchlist_ticker_removed')
  GROUP BY person_id
  ```

### 6.4 Paywall view to trial start

- Insight type: Funnel. Conversion window: 1 day.
- Step 1: `paywall_shown`.
- Step 2: `paywall_cta_clicked`.
- Step 3: `purchase_completed` where `period_type` = `TRIAL`.
- Breakdown: `feature` on step 1 (which locked feature sells the trial).
- Cross-check: Trends of `rc_trial_started_event`, Unique users. It should match step 3.

### 6.5 Trial to paid

- Insight type: Funnel. Conversion window: trial length + 3 days.
- Step 1: `rc_trial_started_event`.
- Step 2: `rc_trial_converted_event`.
- Also: Trends of `rc_trial_cancelled_event`, Unique users, to see cancels before the end.
- Direct buyers (no trial): Trends of `purchase_completed` where `period_type` = `NORMAL`.

## 7. Success thresholds (owner to fill)

| Metric | Kill below | Good at or above | Actual (week 4) |
|--------|-----------|------------------|-----------------|
| Testers who installed and logged in | `<fill>` | `<fill>` | |
| Day-7 retention | `<fill>` % | `<fill>` % | |
| Pulse opens per active tester per week | `<fill>` | `<fill>` | |
| Testers following at least 1 name | `<fill>` % | `<fill>` % | |
| Median names followed | `<fill>` | `<fill>` | |
| Paywall view to trial start | `<fill>` % | `<fill>` % | |
| Trial to paid | `<fill>` % | `<fill>` % | |

With 20 to 50 testers, one person moves a rate by 2 to 5 points. Read the numbers as direction, not proof. Pair each number with what testers said.

## 8. Weekly review checklist

Do this every week, same day, for 4 weeks.

- [ ] Events arrive: in PostHog > Activity, filter to the last 7 days. `app_opened`, `pulse_opened` and `$identify` are present.
- [ ] Identity works: open 2 or 3 testers in PostHog > Persons. Each has both pre-login and post-login events on one person.
- [ ] No PII: scan event properties of the last week. No email, no name, no free text that could hold personal data (check `reason` and `message` on error events).
- [ ] Update the dashboard numbers in the table in section 7.
- [ ] Retention: note this week's day-7 and week-N numbers. Who dropped? Look at the last events of 3 testers who stopped.
- [ ] Pulse: opens per active tester. Did it go up or down? Any Pulse failures (`api_error`, `prefetch_failed`)?
- [ ] Names: how many testers still follow 0 names? Send them a short nudge if that is part of the plan.
- [ ] Paywall: which `feature` shows the paywall most? Which converts to a trial?
- [ ] Trials: new trials, cancels, conversions in RevenueCat and PostHog. The two should match.
- [ ] Feedback: read all tester feedback. Tag each item: bug, confusing, missing, praise.
- [ ] Decide one change for next week, or decide to change nothing to keep the test clean.
- [ ] Week 4 only: fill the "Actual" column and write a one-page go / no-go note.
