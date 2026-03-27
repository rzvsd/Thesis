# AGENTS.md — Phase 2 M0 Open-Source Data Foundation
**Milestone:** Phase 2 M0 — Open-Source Data Foundation  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M0/M0_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M0 — Open-Source Data Foundation |
| **Linear Project** | Phase 2 M0 — Open-Source Data Foundation |
| **Owner** | Data Engineer + Platform Engineer |
| **Status** | Closed - owner-approved technical sign-off recorded (2026-03-27) |
| **Depends on** | Phase 1 M9 kickoff gate **waived for M0** by owner decision (2026-03-26); PostgreSQL operational; legal acceptance recorded for MIT-licensed HuggingFace dataset + SEC public data for server-side storage |

---

## Gated Pre-Conditions

These decisions were resolved on **2026-03-26** and are recorded below as the M0 implementation baseline.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **SEC EDGAR access policy.** M0 bulk pulls `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip` (single download) with required descriptive `User-Agent` (`ThesisFinance admin@yourdomain.com`). M1 delta path keeps `<= 10 req/s` safeguards and exponential backoff for per-CIK fallback. | **RESOLVED** | Platform Engineer | Baseline fixed |
| G2 | **Backfill universe.** Universe is **S&P 500**. Reproducible mapping is checked in as `data/sp500_universe.csv` (`ticker,cik,company_name,tier`), generated from SEC `company_tickers.json` + pinned S&P list cross-reference. | **RESOLVED** | Product Lead + Data Engineer | Baseline fixed |
| G3 | **HuggingFace dataset pin.** Pin `kurry/sp500_earnings_transcripts` to revision `f3ded372da8d18dc6ad98955c4558e34b5fe6d45`; fail load if row count drifts materially from expected (~33,362 before year filter). MIT license accepted for server-side enrichment use (decision recorded). | **RESOLVED** | Product Lead | Baseline fixed |
| G4 | **XBRL normalization strategy.** Use deterministic internal mapping table `data/xbrl_concept_map.json` (informed by edgartools concepts), with ordered concept fallbacks and fixture tests. LLM is never used for numeric extraction. | **RESOLVED** | Data Engineer | Baseline fixed |

**Rule:** Do not substitute paid APIs with ToS that forbid your use case (e.g. commercial-only restrictions). M0 is intentionally **$0** and **legally conservative**.

---

## 1. What This Milestone Is Building

The **initial historical corpus** in PostgreSQL: structured quarterly/annual financials derived from **SEC EDGAR XBRL** (`data.sec.gov/api/xbrl/companyfacts/...`) and earnings call transcripts from the **HuggingFace** dataset `kurry/sp500_earnings_transcripts` (bulk Parquet download). This is a **deterministic ingestion pipeline** — download, map, validate, bulk insert — not an LLM-driven scraper.

At the end of M0, the three Phase 2 tables exist (via migrations authored here), are **populated** for the defined universe (tiered: Tier 1 top ~20 → Tier 2 S&P 100 → Tier 3 full list), and pass validation spot-checks. **M1** adds TypeScript contracts, retrieval endpoints, and nightly **delta sync** on top of this corpus.

**What M0 does *not* include:** `product-api` historical routes, scheduler jobs, or Dexter changes.

**Analyst consensus and structured guidance:** The ingestion pipeline **does not** populate `analyst_estimates` or `guidance` JSONB columns. Those remain NULL. Forward-looking narrative and “vs expectations” reasoning are **M2 LLM** responsibilities, grounded in reported results, transcripts, YoY/QoQ facts, and market context — not third-party consensus feeds (which are excluded for legal/cost reasons).

**Beta:** Not stored in `financial_snapshots.data` from SEC. **M2** computes beta from **daily returns** using price history from the existing Phase 1 **`data-openbb`** path (open-source stack; no Alpha Vantage / FMP / similar restricted APIs for this purpose).

**Latest quarter vs historical lag:** SEC 10-Q/10-K structured facts typically appear **~25–40 days after quarter end** for large filers. **Phase 1 live `data-openbb`** still supplies headline current-quarter figures for Deep Dive on earnings day. M0/M1 historical tables provide **depth**; they do not block same-day reports.

**Plain English:** We bulk-load five years of official filings-based financials and thousands of transcripts for pennies of compute, with no paid market-data API for backfill, then hand a filled database to M1 for APIs and ongoing updates.

---

