# Thesis - Phase 2 Milestone Briefs

**Version:** 1.2  
**Status:** Active  
**Last Revised:** 2026-03  
**Related Documents:** ph2_ROADMAP.md, ph2_BLUEBOOK.md, ph2_PRD.md

---

## How to Read This Document

Each milestone defines what is being built, what must be true for it to close, and how to recover if something goes wrong.

- **Deliverable** - A concrete thing that exists at the end
- **Acceptance Criteria** - Binary. True or not true
- **Smoke Test** - A scripted check through the critical path
- **Dependencies** - What must be true before the milestone can begin
- **Phase 1 Regression Obligations** - What existing paths must still work if this milestone touches them

**A milestone is not closed unless every Acceptance Criteria item is checked off.**

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M0 | Open-Source Data Foundation | PostgreSQL historical tables created and bulk-loaded from SEC EDGAR XBRL + HuggingFace transcripts ($0 backfill) |
| M1 | Historical Data Pipeline | Contracts, retrieval APIs, nightly delta sync, and ongoing freshness on top of M0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s corpus |
| M2 | Report Quality Engine | Analyst-grade Deep Dive reports with QoQ, YoY, segments, Thesis Statement, and deterministic DCF Valuation |
| M3 | Fear & Greed Index Engine | Deterministic 6-signal market-data sentiment index |
| M4 | Monetization & Subscription | Free/Pro tier enforcement with payment processing |
| M5 | Calendar & Smart Notifications | Earnings calendar, personalized push, weekly digest, contrarian alerts |
| M6 | 3-Tab Navigation Redesign | Today / Research / You architecture with explicit migration from the current app |
| M7 | Report UI & Interactive Features | New report layout with scenarios, export, notes, and richer report interactions |
| M8 | Fear & Greed UI & Weekly Digest | Visual Fear & Greed dashboard and weekly intelligence digest email |
| M9 | Offline, Security & Launch Prep | Caching, hardening, analytics dashboards |

---

# M0 - Open-Source Data Foundation

## Goal

Create and **bulk-load** the Phase 2 historical tables using **only** public, legally usable sources: structured financials from **SEC EDGAR** (`data.sec.gov` XBRL companyfacts, deterministic mapping ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â e.g. edgartools standardization) and earnings call transcripts from the **MIT-licensed** HuggingFace dataset `kurry/sp500_earnings_transcripts` (Parquet bulk download). **No paid market-data APIs** for this backfill (no FMP, Polygon, Alpha Vantage, etc., where ToS or licensing conflict with the product).

**Plain English:** We fill the database once from government filings + an open dataset, with parsers and mappers ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not LLMs doing math ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â so M1 can expose APIs and run nightly updates on top of real data.

---

## Deliverables

| Deliverable | Description |
|---|---|
| `ph2m0_004` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ `ph2m0_006` migrations | DDL for `financial_snapshots`, `transcripts`, `ticker_coverage` (authored in M0; registered in `product-api` during M1) |
| SEC bulk load pipeline | Download `companyfacts.zip` once with required `User-Agent`; parse per-CIK JSON locally; map XBRL ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `CanonicalFinancialSnapshot` logical shape; `provider = "sec_edgar"` |
| HuggingFace bulk load pipeline | Pin dataset revision; filter to ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥5y window; load transcripts; `provider = "huggingface_kurry"` |
| NULL consensus/guidance columns | `analyst_estimates` and `guidance` JSONB left NULL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â M2 LLM reasons from facts + transcripts; no third-party consensus store |
| Tiered load | Tier 1 (~20) ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Tier 2 (S&P 100) ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Tier 3 (full universe) |
| `ticker_coverage` populated | `has_estimates = false`, `has_guidance = false` after M0 load |
| Validation artifact | Automated counts + manual 5-ticker spot-check signed off |

---

## Acceptance Criteria

- [ ] All three migrations apply cleanly on a fresh database; `.down.sql` drops cleanly in reverse order
- [ ] ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥95% of universe tickers have ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥20 quarterly-equivalent snapshot rows spanning ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥5 years (annual rows count toward depth per team convention)
- [ ] ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥90% of universe tickers have ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥15 transcript rows in the filtered window
- [ ] Every financial snapshot has non-empty `missing_fields` array (may be `[]`)
- [ ] `analyst_estimates` and `guidance` are NULL for all rows loaded by M0
- [ ] `ticker_coverage` row exists per universe ticker with accurate counts vs `COUNT(*)` from child tables
- [ ] SEC archive download uses an approved `User-Agent`; any per-CIK fallback path enforces <=10 requests/second
- [ ] Spot-check AAPL, MSFT, TSLA, JPM, JNJ: revenue and net income for one quarter match SEC-sourced ground truth within rounding
- [ ] Spot-check at least one transcript: `body_text` is coherent verbatim call content, `word_count` plausible
- [ ] Tier ordering verified in logs (Tier 1 completes before Tier 2 before Tier 3)

---

## Smoke Test

```
Step 1: Apply ph2m0_004, ph2m0_005, ph2m0_006 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â confirm tables and indexes
Step 2: Run Tier 1 load only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â confirm rows for test tickers
Step 3: Run full tiered load ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â confirm coverage metrics in validation artifact
Step 4: SQL: confirm analyst_estimates and guidance columns are NULL for sample of 100 rows
Step 5: Confirm ticker_coverage counts match SELECT COUNT from child tables for 5 tickers
Step 6: Re-run load subset ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â confirm idempotent upserts (no duplicate PKs)
```

---

## Success

The database contains a reproducible, **$0** historical corpus aligned with the Phase 2 schema, ready for M1 to register migrations, ship contracts, and expose `/v1/historical/*` without re-doing bulk backfill.

---

## Failure Modes

| What breaks | Detection | Impact |
|---|---|---|
| SEC blocks IP (403) | Failed fetches | Stop; fix User-Agent / hosting |
| HF revision drift | Hash mismatch | Pin revision in loader config |
| Bad XBRL mapping | Spot-check variance | Fix mapping table; never LLM-patch numbers silently |
| Incomplete universe file | Missing CIKs | Tickers skipped ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix G2 file |

---

## Rollback

