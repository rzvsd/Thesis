# AGENTS.md — M4 Product API + Job System

**Milestone:** M4 — Product API + Job System
**Inherits from:** Root `AGENTS.md` — read that first.
**Location:** `Project Note/Milestones/M4/M4_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field              | Value                           |
| ------------------ | ------------------------------- |
| **Milestone**      | M4 — Product API + Job System   |
| **Linear Project** | https://linear.app/rzvsd/project/m4-product-api-job-system-913761665fbb |
| **Owner**          | Backend Engineer (Product API)  |
| **Status**         | Closed (Passed)                 |
| **Depends on**     | M3 — Dexter Foundation complete |

---

## 1. What This Milestone Is Building

The Product API layer that sits in front of Dexter-led Company Deep Dive and makes it operable as a real product workflow. At the end of M4, a user can register, verify, log in, refresh a session, log out, submit a Deep Dive job, have that job queued through Redis, have Dexter process it, and retrieve the stored result through API endpoints backed by Postgres metadata and Artifact Store blobs. This milestone also establishes the non-negotiable control rules for the system boundary: Product API is the only token issuer, `jobs` is the source of truth for async state, `reports` stores metadata only, `audit_events` records lifecycle visibility, and failures surface clearly instead of disappearing.

**Plain English summary for non-technical audit:**
This milestone builds the secure front door and delivery pipeline around Dexter so the system knows who the user is, tracks what was requested, and safely stores and returns the finished report.

---

## 2. Scope — What Is In

The following and only the following is in scope for M4:

* [x] Email/password registration flow with verification email
* [x] Verified login flow issuing access token (15 minutes) and refresh token (30 days)
* [x] Silent access-token refresh flow for authenticated clients
* [x] Logout flow that invalidates both access and refresh tokens
* [x] Protected-route auth middleware returning HTTP 401 on unauthenticated access
* [x] `POST /jobs` for Deep Dive request creation with durable Postgres job record
* [x] Redis queue publish for newly created jobs within milestone timing target
* [x] Dexter pickup path updating job status from `queued` → `running` → terminal state
* [x] Artifact Store write path for completed reports with Postgres metadata write
* [x] `GET /jobs/:id` lifecycle status retrieval
* [x] `GET /reports/:id` completed report retrieval
* [x] `GET /reports` server-side report history for the authenticated user
* [x] Rate limiting on public Product API endpoints with explicit HTTP 429 behavior
* [x] Append-only audit event recording for all major auth and job lifecycle transitions
* [x] Sentry visibility for failed jobs and Product API exceptions

Full deliverables and acceptance criteria: `MILESTONES.md → M4`

---

## 3. Scope — What Is Out

Do not touch the following during M4. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope                                                                                            | Reason                                        |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Mobile app UI, Android token storage implementation, or on-device rendering behavior                    | M7                                            |
| Ticker search UX and supported-security search behavior                                                 | M5                                            |
| Deep Dive report content quality, section semantics, evidence policy, or SLA hardening                  | M5                                            |
| Market Pulse scheduler, briefing generation, or push delivery workflows                                 | M6                                            |
| Watchlist creation, update, and overlay behavior                                                        | M6 / M7                                       |
| Feature flags, PostHog product analytics, or user-behavior instrumentation                              | M7 / M8                                       |
| Direct Dexter writes to Postgres or Artifact Store outside the approved Product API/job-system boundary | Forbidden by BLUEBOOK                         |
| Re-architecting M3 Dexter reasoning internals                                                           | M3 already complete                           |
| Pricing / plan enforcement, quota gating, or monetization logic                                         | Post-launch / future milestone                |
| Account deletion, data export tooling, or privacy-policy fulfillment workflow                           | Later milestone / post-launch compliance work |
| Broad OAuth provider expansion beyond the approved auth surface                                         | Scope creep                                   |

---

## 4. Services You Are Working In

| Service               | Folder                                     | What you are doing in it                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product-api`         | `apps/product-api/`                        | Implement auth endpoints, JWT issuance/refresh/logout, protected-route guards, job creation, job status lookup, report retrieval, report history, rate limiting, audit-event writes, and orchestration around Redis/Postgres/Artifact Store |
| `dexter-worker`       | `apps/dexter-worker/`                      | Consume queued Deep Dive jobs through the approved job-system boundary and update lifecycle state through the M4 contract path only                                                                                                         |
| Contracts             | `packages/contracts/`                      | Add or extend Product API request/response contracts, auth response shapes, job status payloads, and report metadata contracts as needed                                                                                                    |
| Observability         | `packages/observability/`                  | Wire structured logging, Sentry capture, and shared request/job correlation fields                                                                                                                                                          |
| Infra                 | `infra/`                                   | Add Product API env vars, JWT and email-provider secret references, Redis/Postgres wiring, Artifact Store wiring, health checks, and docker-compose/staging config needed for M4                                                            |
| Database / migrations | `infra/` or `apps/product-api/migrations/` | Add or update schema for auth/session support, jobs, reports metadata, and append-only audit events as required by M4                                                                                                                       |
| Integration tests     | `tests/integration/`                       | Add end-to-end auth → job creation → queue → completion → retrieval coverage                                                                                                                                                                |
| Smoke tests           | `tests/smoke/`                             | Add or update scripted smoke coverage for the M4 Product API + Job System path                                                                                                                                                              |

