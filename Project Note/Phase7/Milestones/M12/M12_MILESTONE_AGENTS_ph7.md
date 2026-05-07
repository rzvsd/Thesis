# Phase 7 M12 - Deep Dive Financial Indicators & Value Lens

## Summary

M12 adds the investor lens that sits naturally after the M11 filing memo.

M11 explains what changed in the latest 10-Q/10-K. M12 explains what those numbers imply about business quality, valuation, cash flow, balance-sheet risk, dilution, and value-versus-growth classification.

## Goal

Give Deep Dive readers a plain-English answer to:

- Is this company cheap, expensive, or expensive for a reason?
- Is it profitable?
- Is it improving?
- Is debt dangerous?
- Is cash flow real?
- Is share count diluting owners?
- Is this classic value, quality value, quality growth, expensive growth, distressed, or value-trap risk?

## Deliverables

| Deliverable | Description |
|---|---|
| Additive contract | `AnalysisReport.financial_indicators?: FinancialIndicatorsBlock` |
| Deterministic calculator | Dexter computes valuation, profitability, growth, balance sheet, cash-flow quality, and capital-allocation indicators from approved snapshots |
| Value classification | Classify the company as classic value, quality value, quality growth, expensive growth, turnaround, distressed, value-trap risk, or insufficient data |
| Price-source discipline | Ratios requiring market price are computed only when an approved spot/reference price is already available; otherwise they are omitted honestly |
| Five-year trend board | Show current, 1Y, 3Y, and 5Y views where annual history supports it |
| PDF/HTML render pages | Add Financial Indicators & Value Lens plus a 5-Year Trend Board to Deep Dive export |
| Plain-English explanation | LLM may explain computed facts, but cannot compute ratios, mutate values, invent price, or produce advice |

## Locked Product Behavior

- M12 is Deep Dive-only and does not change Pulse.
- The first visible surface is PDF/HTML export.
- SEC/XBRL financial snapshots remain the fundamental source substrate.
- Market-price valuation ratios require an approved spot/reference price path.
- If price is missing, valuation ratios such as P/E, P/S, P/B, EV/EBITDA, market cap, enterprise value, and FCF yield are omitted with omission truth.
- Dexter computes all ratios deterministically. The LLM explains, never calculates.
- Missing denominators are missing. They are never treated as zero.
- No buy/sell/hold language, price targets, allocation advice, broker workflow, or terminal-style product behavior is introduced.

## Interface Plan

- `packages/contracts/src/financial-indicators.ts`
- `AnalysisReport.financial_indicators?: FinancialIndicatorsBlock`
- `apps/dexter-worker/src/financial-indicators.ts`
- `apps/product-api/src/report-pdf-editorial.ts`

## Acceptance Criteria

- [ ] `AnalysisReport` validates with and without `financial_indicators`
- [ ] Dexter fixture pipeline emits a contract-valid financial indicators block
- [ ] P/E, P/S, P/B, EV/EBITDA, market cap, enterprise value, and FCF yield compute only when price and required fundamentals exist
- [ ] Margins, ROE, ROA, debt/equity, net debt/EBITDA, cash/debt, cash conversion, FCF margin, capex intensity, and share-count change compute without price
- [ ] Five-year trend rows show available current, 1Y, 3Y, and 5Y values without fake interpolation
- [ ] Missing price/history/denominator inputs create omissions, not filler
- [ ] PDF/HTML export shows Financial Indicators & Value Lens and 5-Year Trend Board pages with charts/tables
- [ ] Evidence appendix includes financial-indicator evidence and omission truth

## Smoke Test

```text
Step 1: Run contracts tests.
Step 2: Run Dexter worker tests.
Step 3: Run Product API Deep Dive export focused test.
Step 4: Generate one Deep Dive fixture for MSFT.
Step 5: Confirm - financial_indicators validates and includes valuation, profitability, cash quality, and five-year trends.
Step 6: Render HTML/PDF.
Step 7: Confirm - Financial Indicators & Value Lens and 5-Year Trend Board appear before legacy Deep Dive sections.
Step 8: Confirm - no fake valuation ratios appear when price is removed.
Step 9: Run typecheck, lint, and dependency guard.
Step 10: Record proof under M12 evidence.
```

## Rollback

Disable `financial_indicators` generation and omit the new value-lens pages while leaving the additive contract in place. Do not replace missing price data with scraped or unapproved quote sources.

## Owners

- Dexter / Reasoning Engineer
- Product API Owner
- Product Lead for final readability review
