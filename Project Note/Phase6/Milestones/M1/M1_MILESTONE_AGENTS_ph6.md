# AGENTS.md - Phase 6 M1 Official Truth Data Plane
**Milestone:** M1 - Official Truth Data Plane  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M1/M1_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M1 - Official Truth Data Plane |
| **Linear Project** | PH6 M1 - Official Truth Data Plane |
| **Owner** | Data Platform Engineer |
| **Status** | Closed - owner approved |
| **Depends on** | M0 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Build SEC and official macro adapters as the canonical production substrate.

---

## 1A. Locked Implementation Shape

Do not invent a wider data product in M1. Build the smallest official-source substrate that proves the Phase 6 cutover path.

| Area | Locked M1 shape |
|---|---|
| Company truth seed | `AAPL`, `MSFT`, `TSLA` through SEC EDGAR submissions and company facts |
| Macro truth seed | `TREASURY_DAILY_10Y`, `TREASURY_DAILY_2Y`, `BLS_CPI_U_ALL_ITEMS`, `BLS_UNEMPLOYMENT_RATE`, `BEA_REAL_GDP`, `EIA_WTI_SPOT` |
| Company endpoint | `GET /v1/official/company?ticker=AAPL` in `data-openbb` |
| Macro endpoint | `GET /v1/official/macro?scope=daily` in `data-openbb` |
| Canonical event ingest | `POST /internal/canonical-events/ingest` in `product-api` |
| Refresh trigger | `scheduler` owns official refresh orchestration through `POST /internal/official/refresh` or an existing scheduler route if one already fits |

Rules:

- Keep existing legacy endpoints compatible while M1 adds official-source endpoints.
- Tests must be fixture-backed and deterministic.
- Live official-source pulls are allowed for smoke evidence, but CI must not depend on network freshness.
- Missing fields are success states when represented explicitly; they are failures only when hidden or guessed.

## 2. Scope - What Is In

- [ ] SEC company truth adapters
- [ ] official macro adapters
- [ ] canonical filing and macro event normalization
- [ ] golden fixtures and missing-data tests
- [ ] no-provider-key smoke path

---

## 3. Scope - What Is Out

- [ ] rights-aware text storage
- [ ] first-party IR fetch logic
- [ ] mobile presentation changes

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `data-openbb` | official/public-source adapters only |
| `scheduler` | official refresh jobs |
| `product-api` | canonical event persistence |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `packages/contracts/src/official-source.ts` | new retrieval metadata and missing-field truth contract |
| `packages/contracts/src/canonical-event.ts` | new typed event substrate |
| existing company/macro contracts | additive provider-agnostic official-source metadata only if required |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M1 - Official Truth Data Plane

Ticket naming:

```text
[PH6-M1] What is being built
[PH6-M1][BUG] What is broken
[PH6-M1][SPIKE] What is being investigated
```

Every ticket must include:

- service touched
- contract touched (if any)
- `ph6_MILESTONES.md` acceptance criterion it satisfies
- whether the work removes or audits a deprecated dependency assumption

Never close a ticket without the relevant smoke proof or test evidence.

---

## 7. Logging For This Milestone

Phase 6 logs remain structured JSON.

Minimum additional requirement for this milestone:

- if a path degrades because of source coverage, rights state, or deprecated dependency fallback pressure, that reason must be visible in the log context

Never log secrets, tokens, or unreviewed full text.

---

## 8. Error Handling For This Milestone

- No empty catch blocks
- Every failed job or fetch must surface the responsible service and failure reason
- Rights violations are treated as real failures, not silent warnings
- Deprecated-provider fallback is not an acceptable hidden recovery path

---

## 9. Testing Requirements For This Milestone

- milestone-specific contract validation where applicable
- smoke proof against the Phase 6 ruleset
- deprecated dependency guard passing for affected paths
- golden fixtures or deterministic test data where appropriate

Minimum local command set:

```text
corepack pnpm run typecheck
corepack pnpm run security:audit
corepack pnpm run phase6:m0:guard
corepack pnpm --filter @thesis/contracts typecheck
corepack pnpm --filter @thesis/product-api test
corepack pnpm --filter @thesis/data-openbb test
```

If an environment cannot run one command, record the exact reason in evidence. Do not mark the command as passed.

---

## 10. Definition of Done

- [x] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied
- [x] Smoke test executed in full and recorded below
- [x] CI-equivalent local quality checks pass
- [x] Deprecated dependency check passes
- [x] Rollback path confirmed
- [x] Owner signs off
- [x] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date:
Run by:
Environment:
Result:

Step 1: Start the official-source adapters
Step 2: Request company truth for AAPL, MSFT, and TSLA
Step 3: Confirm payloads validate and include missing-field truth
Step 4: Request approved macro scope and confirm validation
Step 5: Remove deprecated provider keys and confirm the smoke still passes

Steps failed (if any):
Notes:
```

```text
Date: 2026-04-17
Run by: Codex
Environment: Local Windows workspace, fixture-backed official-source adapters
Result: PASS

Step 1: Start the official-source adapters
PASS - data-openbb test server exercised /v1/official/company and /v1/official/macro.

Step 2: Request company truth for AAPL, MSFT, and TSLA
PASS - all three returned sec_edgar official-source payloads with retrieval metadata and canonical filing events.

Step 3: Confirm payloads validate and include missing-field truth
PASS - official-source metadata, missing-field state, and canonical-event schemas validated in data-openbb tests.

Step 4: Request approved macro scope and confirm validation
PASS - /v1/official/macro?scope=daily returned the locked Treasury/BLS/BEA/EIA seed registry and macro canonical events.

Step 5: Remove deprecated provider keys and confirm the smoke still passes
PASS - official macro/company path does not require deprecated provider keys. Full Phase 6 guard also passed with zero new protected-path findings.

Steps failed (if any): none
Notes: `python -m pytest` is not available in this shell; the repo-owned data-openbb unittest script and full root test suite passed.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Official-source endpoint shape | Additive `data-openbb` endpoints `/v1/official/company` and `/v1/official/macro`, leaving legacy finance endpoints compatible | Covered by Phase 6 ADR-001 |
| Canonical event persistence | Product API owns `canonical_events` storage and `/internal/canonical-events/ingest` | Covered by Phase 6 ADR-001 |
| Scheduler trigger | Scheduler exposes `/internal/official/refresh` to orchestrate official adapter reads and canonical event ingest | Covered by Phase 6 ADR-001 |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Live per-agency macro parsers beyond fixture-backed seed contract | M1 proves the official-source contract and no-provider-key path; richer live agency parsing is an expansion, not required for M1 closeout | Not created per owner Linear skip pattern | M3 / future macro hardening |

---

## 14. Closeout Sign-Off

| Role | Status | Evidence |
|---|---|---|
| Owner | Accepted | Owner message approval on 2026-04-17 |
| Engineering Lead | Accepted by owner delegation | Owner message approval on 2026-04-17 |