Run `ph2m0_006` down ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `ph2m0_005` down ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `ph2m0_004` down. Coordinate with M1 if endpoints already deployed.

---

## Dependencies

- Phase 1 M9 closed (or explicit owner waiver for M0 kickoff recorded in milestone docs)
- PostgreSQL staging available
- G1ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“G4 in `M0_MILESTONE_AGENTS_ph2.md` resolved

---

## Owner

Data Engineer + Platform Engineer

---

# M1 - Historical Data Pipeline

## Goal

Expose the M0 corpus through **TypeScript contracts** and **internal retrieval endpoints**, and operate **nightly delta sync** so new SEC filings (and the agreed transcript update strategy) keep PostgreSQL fresh. M1 does **not** re-run the initial bulk backfill ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â that is M0.

**Live vs historical:** Phase 1 **`data-openbb`** remains the source for **current-quarter headline** figures on earnings day. Historical snapshots lag SEC filing dates (~25ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“40 days after quarter end for large filers); Deep Dive still works immediately because Dexter merges **live** + **historical** per existing product rules.

**Plain English:** M0 filled the warehouse; M1 opens the loading dock door for the app and the nightly refresh truck.

---

## Deliverables

| Deliverable | Description |
|---|---|
| `CanonicalFinancialSnapshot` contract | Typed + JSON Schema; optional `analyst_estimates` / `guidance` remain in schema for forward compatibility but **ingestion leaves them NULL** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â M2 LLM synthesizes outlook from facts + transcripts. SEC-derived `data` includes D&A, interest, computed effective tax rate where mapping allows. **Beta not stored** historically; M2 uses price returns via `data-openbb` |
| `CanonicalTranscript` + `TickerCoverage` contracts | Per `ph2_BLUEBOOK.md` Ãƒâ€šÃ‚Â§8 |
| Migration registration | Register `ph2m0_004` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ `ph2m0_006` in `apps/product-api/src/migrations.ts` (SQL files authored in M0) |
| Nightly delta sync | 01:00 ET ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â SEC `companyfacts` re-fetch / diff per universe CIK (same deterministic mapper as M0); transcript updates per M1 Gated Pre-Condition (no paid transcript API) |
| Historical retrieval endpoints | `GET /v1/historical/financials`, `/transcripts`, `/coverage` |
| Graceful degradation | `{"data": [], "missing": true}` when no rows ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no fabrication |

---

## Acceptance Criteria

- [ ] Phase 2 **M0 closed** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â corpus loaded per `ph2_MILESTONES.md ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ M0`
- [ ] Every snapshot row continues to carry `missing_fields` (may be `[]`)
- [ ] `ticker_coverage.last_sync_status` accurate after delta runs
- [ ] Delta sync succeeds in staging and immediate re-run is idempotent (owner-approved closeout basis; extended multi-night soak is tracked as TBD follow-up)
- [ ] All three contracts compile; `pnpm typecheck` passes
- [ ] `GET /v1/historical/financials?ticker=AAPL` < 200ms; schema-valid
- [ ] `GET /v1/historical/transcripts?ticker=AAPL` < 200ms; schema-valid
- [ ] `GET /v1/historical/coverage?ticker=AAPL` < 50ms; schema-valid
- [ ] Unknown ticker ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ HTTP 200, empty/missing envelope
- [ ] Phase 1 Deep Dive + Market Pulse regressions pass
- [ ] M1 Gated Pre-Conditions resolved (transcript delta strategy documented)

---

## Smoke Test

**Who runs it:** Data Engineer + Engineering Lead. Requires **M0-complete** database.

```
Step 1:  Confirm ph2m0 migrations applied and M0 row counts healthy
Step 2:  GET /v1/historical/financials?ticker=AAPL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â schema-valid; analyst_estimates/guidance absent or null in payload
Step 3:  GET /v1/historical/transcripts?ticker=AAPL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â schema-valid
Step 4:  GET /v1/historical/coverage?ticker=AAPL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â <50ms; counts match SQL
Step 5:  Run delta sync ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â success logs; coverage timestamps move forward
Step 6:  Re-run delta sync immediately ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â idempotent row counts
Step 7:  Phase 1 Deep Dive + Market Pulse regression
Step 8:  CI green
```

**Expected result:** APIs and sync operate on M0 data; Phase 1 paths unaffected.

---

## Success

Internal consumers read historical SEC- and HF-derived data through typed contracts in <200ms; coverage in <50ms; nightly SEC-aligned delta keeps the corpus current without paid backfill APIs. Forward-looking ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œexpectationsÃƒÂ¢Ã¢â€šÂ¬Ã‚Â narrative is an **M2 LLM** concern, not a stored consensus feed.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| SEC block / rate limit | 403/429 in logs | Fix User-Agent / backoff |
| Delta sync silent failure | Stale `last_synced_at` | Stale reports ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â alert |
| Mapper regression | Spot-check vs SEC | Wrong fundamentals |
| Coverage drift | Reconciliation SQL | Fix upsert |
| Endpoint latency | Smoke timing | Indexes / plans |
| Phase 1 regression | Smoke | Blocker |

---

## Rollback

1. Disable delta sync cron  
2. Remove `/v1/historical/*` routes  
3. Optional: drop tables via `ph2m0_*` down (destroys data ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â coordinate)  
4. Remove contract exports if rolling back contracts  

---

## Dependencies

- Phase 1 M9 closed  
- **Phase 2 M0 closed**  
- PostgreSQL operational  
- M1 Gated Pre-Conditions resolved (`M1_MILESTONE_AGENTS_ph2.md`)

---

## Owner

Data Engineer + Platform Engineer

---

# M2 - Report Quality Engine

## Goal

Transform Deep Dive output from a Phase 1 report into an analyst-grade report with historical context, comparison logic, deterministic valuation, and cleaner synthesis. At the end of M2, every Deep Dive includes a Thesis Statement, QoQ and YoY comparisons, segment breakdowns (when data exists), at least one management quote from earnings transcripts (when a transcript exists), and a Valuation section produced by a **deterministic DCF module** in `apps/dexter-worker/src/dcf/` (the LLM narrates computed numbers only). **Spot price** for comparison to fair value comes from the existing live quote at generation time, not from historical snapshots. Reports that lack historical data degrade honestly ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â they never fabricate comparisons or valuation outputs.

