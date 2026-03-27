# ph2_ADR-001: Historical Data Storage Strategy

**Date:** 2026-03  
**Status:** Accepted (revised 2026-03)  
**Deciders:** Product Lead, Data Engineer, Platform Architect

## Context

Phase 2 requires 5+ years of quarterly and annual financials and earnings call transcripts to enrich the Deep Dive AI (Phase 2 M2). Querying this volume from a paid market-data API on every Deep Dive request presents unacceptable cost, rate-limit, and ToS risk.

Work is split across two milestones:

- **M0 — Open-Source Data Foundation:** PostgreSQL DDL plus **bulk load** from **SEC EDGAR** (`companyfacts.zip` archive + deterministic mapping) and the **MIT-licensed** HuggingFace dataset `kurry/sp500_earnings_transcripts` (Parquet). **No paid backfill APIs** where licensing or ToS conflict (e.g. FMP, Polygon, Alpha Vantage for historical corpus build).
- **M1 — Historical Data Pipeline:** Contracts, `GET /v1/historical/*` retrieval, migration **registration**, and **nightly delta sync** on top of M0’s corpus. M1 does not re-own initial bulk backfill.

## Decision

We will build a local historical data store in PostgreSQL with three tables, **tiered bulk load (M0)**, **nightly delta sync (M1)**, and ingestion that **does not persist third-party analyst consensus** in the database.

### Storage

- Historical structured financials are stored as JSONB in `financial_snapshots` (schema in `ph2_BLUEBOOK.md §8`). Source of truth for mapped numbers is **SEC filings** (`provider = "sec_edgar"`).
- Earnings call transcripts are stored as TEXT in `transcripts`, sourced from the **HuggingFace dataset** (`provider = "huggingface_kurry"`) unless a future ADR adds another **legal** path.
- `ticker_coverage` holds one row per ticker: counts, freshness, sync status, and flags such as `has_estimates` / `has_guidance` (expected **false** after M0/M1 when consensus columns are intentionally NULL).
- All three tables use deterministic primary keys for idempotent upsert-on-conflict writes.
- Universe is fixed to **S&P 500** for M0, with reproducible ticker/CIK/tier mapping in `data/sp500_universe.csv`.

### What we do *not* store

- **Third-party analyst consensus, beat/miss vs consensus, or management guidance blobs** are **not** ingested into `analyst_estimates` or `guidance` in M0/M1. Those JSONB columns remain in the schema for forward compatibility but stay **NULL**. Outlook and “vs expectations” style narrative is an **M2 LLM** responsibility using facts + transcripts + live context, not a stored consensus feed.
- **Beta** is **not** persisted in historical snapshots from SEC. **M2** computes beta from **return series** using price history from the existing Phase 1 **`data-openbb`** path at valuation time.

### Bulk load (M0)

- One-time tiered load: Tier 1 (~20) → Tier 2 (S&P 100) → Tier 3 (full universe).
- SEC source: nightly-published `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip` downloaded once per run using required descriptive `User-Agent` (single GET for bulk path).
- M0 bulk path does not require per-CIK throttling; M1 delta fallback keeps `<= 10 req/s` + backoff rules when per-CIK fetches are used.
- HuggingFace: pinned to revision `f3ded372da8d18dc6ad98955c4558e34b5fe6d45`; row count integrity check is logged and load fails on material drift.
- `missing_fields` on every snapshot must be populated explicitly — no silent gaps for normalized financial metrics.
- XBRL normalization uses an internal deterministic mapping table (`data/xbrl_concept_map.json`) with ordered concept fallbacks, informed by edgartools references.

### Delta sync (M1)

- Nightly `scheduler` job (01:00 America/New_York, DST-aware) refreshes **SEC**-mapped snapshots per universe CIK/ticker using the **same deterministic mapper** as M0.
- **Transcript delta** strategy is a **gated M1** decision (e.g. periodic HF refresh vs other allowed source) — still **no paid transcript API** that violates ToS for this path.
- **Latest quarter on earnings day** for headline figures continues to come from **live OpenBB** (Phase 1), not from Postgres filing lag.

### Open sub-decisions

Tracked as gated pre-conditions in `M0_MILESTONE_AGENTS_ph2.md` and `M1_MILESTONE_AGENTS_ph2.md` (notably transcript delta detail, SEC edge cases, universe list).

| # | Sub-Decision | Status | Owner |
|---|---|---|---|
| G1 | **Transcript delta after M0 bulk** — how new quarters are added without a paid API | **OPEN** in M1 | Product Lead + Data Engineer |
| G2 | **Backfill universe** — exact ticker/CIK list | **RESOLVED** (`S&P 500`, `data/sp500_universe.csv`) | Product Lead |
| G3 | **XBRL mapping strategy** — deterministic mapping approach | **RESOLVED** (`data/xbrl_concept_map.json`, edgartools-informed) | Data Engineer |

(Former “pick FMP vs Polygon for backfill” is **closed**: backfill is SEC + HF, not a commercial fundamentals API.)

## Rationale

- **Local storage** keeps Deep Dive historical reads at **under 50ms** for coverage checks (and typically well under 200ms for full history pulls) and avoids rate limits during traffic spikes.
- **PostgreSQL** is sufficient at S&P 500 scale (~hundreds of MB including transcripts).
- **SEC + open dataset** removes recurring **backfill** API cost and avoids ToS issues for **bulk** historical storage.
- **SEC archive bulk path** reduces operational complexity for M0 (single archive pull vs hundreds of per-CIK calls).
- **NULL consensus columns** avoid ingesting and relicensing third-party estimates; the product still delivers narrative quality via **M2** over facts + transcripts.
- **Tiered M0 load** lets M1/M2 development start before the full universe finishes.
- **Nightly sync** matches quarterly filing cadence without streaming complexity.

## Consequences

**Positive:**

- Reproducible, low marginal cost historical corpus.
- No dependency on a single commercial vendor for **stored** 5-year history.
- Idempotent upserts; safe resume after failures.

**Negative:**

- SEC data **lags** earnings announcements; product must keep merging **live OpenBB** + **historical DB** (documented in M1).
- XBRL mapping and segment coverage vary by filer; `missing_fields` and explicit degradation in M2 are required.
- Transcript coverage and freshness depend on the chosen delta strategy and dataset scope.
- `ticker_coverage.has_estimates` / `has_guidance` will typically stay false until a future ADR explicitly adds a legal consensus source.

## Revisit Condition

Reconsider if:

- Universe grows beyond ~2,000 tickers or sync duration forces partitioning or a separate store.
- A **legal** bulk snapshot product eliminates custom SEC parsing.
- Real-time transcript ingestion becomes a hard product requirement.
- The team adopts a **documented, licensed** consensus feed and updates this ADR + schema ingestion rules.
