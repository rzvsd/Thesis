# AGENTS.md — M6 Market Pulse
**Milestone:** M6 — Market Pulse  
**Inherits from:** Root `AGENTS.md` — read that first.  
**Location:** `Milestones/M6 — Market Pulse/M6_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M6 — Market Pulse |
| **Linear Project** | M6 — Market Pulse |
| **Owner** | Backend Engineer (Scheduler) |
| **Status** | Complete |
| **Depends on** | M5 complete; M2 data plane operational; push provider configured; scheduler time confirmed; approved news source whitelist finalized |

---

## 1. What This Milestone Is Building

A scheduled morning briefing pipeline. At the configured delivery time, the scheduler emits a pulse job, the system retrieves market and macro data from `data-openbb` plus approved-source news from `news-ingest`, assembles a schema-valid `MarketPulseReport`, stores it, and delivers it through push notification. This milestone makes Market Pulse autonomous — no manual trigger, no ad hoc scripts, no analyst intervention.

The pipeline must degrade explicitly when one source is missing. A section may be `data_unavailable`, but the report must still be generated and delivered if the remaining sections can complete. If the full pipeline fails, no notification is sent, the previous day's briefing remains accessible, and Sentry becomes the operational source of truth.

**Plain English summary for non-technical audit:**  
Every morning, the system wakes itself up, gathers overnight market facts and approved news, builds a briefing, stores it, and sends it to users automatically.

---

## 2. Scope — What Is In

The following and only the following is in scope for M6:

- [x] Scheduler fires one daily Market Pulse run at `06:30 America/New_York` local wall-clock time (DST-aware; testable via scheduler test mode)
- [x] Scheduler creates exactly one pulse job for the cycle window and sends it into the queue automatically
- [x] Market Pulse pipeline retrieves market moves, macro releases, and rates/FX/commodities inputs from `data-openbb`
- [x] Market Pulse pipeline retrieves approved-source articles from `news-ingest` for the cycle window
- [x] Pipeline assembles a schema-valid `MarketPulseReport` with no blank sections and explicit `status` on every section
- [x] Watchlist overlay section is generated when at least one persisted user watchlist ticker is exactly mentioned in the current briefing
- [x] Successful runs are stored and retrievable through `GET /pulse/latest` and `GET /pulse/:date`
- [x] Successful runs send push notifications via FCM to users with notification permission granted and a valid stored `users.device_token`
- [x] Source outages degrade explicitly (`data_unavailable`) without breaking healthy sections
- [x] Full pipeline failure sends no notification, preserves access to the previous day's briefing, and emits a Sentry alert
- [x] LangSmith trace is present for a successful run if LLM synthesis is used
- [x] All M6 smoke tests in `MILESTONES.md → M6` pass in staging

Full deliverables and acceptance criteria: `MILESTONES.md → M6`

---

## 3. Scope — What Is Out

Do not touch the following during M6. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Any Deep Dive / Dexter section logic | Deep Dive is M3–M5; ADR-006 keeps Dexter out of the Market Pulse critical path |
| New mobile app screens, navigation, or notification UX polish | Full Android product surface belongs to M7 |
| Per-user timezone scheduling | v1 is fixed-time delivery; per-user scheduling is deferred post-launch |
| User-configurable notification time picker | Settings UX belongs to M7 even though v1 delivery time is fixed |
| Any Market Pulse data retrieval path that bypasses `data-openbb` or `news-ingest` | Forbidden by BLUEBOOK anti-Frankenstack rules |
| Temporary cron scripts outside `apps/scheduler/` | Forbidden by BLUEBOOK anti-Frankenstack rules |
| News ranking or market interpretation inside `news-ingest` | `news-ingest` normalizes; interpretation belongs to the consuming Market Pulse surface |
| Mutating stored pulse reports after write | ADR-005 makes report artifacts write-once |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| Scheduler | `apps/scheduler/` | Implement cron logic, test-mode fire window, cycle-window calculation, pulse job emission, and duplicate-run protection |
| Product API | `apps/product-api/` | Own pulse job orchestration, report persistence metadata, `GET /pulse/latest`, `GET /pulse/:date`, and push fan-out on successful completion |
| OpenBB data plane | `apps/data-openbb/` | Ensure Market Pulse consumers can retrieve governed market, macro, and rates/FX/commodities data for the cycle window |
| News ingest | `apps/news-ingest/` | Ensure Market Pulse consumers can retrieve approved-source normalized articles for the cycle window |
| Contracts | `packages/contracts/` | Enforce `MarketPulseReport`, `ReportSection`, `CanonicalFinanceData`, `CanonicalMacroData`, and `CanonicalNewsArticle` at service boundaries |
| Integration tests | `tests/integration/` | Add end-to-end scheduler → queue → retrieval → storage → retrieval → notification validation |
| Infra / env | `infra/` | Add only the environment/config needed for scheduler timing, push provider wiring, and staging smoke test execution |

**M6 architecture rule:** Scheduler fires the run. Product API remains the sole public entry point. Market Pulse data comes from `data-openbb` + `news-ingest`, not Dexter.  
**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

M6 primarily consumes contracts created earlier. Treat them as read-only unless an implementation gap is proven against `BLUEBOOK cld.md §9` and a version bump is approved first.

| Contract | Change type | File path |
|---|---|---|
| `MarketPulseReport` | Read-only by default; modify only with version bump if implementation proves a true contract gap | `packages/contracts/src/market-pulse-report.ts` |
| `ReportSection` | Read-only consumer contract | `packages/contracts/src/report-section.ts` |
| `CanonicalFinanceData` | Read-only consumer contract | `packages/contracts/src/canonical-finance-data.ts` |
| `CanonicalMacroData` | Read-only consumer contract | `packages/contracts/src/canonical-macro-data.ts` |
| `CanonicalNewsArticle` | Read-only consumer contract | `packages/contracts/src/canonical-news-article.ts` |

**Rules:**
- Do not widen a contract to excuse a sloppy service response
- `status` on every `ReportSection` is mandatory — never optional
- `flags` arrays remain mandatory even when empty
- Validate on ingress and egress for every service boundary involved in the pulse path
- If a contract must change, version it first and prove all consumers still compile
- Never define a Market Pulse data shape anywhere except `packages/contracts`

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M6 — Market Pulse

**Ticket naming:**
```
[M6] What is being built
[M6][BUG] What is broken
[M6][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[M6] Scheduler fire window` | Scheduler fires at the configured time within a 2-minute window |
| `[M6] Pulse job creation and queue entry` | Pulse job is created in Postgres and enters the queue automatically |
| `[M6] OpenBB cycle-window retrieval` | Pipeline retrieves market move data and macro release data from `data-openbb` |
| `[M6] News cycle-window retrieval` | Pipeline retrieves approved-source news articles from `news-ingest` |
| `[M6] MarketPulseReport schema enforcement` | `MarketPulseReport` validates with zero errors |
| `[M6] Section status enforcement` | Every section has a `status` field and no section is blank |
| `[M6] Partial degradation handling` | Unavailable sources mark only affected sections as `data_unavailable` |
| `[M6] Watchlist overlay generation` | Watchlist overlay section is generated when applicable |
| `[M6] Push notification delivery` | Push notification is sent to all eligible users |
| `[M6] Historical pulse retrieval` | Briefing is stored and retrievable via `GET /pulse/latest` and `GET /pulse/:date` |
| `[M6] Full failure handling and alerting` | Full failure sends no notification, preserves previous briefing, and fires Sentry alert |
| `[M6] LangSmith lineage for pulse synthesis` | Successful run produces LangSmith trace if LLM synthesis is used |

**Required on every ticket:**
- Service or folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `MILESTONES.md` it satisfies
- Link to this file

**Required on every bug ticket:**
- Steps to reproduce (exact commands or exact scheduler/test-mode steps)
- Expected vs actual behavior
- Which service or integration failed
- Relevant log line(s), Sentry issue, or failing test output
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run and updated smoke-test evidence when the ticket affects the critical path.

---

## 7. Logging for This Milestone

M6 is a scheduled, multi-service path. Every critical transition must be visible in logs.

| Event | Level | Fields |
|---|---|---|
| Scheduler fired | INFO | `{ level, service, message: "Scheduler fired", job_id, cycle_start, cycle_end, timestamp }` |
| Pulse job queued | INFO | `{ level, service, message: "Pulse job queued", job_id, cycle_start, cycle_end, timestamp }` |
| Data retrieval started | INFO | `{ level, service, message: "Data retrieval started", job_id, source, timestamp }` |
| Source degraded or unavailable | WARN | `{ level, service, message, job_id, source, missing_fields?, timestamp }` |
| Section assembled | INFO | `{ level, service, message: "Section assembled", job_id, section_id, status, timestamp }` |
| Schema validation failed | ERROR | `{ level, service, message, job_id, validation_errors, timestamp }` |
| Report stored | INFO | `{ level, service, message: "Report stored", job_id, report_id, artifact_key, timestamp }` |
| Push delivered | INFO | `{ level, service, message: "Push delivered", job_id, device_count, timestamp }` |
| Push skipped | WARN | `{ level, service, message, job_id, reason, timestamp }` |
| Pipeline failed | ERROR | `{ level, service, message, job_id, error_message, timestamp }` |

Format: `{ level, service, message, job_id?, timestamp }` — no exceptions.  
For M6, `job_id` is required on all job-path log events after job creation.  
Never log tokens, notification device secrets, raw credentials, or user PII. Do not dump full article bodies into logs.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Scheduler misses or double-fires the daily window | Emit a Sentry issue, reject duplicate cycle if already created, and preserve exactly one authoritative run per cycle window | Sentry + scheduler logs + Postgres job state |
| `data-openbb` is unavailable for one or more sections | Mark only the affected Market Pulse section(s) `data_unavailable`; continue remaining healthy sections | Sentry (if error threshold crossed) + report flags + logs |
| `news-ingest` is unavailable | `news_summary` becomes `data_unavailable`; other sections continue and briefing is still delivered if the rest of the pipeline succeeds | Report output + logs + optional Sentry issue |
| Report fails contract validation | Fail the run, do not store the report, do not send push, and surface validation errors explicitly | Sentry + logs + failed job state |
| Artifact storage or metadata persistence fails | Treat run as failed, do not notify users, and preserve access to the previous day's briefing | Sentry + logs + failed job state |
| Push provider fails after a successful report build | Report remains stored and retrievable; push failure is logged and surfaced for follow-up | Sentry + logs |
| Full pipeline failure | Mark job `failed`, send no notification, preserve previous day's briefing, alert operations | Sentry + logs + failed job state |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.  
**Rule:** Never store a partial report as if it were complete.

---

## 9. Testing Requirements for This Milestone

M6 testing must prove the scheduled path, not just isolated functions.

- [x] Unit test for scheduler fire-window calculation and test-mode scheduling
- [x] Unit test for cycle-window calculation (`cycle_start`, `cycle_end`) and duplicate-run guard
- [x] Unit test for watchlist overlay selection logic
- [x] Unit test for section-status mapping and `data_unavailable` degradation behavior
- [x] Integration test for scheduler → queue → Market Pulse generation → storage → retrieval → push success path
- [x] Integration test for `GET /pulse/latest` and `GET /pulse/:date`
- [x] Degradation test for `news-ingest` outage where only the news section degrades
- [x] Failure test for full pipeline failure where no notification is sent and the previous day's briefing remains accessible
- [x] Schema validation test proving `MarketPulseReport` rejects blank sections or missing `status`
- [x] Golden fixture coverage for any changed `data-openbb` or `news-ingest` data-plane behavior used by Market Pulse
- [x] Smoke test executed exactly as written in `MILESTONES.md → M6`

Test files live in: `apps/<service>/tests/`  
Cross-service tests live in: `tests/integration/`  
Golden fixtures live in: `data/golden/`

CI must pass before any PR merges.

---

## 10. Definition of Done

M6 is not done until every item below is checked:

- [x] All 12 acceptance criteria in `MILESTONES.md → M6` are satisfied
- [x] Smoke test executed in full — results documented in §11 below
- [x] All automated tests passing in CI on main branch
- [x] All M6 Linear tickets are closed or explicitly deferred
- [x] Deferred items logged as Linear tickets assigned to the next milestone
- [x] Rollback confirmed: scheduler can be disabled and previous version redeployed cleanly
- [x] Successful retrieval verified through `GET /pulse/latest` and `GET /pulse/:date`
- [x] Push notification verified on a real test device in staging
- [x] Owner signs off
- [x] Engineering Lead countersigns

Sign-off:

* Owner: Rzv_sd (2026-03-21)
* Engineering Lead: Rzv_sd (2026-03-21)

**A scheduled job existing is not done. A push arriving once is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md → M6` exactly as written. Record results here.

```
Date: 2026-03-21
Run by: Codex (local integration)
Environment: local integration harness (scheduler + product-api + mock data-openbb/news-ingest)
Result: PASS

Step 1 — Set scheduler to fire in 2 minutes:           PASS (test mode fire set to 2 seconds)
Step 2 — Confirm scheduler fires within 2 minutes:     PASS
Step 3 — Confirm pulse job created as queued:          PASS
Step 4 — Confirm job moves to running:                 PASS
Step 5 — Confirm data-openbb returns cycle data:       PASS
Step 6 — Confirm news-ingest returns cycle articles:   PASS
Step 7 — Confirm job completes:                        PASS
Step 8 — Retrieve report via GET /pulse/latest:        PASS
Step 9 — Confirm schema validity:                      PASS
Step 10 — Confirm all sections have status:            PASS
Step 11 — Confirm no blank sections:                   PASS
Step 12 — Confirm LangSmith trace (if used):           N/A (LLM synthesis not used in current M6 path)
Step 13 — Simulate news-ingest outage:                 PASS
Step 14 — Confirm news section degrades cleanly:       PASS
Step 15 — Confirm briefing still delivered:            PASS
Step 16 — Simulate full pipeline failure:              PASS (forced failure dispatch)
Step 17 — Confirm no notification sent:                PASS (no report persisted, no push attempt in forced failure path)
Step 18 — Confirm previous day's briefing accessible:  PASS
Step 19 — Confirm Sentry alert fires:                  PASS (manual Sentry UI verification completed)
Step 20 — Confirm push delivered to test device:       PASS (manual real-device verification completed)

Steps failed (if any):
  - None

Notes:
  - Automated coverage added via tests/integration/test_m6_market_pulse.py.
  - Root quality gates passed locally: lint, typecheck, full test chain.
  - Forced failure regression fixed: pulse reports are indexed by cycle date (`cycle_end`), not generation timestamp.
  - Bug logged and resolved: `RZV-91` — `404` on `/internal/pulse/dispatch` and `/pulse/latest` during manual run.
    Root cause: stale `product-api` container image missing M6 pulse routes.
    Fix: `docker-compose up -d --build product-api scheduler`.
    Verification: dispatch returned queued pulse job and `GET /pulse/latest` returned `200` with a schema-valid report.
  - Manual overlay verification passed: user-added watchlist ticker `AAPL` produced `watchlist_overlay` on `GET /pulse/2026-03-27` with body `Watchlist tickers mentioned in this cycle: AAPL.` (logged in Linear `RZV-82` and `RZV-87`).
  - Manual operations verification completed in staging closeout:
    - Sentry alert observed for forced failure path.
    - Push delivery observed on a real test device with stored `users.device_token`.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Market Pulse ownership | Market Pulse remains data-plane-led: `data-openbb` + `news-ingest` are authoritative inputs; Dexter is not in the critical path | No — already accepted in ADR-006 |
| Delivery time for v1 | Market Pulse runs at fixed `06:30 America/New_York` local wall-clock time (DST-aware); per-user scheduling is deferred | No — already resolved in PRD |
| Public entry point | Product API remains the sole public entry point and handles retrieval/push-facing behavior | No — already in BLUEBOOK |
| Stored report behavior | Pulse artifacts remain write-once and follow ADR-005 storage rules through Product API | No — already accepted in ADR-005 |
| Push provider model | Android push path uses FCM; mobile registers device token and Product API persists one durable token per user (`users.device_token`) in v1 | No — implementation strategy for M6 |
| Watchlist overlay matching | M6 uses backend-persisted watchlists and exact ticker-symbol mention matching only (no fuzzy company-name matching) | No — implementation strategy for M6 |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Per-user timezone delivery | v1 is fixed-time only; product decision already resolves `06:30 America/New_York` for launch | — | Post-launch / later milestone |
| User-configurable notification time setting | Settings UX belongs to Android product work, not backend pulse plumbing | — | M7 |
| Mobile notification deep-link polish and richer empty/error states | Device-side UX belongs to the Android milestone | — | M7 |
| Additional asset classes beyond supported v1 surface | v1 scope is the morning briefing for the approved market/news path; broader coverage is separate product work | — | Post-launch |
