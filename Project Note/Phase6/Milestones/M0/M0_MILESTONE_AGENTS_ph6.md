# AGENTS.md - Phase 6 M0 Dependency Audit & Cutover Plan
**Milestone:** M0 - Dependency Audit & Cutover Plan  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M0/M0_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M0 - Dependency Audit & Cutover Plan |
| **Linear Project** | PH6 M0 - Dependency Audit & Cutover Plan |
| **Owner** | Platform Architect + Engineering Lead |
| **Status** | Closed |
| **Depends on** | Phase 5 docs and current repo inventory |

---

## 1. What This Milestone Is Building

Inventory and guard every deprecated provider assumption before implementation spreads.

Before implementation, read `PH6_DECISION_LOCKS.md`. It defines the protected-path guard scope, exact Phase 6 contract names, Fear & Greed transition, and evidence folder standard.

---

## 2. Scope - What Is In

- [x] dependency inventory for protected production paths
- [x] Phase 6 doc pack creation and linkage
- [x] ADR drafting for the final data-substrate architecture phase
- [x] CI / local guardrail for deprecated imports or required envs
- [x] migration matrix per surface
- [x] secret and env deprecation inventory
- [x] decision-lock verification before coding begins

---

## 3. Scope - What Is Out

- [x] official adapter implementation is out of scope
- [x] first-party fetch implementation is out of scope
- [x] new mobile UI work beyond doc-linked compatibility notes is out of scope

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `repo-wide docs` | phase docs and override notes |
| `CI` | dependency scan and guardrail |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `n/a` | Documentation and policy milestone |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M0 - Dependency Audit & Cutover Plan

Ticket naming:

```text
[PH6-M0] What is being built
[PH6-M0][BUG] What is broken
[PH6-M0][SPIKE] What is being investigated
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
- protected-path guard does not fail archived Phase1-Phase5 docs or historical evidence
- golden fixtures or deterministic test data where appropriate

---

## 10. Definition of Done

- [x] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied
- [x] Smoke test executed in full and recorded below
- [x] CI passes locally
- [x] Deprecated dependency check passes
- [x] Rollback path confirmed
- [x] Owner signs off
- [x] Engineering Lead countersigns

---

## 11. Smoke Test Log

Run the milestone smoke test from `ph6_MILESTONES.md` and record the result here.

```text
Date: 2026-04-17
Run by: Codex
Environment: Windows PowerShell, local repo `C:\BOTS\Thesis\fintech`
Result: PASS

Step 1: Run the dependency scan - PASS (`corepack pnpm run phase6:m0:inventory`)
Step 2: Confirm all known protected-path deprecated provider references are surfaced - PASS (70 baseline findings)
Step 3: Add a temporary forbidden import in test mode - PASS (`corepack pnpm run phase6:m0:self-test`)
Step 4: Confirm the guard fails - PASS (self-test detected temporary `yfinance` import)
Step 5: Remove the temporary import and confirm the guard passes - PASS (`corepack pnpm run phase6:m0:guard`)
Step 6: Confirm archived historical docs/evidence do not fail the guard by themselves - PASS (guard scope only scans protected active paths)
Step 7: Confirm `PH6_DECISION_LOCKS.md` is linked and current - PASS

Steps failed (if any): None in final serial run.
Notes: A parallel local run of self-test and guard correctly produced a temporary race because the guard saw the self-test fixture while it existed. CI runs the guard serially, and the final serial guard passed with 70 known baseline findings and 0 new protected-path findings.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Official/public substrate lock | Core Phase 6 truth moves to official/public sources; deprecated providers cannot be required by protected production paths | `ph6_ADR-001_official_data_substrate.md` |
| Protected-path dependency guard | Baseline-tracked guard protects active code while archived docs remain allowed history | `ph6_ADR-002_deprecated_dependency_guard.md` |
| Rights-first context | Evidence and first-party context require rights/provenance metadata before user display | `ph6_ADR-003_rights_first_evidence.md` |
| Macro Stress transition | Active Fear & Greed behavior is replaced by official-source Macro Stress | `ph6_ADR-004_macro_stress_replaces_fear_greed.md` |
| Earnings state model | Earnings uses estimated / confirmed / actual timing and rights-safe call artifacts | `ph6_ADR-005_earnings_state_and_call_artifacts.md` |
| Omission truth | Unsupported dimensions are omitted explicitly; no silent fallback to deprecated providers | `ph6_ADR-006_final_cutover_and_omission_truth.md` |
| Test hardening | Date-sensitive Product API tests were made deterministic for current-date execution | No new ADR |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Deprecated provider findings remain in baseline | M0 inventories and guards them; later M1-M5 remove or replace them by surface | n/a | M1-M5 |
