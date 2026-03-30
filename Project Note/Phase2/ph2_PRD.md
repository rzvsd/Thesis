# Finance Intelligence Platform - Phase 2 PRD

**Version:** 1.2  
**Status:** Active  
**Owner:** Product Lead  
**Last Revised:** 2026-03  

> **Note:** This document defines the new product requirements for Phase 2. The core user flows and definitions from the Phase 1 PRD still apply unless explicitly modified here.

---

## 1. Product Vision Evolution

In Phase 1, Thesis proved we can deliver an AI-powered Deep Dive and a Morning Pulse.  
In Phase 2, Thesis transitions from a "working tool" to an **"indispensable daily habit."**

The focus shifts to:

1. **Analyst-grade quality:** reports must synthesize 5 years of historical context.
2. **Contextual intelligence:** the app must know what time it is, when earnings happen, and what the user cares about.
3. **Monetization:** implement a fair but rigid Free/Pro boundary.
4. **New top-of-funnel:** the Fear & Greed Index as a shareable data product.

**Implementation note:** Phase 2 extends a working Phase 1 app. UX milestones must preserve existing login, Pulse, watchlist, history, settings, and push behavior while they evolve the product.

---

## 2. Feature Specifications

### 2.1 Subscription Tiers (M4)

- **Free Tier:** 1 Deep Dive per day, Morning Pulse delivered at 12:00 PM America/New_York, watchlist capped at 5 names, no export features.
- **Pro Tier:** unlimited Deep Dives, Morning Pulse delivered before 6:30 AM America/New_York, watchlist capped at 20 names, PDF export, Share Cards, Investment Memos, and What-If Scenarios included.
- **Requirement:** Paywall must clearly explain what is gated and offer a seamless Google Play upgrade path.
- **Server truth rule:** entitlement state is enforced by `product-api`, not only by the mobile SDK. RevenueCat SDK may initiate purchase, but server-side tier state is the canonical gating source.

### 2.2 Deep Dive v2 (M2, M7)

- **Historical corpus (M0 / M1):** Multi-year structured financials are **SEC-mapped** into Postgres; transcripts come from the **approved open dataset** path (see `ph2_ADR-001`). **Third-party analyst consensus is not stored** in the database. â€œExpectationsâ€ / outlook-style narrative is produced by the **M2 LLM** from reported results, transcripts, and live market context â€” not from ingested consensus rows.
- **Thesis Statement:** every report must start with a single, bold paragraph answering "What is the core argument here?"
- **Historical Context:** compare the latest quarter to the previous quarter (QoQ) and the same quarter last year (YoY).
- **Valuation (M2):** every Deep Dive that has sufficient structured inputs includes a **Valuation** section. Fair value and WACC-style assumptions are computed by **deterministic code** (`dexter-worker` DCF module); the model only narrates and compares to the **current spot price** from the live quote at generation time (not from historical snapshots). **Equity beta** for the DCF is computed from **price returns** using the Phase 1 **`data-openbb`** path â€” not persisted in historical SEC snapshots. Assumptions must be stated explicitly. If inputs are insufficient, the section is omitted or degraded with a clear note â€” no invented numbers.
- **What-If (M7, Pro):** scenario flows that adjust valuation assumptions (growth, margins, WACC, terminal assumptions, etc.) **re-run the same deterministic DCF logic** as M2 with structured parameter deltas; the API must not rely on an LLM to perform core valuation math.
- **Interactive Report Layout:** long sections such as "What Changed", "Why It Matters", "What's Uncertain", and "Evidence" must be collapsible accordions.
- **User Notes:** users can attach manual text notes to any generated report, which persist in their history.
- **Export:** Pro users can download a PDF, a 1-page Investment Memo, or a 1080x1080 Share Card.
- **Implementation rule:** the richer report UI must be backed by a deliberate contract/versioning or adapter plan. Do not build this milestone as a mock-only screen disconnected from the real `/reports/:id` payload.

### 2.3 3-Tab Architecture (M6)

- **Today Tab:** time-aware. It always has content and re-prioritizes the same core surfaces by market state.
  - Pre-market: Fear & Greed current score plus yesterday delta, earnings preview for watchlist names, overnight alerts, and the latest Morning Pulse summary.
  - Market hours: current Market Pulse, Fear & Greed summary, active contrarian alerts, and earnings reminders for today/tomorrow.
  - After hours: end-of-day Pulse wrap, final daily Fear & Greed reading, tomorrow's earnings preview, and weekly digest teaser on Sunday.
