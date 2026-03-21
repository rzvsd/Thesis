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
| **Status** | Not Started |
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

- [ ] Visibility smoke tests for Sentry, PostHog, and LangSmith
- [ ] Failure scenario tests for provider outage, LLM timeout, and Redis flush
- [ ] Load test validation at 2x expected peak
- [ ] Runbook execution proof for key operational scenarios
- [ ] Rollback validation for every core service
- [ ] Secret scanning and cleanup verification
- [ ] Database backup and restore verification
- [ ] CI/CD deployment-path verification without manual SSH

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

This milestone is not done until every item below is checked:

- [ ] All acceptance criteria in `MILESTONES.md -> M9` are satisfied
- [ ] Smoke test executed in full - results documented in this folder
- [ ] All automated tests passing in CI
- [ ] All Linear tickets for this milestone are closed or explicitly deferred
- [ ] Deferred items logged in a new Linear ticket assigned beyond launch if needed
- [ ] Rollback procedure confirmed executable
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

**A staging demo is not done. A green deploy is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Record the result of the milestone smoke test here when it is run.

```text
Date:
Run by:
Environment: staging
Result: PASS / FAIL

Steps failed (if any):
  - Step #:

Notes:
```

---

## 12. Decisions Made During This Milestone

Log any operational or architecture decisions made during this milestone. If significant, they require an ADR.

| Decision | What was decided | ADR required? |
|---|---|---|
| [Example] | [Hardening decision recorded here] | [Yes / No] |

---

## 13. Known Issues and Deferrals

Log anything that was discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| [Description] | [Reason] | [Ticket ID] | [Post-launch] |
