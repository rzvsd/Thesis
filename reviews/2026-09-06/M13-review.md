# Phase 7 M13 review

## Scope

Reviewed the active M13 brief, evidence README and generated MSFT proof, current uncommitted financial-indicator calculator/contracts/validators, Deep Dive HTML/PDF page assembly, focused Dexter and Product API export tests, and recorded typecheck/lint/dependency evidence. M13 is the active Phase 7 milestone, so current working-tree changes were included.

## Findings

### P2 — “True TTM” is calculated from the latest four rows without continuity checks

**Location:** `apps/dexter-worker/src/financial-indicators.ts:117-126, 677-683`

**Trigger:** Provide quarterly snapshots with four or more rows but a missing quarter, for example 2026-Q1, 2025-Q3, 2025-Q2, and 2025-Q1. `sortQuarterlyDesc` sorts by fiscal year/quarter, then `buildTtmMetricSnapshot` blindly takes `quartersDesc.slice(0, 4)` and sums them.

**Impact:** Flow metrics are labeled TTM and the calculation basis says “latest four quarterly snapshots,” but the sum can span five or more quarters while omitting a quarter. The report can therefore present a non-contiguous period as trailing twelve months; no `insufficient_ttm_quarters` omission is emitted because four rows exist. This directly weakens the M13 requirement that true TTM metrics use the latest four quarters and that missing TTM coverage degrade with omission truth.

**Evidence:** The implementation checks only `lastFour.length < 4`; it never verifies consecutive fiscal quarters or duplicate periods. The recorded proof covers a three-quarter annual fallback and the focused test covers four consecutive quarters, but neither covers a gap or duplicate period.

## P1/P3 review

No P1 or separate P3 defect was established. Price-dependent ratios carry a typed `price_reference` and the live no-provider-provenance case records `price_provenance_incomplete`; the export renders that provenance/omission state. The benchmark renderer labels values as reviewed context bands rather than peer-perfect medians, and the generated export includes the financial-indicator, benchmark, trend, and education pages.

## Validation reviewed/run

Reviewed `Project Note/Phase7/Milestones/M13/evidence/generated-2026-05-08/PROOF.md`: contracts passed; Dexter worker passed 58 tests; Product API focused export passed 3 tests; typecheck, lint, and the Phase 6 dependency guard passed; and the generated MSFT HTML/PDF/report JSON were recorded. Reviewed the current tests proving four-quarter TTM, annual fallback with insufficient quarters, value-trap classification, benchmark/education presence, provenance, and 17-page export ordering. I did not rerun tests, add tests, or modify source files.

## Gaps

There is no current regression case for a missing middle quarter, duplicate period, out-of-order quarters, missing price provenance in the export, or a no-price value-trap export. The generated MSFT sample only proves the three-quarter annual fallback, not continuity validation for the four-quarter path.

## Verdict

**M13 is conditionally validated.** The contract, calculator, provenance fields, benchmark/education content, omission-forward fallback, and export pages are present and evidenced. The TTM calculator should reject non-contiguous or duplicate quarter sets and emit the existing insufficient-TTM omission before the milestone is treated as fully correct.