**Shared Deep Dive reuse:** Completed Deep Dives are not per-user singletons. `product-api` implements **lookup-or-create** before enqueueing Dexter: when a requesting user matches an existing completed reportÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s fingerprint (per `M2_MILESTONE_AGENTS_ph2.md` G5) and freshness rules pass, return that **`report_id`** without a new LLM run. Tier-specific overrides (e.g. force new generation for Pro) are an M4 addition on top of this default.

**Plain English:** Before M2, Deep Dive reports describe a company's latest quarter in isolation. After M2, reports show how the company is changing over time ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â with real historical comparisons and management's own words ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â and they say honestly when the data isn't there. Multiple users asking for the same company under the same rules get the **same stored report** until freshness says otherwise ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not a new expensive run every time.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Thesis Statement section executor | New Dexter section producing a bold opening paragraph (`section_id: "thesis_statement"`) at position 0 |
| What Changed section with QoQ/YoY | Section containing revenue, EPS, net income, operating margin, free cash flow comparisons when history exists |
| QoQ and YoY comparison module | Pure function in `apps/dexter-worker/src/comparisons/` computing absolute change, percentage change, and direction |
| Historical context injection | Dexter retrieval stage calls `GET /v1/historical/financials` and `GET /v1/historical/transcripts` before section execution |
| Segment breakdown enrichment | Report includes segment trend context when `CanonicalFinancialSnapshot.segments` exists |
| Transcript quote extraction | Report cites at least one management quote when `CanonicalTranscript` exists for the most recent quarter |
| Updated `AnalysisReport` contract | `schema_version` bumped to `"2.0"`; new optional fields added; `pnpm typecheck` passes; Phase 1 reports remain valid |
| Graceful degradation paths | No history ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Phase 1 quality report with note; partial history ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ partial comparisons with note; no transcript ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ quote section omitted with note |
| LangSmith prompt versions | New or updated prompt templates registered in LangSmith (e.g., `thesis-m2-section-executor`, `thesis-m2-thesis-statement`) |
| Deep Dive shared report reuse (`product-api`) | Fingerprint + freshness per G5; return existing completed `report_id` for any matching user; enqueue Dexter only on miss or stale |
| Deterministic DCF module | Pure functions in `apps/dexter-worker/src/dcf/` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â inputs from M1 history + live spot price and shares; structured outputs; no LLM inside the module |
| Valuation section | Report section (section_id per G2 in `M2_MILESTONE_AGENTS_ph2.md`) with explicit assumptions; body must not invent fair value or WACC math |

---

## Acceptance Criteria

- [ ] Every Deep Dive report includes a `thesis_statement` section at position 0 with a non-empty, coherent body
- [ ] What Changed section includes QoQ comparisons for revenue, EPS, and net income when the prior quarter exists in historical (M0/M1) data
- [ ] What Changed section includes YoY comparisons for at least revenue when the year-ago quarter exists in historical (M0/M1) data
- [ ] Segment breakdown appears in the relevant analysis section when `CanonicalFinancialSnapshot.segments` data exists for the ticker
- [ ] At least one transcript quote from management is included when a `CanonicalTranscript` exists for the ticker's most recent quarter
- [ ] `AnalysisReport.schema_version` is `"2.0"` on all M2-generated reports
- [ ] All new fields on `AnalysisReport` and `ReportSection` are optional ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â stored Phase 1 reports still pass schema validation
- [ ] When historical data is missing (`GET /v1/historical/financials` returns `{"data": [], "missing": true}`), the report generates at Phase 1 quality with an explicit note: "Historical comparison unavailable"
- [ ] When historical data is partial (e.g., `missing_fields` includes `eps`), comparisons omit that metric and state what is missing ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no fabricated values
- [ ] When no transcript exists, the quote section is omitted with a note ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the rest of the report still generates
- [ ] Report generation time (with historical enrichment) remains under 90 seconds, 95% of the time
- [ ] QoQ delta values in the report match manual calculation from M1 data (spot-checked for AAPL, TSLA, JPM)
- [ ] `pnpm typecheck` passes after contract changes
- [ ] Mobile `Models.kt` compiles with updated contract (all new fields nullable)
- [ ] `GET /reports/:id` for a Phase 1 report returns a valid response after M2 changes ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no regression
- [ ] Phase 1 Deep Dive for AAPL still completes within 90 seconds after M2 changes
- [ ] Phase 1 Market Pulse trigger still completes successfully after M2 changes
- [ ] New LangSmith prompt versions are visible and traceable
- [ ] **Shared reuse:** After a completed M2 Deep Dive exists for ticker T under fingerprint F, a **second distinct user** (or second authenticated session) requesting Deep Dive for T under F receives the **same `report_id`** without a second Dexter enqueue (verify via logs, job table, or LangSmith ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â per team convention)
- [ ] **Reuse miss:** When no completed report matches F or freshness has expired, a **new** generation runs and a **new** `report_id` is produced
- [ ] Valuation section is present with coherent assumptions when DCF inputs are sufficient; omitted or explicitly degraded when inputs are insufficient ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no fabricated fair value
- [ ] Stated valuation figures in the report match the deterministic `dcf/` module output for the same inputs (spot-check AAPL or equivalent full-data ticker)

---

## Smoke Test

**Who runs it:** Reasoning Engineer + Engineering Lead. Requires staging with **M0 data loaded and M1 endpoints live**.