## 2. Read These Files First

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md`
- `Project Note/Phase2/ph2_BLUEBOOK.md` — §5 Historical Data Strategy, §8 data model
- `Project Note/Phase2/ph2_MILESTONES.md` — M0 and M1 acceptance criteria
- `Decisions/ph2_ADR-001-historical-data-storage.md`
- `Project Note/Phase2/Milestones/M1/M1_MILESTONE_AGENTS_ph2.md` — contract target shape (M1 implements TypeScript; M0 loads rows conforming to the same logical schema)

### Code surfaces

- `apps/data-openbb/src/` — optional location for Python ingest modules (or `scripts/` at repo root — team choice)
- `infra/migrations/` — `ph2m0_004`, `ph2m0_005`, `ph2m0_006`
- SEC bulk archive: `https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip`
- SEC ticker index: `https://www.sec.gov/files/company_tickers.json`

---

## 3. Scope — What Is In

- [x] Migration `infra/migrations/ph2m0_004_financial_snapshots.up.sql` and `.down.sql`
- [x] Migration `infra/migrations/ph2m0_005_transcripts.up.sql` and `.down.sql`
- [x] Migration `infra/migrations/ph2m0_006_ticker_coverage.up.sql` and `.down.sql`
- [x] **Note:** M1 registers these files in `apps/product-api/src/migrations.ts` and runs them in CI/staging — M0 **authors** DDL; first execution may occur in M0 branch or M1 branch per team workflow, but **ownership** of the SQL files is M0
- [x] Python (or agreed runtime) **bulk load** for transcripts: download pinned HuggingFace Parquet → filter fiscal window (e.g. ≥ 5 years) → map to `transcripts` rows (`provider = "huggingface_kurry"`, deterministic `transcript_id`, `body_text` from `content`, `word_count`, `is_complete` from heuristics e.g. non-empty body)
- [x] Python **bulk load** for financials: download SEC `companyfacts.zip` once (descriptive `User-Agent`) → parse per-CIK JSON locally → map XBRL facts to `CanonicalFinancialSnapshot` logical shape via internal mapping table → `provider = "sec_edgar"` → upsert `financial_snapshots`
- [x] Universe file `data/sp500_universe.csv` is checked in and reproducible (`ticker,cik,company_name,tier`)
- [x] Populate `analyst_estimates` and `guidance` columns as **NULL** for all M0 rows
- [x] Populate `ticker_coverage` after each tier: `has_estimates = false`, `has_guidance = false` unless a future enrichment exists (default false)
- [x] Tiered execution: Tier 1 → Tier 2 → Tier 3
- [x] **Validation report** (artifact: JSON or markdown in CI): row counts, coverage %, list of tickers with < N snapshots
- [x] Manual spot-check script checklist (5 tickers) documented in §12

Full acceptance criteria: `ph2_MILESTONES.md → M0`

---

## 4. Scope — What Is Out

| Out of scope | Reason |
|---|---|
| `GET /v1/historical/*` endpoints | M1 |
| Scheduler / delta sync | M1 |
| TypeScript contracts in `packages/contracts` | M1 (M0 loads data matching the agreed logical schema) |
| LLM parsing of 10-Q/10-Q XBRL | Forbidden for core path — deterministic mapping only |
| Paid APIs (FMP, Polygon, Alpha Vantage, etc.) for M0 backfill | Legal / ToS constraint |
| Storing third-party analyst consensus | Product choice — LLM synthesis in M2 instead |
| Beta in historical `data` | M2 computes from returns + OpenBB prices |

---

## 5. Services You Are Working In

| Service / area | Folder | What you are doing |
|---|---|---|
| Infra | `infra/migrations/` | Author `ph2m0_004` … `ph2m0_006` |
| Data ingest | `apps/data-openbb/src/` or `scripts/historical/` | Bulk download, map, load, validate |
| Docs | `Project Note/Phase2/` | Keep M0/M1 boundaries accurate |

---

## 6. Data Mapping Notes (Logical)

### Transcripts (HuggingFace → `transcripts`)

| Source field | Target |
|---|---|
| `symbol` | `ticker` |
| `year`, `quarter` | `fiscal_year`, `fiscal_quarter` → derive `period` string e.g. `2024-Q3` |
| `date` | `call_date` |
| `content` | `body_text` |
| (optional) `structured_content` | Not required in DB; may inform `is_complete` / QA |

### Financials (SEC companyfacts → `financial_snapshots.data`)

- Map revenue, costs, operating income, net income, EPS, balance sheet, cash flow line items via internal deterministic mapping table `data/xbrl_concept_map.json`.
- Filter source facts to SEC forms `10-Q`, `10-K`, `10-Q/A`, `10-K/A`; for each `(concept, fy, fp)` keep the latest `filed` entry.
- `effective_tax_rate`: compute as `IncomeTaxes / PretaxIncomeLoss` when both available; else omit and list in `missing_fields`.
- `depreciation_amortization`: combine standardized depreciation + intangible amortization concepts when filed separately.
- `free_cash_flow`: derive from operating cash flow − capex when both available.
- **Do not** fabricate missing metrics.

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M0 — Open-Source Data Foundation  
**Linear URL:** https://linear.app/rzvsd/project/phase-2-m0-open-source-data-foundation-31b3abdae7d6