**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

M4 should reuse M1–M3 core contracts wherever possible. Modify only where a real Product API boundary requires it.

| Contract              | Change type                                           | File path                                         |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `AnalysisRequest`     | Read-only unless job-boundary bug found               | `packages/contracts/src/analysis-request.ts`      |
| `AnalysisReport`      | Read-only unless retrieval-boundary bug found         | `packages/contracts/src/analysis-report.ts`       |
| `ServiceResponse`     | Read-only if reused at API boundary                   | `packages/contracts/src/service-response.ts`      |
| `AuthRegisterRequest` | New if missing                                        | `packages/contracts/src/auth-register-request.ts` |
| `AuthLoginRequest`    | New if missing                                        | `packages/contracts/src/auth-login-request.ts`    |
| `AuthRefreshRequest`  | New if missing                                        | `packages/contracts/src/auth-refresh-request.ts`  |
| `AuthTokensResponse`  | New if missing                                        | `packages/contracts/src/auth-tokens-response.ts`  |
| `CreateJobRequest`    | New if missing                                        | `packages/contracts/src/create-job-request.ts`    |
| `JobStatusResponse`   | New if missing                                        | `packages/contracts/src/job-status-response.ts`   |
| `ReportListItem`      | New if missing                                        | `packages/contracts/src/report-list-item.ts`      |
| `AuditEventPayload`   | New or modified if event payloads are schema-governed | `packages/contracts/src/audit-event-payload.ts`   |

**Rules:**

* Use existing M1/M3 contract definitions as the default truth for `AnalysisRequest` and `AnalysisReport`
* New Product API request/response shapes must be created in `packages/contracts` before controller code is written
* If a contract must change, bump the version and verify all consumers compile
* Never define auth, job, or report JSON structure inside ad-hoc route handlers
* `jobs` remains the source of truth for async state; Redis queue entries point to job IDs only
* `reports` stores metadata only; full report bodies remain in the Artifact Store
* `audit_events` is append-only — never update or delete rows to "fix" history
* Do not expose internal storage keys, raw provider errors, or implementation-only fields in public API responses
* Never return raw JWT secrets, refresh tokens from logs, password hashes, verification tokens, or OAuth provider secrets anywhere outside the intended auth response surface

---

## 6. Linear Ticket Rules for This Milestone

**Project:** https://linear.app/rzvsd/project/m4-product-api-job-system-913761665fbb

**Ticket naming:**

```text
[M4] What is being built
[M4][BUG] What is broken
[M4][SPIKE] What is being investigated
```

**Create one ticket per acceptance-criteria item or tightly-coupled implementation slice:**

