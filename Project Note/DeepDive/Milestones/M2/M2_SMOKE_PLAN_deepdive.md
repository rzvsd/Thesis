# M2 Smoke Plan - Financial Analysis Engine

**Milestone:** M2 - Financial Analysis Engine
**Status:** Passed

---

## Smoke Steps

1. Run financial metric unit tests.
2. Generate complete fixture report.
3. Confirm 5-year table exists where data exists.
4. Generate sparse fixture report.
5. Confirm omissions replace missing metrics.
6. Run Deep Dive job lifecycle regression.
7. Confirm all financial outputs satisfy the M2 rows in `DEEPDIVE_TEST_MATRIX.md`.

---

## Evidence Required

- Metric test output
- Generated report artifact sample
- Omission list sample
- Regression result
- Financial input provenance checklist

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Passed | `corepack pnpm --filter @thesis/dexter-worker test` | Includes `m2-comparisons` deterministic metric tests |
| 2 | Passed | `corepack pnpm --filter @thesis/dexter-worker test` | Fixture report generation path validated |
| 3 | Passed | `apps/dexter-worker/tests/pipeline.test.ts` | `financial_analysis.annual_history` asserted in full fixture |
| 4 | Passed | `apps/dexter-worker/tests/m2-comparisons.test.ts` | Sparse fixture emits omissions, no fake values |
| 5 | Passed | `apps/dexter-worker/tests/pipeline.test.ts` | Omission records explicitly asserted |
| 6 | Passed | `corepack pnpm --filter @thesis/product-api test` | Deep Dive lifecycle regression remained green |
| 7 | Passed | `Milestones/M2/evidence/2026-04-20_m2-financial-analysis-proof.md` | M2 hard-gate alignment recorded |
