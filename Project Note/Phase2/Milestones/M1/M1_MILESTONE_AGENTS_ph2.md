# AGENTS.md — Phase 2 M1 Historical Data Pipeline
**Milestone:** Phase 2 M1 — Historical Data Pipeline  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M1/M1_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M1 — Historical Data Pipeline |
| **Linear Project** | Phase 2 M1 — Historical Data Pipeline |
| **Owner** | Data Engineer + Platform Engineer |
| **Status** | In Progress |
| **Depends on** | Phase 1 M9 closed; **Phase 2 M0 closed** (tables populated via SEC EDGAR + HuggingFace bulk load); PostgreSQL operational |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Transcript delta strategy (post–HuggingFace snapshot).** Weekly full refresh of `kurry/sp500_earnings_transcripts` from unpinned `main` HEAD, ingested via idempotent upsert. The resolved HF snapshot revision is logged every run. No paid transcript API. | **RESOLVED** | Product Lead + Data Engineer | 2026-03-27 |
| G2 | **SEC delta sync detail.** Nightly 01:00 America/New_York run uses `companyfacts.zip` bulk download + deterministic M0 mapper + idempotent upsert + coverage refresh. | **RESOLVED** | Data Engineer | 2026-03-27 |

**Rule:** M1 does **not** choose a paid fundamentals or transcript provider for backfill — that is settled by **M0** (SEC + HuggingFace). Do not introduce FMP, Polygon, Alpha Vantage, or similar for historical backfill without a new ADR and legal review.

---

## 1. What This Milestone Is Building

The **APIs and nightly delta sync** on top of the **M0** historical corpus (SEC EDGAR + HuggingFace bulk load). M1 ships **contracts**, **`GET /v1/historical/*`**, and **scheduler-driven updates** — not the initial bulk backfill.

This milestone is **additive only**. It must not weaken, slow, or break the current Phase 1 Deep Dive or Market Pulse paths.

**Data policy (aligned with product/legal constraints):**
- **No paid fundamentals/transcript APIs** for historical backfill (e.g. FMP, Polygon, Alpha Vantage where ToS forbids your usage). M0 uses **public SEC data** and the **MIT-licensed** HuggingFace dataset; M1 delta sync continues that policy.
- **`analyst_estimates` / `guidance` columns** stay NULL from ingestion. M2’s LLM forms outlook and “vs expectations” narrative from **facts + transcripts + market context**, not stored consensus rows.
- **Beta:** not stored historically; M2 computes from **return covariance vs benchmark** using **daily prices from `data-openbb`** (Phase 1 open-source data path).
- **Earnings-day freshness:** latest quarter headline metrics still come from **live `data-openbb`**; SEC XBRL rows appear after filing lag (~25–40 days typical for large accelerated filers).

**Plain English:** M0 loaded the warehouse; M1 opens the doors and runs overnight restocking from the same free sources.

---

## 2. Read These Files First

### Phase 1 docs (still govern existing architecture)

- `Project Note/Phase1/BLUEBOOK cld.md` — service boundaries, data model, contracts
- `Project Note/Phase1/MILESTONES.md` — Phase 1 acceptance criteria (regression baseline)
- `Project Note/Phase1/PRD.md` — product rules that carry forward

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — Phase 2 operating rules
- `Project Note/Phase2/ph2_BLUEBOOK.md` — architecture extensions, new contracts
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M1 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — Phase 2 product requirements
- `Decisions/ph2_ADR-001-historical-data-storage.md` — the storage decision
- `Project Note/Phase2/Milestones/M0/M0_MILESTONE_AGENTS_ph2.md` — bulk load and migration ownership

### Current code surfaces you must understand before touching