- **Research Tab:** the entry point for Deep Dives. Contains search, recent report history, the Deep Dive report result, and the "Run a Deep Dive" path.
- **Portfolio Tab:** unified personal space. Contains subscription status, watchlist/My Names management, notification/settings surfaces, and account controls.
- **Portfolio naming rule:** `Portfolio` is a user-facing navigation label only. It does not introduce real holdings, cost basis, brokerage connectivity, or portfolio-performance tracking.
- **Migration rule:** M6 is an atomic refactor of the working current navigation. Existing Pulse, Deep Dive, Watchlist, History, and Settings flows must be explicitly remapped into the 3-tab structure before the old layout is retired. There is no adapter-layer coexistence plan in the approved M6 path.

### 2.4 Fear & Greed Index (M3, M8)

- **Data (M3 locked scope):** a deterministic 6-signal composite using only market-data signals:
  - VIX (`^VIX`, yfinance)
  - S&P 500 momentum (`^GSPC` vs 125-day SMA, yfinance)
  - Market breadth (% of supported universe above 200-day SMA, yfinance batch pull)
  - Safe-haven demand (SPY vs TLT 20-day return differential, yfinance)
  - Junk-bond spread (`BAMLH0A0HYM2`, FRED)
  - Yield curve (`T10Y2Y`, FRED)
- **Explicit defer (not M3):** put/call ratio, social sentiment, and news-sentiment factors.
- **Weighting (M3):** equal-weight average of the six normalized sub-scores (1/6 each).
- **Runtime:** calculated once per trading day after market close (America/New_York wall-clock time, DST-aware).
- **UI:** a gauge (0-100) with labels from Extreme Fear to Extreme Greed, a historical line chart, and a breakdown of the sub-components.
- **Access:** free for all users to drive daily opens.

### 2.5 Smart Notifications (M5)

- **Earnings Previews:** "MSFT reports tomorrow. Tap to run a Deep Dive before the call."
- **Contrarian Alerts:** "Your thesis on AAPL (Positive) is diverging. The stock is down 6% today."
- **Weekly Digest:** a scheduled summary for Pro users covering the best recent insights and upcoming catalysts, delivered via FCM push with deep-link destination.
- **Contrarian rule (M5):** fire only when a persisted anchor moves 5% cumulatively in the opposite direction from `anchor_price`, within a 90-day validity window.
- **Notification inventory (M5):** `earnings_preview`, `contrarian_alert`, `weekly_digest`, `market_pulse_ready`.
- **Persistence rule:** contrarian alerts must evaluate a persisted server-side thesis anchor, not whichever report the user last opened locally.

---

## 3. Business Rules

1. **Never fabricate history:** if historical data is missing for a ticker, the Deep Dive must omit the comparison and state what is missing.
2. **Paywall rigidity:** all export features, What-If scenarios, and >1 daily Deep Dive are strictly Pro-only.
3. **Anonymity:** community sentiment votes are always aggregated. No individual user votes are exposed.
4. **Offline support (M9):** the app must cache the most recent Morning Pulse and all previously viewed Deep Dives locally via Android Room.
5. **Regression rule:** if a Phase 2 milestone changes an existing Phase 1 flow, the previous flow must still complete successfully after the change.
6. **Never fabricate valuation:** fair value, implied upside/downside vs spot, and DCF assumptions shown to the user must come from the deterministic valuation module (or an explicitly approved successor). The LLM must not invent or adjust those figures.

---

## 4. Non-Functional Requirements

These extend the Phase 1 non-functional requirements (`PRD.md Â§10`). Phase 1 targets still apply unless explicitly updated here.

### Performance

| Metric | Target | Phase 1 baseline |
|---|---|---|
| Historical data retrieval from Postgres | < 200ms per query (financials or transcripts for one ticker) | N/A â€” new in Phase 2 |
| Deep Dive report generation (with historical enrichment) | Under 90 seconds, 95% of the time | Same as Phase 1 (must not regress) |
| Fear & Greed score retrieval | < 100ms (single DB read) | N/A â€” new in Phase 2 |
| App launch to home screen | Under 2 seconds on mid-range Android | Same as Phase 1 |

