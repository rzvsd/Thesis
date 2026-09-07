# Phase 7 M12 Review

## Scope and current-state note

Reviewed the M12 brief/evidence, the current Dexter financial-indicator calculator and pipeline wiring, financial-indicator tests, M12 generated report, and M13's typed price provenance and true-TTM requirements. M13 extends M12 rather than removing it, so the calculator remains the active source for the Deep Dive value lens.

## Findings

### P1 — Live pipeline fabricates price provenance while still computing price-dependent valuation

**Location:** `apps/dexter-worker/src/pipeline.ts:3491-3500`; `apps/dexter-worker/src/financial-indicators.ts:153-165`, `:1050-1051`, `:1102-1105`

**Trigger:** Generate a non-fixture Deep Dive with a positive `m2Context.spotPrice` but no upstream `priceReference`. The pipeline passes the numeric price only. `defaultPriceReference` labels it as an approved close with generated date and synthetic source text, then the calculator computes market cap, P/E, P/S, P/B, EV/EBITDA, and FCF yield. It adds a provenance omission only after creating the fabricated reference.

**Impact:** M12's price-source discipline and M13's typed provenance requirement are bypassed: a live report can show valuation ratios backed by a made-up source/kind/date instead of omitting them until an approved reference is present. The output may look provenance-complete to the renderer while its only real input is an unlabeled number.

**Evidence:** M13 requires price-dependent ratios to carry `price_reference` or explicit price/provenance omission truth. The M12 generated report uses fixture mode, so its valid fixture price does not exercise this live path. No test covers positive live `spotPrice` without `priceReference`.

### P1 — Non-consecutive quarters are accepted as a true TTM

**Location:** `apps/dexter-worker/src/financial-indicators.ts:677-685`

**Trigger:** Supply four quarterly snapshots with a missing quarter, such as 2025-Q4, 2025-Q3, 2025-Q1, and 2024-Q4. `buildTtmMetricSnapshot` takes `quartersDesc.slice(0, 4)` and sums them without checking that the four fiscal quarters are consecutive.

**Impact:** Flow metrics, margins, cash conversion, and classification can be calculated from a 15-month or otherwise discontinuous set while the output claims TTM. M13 explicitly requires the latest four quarterly snapshots on a TTM basis and omission/fallback truth when history is incomplete; this implementation can silently produce a false TTM.

**Evidence:** Existing test coverage proves only the happy path with four quarters (`apps/dexter-worker/tests/financial-indicators.test.ts:147-185`). No gap/duplicate-quarter case exists. The M12/M13 evidence reports do not prove discontinuous-history handling.

### P2 — Valuation ratios are emitted for invalid or economically meaningless denominators

**Location:** `apps/dexter-worker/src/financial-indicators.ts:262-276`, `:306-317`, and `:70-75`

**Trigger:** Provide negative EPS or EBITDA with a valid positive price/enterprise value. `safeDivide` rejects only non-finite values and zero; it returns negative P/E or EV/EBITDA even though the P/E spec says it requires positive EPS and EV/EBITDA is not meaningful with non-positive EBITDA.

**Impact:** The report can label a loss-making or negative-EBITDA company with ordinary multiple interpretations and feed those values into value classification/benchmarks. That conflicts with M12's omission-forward denominator rule and can materially misstate whether the company is cheap or expensive.

**Evidence:** No test covers negative EPS, negative EBITDA, negative revenue, or negative book equity. The existing denominator test only verifies missing/zero values (`financial-indicators.test.ts:133-145`).

## Validation reviewed

- M12 evidence requires contract validation, calculator proof, missing-price omission proof, export proof, and provider guard; the generated MSFT artifact is fixture-backed.
- Existing calculator tests cover available-price metrics, missing-price omission, missing denominators, four-quarter happy-path TTM, and a weak/cheap value-trap fixture.
- M13 evidence/brief locks reviewed: typed price provenance, true four-quarter TTM, benchmark/education output, and explicit missing-price behavior.

## Gaps

- No live pipeline test asserts that an unlabeled spot price is omitted or rejected until typed provenance exists.
- No quarterly-gap, duplicate-period, or out-of-order TTM test exists.
- No negative-denominator valuation tests exist.
- Fixture PDF/HTML and report JSON prove rendering and happy-path calculation, not these boundary cases.

## Verdict

**M12 is not clean for production sign-off.** The value-lens surface and fixture calculations are present, but live price provenance can be fabricated, incomplete quarterly history can be mislabeled as TTM, and invalid valuation denominators can produce misleading multiples. Fix the provenance and TTM boundaries first; then add negative-denominator omission handling before relying on the M12/M13 value classification in customer reports.
