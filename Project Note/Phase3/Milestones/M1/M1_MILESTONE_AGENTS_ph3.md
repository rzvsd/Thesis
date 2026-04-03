# AGENTS.md - Phase 3 M1 Intelligence Trust and Deep Dive Credibility
**Milestone:** Phase 3 M1 - Intelligence Trust and Deep Dive Credibility  
**Inherits from:** Root `AGENTS.md`, `Project Note/Phase2/ph2_AGENTS.md`, then `Project Note/Phase3/ph3_AGENTS.md` - read all first.  
**Location:** `Project Note/Phase3/Milestones/M1/M1_MILESTONE_AGENTS_ph3.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 3 M1 - Intelligence Trust and Deep Dive Credibility |
| **Linear Project** | Phase 3 M1 - Intelligence Trust and Deep Dive Credibility |
| **Owner** | Reasoning Engineer + Product API Engineer + Mobile Engineer + Product Lead |
| **Status** | Completed |
| **Depends on** | Phase 2 M2, M7, and M9 closed; current Deep Dive flow operational |

---

## Gated Pre-Conditions

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Report quality rubric is fixed: blocking checks are generic synthesis, quote provenance, valuation honesty, missing-data honesty, and contradiction honesty; all must pass for closeout | RESOLVED | Product Lead + Reasoning Lead | Milestone start |
| G2 | Trust metadata contract strategy is fixed: add a backward-compatible nested `trust_metadata` object to the report payload rather than breaking stored reports | RESOLVED | Product API Engineer + Mobile Engineer | Milestone start |
| G3 | Thesis-drift comparison rule is fixed: comparable means same ticker, latest completed report, same major schema family, within a 120-day lookback window | RESOLVED | Product Lead + Reasoning Lead | Milestone start |
| G4 | Mobile trust presentation standard is fixed: freshness state, evidence count, contradiction state, and valuation state must be visible above the first fold; provenance details may be expandable | RESOLVED | Product Lead + Mobile Engineer | Milestone start |

**Rule:** M1 does not close on subjective "looks smarter" feedback. It closes on visible trust behaviors, the resolved rubric above, and evaluation proof.

---

## 1. What This Milestone Is Building

M1 upgrades Deep Dive from a structured report into an accountable research artifact.

This milestone adds:

- trust metadata
- quote provenance
- thesis-drift summaries
- contradiction handling
- valuation guardrails
- a repeatable quality evaluation pack

**Plain English summary for non-technical audit:**  
M1 makes the report explain not only what it thinks, but why it thinks it, how fresh that thinking is, and what might be weak or unresolved.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/PRD.md`
- `Project Note/Phase1/BLUEBOOK cld.md`
- `Project Note/Phase1/MILESTONES.md` (M5 Deep Dive, M9 hardening)

### Phase 2 docs

- `Project Note/Phase2/ph2_PRD.md` (Deep Dive v2)
- `Project Note/Phase2/ph2_BLUEBOOK.md`
- `Project Note/Phase2/ph2_MILESTONES.md` (M2, M7, M9)
- `Project Note/Phase2/Milestones/M2/M2_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M7/M7_MILESTONE_AGENTS_ph2.md`

### Phase 3 docs

- `Project Note/Phase3/ph3_AGENTS.md`
- `Project Note/Phase3/ph3_PRD.md`
- `Project Note/Phase3/ph3_BLUEBOOK.md`
- `Project Note/Phase3/ph3_MILESTONES.md`
- `Project Note/Phase3/Milestones/M1/M1_SMOKE_PLAN_ph3.md`

### Current code surfaces