**Ticket naming:**
```
[PH2-M0] What is being built
[PH2-M0][BUG] What is broken
[PH2-M0][SPIKE] What is being investigated
```

| Linear | Ticket | Acceptance criteria it satisfies |
|---|---|---|
| RZV-145 | `[PH2-M0] ph2m0_004 financial_snapshots migration` | Table + indexes exist |
| RZV-157 | `[PH2-M0] ph2m0_005 transcripts migration` | Table + indexes exist |
| RZV-162 | `[PH2-M0] ph2m0_006 ticker_coverage migration` | Table exists |
| RZV-166 | `[PH2-M0] CIK ↔ ticker universe file` | G2 — reproducible mapping for SEC pulls |
| RZV-167 | `[PH2-M0] HuggingFace bulk transcript load` | Transcripts loaded; provider tag set |
| RZV-170 | `[PH2-M0] SEC companyfacts bulk financial load` | Snapshots loaded; rate limit compliant |
| RZV-169 | `[PH2-M0] XBRL → canonical mapping layer` | G4 — deterministic mapping, tests with fixtures |
| RZV-163 | `[PH2-M0] Tiered bulk load orchestration` | Tier 1 → 2 → 3 order verified in logs |
| RZV-164 | `[PH2-M0] ticker_coverage upsert after load` | Counts match actual tables |
| RZV-165 | `[PH2-M0] Validation + spot-check gate` | §12 checks pass |
| RZV-168 | `[PH2-M0] Closeout` | Smoke test + DoD complete |

**Never close a ticket without** CI passing where applicable and a link to `ph2_MILESTONES.md → M0`.

---

## 8. Financial and Cost Considerations

- **Licensing:** HuggingFace dataset `kurry/sp500_earnings_transcripts` is pinned to revision `f3ded372da8d18dc6ad98955c4558e34b5fe6d45`. MIT license accepted for server-side enrichment use (decision recorded in this milestone + ADR).
- **Infra cost:** Postgres storage ~same order as prior estimates (~500MB+ transcripts + tens of MB financials at S&P scale).
- **SEC:** $0; compliance is **rate limit + User-Agent** only.

---

## 9. Logging (M0 load jobs)

| Event | Level | Fields |
|---|---|---|
| Bulk load started | INFO | `universe_size`, `tier` |
| SEC archive download started/completed | INFO | `url`, `bytes`, `duration_ms` |
| SEC ticker parsed | INFO | `cik`, `ticker`, `snapshots_written` |
| HF batch inserted | INFO | `rows`, `duration_ms` |
| SEC delta backoff (M1 path) | WARN | `sleep_ms`, `attempt` |
| Mapping ambiguity | WARN | `ticker`, `concept`, `resolution` |
| Load failed | ERROR | `ticker`, `error` |

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| SEC archive download fails | Retry bounded times; fail job with actionable error |
| Partial XBRL | Persist what maps; `missing_fields` explicit |
| HF download fail | Retry with backoff; fail job if unrecoverable |
| Duplicate `transcript_id` / `snapshot_id` | Upsert on conflict per DDL |

---

## 11. Testing Requirements

- [x] Migrations apply + rollback cleanly on empty DB
- [x] Golden fixtures: 2–3 CIKs + small HF slice → expected JSON rows
- [x] SEC archive parser unit test: deterministic period extraction + latest-filed selection
- [x] M1 delta helper rate-limit unit test explicitly carried forward to M1, because M0 bulk path uses archive download rather than per-CIK fallback mode
- [x] Idempotency: re-run load → no duplicate logical rows

---

## 12. Data Validation Criteria

### Manual spot-check (5 tickers: AAPL, MSFT, TSLA, JPM, JNJ)

| Check | Method |
|---|---|
| Revenue / net income for one quarter | Compare to SEC EDGAR viewer or company 10-Q |
| Transcript body | Human-read paragraph; not empty |
| `missing_fields` | Plausible for known filers |
| `analyst_estimates` / `guidance` | Confirmed NULL for loaded rows |
| Coverage row | Counts match `SELECT COUNT(*)` |

### Automated

| Check | Expected |
|---|---|
| Snapshot rows per ticker (target universe) | ≥ agreed threshold in `ph2_MILESTONES.md` |
| Transcript rows per ticker | ≥ agreed threshold |
| Every universe ticker has `ticker_coverage` row | 0 missing |

---

## 13. Rollback

1. Run `ph2m0_006` down, then `ph2m0_005`, then `ph2m0_004` — drops tables (only if M1 not yet depending on data in prod — coordinate with team).
2. No Phase 1 tables touched.