```
Step 1:  Confirm historical data is available via M1 APIs
         GET /v1/historical/financials?ticker=AAPL returns data
         GET /v1/historical/transcripts?ticker=AAPL returns data

Step 2:  Submit Deep Dive for AAPL (ticker with full history)
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â job completes within 90 seconds
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â report is schema-valid with schema_version "2.0"
         Record ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â report_id from this run

Step 3:  Shared report reuse (second user or second session)
         Request same Deep Dive for AAPL with same fingerprint (G5)
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â same report_id as Step 2
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no second Dexter generation (reuse hit in logs or equivalent)

Step 4:  Verify Thesis Statement
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â section with section_id "thesis_statement" exists at position 0
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â body is non-empty and coherent

Step 5:  Verify What Changed section
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â QoQ comparison present for revenue, EPS, net income
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â YoY comparison present for at least revenue
         Spot-check ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â one QoQ delta against M1 data

Step 6:  Verify segment breakdown
         If AAPL has segment data in M1, confirm segment context appears in report
         If no segments, confirm no fabricated segment data

Step 7:  Verify transcript quote
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â at least one management quote is cited
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â quoted text exists in the M1 transcript body

Step 7b: Verify Valuation (DCF)
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Valuation section present when inputs sufficient (section_id per G2)
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â numbers match recomputed `dcf/` output for the same snapshot set + spot price

Step 8:  Submit Deep Dive for a ticker with NO history
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â report generates successfully (Phase 1 quality)
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â comparison sections absent with degradation note
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Thesis Statement still present (from live data)

Step 9:  Submit Deep Dive for a ticker with PARTIAL history
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â available comparisons present; missing metrics noted
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no fabricated values

Step 10: Retrieve a Phase 1 report via GET /reports/:id
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â HTTP 200; Phase 1 report still parses correctly

Step 11: Retrieve an M2 report via GET /reports/:id
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â HTTP 200; M2 report includes new sections and historical_context metadata

Step 12: Verify LangSmith traces
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â M2 prompt versions visible; trace includes historical context metadata

Step 13: Phase 1 Deep Dive regression
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â completes within 90 seconds; schema-valid; no regression

Step 14: Phase 1 Market Pulse regression
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â completes successfully; no regression

Step 15: Run CI
         Confirm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all tests pass
```

**Expected result:** All steps complete. Enriched reports are correct and contract-valid. **Shared reuse** returns the same `report_id` for a second user when fingerprint matches. Degradation paths work honestly. Phase 1 paths unaffected.

---

## Success

Any Deep Dive request for a ticker in the M1 backfill universe produces an analyst-grade report with historical comparisons, segment context, management quotes, and transparent DCF-based valuation where data allows ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all sourced from M1 data (and live spot for price) and traceable through LangSmith ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **or reuses an existing completed report** when fingerprint and freshness allow, so the same artifact serves every user who matches that key. Tickers without history still get a valid report that says so honestly. Phase 1 reports stored in the database remain valid and parseable.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Reuse lookup wrong (stale report served) | Freshness monitoring; user reports; spot-check after earnings | Trust and accuracy issue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix fingerprint or TTL |
| Reuse never hits (every request regenerates) | Metrics: reuse_hit_rate near zero | Cost and latency blow up ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix product-api lookup path |
| M1 historical endpoints unreachable | Dexter retrieval stage fails; report degrades to Phase 1 quality | Reports lack historical enrichment ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not fatal but defeats milestone purpose |
| QoQ/YoY comparison produces incorrect deltas | Spot-check in smoke test Step 5 | Misleading financial comparisons in reports ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â critical to fix |
| Thesis Statement is incoherent or generic | Manual review in smoke test Step 4 | Product quality issue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â prompt tuning needed |
| LLM token budget exceeded | Report generation times out or costs exceed ceiling | Reduce historical context window; use cheaper model for some sections |
| Contract change breaks Phase 1 report retrieval | Smoke test Step 10 fails | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all new fields must be optional |
| Mobile parser crashes on new fields | Kotlin compilation or runtime test fails | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all new fields must be nullable in Kotlin model |
| Transcript quote is fabricated (not in actual transcript) | Manual verification in smoke test Step 7 | Trust issue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â prompt must cite verbatim only |
| Valuation numbers disagree with `dcf/` module | Smoke test Step 7b; unit tests on `dcf/` | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â LLM must not invent fair value |

---

## Rollback

M2 modifies the Dexter pipeline and the report contract. Rollback is safe:

1. Revert LangSmith prompts to Phase 1 versions
2. Disable historical context injection in Dexter retrieval stage
3. Disable Deep Dive lookup-or-create in `product-api` (feature flag or revert) so every request enqueues Dexter
4. Revert `analysis-report.ts` contract changes if needed (Phase 1 reports remain valid either way since new fields are optional)
5. Stored M2 reports remain in database ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â they are valid at any consumer's capability level

No Phase 1 data, tables, or behavior is affected by this rollback.

---

## Dependencies

- Phase 2 M0 is closed (bulk corpus loaded)
- Phase 2 M1 is closed (historical retrieval endpoints + delta sync operational)
- Contract evolution strategy decided (see M2_MILESTONE_AGENTS_ph2.md Gated Pre-Condition G1)
- New section inventory agreed (see G2)
- Dexter prompt template strategy agreed (see G3)
- Token budget ceiling set (see G4)
- Deep Dive reuse fingerprint and freshness policy decided (see G5)

---

## Owner

Reasoning Engineer + Product Lead

---

# M3 - Fear & Greed Index Engine

## Goal

Build a deterministic, reproducible composite market-sentiment engine that calculates a daily 0-100 Fear & Greed score from six approved market-data indicators, stores each trading day's snapshot in PostgreSQL, and serves current plus 90-day historical series through Product API sentiment endpoints. The engine runs once per trading day after market close via the scheduler. It is separate from Market Pulse and Deep Dive ownership.

**Plain English:** Before M3, the app has no market-level mood indicator. After M3, the platform calculates a daily Fear & Greed score from real free-data sources, stores it nightly, and exposes 90 days of history. The score is 0 (Extreme Fear) to 100 (Extreme Greed), and it never fabricates missing data.

---

## Deliverables

| Deliverable | Description |
|---|---|
| `FearGreedSnapshot` contract | `packages/contracts/src/fear-greed-snapshot.ts` typed interface + JSON schema with composite score, label, sub-scores array, missing_inputs array |
| `fear_greed_daily` table | PostgreSQL table with UNIQUE constraint on `market_date`, indexed on `(market_date)` and `(calculated_at)` |
| Input fetchers | Deterministic fetchers for 6 signals from approved providers (yfinance + FRED) |
| Composite scoring engine | Pure function in `packages/fear-greed-engine/` applying equal weights (1/6 each) to normalized sub-scores |
| Snapshot writer | Writes calculated score to `fear_greed_daily` with full sub-score audit trail |
| Nightly calculation cron | Scheduler entry at 18:00 America/New_York (DST-aware, after market close) with trading-day check |
| Product API endpoints | `GET /v1/sentiment/current` (most recent only) and `GET /v1/sentiment/history?days=90` (N-day historical series) |
| Graceful degradation path | Missing inputs are skipped and remaining inputs re-weighted; no fabricated values |

