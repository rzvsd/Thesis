# AGENTS.md - M5 Company Deep Dive v1

**Milestone:** M5 - Company Deep Dive v1  
**Inherits from:** Root `AGENTS.md` - read that first.  
**Location:** `Project Note/Milestones/M5/M5_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
| --- | --- |
| **Milestone** | M5 - Company Deep Dive v1 |
| **Linear Project** | https://linear.app/rzvsd/project/m5-company-deep-dive-v1-65128e79b892 |
| **Owner** | Engineering Lead + AI/Reasoning Engineer |
| **Status** | Closed (Passed) |
| **Depends on** | M4 - Product API + Job System complete |

---

## 1. What This Milestone Is Building

The first user-facing product feature. A supported request starts at ticker search, goes through Product API + queue + Dexter, and ends with a stored, retrievable, schema-valid, evidence-backed Company Deep Dive report under the M5 SLA.

**Plain-English summary:**  
Search for a company, request a Deep Dive, and receive a structured report with sourced claims and explicit limits.

---

## 2. Scope - What Is In

The following is in scope for M5:

* [x] Ticker search returns results for supported US-listed NYSE and NASDAQ equities from the approved ticker registry
* [x] Ticker registry is seeded from Nasdaq Trader symbol-directory files (`nasdaqlisted.txt`, `otherlisted.txt`) and refreshed by sync job
* [x] Daily delta processing is implemented for ticker add/delete/name/symbol changes using an official Nasdaq feed path
* [x] Invalid or unsupported ticker search returns a clear not-found response and never crashes
* [x] A Deep Dive request for a supported ticker creates a job, enters the queue, and is processed by Dexter without manual intervention
* [x] The generated report contains all expected Deep Dive sections required by the PRD Surface A contract
* [x] Every report section has a valid `status` field - no blank or missing sections
* [x] Every scored claim has at least one `EvidenceItem` with a named source
* [x] Research Signal, if emitted as positive / neutral / negative, carries at least two `EvidenceItem` entries; otherwise signal is `no_signal`
* [x] Every report includes a confidence block with score, label, and limiting factors
* [x] Every report includes the required research disclaimer text
* [x] Every completed report validates against the `AnalysisReport` schema with zero errors before storage
* [x] A failed job returns a clean failure state and does not store or expose a partial report
* [x] Every successful or failed Deep Dive run produces a LangSmith trace with full lineage
* [x] End-to-end Deep Dive latency is under 90 seconds for at least 19 of 20 realistic staging runs
* [x] All M5 Deep Dive smoke tests pass exactly as written in `MILESTONES.md`

Full deliverables and acceptance criteria: `Project Note/MILESTONES.md -> M5`

---

## 3. Scope - What Is Out

Do not touch the following during M5. If needed, raise and track in Linear.

| Out of scope | Reason |
| --- | --- |
| Registration, login, token refresh, logout, or other auth mechanics | M4 already established |
| Market Pulse pipeline, scheduler behavior, or push delivery | M6 |
| Android UI rendering, progress screens, retry buttons, or device UX | M7 |
| Watchlist CRUD or watchlist overlay behavior | M6 / M7 |
| Google Sign-In implementation | Later auth scope |
| Account deletion, privacy-policy workflows, or archival compliance tooling | Later milestone / post-launch |
| PostHog analytics and feature flags | M7 / M8 |
| New data-plane provider expansion beyond Deep Dive consumption | M2 already established |
| Hosting target migration decisions | Requires ADR and infra rollout update |
| Redesign of Deep Dive beyond PRD contract | Product contract change |

---

## 4. Services You Are Working In

| Service | Folder | M5 focus |
| --- | --- | --- |
| `product-api` | `apps/product-api/` | Ticker registry/search, supported ticker gate, report retrieval behavior |
| `dexter-worker` | `apps/dexter-worker/` | PRD section contract, disclaimer, evidence gates, LangSmith lineage, failure behavior |
| Contracts | `packages/contracts/` | Use canonical contracts, add ticker contracts where needed |
| Observability | `packages/observability/` | Structured logs, Sentry failure context, LangSmith metadata |
| Infra / migrations | `infra/` and `apps/product-api/` | Ticker registry schema + sync scheduling wiring |
| Integration tests | `tests/integration/` | End-to-end API and worker path coverage |
| Smoke tests | `tests/smoke/` | Scripted M5 smoke coverage aligned to milestone checklist |

---

## 5. Contracts You Are Touching

| Contract | Change type | File path |
| --- | --- | --- |
| `AnalysisRequest` | Read-only unless bug found | `packages/contracts/src/analysis-request.ts` |
| `AnalysisReport` | Read-only unless proven PRD gap requires versioned change | `packages/contracts/src/analysis-report.ts` |
| `ReportSection` | Read-only unless proven PRD gap requires versioned change | `packages/contracts/src/report-section.ts` |
| `EvidenceItem` | Read-only unless bug found | `packages/contracts/src/evidence-item.ts` |
| `ServiceResponse` | Read-only where reused | `packages/contracts/src/service-response.ts` |
| `TickerSearchResult` | Added for M5 | `packages/contracts/src/ticker-search-result.ts` |
| `TickerRegistryEntry` | Added for M5 | `packages/contracts/src/ticker-registry-entry.ts` |

Rules:

* PRD Surface A section coverage is mandatory
* Every scored claim requires evidence
* Directional research signal requires at least two evidence items; otherwise `no_signal`
* Disclaimer text is mandatory on every report
* Schema validation is mandatory before storage
* Partial reports are never exposed after terminal failure

---

## 6. Linear Ticket Rules for This Milestone

Project: `M5 - Company Deep Dive v1`

Naming:

```text
[M5] What is being built
[M5][BUG] What is broken
[M5][SPIKE] What is being investigated
```

Required per ticket:

* Service/folder touched
* Contract touched (if any)
* Acceptance criterion mapped to `MILESTONES.md`
* Link back to this file

Required per bug ticket:

* Repro steps
* Expected vs actual
* Failure stage
* Service owner
* Sentry/log proof
* Severity (`P1` / `P2` / `P3`)

Never close a ticket without passing tests and smoke evidence.

---

## 7. Logging for This Milestone

Structured JSON format:

`{ level, service, message, job_id?, request_id?, timestamp }`

M5 key events include:

* Ticker search requested/succeeded/not-found
* Deep Dive request accepted and queued
* Dexter section complete/degraded
* Evidence-gate warnings
* Schema validation and disclaimer failures
* Report store success/failure
* SLA warnings
* LangSmith trace emission

No secrets, tokens, or PII in logs.

---

## 8. Error Handling for This Milestone

Expected behavior:

* Unsupported ticker search returns clean not-found
* Unsupported ticker job requests are rejected before queueing
* Missing evidence degrades honestly; no fabricated directional signal
* Missing disclaimer or schema invalid report fails before storage
* Fatal pipeline failure marks job `failed` and stores no partial report
* Missing LangSmith trace blocks closeout
* SLA misses beyond threshold block closeout

No empty catch blocks.

---

## 9. Testing Requirements for This Milestone

Required and completed:

* [x] Unit tests for ticker registry parser and sync behaviors
* [x] Unit tests for evidence gates and report validation behavior
* [x] Integration tests for ticker search and not-found behavior
* [x] Integration tests for supported request -> queue -> worker -> report retrieval
* [x] Validation tests for schema rejection before storage
* [x] Section presence/status/non-blank tests
* [x] Disclaimer enforcement tests
* [x] Atomic failure tests (no partial report retrievable)
* [x] LangSmith lineage verification in smoke path
* [x] SLA smoke validation (`>= 19/20` under 90s)
* [x] CI-equivalent lint and test run clean

Test locations:

* `apps/product-api/tests/`
* `apps/dexter-worker/tests/`
* `tests/integration/`
* `tests/smoke/`

---

## 10. Definition of Done

M5 is done when all items below are true:

* [x] All 13 acceptance criteria in `MILESTONES.md -> M5` are satisfied
* [x] Smoke test executed in full - results logged in Section 11
* [x] Automated tests pass (`corepack pnpm lint` and `corepack pnpm test`)
* [x] All M5 Linear tickets are closed or explicitly deferred
* [x] Rollback path is executable
* [x] Supported ticker search works for NYSE/NASDAQ entries
* [x] Full refresh + daily delta sync checks pass
* [x] Unsupported ticker search returns clean not-found
* [x] Supported request produces schema-valid stored report
* [x] Expected PRD sections are present and have valid `status`
* [x] Evidence gates are enforced
* [x] Disclaimer exists on every stored report
* [x] Failed jobs expose no partial stored report
* [x] LangSmith trace visibility confirmed for verified runs
* [x] SLA target met (`20/20` under 90s observed)
* [x] Owner signs off
* [x] Engineering Lead countersigns

Sign-off:

* Owner: Rzv_sd (2026-03-21)
* Engineering Lead: Rzv_sd (2026-03-21)

---

## 11. Smoke Test Log

```text
Date: 2026-03-20
Run by: Codex agent
Environment: local docker stack (product-api, dexter-worker, redis, postgres)
Result: PASS

