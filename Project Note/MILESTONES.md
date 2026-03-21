# Finance Intelligence Platform — Milestone Briefs

**Version:** 1.0  
**Status:** Active  
**Owner:** Engineering Lead  
**Last Revised:** 2026-03  
**Related Documents:** BLUEBOOK cld.md, ROADMAP.md, PRD.md

---

## How to Read This Document

Each milestone is a self-contained brief. It defines — in plain language — what is being built, what must be true for the milestone to be considered complete, what success and failure look like, and how to recover if something goes wrong.

**A milestone is not closed unless every item in its Acceptance Criteria is checked off.** Demos, verbal confirmations, and partial passes do not count.

**Key terms explained:**
- **Deliverable** — A concrete thing that exists at the end of the milestone (a working service, a passing test, a document).
- **Acceptance Criteria** — Binary, testable statements. Either true or not true. No partial credit.
- **Smoke Test** — A scripted check that walks through the critical path step by step to confirm nothing is broken.
- **Success** — What the world looks like when this milestone is complete.
- **Failure Mode** — What breaks, how we know it broke, and what the impact is.
- **Rollback** — How to undo this milestone's changes safely if something goes wrong after the fact.
- **Dependencies** — What must be true before this milestone can begin.

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M1 | Baseline | The skeleton — all services exist and connect |
| M2 | Data Plane | Financial data and news flow through validated contracts |
| M3 | Dexter Foundation | Dexter upstream integrated as the Deep Dive research engine |
| M4 | Product API + Job System | Auth, job queue, and report retrieval around Dexter-led Deep Dive |
| M5 | Company Deep Dive v1 | Dexter-powered Deep Dive path live |
| M6 | Market Pulse | OpenBB + news-ingest-powered morning briefing pipeline live |
| M7 | Android MVP | Both surfaces work on a real device |
| M8 | Product Quality / UX Refinement | The Android MVP becomes coherent, personal, and premium-feeling before hardening |
| M9 | Production Hardening | The system is observable, resilient, and operationally ready for launch |

---

---

# M1_Baseline

## Goal
Stand up the full project structure so that every service exists, can be started locally, and CI enforces quality on every code change. Nothing does real work yet — but the skeleton is alive and nothing is improvised.

**Plain English:** Imagine building a house. This milestone is pouring the foundation and framing all the walls. No plumbing, no electricity yet — but every room exists and the structure is sound.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Monorepo | All folders created per the structure in BLUEBOOK cld.md §15 |
| All services start | Running `docker-compose up` brings every service to a healthy state |
| Contracts package | `packages/contracts` compiles without errors and exports all canonical schemas |
| CI pipeline | Every pull request automatically runs linting, type checks, and unit tests |
| Environment template | `.env.example` lists every required environment variable with a description |
| Pre-M3 ADRs drafted | Architecture Decision Records ADR-001 through ADR-006 written and under review |

---

## Acceptance Criteria

- [ ] `docker-compose up` starts all services and all health checks pass within 60 seconds
- [ ] `packages/contracts` compiles with zero TypeScript errors
- [ ] CI pipeline runs automatically on every pull request — no manual trigger required
- [ ] CI fails if linting or type checking fails — it cannot be bypassed
- [ ] `.env.example` exists and every variable has a description comment
- [ ] `README.md`, `BLUEBOOK cld.md`, `ROADMAP.md`, `PRD.md`, and `MILESTONES.md` are committed to the repository
- [ ] ADR-001 through ADR-006 are drafted in `/DECISIONS/` and assigned for review

---

## Smoke Test

**Who runs it:** Any team member, following these steps exactly.

```
Step 1: Clone the repository to a fresh machine
Step 2: Copy .env.example to .env and fill in placeholder values
Step 3: Run: docker-compose up
Step 4: Wait up to 60 seconds
Step 5: Confirm — all services show "healthy" status
Step 6: Run: pnpm typecheck
Step 7: Confirm — zero TypeScript errors
Step 8: Open a pull request with a trivial change (e.g., add a comment)
Step 9: Confirm — CI pipeline runs automatically and passes
```

**Expected result:** All steps complete without errors.  
**Failure signal:** Any service fails to reach healthy status, or CI does not run automatically.

---

## Success

The project can be cloned, started, and validated by any new team member in under 15 minutes. Every service has a home. Every contract has a name. The CI enforces quality from day one.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| A service fails to start | Health check fails in docker-compose | Blocks M2 — cannot proceed until resolved |
| Contracts package has type errors | CI fails on typecheck step | Blocks all downstream development that imports contracts |
| CI pipeline not triggering | Pull requests merge without automated checks | Code quality is unguarded — must be fixed before any feature work |

---

## Rollback

M1 has no production deployment. Rollback means reverting the git repository to its previous state. No data exists yet, so there is no data risk.

---

## Dependencies

- Repository hosting is set up (GitHub or equivalent)
- CI provider is configured (GitHub Actions or equivalent)
- Docker is available on all development machines
- Node.js 20+ and Python 3.11+ are available on all development machines

---

## Owner

Engineering Lead

---

---

# M2_Data Plane

## Goal
The system can retrieve structured financial data and normalized news articles, validate them against contracts, and handle missing or partial data gracefully.

**Plain English:** This milestone is installing the pipes. Before we can analyze anything, we need verified data flowing in. This milestone confirms that financial numbers arrive in the right format, news articles arrive cleaned and sourced, and — critically — when data is missing, the system says so clearly instead of making something up.

---

## Deliverables

| Deliverable | Description |
|---|---|
| `data-openbb` service (Finance) | Retrieves and returns company financial data as `CanonicalFinanceData` |
| `data-openbb` service (Macro) | Retrieves and returns macro data as `CanonicalMacroData` |
| `news-ingest` service | Retrieves and returns news articles wrapped in a response envelope containing `CanonicalNewsArticle`, using RSS first and `news-please` HTML fallback only for explicitly approved HTML sources |
| Golden fixtures | Sample validated responses stored in `data/golden/` for use in tests |
| Missing-data tests | Automated tests that verify degradation behavior when data is absent |
| Rate limiting | Redis-backed rate limiting on all outbound provider calls |
| Smoke tests passing | Data plane smoke tests pass against golden fixtures |