---

## Acceptance Criteria

- [ ] `FearGreedSnapshot` contract compiles with zero TypeScript errors; `pnpm typecheck` passes
- [ ] `fear_greed_daily` table is created with UNIQUE constraint on `market_date` and expected indexes
- [ ] All six M3 inputs are fetched and normalized to 0-100 sub-scores:
  VIX (`^VIX`), S&P momentum (`^GSPC` vs 125-day SMA), market breadth (% above 200-day SMA), safe-haven demand (SPY vs TLT 20-day return differential), junk-bond spread (`BAMLH0A0HYM2`), yield curve (`T10Y2Y`)
- [ ] Composite score is a valid number between 0.00 and 100.00 with correct label: 0-20 Extreme Fear, 21-40 Fear, 41-60 Neutral, 61-80 Greed, 81-100 Extreme Greed
- [ ] Every snapshot includes a `sub_scores` array with one entry per available input (raw value, normalized score, weight, provider, availability)
- [ ] Every snapshot includes a `missing_inputs` array (empty if all inputs present)
- [ ] Scoring engine is deterministic: same inputs always produce the same score (golden fixture test passes)
- [ ] Nightly cron runs without error for 3 consecutive trading days in staging
- [ ] Nightly cron skips execution on weekends and known US market holidays with an INFO log
- [ ] Running the nightly calculation twice for the same `market_date` produces zero duplicate rows (idempotent upsert)
- [ ] `GET /v1/sentiment/history?days=90` returns a contract-valid `FearGreedSnapshot[]` response within 100ms from Postgres
- [ ] `GET /v1/sentiment/current` returns a single contract-valid `FearGreedSnapshot` within 100ms
- [ ] `GET /v1/sentiment/history?days=90` with no data returns HTTP 200 with `{"data": []}` (no crash, no 500)
- [ ] When one or more inputs are unavailable, missing inputs are skipped and remaining inputs are re-weighted (minimum three inputs required); no fabricated scores
- [ ] Phase 1 Market Pulse trigger still completes successfully after M3 changes
- [ ] Existing Phase 1 scheduler cron entries still fire at expected times after M3 changes

---

## Smoke Test

**Who runs it:** Data Engineer + Engineering Lead. Requires Postgres access and staging environment.

```
Step 1:  Run migrations
         Confirm - fear_greed_daily table exists with UNIQUE constraint on market_date

Step 2:  Trigger one M3 calculation for a known trading date
         Confirm - job starts and completes without crash
         Log - raw fetched values for all six signals

Step 3:  Validate provider fetches
         Confirm - yfinance returns VIX, SP500, SPY, TLT and breadth batch data
         Confirm - FRED returns BAMLH0A0HYM2 and T10Y2Y

Step 4:  Validate normalization
         Confirm - each available input yields normalized_score in [0,100]
         Confirm - any unavailable input is present in missing_inputs and marked unavailable in sub_scores

Step 5:  Validate stored snapshot
         Confirm - row exists in fear_greed_daily with score, label, sub_scores, missing_inputs, market_date
         Confirm - score is [0,100] and label matches thresholds

Step 6:  Validate determinism/idempotency
         Re-run calculation for same market_date
         Confirm - still one row for that market_date
         Confirm - score unchanged

Step 7:  Validate API current endpoint
         Send GET /v1/sentiment/current
         Confirm - HTTP 200; single FearGreedSnapshot; score and label match DB row

Step 8:  Validate API history endpoint
         Send GET /v1/sentiment/history?days=90
         Confirm - HTTP 200; FearGreedSnapshot[] schema; includes latest row

Step 9:  Validate empty-state API behavior
         Test on fresh DB (or temporary empty state)
         Send GET /v1/sentiment/history?days=90
         Confirm - HTTP 200 with {"data": []}

Step 10: Verify scheduler registration and trading-day skip
         Confirm - cron entry exists at 18:00 ET
         Simulate a non-trading day and confirm skip with INFO log

Step 11: Phase 1 regression check
         Trigger existing Market Pulse route
         Confirm - completes successfully
         Confirm - existing scheduler entries still run
```

**Expected result:** All steps pass. Fear & Greed scores are deterministic, auditable, retrievable under latency target, and isolated from Phase 1 behavior.

---

## Success

Any consumer (M8 dashboard, digest, or future integrations) can call `GET /v1/sentiment/history?days=90` and receive contract-valid deterministic Fear & Greed scores in under 100ms. Each score is auditable through `sub_scores` and explicit `missing_inputs`.

---

## Failure Modes

| Failure | Detection | Impact / Notes |
|---|---|---|
| One signal provider unavailable | Missing value + WARN log | Degradation path applies: skip/re-weight; no fabricated values |
| Fewer than three inputs available | Validation failure | No score written for that market_date; ERROR + Sentry |
| Cron does not fire | Missing expected market_date snapshot | Data staleness alert required |
| API route fails | 5xx or schema mismatch | M3 not releasable |
| Migration affects existing Phase 1 tables | Phase 1 smoke fails | Blocker; M3 must remain additive |

---

## Rollback

M3 is backend/data only and additive; rollback is safe:

1. Disable the M3 sentiment cron entry in scheduler
2. Remove `/v1/sentiment/current` and `/v1/sentiment/history?days=90` routes from `product-api`
3. Run `ph2m3_006_fear_greed_daily.down.sql` to drop table
4. Remove `fear-greed-snapshot.ts` and `packages/fear-greed-engine/` if introduced

---

## Dependencies

- Phase 2 M1 is closed
- Approved six-signal input set confirmed (VIX, momentum, breadth, safe-haven, junk spread, yield curve)
- Weighting doctrine agreed (equal weight 1/6 each)
- Data providers per input provisioned (yfinance + FRED)
- Degradation policy decided (skip missing and re-weight; minimum 3 inputs)
- Historical bootstrap strategy decided (no blocking backfill requirement for M3 closeout)