- `apps/data-openbb/src/` — existing Python data service (server.py, service.py, validation.py)
- `apps/product-api/src/server.ts` — API routes and middleware
- `apps/product-api/src/store.ts` — Postgres query layer
- `apps/product-api/src/migrations.ts` — migration registration
- `apps/scheduler/src/scheduling.ts` — cron and cycle-window logic
- `infra/migrations/` — existing migration files (naming convention: `m{milestone}_{seq}_{name}.{up|down}.sql`)
- `packages/contracts/src/` — all canonical schemas (convention: kebab-case `.ts`, exports interface + JSON schema const)

---

## 3. Scope — What Is In

The following and only the following is in scope for Phase 2 M1:

- [x] `CanonicalFinancialSnapshot` contract in `packages/contracts/src/canonical-financial-snapshot.ts` — optional `analyst_estimates` / `guidance` documented as **typically absent** (NULL in DB); `data` documents SEC-mapped fields including DCF helpers (`depreciation_amortization`, `interest_expense`, `effective_tax_rate` when derivable). **Omit `beta` from persisted historical `data`** (M2 computes from returns + `data-openbb` prices)
- [x] `CanonicalTranscript` and `TickerCoverage` contracts
- [x] All three exported from `packages/contracts/src/index.ts`
- [x] Register migrations **`ph2m0_004` … `ph2m0_006`** in `apps/product-api/src/migrations.ts` (SQL **authored in M0** — M1 ensures they run in CI/deploy)
- [x] **No M1-owned duplicate DDL** — do not create parallel `ph2m1_*` for these three tables unless a new ADR requires a breaking change
- [x] Delta sync function callable by the scheduler — **SEC** path updates `financial_snapshots` using the **same deterministic mapper as M0**; transcript path per **G1**; `ticker_coverage` upserted after each run
- [x] Scheduler cron registration for delta sync at 01:00 America/New_York (DST-aware), matching the existing `computeNextScheduledRun` pattern in `apps/scheduler/src/scheduling.ts`
- [x] Internal retrieval endpoint: `GET /v1/historical/financials?ticker={TICKER}` returning `CanonicalFinancialSnapshot[]` inside the standard `{"data": ...}` envelope
- [x] Internal retrieval endpoint: `GET /v1/historical/transcripts?ticker={TICKER}` returning `CanonicalTranscript[]` inside the standard `{"data": ...}` envelope
- [x] Internal retrieval endpoint: `GET /v1/historical/coverage?ticker={TICKER}` returning `TickerCoverage` — fast single-row lookup for M2 readiness checks
- [x] Graceful degradation: retrieval endpoints return `{"data": [], "missing": true}` when no history exists for a ticker — no crash, no fabrication
- [x] Phase 1 regression: Deep Dive and Market Pulse paths still complete after M1 changes

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M1`

---

## 4. Scope — What Is Out

Do not touch the following during Phase 2 M1. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Dexter prompt changes or new report sections | M2 — Report Quality Engine |
| QoQ/YoY comparison logic | M2 — Report Quality Engine |
| Mobile UI changes of any kind | M6+ |
| Fear & Greed index data or engine | M3 |
| Subscription or monetization logic | M4 |
| Modifying existing `CanonicalFinanceData` contract | Phase 1 contract — `CanonicalFinancialSnapshot` is a new, separate contract |
| Replacing the current live-data path in Dexter | M1 is additive; Dexter's existing data retrieval is unchanged |
| Changing the existing `data-openbb` REST endpoints | New endpoints are additive; existing `/v1/finance/company` and `/v1/finance/macro` are untouched |
| Initial bulk backfill of historical tables | M0 — Open-Source Data Foundation |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Contracts | `packages/contracts/src/` | Add `canonical-financial-snapshot.ts`, `canonical-transcript.ts`, and `ticker-coverage.ts`; update `index.ts` exports |
| Data-OpenBB | `apps/data-openbb/src/` | Delta sync job implementation (SEC + transcript path per G1/G2); **no paid API backfill** |
| Product API | `apps/product-api/src/` | Register `ph2m0_*` migrations; add historical retrieval routes; `store.ts` queries |
| Scheduler | `apps/scheduler/src/` | Delta sync cron at 01:00 ET |
| Infra | `infra/migrations/` | **Read-only for M1** unless M0 delivered files need a follow-up fix — DDL ownership is M0 |

**M1 architecture rule:** Historical data is additive. Every existing endpoint, migration, and contract must remain untouched and working. If you need to modify an existing file, the change must be purely additive (new routes, new exports, new registrations) — never removing or altering existing behavior.

---

## 6. Contracts You Are Touching

### `CanonicalFinancialSnapshot` — NEW

File: `packages/contracts/src/canonical-financial-snapshot.ts`

```typescript
{
  snapshot_id: string           // deterministic: hash of ticker + period + period_type
  ticker: string                // e.g. "AAPL"
  period: string                // e.g. "2024-Q3" or "2024-FY"
  period_type: "quarterly" | "annual"
  fiscal_year: number           // e.g. 2024
  fiscal_quarter?: number       // 1-4 for quarterly, absent for annual
  provider: string              // e.g. "sec_edgar" for historical snapshots from M0/M1 pipeline
  filing_date?: string          // ISO 8601 date of the SEC filing
  retrieved_at: string          // ISO 8601 timestamp of when we fetched this
  data: {
    revenue?: number
    cost_of_revenue?: number
    gross_profit?: number
    gross_margin?: number
    operating_income?: number
    operating_margin?: number
    net_income?: number
    eps?: number
    eps_diluted?: number
    ebitda?: number
    debt_total?: number
    debt_long_term?: number
    cash_and_equivalents?: number
    total_assets?: number
    total_liabilities?: number
    shareholders_equity?: number
    free_cash_flow?: number
    operating_cash_flow?: number
    capital_expenditure?: number
    shares_outstanding?: number
    depreciation_amortization?: number   // D&A from SEC mapping; optional
    interest_expense?: number            // from SEC; optional
    effective_tax_rate?: number          // often computed from tax / pretax income; document 0–1 vs 0–100 in contract
    [key: string]: number | undefined
  }
  segments?: {
    segment_name: string
    revenue?: number
    operating_income?: number
    [key: string]: string | number | undefined
  }[]
  analyst_estimates?: {         // reserved optional — NOT populated by M0/M1 (NULL in DB). M2 LLM reasoning replaces third-party consensus.
    revenue_estimate?: number
    eps_estimate?: number
    revenue_beat?: number
    eps_beat?: number
    revenue_beat_pct?: number
    eps_beat_pct?: number
    num_analysts?: number
  }
  guidance?: {                  // reserved optional — NOT populated by M0/M1; interpret from transcript text in M2 if needed
    next_period: string
    revenue_low?: number
    revenue_high?: number
    eps_low?: number
    eps_high?: number
    guidance_notes?: string
  }
  missing_fields: string[]      // explicitly declared, never empty-by-omission
}
```

### `CanonicalTranscript` — NEW

File: `packages/contracts/src/canonical-transcript.ts`

```typescript
{
  transcript_id: string         // deterministic: hash of ticker + period
  ticker: string
  period: string                // e.g. "2024-Q3"
  fiscal_year: number
  fiscal_quarter: number
  call_date: string             // ISO 8601 date of the earnings call
  provider: string
  retrieved_at: string
  body_text: string             // full transcript text or best available
  word_count: number
  is_complete: boolean          // false if truncated or partial
}
```

### `TickerCoverage` — NEW

File: `packages/contracts/src/ticker-coverage.ts`

```typescript
{
  ticker: string                // primary key
  snapshot_count: number        // total rows in financial_snapshots for this ticker
  transcript_count: number      // total rows in transcripts for this ticker
  latest_period: string | null  // most recent period in financial_snapshots, e.g. "2024-Q3"
  earliest_period: string | null // oldest period in financial_snapshots, e.g. "2019-Q1"
  has_guidance: boolean         // expected false when guidance JSONB unused; reserved for future enrichment
  has_estimates: boolean        // expected false when estimates JSONB unused; reserved for future enrichment
  last_synced_at: string        // ISO 8601 timestamp of the last successful sync for this ticker
  last_sync_status: "success" | "partial" | "failed"  // outcome of the most recent sync attempt
  backfill_tier: 1 | 2 | 3     // which tier this ticker belongs to
}
```

**Rules:**
- All three contracts follow the existing pattern: export an interface AND a JSON schema constant
- All three are exported from `packages/contracts/src/index.ts`
- `pnpm typecheck` must pass after every contract addition
- `missing_fields` in `CanonicalFinancialSnapshot` is mandatory and is an explicit array — never omitted
- `snapshot_id` and `transcript_id` are deterministic hashes so backfill and delta sync are idempotent (upsert on conflict)
- `analyst_estimates` and `guidance` are optional and **typically unset** (NULL) for all ingestion rows — `missing_fields` does not enumerate them
- DCF-oriented keys in `data` (`depreciation_amortization`, `interest_expense`, `effective_tax_rate`) are optional when SEC mapping cannot supply them; list in `missing_fields` when expected. **Beta is computed at M2 report time**, not stored here
- `ticker_coverage` is upserted after **M0 bulk load** and after **each M1 delta sync** — it always reflects the current state

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M1 — Historical Data Pipeline  
**Linear URL:** https://linear.app/rzvsd/project/phase-2-m1-historical-data-pipeline-47f935864ee4

**Ticket naming:**
```
[PH2-M1] What is being built
[PH2-M1][BUG] What is broken
[PH2-M1][SPIKE] What is being investigated
```

**Active tickets (IDs in Linear):**

| Linear | Ticket | Acceptance criteria it satisfies |
|---|---|---|
| RZV-154 | `[PH2-M1] CanonicalFinancialSnapshot contract` | Contract documents SEC-mapped `data`, reserved NULL `analyst_estimates`/`guidance`, no persisted beta; compiles |
| RZV-152 | `[PH2-M1] CanonicalTranscript contract` | Compiles; transcript API returns valid rows |
| RZV-161 | `[PH2-M1] TickerCoverage contract` | Compiles; coverage API under 50ms |
| RZV-172 | `[PH2-M1] Register ph2m0 migrations in product-api` | `ph2m0_004`–`006` run via `migrations.ts` |
| RZV-159 | `[PH2-M1] DCF-oriented fields in SEC-mapped snapshot data` | Optional `data` keys from XBRL mapping; no persisted beta |
| RZV-150 | `[PH2-M1] Delta sync path` | Nightly SEC delta + transcript path per G1; `ticker_coverage` updated; idempotent |
| RZV-171 | `[PH2-M1][SPIKE] Transcript delta strategy (post-M0)` | **G1 resolved** before transcript portion of RZV-150 is considered done |
| RZV-148 | `[PH2-M1] Historical retrieval endpoints` | `/financials`, `/transcripts`, `/coverage` meet latency + schema |
| RZV-147 | `[PH2-M1] Graceful degradation` | Empty history returns `missing: true` |
| RZV-153 | `[PH2-M1] Phase 1 regression check` | Deep Dive + Market Pulse pass |
| RZV-146 | `[PH2-M1] Closeout` | Smoke test + DoD |

**Canceled (superseded — do not reopen):** RZV-155, RZV-151, RZV-156, RZV-158, RZV-160 (FMP/consensus/backfill-scope drift; see `ph2_ADR-001`).

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `ph2_MILESTONES.md`
- Link to this file

**Required on every bug ticket:**
- Exact provider endpoint or internal path that failed
- Expected vs actual behavior
- Repro steps (exact commands or API calls)
- Error logs or trace link
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run.

---

## 8. Financial and Cost Considerations

**M0 bulk load:** $0 marginal API cost — SEC `data.sec.gov` (no API key; User-Agent + 10 req/s) + HuggingFace dataset download (bandwidth/storage only). **No FMP, Polygon, Alpha Vantage, or other paid historical backfill.**

**M1 delta sync:** Ongoing **$0** for SEC pulls within fair-access rules. Transcript updates per **G1** (e.g. periodic HF re-download) — infra cost only.

**Storage:** Same order of magnitude as before (~500MB+ transcripts + tens of MB financials at S&P scale). Postgres cost negligible on typical instances.

**Compute:** One-time M0 load + nightly delta — budget CPU time, not vendor dollars.

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Coverage upserted | INFO | `{ level, service, message: "Coverage updated", ticker, snapshot_count, transcript_count, latest_period, timestamp }` |
| Delta sync started | INFO | `{ level, service, message: "Delta sync started", timestamp }` |
| Delta sync completed | INFO | `{ level, service, message: "Delta sync complete", new_snapshots, new_transcripts, coverage_updated_count, timestamp }` |
| Missing history for ticker | WARN | `{ level, service, message: "No history available", ticker, missing_type: "financials" \| "transcripts", timestamp }` |
| SEC rate limit backoff | WARN | `{ level, service, message: "SEC rate limit backoff", sleep_ms, timestamp }` |
| SEC fetch failed | ERROR | `{ level, service, message: "SEC companyfacts failed", ticker, cik, error_message, timestamp }` |
| Delta sync failed | ERROR | `{ level, service, message: "Delta sync failed", error_message, timestamp }` |

Format: `{ level, service, message, ...fields, timestamp }`  
Never log API keys, secrets, or provider credentials.

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| SEC mapping yields partial fields for a ticker | Persist what exists; populate `missing_fields` explicitly | Logs (WARN) |
| SEC has no facts for a period | No row for that period; note in sync summary | Logs (WARN) |
| SEC outage or 503 during delta sync | Fail run; Sentry; retry next cron | Logs (ERROR) + Sentry |
| SEC rate limit exceeded | Mandatory backoff; never exceed 10 r/s | Logs (WARN) |
| Delta sync produces duplicates | Impossible if upsert-on-conflict is implemented correctly; integration test validates this | CI test |
| `ticker_coverage` upsert fails | Log error; retry on next sync | Logs (ERROR) |
| Retrieval endpoint called for ticker with no history | Return `{"data": [], "missing": true}` — never crash, never fabricate data | API response |
| Coverage endpoint called for ticker not in universe | Return `{"data": null, "missing": true}` — HTTP 200 | API response |
| Migration fails | Postgres rejects the DDL; no partial schema state; fix SQL and re-run | Logs (ERROR) |
| New migration breaks existing tables | Must not happen — new tables only, no ALTER on existing Phase 1 tables | CI + smoke test |

**Rule:** No empty catch blocks. Every error path logs, surfaces to the appropriate channel, and either retries safely or fails explicitly.

---

## 11. Testing Requirements for This Milestone

- [x] **Contract compilation test:** all three contracts compile; `pnpm typecheck` passes
- [ ] **Migration test:** `ph2m0_004`–`ph2m0_006` apply and roll back cleanly (M0 may own first run; M1 must pass in CI)
- [x] **Delta sync unit tests:** SEC mapper fixtures → expected snapshot rows; rate-limit helper never exceeds 10 r/s
- [x] **Delta sync idempotency test:** two consecutive runs — no duplicate PKs; stable `ticker_coverage` counts
- [x] **Retrieval integration tests:** `/financials`, `/transcripts`, `/coverage` happy path + missing ticker
- [x] **Phase 1 regression tests:** Deep Dive + Market Pulse

Test file locations:
- Contract compilation: CI `pnpm typecheck`
- Migration tests: `tests/integration/` or CI migration step
- Sync tests: `apps/data-openbb/tests/`
- Retrieval tests: `apps/product-api/tests/`
- Regression: `tests/smoke/`

CI must pass before any PR merges.

---

## 12. Data Validation Criteria

Primary **correctness** validation for the corpus is owned by **M0**. M1 validates **API + sync** behavior and spot-checks after delta.

### Spot-Check (Manual, after M1 delta on staging)

| Check | Method |
|---|---|
| Revenue / net income | Compare one quarter to SEC EDGAR / company filing |
| `analyst_estimates` / `guidance` columns | Confirm NULL in DB sample (ingestion policy) |
| Transcript body | Coherent text |
| `ticker_coverage` | Counts match SQL |

### Automated (M1)

| Check | Expected |
|---|---|
| Delta sync idempotency | Same counts after double run |
| Endpoint contracts | JSON Schema validation passes |

### Freshness Check (After Delta Sync)

| Check | Expected |
|---|---|
| Delta sync ran within the last 25 hours | Scheduler log / `last_synced_at` |
| New SEC facts after a known filing | Optional spot-check |

---

## 13. Rollback Plan

M1 is a backend/data milestone with no user-facing changes and no mobile modifications.

| Component | Rollback Action |
|---|---|
| Migrations (M0-authored) | Run `ph2m0_006` down, then `ph2m0_005`, then `ph2m0_004` — drops all three tables; no Phase 1 data affected |
| M0 load data | Dropped with the tables |
| Delta sync cron | Disable the cron entry in scheduler; no side effects |
| Retrieval endpoints | Remove the `/financials`, `/transcripts`, and `/coverage` routes from `product-api`; no existing routes affected |
| Contracts | Remove `canonical-financial-snapshot.ts`, `canonical-transcript.ts`, and `ticker-coverage.ts` from `packages/contracts/src/`; remove exports from `index.ts` |

**Key safety property:** M1 rollback has zero impact on Phase 1 functionality because M1 is purely additive — new tables, new contracts, new endpoints. Nothing existing is modified.

**Rollback test:** Before milestone close, confirm that running all three `.down.sql` files drops the tables cleanly and that `pnpm typecheck` still passes without the new contract files (or with them removed from `index.ts`).

---

## 14. Definition of Done

Phase 2 M1 is not done until every item below is checked:

- [x] All acceptance criteria in `ph2_MILESTONES.md → M1` are satisfied
- [x] Both Gated Pre-Conditions (G1, G2) are resolved and recorded in §16
- [x] Financial and Cost Considerations (§8) reviewed ($0 SEC/HF path)
- [x] Smoke test executed in full — results documented in §15 below
- [x] Data validation checks (§12) pass for M1 scope
- [x] All automated tests passing in CI on main branch (**owner-approved TBD follow-up for GitHub main CI proof on this change-set**)
- [x] All **11** active Linear tickets for PH2-M1 (RZV-146,147,148,150,152,153,154,159,161,171,172) are **closed** or explicitly deferred; canceled RZV-155/151/156/158/160 remain canceled
- [x] Deferred items logged as Linear tickets assigned to the next milestone
- [x] Phase 1 Deep Dive regression confirmed passing
- [x] Phase 1 Market Pulse regression confirmed passing
- [x] Rollback rehearsal disposition recorded: destructive `ph2m0_006` → `005` → `004` run is owner-approved TBD follow-up (non-blocking for this closeout)
- [x] Owner signs off
- [x] Engineering Lead countersigns

**M1 is not “we have SQL files.” M1 is done when APIs, delta sync, and regression are green on an M0-loaded database.**

---

## 15. Smoke Test Log

Run the smoke test from `ph2_MILESTONES.md → M1` exactly as written. Record results here.

```
Date: 2026-03-27
Run by: Codex (with owner oversight)
Environment: Local Docker (`product-api`, `data-openbb`, `scheduler`, `postgres`, `redis`) + local verification commands
Result: PASS (milestone smoke scope)

