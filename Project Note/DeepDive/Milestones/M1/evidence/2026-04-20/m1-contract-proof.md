# M1 Contract Proof - 2026-04-20

**Milestone:** M1 - Structured Report Contract
**Decision Lock:** D12 (`AnalysisReport` additive fields)
**Result:** PASS

---

## Scope Proven

- Additive `AnalysisReport` contract path is locked and documented.
- Structured Deep Dive additive fields are validated in contracts, Product API, and Dexter worker.
- Legacy report payloads remain valid.
- Fixture categories required by M1 are covered:
  - full
  - partial
  - sparse
  - degraded
  - no-prior-thesis
  - legacy
- Template-area representation (section or explicit omission) is enforced in Product API fixture tests.

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

All commands passed locally.

---

## Files Added Or Updated For M1

- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/tests/analysis-report.test.ts`
- `apps/product-api/tests/deepdive-m1-contract.test.ts`
- `apps/dexter-worker/tests/m1-contract-schema.test.ts`
- `apps/dexter-worker/package.json`
- `Project Note/DeepDive/DeepDive_DECISION_LOCKS.md`
- `Project Note/DeepDive/Milestones/M1/M1_MILESTONE_AGENTS_deepdive.md`
- `Project Note/DeepDive/Milestones/M1/M1_SMOKE_PLAN_deepdive.md`
- `Project Note/DeepDive/DeepDive_MILESTONES.md`
- `Project Note/DeepDive/DeepDive_ACCEPTANCE.md`

---

## Rollback Note

If M1 is rolled back, keep legacy `AnalysisReport` fields active and ignore additive fields at consumers.