## Owner

Data Engineer + Product Lead

---

# M4 - Monetization & Subscription

## Goal

Add payment infrastructure with Free and Pro tiers and enforce feature gating across the product without breaking the Phase 1 auth and session model.

**Implementation reality:** This milestone is a real auth/schema change, not just mobile SDK wiring.

## Deliverables

| Deliverable | Description |
|---|---|
| RevenueCat integration | Android SDK + backend webhook receiver |
| Durable subscription fields | Postgres user or subscription tables storing tier truth and billing identity |
| Server profile read model | `product-api` endpoint such as `GET /v1/user/profile` exposing effective tier |
| Optional sync endpoint | `product-api` endpoint such as `/v1/user/sync-tier` for webhook recovery |
| Middleware gating | `product-api` middleware checks subscription status before gated endpoints |
| Subscription management UI | Settings surface shows current plan and management actions |
| Paywall screen | Triggered when a Free user hits a gated feature |

## Acceptance Criteria

- [ ] Free user attempting a second Deep Dive in one day is blocked with a paywall
- [ ] Pro user can run unlimited Deep Dives
- [ ] Subscription purchase flow completes on a real device via Google Play test track
- [ ] Subscription status survives app restart and is verified server-side
- [ ] Cancel flow works and correctly downgrades access
- [ ] Webhook updates user tier in the database
- [ ] Export and scenario features are hidden or blocked for Free users
- [ ] Existing Phase 1 auth flows still pass after entitlement changes

## Phase 1 Regression Obligations

- Register -> verify -> login still works
- Refresh and logout still work
- Latest Pulse still loads
- Watchlist CRUD still works
- Push token registration still works
- Report history still loads

## Smoke Test

1. Register a new user and complete verify/login
2. Confirm `GET /v1/user/profile` returns `FREE`
3. Run one Deep Dive successfully
4. Attempt a second Deep Dive and confirm paywall/403 behavior
5. Upgrade on Google Play test track
6. Confirm backend tier changes to `PRO`
7. Re-run gated action and confirm success
8. Restart app and confirm tier remains `PRO`
9. Cancel subscription and confirm downgrade path
10. Re-run the Phase 1 auth and Pulse regression checks

## Success

Any new user starts as Free with enforced limits (1 Deep Dive/day, 5 watchlist names, no exports). When they upgrade via Google Play, the server durably records their Pro tier within seconds via webhook. Every gated feature unlocks immediately. If they cancel, access continues until the billing period ends, then cleanly downgrades. The entire Phase 1 auth and product flow survives the schema and middleware changes without regression.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| RevenueCat webhook fails to deliver | User pays but tier stays FREE; sync-tier fallback corrects on next app open | User frustrated but recoverable |
| Webhook signature validation rejects valid webhooks | All tier updates fail; Sentry alerts; investigate signing secret | Blocker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no upgrades work |
| Gating middleware blocks Pro users | Pro user gets 403; integration test catches this | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix middleware logic |
| Daily Deep Dive limit counter out of sync | Free user gets 0 or 2 Deep Dives; server-side counter is source of truth | Bug ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix counter logic |
| Migration breaks existing users table | Phase 1 auth fails; smoke test catches immediately | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â rollback migration |
| Google Play purchase flow fails | Mobile error screen; user retries; no server-side change | Bad UX but recoverable |
| Cancellation webhook arrives late | User keeps Pro access beyond period end; eventual consistency | Minor ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â acceptable delay |

---

## Rollback

M4 modifies the auth/middleware layer. Rollback is safe:

1. Run `ph2m4_007_subscriptions.down.sql` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â drops subscription schema
2. Remove webhook, profile, sync-tier, and gating middleware from `product-api`
3. Revert mobile to Phase 1 build (no paywall, no RevenueCat SDK)
4. All users revert to "unlimited" access (Phase 1 behavior)

No Phase 1 data or auth behavior is corrupted by rollback. Users who paid need refunds handled via Google Play / RevenueCat dashboard.

---

## Dependencies

- Phase 1 M9 is closed
- Google Play Developer account configured
- RevenueCat account created and API keys provisioned
- Gated feature list confirmed (see M4_MILESTONE_AGENTS_ph2.md G3)
- Subscription schema design decided (see G4)

---

## Owner

Product API Engineer + Mobile Engineer + Product Lead

---

# M5 - Calendar & Smart Notifications

## Goal

Make the app time-aware and proactive. Add calendar data, personalized push, contrarian alerts, and a weekly intelligence digest while preserving the working Phase 1 push and deep-link behavior.

**Implementation reality:** Contrarian alerts require a persisted server-side thesis anchor. They are not derived from app memory.

## Deliverables

| Deliverable | Description |
|---|---|
| Earnings calendar data source | Ingest upcoming earnings dates |
| Calendar events table | PostgreSQL event storage |
| Personalized FCM templates | Named notification templates with dynamic content |
| Notification preference model | Durable user preferences for enabled notification types |
| Contrarian alert anchor model | Persisted server-side record with user, ticker, signal, anchor time, and expiry |
| Contrarian alert cron | Scheduler job that evaluates anchors against market moves |
| Weekly digest builder | Scheduled aggregation of major events and insights |
| Weekly digest delivery | Email or other approved delivery path for Pro users |

## Acceptance Criteria

- [ ] Earnings calendar shows correct upcoming dates for the supported universe
- [ ] User receives a personalized push when a watchlist name reports soon
- [ ] Contrarian alert fires only from persisted anchors and only within the defined validity window
- [ ] Weekly digest arrives with correct content on the approved cadence
- [ ] User can disable the supported notification types
- [ ] All notifications deep-link to the correct screen in the app
- [ ] Existing Phase 1 push registration and tap-through still work

## Phase 1 Regression Obligations

- Device token registration still succeeds
- Push notification receipt still works
- Notification tap still opens the correct Pulse or target screen
- Watchlist-backed personalization still works

## Smoke Test