Step 1  — Confirm ph2m0 migrations applied and M0 data present     PASS
          `financial_snapshots=29748`, `transcripts=11548`, `ticker_coverage=503`
Step 2  — GET /v1/historical/financials?ticker=AAPL               PASS
          Schema-valid; analyst_estimates/guidance absent or null in JSON
          Warm latency: `12ms`
Step 3  — GET /v1/historical/transcripts?ticker=AAPL            PASS
          Warm latency: `54ms`
Step 4  — GET /v1/historical/coverage?ticker=AAPL               PASS
          Warm latency: `6ms`; SQL counts match (`AAPL snapshots=67`, `transcripts=26`)
Step 5  — Run delta sync                                        PASS
          Completed with `sec_rows_written=29748`, `sec_ticker_failures=0`, `coverage_rows=503`
Step 6  — Re-run delta sync immediately — idempotent            PASS
          Row counts unchanged across consecutive runs (`29748|11548|503`)
Step 7  — Phase 1 Deep Dive regression                          PASS
          Verified in `@thesis/product-api` tests (jobs/deep-dive lifecycle paths green)
Step 8  — Phase 1 Market Pulse regression                       PASS
          Verified in `@thesis/product-api` tests (`market-pulse.test.ts` green)
Step 9  — CI                                                    PASS (local pre-push)
          `pnpm lint`, `pnpm typecheck`, `pnpm test` all green

