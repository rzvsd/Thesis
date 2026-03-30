# Finance Intelligence Platform - Phase 2 Bluebook

**Version:** 1.2  
**Status:** Living Document  
**Last Revised:** 2026-03  
**Owner:** Platform Architect

> **Note:** This document extends - it does not replace - the original `BLUEBOOK cld.md` from Phase 1. Base architecture, ownership, and core service boundaries remain unchanged.

---

## Table of Contents

1. [Phase 2 Architecture Extensions](#1-phase-2-architecture-extensions)
2. [New Service Catalog Entries](#2-new-service-catalog-entries)
3. [New Contract Schemas](#3-new-contract-schemas)
4. [Monetization Integration Strategy](#4-monetization-integration-strategy)
5. [Historical Data Strategy](#5-historical-data-strategy)
6. [Fear & Greed Index Architecture](#6-fear--greed-index-architecture)
7. [Phase 1 Compatibility Guardrails](#7-phase-1-compatibility-guardrails)
8. [Phase 2 Data Model Extensions](#8-phase-2-data-model-extensions)
9. [Phase 2 Dependency Risk Register](#9-phase-2-dependency-risk-register)
10. [Phase 2 Scale Assumptions](#10-phase-2-scale-assumptions)

---

## 1. Phase 2 Architecture Extensions

The core three-plane architecture (Reasoning, Data, Product) remains, but expands to support deeper data history, new indices, and monetization.

### Data Plane Extensions

- **Historical backfill:** introduction of persistent storage (PostgreSQL) for financial history and transcripts.
- **Fear & Greed pipeline:** a cron-driven pipeline to pull market sentiment indicators and calculate a daily composite score.
- **Calendar data:** upcoming event data needed by notifications and Today-tab context.

### Product Plane Extensions

- **Subscription gateway:** `product-api` implements tier-checking middleware using RevenueCat-backed server truth.
- **Smart notifications:** `scheduler` triggers personalized FCM messages based on user watchlists, calendar events, and persisted alert anchors.
- **Richer report surfaces:** mobile consumes an expanded or adapted Deep Dive model without bypassing contracts.

---

## 2. New Service Catalog Entries

Phase 2 introduces potential new packages/services to keep boundaries clean:

| Service/Package | Type | Responsibility |
|---|---|---|
| `packages/historical-data` | Package / Module | Shared normalization and retrieval helpers for historical financial data if used by more than one service |
| `packages/fear-greed-engine` | Package | Stores the composite math formula for the sentiment index |
| `webhook-receiver` | Route (`product-api`) | Listens for RevenueCat subscription events and updates user tiers in the DB |

**Constraint:** A new package is allowed only if it is a true shared boundary. Single-service implementation details remain inside that service.

---

## 3. New Contract Schemas

These must be defined in `packages/contracts` before any service produces or consumes them.

| Schema Name | Purpose | Producer | Consumer |
|---|---|---|---|
| `CanonicalFinancialSnapshot` | Historical quarterly and annual data from **SEC-mapped** JSONB `data` (incl. D&A, interest, effective tax rate where mapping allows). `analyst_estimates` / `guidance` optional in schema; **M0/M1 leave NULL** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â M2 LLM for outlook. **Beta** computed at M2 from returns via **`data-openbb`**, not stored in historical rows | `product-api` historical store + SEC ingest (M0/M1) | `dexter-worker`, `product-api` |
| `CanonicalTranscript` | Earnings call transcript text with completeness flag | `data-openbb` / historical-data path | `dexter-worker`, `product-api` |
| `TickerCoverage` | Per-ticker sync health: snapshot count, transcript count, latest period, guidance/estimates availability, last sync status, backfill tier | `data-openbb` / backfill + delta sync | `product-api`, `dexter-worker` (M2 pre-check) |
| `FearGreedSnapshot` | Daily 0-100 deterministic composite index + sub-scores + missing_inputs audit trail | `scheduler` / `fear-greed-engine` | `product-api`, `mobile` |
| `AnalysisReport` (v2) | **M2 versioned extension** of the Phase 1 contract ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â adds optional `historical_context` metadata, optional `valuation` metadata (structured DCF output from deterministic code), and new section types (Thesis Statement, What Changed, Valuation). `schema_version` bumped to `"2.0"`. All new fields optional for backward compatibility. | `dexter-worker` | `product-api`, `mobile` |
| `SubscriptionTier` | Enum: `FREE`, `PRO` | `product-api` | `product-api`, `mobile` |
| `CalendarEvent` | Timestamped corporate events such as earnings | `data-openbb` | `scheduler`, `product-api`, `mobile` |
| `ContrarianAlertAnchor` | Persisted thesis/signal anchor used for alert evaluation | `product-api` | `scheduler`, `product-api` |

**Compatibility rule:** If Phase 2 extends a current Phase 1 contract, the change must include a compatibility plan for existing consumers such as the mobile report parser and Product API routes. For `AnalysisReport` v2 specifically, see `M2_MILESTONE_AGENTS_ph2.md` Gated Pre-Condition G1 for the chosen evolution strategy.

---

## 4. Monetization Integration Strategy

**Provider:** RevenueCat.

### Server-authoritative entitlement flow

1. Mobile app handles purchase via RevenueCat SDK.
2. RevenueCat sends a webhook to `product-api`.
3. `product-api` updates durable user-tier state in Postgres.
4. Mobile app requests `GET /v1/user/profile` to confirm the new tier.
5. `product-api` middleware blocks Pro-only endpoints for Free users (HTTP 403).

### Failure mode

If the webhook fails, the mobile client may pass the RevenueCat App User ID to `/v1/user/sync-tier` so `product-api` can force a server-side verification pull. Mobile SDK state is not the final entitlement authority.

### Compatibility rule

Monetization work must not break existing Phase 1 auth and session flows:

- register
- verify
- login
- refresh
- logout
- push token registration
- Pulse retrieval
- watchlist CRUD
- report history retrieval

---

## 5. Historical Data Strategy

Phase 1 relied on on-the-fly API calls. Phase 2 requires local persistence of historical data to guarantee fast report generation and to avoid paid bulk backfill APIs.

### M0 vs M1

- **M0** creates `ph2m0_*` migrations and **bulk-loads** from **SEC EDGAR** (`data.sec.gov` XBRL) and **HuggingFace** `kurry/sp500_earnings_transcripts` (see `ph2_MILESTONES.md ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ M0`, `ph2_ADR-001`).
- **M1** registers those migrations, ships contracts and **`GET /v1/historical/*`**, and runs **nightly delta sync** (SEC + agreed transcript strategy). M1 does not re-run the initial bulk backfill.

### Storage

- `financial_snapshots`: JSONB `data` with quarterly/annual metrics from **SEC mapping**; optional DCF-oriented keys where XBRL allows (D&A, interest, effective tax rate). **Beta** is not stored here ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â M2 derives it from price returns via **`data-openbb`**.
- `transcripts`: earnings call text from the **HF bulk dataset** (and M1 delta policy). Schema column `provider` documents the source (e.g. `huggingface_kurry`).
- `analyst_estimates` and `guidance` columns exist for forward compatibility; **M0/M1 ingestion keeps them NULL** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â no third-party consensus store (see `ph2_ADR-001`).

### Deterministic DCF (M2; reused in M7)

- Core valuation math lives in **`apps/dexter-worker/src/dcf/`** as pure functions (no LLM). Inputs: `CanonicalFinancialSnapshot[]` from historical APIs plus **current spot price** and shares outstanding from the existing live-data path; **beta** from return series using **`data-openbb`** prices where required.
- M2 adds a **Valuation** report section whose numbers are **only** those emitted by the DCF module; the LLM narrates and contextualizes.
- M7 **What-If** scenarios that adjust DCF assumptions re-run the **same** deterministic logic (module may be extracted to a shared package or invoked from `product-api` if engineering chooses ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â contract is ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“same math as M2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â).

### Update frequency

- Initial bulk load: one-time **M0** tiered pipeline
- Delta sync: nightly at 1 AM America/New_York via `scheduler` (**M1**)

### Live vs historical

- **Headline current-quarter** figures on earnings day remain from Phase 1 **`data-openbb`** (live path). Historical snapshots follow **SEC filing** availability; Dexter merges live + DB per product rules.

### Compatibility rule

Historical enrichment must degrade safely. If history is missing for a ticker, Phase 1 report generation must still complete and surface missing-data truthfully.

---

## 6. Fear & Greed Index Architecture

**Approved M3 inputs (locked):**
- VIX (`^VIX`, yfinance)
- S&P 500 momentum (`^GSPC` vs 125-day SMA, yfinance)
- Market breadth (% of supported universe above 200-day SMA, yfinance batch download)
- Safe-haven demand (SPY vs TLT 20-day return differential, yfinance)
- Junk-bond spread (`BAMLH0A0HYM2`, FRED)
- Yield curve (`T10Y2Y`, FRED)

**Deferred from M3 by design:** put/call ratio, social sentiment, and news-sentiment factors.

### Engine

- A pure function in `packages/fear-greed-engine`
- Takes normalized inputs (each mapped to a 0-100 sub-score), applies equal weighting (1/6 each), and outputs a composite 0-100 score plus a label (`extreme_fear`, `fear`, `neutral`, `greed`, `extreme_greed`)
- Label thresholds: 0-20 Extreme Fear, 21-40 Fear, 41-60 Neutral, 61-80 Greed, 81-100 Extreme Greed
- Must be deterministic: same inputs always produce the same score

### Degradation

- If one or more inputs are unavailable, missing inputs are skipped and remaining inputs are re-weighted (minimum three inputs required to publish a score)
- Every snapshot includes a `missing_inputs` array and per-input `available` flag in `sub_scores`
- No fabricated scores; if too many inputs are missing, the calculation fails explicitly for that day

### Storage and serving

- Nightly snapshot saved to `fear_greed_daily` (see section 8 for schema)
- Scheduler cron at 18:00 America/New_York (DST-aware wall-clock time); skips non-trading days
- `product-api` serves two endpoints:
  - `GET /v1/sentiment/current` - most recent snapshot only
  - `GET /v1/sentiment/history?days=90` - latest N-day historical series
- See `Decisions/ph2_ADR-002-fear-greed-engine.md` for the full architecture decision

---

## 7. Phase 1 Compatibility Guardrails

Phase 2 only makes sense if it preserves the current working app while extending it.

### M4 guardrail - auth/schema expansion

- User tier and billing identity become new server-side state
- This requires migration work, Product API profile read models, and middleware
- Do not gate features only on mobile-side SDK state

### M5 guardrail - persisted thesis anchor

- Contrarian alerts must evaluate a durable server-side anchor record
- The anchor must at minimum store: `user_id`, `ticker`, `report_id` or source signal ID, `signal_value`, `anchor_price`, `anchored_at`, `expires_at`
- Do not compute alerts from app memory or "last viewed report"

### M6 guardrail - navigation migration

- The current app is a working 5-tab Android app, not a blank shell
- Before deleting or hiding current tabs, define the destination mapping:
  - Market Pulse -> Today
  - Deep Dive + search -> Research
  - Watchlist/My Names -> Portfolio
  - History -> Research
  - Settings -> Portfolio
- `Portfolio` is UX framing only. It is not a real holdings, brokerage, or P&L surface.
- M6 uses an approved atomic switch. There is no adapter-layer coexistence plan for this milestone.
- Notification deep links and resume paths must keep landing on reachable screens

### M7 guardrail - contract/model evolution

- The current report contract is section-oriented and the current mobile model is intentionally thin
- Richer report UX requires either:
  - a versioned contract expansion, or
  - an explicit adapter layer from the current contract to a richer mobile view model
- Notes, scenarios, export, and sentiment vote each need named storage and endpoint ownership before the screen is considered implementation-ready

### Regression obligation

Any Phase 2 milestone that changes the working app must re-run the affected Phase 1 smoke paths before close.

---

## 8. Phase 2 Data Model Extensions

These extend the Phase 1 data model defined in `BLUEBOOK cld.md ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§7`. Phase 1 core entities (`users`, `tickers`, `watchlists`, `jobs`, `reports`, `audit_events`) remain unchanged. Phase 2 adds new tables only ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â no ALTER statements on existing Phase 1 tables.

### `financial_snapshots` (M0 DDL; M1 serve/sync)

```
financial_snapshots
  snapshot_id         TEXT PK             -- deterministic hash of ticker + period + period_type
  ticker              TEXT NOT NULL       -- e.g. "AAPL", references tickers.symbol logically
  period              TEXT NOT NULL       -- e.g. "2024-Q3" or "2024-FY"
  period_type         TEXT NOT NULL       -- "quarterly" or "annual"
  fiscal_year         INTEGER NOT NULL
  fiscal_quarter      INTEGER             -- 1-4 for quarterly; NULL for annual
  provider            TEXT NOT NULL       -- e.g. "sec_edgar" for M0/M1 ingest
  filing_date         TEXT                -- ISO 8601 date of SEC filing, if available
  retrieved_at        TIMESTAMPTZ NOT NULL
  data                JSONB NOT NULL      -- structured financial metrics (see CanonicalFinancialSnapshot.data)
  segments            JSONB               -- segment breakdown array, if available
  analyst_estimates   JSONB               -- reserved; NULL under ph2_ADR-001 (no third-party consensus in DB)
  guidance            JSONB               -- reserved; NULL under ph2_ADR-001 (M2 LLM + transcripts)
  missing_fields      JSONB NOT NULL DEFAULT '[]'  -- explicitly declared missing fields from .data; analyst_estimates/guidance NULL is expected, not listed here
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

  UNIQUE (ticker, period, period_type)
```

**Indexes:**
- `idx_financial_snapshots_ticker` on `(ticker)`
- `idx_financial_snapshots_ticker_period` on `(ticker, period)`
- `idx_financial_snapshots_ticker_fiscal_year` on `(ticker, fiscal_year)`

**Design notes:**
- `snapshot_id` is a deterministic hash so that backfill and delta sync can use upsert-on-conflict (INSERT ... ON CONFLICT DO UPDATE) for idempotency.
- `data` is JSONB matching `CanonicalFinancialSnapshot.data`, populated from **SEC XBRL** mapping. Optional keys for DCF (when derivable) include `depreciation_amortization`, `interest_expense`, `effective_tax_rate`. **Beta** is not stored ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â M2 computes from **`data-openbb`** returns.
- `analyst_estimates` and `guidance` remain **NULL** for M0/M1 loads per `ph2_ADR-001`. M2 does not rely on stored consensus rows.
- `missing_fields` only covers absent fields within `data`.

### `transcripts` (M0 DDL; M1 serve/sync)

```
transcripts
  transcript_id       TEXT PK             -- deterministic hash of ticker + period
  ticker              TEXT NOT NULL
  period              TEXT NOT NULL       -- e.g. "2024-Q3"
  fiscal_year         INTEGER NOT NULL
  fiscal_quarter      INTEGER NOT NULL
  call_date           TEXT                -- ISO 8601 date of the earnings call
  provider            TEXT NOT NULL       -- e.g. "huggingface_kurry" for M0 bulk load
  retrieved_at        TIMESTAMPTZ NOT NULL
  body_text           TEXT NOT NULL       -- full transcript text
  word_count          INTEGER NOT NULL
  is_complete         BOOLEAN NOT NULL DEFAULT true  -- false if truncated or partial
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

  UNIQUE (ticker, period)
```

**Indexes:**
- `idx_transcripts_ticker` on `(ticker)`
- `idx_transcripts_ticker_period` on `(ticker, period)`

**Design notes:**
- `body_text` is stored as plain TEXT, not JSONB. Transcripts are read as full documents, not queried by sub-field.
- `is_complete` flags transcripts truncated by the provider so downstream consumers (Dexter in M2) can treat them as partial evidence.

### `ticker_coverage` (M0 DDL; M1 serve/sync)

```
ticker_coverage
  ticker              TEXT PK             -- one row per ticker; not a foreign key (tickers may exist before being in the registry)
  snapshot_count      INTEGER NOT NULL DEFAULT 0  -- total rows in financial_snapshots for this ticker
  transcript_count    INTEGER NOT NULL DEFAULT 0  -- total rows in transcripts for this ticker
  latest_period       TEXT                -- most recent period in financial_snapshots, e.g. "2024-Q3"; NULL if no data
  earliest_period     TEXT                -- oldest period in financial_snapshots; NULL if no data
  has_guidance        BOOLEAN NOT NULL DEFAULT false  -- typically false when guidance JSONB unused (ph2_ADR-001)
  has_estimates       BOOLEAN NOT NULL DEFAULT false  -- typically false when analyst_estimates JSONB unused (ph2_ADR-001)
  last_synced_at      TIMESTAMPTZ NOT NULL   -- timestamp of the last successful (or attempted) sync for this ticker
  last_sync_status    TEXT NOT NULL          -- "success", "partial", or "failed"
  backfill_tier       INTEGER NOT NULL       -- 1, 2, or 3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â which priority tier this ticker belongs to
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Indexes:**
- Primary key on `(ticker)` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â single-row lookups are O(1)

**Design notes:**
- This table is updated atomically (upsert) at the end of each ticker's backfill and after each nightly delta sync. It always reflects current reality.
- M2's historical context injection stage queries this table first (single fast row) to decide whether full history is available before issuing the larger `financial_snapshots` query. This avoids unnecessary table scans.
- `last_sync_status: "partial"` means some data was written but some ingest steps failed. The ticker has data but it may be incomplete.
- `backfill_tier` enables the **M0** tiered load order: Tier 1 first so M1/M2 can start before the full universe completes.

### `fear_greed_daily` (M3)

```
fear_greed_daily
  id                  TEXT PK                 -- deterministic hash of market_date
  score               NUMERIC(5,2) NOT NULL   -- 0.00 to 100.00
  label               TEXT NOT NULL           -- "extreme_fear", "fear", "neutral", "greed", "extreme_greed"
  sub_scores          JSONB NOT NULL          -- per-input breakdown (input_name, raw_value, normalized_score, weight, provider, available)
  missing_inputs      JSONB NOT NULL DEFAULT '[]'  -- explicitly declared missing inputs; empty if all present
  calculated_at       TIMESTAMPTZ NOT NULL
  market_date         DATE NOT NULL UNIQUE    -- the trading day this score represents
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Indexes:**
- `idx_fear_greed_market_date` on `(market_date)` (unique)
- `idx_fear_greed_calculated_at` on `(calculated_at)`

**Design notes:**
- `id` is a deterministic hash of `market_date` so nightly calculation is idempotent (upsert on conflict).
- `sub_scores` JSONB preserves the full audit trail ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â any consumer can verify how the composite was derived.
- `missing_inputs` is mandatory. An empty array means all approved inputs were available for that day's calculation.

### `calendar_events` (M5)

```
calendar_events
  id                  TEXT PK
  ticker              TEXT NOT NULL
  event_type          TEXT NOT NULL           -- "earnings", "dividend", "split", etc.
  event_date          DATE NOT NULL
  event_time          TEXT                    -- "before_market", "after_market", "during_market", NULL if unknown
  provider            TEXT NOT NULL
  retrieved_at        TIMESTAMPTZ NOT NULL
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

  UNIQUE (ticker, event_type, event_date)
```

**Design notes:**
- M5 uses yfinance `Calendars` batch retrieval for upcoming earnings events.
- Sync is filtered to the supported universe from `ticker_coverage`.
- Data is advisory; notification copy must use expectation wording (for example, "is expected to report").

### `contrarian_alert_anchors` (M5)

```
contrarian_alert_anchors
  id                  TEXT PK
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  ticker              TEXT NOT NULL
  report_id           TEXT                    -- FK to reports.id, nullable if signal is from a non-report source
  signal_value        TEXT NOT NULL           -- "positive", "neutral", "negative"
  anchor_price        NUMERIC NOT NULL        -- close price at anchor creation, used for percentage-move evaluation
  anchored_at         TIMESTAMPTZ NOT NULL
  expires_at          TIMESTAMPTZ NOT NULL
  is_active           BOOLEAN NOT NULL DEFAULT true
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `subscriptions` or user tier extension (M4)

The subscription schema design is an open decision (see `M4_MILESTONE_AGENTS_ph2.md` Gated Pre-Condition G4). Two options:

**Option A ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â new `subscriptions` table:**
```
subscriptions
  user_id             TEXT PK REFERENCES users(id) ON DELETE CASCADE
  tier                TEXT NOT NULL DEFAULT 'FREE'  -- "FREE" or "PRO"
  revenuecat_app_user_id  TEXT
  billing_period_end  TIMESTAMPTZ             -- NULL for FREE; set for PRO
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Option B ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â columns on existing `users` table:**
```
ALTER TABLE users
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN revenuecat_app_user_id TEXT,
  ADD COLUMN billing_period_end TIMESTAMPTZ;
```

**Design notes:**
- Server is the canonical entitlement authority. Mobile SDK state is not.
- `tier` is enforced by `product-api` middleware at the route level.
- `billing_period_end` allows Pro access to continue after cancellation until the period expires.

### `notification_preferences` (M5)

```
notification_preferences
  id                  TEXT PK
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  notification_type   TEXT NOT NULL           -- "earnings_preview", "contrarian_alert", "weekly_digest", etc.
  enabled             BOOLEAN NOT NULL DEFAULT true
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

  UNIQUE (user_id, notification_type)
```

**Design notes:**
- Default is all notification types enabled for new users.
- Scheduler checks preferences before sending any push notification.
- M5 notification inventory is fixed: `earnings_preview`, `contrarian_alert`, `weekly_digest`, `market_pulse_ready`.

### Design Principles (extending Phase 1)

- All new primary keys are deterministic hashes or UUIDs ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â no sequential integer IDs.
- New tables use `created_at` and `updated_at` where appropriate.
- JSONB is used for flexible nested structures (`data`, `segments`, `sub_scores`); TEXT is used for large unstructured content (`body_text`).
- Every table that supports upsert has a UNIQUE constraint suitable for ON CONFLICT.
- No new table references Phase 1 tables via hard foreign keys except `users(id)` where user ownership is required. Logical references to `tickers.symbol` are by value, not FK, to avoid coupling backfill order to ticker registry state.

---

## 9. Phase 2 Dependency Risk Register

This extends the Phase 1 Dependency Risk Register (`BLUEBOOK cld.md ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§13`). Phase 1 risks (OpenBB provider risk, news-ingest risk, LLM provider risk) still apply and are not repeated here.

### Historical Data Ingest Risk (M0 / M1)

Structured history comes from **SEC EDGAR**; transcripts from **HuggingFace** bulk data plus the **M1** delta strategy. Risks differ from a single commercial API.

| Risk | Mitigation |
|---|---|
| SEC blocks or throttles requests (403/429) | Compliant `User-Agent`, **ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ãƒâ€šÃ‚Â¤10 req/s** to `data.sec.gov`; backoff; staging IP allowlisting if needed |
| XBRL mapping drift or filer-specific tags | Versioned mapping tables; golden fixtures per ticker; `missing_fields` explicit; never silent LLM ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“fixesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â to numbers |
| HF dataset revision changes | Pin revision + document checksum; loader fails closed on mismatch |
| Filing lag vs earnings day | Product uses **live `data-openbb`** for headline quarter; historical DB for trend ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â documented in M1 |
| Nightly delta partial failure | `ticker_coverage.last_sync_status`; Sentry; idempotent upsert |

### Transcript Corpus Risk (M0 / M1)

| Risk | Mitigation |
|---|---|
| Dataset does not cover all tickers or periods | Coverage targets in `ph2_MILESTONES.md ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ M0`; graceful degradation in M2 |
| Truncated or partial text | `is_complete: false`; M2 treats as partial evidence |
| Delta path for new quarters | **Gated M1** decision ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â must stay within legal/ToS constraints (no unapproved paid bulk API) |

### RevenueCat Risk (M4)

| Risk | Mitigation |
|---|---|
| Webhook delivery failure | Fallback `/v1/user/sync-tier` endpoint forces server-side verification; mobile SDK state is never the final entitlement authority |
| RevenueCat outage | Subscription state is durable in Postgres; existing tier continues to apply; no silent downgrade |
| RevenueCat pricing change | Vendor lock-in is moderate; migration to direct Google Play Billing API is possible but expensive |

### Calendar Data Risk (M5)

| Risk | Mitigation |
|---|---|
| Earnings dates are wrong or missing | Calendar data is advisory, not trade-triggering; notifications include "expected" language; multiple source cross-check if available |
| Provider does not cover all tickers | Calendar events are best-effort; missing events do not break the app ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â they simply don't trigger a notification |

---

## 10. Phase 2 Scale Assumptions

These extend the Phase 1 scale assumptions (`BLUEBOOK cld.md ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§14`). Phase 1 assumptions (< 10,000 users, < 1,000 DAU, < 20 concurrent Deep Dives, etc.) remain the baseline.

### Storage Growth (M0 corpus)

| Dataset | Estimate |
|---|---|
| `financial_snapshots` at S&P 500 scale | 500 tickers ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 25 periods ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ~5KB/row ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ãƒâ€¹Ã¢â‚¬Â  62 MB |
| `transcripts` at S&P 500 scale | 500 tickers ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 20 transcripts ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ~50KB/row ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ãƒâ€¹Ã¢â‚¬Â  500 MB |
| Annual growth (new quarters + new filings) | ~4 quarters ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 500 tickers ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 5KB + transcripts ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°Ãƒâ€¹Ã¢â‚¬Â  60 MB/year |
| `financial_snapshots` + `transcripts` at 12 months | < 700 MB total |

**Implication:** Storage is not a concern. A single Postgres instance handles this easily within Phase 1's < 50GB assumption.

### Query Volume (M2+)

| Query Pattern | Estimate |
|---|---|
| Historical retrieval per Deep Dive | 1-2 queries (financials + transcripts for one ticker) |
| Additional Postgres load at < 1,000 DAU | < 2,000 historical queries/day |
| Latency target | < 200ms per query (indexed Postgres, same instance) |

**Implication:** No read replica needed for historical data. Existing Postgres instance is sufficient.

### SEC / HF ingest volume (M0 / M1)

| Pattern | Notes |
|---|---|
| M0 bulk | One-time SEC `companyfacts` fetches per CIK (rate-limited client); HF download bandwidth |
| M1 nightly delta | SEC re-fetch or diff per active CIK within 10 req/s budget |
| Ongoing $ | **$0** for SEC; HF dataset is open ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â infra/bandwidth only |

**Implication:** No commercial ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“historical backfillÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â API subscription is required for the stored corpus. Phase 1 **`data-openbb`** usage for **live** quotes and **M2 beta** remains governed by Phase 1 ADRs.

### Monetization Scale (M4)

| Metric | Assumption |
|---|---|
| Free users | 80-90% of registered users |
| Pro subscribers | 10-20% of registered users |
| Deep Dive requests per Free user | 1/day (hard limit) |
| Deep Dive requests per Pro user | Estimated 3-5/day average |

**Implication:** Total Deep Dive volume roughly doubles compared to Phase 1 (where all users were unlimited). Dexter worker scaling remains within the existing horizontal-scaling model.