Steps failed (if any):
  - None

Notes:
  - Command: python tests/smoke/m5_company_deep_dive_smoke.py
  - Supplemental smoke helper: python tests/smoke/m5_ticker_registry_delta_smoke.py -> PASS
  - Supplemental smoke helper: python tests/smoke/m5_dexter_deep_dive_smoke.py -> PASS (manual LangSmith/product-layer checks remain manual by design)
  - Step 0a/0b/0c (full + daily delta): PASS
  - Step 1/2 search behavior: PASS
  - Steps 3-16 (AAPL): PASS; elapsed=7.24s
  - Step 17 (MSFT + TSLA): PASS; elapsed=6.10s and 7.09s
  - Additional owner-requested Microsoft-only rerun (MSFT replacing TSLA for the extra check): PASS; run #1=6.09s, run #2=7.11s.
  - Steps 18-19 forced failure path (FAILME): PASS; no partial report retrievable
  - Step 20/21 SLA loop: PASS; 20/20 under 90s (max=9.23s, avg=6.79s)
  - Manual UI verification completed: LangSmith trace visibility confirmed and forced-failure context verified in Sentry UI.
  - 2026-03-21 closeout verification: ticker sync guardrail fails outside Postgres mode as expected (`Ticker sync requires STORE_BACKEND=postgres and a live DATABASE_URL`).
  - 2026-03-21 closeout verification: live Dexter preflight now fails fast when `FINANCIAL_DATASETS_API_KEY` is missing instead of silently completing with `no_signal`.
  - 2026-03-21 regression: `corepack pnpm --filter @thesis/product-api test` and `corepack pnpm --filter @thesis/dexter-worker test` passed.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
