# AGENTS.md - Phase 6 M5 Deep Dive / Scenario Final Cutover & Hardening
**Milestone:** M5 - Deep Dive / Scenario Final Cutover & Hardening  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M5/M5_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M5 - Deep Dive / Scenario Final Cutover & Hardening |
| **Linear Project** | PH6 M5 - Deep Dive / Scenario Final Cutover & Hardening |
| **Owner** | Engineering Lead + Product Lead |
| **Status** | Closed - owner approved; Engineering Lead accepted by owner delegation on 2026-04-23 |
| **Depends on** | M4 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Finish the provider-free Deep Dive and Scenario migration, then prove the product still works end to end.

---

## 2. Scope - What Is In

- [x] Deep Dive cutover to official + first-party substrate
- [x] scenario / valuation input model without beta dependency
- [x] compatibility layer for older reports
- [x] end-to-end smoke proof
- [x] rollback rehearsal and final dependency proof

---

## 3. Scope - What Is Out

- [ ] new premium data contracts
- [ ] licensed quote re-entry
- [ ] post-phase backlog experiments

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `dexter-worker` | Phase 6 Deep Dive and scenario logic |
| `product-api` | read/write compatibility and end-to-end orchestration |
| `mobile` | omission and provenance-safe rendering |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `AnalysisReport` | Phase 6-compatible read model |
| `scenario payloads` | explicit omission semantics |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- Missing or deprecated-provider-derived fields must be explicit, never silently backfilled.
- Rights-bearing content must not become user-visible without the required metadata.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M5 - Deep Dive / Scenario Final Cutover & Hardening

Ticket naming:

```text
[PH6-M5] What is being built
[PH6-M5][BUG] What is broken
[PH6-M5][SPIKE] What is being investigated
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

---

## 10. Definition of Done

- [x] Acceptance criteria in `ph6_MILESTONES.md` for this milestone are satisfied locally
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
Date: 2026-04-18
Run by: Codex
Environment: local Windows workspace, in-memory Product API test store, internal OpenBB mock, root monorepo quality gates
Result: PASS

Step 1: Run Deep Dives for 3 names
Result: PASS - `ph6-m5-cutover.test.ts` runs AAPL/MSFT/TSLA through queue -> claim -> complete lifecycle.
Step 2: Confirm reports validate without deprecated providers
Result: PASS - legacy-schema reports remain readable via `/reports/:id`, with no deprecated-provider dependency in the M5 core loop.
Step 3: Run a scenario with one omitted market-derived dimension
Result: PASS - scenario run returns deterministic Phase 6 output with beta/correlation dimensions omitted.
Step 4: Confirm omission is explicit
Result: PASS - payload includes `deterministic_model` plus omission codes (`market_beta_omitted`, `legacy_beta_ignored`, `spot_reference_unavailable`).
Step 5: Run the final dependency scan and confirm clean pass
Result: PASS - `corepack pnpm phase6:m5:dependency-scan` returns `0 deprecated provider findings`.

Steps failed (if any): None.
Notes: Evidence captured in `evidence/2026-04-18_m5-deep-dive-scenario-cutover-smoke.md`.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Scenario deterministic model marker | `ScenarioResponse` now returns `deterministic_model: "phase6_deterministic_v1"` so mobile/API consumers can render model truth explicitly | No, covered by ADR-006 and M5 acceptance |
| Beta/correlation handling | Scenario and deterministic DCF assumptions remove beta dependency and publish omission semantics instead of implicit backfill | No, covered by ADR-006 |
| Legacy compatibility contract | Older stored reports remain readable while scenario responses normalize away legacy beta fields | No, additive contract extension |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Hosted GitHub CI run | Final hosted CI proof will occur on the next push; owner approved local closeout without treating hosted CI as a blocker | N/A per owner Linear skip pattern | Post-closeout hygiene |

---

## 14. Closeout Sign-Off

| Role | Status | Evidence |
|---|---|---|
| Owner | Accepted | Owner approval message on 2026-04-23 closed remaining Phase 6 closeout items |
| Engineering Lead | Accepted by owner delegation | Owner approval message on 2026-04-23 closed remaining Phase 6 closeout items |
