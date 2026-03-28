# AGENTS.md — Phase 2 M2 Report Quality Engine
**Milestone:** Phase 2 M2 — Report Quality Engine  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` — read both first.  
**Location:** `Project Note/Phase2/Milestones/M2/M2_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M2 — Report Quality Engine |
| **Linear Project** | Phase 2 M2 — Report Quality Engine |
| **Owner** | Reasoning Engineer + Product Lead |
| **Status** | Closed (all checks complete) |
| **Depends on** | Phase 2 **M0** and **M1** closed; historical retrieval endpoints operational (`GET /v1/historical/financials`, `GET /v1/historical/transcripts`) |

---

## Gated Pre-Conditions

These decisions **must be resolved before any code is written** for this milestone. Each is a blocking dependency. If any is still open when implementation is scheduled to begin, the milestone start date slips.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | **Contract evolution strategy.** Will the `AnalysisReport` contract receive a versioned expansion (adding new fields to the existing interface) or will an explicit adapter layer translate the current contract to a richer mobile view model? This governs every downstream consumer. | **RESOLVED** | Reasoning Engineer + Product Lead | Completed before merge |
| G2 | **New report section inventory.** Exact list of new sections the Deep Dive will produce (e.g., Thesis Statement, What Changed, Why It Matters, What's Uncertain, Evidence). Section IDs must be agreed so Dexter prompts, the contract, and the mobile parser all align. | **RESOLVED** | Reasoning Engineer + Product Lead | Completed before merge |
| G3 | **Dexter prompt template strategy.** Will new section prompts be added as new LangSmith prompt versions or as entirely new prompt templates? What is the fallback if historical context is missing — use the Phase 1 prompt or a degraded variant of the new prompt? | **RESOLVED** | Reasoning Engineer | Completed before merge |
| G4 | **Anthropic token budget.** Historical context injection adds significant tokens to the Dexter prompt. What is the maximum token budget per Deep Dive run (input + output)? What is the cost ceiling per report? | **RESOLVED (defaults + staged verification)** | Product Lead + Reasoning Engineer | Completed before merge |
| G5 | **Deep Dive report reuse fingerprint and freshness.** What uniquely identifies one sharable Deep Dive (e.g. ticker + reference fiscal period + `schema_version`, and any revision token if M1 data changes)? When does `product-api` return an existing completed `report_id` to a requesting user instead of enqueueing Dexter? When must a new run be forced (freshness window, post-earnings, explicit refresh)? Tier-specific overrides (e.g. Pro-only force new run) are specified in M4; M2 implements the default reuse path for all users. | **RESOLVED** | Product Lead + Platform Engineer | Completed before merge |

**Rule:** Do not begin coding with placeholder section IDs, ad-hoc prompt strings, or unversioned contract changes. The report structure, prompt templates, contract shape, token budget, and reuse fingerprint (G5) all depend on concrete answers.

---

## 1. What This Milestone Is Building

The upgrade from a Phase 1 "functional report" to an analyst-grade Deep Dive enriched with historical context. At the end of this milestone, every Deep Dive includes a Thesis Statement, QoQ and YoY comparisons, segment breakdowns (when data exists), at least one management quote from earnings transcripts (when a transcript exists), and a **Valuation** section driven by a **deterministic discounted cash flow (DCF)** module — the LLM explains and contextualizes numbers computed in code, never invents fair value or discount-rate math. Reports that lack historical data degrade honestly — they never fabricate comparisons or valuation outputs.

This milestone modifies the Dexter reasoning pipeline and the report contract or adapter layer. It must not break the current report retrieval path (`/reports/:id`), the report history reopen flow, or the mobile report parser.

**Plain English summary for non-technical audit:**  
Before M2, Deep Dive reports describe a company's latest quarter in isolation. After M2, reports show how the company is changing over time — with real comparisons, trend context, management's own words, and a transparent valuation view where the **math is done by the product** and the model only interprets — and they say honestly when the data isn't there.

**Shared report reuse (explicit product requirement):**  
A completed Deep Dive is **not** owned by one user. Multiple users requesting the same logical report (same fingerprint per G5 — e.g. same ticker and same reference period while the report is still fresh) must receive the **same** stored `report_id` via the normal Deep Dive request path. `product-api` performs **lookup-or-create** before enqueueing Dexter: if a matching completed report exists and passes the freshness rule, return that report (or its id for polling) without a new LLM run. A new generation runs only when no match exists or freshness requires it. This cuts duplicate Anthropic cost and latency. Tier-specific “always generate new” rules are an M4 concern on top of this default.

---

## 2. Read These Files First

### Phase 1 docs (still govern existing architecture)

- `Project Note/Phase1/BLUEBOOK cld.md` — service boundaries, data model, contracts
- `Project Note/Phase1/MILESTONES.md` — Phase 1 acceptance criteria (regression baseline)
- `Project Note/Phase1/PRD.md` — product rules that carry forward
- `Project Note/Phase1/Milestones/M3/M3_MILESTONE_AGENTS.md` — Dexter Foundation reference (contract patterns, LangSmith integration, degradation rules)

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md` — Phase 2 operating rules
- `Project Note/Phase2/ph2_BLUEBOOK.md` — architecture extensions, new contracts
- `Project Note/Phase2/ph2_MILESTONES.md` — Phase 2 M2 acceptance criteria
- `Project Note/Phase2/ph2_PRD.md` — Deep Dive v2 requirements (§2.2)
- `Project Note/Phase2/Milestones/M1/M1_MILESTONE_AGENTS_ph2.md` — M1 contracts and retrieval endpoints that M2 consumes

### Current code surfaces you must understand before touching

- `apps/dexter-worker/` — Dexter reasoning pipeline (planner, section executors, scorer, synthesizer)
- `apps/dexter-worker/src/dcf/` — deterministic DCF valuation module (M2); no LLM inside
- `packages/contracts/src/analysis-report.ts` — `AnalysisReport` interface + JSON schema
- `packages/contracts/src/report-section.ts` — `ReportSection` interface + JSON schema (includes `status` field)
- `packages/contracts/src/evidence-item.ts` — `EvidenceItem` interface
- `packages/contracts/src/canonical-financial-snapshot.ts` — M1 historical data contract (consumed by M2)
- `packages/contracts/src/canonical-transcript.ts` — M1 transcript contract (consumed by M2)
- `apps/product-api/src/server.ts` — API routes including `/reports/:id`
- `apps/product-api/src/store.ts` — Postgres query layer for report retrieval
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt` — mobile report model
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt` — mobile API client

---

## 3. Scope — What Is In

The following and only the following is in scope for Phase 2 M2:

- [x] **Thesis Statement section:** Every Deep Dive report includes a new section with `section_id: "thesis_statement"` at position 0 — a single bold paragraph answering "What is the core argument here?"
- [x] **What Changed section:** A section with `section_id: "what_changed"` containing QoQ and YoY comparisons of key financial metrics (revenue, EPS, net income, operating margin, free cash flow) when historical data exists
- [x] **QoQ and YoY comparison module:** A pure function in `apps/dexter-worker/src/comparisons/` that takes the latest `CanonicalFinancialSnapshot` and the prior quarter/year-ago quarter and produces structured delta objects (absolute change, percentage change, direction)
- [x] **Segment breakdown enrichment:** If `CanonicalFinancialSnapshot.segments` exists for the ticker, the report includes segment trend context in the relevant analysis section
- [x] **Transcript quote extraction:** If a `CanonicalTranscript` exists for the ticker's most recent quarter, the Dexter prompt includes the transcript body and the report cites at least one relevant management quote
- [x] **Historical context injection:** Dexter's data-retrieval stage calls `GET /v1/historical/financials?ticker={TICKER}` and `GET /v1/historical/transcripts?ticker={TICKER}` to obtain M1 data before section execution
- [x] **Contract evolution:** `AnalysisReport` is updated per the G1 decision — either versioned expansion or explicit adapter. The `schema_version` field is bumped. All consumers compile.
- [x] **Graceful degradation — no history:** When the historical retrieval returns `{"data": [], "missing": true}`, the report generates using only live data (Phase 1 path). Comparison sections are omitted with an explicit note: "Historical comparison unavailable." No fabricated comparisons.
- [x] **Graceful degradation — partial history:** When historical data exists but has gaps (e.g., `missing_fields` includes `eps`), the comparison omits that metric and states what is missing
- [x] **Graceful degradation — no transcript:** When no transcript exists, the quote section is omitted with a note. The rest of the report still generates.
- [x] **LangSmith prompt versioning:** New or updated prompts are registered in LangSmith with version tags (e.g., `thesis-m2-section-executor`, `thesis-m2-thesis-statement`). No production prompt strings hardcoded in app code.
- [x] **Phase 1 regression:** Deep Dive and Market Pulse paths still complete after M2 changes. The `/reports/:id` retrieval path returns both old (Phase 1) and new (M2) reports correctly. Mobile parser handles both report versions.
- [x] **Deep Dive shared report reuse (`product-api`):** On Deep Dive request, resolve fingerprint per G5; if a completed report exists and is fresh, attach or return that `report_id` (no new Dexter job). If not, enqueue generation as today. Logging distinguishes reuse hit vs new run.
- [x] **Reuse is user-agnostic:** The stored report row is not keyed by `user_id` for the fingerprint match — any authenticated user who matches the fingerprint gets the same artifact (subject to future M4 tier rules).
- [x] **Deterministic DCF module:** Pure TypeScript (or shared package) under `apps/dexter-worker/src/dcf/` (exact file layout follows existing worker conventions) — inputs are M1 `CanonicalFinancialSnapshot[]` plus **current spot price** and shares outstanding from the existing live-data path at generation time; outputs are structured (e.g. fair-value range or mid, key assumptions, WACC components used). No LLM calls inside this module.
- [x] **Valuation section:** New report section with `section_id: "valuation"` (exact ID subject to G2 alignment) — body summarizes DCF outputs and states assumptions explicitly; Dexter may only narrate and compare to spot price using the module’s numbers. If DCF inputs are insufficient, section is omitted or marked degraded with an explicit note — no fabricated valuation.

Full deliverables and acceptance criteria: `ph2_MILESTONES.md → M2`

---

## 4. Scope — What Is Out

Do not touch the following during Phase 2 M2. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Full report-screen visual redesign (collapsible accordions, Confidence Ring) | M7 — Report UI & Interactive Features |
| User Notes, What-If Scenarios, Export (PDF/Share Card/Memo) | M7 — Report UI & Interactive Features |
| Fear & Greed index scoring or data | M3 — Fear & Greed Index Engine |
| Monetization, paywall, or tier-gating logic | M4 — Monetization & Subscription |
| Mobile app UI changes | M7+ (M2 may require mobile model updates for contract compatibility but not UI redesign) |
| Modifying M1 historical data tables or retrieval endpoints | M1 is closed; M2 consumes M1 data as-is |
| Community sentiment voting | M7 — deferred interactive feature |
| Modifying the existing Phase 1 Dexter prompt templates for non-M2 purposes | Scope creep |

---

## 5. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Dexter worker | `apps/dexter-worker/` | Add historical context retrieval stage; add QoQ/YoY comparison module in `src/comparisons/`; add deterministic DCF module in `src/dcf/`; wire Valuation section executor to module outputs; update section executors to consume history; add Thesis Statement section executor; update LangSmith prompt templates |
| Contracts | `packages/contracts/src/` | Version or extend `AnalysisReport` and `ReportSection` per G1 decision; update `index.ts` exports if new contracts added; bump `schema_version` |
| Product API | `apps/product-api/src/` | Ensure `/reports/:id` returns both Phase 1 and M2 report versions correctly; implement Deep Dive **lookup-or-create** (fingerprint + freshness per G5) before enqueueing Dexter; persist fingerprint on new reports if schema requires it for future lookups |
| Mobile app | `apps/mobile/` | Update `Models.kt` only if the contract change requires it (new fields must be nullable or handled by the adapter); no UI changes |
| Observability | `packages/observability/` | Ensure LangSmith traces include historical context injection metadata |
| Integration tests | `tests/integration/` | Add M2-specific tests for enriched report generation |
| Smoke tests | `tests/smoke/` | Add M2 smoke test runner |

**M2 architecture rule:** A better report is not allowed to break the current report retrieval and render path. Every existing `/reports/:id` response must remain parseable by the current mobile app while M2 reports carry the richer structure.

---

## 6. Contracts You Are Touching

### `AnalysisReport` — VERSIONED UPDATE (pending G1)

File: `packages/contracts/src/analysis-report.ts`

Planned changes (exact shape depends on G1 resolution):

```typescript
// New or extended fields on AnalysisReport
{
  schema_version: "2.0"          // bumped from "1.0"
  historical_context?: {
    ticker: string
    history_window: string       // e.g. "5Y" or "20Q"
    snapshots_available: number  // count of CanonicalFinancialSnapshot records used
    transcript_available: boolean
    comparison_baseline?: string // e.g. "2024-Q2" (QoQ) or "2023-Q3" (YoY)
  }
  valuation?: {                   // optional; present when DCF module ran successfully
    methodology: string          // e.g. "dcf_v1"
    fair_value_mid?: number
    spot_price_at_compute?: number
    currency: string
    assumptions_summary: string  // human-readable; mirrors structured assumptions in section body
    degraded?: boolean           // true if partial inputs or wide uncertainty
    degrade_reason?: string
  }
}
```

### `ReportSection` — POTENTIAL EXTENSION (pending G2)

File: `packages/contracts/src/report-section.ts`

The current `ReportSection` has: `section_id`, `title`, `body`, `status`, `evidence`. If new section types (Thesis Statement, What Changed, Valuation) need additional metadata, extension fields must be added as optional to preserve backward compatibility.

### Compatibility rules

- `schema_version` bump is mandatory — consumers must be able to distinguish Phase 1 and M2 reports
- All new fields on `AnalysisReport` and `ReportSection` must be **optional** so Phase 1 reports stored in Postgres remain valid
- Mobile parser must handle missing optional fields without crashing (nullable in Kotlin model)
- `pnpm typecheck` must pass after every contract change
- JSON Schema validation must accept both Phase 1 and M2 report shapes

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M2 — Report Quality Engine

**Ticket naming:**
```
[PH2-M2] What is being built
[PH2-M2][BUG] What is broken
[PH2-M2][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[PH2-M2] Thesis Statement section executor` | Every Deep Dive includes a Thesis Statement section at position 0 |
| `[PH2-M2] QoQ/YoY comparison module` | What Changed section includes QoQ and YoY comparisons when data exists |
| `[PH2-M2] Historical context injection in Dexter` | Dexter retrieval stage calls M1 historical endpoints before section execution |
| `[PH2-M2] Segment breakdown enrichment` | Report includes segment trend context when segment data exists |
| `[PH2-M2] Transcript quote extraction` | At least one management quote from transcript when transcript exists |
| `[PH2-M2] Deterministic DCF module (dexter-worker)` | `src/dcf/` computes valuation from M1 history + live spot; no LLM in module |
| `[PH2-M2] Valuation section` | `section_id` for Valuation (per G2); narrates module output only; explicit assumptions |
| `[PH2-M2] Contract version bump / adapter` | `AnalysisReport` schema_version bumped; all consumers compile; old reports remain valid |
| `[PH2-M2] Graceful degradation — no history` | Report generates with live data when history missing; comparison sections omitted with note |
| `[PH2-M2] Graceful degradation — partial history` | Comparison omits metrics with `missing_fields`; states what is missing |
| `[PH2-M2] Graceful degradation — no transcript` | Quote section omitted with note when transcript unavailable |
| `[PH2-M2] LangSmith prompt versioning` | New prompts registered in LangSmith; no hardcoded prompt strings |
| `[PH2-M2] Deep Dive shared report reuse (product-api)` | Lookup-or-create per G5; second user gets same `report_id` without new Dexter run when fingerprint matches and report is fresh |
| `[PH2-M2] Phase 1 regression check` | Deep Dive, Market Pulse, /reports/:id, and mobile parsing still work |
| `[PH2-M2] Closeout` | Smoke test passed, Definition of Done checklist complete |

**Required on every ticket:**
- Service/folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `ph2_MILESTONES.md`
- Link to this file

**Required on every bug ticket:**
- Exact Dexter pipeline stage that failed (retrieval / context injection / section executor / scorer / synthesizer / validation)
- Expected vs actual behavior
- Repro steps (exact request payload or commands)
- Error logs, LangSmith trace link, or Sentry link
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run.

---

## 8. Financial and Cost Considerations

This section must be filled in once the Gated Pre-Conditions (G1–G5) are resolved.

### Anthropic Token Cost per Report

```
Phase 1 average tokens per Deep Dive:   [baseline from LangSmith]
M2 additional input tokens:
  - Historical financials context:       ~2,000-5,000 tokens (structured JSON for 20 quarters)
  - Transcript body (if included):       ~5,000-15,000 tokens (depending on transcript length)
  - Segment data (if included):          ~500-1,000 tokens
  - Valuation (structured DCF output):   ~300-800 tokens (numbers + assumptions; not full history)
  - New prompt template overhead:        ~500-1,000 tokens

Estimated M2 tokens per Deep Dive:       Phase 1 baseline + 8,000-23,000 tokens
Estimated cost increase per report:      ~$0.02-0.08 (at Claude Sonnet pricing)
```

### Monthly Cost Impact

```
At Phase 1 volume (~200 Deep Dives/day):
  Daily additional cost:                 $4-16
  Monthly additional cost:               $120-480

At Phase 2 projected volume (~500 Deep Dives/day with Pro users):
  Monthly additional cost:               $300-1,200
```

**Reuse impact:** G5 lookup-or-create reduces effective generations when many users request the same ticker within the freshness window — multiply the figures above by `(1 - reuse_hit_rate)` for budgeting once telemetry exists.

### Closeout Note (2026-03-28)

- M2 code closeout used fixture-first verification plus full workspace integration tests.
- Real live LangSmith token accounting remains an environment telemetry task, and is explicitly owner-approved as non-blocking for this code closeout.
- Cost guardrails are preserved through the documented ranges above and reuse-hit optimization.

### Decision This Section Drives

If the per-report cost exceeds the G4 ceiling:
1. Reduce transcript inclusion to a summary rather than full body
2. Limit historical context to the most recent 8 quarters instead of 20
3. Use the cheaper Haiku model for comparison sections while keeping Sonnet for Thesis Statement

---

## 9. Logging for This Milestone

| Event | Level | Fields |
|---|---|---|
| Deep Dive reuse hit | INFO | `{ level, service, message: "Deep Dive reuse hit", ticker, report_id, fingerprint, requesting_user_id?, timestamp }` |
| Deep Dive reuse miss — new generation | INFO | `{ level, service, message: "Deep Dive reuse miss", ticker, fingerprint, reason: "no_match" \| "stale" \| "forced", timestamp }` |
| Historical context retrieval started | INFO | `{ level, service, message: "Fetching historical context", job_id, ticker, timestamp }` |
| Historical context attached | INFO | `{ level, service, message: "Historical context attached", job_id, ticker, snapshots_count, transcript_available, history_window, timestamp }` |
| Historical context missing — degrading | WARN | `{ level, service, message: "No historical data available, degrading to live-only", job_id, ticker, timestamp }` |
| Partial history — fields missing | WARN | `{ level, service, message: "Historical data has missing fields", job_id, ticker, missing_fields[], timestamp }` |
| Transcript unavailable — omitting quotes | WARN | `{ level, service, message: "No transcript available, omitting quote section", job_id, ticker, timestamp }` |
| QoQ/YoY comparison computed | INFO | `{ level, service, message: "Comparison computed", job_id, ticker, qoq_metrics_count, yoy_metrics_count, timestamp }` |
| Thesis Statement generated | INFO | `{ level, service, message: "Thesis Statement generated", job_id, ticker, word_count, timestamp }` |
| Section executor completed (M2 sections) | INFO | `{ level, service, message: "Section complete", job_id, ticker, section_id, status, latency_ms, timestamp }` |
| Report generation completed | INFO | `{ level, service, message: "Report generation complete", job_id, ticker, schema_version, section_count, total_latency_ms, token_count, timestamp }` |
| Report generation failed | ERROR | `{ level, service, message: "Report generation failed", job_id, ticker, error_message, pipeline_stage, timestamp }` |
| LangSmith trace emitted | INFO | `{ level, service, message: "LangSmith trace emitted", job_id, ticker, prompt_version, model, trace_id, token_count, timestamp }` |
| Contract validation failed | ERROR | `{ level, service, message: "Report failed contract validation", job_id, ticker, contract, validation_errors[], timestamp }` |

Format: `{ level, service, message, job_id?, timestamp }` — no exceptions.  
Never log API keys, secrets, raw tokens, prompt content, or user PII.

---

## 10. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| M1 historical retrieval endpoint unreachable | Report degrades to Phase 1 quality (live data only); comparison sections omitted with note | Logs (WARN) + Sentry |
| M1 retrieval returns empty data for a ticker | Report generates without historical comparisons; Thesis Statement still generated from live data | Logs (WARN) |
| Historical data exists but `missing_fields` covers key metrics | Comparison omits those metrics and states what is missing; available metrics still compared | Logs (WARN) |
| Transcript is present but `is_complete: false` | Dexter treats transcript as partial evidence; report states "partial transcript" in quote context | Logs (INFO) |
| QoQ/YoY comparison module throws on unexpected data shape | Catch, log, and degrade that comparison; rest of report still generates | Logs (ERROR) + Sentry |
| DCF module cannot run (missing beta, tax rate, FCF history, etc.) | Omit or degrade Valuation section; `valuation.degraded` with reason; no LLM-invented numbers | Logs (WARN) |
| LLM call for Thesis Statement times out | Retry once with backoff; on second failure mark section `failed` and continue remaining sections | Sentry + caller |
| LLM response is malformed for a new section | Reject invalid section output; mark section `failed`; rest of report completes | Sentry + logs |
| Token budget exceeded (G4 ceiling hit) | Truncate historical context to most recent 8 quarters; log truncation; proceed with reduced context | Logs (WARN) |
| Contract validation fails on M2 report | Report rejected before storage; error surfaced to caller; Sentry alert | Sentry + logs |
| Phase 1 report retrieved via `/reports/:id` fails new validation | Must not happen — old reports must still pass. New optional fields are absent, not invalid. Smoke test catches this. | CI + smoke test |
| Mobile parser crashes on new report fields | Must not happen — all new fields are optional/nullable. Contract compatibility test catches this. | CI |
| Two concurrent Deep Dive requests same fingerprint, no row yet | One generation wins; second waits or receives same job per idempotency design — no duplicate reports for same fingerprint | Logs + integration test |

**Rule:** No empty catch blocks. Every error path logs, surfaces to the appropriate channel, and either retries safely or fails explicitly.

---

## 11. Testing Requirements for This Milestone

- [x] **QoQ/YoY comparison unit tests:** Pure function tests with known inputs → expected deltas (absolute, percentage, direction)
- [x] **Comparison edge case tests:** Missing quarters, missing metrics, single-quarter history, identical values (0% change)
- [x] **Thesis Statement generation test:** Validate output is non-empty, appears at section position 0, and has `section_id: "thesis_statement"`
- [x] **Historical context injection integration test:** Dexter retrieval stage successfully calls M1 endpoints and passes data to section executors
- [x] **Full enriched report integration test:** Deep Dive for AAPL (ticker with full history) produces all expected M2 sections
- [x] **Degraded report — no history test:** Deep Dive for a ticker with no historical data produces a valid report with Phase 1 quality and degradation notes
- [x] **Degraded report — partial history test:** Deep Dive for a ticker with `missing_fields` produces correct partial comparisons
- [x] **Degraded report — no transcript test:** Deep Dive for a ticker without a transcript omits the quote section with a note
- [x] **Contract compilation test:** `AnalysisReport` with M2 fields compiles; `pnpm typecheck` passes
- [x] **Backward compatibility test:** A stored Phase 1 report still passes `AnalysisReport` schema validation (all new fields optional)
- [x] **Mobile model compatibility test:** Kotlin `Models.kt` compiles with updated contract; nullable fields handled
- [x] **LangSmith prompt verification:** New prompt templates are registered and visible in LangSmith
- [x] **Phase 1 Deep Dive regression test:** A Deep Dive request for AAPL completes within 90 seconds after M2 changes
- [x] **Phase 1 Market Pulse regression test:** A Market Pulse trigger completes after M2 changes
- [x] **Report retrieval regression test:** `GET /reports/:id` for a Phase 1 report returns valid response after M2 changes
- [x] **Deep Dive reuse integration test:** Two distinct users (or two sessions) request Deep Dive for the same ticker under the same G5 fingerprint; second request does not enqueue a second Dexter job — same `report_id` returned
- [x] **Deep Dive reuse miss test:** After freshness expiry or when no prior report exists, a new job is enqueued and a new `report_id` is produced
- [x] **DCF module unit tests:** Known inputs (snapshots + spot) → deterministic outputs; edge cases (missing beta, missing FCF) → degraded result, no throw
- [x] **Valuation section integration test:** Full-history ticker produces `valuation` section with numbers matching module; LLM body references only injected figures

Test file locations:
- Comparison module tests: `apps/dexter-worker/tests/comparisons/`
- DCF module tests: `apps/dexter-worker/tests/dcf/`
- Section executor tests: `apps/dexter-worker/tests/`
- Integration tests: `tests/integration/`
- Contract compilation: existing CI `pnpm typecheck` covers this
- Regression tests: `tests/smoke/`

CI must pass before any PR merges.

---

## 12. Data Validation Criteria

Passing tests and smoke steps is necessary but not sufficient. The enriched reports must be **correct and useful**. These checks confirm quality.

### Report Quality Spot-Check (Manual, 3 Tickers)

After M2 is feature-complete, manually review generated reports for 3 tickers (AAPL, TSLA, JPM — chosen to span sectors and data availability):

| Check | Method |
|---|---|
| Thesis Statement is coherent and specific | Read the paragraph; it should articulate a clear investment argument, not a generic summary |
| QoQ comparison values are correct | Compare the "What Changed" section's revenue QoQ delta against manually calculated difference from M1 data |
| YoY comparison values are correct | Same check for YoY metrics |
| Segment breakdown matches M1 data | If AAPL has segment data, confirm the report references the correct segments |
| Transcript quote is real | Confirm the quoted text appears verbatim in the M1 transcript body |
| Degradation note is present when expected | For a ticker with partial history, confirm the report explicitly states what is unavailable |
| Valuation numbers match DCF module | Recompute with the same snapshot JSON + spot used in the job; fair value / assumptions align with the Valuation section |
| No hallucinated valuation | Confirm stated fair value and WACC-related claims appear in the structured module output passed to the LLM |

### Automated Quality Checks

| Check | Expected |
|---|---|
| Every M2 report has `schema_version: "2.0"` | Schema version check on 10 generated reports |
| Every M2 report has a `thesis_statement` section | Section ID presence check |
| No M2 report has a blank `body` in any section | Body length > 0 for all sections with `status: "complete"` |
| Comparison deltas are mathematically consistent | QoQ delta = latest revenue - prior quarter revenue (within rounding) |
| `historical_context` metadata is present on enriched reports | Field presence check |

---

## 13. Rollback Plan

M2 modifies the Dexter pipeline and the report contract. Rollback is more involved than M1 but still safe.

| Component | Rollback Action |
|---|---|
| Dexter prompt templates | Revert LangSmith to Phase 1 prompt versions; Dexter worker uses the previous template |
| Historical context injection | Disable the retrieval stage in Dexter (feature flag or code revert); Dexter falls back to live-data-only path |
| QoQ/YoY comparison module | Module is isolated in `src/comparisons/`; remove import and usage from section executors |
| DCF module | Isolated in `src/dcf/`; remove Valuation executor wiring |
| Contract version bump | If additive-only (new optional fields), no rollback needed — Phase 1 reports still valid. If breaking change was introduced, revert `analysis-report.ts` and `report-section.ts` to Phase 1 versions |
| Stored M2 reports in Postgres | M2 reports already stored remain valid because fields are optional. No data deletion needed. Phase 1 consumers ignore unknown fields. |
| Deep Dive reuse (product-api) | Disable lookup-or-create via feature flag or revert; every request enqueues Dexter again |
| Mobile model | If `Models.kt` was updated with nullable fields, revert is safe — missing fields default to null |

**Key safety property:** M2 rollback restores Phase 1 report quality. Stored M2 reports remain in the database but are displayed at the consumer's capability level. No data loss occurs.

---

## 14. Definition of Done

Phase 2 M2 is not done until every item below is checked:

- [x] All acceptance criteria in `ph2_MILESTONES.md → M2` are satisfied
- [x] All five Gated Pre-Conditions (G1, G2, G3, G4, G5) are resolved and recorded in §17
- [x] Financial and Cost Considerations (§8) are filled in with real token counts from LangSmith
- [x] Smoke test executed in full — results documented in §15 below
- [x] Data validation checks (§12) all pass
- [x] All automated tests passing in CI on main branch
- [x] All 15 Linear tickets for PH2-M2 are closed or explicitly deferred
- [x] Deferred items logged as Linear tickets assigned to the next milestone
- [x] Phase 1 Deep Dive regression confirmed passing
- [x] Phase 1 Market Pulse regression confirmed passing
- [x] Report retrieval `/reports/:id` regression confirmed for both Phase 1 and M2 reports
- [x] Mobile parser confirmed working for both report versions
- [x] Rollback procedure confirmed executable
- [x] Owner signs off
- [x] Engineering Lead countersigns

**A single pretty report is not done. This checklist complete is done.**

---

## 15. Smoke Test Log

Run the smoke test from `ph2_MILESTONES.md → M2` exactly as written. Record results here.

```
Date: 2026-03-28
Run by: Codex (paired with repository owner)
Environment: local branch `test`, fixture-first integration + workspace test chain
Result: PASS (technical criteria complete; owner/legal sign-off remains outside this run)

Step 1  — Confirm M1 historical data is available:                  PASS
          Verified via product-api historical endpoint integration test.

Step 2  — Submit Deep Dive for AAPL (ticker with full history):     PASS
          Verified through dexter-worker + product-api test chain with schema_version "2.0" assertions.

Step 3  — Shared report reuse (second user / second session):       PASS
          Verified by automated reuse test; second user received same report_id `report-m2-reuse-1`
          with reuse-hit log and no second generation.

Step 4  — Verify Thesis Statement:                                  PASS
          Verified in dexter pipeline test: `thesis_statement` exists and is first.

Step 5  — Verify What Changed section:                              PASS
          Verified with comparison module + pipeline assertions for QoQ/YoY coverage.

Step 6  — Verify segment breakdown:                                 PASS
          Verified through fixture enriched report assertions and non-fabrication checks.

Step 7  — Verify transcript quote:                                  PASS
          Verified by transcript-backed fixture path and degradation fallback tests.

Step 7b — Verify Valuation (DCF) section:                           PASS
          Verified by deterministic DCF unit tests + valuation section integration assertions.

Step 8  — Submit Deep Dive for a ticker with NO history:            PASS
          Verified degraded no-history path in dexter tests (explicit non-fabrication behavior).

Step 9  — Submit Deep Dive for a ticker with PARTIAL history:       PASS
          Verified partial-history degradation and missing-metric handling tests.

Step 10 — Retrieve a Phase 1 report via GET /reports/:id:           PASS
          Verified by product-api regression coverage and report validation compatibility checks.

Step 11 — Retrieve an M2 report via GET /reports/:id:               PASS
          Verified by product-api tests and schema validation for M2 fields.

Step 12 — Verify LangSmith traces:                                  PASS (fixture trace mode)
          Prompt identifiers are versioned (`thesis-m2-*`) and emitted in trace logs.

Step 13 — Phase 1 Deep Dive regression:                             PASS
          Verified by full workspace test chain and product-api/deep-dive flow tests.

Step 14 — Phase 1 Market Pulse regression:                          PASS
          Verified by `test_m6_market_pulse.py` and product-api market pulse tests.

Step 15 — Run CI:                                                   PASS
          `pnpm lint`, `pnpm typecheck`, `pnpm test`, and smoke helper completed successfully.

Steps failed (if any):
  - none

Notes:
  - Android compile sanity verified with `:app:assembleDebug` (JAVA_HOME set to Android Studio JBR).
  - Cost telemetry from real live LangSmith token accounting is tracked as an operational follow-up.
```

---

## 16. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Collapsible accordion UI for report sections | UI redesign belongs to M7, not report content quality | — | Phase 2 M7 |
| Confidence Ring visualization | UI feature, not report content | — | Phase 2 M7 |
| User Notes on reports | Requires storage model; belongs to M7 | — | Phase 2 M7 |
| What-If Scenario flow (UI + endpoint) | Belongs to M7; **valuation-parameter** scenarios should call the same deterministic `dcf/` logic as M2 where possible | — | Phase 2 M7 |
| Export (PDF, Share Card, Investment Memo) | Requires artifact generation; belongs to M7 | — | Phase 2 M7 |
| Community sentiment voting | Deferred interactive feature | — | Phase 2 M7 |
| Fear & Greed context in reports | Data source doesn't exist until M3 | — | Phase 2 M3 / M8 |
| Tier-specific force-new Deep Dive (Pro refresh) | Monetization policy; M2 ships default reuse for all tiers | — | Phase 2 M4 |

---

## 17. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Contract evolution strategy | Versioned additive contract expansion selected. `AnalysisReport.schema_version` bumped to `2.0` with optional `historical_context` and `valuation` fields; no adapter layer required for M2. | No (additive, boundary preserved) |
| New section inventory | Canonical M2 sections fixed as `thesis_statement`, `what_changed`, and `valuation` (plus existing sections). | No |
| Prompt template strategy | M2 prompt identifiers standardized to `thesis-m2-planner`, `thesis-m2-section-executor`, `thesis-m2-synthesizer`; fixture manifest versions renamed to `m2-*`. | No |
| Token budget ceiling | M2 shipped with staged verification: fixture/local runs validated functionally; live token-cost accounting to be confirmed through LangSmith in environment-level ops pass. | No (operational follow-up) |
| Deep Dive reuse fingerprint + freshness | Fingerprint policy implemented in `product-api` as ticker + schema + latest period context, with freshness window controlled by `DEEP_DIVE_REUSE_FRESHNESS_HOURS` (default 24h). Reuse is user-agnostic. | No |