---

## Acceptance Criteria

- [ ] `data-openbb` returns a valid `CanonicalFinanceData` object inside the response envelope for at least 3 different test tickers
- [ ] `data-openbb` returns valid macro data explicitly as a `CanonicalMacroData` object inside the response envelope for the current day
- [ ] Every `CanonicalFinanceData` response includes a `missing_fields` array — even if empty
- [ ] When a financial field is unavailable, it appears in `missing_fields` — it is never substituted with a zero or an estimate
- [ ] `news-ingest` returns a list of valid `CanonicalNewsArticle` objects inside the response envelope from at least 2 approved sources, using RSS where available and `news-please` HTML fallback only where ADR-002 explicitly requires HTML
- [ ] Every `CanonicalNewsArticle` includes: source name, URL, title, published timestamp, body text, and `is_approved_source: true`
- [ ] When a news source is unreachable, the service returns an empty list plus an error flag envelope (e.g. `{"data": [], "error": true}`) — it does not crash
- [ ] Rate limiting is enforced — exceeding the configured limit returns a rate limit error, not a provider error
- [ ] Golden fixtures are committed and data plane tests run against them in CI

---

## Smoke Test

**Who runs it:** Engineering Lead or QA.

*Note: Live-provider smoke validation is required for final closeout once provider API keys are provisioned, but implementation can proceed with fixtures/mocks before that.*

```
Step 1:  Start data-openbb and news-ingest services locally
Step 2:  Send GET /v1/finance/company?ticker=AAPL to data-openbb
Step 3:  Confirm — response envelope (e.g., {"data": {...}}) contains a valid CanonicalFinanceData object
Step 4:  Confirm — response includes a "missing_fields" array
Step 5:  Confirm — response includes a "retrieved_at" timestamp
Step 6:  Send GET /v1/finance/company?ticker=DUMMY to data-openbb
Step 7:  Confirm — response includes missing_fields listing all expected fields with no filled zeroes
Step 8:  Send GET /v1/finance/macro?scope=daily to data-openbb
Step 9:  Confirm — response envelope contains a valid CanonicalMacroData object
Step 10: Send GET /v1/news?date=2026-03-13 to news-ingest
Step 11: Confirm — response is an envelope containing a list of CanonicalNewsArticle objects
Step 12: Confirm — every article has is_approved_source: true
Step 13: Simulate provider outage by blocking the news provider URL
Step 14: Send GET /v1/news?date=2026-03-13 to news-ingest again
Step 15: Confirm — service returns an envelope with an empty list and an error flag ({"data": [], "error": true}), does not crash
Step 16: Run CI — confirm all data plane tests pass
```

**Expected result:** All steps complete. Missing data is declared, not hidden. Services do not crash on provider failure.

---

## Success

Any downstream service (Dexter, Market Pulse pipeline) can ask for financial data or news and receive a validated, contract-compliant response. When data is missing, it knows exactly what is missing. The data plane is a reliable, observable foundation.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Provider API key invalid or expired | `data-openbb` returns auth errors | All financial data retrieval fails — blocks M3 |
| Provider rate limit exceeded | Repeated 429 errors from provider | Data retrieval throttled or blocked — add Redis rate limiter |
| News source blocks the ingester | Empty article lists or HTTP 403 errors | News section in reports will be empty — verify RSS path and `news-please` HTML fallback configuration |
| Schema validation rejects a valid response | CI test failures on golden fixtures | Contracts may need updating — review before proceeding |
| `missing_fields` not populated | Manual review catches missing array | Silent data gaps in reports — fix before M3 |

---

## Rollback

`data-openbb` and `news-ingest` are internal services not yet exposed publicly. Rollback means redeploying the previous service version. No user-facing impact.

---

## Dependencies

- M1 complete (monorepo, contracts, CI all operational)
- ADR-001 accepted: OpenBB provider prioritization and fallback order is decided
- ADR-002 accepted: Approved news source list and ingestion method (scrape / RSS / API) is decided
- Provider API keys provisioned and stored in environment secrets
- Approved news source whitelist finalized by Product Lead

---

## Owner

Data Platform Engineer

---

---

# M3_Dexter Foundation

## Goal
Dexter upstream OSS is integrated into the repository as the primary research engine for Company Deep Dive. The Dexter worker starts, accepts analysis requests, runs its native research pipeline, and produces schema-valid reports — including correct degradation when data is missing.

**Plain English:** This is installing the brain. Dexter is an open-source financial research agent that already knows how to read financial data, think about it, and write a report. This milestone connects it into our system, confirms it works as expected, and sets up observability so we can inspect every run.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Dexter fork pinned | Upstream Dexter fork pinned to a specific commit in `apps/dexter-worker/` |
| Dexter worker starts | `dexter-worker` service starts in docker-compose and reaches healthy state |
| Analysis pipeline | Dexter accepts an `AnalysisRequest` and runs its native planner → data retrieval → section execution → scoring → synthesis pipeline |
| Schema validation | Output is validated against `AnalysisReport` contract before emit |
| LangSmith integration | Every Dexter run is visible in LangSmith with full trace |
| Degradation tests | Automated tests for failure/degradation scenarios (missing data, LLM timeout, score threshold) |

---

## Acceptance Criteria

- [ ] Dexter fork is pinned to a specific upstream commit — never to `main`
- [ ] `dexter-worker` starts in docker-compose and reaches healthy state
- [ ] Dexter accepts a valid `AnalysisRequest` and completes its native research pipeline
- [ ] Output is a schema-valid `AnalysisReport` — validation runs automatically before the report is returned
- [ ] Each section in the report has a `status` field: `complete`, `data_incomplete`, `data_unavailable`, or `failed`
- [ ] No section is ever left blank — every section either has content or has an explicit status explaining why it does not
- [ ] The Scorer does not produce a signal value unless the minimum evidence threshold is met — if not met, signal reads `no_signal` and the reason is stated
- [ ] When a section executor times out or errors, that section is marked `failed` — the rest of the report is still generated
- [ ] Every Dexter run produces a LangSmith trace showing: prompt version, model name, token count, section-by-section timing, and job ID
- [ ] All prompt text lives in LangSmith — no prompt strings hardcoded in application code
- [ ] Degradation scenario tests all pass: missing data, LLM timeout, score threshold not met