---

## 14. Definition of Done

- [x] All `ph2_MILESTONES.md → M0` acceptance criteria satisfied
- [x] G1–G4 resolved and recorded in §16
- [x] All Linear tickets for PH2-M0 closed or deferred
- [x] Owner sign-off recorded (2026-03-27); Engineering Lead sign-off delegated by owner for this closeout

---

## 15. Smoke Test Log

Run the smoke test from `ph2_MILESTONES.md → M0`. Record results here.

```
Date: 2026-03-27
Run by: Codex
Environment: local Docker PostgreSQL + cached SEC companyfacts.zip + pinned HuggingFace dataset revision
Result: PASS (implementation proof complete; owner-approved closeout recorded)

Step 1: Applied ph2m0_004 -> ph2m0_006 on a fresh temp DB, confirmed tables/indexes, then rolled back in reverse order to zero public tables.
Step 2: Ran Tier 1 load and confirmed rows for test tickers; idempotency re-run on AAPL kept `financial_snapshots` count at 67 before/after and `transcripts` count at 26 before/after.
Step 3: Ran full tiered load (`python -B -m src.historical_loader`) and confirmed coverage metrics in validation artifacts:
  - `selected_ticker_count = 503`
  - `financial_rows_total = 29,748`
  - `transcript_rows_total = 11,548`
  - `ticker_coverage_rows_total = 503`
  - `487 / 503` tickers have `snapshot_count >= 20` (96.8%)
  - `465 / 503` tickers have `transcript_count >= 15` (92.4%)
  - artifact paths:
    - `data/artifacts/m0_validation_report.json`
    - `data/artifacts/m0_validation_report_2026-03-27T18-02-31-356939Z.json`
Step 4: SQL confirmed `analyst_estimates` and `guidance` are NULL for all 29,748 rows.
Step 5: SQL confirmed `ticker_coverage` matches child-table counts for AAPL, MSFT, TSLA, JPM, JNJ and `has_estimates = false`, `has_guidance = false`.
Step 6: Re-ran subset load (`python -B -m src.historical_loader --tiers 1 --max-tickers-per-tier 1 --sec-archive-path %LOCALAPPDATA%\\Temp\\thesis-companyfacts.zip`) and confirmed no duplicate logical rows or coverage drift.

Manual spot-check notes:
- AAPL `2026-Q1`: revenue `143756000000`, net income `42097000000`
- MSFT `2026-Q2`: revenue `81273000000`, net income `38458000000`
- TSLA `2025-Q3`: revenue `28095000000`, net income `1373000000`
- JPM `2025-Q3`: revenue `46427000000`, net income `14393000000`
- JNJ `2025-Q3`: revenue `23993000000`, net income `5152000000`
- Transcript coherence confirmed from latest AAPL transcript excerpt (`word_count = 8024`; opening investor-relations remarks and call context read as normal earnings-call prose)
```

---

## 16. Decisions Made During This Milestone

| Decision | Record | ADR |
|---|---|---|
| SEC + HF as primary backfill | SEC `companyfacts.zip` + HF pinned revision `f3ded372da8d18dc6ad98955c4558e34b5fe6d45` | Updated `ph2_ADR-001` |
| Backfill universe + tiers | `data/sp500_universe.csv` (`ticker,cik,company_name,tier`) | Updated `ph2_ADR-001` |
| SEC access policy | `SEC_USER_AGENT` required; M0 bulk via archive download; M1 delta keeps `<=10 req/s` fallback + backoff | Updated `ph2_ADR-001` |
| XBRL normalization | Internal deterministic mapping file `data/xbrl_concept_map.json` (edgartools-informed) | Updated `ph2_ADR-001` |
| Revenue concept fallback | Ordered concept priority now applies **per period**, not globally; later concepts may fill gaps left by earlier partial concepts | M0 closeout note (2026-03-27) |
| Phase 1 M9 kickoff gate | Waived for M0 kickoff by owner decision (2026-03-26) | Milestone record |
| No third-party consensus in DB | `analyst_estimates` and `guidance` remain NULL in M0/M1 | PRD + M2 prompts |
| Migration ownership M0 | `ph2m0_*` | — |
| M0 closeout authority | Owner approved final M0 closure and Linear closeout on 2026-03-27 | Milestone record |

---

## 17. Known Issues and Deferrals

| Issue | Target |
|---|---|
| Transcript delta after HF snapshot date | M1 delta strategy (re-download, 8-K, or other free path) |
| TypeScript schemas | M1 |
| Retrieval APIs | M1 |
| Broader concept-map enrichment for sector-specific optional fields (where `missing_fields` remains explicit but acceptable for M0) | Future mapping expansion only if M1/M2 consumers require it |
