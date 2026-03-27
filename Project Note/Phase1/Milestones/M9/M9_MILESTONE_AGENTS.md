# AGENTS.md - M9 Production Hardening
**Milestone:** M9 - Production Hardening  
**Inherits from:** Root `AGENTS.md` - read that first.  
**Location:** `Milestones/M9/M9_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M9 - Production Hardening |
| **Linear Project** | M9 - Production Hardening |
| **Owner** | Engineering Lead + Operations Lead |
| **Status** | Closed for Phase 1 with owner-authorized TBD follow-up items |
| **Depends on** | M8 complete; staging mirrors production; runbooks drafted before the milestone begins |

---

## 1. What This Milestone Is Building

M9 is the final hardening milestone before production. It validates observability, resilience under failure, load behavior, rollback safety, backup/restore procedures, and deployment discipline so the system can be operated safely by people who did not build every line of it.

This milestone does not redefine the product. It proves the existing system survives real-world operational stress without relying on guesswork.

**Plain English summary for non-technical audit:**  
M9 proves the product is not just useful, but operable and safe to run in the real world.

---

## 2. Scope - What Is In

The following and only the following is in scope for M9:

- [x] Visibility smoke tests for active non-Deep-Dive hardening paths completed; remaining Deep Dive visibility work is owner-authorized TBD (`RZV-127`, `RZV-128`)
- [x] Failure scenario tests for active non-Deep-Dive hardening paths completed; remaining Deep Dive outage/timeout work is owner-authorized TBD (`RZV-129`, `RZV-131`)
- [x] Redis flush recovery guardrail implemented and verified (`RZV-132`, `RZV-140`)
- [x] Load validation for the live Deep Dive path is deferred by owner together with the Deep Dive live/API hardening work (`RZV-133`, `RZV-139`)
- [x] Runbook execution proof baseline completed (`docs/runbooks` + smoke runner artifact)
- [x] Rollback validation for every core service (`RZV-135`)
- [x] Secret scanning and cleanup verification
- [x] Database backup and restore verification
- [x] CI/CD deployment-path implementation completed in repo; live production proof is owner-authorized TBD (`RZV-138`)

Full deliverables and acceptance criteria: `MILESTONES.md -> M9`

---

## 3. Scope - What Is Out

Do not touch the following during this milestone. If you believe something on this list needs to change, raise a Linear ticket and flag it - do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| New product features | Hardening validates readiness; it does not expand scope |
| UX redesign, product-quality refinement, or premium-state work | That belongs to M8 |
| New providers or architectural pivots | Require separate ADR-gated work |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| product-api | `apps/product-api/` | Validate observability, failure handling, deployment safety |
| dexter-worker | `apps/dexter-worker/` | Validate traceability, timeout handling, degradation, load behavior |
| data-openbb | `apps/data-openbb/` | Validate outage/degradation behavior |
| news-ingest | `apps/news-ingest/` | Validate outage/degradation behavior |
| scheduler | `apps/scheduler/` | Validate scheduled paths and rollback safety |
| mobile | `apps/mobile/` | Validate rollback/distribution readiness and critical-path stability |
| infra/tests/runbooks | `infra/`, `tests/`, `docs/` | Validate backup/restore, deployment, runbooks, and load tooling |

**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| Existing platform contracts | Read-only unless a verified hardening blocker requires change |

Rules:
- Hardening does not invent new schemas casually
- If a contract must change, version it and prove all consumers still compile
- Never define a data shape anywhere except `packages/contracts`

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M9 - Production Hardening

**Ticket naming for this milestone:**
```
[M9] What is being hardened
[M9][BUG] What is broken
[M9][SPIKE] What is being investigated
```

**Required on every ticket:**
- Service it touches
- Contract it touches (if any)
- Acceptance criteria line from `MILESTONES.md` it satisfies

**Required on every bug ticket:**
- Steps to reproduce (exact commands or actions)
- Expected behavior
- Actual behavior
- Service that threw the error
- Log output or Sentry link
- Severity: `P1 - Blocker` / `P2 - High` / `P3 - Normal`

---

## 7. Logging for This Milestone

Every service touched in this milestone must log the following events:

| Event | Level | Fields |
|---|---|---|
| Failure scenario started | INFO | service, scenario, job_id?, timestamp |
| Hardening test degraded system behavior | WARN | service, scenario, message, timestamp |
| Hardening failure | ERROR | service, scenario, error_message, timestamp |

Format: `{ level, service, message, job_id?, timestamp }` - no exceptions.  
Never log tokens, passwords, or user PII.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Provider outage | Degrade explicitly, do not fabricate, alert correctly | Sentry + logs |
| Timeout path | Retry policy honored, job resolves cleanly | Sentry + logs |
| Redis flush | Durable state preserved, outcome explicit | Sentry + logs + Postgres |
| Deployment rollback test fails | Treat as release blocker | Linear + runbook review |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in this milestone requires:

- [ ] Automated failure scenario coverage where feasible
- [ ] Staging smoke execution for visibility paths
- [ ] Load test execution and recorded results
- [ ] Backup/restore verification
- [ ] Deployment and rollback verification

Test files live in: `apps/[service]/tests/`  
Cross-service tests live in: `tests/integration/`  
Load and smoke tests live in: `tests/load/` and `tests/smoke/`

CI must pass before any PR merges.

---

## 10. Definition of Done

This milestone is closed for Phase 1 when every item below is checked and any remaining work is explicitly marked as owner-authorized TBD:

- [x] All active acceptance criteria in `MILESTONES.md -> M9` are satisfied for Phase 1 closeout
- [x] Smoke test executed and results documented in this folder
- [x] Relevant automated tests passing for the hardening changes touched in this pass
- [x] All Linear tickets for this milestone are closed or explicitly deferred
- [x] Deferred items logged in Linear as future TBD work under owner authorization
- [x] Rollback procedure confirmed executable
- [x] Owner signs off
- [x] Engineering Lead countersigns

**A staging demo is not done. A green deploy is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Record the result of the milestone smoke test here when it is run.

```text
Date: 2026-03-24
Run by: Codex + Owner (Deep Dive checks deferred by owner direction for this pass)
Environment: local docker (staging-like)
Result: Initial partial hardening pass; final Phase 1 closeout recorded on 2026-03-27

