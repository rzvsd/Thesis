# Phase 7 M13 - Deep Dive Benchmarks & Investor Education

## Summary

M13 upgrades the M12 Deep Dive value lens from a ratio board into an investor education layer. The report should not only say `P/E is 34`; it should explain why that matters, whether the ratio is high or low against a reviewed context band, what the company classification means, and what would make the apparent valuation dangerous.

## Goal

Make Deep Dive teach a smart non-expert how to read company quality, valuation, cash flow, debt, dilution, and value-trap risk without adding trading advice, price targets, paid providers, or terminal behavior.

## Deliverables

| Deliverable | Description |
|---|---|
| Typed price provenance | `financial_indicators.price_reference` records source name, optional URL, retrieval time, price date, currency, price kind, value, and note |
| TTM basis | Flow metrics use the latest four quarterly snapshots when available; balance-sheet ratios use the latest balance sheet |
| Benchmark rows | Reviewed context bands for key ratios such as P/E, P/S, EV/EBITDA, FCF yield, operating margin, ROIC, debt/equity, and cash conversion |
| Education boxes | Plain-English explanations for value classification, value-trap risk, valuation multiples, cash-flow quality, debt risk, and ROIC |
| Expanded indicators | ROIC, interest coverage, current ratio, quick ratio, asset turnover, gross profit/assets, buyback yield, dividend yield, payout ratio, and related omissions |
| Export update | Deep Dive PDF/HTML shows price provenance, benchmarks, and education next to the value lens |
| Proof cases | Supported price, missing price, and weak/cheap value-trap fixtures |

## Acceptance Criteria

- `AnalysisReport.financial_indicators` remains additive and backwards compatible.
- Price-dependent valuation ratios either carry `price_reference` or record explicit price/provenance omission truth.
- Four-quarter TTM is used when quarterly snapshots are available.
- Missing TTM quarters degrade to annual fallback with omission truth.
- Benchmarks are rendered as reviewed bands, not exact peer medians.
- Education boxes explain classification and value-trap risk in readable, non-technical language.
- Missing advanced indicators produce omissions rather than fake values.
- Product API PDF/HTML export renders the upgraded pages without orphaning the value-lens content.
- No Pulse changes, paid provider, quote scraping, trading advice, broker flow, public lab, or terminal workflow is introduced.

## Smoke Test

1. Generate one Deep Dive with supported price and quarterly history.
2. Confirm `financial_indicators.price_reference`, TTM periods, benchmarks, education boxes, and advanced indicators are present.
3. Generate or test a missing-price case.
4. Confirm P/E, P/S, P/B, EV/EBITDA, market cap, enterprise value, and FCF yield are omission-forward while non-price indicators remain available.
5. Generate or test a weak/cheap company case.
6. Confirm value classification can produce `value_trap_risk`.
7. Export Deep Dive HTML/PDF.
8. Confirm the memo explains ratios in plain English and evidence/provenance is clean.

## Rollback

Disable M13 rendering of benchmarks, education, and price provenance while leaving additive contract fields in place. Do not replace missing price data with scraped or paid-provider shortcuts.