1. Enable notifications and register device token
2. Add a watchlist ticker
3. Verify upcoming earnings data exists for the ticker
4. Trigger the earnings-preview notification path and confirm delivery plus tap-through
5. Create a valid contrarian anchor from a completed Deep Dive
6. Simulate or detect the threshold move and confirm the alert fires
7. Disable the relevant preference and confirm the alert stops
8. Trigger the weekly digest path and confirm the output contains the expected sections
9. Re-run the Phase 1 push and Pulse regression checks

## Success

The app proactively notifies users about relevant events. Watchlist holders get earnings previews before the call. Users with a thesis that diverges from market moves get honest contrarian alerts from durable server-side anchors. Pro users receive a weekly digest summarizing the week's insights. Users control every notification type via settings. All Phase 1 push and deep-link behavior survives unchanged.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Calendar provider returns wrong earnings dates | Notification fires for wrong date; manual spot-check catches | Misleading notification ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â advisory language mitigates |
| Contrarian anchor not created on Deep Dive | No alert ever fires for that thesis; integration test catches | Missed alerts ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix anchor creation |
| Alert fires after anchor expired | Should be impossible (evaluation checks expires_at); test catches | False alert ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix expiry logic |
| FCM push delivery fails | User misses notification; Sentry alert; retry next cycle | Degraded UX but not critical |
| Deep-link opens wrong screen | User lands on unexpected destination; real-device test catches | Blocker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix deep-link mapping |
| Weekly digest builder fails | Pro users miss one digest; Sentry alerts | Degraded ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â retry next week |
| Preference toggle not respected | User gets notification they disabled; integration test catches | Trust issue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix preference check |

---

## Rollback

M5 is additive ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â new tables, new crons, new push types. Rollback is safe:

1. Disable calendar sync, alert evaluation, and digest crons in scheduler
2. Remove preference and calendar endpoints from `product-api`
3. Run `.down.sql` for migrations `010`, `009`, `008` in reverse
4. Revert mobile to M4 settings UI (no notification preferences)

No Phase 1 push behavior is affected. Existing push registration and Pulse notifications continue working.

---

## Dependencies

- Phase 2 M4 is closed
- Calendar data source decided (see M5_MILESTONE_AGENTS_ph2.md G1)
- Contrarian alert threshold and validity window decided (see G2, G3)
- Weekly digest delivery channel decided (see G4)
- Notification type inventory agreed (see G5)

---

## Owner

Scheduler Engineer + Product API Engineer + Mobile Engineer

---

# M6 - 3-Tab Navigation Redesign

## Goal

Replace the current navigation with the 3-tab architecture defined in `UX_ARCHITECTURE.md`: Today / Research / You.

**Implementation reality:** This is a real refactor of the current working 5-tab Android app, not a tab rename.

## Deliverables

| Deliverable | Description |
|---|---|
| Navigation migration map | Explicit mapping from current Pulse / Deep Dive / Watchlist / History / Settings flows into Today / Research / You |
| Today tab | Time-aware layout based on market day state |
| Research tab | Search, recent Deep Dives, and report history entry points |
| You tab | Profile, subscription status, watchlist/My Names management, settings |
| Deep-link migration | Notification opens and resume paths land on the new reachable destination |
| Transitional adapter layer if needed | Temporary compatibility logic while old and new navigation coexist |

## Acceptance Criteria

- [ ] App launches with 3 tabs: Today, Research, You
- [ ] Today shows the correct pre-market, market-hours, and after-hours layout states
- [ ] Research supports search and recent report access
- [ ] You exposes subscription, watchlist/My Names, and settings
- [ ] All existing functionality remains reachable with no regression
- [ ] Deep links from notifications open the correct tab and state
- [ ] History/resume flow still works after the navigation change
- [ ] Navigation transitions remain smooth

## Phase 1 Regression Obligations

- Pulse still loads
- Deep Dive run path is still reachable
- Watchlist/My Names management is still reachable
- History still opens prior content
- Settings remain reachable
- Notification-open path still works

## Smoke Test

1. Launch app and confirm Today / Research / You are present
2. Verify Today content changes appropriately across mocked or controlled time states
3. Search and open a Deep Dive from Research
4. Open prior report history from the new structure
5. Manage watchlist/My Names from You
6. Open settings from You
7. Trigger a notification and confirm tap-through lands on the right new destination
8. Re-run the Phase 1 Pulse, History, Watchlist, and Settings checks

## Success

The app launches with Today / Research / You. Every Phase 1 flow is reachable in the new structure ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â verified on a real device. Notification deep-links land on the correct tab. History resume still works. The navigation feels smooth and intentional, not bolted on.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Notification deep-link opens wrong tab | Real-device test catches | Blocker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â users land in wrong context |
| History entry references deleted screen | Report fails to open; real-device test catches | Blocker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix navigation mapping |
| Today tab shows blank content | Data source unavailable; should show cached Pulse or loading state | Bad UX ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix fallback |
| Market-state resolution wrong | Today shows after-hours content during trading hours | Confusing UX ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix time logic |
| Old screen still referenced in code | Build succeeds but navigation crashes on specific path | Blocker ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â remove stale reference |
| Navigation transition janky | Visual test on real device | P2 bug ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix animation timing |

---

## Rollback

M6 is a pure mobile refactor. No backend changes.

1. Revert mobile app to M5 build with Phase 1 navigation
2. Publish reverted build to test track
3. No server-side changes to undo

No data, tables, or API routes are affected.

---

## Dependencies

- Phase 2 M5 is closed
- Screen-mapping document approved (see M6_MILESTONE_AGENTS_ph2.md G1)
- Today tab time-state design agreed (see G2)
- History placement decided (see G4)

---

## Owner

Mobile Engineer + Product Lead

---

# M7 - Report UI & Interactive Features

## Goal

Redesign the Deep Dive report layout to match the UX Architecture vision and add richer interactive behavior such as notes, scenarios, and export.

**Implementation reality:** This milestone requires contract/model expansion or a deliberate adapter plan. It is not safe as a mock-only UI pass.

## Deliverables