| --- | --- | --- |
| Ticker universe for v1 | Supported universe is US-listed public equities on NYSE and NASDAQ only | No |
| Scored-claim evidence gate | Every scored claim requires at least one named-source `EvidenceItem` | No |
| Research signal gate | Directional signal requires at least two `EvidenceItem`; else `no_signal` | No |
| Canonical disclaimer text | `This is a research summary, not financial advice. Always do your own research.` | No |
| Deep Dive section mapping | PRD Surface A wording is enforced | No |
| Ticker seed source | Nasdaq Trader symbol-directory files (`nasdaqlisted.txt`, `otherlisted.txt`) | No |
| Delta strategy | Daily official delta feed path for add/delete/name/symbol changes | No |
| Sync execution model | Automatic sync (startup + scheduled intervals), no manual step in normal operation | No |
| Smoke fixture parity | Full-seed fixture must include AAPL, MSFT, and TSLA to avoid false negative 404s | No |
| Live preflight hard-stop | Deep Dive live mode must require `FINANCIAL_DATASETS_API_KEY`; missing key now fails preflight instead of returning misleading degraded output | No |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
| --- | --- | --- | --- |
| Android progress UX and report rendering nuances | Device UX belongs to Android MVP | - | M7 |
| Google Sign-In auth path | Not required for M5 closeout | - | Future auth milestone |
| Unsupported security classes beyond rejection | v1 scope intentionally limited to supported NYSE/NASDAQ equities | - | Post-launch |
| Watchlist-linked search/request shortcuts | Watchlist scope lands in later milestones | - | M6 / M7 |
| Future hosting migration (for example Hetzner VPS) | Requires ADR and infra rollout update | - | Future ADR |
| Finance-provider cost optimization refactor | Deferred optimization after core milestone sequence | - | Future roadmap |
