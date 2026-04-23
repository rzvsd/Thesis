# AGENTS.md - Phase 6 M6 Official Structural Context & Internal Research Lab
**Milestone:** M6 - Official Structural Context & Internal Research Lab  
**Inherits from:** Root `AGENTS.md` and `ph6_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase6/Milestones/M6/M6_MILESTONE_AGENTS_ph6.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M6 - Official Structural Context & Internal Research Lab |
| **Linear Project** | PH6 M6 - Official Structural Context & Internal Research Lab |
| **Owner** | Data Platform Engineer + Product API Owner + Reasoning / ML Engineer + Product Lead |
| **Status** | Closed - owner approved; Engineering Lead accepted by owner delegation on 2026-04-23 |
| **Depends on** | M5 complete |

---

Before implementation, read `PH6_DECISION_LOCKS.md` for locked decisions, contract names, guard scope, and evidence standards.

## 1. What This Milestone Is Building

Add official structural context to Thesis through World Bank-first and IMF-second integration, then add internal-only replay, evaluation, and debate tooling that improves quality without changing the public product identity.

---

## 2. Scope - What Is In

- [x] World Bank structural-context adapter
- [x] IMF structural-context adapter with explicit non-blocking degradation behavior
- [x] structural-context contract layer and issuer metadata expansion
- [x] Deep Dive enrichment for thesis, risk, and growth sections
- [x] Morning Exception Briefing enrichment through existing context sections
- [x] internal historical replay sandbox
- [x] internal agent evaluation harness
- [x] experiment-only internal debate workflow
- [x] dependency and provenance guardrails that keep DBnomics out of protected runtime paths

---

## 3. Scope - What Is Out

- [x] new public macro dashboard
- [x] public backtesting or portfolio simulation
- [x] public AI debate or investor-persona feature
- [x] DBnomics as runtime or user-facing production truth
- [x] Macro Stress category expansion

---

## 4. Services You Are Working In

| Service | What you are doing in it |
|---|---|
| `data-openbb` | World Bank and IMF adapter retrieval, normalization, and omission truth |
| `product-api` | structural-context storage, report/briefing read models, and internal lab orchestration entry points if approved |
| `dexter-worker` | context-aware synthesis that uses structural context without turning reports into macro wallpaper |
| `scheduler` | structural-context refresh cadence and replay/eval trigger orchestration where needed |
| `mobile` | safe additive display of issuer metadata and structural context in existing Deep Dive / briefing surfaces only |

---

## 5. Contracts You Are Touching

| Contract | Change type |
|---|---|
| `OfficialSourceFamily` | additive source-family extension |
| `StructuralContextPack` | new additive contract family |
| `AnalysisReport` | additive `structural_context` and issuer metadata extension |
| `MarketPulseReport` | additive `structural_context` support |

Rules:

- Contract changes must remain additive unless an approved versioned migration exists.
- `MacroStressCategory` must remain unchanged in this milestone.
- Structural context must carry retrieval metadata, source provenance, and omission truth.
- DBnomics must not appear in public contracts, required env paths, or user-facing provenance.

---

## 6. Linear Ticket Rules For This Milestone

**Project:** PH6 M6 - Official Structural Context & Internal Research Lab

Ticket naming:

```text
[PH6-M6] What is being built
[PH6-M6][BUG] What is broken
[PH6-M6][SPIKE] What is being investigated
```

Every ticket must include:

- service touched
- contract touched (if any)
- `ph6_MILESTONES.md` acceptance criterion it satisfies
- whether the work removes, preserves, or audits a deprecated dependency assumption

Never close a ticket without the relevant smoke proof or test evidence.

---

## 7. Logging For This Milestone

Phase 6 logs remain structured JSON.

Minimum additional requirements for this milestone:

- structural-context retrieval failures must log which source family failed and whether the degradation is blocking or non-blocking
- replay/eval/debate runs must log that they are internal-only workflows and never user-facing publish paths
- missing issuer metadata must be logged as omission truth, not hidden fallback behavior

Never log secrets, tokens, or unreviewed full text.

---

## 8. Error Handling For This Milestone

- No empty catch blocks
- World Bank failures must degrade explicitly; IMF failures must never block the required World Bank path
- Historical replay must fail closed on look-ahead leakage risk
- Debate output must not bypass evaluation or publish directly
- DBnomics discovery helpers must never become silent production fallback

---

## 9. Testing Requirements For This Milestone

- contract validation for structural-context payloads and issuer metadata extensions
- Deep Dive and Morning Exception Briefing smoke proof with structural context present
- dependency guard passing with no DBnomics runtime leak
- replay assertions proving no look-ahead leakage
- evaluation harness artifact proof
- debate workflow proof that publish-direct behavior is blocked

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
Date: 2026-04-23
Run by: Codex
Environment: local Windows dev stack with memory/store backends, fixture-mode official/first-party sources, and admin bootstrap login
Result: Pass

Step 1: Start Product API, data-openbb, dexter-worker, and scheduler in local Phase 6 mode.
Result: Pass - local services started successfully; ports and logs recorded in `Project Note/Phase6/Milestones/M6/evidence/m6-e2e-20260423T113852Z/smoke-summary.json`.
Step 2: Request World Bank structural context for the approved seed scope.
Result: Pass - `AAPL` issuer structural context returned 11 World Bank observations.
Step 3: Confirm contract-valid payload, official provenance, and omission states.
Result: Pass - retrieval metadata was present and IMF omission truth recorded 6 non-blocking omissions.
Step 4: Run one Deep Dive for a supported issuer.
Result: Pass - Deep Dive completed end to end through Product API and Dexter for `AAPL`.
Step 5: Confirm structural context appears in due-diligence output and issuer metadata without changing the six-section model.
Result: Pass - six-section due-diligence taxonomy stayed intact; `competitive_positioning`, `growth_opportunities_and_outlook`, and `risks_and_challenges` were enriched; issuer metadata carried currency/country/region/sector/industry.
Step 6: Trigger Morning Exception Briefing in test mode.
Result: Pass - scheduler-triggered pulse path produced a current briefing.
Step 7: Confirm structural context appears in briefing context while Macro Stress shape remains unchanged.
Result: Pass - structural context appeared in `official_macro_pressure` / `bounded_context`; Macro Stress stayed on `rates`, `inflation`, `labor`, `growth`, and `energy`.
Step 8: Remove or disable IMF runtime access.
Result: Pass - local runtime used the current omission-first non-blocking IMF posture rather than a separate toggle flip.
Step 9: Confirm World Bank still works and IMF degrades explicitly without blocking the product path.
Result: Pass - World Bank path remained live while IMF omission truth stayed explicit and non-blocking.
Step 10: Run one historical replay for Deep Dive and one for Morning Exception Briefing.
Result: Pass - replayed Deep Dive and Morning Exception Briefing both ran with `as_of=2025-02-14`.
Step 11: Confirm replay artifacts are produced with no look-ahead leakage.
Result: Pass - replay artifacts were generated and `as_of` stayed pinned across structural context and Macro Stress.
Step 12: Run one evaluation harness pass and one debate experiment.
Result: Pass - replay evaluation and internal debate artifacts were generated from the replayed outputs.
Step 13: Confirm scored artifacts are produced and debate cannot publish directly to the live user path.
Result: Pass - evaluation scored `7/7`; debate artifact returned `publish_blocked=true` and `publish_route=null`.
Step 14: Run the Phase 6 dependency scan.
Result: Pass - `Phase 6 M5 core dependency scan: pass (0 deprecated provider findings).`
Step 15: Confirm DBnomics does not appear in protected runtime paths.
Result: Pass - dependency scan stayed clean and no runtime provenance or protected-path dependency referenced DBnomics.

Steps failed (if any): None
Notes: See `Project Note/Phase6/Milestones/M6/evidence/2026-04-23_m6_end_to_end_smoke.md` and bundle `Project Note/Phase6/Milestones/M6/evidence/m6-e2e-20260423T113852Z/`.
```

---

## 12. Decisions Made During This Milestone

| Decision | What was decided | ADR required? |
|---|---|---|
| Structural context attach point | Product API enriches Deep Dive through the shared `enrichAnalysisReportIssuer(...)` path instead of making Dexter fetch World Bank/IMF directly | No |
| Structural endpoint shape | `data-openbb` serves explicit official structural context through `/v1/official/structural` with replay-safe `as_of` support | No |
| IMF local runtime posture | IMF remains omission-first and non-blocking in the local runtime path; World Bank carries required M6 closeout proof | No |
| Internal research lab surface | Replay, evaluation, and debate stay internal-only in `product-api` with debate publishing blocked | No |

---

## 13. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Hosted GitHub CI run | Final hosted CI proof will occur on the next push; owner approved local closeout without treating hosted CI as a blocker | N/A per owner instruction to skip Linear unless asked | Post-closeout hygiene |

---

## 14. Closeout Sign-Off

| Role | Status | Evidence |
|---|---|---|
| Owner | Accepted | Owner approval message on 2026-04-23 closed remaining Phase 6 closeout items |
| Engineering Lead | Accepted by owner delegation | Owner approval message on 2026-04-23 closed remaining Phase 6 closeout items |
