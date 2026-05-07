# Phase 7 M11 Evidence

Required proof types:

- contract proof for `AnalysisReport.filing_intelligence`
- data-openbb filing text extraction proof
- Dexter filing intelligence pipeline proof
- Deep Dive PDF/HTML render proof
- legacy/sparse export compatibility proof
- typecheck/lint proof
- dependency guard proof

## Initial Proof - 2026-05-04

Commands run locally:

```text
corepack pnpm --filter @thesis/contracts test
PYTHONPATH=apps/data-openbb python -m unittest discover -s apps/data-openbb/tests -p "test_filing_text.py"
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api exec tsc --noEmit -p tsconfig.json
corepack pnpm --filter @thesis/product-api exec tsc -p tsconfig.json
corepack pnpm --filter @thesis/product-api exec node --test dist/apps/product-api/tests/deepdive-m5-pdf-export.test.js
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm run phase6:m0:guard
```

Result:

- contracts passed
- filing text extraction tests passed
- Dexter worker tests passed
- Product API typecheck passed
- Product API Deep Dive PDF/export focused test passed
- data-openbb full unittest suite passed
- full repo typecheck passed
- full repo lint passed
- Phase 6 deprecated dependency guard passed with zero new protected-path findings

Remaining proof before owner closeout:

- optional live LLM smoke with OpenRouter key present
- full Product API package test was attempted but exceeded the local 5-minute command timeout; the M11-touched export path was rebuilt and passed separately
