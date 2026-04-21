# M1 AGENTS - Structured Report Contract

**Milestone:** Deep Dive Revamp M1 - Structured Report Contract
**Status:** Completed (2026-04-20)
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Contracts Owner + Product API Engineer + Dexter Engineer |
| Depends on | M0 closed |
| Services | `packages/contracts`, `apps/product-api`, `apps/dexter-worker`, Android model fallback if needed |
| Contracts | `AnalysisReport` additive fields (Decision D12) |

---

## Scope

- [x] Lock exact contract shape
- [x] Add typed sections for memo, financials, value score, valuation, risks, evidence, appendix
- [x] Add JSON schema/runtime validation
- [x] Add full, sparse, and legacy fixtures
- [x] Map every required report-template section to typed fields or explicit omission fields
- [x] Keep old reports readable

## Out Of Scope

- Full financial engine math
- PDF rendering
- Mobile redesign beyond fallback compatibility

## Required Tests

- Contract build/typecheck
- Product API validation tests
- Dexter schema validation tests
- Legacy report deserialize test
- Template coverage test from `DEEPDIVE_REPORT_TEMPLATE.md`

## Definition Of Done

- [x] All acceptance criteria in `DeepDive_MILESTONES.md -> M1` pass
- [x] Smoke plan passes
- [x] Contract names are documented in evidence
- [x] `DEEPDIVE_TEST_MATRIX.md` M1 gates pass
- [x] Rollback path is documented