Initial gaps observed:
  - M9 AC #8: 40-concurrent Deep Dive load SLA failed (0 complete, 40 failed).
  - M9 AC #13: No CI/CD deploy workflow existed yet.

Notes:
  - PASS: Lint/typecheck/test baseline passed.
  - PASS: Deliberate API exception generated Sentry capture (event id logged).
  - PASS (fix): Market Pulse outage path now emits Sentry capture on degraded `data_unavailable` runs. Verified on outage job `b45a6a3c-b7cd-41db-8c65-978b30612baf`, event `d388dc5fc01f496db36eedf316f8f137`.
  - PASS (retest): Redis flush recovery verified after watchdog implementation. Repro job `206c49fd-a96e-44a1-98ce-dea8c962fb9f` moved `queued` -> `failed` after `FLUSHALL` + worker restart (no orphan queue state).
  - PASS: Runbook corpus now exists under `docs/runbooks/` with executable smoke runner (`pnpm runbooks:m9:smoke` and `pnpm runbooks:m9:smoke:backup`), artifact `artifacts/m9/2026-03-24T12-46-58/summary.json`.
  - PASS: Rollback drill executed service-by-service via `docker compose up -d --build` for product-api, dexter-worker, data-openbb, news-ingest, scheduler, and mobile; all containers returned healthy and all `/health` endpoints returned `ok` (`artifacts/m9/rollback-drill-2026-03-24/summary.json`).
  - PASS: Secret hygiene checks passed on tracked files; local secrets remain untracked.
  - PASS: Backup and restore executed; row counts matched on restored database.
  - BLOCKED/DEFERRED in this test pass: Deep Dive-dependent M9 checks (#2, #3, #4, #6) by owner direction.
  - 2026-03-27 rerun: `pnpm runbooks:m9:smoke` PASS and `pnpm runbooks:m9:smoke:backup` PASS with fresh artifact `artifacts/m9/2026-03-27T15-55-32/summary.json` (backup/restore check passed with matching row counts).
  - 2026-03-27 rerun (hardening of the hardening script): `scripts/runbooks/smoke-hardening.ps1` now force-cleans `thesis_restore_smoke` and uses `psql -v ON_ERROR_STOP=1`, so repeated backup/restore proofs stay deterministic. Fresh artifacts: `artifacts/m9/2026-03-27T18-56-33/summary.json` (runbook smoke PASS) and `artifacts/m9/2026-03-27T19-03-39/summary.json` (backup/restore PASS, jobs `65 -> 65`).
  - 2026-03-27 CI/CD update: `.github/workflows/deploy-production.yml` added to move deployment into GitHub Actions; because Thesis does not yet have a real production server provisioned, the live production run proof is explicitly deferred as owner-authorized TBD.
  - 2026-03-27 closeout decision: M9 is closed for Phase 1 with two owner-authorized TBD carry-forwards only: (1) Deep Dive live/API hardening proof and (2) CI/CD live production proof after infrastructure exists.
```

---

## 12. Decisions Made During This Milestone

Log any operational or architecture decisions made during this milestone. If significant, they require an ADR.

| Decision | What was decided | ADR required? |
|---|---|---|
| M9 test scope gate | Deep Dive-dependent hardening checks are deferred for this pass by explicit owner direction; non-Deep-Dive M9 checks proceed. | No |
| Linear traceability mode | Open one acceptance ticket per M9 criterion, plus dedicated `[M9][BUG]` tickets for concrete failures discovered during smoke execution. | No |
| Redis queue recovery strategy | Product API owns Redis queue recovery via Postgres-backed watchdog (stale `queued` requeue + stale `running` timeout failure), configurable by env. | No |
| Phase 1 M9 closeout mode | Owner approved closing M9 for Phase 1 while carrying `CI/CD live proof` and `Deep Dive live/API hardening` as explicit TBD work for a later build cycle. | No |

---

## 13. Known Issues and Deferrals

Log anything that was discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Deep Dive observability, outage, timeout, and load hardening on the live/API path | Owner-authorized TBD. Deferred until the Deep Dive live/API path is intentionally resumed in a later build cycle. | RZV-127, RZV-128, RZV-129, RZV-131, RZV-133, RZV-139 | TBD |
| CI/CD live production deploy proof | Repo workflow exists, but Thesis does not yet have a real production server inventory to target. Final proof is deferred by owner until production infrastructure is provisioned. | RZV-138 | TBD |