---

## Smoke Test

**Who runs it:** Engineering Lead. Requires LangSmith access to verify traces.

```
Step 1:  Start dexter-worker via docker-compose. Confirm it reaches healthy state.
Step 2:  Prepare a test AnalysisRequest for ticker "MSFT"
Step 3:  Send the request to the Dexter pipeline
Step 4:  Wait for completion (target: under 90 seconds)
Step 5:  Confirm — response is a valid AnalysisReport (schema validation passes)
Step 6:  Confirm — all expected sections are present
Step 7:  Confirm — each section has a "status" field
Step 8:  Confirm — each scored claim has at least one EvidenceItem in its evidence array
Step 9:  Open LangSmith — confirm the run appears with prompt version, model, token count, and job ID
Step 10: Run test with a ticker that has limited data availability
Step 11: Confirm — affected sections show "data_incomplete" or "data_unavailable" status, not blank content
Step 12: Run test with evidence below scoring threshold
Step 13: Confirm — signal shows "no_signal" with reason, not a fabricated signal value
Step 14: Run test simulating LLM timeout on one section
Step 15: Confirm — that section shows "failed" status; other sections are still complete
Step 16: Run all automated degradation tests — confirm all pass
```

**Expected result:** All steps complete. Dexter starts, accepts requests, produces schema-valid output. No blank sections. No fabricated signals. All degradation paths handled explicitly.

---

## Success

Dexter upstream is integrated, running, and producing honest, schema-valid research reports. Operators can inspect every run in LangSmith. Failures degrade gracefully — the system always produces an honest output, never a fabricated one.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Dexter worker fails to start | Health check fails in docker-compose | Blocks M4 — cannot proceed until resolved |
| Dexter's native data retrieval fails | Report sections show `data_unavailable` | Investigate provider keys and network access |
| LLM returns malformed JSON | Schema validation catches it — section marked `failed` | Report degrades but does not crash |
| LLM call times out repeatedly | Retry logic exhausted — section marked `failed`, Sentry alert | Report is incomplete — investigate model or network issue |
| Score produced without sufficient evidence | Automated test catches missing evidence gate | Fabricated signal risk — must fix before M5 |
| LangSmith trace not appearing | Manual check in LangSmith after test run | Loss of observability — cannot audit model behavior |

---

## Rollback

Dexter is an internal worker — not yet exposed to users. Rollback means redeploying the previous worker version from the previous Docker image. No user data at risk.

---

## Dependencies

- M2 complete (data plane operational with golden fixtures)
- Dexter fork created and pinned to a specific upstream commit (see ADR-006)
- Dexter's native provider keys provisioned (Financial Datasets API, etc.)
- Anthropic API key provisioned and stored in environment secrets
- LangSmith account set up and project configured
- All prompts loaded into LangSmith before pipeline tests begin

---

## Owner

AI/Reasoning Engineer

---

---

# M4_Product API + Job System

## Goal
Users can authenticate. Dexter-led Deep Dive jobs can be created, queued, processed, and retrieved. The full lifecycle of a job — from request to stored result — works end-to-end.

**Plain English:** This is building the front desk and the post room. The front desk checks who you are (auth). The post room takes your request, queues it, routes it to Dexter, and files the result when it comes back. Nothing appears to users yet — but the plumbing that will power the user-facing app is fully operational.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Auth system | Register, login, token refresh, logout — fully operational |
| Job creation endpoint | `POST /jobs` creates a Deep Dive job and queues it |
| Job status endpoint | `GET /jobs/:id` returns current job status |
| Report retrieval endpoint | `GET /reports/:id` returns a completed report |
| Report history endpoint | `GET /reports` returns a user's report list |
| Job queue | Redis queue connects Product API to Dexter worker |
| Artifact storage | Completed reports written to Artifact Store; metadata in Postgres |
| Rate limiting | API endpoints protected against abuse |
| Error visibility | Failed jobs appear in Sentry with full context |

---

## Acceptance Criteria

- [ ] A new user can register with email and password and receive a verification email
- [ ] A verified user can log in and receive an access token (15-minute TTL) and refresh token (30-day TTL)
- [ ] The mobile client can silently refresh an expired access token without logging the user out
- [ ] Logging out invalidates both tokens immediately — a logged-out token cannot be used
- [ ] `POST /jobs` with a valid auth token and ticker creates a Deep Dive job record in Postgres with status `queued`
- [ ] The job appears in the Redis queue within 1 second of creation
- [ ] Dexter worker picks up the job and updates its status to `running` in Postgres
- [ ] On completion, the report is written to Artifact Store and metadata is written to Postgres
- [ ] Job status updates to `complete` and the report is retrievable via `GET /reports/:id`
- [ ] `GET /jobs/:id` returns the correct status at each stage of the lifecycle
- [ ] A failed job updates to status `failed` in Postgres and triggers a Sentry alert with the error message
- [ ] An unauthenticated request to any protected endpoint returns HTTP 401 — not a server error
- [ ] Rate limiting returns HTTP 429 when the limit is exceeded — with a clear message
- [ ] All job lifecycle steps are visible as audit events in the `audit_events` table

---

## Smoke Test

**Who runs it:** Engineering Lead. Requires access to Postgres, Redis, Sentry, and Artifact Store.

```
Step 1:  Send POST /auth/register with a test email and password
Step 2:  Confirm — user record created in Postgres, verification email sent
Step 3:  Verify the email (follow link)
Step 4:  Send POST /auth/login — confirm access_token and refresh_token returned
Step 5:  Wait 15 minutes (or manually expire the token in test environment)
Step 6:  Send a request with the expired token — confirm 401 returned
Step 7:  Send POST /auth/refresh — confirm new access_token issued without re-login
Step 8:  Send POST /auth/logout — confirm both tokens invalidated
Step 9:  Attempt to use the old refresh token — confirm it is rejected
Step 10: Log in again. Send POST /jobs with ticker "AAPL"
Step 11: Confirm — job record appears in Postgres with status "queued"
Step 12: Confirm — job appears in Redis queue
Step 13: Confirm — Dexter picks it up and Postgres updates to "running"
Step 14: Wait for completion. Confirm — Postgres shows "complete"
Step 15: Confirm — report artifact written to Artifact Store
Step 16: Send GET /reports/:id — confirm report is returned and schema-valid
Step 17: Send GET /reports — confirm user's report list includes the new report
Step 18: Deliberately cause a job to fail (use a bad ticker in test mode)
Step 19: Confirm — Postgres shows "failed" with error message
Step 20: Confirm — Sentry shows the failure with full context
Step 21: Send a request without an auth token — confirm 401 returned, not a 500 error
```

