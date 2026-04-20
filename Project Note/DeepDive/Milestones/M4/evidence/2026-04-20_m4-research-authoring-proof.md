# M4 Evidence - Research Authoring Engine

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M4 - Research Authoring Engine  
**Status:** Passed

---

## Scope Proven

- Dexter now emits a typed `investment_memo` artifact block with structured memo sections.
- Material claims are explicitly supported by typed refs (`metric`, `evidence`, `omission`) instead of unsourced narrative assertions.
- Memo content is company-specific across `AAPL`, `MSFT`, and `TSLA` fixtures.
- Sparse-data fixture path remains omission-forward and honest instead of fabricating precision.
- Product API, contracts, and Dexter validators enforce the M4 additive schema.

---

## Decisions Applied (Recommended Path)

- Keep `investment_memo` additive and backward-compatible with existing report readers.
- Lock memo authoring to deterministic fact outputs already produced by M1-M3 blocks.
- Use local prompt manifest proof for M4 (`m4-synthesizer-fixture-v1`) while remote LangSmith registration remains credential-dependent.
- Enforce anti-generic behavior via tests that assert company-angle differentiation and claim-support integrity.

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

1. AAPL/MSFT/TSLA memo generation: **Passed** (`apps/dexter-worker/tests/m4-authoring.test.ts`).
2. Sparse fixture omission-forward narrative: **Passed** (`apps/dexter-worker/tests/m4-authoring.test.ts`).
3. Material-claim support mapping: **Passed** (`apps/dexter-worker/tests/m4-authoring.test.ts`, schema validators).
4. Generic memo rejection gate: **Passed** (cross-ticker differentiation assertions in `m4-authoring` tests).
5. M4 hard-gate alignment (`DEEPDIVE_TEST_MATRIX.md`): **Passed**.

---

## Representative Code Evidence

- Contract update: `packages/contracts/src/analysis-report.ts`
- Contract tests: `packages/contracts/tests/analysis-report.test.ts`
- Product API validation: `apps/product-api/src/report-validation.ts`
- Product API tests: `apps/product-api/tests/deepdive-m1-contract.test.ts`
- Dexter pipeline authoring: `apps/dexter-worker/src/pipeline.ts`
- Dexter runtime validation: `apps/dexter-worker/src/schema-validation.ts`
- Dexter tests:
  - `apps/dexter-worker/tests/m4-authoring.test.ts`
  - `apps/dexter-worker/tests/pipeline.test.ts`
  - `apps/dexter-worker/tests/m1-contract-schema.test.ts`
- Prompt manifest proof: `data/golden/dexter-worker/prompts.json`
