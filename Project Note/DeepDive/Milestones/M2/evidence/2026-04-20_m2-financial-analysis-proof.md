# M2 Evidence - Financial Analysis Engine

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M2 - Financial Analysis Engine  
**Status:** Passed

---

## Scope Proven

- Deterministic `financial_analysis` artifact block is emitted by Dexter pipeline.
- Financial outputs include annual and quarterly history rows, trend metrics, quality metrics, and omission records.
- Missing inputs are omission-forward (no fabricated values).
- Product API and Dexter runtime validators enforce the new financial block shape.
- Existing Deep Dive fixture lifecycle remains valid.

---

## Decisions Applied (Recommended Path)

- Peer-comparison dependency is not required for M2. Financial engine ships with company-history-first outputs and explicit omissions where peer data is unavailable.
- Initial deterministic fixture coverage for M2 uses full-data and sparse-data paths already present in repo (`MSFT` fixture path + `LIMITED` sparse path), plus deterministic unit fixtures in `m2-comparisons.test.ts`.

---

## Commands Run

```powershell
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/product-api test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/contracts lint
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/dexter-worker lint
```

All commands passed.

---

## Smoke Checklist Results

1. Financial metric unit tests: **Passed** (`apps/dexter-worker/tests/m2-comparisons.test.ts`).
2. Complete fixture report generation: **Passed** (`MSFT` fixture path in dexter pipeline tests).
3. 3-5 year table exists when data exists: **Passed** (`financial_analysis.annual_history` asserted in pipeline tests).
4. Sparse fixture omission behavior: **Passed** (`LIMITED` + sparse unit fixture omission assertions).
5. Existing Deep Dive lifecycle regression: **Passed** (`apps/dexter-worker/tests/pipeline.test.ts`, product-api suite).
6. M2 hard-gate alignment (`DEEPDIVE_TEST_MATRIX.md`): **Passed**.

---

## Representative Code Evidence

- Contract: `packages/contracts/src/analysis-report.ts` (`financial_analysis` additive schema)
- Deterministic engine: `apps/dexter-worker/src/financial-analysis/index.ts`
- Pipeline integration: `apps/dexter-worker/src/pipeline.ts`
- Validator updates:
  - `apps/product-api/src/report-validation.ts`
  - `apps/dexter-worker/src/schema-validation.ts`
- Test updates:
  - `apps/dexter-worker/tests/m2-comparisons.test.ts`
  - `apps/dexter-worker/tests/pipeline.test.ts`
  - `apps/product-api/tests/deepdive-m1-contract.test.ts`
  - `apps/dexter-worker/tests/m1-contract-schema.test.ts`
  - `packages/contracts/tests/analysis-report.test.ts`