**Expected result:** Full job lifecycle completes. Auth is airtight. Failures surface in Sentry.

---

## Success

Any client (including the Android app in M7) can authenticate, submit a Deep Dive job, poll for status, and retrieve a Dexter-generated report — with no manual intervention required. Every failed job is visible to the operations team.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Redis queue loses a job | Job stays in `queued` forever — no `running` update | Report never generated. Job timeout detection must handle this |
| Artifact Store write fails | Dexter completes but report is not retrievable | Job marked `complete` but `GET /reports/:id` returns 404 — misleading. Add verification step |
| Refresh token not invalidated on logout | Old token still works after logout | Auth security breach — critical fix required before M7 |
| Rate limiter too aggressive | Legitimate users get 429 errors | Poor user experience — tune limits based on expected usage |
| Postgres write fails mid-job | Job status is inconsistent | Orphaned jobs — add monitoring for jobs stuck in `running` beyond SLA |

---

## Rollback

Product API is still in staging — not public. Rollback means redeploying the previous API version. If database migrations were applied, run the corresponding rollback migration. All rollback scripts must be tested before the milestone closes.

---

## Dependencies

- M3 complete (Dexter integrated and producing schema-valid reports)
- ADR-004 accepted: Cloud provider and deployment target decided
- ADR-005 accepted: Artifact Store implementation decided (S3, GCS, or self-hosted)
- Email sending provider configured (for verification emails)
- Postgres and Redis deployed in staging environment
- Artifact Store deployed in staging environment

---

## Owner

Backend Engineer (Product API)

---

---

# M5_Company Deep Dive v1

## Goal
A user can request a Dexter-powered Company Deep Dive for any supported ticker and receive a complete, schema-valid, evidence-backed research report within 90 seconds.

**Plain English:** The first real feature is alive. Everything built in M1–M4 comes together here. A request goes in, Dexter performs the research, and a full report comes out — in under 90 seconds, with every claim sourced. This is the first milestone where the product does something a real user would value.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Full Deep Dive pipeline | End-to-end: request → queue → Dexter research → validated report → stored |
| Ticker search | User can search by company name or symbol and get results |
| Ticker registry sync | Official ticker registry is seeded and refreshed from approved Nasdaq source files |
| Report schema enforcement | Every Deep Dive report validated before storage |
| Evidence enforcement | No section can carry a scored claim without at least one EvidenceItem |
| SLA validation | 90-second target validated under realistic conditions in staging |
| All Deep Dive smoke tests passing | Every step in the Deep Dive smoke test checklist passes |

---

## Acceptance Criteria

- [ ] Ticker search returns results for any US-listed NYSE or NASDAQ company
- [ ] An invalid or unsupported ticker returns a clear "not found" message — no crash
- [ ] Ticker registry full refresh and daily delta sync path are implemented and validated
- [ ] A Deep Dive request creates a job, queues it, and Dexter runs the full research pipeline without manual intervention
- [ ] The generated report contains all expected sections (as listed in PRD §5 Surface A)
- [ ] Every section has a `status` field — no section is blank or missing
- [ ] Every scored claim in the report has at least one `EvidenceItem` with a named source
- [ ] The report includes a `confidence` block with a score, label, and list of limiting factors
- [ ] The report validates against the `AnalysisReport` schema with zero errors
- [ ] End-to-end latency is under 90 seconds for at least 19 out of 20 test runs
- [ ] The research disclaimer text is present in every report
- [ ] A failed job returns a clean error state — no partial report is stored or retrievable
- [ ] Every report run produces a LangSmith trace with full lineage

---

## Smoke Test

**Who runs it:** Engineering Lead + Product Lead. Requires LangSmith, Sentry, and Postgres access.

```
Ticker Registry Delta Validation (run before Step 1):
Step 0a: Run full ticker registry sync from official Nasdaq seed feed
Step 0b: Apply one controlled daily delta fixture with add/update/delete cases
Step 0c: Confirm - registry reflects expected add/update/delete results after delta sync
Step 1:  Search for "Apple Inc" — confirm AAPL appears in results
Step 2:  Search for a fake ticker "ZZZZ" — confirm "not found" message, no crash
Step 3:  Select AAPL. Submit a Deep Dive request
Step 4:  Confirm — job created in Postgres with status "queued"
Step 5:  Confirm — Dexter picks up the job within 5 seconds
Step 6:  Wait for completion. Record the elapsed time.
Step 7:  Confirm — elapsed time is under 90 seconds
Step 8:  Confirm — job status is "complete" in Postgres
Step 9:  Retrieve the report via GET /reports/:id
Step 10: Confirm — report is schema-valid (run validator)
Step 11: Confirm — all expected sections are present
Step 12: Confirm — every section has a "status" field
Step 13: Confirm — research signal (if present) has at least 2 EvidenceItems
Step 14: Confirm — confidence block is present with score, label, and limiting_factors
Step 15: Confirm — disclaimer text is present
Step 16: Open LangSmith — confirm trace is present with full lineage
Step 17: Repeat steps 3–16 for tickers MSFT and TSLA
Step 18: Simulate a pipeline failure (use a test mode flag)
Step 19: Confirm — job marked "failed", no partial report stored, Sentry alert fires
Step 20: Run 20 consecutive Deep Dive requests for different tickers
Step 21: Confirm — at least 19 complete within 90 seconds
```

**Expected result:** All steps complete. SLA validated. Dexter produces evidence-backed reports. No fabricated content.

---

## Success