- `apps/dexter-worker/src/`
- `apps/product-api/src/server.ts`
- `packages/contracts/src/`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/data/`

---

## 3. Scope - What Is In

- [x] Trust metadata on Deep Dive outputs
- [x] Quote provenance and evidence-depth visibility
- [x] Thesis-drift summary when a comparable prior report exists
- [x] Contradiction/conflict surfacing
- [x] Valuation guardrail behavior and trust presentation
- [x] Quality evaluation pack and pass thresholds
- [x] Mobile trust rendering for the report experience

Full acceptance source: `Project Note/Phase3/ph3_MILESTONES.md -> M1`

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| New top-level app tabs or navigation changes | M2+ |
| New monetization rules | M3 |
| New notification families | M2 |
| Launch runbooks, load suite, release hardening | M4 |
| Beta cohort operations | M5 |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Dexter worker | `apps/dexter-worker/` | Trust metadata, thesis-drift logic, contradiction handling, evaluation hooks |
| Product API | `apps/product-api/` | Report-serving shape, backward compatibility, possible trust metadata persistence/serving |
| Contracts | `packages/contracts/` | Minimal report schema extension or versioning |
| Mobile | `apps/mobile/` | Trust presentation inside Deep Dive reading experience |
| Observability | `packages/observability/` | Quality events if needed for evaluation visibility |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| `AnalysisReport` or Phase 3-compatible successor | Versioned extension or additive nested object | `packages/contracts/src/` |
| Report section or trust metadata shape | New or additive | `packages/contracts/src/` |

**Rule:** Stored Phase 1 and Phase 2 reports must remain readable unless an explicit migration/versioning plan is approved.

---

## 7. Phase 1 and 2 Wiring Obligations

| Existing System | Built In | Phase 3 M1 Change | Why Here |
|---|---|---|---|
| Deep Dive request and generation path | Phase 1 M5 | Add trust/accountability fields | This is where trust must become visible |
| Historical/valuation report upgrade | Phase 2 M2 | Tighten valuation honesty and thesis-drift behavior | Quality claims already exist here and need proof |
| Interactive report UX | Phase 2 M7 | Surface trust metadata in the actual reading flow | Trust hidden in payloads is worthless |
| Hardening expectations | Phase 2 M9 | Preserve retrieval/reuse and stable rendering | M1 must not destabilize what exists |

---

## 8. Linear Ticket Rules For This Milestone

**Project:** Phase 3 M1 - Intelligence Trust and Deep Dive Credibility

**Naming:**
```
[PH3-M1] What is being built
[PH3-M1][BUG] What is broken
[PH3-M1][SPIKE] What is being investigated
```

| Ticket | Acceptance Mapping |
|---|---|
| `[PH3-M1] Report trust metadata model` | Trust metadata acceptance criteria |
| `[PH3-M1] Quote provenance and contradiction handling` | Quote/contradiction acceptance criteria |
| `[PH3-M1] Thesis-drift summary` | Prior-report comparison acceptance criteria |
| `[PH3-M1] Mobile trust rendering` | UI trust metadata acceptance criteria |
| `[PH3-M1] Quality evaluation pack` | Evaluation-pack acceptance criteria |
| `[PH3-M1] Deep Dive regression closeout` | Existing flow preservation |

Never close a ticket without evidence.

---

## 9. Logging And Observability

| Event | Level | Fields |
|---|---|---|
| Trust metadata generated | INFO | `{ service, report_id, freshness_state, evidence_count, timestamp }` |
| Thesis-drift summary unavailable | WARN | `{ service, report_id, reason, timestamp }` |
| Contradiction surfaced | INFO | `{ service, report_id, contradiction_count, timestamp }` |
| Valuation omitted due to insufficient inputs | WARN | `{ service, report_id, missing_inputs, timestamp }` |
| Evaluation-pack failure | ERROR | `{ service, ticker, rule, timestamp }` |

No secrets, no tokens, no PII.

---

## 10. Testing Requirements

- [x] Integration tests for trust metadata payload shape
- [x] Evaluation-pack script committed and executable
- [x] Real-device verification for trust rendering in the Deep Dive screen
- [x] Existing Deep Dive request/retrieval regression smoke re-run
- [x] `pnpm typecheck` and relevant tests pass

Detailed execution lives in `M1_SMOKE_PLAN_ph3.md`.

---

## 11. Definition Of Done

- [x] All M1 acceptance criteria in `ph3_MILESTONES.md` are satisfied
- [x] Smoke plan executed with evidence
- [x] Quality evaluation pack passes agreed thresholds
- [x] Existing Deep Dive regressions still pass
- [ ] Linear tickets closed or explicitly deferred
- [ ] Product Lead sign-off recorded
- [ ] Engineering Lead countersign recorded

---

## 12. Smoke Test Log

```text
Date: 2026-04-03
Run by: Codex
Environment: Local Product API on :3101 + local Dexter worker on :3102 backed by repo Postgres/Redis; physical Android device R3CXA03J3LH
Result: PASS

Notes:
- API trust proof: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-1.json`
- Comparable thesis-drift proof: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-aapl-2-comparable.json`
- Honest degradation proof: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-report-limited.json`
- Comparable endpoint proof: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/m1-comparable-endpoint.json`
- Evaluation pack artifact: `apps/dexter-worker/eval/artifacts/m1-quality-pack-result.json`
- Device smoke summary/log: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/summary.json`, `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/maestro.log`
- Device screenshot: `Project Note/Phase3/Milestones/M1/evidence/2026-04-03/ph3_m1_pass.png`
```

---

## 13. Known Issues And Deferrals

| Issue | Why Deferred | Linear Ticket | Target Milestone |
|---|---|---|---|
| Phase 3 M1 retrospective issue set could not be created after implementation because the Linear workspace hit its free issue limit | Linear project exists (`Phase 3 M1 — Intelligence Trust and Deep Dive Credibility`), but ticket creation returned `Usage limit exceeded`; do not mark ticket hygiene complete until workspace capacity is available or an alternate owner-approved tracking path is chosen | TBD | Milestone closeout hygiene |

---

## 14. Decisions Made During This Milestone

| Decision | Outcome | ADR Required |
|---|---|---|
| Report quality rubric | Locked to generic-synthesis, quote-provenance, valuation-honesty, missing-data-honesty, and contradiction-honesty blocking checks | No |
| Trust metadata contract strategy | Use additive nested `trust_metadata` object so stored Phase 1/2 reports remain readable | No |
| Thesis-drift comparability rule | Same ticker, latest completed report, same major schema family, within 120-day lookback | No |
| Mobile trust presentation standard | Freshness, evidence count, contradiction state, and valuation state visible above the first fold; provenance details may be expandable | No |
