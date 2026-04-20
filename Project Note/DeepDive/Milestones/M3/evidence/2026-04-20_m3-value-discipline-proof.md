# M3 Evidence - Value Discipline Scorecard

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M3 - Value Discipline Scorecard  
**Status:** Passed

---

## Scope Proven

- `value_discipline` is implemented as an additive typed report artifact in `AnalysisReport`.
- Score output is deterministic and omission-aware:
  - only available signals are counted
  - missing signals are explicit
  - unavailable inputs do not inflate score
- Context interpretation is emitted from explicit labels (`quality_mega_cap`, `value_cyclical`, `distressed`, `financial`, `sparse_data`, `general`).
- Value-trap warning is emitted as a structured block when conditions indicate cheapness with weak quality/freshness support.
- The scorecard includes explicit "what this does not prove" language.
- Product API and Dexter runtime validators reject malformed M3 payloads.

---

## Commands Run

```powershell
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api test
corepack pnpm --filter @thesis/contracts lint
corepack pnpm --filter @thesis/dexter-worker lint
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/contracts --if-present typecheck
corepack pnpm --filter @thesis/dexter-worker --if-present typecheck
corepack pnpm --filter @thesis/product-api --if-present typecheck
```

All commands passed locally.

---

## Smoke Checklist Results

1. Scorecard unit tests: **Passed** (`apps/dexter-worker/tests/m3-value-discipline.test.ts`).
2. Quality-style fixture behavior: **Passed** (deterministic unit fixture assertions).
3. Value-style fixture behavior: **Passed** (deterministic unit fixture assertions).
4. Sparse fixture behavior: **Passed** (explicit missing signals and insufficient-data handling).
5. Context and interpretation correctness: **Passed** (context labels and interpretation assertions).
6. No overstatement + template alignment: **Passed** (`does_not_prove` present and schema/runtime tests green).

---

## Representative Code Evidence

- Contract and schema:
  - `packages/contracts/src/analysis-report.ts`
- Deterministic scorecard engine:
  - `apps/dexter-worker/src/value-discipline/index.ts`
- Pipeline integration + derived section:
  - `apps/dexter-worker/src/pipeline.ts`
  - `apps/dexter-worker/src/sections.ts`
- Runtime validation:
  - `apps/product-api/src/report-validation.ts`
  - `apps/dexter-worker/src/schema-validation.ts`
- Tests:
  - `apps/dexter-worker/tests/m3-value-discipline.test.ts`
  - `apps/dexter-worker/tests/pipeline.test.ts`
  - `apps/dexter-worker/tests/m1-contract-schema.test.ts`
  - `apps/product-api/tests/deepdive-m1-contract.test.ts`
  - `packages/contracts/tests/analysis-report.test.ts`

---

## Notes

- Existing integration fixtures used by pipeline tests currently remain sparse on some annual inputs; this is expected and does not block M3 because dedicated deterministic M3 fixtures explicitly cover quality/value/distressed contexts and sparse degradation behavior.
