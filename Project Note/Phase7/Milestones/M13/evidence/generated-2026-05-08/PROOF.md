# Phase 7 M13 Proof - Generated 2026-05-08

## Artifacts

- `deep-dive-m13-msft.pdf`
- `deep-dive-m13-msft.html`
- `deep-dive-m13-msft.report.json`

## What The Sample Proves

- `financial_indicators.prompt_version` is `ph7-m13-financial-indicators-v2`.
- `price_reference` is present for the supported-price fixture.
- benchmark rows render into the dedicated `Benchmarks and Quality` page.
- investor education boxes render into the dedicated `Investor Education` page.
- the generated export now uses 17 pages so value-lens content does not collide with PDF footers.
- ROIC is calculated when operating income, tax rate, debt, cash, and equity are available.
- the MSFT fixture records `insufficient_ttm_quarters` because only three quarterly snapshots are available; this proves annual fallback and omission truth.
- dedicated Dexter calculator tests prove the true four-quarter TTM path and weak/cheap `value_trap_risk` case.

## Validation Commands

```powershell
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api exec tsc -p tsconfig.json
corepack pnpm --filter @thesis/product-api exec node --test dist/apps/product-api/tests/deepdive-m5-pdf-export.test.js
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm run phase6:m0:guard
node "Project Note/Phase7/Milestones/M13/evidence/generate-deep-dive-m13-sample.cjs"
```

## Result

- contracts: pass
- dexter-worker: pass, 58 tests
- product-api focused export: pass, 3 tests
- typecheck: pass
- lint: pass
- Phase 6 dependency guard: pass
