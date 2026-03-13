# AGENTS.md — M1 Baseline
**Milestone:** M1 — Baseline  
**Inherits from:** Root `AGENTS.md` — read that first.  
**Location:** `Milestones/M1 — Baseline/M1_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M1 — Baseline |
| **Linear Project** | M1 — Baseline |
| **Owner** | Engineering Lead |
| **Status** | Not Started |
| **Depends on** | Nothing — this is the first milestone |

---

## 1. What This Milestone Is Building

The monorepo skeleton. Every service folder exists, every contract is defined and compiles, every service starts via `docker-compose up`, and CI enforces quality on every pull request. No business logic is written. No real data flows. The structure is the deliverable.

**Plain English summary for non-technical audit:**  
Before any cooking happens, we set up the kitchen — every station exists, every tool is in its place, and anyone can walk in and confirm everything is ready.

---

## 2. Scope — What Is In

The following and only the following is in scope for M1:

- [ ] Monorepo folder structure created per `BLUEBOOK cld.md §15`
- [ ] All service stubs created under `apps/` — they start but do nothing except return a health check
- [ ] All package stubs created under `packages/`
- [ ] `packages/contracts` compiles with all canonical schemas exported
- [ ] `docker-compose.yml` brings all services to healthy status within 60 seconds
- [ ] CI pipeline runs lint, type-check, and unit tests on every PR automatically
- [ ] `.env.example` lists every required environment variable with a description comment
- [ ] Core docs committed to repo root: `README.md`, `BLUEBOOK cld.md`, `ROADMAP.md`, `PRD.md`, `MILESTONES.md`, `AGENTS.md`
- [ ] All ADRs committed to `Decisions/`: ADR-001 through ADR-006

Full deliverables and acceptance criteria: `MILESTONES.md → M1`

---

## 3. Scope — What Is Out

Do not touch the following during M1. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Any business logic in any service | M2 and beyond |
| OpenBB or news-please integration | M2 |
| Dexter reasoning pipeline | M3 |
| Auth or JWT implementation | M4 |
| Database migrations or real schemas | M4 |
| Redis queue logic | M4 |
| Any external API calls | M2 and beyond |
| Mobile app UI | M7 |
| Forking or cloning Dexter / OpenBB repos | Separate repos — never inside this monorepo |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| All app stubs | `apps/*/` | Create folder + health check endpoint only |
| All package stubs | `packages/*/` | Create folder + index exports only |
| Contracts | `packages/contracts/` | Define and export all canonical schemas — this is the main M1 work |
| Observability stub | `packages/observability/` | Stub init files for Sentry, PostHog, LangSmith — no real config yet |
| Infra | `infra/` | `docker-compose.yml` that starts all services with health checks |
| CI | `.github/workflows/` | PR workflow: lint → typecheck → unit tests |

**Every `apps/*` service needs exactly three things in M1:**
- A `package.json` or language equivalent
- A health check endpoint returning `{ status: "ok" }`
- A `Dockerfile`

**Do not add anything else to any service in M1.**  
**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

All contracts are **new** in M1. Defined here, never changed without a version bump.

| Contract | Change type | File path |
|---|---|---|
| `AnalysisRequest` | New | `packages/contracts/src/analysis-request.ts` |
| `AnalysisReport` | New | `packages/contracts/src/analysis-report.ts` |
| `ReportSection` | New | `packages/contracts/src/report-section.ts` |
| `EvidenceItem` | New | `packages/contracts/src/evidence-item.ts` |
| `CanonicalFinanceData` | New | `packages/contracts/src/canonical-finance-data.ts` |
| `CanonicalNewsArticle` | New | `packages/contracts/src/canonical-news-article.ts` |
| `MarketPulseReport` | New | `packages/contracts/src/market-pulse-report.ts` |

**Rules:**
- All schemas defined exactly as in `BLUEBOOK cld.md §9` — do not deviate
- Export all types from `packages/contracts/src/index.ts`
- Run `pnpm typecheck` after every contract addition — CI must pass
- JSON Schema equivalents live alongside TypeScript types for runtime validation
- Never define a data shape anywhere except `packages/contracts`

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M1 — Baseline

**Ticket naming:**
```
[M1] What is being built
[M1][BUG] What is broken
[M1][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[M1] Monorepo folder structure` | All folders created per BLUEBOOK cld.md §15 |
| `[M1] Service stubs and docker-compose` | docker-compose up → all services healthy within 60s |
| `[M1] Contracts package` | packages/contracts compiles with zero TypeScript errors |
| `[M1] CI pipeline` | PR triggers lint + typecheck + unit tests automatically |
| `[M1] .env.example` | Every variable listed with a description comment |
| `[M1] Core docs committed` | README, BLUEBOOK, ROADMAP, PRD, MILESTONES, AGENTS in repo root |
| `[M1] ADRs committed` | ADR-001 through ADR-006 in Decisions/ |

**Required on every ticket:**
- Folder or file it creates
- Acceptance criteria line from `MILESTONES.md` it satisfies
- Link to this file

**Required on every bug ticket:**
- Steps to reproduce (exact commands)
- Expected vs actual behavior
- Which service or file caused it
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run.

---

## 7. Logging for This Milestone

M1 services are stubs. Logging is minimal.

| Event | Level | Fields |
|---|---|---|
| Service started | INFO | `{ level, service, message: "Service started", timestamp }` |
| Health check called | INFO | `{ level, service, message: "Health check OK", timestamp }` |
| Service failed to start | ERROR | `{ level, service, message: "<error>", timestamp }` |

Format: `{ level, service, message, timestamp }` — no exceptions.  
No `job_id` needed in M1 — no jobs exist yet.  
Never log tokens, passwords, or PII.

---

## 8. Error Handling for This Milestone

M1 has minimal error surface — startup and health checks only.

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Service fails to start | docker-compose shows unhealthy — fix before proceeding | Terminal output |
| TypeScript error in contracts | CI fails on typecheck step — must fix before PR merges | CI log |
| CI pipeline does not trigger on PR | No automated checks running — fix GitHub Actions config immediately | GitHub |
| `.env.example` missing a variable | Service fails to start with missing env error | Terminal output |

**Rule:** No empty catch blocks — even in stubs. If a stub throws, it logs and exits cleanly.

---

## 9. Testing Requirements for This Milestone

M1 testing is minimal by design — no business logic exists.

- [ ] Health check endpoint returns `{ status: "ok" }` — one test per service
- [ ] `packages/contracts` index exports all types — one compilation test confirms this
- [ ] No unit tests required for folder structure or config files
- [ ] CI pipeline itself is validated by smoke test steps 8–9

Test files live in: `apps/<service>/tests/health.test.ts`  
CI must pass before any PR merges.

---

## 10. Definition of Done

M1 is not done until every item below is checked:

- [ ] All 7 acceptance criteria in `MILESTONES.md → M1` are satisfied
- [ ] Smoke test executed in full — results documented in §11 below
- [ ] All automated tests passing in CI on main branch
- [ ] All 7 Linear tickets for M1 are closed or explicitly deferred
- [ ] Deferred items logged as Linear tickets assigned to the next milestone
- [ ] Rollback confirmed: `git revert` on main branch restores previous state cleanly
- [ ] Owner signs off
- [ ] Engineering Lead countersigns

**A running docker-compose is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md → M1` exactly as written. Record results here.

```
Date:
Run by:
Environment: local
Result: PASS / FAIL

Step 1 — Clone to fresh machine:         PASS / FAIL
Step 2 — Copy .env.example to .env:      PASS / FAIL
Step 3 — docker-compose up:              PASS / FAIL
Step 4 — Wait 60 seconds:                PASS / FAIL
Step 5 — All services healthy:           PASS / FAIL
Step 6 — pnpm typecheck:                 PASS / FAIL
Step 7 — Zero TypeScript errors:         PASS / FAIL
Step 8 — Open trivial PR:                PASS / FAIL
Step 9 — CI triggers and passes:         PASS / FAIL

Steps failed (if any):
  - Step #:

Notes:
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Package manager | pnpm (monorepo workspaces) | No |
| Runtime | Node.js 20+ | No — already in BLUEBOOK cld.md |
| CI provider | GitHub Actions | No |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Dexter fork not cloned locally | Separate repo — not part of monorepo | — | M3 |
| OpenBB fork not cloned locally | Separate repo — not part of monorepo | — | M2 |
| Real API keys not filled in | No external calls in M1 | — | M2 |