| Ticket                                                                 | Acceptance criteria it satisfies                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `[M4] email registration and verification flow`                        | New user can register and receive verification email                                    |
| `[M4] login refresh logout token lifecycle`                            | Verified login, token issuance, silent refresh, logout invalidation                     |
| `[M4] protected route auth guard`                                      | Unauthenticated requests return 401, not 500                                            |
| `[M4] deep dive job creation endpoint`                                 | `POST /jobs` creates durable queued job record                                          |
| `[M4] redis queue dispatch`                                            | Job appears in Redis within milestone timing target                                     |
| `[M4] dexter lifecycle handoff`                                        | Dexter picks up job and updates `running` / terminal state                              |
| `[M4] artifact store write and report metadata persistence`            | Completed reports written to Artifact Store and metadata written to Postgres            |
| `[M4] job status and report retrieval endpoints`                       | `GET /jobs/:id`, `GET /reports/:id`, and `GET /reports` work correctly                  |
| `[M4] rate limiting and abuse controls`                                | HTTP 429 with clear message on limit breach                                             |
| `[M4] audit events and sentry visibility`                              | Audit trail complete and failed jobs visible in Sentry                                  |
| `[M4][SPIKE] auth provider alignment`                                  | Only if Google Sign-In backend support or provider config blocks M4 auth implementation |
| `[M4][SPIKE] contract version bump for job/report retrieval semantics` | Only if a proven contract gap exists during implementation                              |

**Required on every ticket:**

* Service or folder it touches
* Contract it touches (if any)
* Acceptance criteria line from `MILESTONES.md` it satisfies
* Link to this file

**Required on every bug ticket:**

* Steps to reproduce (exact commands, routes, or request payload)
* Expected behavior
* Actual behavior
* Which system stage failed (`registration` / `verification` / `login` / `refresh` / `logout` / `job_create` / `queue_publish` / `worker_claim` / `artifact_write` / `report_read` / `rate_limit` / `audit_write`)
* Which service surfaced the error
* Log output or Sentry link
* Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run and the relevant smoke-test step verified.

---

## 7. Logging for This Milestone

M4 introduces auth, queue, and storage-boundary observability. Logging must be structured and consistent.

| Event                          | Level | Fields                                                             |
| ------------------------------ | ----- | ------------------------------------------------------------------ |
| Registration requested         | INFO  | `service, request_id, email_hash?, ip_hash?, timestamp`            |
| Verification email sent        | INFO  | `service, user_id, request_id, provider, timestamp`                |
| Verification failed            | WARN  | `service, request_id, reason, timestamp`                           |
| Login succeeded                | INFO  | `service, user_id, request_id, auth_provider, timestamp`           |
| Login rejected                 | WARN  | `service, request_id, auth_provider, reason, timestamp`            |
| Access token refreshed         | INFO  | `service, user_id, request_id, timestamp`                          |
| Refresh rejected / revoked     | WARN  | `service, request_id, reason, timestamp`                           |
| Logout completed               | INFO  | `service, user_id, request_id, timestamp`                          |
| Protected route denied         | WARN  | `service, route, request_id, reason: "unauthenticated", timestamp` |
| Job created                    | INFO  | `service, job_id, user_id, ticker, status: "queued", timestamp`    |
| Job published to Redis         | INFO  | `service, job_id, queue_name, latency_ms, timestamp`               |
| Worker claimed job             | INFO  | `service, job_id, worker, status: "running", timestamp`            |
| Job status changed             | INFO  | `service, job_id, from_status, to_status, timestamp`               |
| Artifact stored                | INFO  | `service, job_id, report_id, artifact_key, timestamp`              |
| Report retrieval served        | INFO  | `service, user_id, report_id, request_id, timestamp`               |
| Rate limit exceeded            | WARN  | `service, route, request_id, limiter_key_type, timestamp`          |
| Audit event written            | INFO  | `service, event_type, user_id?, job_id?, timestamp`                |
| Product API exception captured | ERROR | `service, request_id, route?, job_id?, error_message, timestamp`   |

Format: `{ level, service, message, job_id?, request_id?, timestamp }` — no exceptions.
Do not log passwords, raw email addresses, raw JWTs, refresh tokens, verification tokens, OAuth codes, provider secrets, or full user PII.

---

## 8. Error Handling for This Milestone

