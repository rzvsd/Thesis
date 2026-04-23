# M6 Evidence

Store structural-context adapter proof, issuer-metadata proof, Deep Dive and Morning Exception Briefing enrichment proof, replay artifacts, evaluation artifacts, debate experiment proof, and dependency-scan proof for Phase 6 M6 here.

Required evidence targets:

- World Bank adapter proof
- IMF partial-or-full readiness proof
- Deep Dive enriched-output proof
- Morning Exception Briefing enriched-output proof
- replay artifact proof
- evaluation harness proof
- debate experiment proof
- dependency-scan proof showing DBnomics stayed internal-only

Latest end-to-end smoke:

- `2026-04-23_m6_end_to_end_smoke.md`
- bundle: `m6-e2e-20260423T113852Z/`

Current local proof commands:

- `python -m unittest apps.data-openbb.tests.test_service` with `PYTHONPATH=apps/data-openbb`
- `pnpm --filter @thesis/contracts test -- --runInBand analysis-report`
- `pnpm --filter @thesis/product-api build`
- `node --test --test-concurrency=1 apps/product-api/dist/apps/product-api/tests/deepdive-m1-contract.test.js`
- `node --test --test-concurrency=1 apps/product-api/dist/apps/product-api/tests/market-pulse.test.js`
- `node --test --test-concurrency=1 apps/product-api/dist/apps/product-api/tests/ph5-m3-morning-briefing.test.js`
- `node --test --test-concurrency=1 apps/product-api/dist/apps/product-api/tests/ph6-m6-research-lab.test.js`
- `pnpm --filter @thesis/dexter-worker test -- --runInBand`
- `pnpm phase6:m5:dependency-scan`

Implemented proof surfaces:

- `apps/data-openbb/src/server.py` + `apps/data-openbb/src/service.py` now accept replay-safe `as_of` for official macro and structural context
- `apps/product-api/src/server.ts` replays issuer structural context against `report.generated_at`
- `apps/product-api/src/market-pulse.ts` replays official macro and structural context against the requested pulse date
- `apps/product-api/src/research-lab.ts` builds internal-only replay, evaluation, and debate artifacts
- `apps/product-api/tests/ph6-m6-research-lab.test.ts` proves:
  - Deep Dive replay keeps structural context pinned to `as_of`
  - Morning Exception Briefing replay keeps structural context and Macro Stress pinned to `as_of`
  - evaluation emits a scored artifact
  - debate remains internal-only with publish blocked
