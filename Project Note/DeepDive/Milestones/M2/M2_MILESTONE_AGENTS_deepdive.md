# M2 AGENTS - Financial Analysis Engine

**Milestone:** Deep Dive Revamp M2 - Financial Analysis Engine
**Status:** Closed
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Dexter Engineer + Data Engineer |
| Depends on | M1 closed |
| Services | `apps/dexter-worker`, `packages/contracts`, possibly `apps/product-api` retrieval support |
| Contracts | Financial tables, metrics, omissions |

---

## Scope

- [x] Build 5-year financial table generation
- [x] Compute trend metrics
- [x] Compute quality metrics
- [x] Produce deterministic omissions
- [x] Add complete/partial/sparse tests
- [x] Prove financial exhibits required by the report template are populated or honestly omitted

## Out Of Scope

- Piotroski interpretation
- LLM authoring upgrade
- PDF layout
- Mobile redesign

## Required Tests

- [x] Unit tests for metric math
- [x] Sparse-data omission tests
- [x] Dexter report generation tests
- [x] Existing Deep Dive job lifecycle regression
- [x] M2 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] Metrics are deterministic
- [x] Missing inputs are explicit
- [x] No fake values appear in generated artifacts
- [x] Financial sections satisfy `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Smoke plan passes

## Decisions Applied

- Peer-comparison dependency is deferred; M2 ships company-history-first with omission-aware output.
- Initial deterministic fixture coverage uses full-data and sparse-data fixture paths currently present in repo.

## Evidence

- `Milestones/M2/evidence/2026-04-20_m2-financial-analysis-proof.md`