The core product feature works. An operator or investor can sit down, request a Deep Dive on any US public company, and receive a Dexter-generated, structured, sourced, honest research report in under 90 seconds.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Report generation exceeds 90 seconds | SLA test fails on step 21 | Poor user experience — profile and optimize the slow stage |
| A section is blank with no status | Smoke test step 12 fails | Silent data gap — schema validation must catch this before storage |
| EvidenceItem missing from scored claim | Smoke test step 13 fails | Claim without source — fix evidence enforcement gate in Scorer |
| Disclaimer missing from report | Smoke test step 15 fails | Compliance risk — required before any public release |
| Partial report stored after failure | Smoke test step 19 fails | User sees incomplete data as if complete — fix atomic write logic |

---

## Rollback

Still in staging. No public users. Rollback means redeploying the previous service versions. If data migrations were applied, run rollback scripts.

---

## Dependencies

- M4 complete (auth, job system, report retrieval all operational)
- Legal disclaimer text reviewed and approved
- Approved ticker registry seeded with US-listed equities
- Daily delta ticker sync path approved and validated
- LangSmith prompts finalized and version-pinned for all Deep Dive sections

---

## Owner

Engineering Lead + AI/Reasoning Engineer

---

---

# M6_Market Pulse

## Goal
A scheduled pipeline runs daily at 06:30 in America/New_York local wall-clock time (DST-aware), retrieves market and macro data from OpenBB and approved-source news from news-ingest, generates a morning briefing, stores it, and delivers it to users via push notification.

**Plain English:** The morning briefing feature is alive. Every day, before markets open, the system wakes itself up, pulls the latest market data and news from the data plane, assembles a briefing, and pushes it to every user's phone. No human intervention required.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Scheduler service | Fires a pulse job at the configured time every day |
| Market Pulse pipeline | Briefing generated from OpenBB market/macro data and news-ingest approved-source articles |
| Watchlist overlay | Users with persisted watchlist entries in Postgres receive a section highlighting exact ticker-symbol mentions |
| Push notification | Notification sent via FCM to users with notification permission and a stored `users.device_token` |
| Historical storage | Past briefings are stored and retrievable |
| All Market Pulse smoke tests passing | Every step in the pulse smoke test checklist passes |

---

## Acceptance Criteria

- [ ] Scheduler fires at 06:30 America/New_York local wall-clock time within a 2-minute window
- [ ] Pulse job is created in Postgres and enters the queue automatically — no manual trigger
- [ ] Pipeline retrieves market move data and macro release data from `data-openbb` for the cycle window
- [ ] Pipeline retrieves approved-source news articles from `news-ingest` for the cycle window
- [ ] `MarketPulseReport` validates against the `MarketPulseReport` schema with zero errors
- [ ] Every section in the briefing has a `status` field — no blank sections
- [ ] If a data source is unavailable, the affected section is marked `data_unavailable` — the rest of the briefing is still generated and delivered
- [ ] Watchlist overlay section is generated for users with at least one persisted watchlist ticker exactly mentioned in today's briefing
- [ ] Push notification is sent via FCM to users with notification permission granted and a valid stored `users.device_token`
- [ ] Briefing is stored and retrievable via `GET /pulse/latest` and `GET /pulse/:date`
- [ ] If the pipeline fails entirely, no notification is sent, the previous day's briefing remains accessible, and a Sentry alert fires
- [ ] A successful run produces a LangSmith trace with full lineage (if LLM synthesis is used)

---

## Smoke Test

**Who runs it:** Engineering Lead. Requires Sentry, LangSmith, Postgres, and a test device with the API running.

```
Step 1:  Set the scheduler to fire in 2 minutes (test mode)
Step 2:  Wait. Confirm — scheduler fires within 2 minutes
Step 3:  Confirm — pulse job created in Postgres with status "queued"
Step 4:  Confirm — job moves to "running"
Step 5:  Confirm — data-openbb returns market and macro data for the cycle window
Step 6:  Confirm — news-ingest returns articles published since the last cycle
Step 7:  Wait for completion. Confirm — job status is "complete"
Step 8:  Retrieve the report via GET /pulse/latest
Step 9:  Confirm — MarketPulseReport is schema-valid
Step 10: Confirm — all sections are present with status fields
Step 11: Confirm — no section is blank
Step 12: Confirm — LangSmith trace is present (if LLM synthesis is used)
Step 13: Simulate a news-ingest outage (block the source)
Step 14: Confirm — news section shows "data_unavailable", other sections complete normally
Step 15: Confirm — briefing is still delivered (with the data_unavailable flag)
Step 16: Simulate full pipeline failure
Step 17: Confirm — no notification sent
Step 18: Confirm — previous day's briefing still accessible
Step 19: Confirm — Sentry alert fires with failure context
Step 20: Confirm — push notification is delivered to a test device on successful run
```

**Expected result:** Scheduler fires autonomously. OpenBB + news-ingest provide data. Briefing is generated, stored, and delivered. Partial data degrades gracefully. Full failure is detected and alerted.

---

## Success

Every morning, without any human action, users receive a structured market briefing assembled from OpenBB market/macro data and approved-source news. When data is missing, they receive a partial briefing with clear flags. When the system fails entirely, the operations team is alerted immediately.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Scheduler does not fire | No pulse job appears in Postgres at expected time | Users receive no briefing — Sentry should alert on missing expected job |
| All data sources unavailable | Every section shows `data_unavailable` | Briefing generated but effectively empty — still delivered with flags |
| Pipeline completes but push fails | Notification not received on test device | Users must open app to see briefing — investigate push provider |
| Briefing not stored | `GET /pulse/latest` returns 404 | No history available — investigate Artifact Store write failure |
| Duplicate briefing generated | Two pulse jobs run for the same day | Idempotency check missing — add deduplication logic in scheduler |

---

## Rollback

Rollback means disabling the scheduler and redeploying the previous scheduler version. Push notification can be disabled independently. No user data at risk.

---

## Dependencies

- M5 complete (Deep Dive pipeline operational and validated)
- Data plane (M2) operational — `data-openbb` and `news-ingest` providing validated data
- Push notification provider configured (FCM for Android)
- Scheduler delivery window confirmed as 06:30 America/New_York local wall-clock time (DST-aware)
- Approved news source whitelist finalized

