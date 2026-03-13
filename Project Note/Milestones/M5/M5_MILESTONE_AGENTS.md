# AGENTS.md — Milestone Template
**Usage:** Copy this file into each `Milestones/M# — Name/` folder.  
Fill in every bracketed placeholder before the milestone begins.  
**This file inherits all rules from the root `AGENTS.md`. Read that first.**

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M# — [Name] |
| **Linear Project** | [Linear project URL or ID] |
| **Owner** | [Name or role] |
| **Status** | Not Started / In Progress / In Review / Closed |
| **Depends on** | [Previous milestone, e.g. M2 complete] |

---

## 1. What This Milestone Is Building

[2–4 sentences. Plain English. What exists at the end of this milestone that did not exist before.]

**Plain English summary for non-technical audit:**  
[One sentence a non-engineer can read to understand the goal.]

---

## 2. Scope — What Is In

The following and only the following is in scope for this milestone:

- [ ] [Deliverable 1]
- [ ] [Deliverable 2]
- [ ] [Deliverable 3]

Full deliverables and acceptance criteria: `MILESTONES.md → M#`

---

## 3. Scope — What Is Out

Do not touch the following during this milestone. If you believe something on this list needs to change, raise a Linear ticket and flag it — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| [Service or feature] | [Not yet / belongs to a different milestone] |
| [Service or feature] | [Not yet / belongs to a different milestone] |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| [e.g. data-openbb] | `apps/data-openbb/` | [e.g. implementing CanonicalFinanceData retrieval] |
| [e.g. packages/contracts] | `packages/contracts/` | [e.g. defining CanonicalFinanceData schema] |

**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| [e.g. CanonicalFinanceData] | [New / Modified / Read-only] |

Rules:
- New contract → create in `packages/contracts` before writing any service code
- Modified contract → bump the version, check all consumers compile
- Never define a data shape anywhere except `packages/contracts`

---

## 6. Linear Ticket Rules for This Milestone

**Project:** [Linear project name/URL]

**Ticket naming for this milestone:**
```
[M#] What is being built
[M#][BUG] What is broken
[M#][SPIKE] What is being investigated
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
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

---

## 7. Logging for This Milestone

Every service touched in this milestone must log the following events:

| Event | Level | Fields |
|---|---|---|
| [e.g. Data retrieval started] | INFO | service, job_id, ticker, timestamp |
| [e.g. Provider returned missing fields] | WARN | service, job_id, missing_fields[], timestamp |
| [e.g. Provider call failed] | ERROR | service, job_id, error_message, timestamp |

Format: `{ level, service, message, job_id?, timestamp }` — no exceptions.  
Never log tokens, passwords, or user PII.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| [e.g. Provider returns 429] | Return rate limit error with retry-after | Sentry + caller |
| [e.g. Response fails schema validation] | Reject response, log schema errors, return error to caller | Sentry |
| [e.g. Network timeout] | Retry once, on second failure return structured error | Sentry |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in this milestone requires:

- [ ] Unit test for every new function
- [ ] Integration test for every new endpoint or service method
- [ ] Golden fixture test if this milestone touches the data plane
- [ ] Degradation test if this milestone involves data that can be missing

Test files live in: `apps/[service]/tests/`  
Cross-service tests live in: `tests/integration/`  
Golden fixtures live in: `data/golden/`

CI must pass before any PR merges.

---

## 10. Definition of Done

This milestone is not done until every item below is checked:

- [ ] All acceptance criteria in `MILESTONES.md → M#` are satisfied
- [ ] Smoke test executed in full — results documented in this folder
- [ ] All automated tests passing in CI
- [ ] All Linear tickets for this milestone are closed or explicitly deferred
- [ ] Deferred items logged in a new Linear ticket assigned to the next milestone
- [ ] Rollback procedure confirmed executable
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

**A demo is not done. A merged PR is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Record the result of the milestone smoke test here when it is run.

```
Date:
Run by:
Environment: (local / staging)
Result: PASS / FAIL

Steps failed (if any):
  - Step #: [description of failure]

Notes:
```

---

## 12. Decisions Made During This Milestone

Log any architectural or product decisions made during this milestone. If a decision is significant, it requires an ADR in `/DECISIONS/`.

| Decision | What was decided | ADR required? |
|---|---|---|
| [e.g. Chose RSS over scraping for news-ingest] | [RSS feed for approved sources] | Yes — ADR-002 |

---

## 13. Known Issues and Deferrals

Log anything that was discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| [Description] | [Reason] | [Ticket ID] | [M#] |
