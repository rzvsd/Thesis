# Deep Dive Report Template

**Status:** Active
**Last Revised:** 2026-04-20
**Applies To:** Deep Dive Revamp M1-M7

---

## Purpose

This is the canonical output template for the revamped Deep Dive.

It prevents the project from shipping another shallow report. If implementation cannot produce this structure, the milestone remains open.

---

## Normal Full-Data PDF Shape

Target length: 8-12 pages for a company with enough financial history and evidence.

Sparse reports may be shorter, but they must become explicit "limited-data reports" with omissions, not fake complete reports.

---

## Page 1 - Cover And One-Page Memo

### Required Content

- ticker and company name
- report date and data freshness
- signal, confidence, and stance label
- current/reference price when available
- fair value range and margin of safety when available
- one-paragraph investment thesis
- decision question
- top 3 reasons this matters now
- top 3 thesis risks
- coverage truth summary

### Required Exhibits

- stance badge
- confidence/freshness strip
- fair value range or valuation omitted panel
- "what would change our mind" mini-list

### Fail Conditions

- The page reads like a generic company summary.
- There is no decision question.
- Signal/confidence appears without explanation.
- Valuation appears without assumptions or omission status.

---

## Page 2 - Investment Thesis And What Changed

### Required Content

- central investment argument
- market expectation being tested
- Thesis view
- what changed since the prior report or baseline
- why the change matters for the user's thesis
- what would make the view wrong

### Required Exhibits

- change timeline or top-change stack
- previous view versus current view table where prior report exists
- omission panel if no prior thesis exists

### Fail Conditions

- "What changed" is missing or buried.
- Changes are described without evidence or metrics.
- Prior-report absence is not explained.

---

## Page 3 - Business Quality

### Required Content

- business model in plain English
- segment or revenue mix where available
- revenue durability
- moat or competitive position
- cyclicality
- margin structure
- capital intensity
- management/capital allocation notes where evidence exists

### Required Exhibits

- business quality scorecard
- segment/revenue mix table when available
- moat/risk matrix

### Fail Conditions

- The section says "strong business" without explaining why.
- Segment data is invented or inferred without source support.
- No uncertainty is stated for missing business-model inputs.

---

## Page 4 - Financial Statement Analysis

### Required Content

- 3-5 year revenue history where available
- gross margin and operating margin history where available
- net income and free cash flow history where available
- debt, cash, and liquidity where available
- share count and dilution/buyback trend where available
- plain-English explanation of the trend

### Required Exhibits

- 5-year financial table or sparse-data equivalent
- metric delta cards for revenue, margins, FCF, debt, and share count
- cash conversion panel

### Fail Conditions

- A metric is shown without required inputs.
- The report has data but does not show a multi-year table.
- Missing data is silently skipped.

---

## Page 5 - Value Discipline Scorecard

### Required Content

- Piotroski-style signal families
- profitability signals
- cash conversion/accrual signal
- leverage/liquidity signals
- operating-efficiency signals
- capital discipline/share issuance signal
- company-context interpretation
- value-trap warning when relevant

### Required Exhibits

- partial or complete scorecard
- missing-input list
- context label, for example quality mega-cap, cyclical, distressed, financial, sparse-data
- "what this score does not prove" note

### Fail Conditions

- Full score appears with missing inputs.
- Score is treated as a buy/sell recommendation.
- Interpretation is identical for every company type.

---

## Page 6 - Valuation And Scenarios

### Required Content

- base, bull, and bear scenarios
- valuation assumptions
- fair value range
- margin of safety
- sensitivity explanation
- inverse expectation or market-implied view when available
- valuation omissions

### Required Exhibits

- valuation range band
- scenario comparison table
- assumption table
- valuation bridge when inputs support it

### Fail Conditions

- "Undervalued" or "overvalued" appears without assumptions.
- Scenario math is not deterministic.
- Missing price or assumption data does not produce a degraded valuation state.

---

## Page 7 - Risks, Catalysts, And Kill Switches

### Required Content

- top thesis risks
- falsifiable kill-switch conditions
- upcoming catalysts
- watch items
- evidence needed for next review

### Required Exhibits

- risk matrix
- catalyst timeline
- kill-switch table with trigger, evidence source, and action

### Fail Conditions

- Risks are generic.
- Kill switches are not falsifiable.
- Catalysts appear without dates or uncertainty labels where dates are missing.

---

## Page 8 - Evidence Book

### Required Content

- evidence list
- source class
- evidence freshness
- claim mapping
- contradiction or uncertainty notes

### Required Exhibits

- evidence ladder
- source freshness table
- claim-to-evidence matrix

### Fail Conditions

- Material claims do not map to evidence, metrics, or omissions.
- Evidence is present but freshness is hidden.
- The section is just a list of links without research purpose.

---

## Page 9+ - Appendix

### Required Content

- raw financial tables
- calculation notes
- valuation math
- missing inputs
- data freshness table
- model/prompt metadata where appropriate

### Required Exhibits

- appendix financial table
- assumptions table
- omissions table
- report generation metadata

### Fail Conditions

- The PDF has no appendix when complex calculations exist.
- Calculations cannot be inspected.
- Omissions are not centralized.

---

## Mobile Reader Template

Mobile is not a mini-PDF. It is the executive reading path over the same report artifact.

Required order:

1. Hero verdict: ticker, company, stance, confidence, freshness, one-sentence thesis.
2. Read this first: decision question, why now, top changes, top risks.
3. Financial quality: trend cards, 5-year table entry, cash conversion, debt/liquidity.
4. Value discipline: scorecard, context explanation, missing inputs.
5. Valuation: range band, scenarios, assumptions, omissions.
6. Risks and kill switches: falsifiable conditions and watch items.
7. Evidence and appendix: claim support, source freshness, proof modules, export entry.

Mobile fail conditions:

- The reader starts with raw accordions.
- The user cannot understand the thesis without expanding proof sections.
- PDF and mobile disagree on signal, valuation, risks, or omissions.
- Old reports cannot render with fallback.

---

## Writing Template

Every core narrative section must answer these four questions:

1. What is this?
2. What changed?
3. Why does it matter for the thesis?
4. What is missing or uncertain?

Bad:

```text
Revenue improved and the company remains strong.
```

Good:

```text
Revenue growth matters here because the thesis depends on the company converting demand into durable operating profit. The available history shows whether growth came with better margins or simply with higher spending. If margin or cash-flow inputs are missing, Thesis must say that directly before assigning confidence.
```