---

## Owner

Backend Engineer (Scheduler)

---

---

# M7_Android MVP

## Goal
Both product surfaces — Company Deep Dive and Market Pulse — work correctly on a real Android device. A user who has never seen the app can register, use it, and understand it without assistance.

**Plain English:** The product is now in users' hands. Everything built in M1–M6 is delivered through an Android app. This milestone is about the complete user experience — not just functionality, but clarity, error handling, and first impressions.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Android app (installable APK) | Working app installable on a physical Android device |
| Auth screens | Registration, login, logout, token refresh — fully working on device |
| Deep Dive flow | Search, request, progress screen, report rendering |
| Market Pulse flow | Home screen briefing, push notification, historical briefings |
| Watchlist screens | Add, view, remove tickers |
| Error states | Every failure has a visible, understandable user-facing message |
| Empty states | Every screen that can be empty has a clear, helpful empty state |
| Settings screen | Notifications on/off, Android system notification settings link, account management, about / terms / privacy / disclaimer |
| PostHog events | Key user actions are tracked and visible in PostHog |
| Feature flag | At least one feature is gated by a PostHog feature flag |

---

## Acceptance Criteria

- [ ] App installs and launches on a physical Android device running the minimum supported OS version
- [ ] New user can register, verify email, and reach the home screen without assistance
- [ ] Login, logout, and silent token refresh all work correctly on device
- [ ] Ticker search returns results. Selecting a ticker and submitting a Deep Dive works end-to-end
- [ ] Progress screen is shown during report generation — user is never left on a blank screen
- [ ] Report renders all sections correctly: text, evidence references, confidence score, signal
- [ ] Tapping an evidence reference opens the source URL in a browser
- [ ] Market Pulse home screen shows the latest briefing on app open
- [ ] Push notification arrives on device when a new briefing is ready
- [ ] Tapping the notification opens the briefing correctly
- [ ] Watchlist — add, view, and remove tickers — works correctly
- [ ] Settings screen supports notifications on/off and a correct link to Android system notification settings; user-selectable notification time is not present in v1
- [ ] If a Deep Dive fails, user sees a clear error message with a retry button — no blank screen, no crash
- [ ] If no internet connection, user sees a connectivity message — no crash
- [ ] App does not crash on any smoke test path
- [ ] PostHog receives events for: registration, login, Deep Dive requested, Deep Dive viewed, Pulse viewed
- [ ] A feature flag in PostHog correctly shows or hides a designated feature

---

## Smoke Test

**Who runs it:** Product Lead + Engineering Lead on a physical Android device.

```
Step 1:  Install the APK on a fresh Android device (factory reset or new device)
Step 2:  Launch the app. Confirm — welcome screen appears
Step 3:  Register with a new email. Confirm — verification email received
Step 4:  Verify email. Confirm — app proceeds to home screen
Step 5:  Confirm — Market Pulse home screen shows the latest briefing
Step 6:  Scroll through the briefing. Confirm — all sections visible, no blank areas
Step 7:  Tap an evidence reference. Confirm — source URL opens in browser
Step 8:  Navigate to Deep Dive tab. Search "Tesla". Confirm — results appear
Step 9:  Select TSLA. Tap "Run Deep Dive". Confirm — progress screen shown
Step 10: Wait for completion. Confirm — report screen opens automatically
Step 11: Scroll through report. Confirm — all sections present, signal and confidence visible
Step 12: Navigate to Watchlist tab. Add AAPL. Confirm — appears in watchlist
Step 13: Remove AAPL. Confirm — removed from watchlist
Step 14: Navigate to Settings. Turn notifications off and on. Confirm — toggle state saves correctly
Step 15: Tap notification/settings permission link. Confirm — Android system notification settings opens correctly
Step 16: Log out. Confirm — returned to login screen. Old token no longer works.
Step 17: Log back in. Confirm — report history is still present
Step 18: Turn off device internet. Attempt a Deep Dive. Confirm — connectivity message shown, no crash
Step 19: Restore internet. Retry. Confirm — works correctly
Step 20: Open PostHog dashboard. Confirm — events for registration, login, Deep Dive, Pulse all present
Step 21: Confirm — feature flag correctly controls the designated feature
```

**Expected result:** All steps complete on a physical device. No crashes. No blank screens. PostHog events firing.

---

## Success

A real person — including a non-technical stakeholder — can pick up the phone, install the app, and use both features without guidance. The product is coherent, honest, and handles failure gracefully.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| App crashes on any smoke test step | Visible on device | Release blocker — must fix before M8 begins |
| Blank screen during report loading | Smoke test step 9 | User experience failure — add loading state |
| Push notification not received | Smoke test step 5 area (pre-check) | Briefing must be found manually — investigate FCM config |
| PostHog events not firing | PostHog dashboard shows no events | Loss of product analytics — investigate SDK integration |
| Token refresh fails silently | User logged out unexpectedly | Auth reliability issue — add refresh error handling |
| Report history lost after reinstall | Smoke test step 16 fails | History is server-side — investigate API or auth issue |

---

## Rollback

The app is in beta / staging — not on the Play Store yet. Rollback means distributing the previous APK to testers. Server-side services can be rolled back independently.

---

## Dependencies

- M6 complete (Market Pulse pipeline operational)
- ADR-003 accepted: Mobile stack decided (Kotlin / React Native / Flutter)
- Minimum Android version decided and documented
- Push notification provider (FCM) configured and tested
- PostHog mobile SDK integrated and project configured
- Legal disclaimer text approved and incorporated into app

---

## Owner

Mobile Engineer + Product Lead

---

---

# M8_Product Quality / UX Refinement

## Goal
Turn the Android MVP into a product that feels coherent, personal, and premium to a real user without changing the core architecture. Market Pulse and Deep Dive should feel like one connected product experience, not two separate features that merely happen to live in the same app.

**Plain English:** M7 proves the app works. M8 makes it feel good enough that a real user would want to come back tomorrow.

---

## Deliverables