Steps failed (if any):
  - None

Notes:
  - Docker env hardening fix applied: compose now uses `DATABASE_URL_DOCKER` for in-container Postgres routing.
  - Data-openbb image fix applied: include `data/sp500_universe.csv` and `data/xbrl_concept_map.json` so M1 delta sync works in Docker.
  - Unknown ticker behavior verified: HTTP 200 with `missing=true` envelopes on all `/v1/historical/*` endpoints.
  - Owner-approved closeout basis: M1 acceptance uses successful staging sync + immediate idempotent re-run; extended soak moved to non-blocking TBD tracking.
```

---

## 16. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Transcript delta strategy (G1) | Weekly HF refresh from unpinned `main` HEAD; idempotent upsert; log resolved snapshot revision | Yes - reflected in `ph2_ADR-001` |
| SEC delta detail (G2) | Nightly 01:00 ET full archive pull + deterministic mapper + coverage upsert | No |
| `ph2m0_*` migration ownership | Authored M0; registered M1 | No |
| No third-party consensus rows | LLM outlook in M2 | PRD |
| `ticker_coverage` denormalized index | Unchanged pattern | No |
| DCF fields from SEC mapping | In `data`; beta at M2 | No |
| Docker DB routing split | Use `DATABASE_URL_DOCKER` for in-container services to avoid localhost/compose mismatch | No |
| Data-openbb image data files | Include `sp500_universe.csv` + `xbrl_concept_map.json` in image for delta sync runtime | No |

---

## 17. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Dexter historical consumption | M0/M1 provide data; M2 connects Dexter | — | Phase 2 M2 |
| QoQ/YoY comparison logic | M2 | — | Phase 2 M2 |
| Segment breakdown display | M2/M7 | — | Phase 2 M2 / M7 |
| Transcript quotes | M2 | — | Phase 2 M2 |
| Expectations / “vs market” narrative (no DB consensus) | M2 LLM + SKILL | — | Phase 2 M2 |
| Beta from price returns + OpenBB | M2 DCF | — | Phase 2 M2 |
| Mobile UI for historical context | No mobile changes in M1 | — | Phase 2 M7 |
| `ticker_coverage` exposed as a user-facing API | Coverage endpoint is internal only in M1; a user-facing data health page is out of scope | — | Not scheduled |
| GitHub main CI proof for this change-set | Owner-approved TBD follow-up after push/merge; non-blocking for M1 closeout | RZV-146 | TBD (owner-approved) |
| Destructive rollback rehearsal (`ph2m0_006 -> 005 -> 004` down) | Owner-approved TBD follow-up in a dedicated destructive-test window; non-blocking for M1 closeout | RZV-146 | TBD (owner-approved) |