### Data Freshness

| Metric | Target |
|---|---|
| Historical financial data staleness | At most ~24 hours (nightly delta sync at 01:00 ET) |
| Fear & Greed index staleness | At most ~24 hours (nightly calculation after market close; 18:00 America/New_York DST-aware scheduler window) |
| Earnings calendar freshness | At most ~24 hours (nightly sync) |
| Morning Pulse freshness | Same as Phase 1 â€” generated daily at 06:30 ET |

### Data Completeness

| Metric | Target |
|---|---|
| Financial snapshot coverage | â‰¥ 95% of the backfill universe has â‰¥ 20 quarterly records spanning 5+ years |
| Transcript coverage | â‰¥ 90% of the backfill universe has â‰¥ 15 transcript records (transcripts are less universally available) |
| Missing data declaration | Every financial snapshot has a `missing_fields` array; every transcript has an `is_complete` flag. No silent gaps. |
| DCF-oriented snapshot fields | Optional keys in snapshot `data` (e.g. D&A, interest expense, effective tax rate) are populated when **SEC mapping** yields them; **beta** is not stored historically â€” M2 derives it from returns + **`data-openbb`**. Absence is normal and must not block the rest of the report. |

### Reliability

| Metric | Target |
|---|---|
| Nightly delta sync success rate | â‰¥ 95% of scheduled runs complete without error |
| Backfill resumability | Interrupted backfill can resume without data corruption or duplicates |
| Phase 1 path preservation | Deep Dive and Market Pulse must continue to meet their Phase 1 SLA after every Phase 2 milestone |

---

## 5. Edge Cases

### Data Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User opens app with no network | Load Today tab from Room cache; display offline state with timestamp of last sync |
| Historical-data fetch fails during Deep Dive | Deep Dive degrades to the best available Phase 1-quality report and flags missing historical evidence |
| Ticker has no historical data (recent IPO, not in backfill universe) | Deep Dive still generates using Dexter's live data retrieval (Phase 1 path). Report states "Historical comparison unavailable â€” this company has limited filing history" in the comparison sections. No fabricated comparisons. |
| Historical data exists but is stale (delta sync failed for multiple nights) | Deep Dive uses the available historical data but flags "Data as of [date]" on the historical sections. Sentry alert fires for sync failure. |
| Transcript is truncated or partial | `is_complete: false` flag is set. Dexter in M2 treats the transcript as partial evidence and states so in the report. |
| Financial snapshot has many missing fields | `missing_fields` array is populated. Comparison sections that depend on missing fields are omitted with an explicit note, not filled with zeros or estimates. |
| DCF inputs insufficient (e.g. missing beta, tax rate, or FCF history) | Valuation section is omitted or marked degraded with reason. No placeholder fair value. Rest of Deep Dive still completes. |
| Pro user runs a What-If on DCF parameters | Server recomputes using deterministic DCF; response shows base vs scenario metrics. Timeouts show a clear error, not partial made-up numbers. |

### System Edge Cases

| Scenario | Expected Behavior |
|---|---|
| RevenueCat webhook fails | App checks active entitlement via SDK on startup and may request a backend sync; final entitlement still comes from server truth |
| M6 navigation refactor in progress | Notification opens, history resume, and settings access must remain reachable throughout migration |
| Backfill script crashes mid-run | On restart, the script resumes from the last successful ticker. Upsert-on-conflict prevents duplicate rows. No manual data cleanup required. |
| Delta sync and Deep Dive run concurrently | No conflict â€” delta sync writes new rows; Deep Dive reads existing rows. Postgres handles concurrent access. |
| SEC rate limit or throttle during M0/M1 ingest | Client obeys 10 req/s and backoff; does not skip tickers silently. |

### Monetization Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Free user attempts second Deep Dive in one day | Server returns HTTP 403 with a clear message; mobile shows paywall with upgrade path |
| User upgrades mid-day | Server tier updates immediately via webhook; gated features unlock without app restart |
| User cancels Pro subscription | Access continues until the end of the current billing period; then downgrades to Free limits |
| User is offline when subscription expires | Cached tier state may show Pro briefly; next server sync corrects it; no permanent entitlement leak |