| Deliverable | Description |
|---|---|
| Daily-loop home experience | Home feels like one flow: what moved, what matters to my names, what deserves a deeper look |
| My Names UX framing | Watchlist remains the backend model, but the UX presents relevance more personally |
| Delta-first presentation | Market Pulse and Deep Dive emphasize what changed, why it changed, uncertainty, and follow-up |
| Premium state handling | Loading, empty, retry, offline, and failure states feel intentional and non-confusing |
| Push UX refinement | Push copy and tap-through feel relevant, trustworthy, and connected to the in-app experience |
| First-run and no-data clarity | New users understand the app quickly and empty states always point to a useful next step |
| History and resume refinement | Prior Pulse and Deep Dive content are easy to revisit with less friction |
| UX truth via analytics | PostHog validates the main user journey quality, not just event existence |

---

## Acceptance Criteria

- [ ] A new user can open the app and understand the main purpose in under 30 seconds
- [ ] Home screen clearly communicates the day's market state, what matters to the user's names, and a natural deeper-look path
- [ ] Market Pulse to Deep Dive transition feels natural and requires no explanation
- [ ] Deep Dive and Market Pulse presentation both emphasize what changed, why it matters, what is uncertain, and what deserves follow-up
- [ ] No blank or confusing states remain in the core user journey
- [ ] Push notification tap lands on the correct screen/state and the push copy feels relevant rather than generic
- [ ] Watchlist-driven personalization is visible in the UX without introducing portfolio management
- [ ] History and resume flow works cleanly for both prior Pulse and prior Deep Dive content
- [ ] PostHog confirms the intended user path can be completed without major dead ends
- [ ] Product Lead signs off that the app feels coherent and premium, not just functional

---

## Smoke Test

**Who runs it:** Product Lead + Engineering Lead on a physical Android device.

```
Step 1:  Install the latest APK on a physical Android device
Step 2:  Launch the app fresh. Confirm — within 30 seconds it is obvious what the app does
Step 3:  Review the home screen. Confirm — it feels like one loop: what moved, what matters to my names, what deserves a deeper look
Step 4:  If no watchlist exists, confirm — the empty state explains what to do next instead of leaving a dead end
Step 5:  Add at least one ticker to watchlist/My Names. Return home. Confirm — personalization is visible in the UX
Step 6:  Open the latest Market Pulse from the home screen
Step 7:  Confirm — the briefing emphasizes change, drivers, uncertainty, and follow-up rather than reading like a generic summary
Step 8:  From that flow, enter a Deep Dive for a relevant ticker
Step 9:  Confirm — the transition feels natural and does not require explanation
Step 10: Read the finished Deep Dive top-to-bottom
Step 11: Confirm — report hierarchy, evidence behavior, signal/confidence placement, and delta framing feel clear
Step 12: Trigger or receive a push notification and open the Pulse from it
Step 13: Confirm — the push copy feels relevant and tap-through lands in the correct place
Step 14: Revisit prior Pulse and prior Deep Dive content from history/resume paths
Step 15: Confirm — prior content is easy to find and resuming context feels natural
Step 16: Force one no-data, offline, retry, or degraded state on a main path
Step 17: Confirm — the state is understandable and the user is never left on a blank or confusing screen
Step 18: Increase Android system font size and repeat the main reading paths
Step 19: Confirm — content remains readable and tappable
Step 20: Review PostHog for the intended journey
Step 21: Confirm — the expected path is visible and there are no obvious dead-end drop-offs
Step 22: Ask a non-technical reviewer to complete the main flows without guidance
Step 23: Confirm — they understand what the app is for and can complete the path without confusion
```

**Expected result:** The product feels coherent, personal, and premium. No major UX confusion remains on the main user path.

---

## Success

The app no longer feels like a technically correct MVP. It feels like a product that a real user can understand, trust, and return to. Final hardening work can focus on operational readiness instead of obvious product-quality debt.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| New user still cannot explain the app's purpose quickly | First-run smoke path exceeds 30 seconds to understand | Product shape is unclear — do not move to hardening yet |
| Home still feels like disconnected features instead of one loop | Product review or non-technical smoke shows confusion | Coherence gap — must be fixed before M9 |
| Key screens still contain blank, cramped, or visually broken states | Refined smoke test catches layout/UX regressions | User trust issue — must be fixed before M9 |
| Watchlist relevance is invisible or confusing in the UX | My Names / watchlist smoke steps feel generic or buried | Personalization goal failed — milestone not ready to close |
| PostHog cannot validate the intended user journey | Analytics review shows dead ends or missing path visibility | Product decisions remain guess-driven — fix before closeout |

---

## Rollback

Rollback means distributing the previously accepted APK/build to testers and reverting only the UX/refinement changes that introduced regressions. Backend services can remain on their current versions unless a supporting API tweak caused the issue.

---

## Dependencies

- M7 complete (Android MVP functional on a real device)
- M6 complete underneath M7 (Market Pulse pipeline operational)
- Product surfaces already working end-to-end
- Approved legal/disclaimer wording available for all user-facing placements
- PostHog product analytics and at least one feature flag already in place
- Product Lead available for review and quality sign-off

---

## Owner

Product Lead + Mobile Engineer

---

---

# M9_Production Hardening

## Goal
The system is observable, resilient under failure, operationally documented, and validated under load. It is ready for real users.

**Plain English:** The product works. Now we make sure it survives reality. Real systems have providers that go down, queues that fill up, users who do unexpected things, and deployments that go wrong. This milestone is about proving — not assuming — that the system handles all of it.

---

## Deliverables

| Deliverable | Description |
|---|---|
| All visibility smoke tests passing | Sentry, PostHog, and LangSmith all receiving the correct events |
| Failure scenario tests | Provider outage, LLM timeout, Redis flush — all tested and passing |
| Load test results | System handles 2× expected peak load within SLA |
| Runbooks | Written, tested procedures for every operational scenario |
| Rollback confirmation | Rollback procedure tested for every service |
| Secret audit | All secrets confirmed out of code and in secret management |
| Database backup test | Backup and restore procedure executed and verified |
| Deployment pipeline | Production deployment is automated, not manual |

---

## Acceptance Criteria

