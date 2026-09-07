# Phase 7 M1 review

Date: 2026-09-06

## Scope and milestone context

Reviewed the Phase 7 M1 brief, M1 milestone instructions, M1 evidence note, the current `data-openbb` market-tape endpoint and FRED adapter, the Pulse report builder/market-tape section, the market-tape contract, focused tests, and the current working tree.

M1 is marked validated in `Project Note/Phase7/ph7_ROADMAP.md`, while the M1 agent note still says “In progress.” M2–M7 subsequently extend the Pulse contract and M8 explicitly replaces the customer-facing newspaper renderer with the Morning Brief. Therefore this review treats the M1 tape data contract/adapter/assembly as current substrate, and does not report retired M1 renderer ordering as a defect. The current renderer path is `pulse-brief-render.ts`, which consumes the M1 tape through `PulseBriefFactPack`.

## Findings

### P2 — Invalid `as_of` query values are silently accepted and converted to today

Location: `apps/data-openbb/src/service.py:3039-3041`, with the fallback at `apps/data-openbb/src/service.py:547-548`.

`_market_tape_response` calls `_normalize_iso_date(as_of)` and receives `None` for malformed dates, but then passes that value into `_resolved_as_of_date`; the latter converts `None` to `today_period()`. Thus `GET /v1/market/tape?scope=daily&as_of=not-a-date`, `2025-02-30`, or `2025/02/14` returns 200 and a payload dated the current day instead of rejecting the invalid replay boundary. This makes a caller believe it received a replay for the requested date when it received a live/current-date result, and can invalidate reproducibility or historical backtests. The same path also accepts a future date and labels the latest available observations with that future `as_of`.

Evidence: a direct fixture-mode call on 2026-09-06 returned `200` and `data.as_of == "2026-09-06"` for all three malformed inputs; `as_of=2099-01-01` returned `200` and `data.as_of == "2099-01-01"`. The existing test only covers a valid date (`apps/data-openbb/tests/test_service.py:300-306`) and has no invalid/future input assertion. Fixing this should preserve the existing valid-date behavior while returning a documented 4xx for malformed or future `as_of` values (or explicitly define a different policy and test it).

## Tests reviewed and run

Reviewed:

- `Project Note/Phase7/Milestones/M1/evidence/2026-04-25_m1_market_tape_local_verification.md`; its listed contract, adapter, Product API build, Pulse assembly, and render checks are recorded as passing.
- `apps/data-openbb/tests/test_service.py`, including the market-tape contract and valid `as_of` coverage.
- `apps/product-api/tests/market-pulse.test.ts` and `apps/product-api/tests/market-pulse-render.test.ts` for tape assembly/status/render coverage.
- `packages/contracts/src/market-tape.ts` and `apps/product-api/src/pulse/market-tape-section.ts`.

Run during this review:

```text
PYTHONPATH=apps/data-openbb python -m unittest apps.data-openbb.tests.test_service
Ran 28 tests ... OK
```

The M1 evidence note honestly records that its historical verification was not a full multi-service end-to-end smoke. I did not rerun the Product API suites while the parent agent was running the shared worker/API checks.

## Gaps and verdict

The evidence gap remains the one called out by the M1 note: no archived full-stack smoke proving the live local stack, endpoint, Pulse generation, HTML/PDF export, and historical replay together. The focused tests also do not cover invalid/future `as_of`, sector omission behavior in live mode, or provider-dependency leakage with a runtime guard.

Verdict: **M1 should remain blocked for a clean validation record until the `as_of` input behavior is made explicit and tested.** The later M8 renderer supersession does not remove this defect because the Morning Brief still consumes the same M1 market-tape payload and replay boundary.