| Failure scenario                                                  | Expected behavior                                                                                                         | Surfaces to       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Verification email provider fails                                 | Registration does not pretend success; log failure, return structured error or retry-safe response per endpoint contract  | Sentry + caller   |
| Duplicate registration attempt for existing email                 | Return clean conflict response; do not create duplicate user                                                              | Caller + logs     |
| Invalid or expired verification token                             | Reject verification cleanly; do not verify user                                                                           | Caller + logs     |
| Wrong password or invalid auth credentials                        | Return auth failure without leaking which sensitive secret was wrong                                                      | Caller + logs     |
| Refresh token expired, revoked, or missing from server-side store | Reject refresh cleanly and force re-authentication                                                                        | Caller + logs     |
| Logout called with already-invalid token                          | Return safe idempotent response per contract; tokens remain unusable                                                      | Caller + logs     |
| Unauthenticated request hits protected endpoint                   | Return HTTP 401 — never 500                                                                                               | Caller + logs     |
| Redis unavailable during job creation                             | Do not leave a fake queued job with no dispatch path; fail request or mark durable failure according to transaction rules | Sentry + caller   |
| Job created in Postgres but queue publish fails                   | Record failure visibly, do not report success as if processing will continue                                              | Sentry + logs     |
| Dexter never claims a queued job                                  | Job remains visible as `queued`; timeout/alerting path must surface investigation need                                    | Sentry + ops logs |
| Artifact Store write fails after Dexter completes                 | Do not mark report retrievable until artifact write and metadata write both succeed                                       | Sentry + caller   |
| Report metadata write fails after artifact upload                 | Surface failure and prevent false `complete` state without retrievable report                                             | Sentry + logs     |
| `GET /reports/:id` requested before completion                    | Return clear not-ready / not-found behavior per endpoint contract; never 500                                              | Caller + logs     |
| Rate limit exceeded                                               | Return HTTP 429 with explicit message; do not crash or silently drop request                                              | Caller + logs     |
| Audit event insert fails                                          | Main flow should not silently lose the event; capture and surface the failure for investigation                           | Sentry + logs     |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in M4 requires:

* [x] Unit test for every new auth utility, token service, password-hashing path, queue publisher, artifact-store client, and audit-event writer
* [x] Integration test for `POST /auth/register` → verification → `POST /auth/login` → `POST /auth/refresh` → `POST /auth/logout`
* [x] Integration test for protected routes proving unauthenticated access returns HTTP 401
* [x] Integration test for `POST /jobs` proving Postgres job creation and Redis queue publish
* [x] Integration test for queued job → Dexter claim → `running` → terminal state transition visibility
* [x] Integration test for successful completion proving Artifact Store write and Postgres report metadata write
* [x] Integration test for `GET /jobs/:id` returning correct status at each lifecycle stage
* [x] Integration test for `GET /reports/:id` returning the completed report and schema-valid payload
* [x] Integration test for `GET /reports` returning authenticated user history newest-first
* [x] Cross-session history test proving server-side report history is restorable after re-login / new client session
* [x] Failed-job test proving status becomes `failed` and Sentry receives the failure context
* [x] Rate-limit test proving HTTP 429 and clear error message on breach
* [x] Audit-event test proving all required lifecycle steps append records to `audit_events`
* [x] CI must run these tests automatically on every PR

Test files live in:

* `apps/product-api/tests/`
* `apps/dexter-worker/tests/` where worker-side lifecycle hooks are touched

Cross-service tests live in:

* `tests/integration/`

Smoke tests live in:

* `tests/smoke/` or an equivalent scripted runner committed to the repo

**Important:** M4 is not a governed data-plane milestone, so golden fixtures are not the main proof here. The required proof is end-to-end auth and job-lifecycle behavior under realistic integration conditions.

---

## 10. Definition of Done

M4 is not done until every item below is checked:

* [x] All 14 acceptance criteria in `MILESTONES.md → M4` are satisfied
* [x] Smoke test executed in full — results documented in §11 below
* [x] All automated tests passing in CI
* [x] All Linear tickets for M4 are closed or explicitly deferred
* [x] Deferred items logged as Linear tickets assigned to the next milestone
* [x] Rollback procedure confirmed executable
* [x] Registration, verification, login, refresh, and logout all work end-to-end
* [x] A valid authenticated `POST /jobs` creates a durable queued Deep Dive job
* [x] Job state transitions are visible and correct in Postgres for `queued`, `running`, `complete`, and `failed`
* [x] Completed report artifact is stored and retrievable through `GET /reports/:id`
* [x] Authenticated report history is returned through `GET /reports`
* [x] Failed-job path is visible in Sentry with usable context
* [x] Audit trail coverage is confirmed in `audit_events`
* [x] Owner signs off
* [x] Engineering Lead countersigns