| Deliverable | Description |
|---|---|
| Report model plan | Versioned contract change or adapter layer from the current report payload to the richer mobile view model |
| New report layout | Confidence ring, Thesis Statement, richer section treatment, collapsible modules |
| Notes persistence | Named storage model for per-report notes |
| What-If scenario flow | Defined request/response ownership and UI flow; DCF-style sliders re-run M2 deterministic module with structured assumption deltas |
| Export surfaces | PDF, share card, and investment memo with named artifact generation ownership |
| Community sentiment vote | Aggregated vote UI with backend storage and retrieval plan if retained in scope |

## Acceptance Criteria

- [ ] Report sections are collapsible and render from real report data
- [ ] Thesis Statement and richer comparison context render correctly
- [ ] User can add and edit notes on a report
- [ ] Notes persist across app restart
- [ ] What-If scenario flow returns a response within the agreed limit; DCF-parameter scenarios use deterministic recomputation (same logic as M2 `dcf/`), not LLM math
- [ ] Export outputs are generated and open correctly
- [ ] Any retained community sentiment UI shows aggregate data only
- [ ] All export features are gated behind Pro subscription
- [ ] Existing `/reports/:id` consumers and history open paths still work

## Phase 1 Regression Obligations

- A standard Deep Dive still loads from real backend data
- History can still reopen a prior Deep Dive
- Pulse remains unaffected
- Current report parsing does not silently break while the richer model is introduced

## Smoke Test

1. Open a real Deep Dive from Research
2. Confirm Thesis Statement and core sections render from the live payload
3. Collapse and expand sections
4. Add a note, restart app, and confirm the note persists
5. Trigger a What-If scenario and confirm response timing; for DCF sliders confirm recomputed metrics match the module
6. Generate each export artifact and confirm it opens correctly
7. Confirm Free vs Pro gating behavior for export/scenario paths
8. Open the same report again from history and confirm compatibility
9. Re-run baseline Phase 1 Deep Dive and Pulse checks

## Success

A Pro user opens a Deep Dive and sees an interactive, analyst-grade report ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â collapsible sections, a Confidence Ring, a bold Thesis Statement, historical comparisons with trend indicators, personal notes that persist, a "What-If" scenario tool (with DCF-style exploration backed by the same deterministic engine as M2 where applicable), and export options (PDF, Share Card, Investment Memo). Free users see the report but are cleanly gated from premium features. Phase 1 reports still render correctly in the new UI. The report feels like a real product, not a prototype.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Phase 1 report crashes new UI | Backward compatibility test catches | Critical ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all reports must render |
| Notes lost on app restart | Persistence test catches | Trust issue ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â users lose data |
| What-If scenario times out | Latency monitoring; fallback error message | Bad UX ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â tune timeout or simplify scenario |
| PDF export produces empty or corrupt file | Export validation in smoke test | Unusable feature ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix generation |
| Share Card image wrong size or blank | Image dimension check in test | Shareable artifact is broken |
| Free user bypasses paywall | Gating integration test catches | Revenue leak ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix middleware |
| Collapsible sections jank or misrender | Real-device visual test | P2 bug ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fix Compose layout |

---

## Rollback

M7 touches mobile UI and potentially server endpoints.

1. Revert mobile to M6 report screen
2. Run `ph2m7_011_report_notes.down.sql` if notes migration was applied
3. Remove notes, scenario, and export endpoints from `product-api` if they were added
4. Remove new contracts from `packages/contracts/src/`

Reports remain stored and retrievable. Users lose M7 interactive features but not their report data.

---

## Dependencies

- Phase 2 M6 is closed
- Phase 2 M4 is closed (Pro gating in place)
- Phase 2 M2 is closed (includes deterministic DCF / Valuation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â M7 What-If reuses that logic for assumption sliders)
- M2 contract strategy resolved (see M2_MILESTONE_AGENTS_ph2.md G1)
- Report view-model strategy decided (see M7_MILESTONE_AGENTS_ph2.md G1)
- Notes storage model decided (see G2)
- What-If scenario ownership decided (see G3)
- Export generation ownership decided (see G4)
- Community sentiment vote in/out decided (see G5)

---

## Owner

Mobile Engineer + Product API Engineer + Product Lead

---

# M8 - Fear & Greed UI & Weekly Digest

## Goal

Build the visual dashboard for the Fear & Greed index and finalize the weekly intelligence digest template.

## Deliverables

| Deliverable | Description |
|---|---|
| Fear & Greed dashboard screen | Gauge visualization, sub-score breakdown, historical chart |
| Sentiment labels | Extreme Fear / Fear / Neutral / Greed / Extreme Greed |
| Historical trend chart | Interactive line chart with multiple range views |
| Input breakdown | Visible sub-score breakdown |
| Weekly digest template | Branded digest with major signals and catalysts |
| Today-tab Fear & Greed card | Summary card showing current score and direction |

## Acceptance Criteria

- [ ] Fear & Greed dashboard is accessible from the app
- [ ] Gauge displays correct score with correct label
- [ ] Historical chart renders the expected data range
- [ ] All sub-inputs are visible with scores
- [ ] Weekly digest renders correctly in the supported clients
- [ ] Fear & Greed is accessible to all users
- [ ] Today shows the Fear & Greed summary card

## Dependencies

- Phase 2 M3 is closed
- Phase 2 M6 is closed

---

# M9 - Offline, Security & Launch Prep

## Goal

Harden the app for public release with offline caching, security measures, and analytics readiness.

## Deliverables

| Deliverable | Description |
|---|---|
| Room database | Local cache for viewed reports and latest Pulse |
| WorkManager prefetch | Scheduled Morning Pulse prefetch for offline reading |
| Offline indicator | Visible offline freshness state |
| Certificate pinning | HTTPS pinning for `product-api` |
| ProGuard/R8 config | Code shrinking and obfuscation |
| Biometric lock | Optional fingerprint/face lock |
| PostHog dashboards | Core product and funnel dashboards |

## Acceptance Criteria

- [ ] Previously viewed reports are available in airplane mode
- [ ] Morning Pulse is prefetched and available offline on schedule
- [ ] Offline badge displays correct freshness
- [ ] MITM proxy attack fails due to certificate pinning
- [ ] Release build is obfuscated
- [ ] Biometric lock can be enabled and disabled
- [ ] PostHog dashboards show the required product signals
- [ ] Full end-to-end physical-device test passes

## Dependencies

- All prior Phase 2 milestones are closed
