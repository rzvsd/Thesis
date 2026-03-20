# AGENTS.md — M2 Data Plane

**Milestone:** M2 — Data Plane
**Inherits from:** Root `AGENTS.md` — read that first.
**Location:** `Milestones/M2 — Data Plane/M2_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Milestone**      | M2 — Data Plane                            |
| **Linear Project** | M2 — Data Plane                            |
| **Owner**          | Data Platform Engineer                     |
| **Status**         | Complete                              |
| **Depends on**     | M1 — Baseline complete (Passed 2026-03-13) |

---

## 1. What This Milestone Is Building

The first real data flow in the system. `data-openbb` must retrieve structured company financial data and return it as `CanonicalFinanceData`. It must also retrieve structured macro data and return it as `CanonicalMacroData`. `news-ingest` must retrieve approved-source articles, normalize them into `CanonicalNewsArticle`, and degrade cleanly when a source is missing or blocked. The deliverable is not “we connected to providers.” The deliverable is validated, contract-compliant data that downstream services can trust.

**Plain English summary for non-technical audit:**
This milestone turns on the pipes: financial numbers and approved news start flowing into the system in a clean, checked format, and missing data is declared honestly instead of hidden.

---

## 2. Scope — What Is In

The following and only the following is in scope for M2:

* [ ] `data-openbb` returns valid `CanonicalFinanceData` for at least 3 test tickers
* [ ] `data-openbb` returns valid `CanonicalMacroData` for the current day
* [ ] Every `CanonicalFinanceData` response includes `missing_fields`, even if empty
* [ ] Missing financial fields are declared in `missing_fields` and never replaced with zeroes or estimates
* [ ] `news-ingest` returns valid `CanonicalNewsArticle` objects from at least 2 approved sources
* [ ] Every `CanonicalNewsArticle` includes source name, URL, title, published timestamp, body text, and `is_approved_source: true`
* [ ] When a news source is unreachable, `news-ingest` returns an empty list with an error flag and does not crash
* [ ] Redis-backed rate limiting is enforced on outbound provider calls
* [ ] Golden fixtures are committed to `data/golden/` and data-plane tests run against them in CI

Full deliverables and acceptance criteria: `MILESTONES.md → M2`

---

## 3. Scope — What Is Out

Do not touch the following during M2. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope                                               | Reason                             |
| ---------------------------------------------------------- | ---------------------------------- |
| Dexter reasoning pipeline                                  | M3                                 |
| Prompt logic, model calls, LangSmith prompt content        | M3                                 |
| Product API auth and job lifecycle                         | M4                                 |
| Postgres job records and audit events                      | M4                                 |
| Mobile app UI or device behavior                           | M7                                 |
| Scheduler automation                                       | M6                                 |
| Importance ranking or narrative scoring of news            | Belongs to Dexter, not news-ingest |
| News deduplication beyond basic safe normalization         | Can be expanded later if needed    |
| Third-party news APIs                                      | Explicitly out for v1 per ADR-002  |
| Direct provider calls from any plane except the Data Plane | Forbidden by Bluebook              |

---

## 4. Services You Are Working In

| Service           | Folder                    | What you are doing in it                                                                                                     |
| ----------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `data-openbb`     | `apps/data-openbb/`       | Implement provider retrieval, normalization, validation, and missing-field handling for company financial data (`CanonicalFinanceData`) and macro data (`CanonicalMacroData`) |
| `news-ingest`     | `apps/news-ingest/`       | Implement RSS-first ingestion, approved-source normalization, `news-please` HTML fallback where explicitly allowed, and outage degradation |
| Contracts         | `packages/contracts/`     | Use existing canonical schemas; modify only if an implementation gap is proven and versioned                                 |
| Shared types      | `packages/shared-types/`  | Add shared provider/source enums or error-code constants only if used by both services                                       |
| Observability     | `packages/observability/` | Wire shared logging / Sentry bootstrap used by both data-plane services                                                      |
| Infra             | `infra/`                  | Add provider env vars, Redis-backed rate limiting config, and any docker-compose updates needed for M2                       |
| Golden fixtures   | `data/golden/`            | Store validated sample responses for finance, macro, and news                                                                |
| Integration tests | `tests/integration/`      | Add cross-service data-plane tests                                                                                           |
| Smoke tests       | `tests/smoke/`            | Add M2 smoke test runner or scripted equivalent                                                                              |

**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

M2 should use the contracts created in M1. Modify only if an implementation gap is real and documented.

| Contract                | Change type                       | File path                                          |
| ----------------------- | --------------------------------- | -------------------------------------------------- |
| `CanonicalFinanceData`  | Read-only unless bug found        | `packages/contracts/src/canonical-finance-data.ts` |
| `CanonicalMacroData`    | New for M2                        | `packages/contracts/src/canonical-macro-data.ts`   |
| `CanonicalNewsArticle`  | Modified semantics only if needed | `packages/contracts/src/canonical-news-article.ts` |
| `ServiceResponse`       | New for M2                        | `packages/contracts/src/service-response.ts`       |

**Rules:**

* Use M1 contract definitions as the default truth
* If a contract must change, bump the version and verify all consumers compile
* Never define provider response shapes inside service code as ad-hoc objects
* If `error_flag` or rate-limit metadata requires a response wrapper not already contractized, create the smallest versioned contract first, then implement the service code
* JSON Schema validation remains mandatory for runtime validation
* `CanonicalFinanceData` must not be expanded to absorb macro data
* Macro data must use `CanonicalMacroData`

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M2 — Data Plane

**Ticket naming:**

```text
[M2] What is being built
[M2][BUG] What is broken
[M2][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item or tightly-coupled implementation slice:**

| Ticket                                           | Acceptance criteria it satisfies                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `[M2] data-openbb canonical finance retrieval`   | Valid `CanonicalFinanceData` for 3 test tickers                             |
| `[M2] data-openbb macro retrieval`               | Valid macro data for current day                                            |
| `[M2] missing_fields enforcement`                | `missing_fields` always present; no zero / placeholder substitution         |
| `[M2] news-ingest approved-source normalization` | Valid `CanonicalNewsArticle` list from at least 2 approved sources          |
| `[M2] news-ingest outage degradation`            | Empty list + error flag on unreachable source; no crash                     |
| `[M2] Redis-backed provider rate limiting`       | Rate limiting enforced, returns rate limit error                            |
| `[M2] golden fixtures and CI`                    | Golden fixtures committed; tests run in CI                                  |
| `[M2][SPIKE] response envelope for error_flag`   | Only if existing contracts do not yet model the required error flag cleanly |
| `[M2][SPIKE] news-please HTML fallback dependency adoption` | Only if the current HTML fallback path does not yet use the ADR-002 concrete dependency |

**Required on every ticket:**

* Service or folder it touches
* Contract it touches (if any)
* Acceptance criteria line from `MILESTONES.md` it satisfies
* Link to this file

**Required on every bug ticket:**

* Steps to reproduce (exact commands or requests)
* Expected behavior
* Actual behavior
* Which provider or source failed
* Which service surfaced the error
* Log output or Sentry link
* Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run and the relevant acceptance item verified.

---

## 7. Logging for This Milestone

M2 introduces real external dependencies. Logging must be structured and consistent.

| Event                              | Level | Fields                                                                         |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------ |
| Data retrieval started             | INFO  | `service, request_id, provider, ticker?, ingestion_method?, dataset, timestamp`                   |
| Data retrieval succeeded           | INFO  | `service, request_id, provider, ticker?, ingestion_method?, record_count?, latency_ms, timestamp` |
| Missing fields detected            | WARN  | `service, request_id, provider, ticker, missing_fields[], timestamp`           |
| Provider rate limit hit            | WARN  | `service, request_id, provider, ingestion_method?, retry_after_seconds?, timestamp`               |
| Source unreachable / parser failed | ERROR | `service, request_id, source, provider, ingestion_method?, error_message, http_status?, timestamp`          |
| Schema validation failed           | ERROR | `service, request_id, contract, validation_errors[], timestamp`                |

Format: `{ level, service, message, request_id?, timestamp }` — no exceptions.
Do not log provider keys, tokens, raw secrets, or user PII.

**Note:** M2 does not require `job_id` because the job system is not introduced until M4.

---

## 8. Error Handling for This Milestone

| Failure scenario                      | Expected behavior                                                                  | Surfaces to     |
| ------------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| OpenBB provider key invalid / expired | Return structured provider auth error; do not crash process                        | Sentry + caller |
| Provider returns 429                  | Return structured rate limit error with retry-after semantics                      | Sentry + caller |
| Financial field unavailable           | Add field name to `missing_fields`; never replace with `0`, `N/A`, or estimate     | Caller + logs   |
| News source unreachable               | Return empty list with error flag; service stays healthy                           | Sentry + caller |
| RSS / HTML parse failure              | Return empty list with error flag; log source-level failure                        | Sentry          |
| Response fails schema validation      | Reject response, log validation errors, fail request cleanly                       | Sentry          |
| Network timeout                       | Retry once for idempotent fetch; on second failure return structured timeout error | Sentry + caller |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in M2 requires:

* [ ] Unit test for every new mapper, parser, or normalizer
* [ ] Integration test for every service endpoint or service method that hits a provider boundary
* [ ] Golden fixture tests for `CanonicalFinanceData`
* [ ] Golden fixture tests for `CanonicalMacroData`
* [ ] Golden fixture tests for `CanonicalNewsArticle`
* [ ] Approved HTML-source tests exercise the `news-please` fallback path, not only a custom parser path
* [ ] Missing-data degradation tests for finance retrieval
* [ ] Outage / unreachable-source degradation tests for news-ingest
* [ ] Rate-limit tests proving Redis-backed throttling returns a rate limit error instead of a provider error
* [ ] CI must run these tests automatically on every PR

Test files live in:

* `apps/data-openbb/tests/`
* `apps/news-ingest/tests/`

Cross-service tests live in:

* `tests/integration/`

Golden fixtures live in:

* `data/golden/`

Smoke tests live in:

* `tests/smoke/` or an equivalent scripted runner committed to the repo

**Important:** CI should use fixtures/mocks where practical. Live provider calls belong in smoke validation, not flaky default CI paths.

---

## 10. Definition of Done

M2 is not done until every item below is checked:

* [ ] All 9 acceptance criteria in `MILESTONES.md → M2` are satisfied
* [ ] Smoke test executed in full — results documented in §11 below
* [ ] All automated tests passing in CI
* [ ] All Linear tickets for M2 are closed or explicitly deferred
* [ ] Deferred items logged as Linear tickets assigned to the next milestone
* [ ] Rollback procedure confirmed executable
* [ ] `CanonicalFinanceData` retrieval path is implemented and validated
* [ ] `CanonicalMacroData` retrieval path is implemented and validated
* [ ] Live-provider smoke validation is completed after provider keys are provisioned
* [ ] Owner signs off
* [ ] Engineering Lead countersigns

**A provider returning data once is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md → M2` exactly as written. Record results here.

```text
Date: 2026-03-14
Run by: Codex
Environment: local
Result: PASS (local smoke and local automation)

Step 1  — Start data-openbb and news-ingest locally:                         PASS
Step 2  — Request data-openbb finance endpoint for ticker "AAPL":            PASS
Step 3  — Response is valid CanonicalFinanceData:                            PASS
Step 4  — missing_fields array exists:                                       PASS
Step 5  — retrieved_at timestamp exists:                                     PASS
Step 6  — Request data-openbb macro endpoint for current day:                PASS
Step 7  — Response is valid CanonicalMacroData:                              PASS
Step 8  — macro as_of / retrieved_at timestamp exists:                       PASS
Step 9  — Request data-openbb for dummy no-data ticker:                      PASS
Step 10 — missing_fields lists all expected fields:                          PASS
Step 11 — No zero / placeholder substitution present:                        PASS
Step 12 — Request news-ingest for today's articles:                          PASS
Step 13 — Response is a ServiceResponse containing CanonicalNewsArticle[]:  PASS
Step 14 — Every article has is_approved_source: true:                        PASS
Step 15 — Simulate provider outage / blocked source:                         PASS
Step 16 — Empty list + error flag returned, no crash:                        PASS
Step 17 — Run CI; all data-plane tests pass:                                 PASS (local `pnpm test`, `pnpm lint`, `pnpm typecheck`)

Steps failed (if any):
  - None

Notes:
  - Smoke was executed against local containers with fixture mode enabled for deterministic M2 acceptance coverage.
  - News outage was simulated by temporarily moving `reuters.rss.xml` inside the `news-ingest` container and then restoring it.
  - Separate live-provider validation also passed for `data-openbb` with `DATA_OPENBB_FIXTURE_MODE=false` and a transient `FMP_API_KEY`:
    `GET /v1/finance/company?ticker=AAPL` -> PASS
    `GET /v1/finance/macro?scope=daily` -> PASS
  - Hosted GitHub Actions validation for the current unpushed M2 diff is still pending and is tracked separately in Linear.
```

---

## 12. Decisions Made During This Milestone

Log any architectural or product decisions made during this milestone. If a decision is significant, it requires an ADR in `/DECISIONS/`.

| Decision                         | What was decided                                                       | ADR required?                    |
| -------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| OpenBB provider strategy         | Use approved provider prioritization / fallback order                  | Yes — ADR-001                    |
| News ingestion strategy          | RSS first; `news-please` HTML scraping only for explicitly approved fallback sources | Yes — ADR-002                    |
| Approved source list             | Reuters, Bloomberg, Financial Times, SEC EDGAR, WSJ Markets            | No — already captured in ADR-002 |
| Test tickers for golden fixtures | `AAPL`, `MSFT`, `TSLA`                                                   | No                               |
| Rate-limit thresholds            | FMP finance `10/min`; Polygon `5/min`; FMP macro `5/min`; Alpha Vantage `5/min`; Redis window `60s`; burst allowance `2`; cooldown/backoff `60s` | No unless architecture changes   |
| Macro/finance API surface        | Canonical routes: `GET /v1/finance/company`, `GET /v1/finance/macro`, `GET /v1/news` — see BLUEBOOK §11.1 | No |
| OpenBB dependency install path   | Use the pinned `finBase` commit via `#subdirectory=openbb_platform` because the Python package root lives under `openbb_platform/` | No |

---

## 13. Known Issues and Deferrals

Log anything discovered but intentionally deferred.

| Issue                                                  | Why deferred                                                   | Linear ticket | Target milestone         |
| ------------------------------------------------------ | -------------------------------------------------------------- | ------------- | ------------------------ |
| Importance ranking of articles                         | Belongs to Dexter reasoning, not raw ingestion                 | —             | M3                       |
| Broader deduplication / clustering of similar articles | Not required to satisfy M2 acceptance criteria                 | —             | M3 / M6                  |
| Legal review of approved source list                   | Required before public release, not for internal M2 completion | —             | M5                       |
| Third-party news API integration                       | Explicitly excluded in ADR-002 for v1                          | —             | Post-launch / future ADR |
| Per-timezone Market Pulse source windows               | Scheduler concern, not M2                                      | —             | M6                       |
| Hosted GitHub CI for the current M2 diff not yet observed | Local lint, typecheck, tests, fixture smoke, and live FMP spot checks pass, but the final pushed-branch GitHub Actions run has not been recorded yet | `RZV-22`, `RZV-26` | M2 closeout              |