Closeout note: acceptance criteria and the full M4 smoke test passed on 2026-03-20 (see §11 and Linear RZV-57).

Sign-off:

* Owner: Rzv_sd (2026-03-20)
* Engineering Lead: Rzv_sd (2026-03-20)

**A single successful API response is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md → M4` exactly as written. Record results here.

```text
Date: 2026-03-20
Run by: Codex + owner validation loop
Environment: local docker
Result: PASS

Steps failed (if any):
  - None.

Notes:
  - Core auth path passed: register -> verify -> login -> refresh -> logout -> refresh rejected.
  - Queue path passed: durable queued job in Postgres and Redis queue visibility confirmed with worker paused.
  - Worker lifecycle passed: queued -> running -> complete with audit event trail in Postgres.
  - Storage path passed: artifact written to Artifact Store and metadata written to reports table.
  - Retrieval path passed: GET /reports/:id and GET /reports returned expected authenticated payloads.
  - Unauthenticated protected-route behavior passed: 401 returned (no 500 leak).
  - Failure simulation path now passes: FAILME / BADTICKERZZZ jobs reach failed state with error_message via queue worker.
  - Live Sentry UI verification passed for failed-job path (event_id=19cc2072248d4b908588a7c280bed7b2, route=/internal/jobs/:id/fail).
```

---

## 12. Decisions Made During This Milestone

Log any architectural or product decisions made during this milestone. If a decision is significant, it requires an ADR in `/DECISIONS/`.

| Decision                | What was decided                                                                                                                   | ADR required?                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Token issuer ownership  | Product API remains the sole token issuer                                                                                          | No — already in BLUEBOOK                                       |
| Token lifetimes         | Access token = 15 minutes; refresh token = 30 days                                                                                 | No — already in BLUEBOOK / MILESTONES                          |
| Session revocation rule | Logout invalidates both tokens; refresh-token revocation is server-side                                                            | No — already in BLUEBOOK                                       |
| Async state ownership   | `jobs` in Postgres remains the source of truth; Redis points to job IDs only                                                       | No — already in BLUEBOOK                                       |
| Report storage split    | `reports` stores metadata only; report body lives in Artifact Store                                                                | No — already in BLUEBOOK                                       |
| Audit event policy      | `audit_events` is append-only; no delete/update history rewrites                                                                   | No — already in BLUEBOOK                                       |
| Auth provider baseline  | Email/password flow is mandatory for M4 closeout; any Google Sign-In backend work must not weaken the required email/password path | No — aligns M4 execution with current PRD + milestone baseline |

---

## 13. Historical Notes and Future Scope

M4 is fully closed. This section is retained for traceability only; items below describe future scope outside the M4 acceptance boundary and do not represent open blockers.

| Issue                                                                               | Why deferred                                                                         | Linear ticket | Target milestone               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------------------------ |
| Ticker search and supported-security lookup behavior                                | Belongs to first user-facing Deep Dive milestone, not Product API boundary milestone | —             | M5                             |
| Deep Dive SLA validation and report-content quality enforcement                     | Product API orchestration comes first; end-user quality validation belongs next      | —             | M5                             |
| Market Pulse scheduling and delivery                                                | Separate surface and queue path                                                      | —             | M6                             |
| Android client-side token storage, secure refresh UX, and report rendering behavior | Mobile delivery milestone owns on-device behavior                                    | —             | M7                             |
| Push notification behavior for report completion                                    | User-facing delivery concern, not required for M4 closeout                           | —             | M7                             |
| Plan limits, quota enforcement, and billing hooks                                   | Monetization is not part of the M4 system boundary                                   | —             | Post-launch / future milestone |
| Account deletion, privacy export, and archival-facing compliance tooling            | Not required to establish the core auth + job system path                            | —             | Later milestone / post-launch  |
| Any additional OAuth providers beyond the approved auth surface                     | Not needed to complete the M4 acceptance path                                        | —             | Future milestone               |