- [ ] A deliberate API exception appears in Sentry within 30 seconds, with correct service name, error message, and stack trace
- [ ] A user action (Deep Dive request) appears in PostHog with correct user ID and event properties
- [ ] A Dexter run appears in LangSmith with prompt version, model, token count, section timing, and job ID
- [ ] **Deep Dive provider outage test:** Block Dexter's native data providers (Financial Datasets API, web search). Submit a Deep Dive request. Confirm — Dexter degrades affected sections to `data_unavailable`, report is still generated with flags, no fabricated data, Sentry alert fires
- [ ] **Market Pulse provider outage test:** Block `data-openbb`'s outbound connections. Trigger a Market Pulse run. Confirm — affected sections in the briefing are marked `data_unavailable`, briefing is still generated and delivered with flags, Sentry alert fires
- [ ] **LLM timeout test:** Simulate Anthropic API timeout. Confirm — retry fires once, on second failure section is marked `failed`, Sentry alert fires, job does not hang indefinitely
- [ ] **Redis flush test:** Flush Redis while a job is in-flight. Confirm — no durable data in Postgres is lost, job either completes or is correctly marked `failed`
- [ ] **Load test:** 40 concurrent Deep Dive requests (2× peak). Confirm — at least 38 complete within 90 seconds, no service crashes, error rate under 5%
- [ ] Runbook exists and is executable for: provider outage, failed jobs, Redis flush, deployment rollback, database restore
- [ ] Rollback procedure tested for each of: product-api, dexter-worker, data-openbb, news-ingest, scheduler, mobile app
- [ ] Zero secrets found in code repository (automated secret scan passes)
- [ ] Database backup restored successfully to a test environment — data integrity verified
- [ ] Production deployment is triggered via CI/CD — no manual SSH or file upload to servers

---

## Smoke Test

**Who runs it:** Engineering Lead + Operations Lead. This test is destructive — run only in staging.

```
--- Visibility ---
Step 1:  Trigger a deliberate exception in product-api
Step 2:  Confirm — appears in Sentry within 30 seconds with correct context
Step 3:  Submit a Deep Dive request on a test account
Step 4:  Confirm — PostHog shows the "deep_dive_requested" event with correct properties
Step 5:  Confirm — LangSmith shows the Dexter trace with all required fields

--- Deep Dive Provider Outage ---
Step 6:  Block Dexter's native data providers (Financial Datasets API, web search)
Step 7:  Submit a Deep Dive request
Step 8:  Confirm — report generated with affected sections marked "data_unavailable"
Step 9:  Confirm — no section contains fabricated or estimated data
Step 10: Confirm — Sentry alert fires for the degraded run
Step 11: Restore Dexter's provider access

--- Market Pulse Provider Outage ---
Step 12: Block data-openbb outbound network access
Step 13: Trigger a Market Pulse run
Step 14: Confirm — briefing generated with affected sections marked "data_unavailable"
Step 15: Confirm — briefing is still delivered with flags
Step 16: Confirm — Sentry alert fires for the degraded run
Step 17: Restore data-openbb network access

--- LLM Timeout ---
Step 18: Configure Dexter to simulate Anthropic API timeout on the next call
Step 19: Submit a Deep Dive request
Step 20: Confirm — retry fires once automatically
Step 21: Confirm — on second failure, section is marked "failed", Sentry alert fires
Step 22: Confirm — job does not hang — it resolves to "failed" within 3 minutes

--- Redis Flush ---
Step 23: Start a Deep Dive job. While it is "running", flush Redis
Step 24: Confirm — no Postgres records are lost or corrupted
Step 25: Confirm — job either completes or resolves to "failed" with an error message

--- Load Test ---
Step 26: Fire 40 concurrent Deep Dive requests
Step 27: Record completion times and error rate
Step 28: Confirm — at least 38 complete within 90 seconds
Step 29: Confirm — no service crashes or restarts

--- Secrets and Deployment ---
Step 30: Run automated secret scan on the full repository
Step 31: Confirm — zero secrets found in code
Step 32: Trigger a deployment via CI/CD pipeline (no manual steps)
Step 33: Confirm — deployment completes without manual SSH or intervention

--- Backup and Restore ---
Step 34: Take a database backup
Step 35: Restore it to a separate test database instance
Step 36: Run a query to verify data integrity (row counts, spot-check records)
```

**Expected result:** All steps complete. Failures degrade correctly. Load test passes. No secrets in code. Deployment is automated.

---

## Success

The system can be handed to an operations team — including people who did not build it — and they can run, monitor, and recover it using the runbooks alone. The engineering team can deploy with confidence. The product is ready for real users.

---

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Load test shows > 5% error rate | Load test results | System is not ready for real users — scale or optimize first |
| Secrets found in code | Secret scan step 24 | Security breach risk — remove secrets, rotate all affected keys, re-scan |
| Rollback fails for any service | Rollback test step | Cannot safely deploy — fix before going live |
| Sentry alert not firing during outage | Smoke test step 10 | Blind to production failures — fix alerting before launch |
| Database restore fails or data is corrupted | Restore test step 30 | No recovery path for data loss — fix backup procedure before launch |

---

## Rollback

M9 is the last milestone before production. If a hardening change itself causes instability, roll back that specific change using the tested rollback procedure. All rollback scripts are confirmed in this milestone — they must work before it closes.

---

## Dependencies

- M8 complete (Product Quality / UX Refinement signed off)
- Staging environment mirrors production configuration
- Production infrastructure provisioned (database, Redis, Artifact Store, services)
- Operations team (or designated on-call engineer) identified and briefed
- All runbooks drafted before the milestone begins (hardening validates them, not writes them)

---

## Owner

Engineering Lead + Operations Lead

---

---

## Appendix: Milestone Sign-Off Checklist

Before closing any milestone, the following must be confirmed by the milestone owner:

```
□ All Acceptance Criteria checked off
□ Smoke test executed in full — results documented
□ All automated tests passing in CI
□ Rollback procedure confirmed executable
□ Any scope deferred to the next milestone is logged
□ Milestone owner signs off (name + date)
□ Engineering Lead countersigns
```

No milestone is closed by self-report. A second pair of eyes must confirm the smoke test results.
