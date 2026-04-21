# Deep Dive Institutional Report Standard

**Status:** Active
**Last Revised:** 2026-04-20
**Companion Docs:** `DEEPDIVE_REFERENCE_MAPPING.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`, `DEEPDIVE_TEST_MATRIX.md`

---

## Quality Bar

A completed Deep Dive must read like an investment research memo, not a generated app summary.

It must answer:

- What is the thesis?
- What changed?
- Is the business financially strong?
- Is the valuation reasonable?
- What does value-investing discipline say?
- What could break the thesis?
- What evidence supports the conclusion?
- What is missing?

---

## Canonical Report Structure

The canonical structure below defines what the report must contain.

`DEEPDIVE_REPORT_TEMPLATE.md` defines how that structure appears in PDF pages and the mobile reader.

### 1. Cover And One-Page Memo

Required fields:

- ticker and company name
- date generated
- signal
- confidence
- fair value range
- spot/reference price
- margin of safety
- one-paragraph thesis
- decision question
- top 3 reasons to care now
- top 3 risks

### 2. Investment Thesis

Required content:

- central argument
- market expectation being tested
- Thesis view
- why now
- what would make the view wrong

### 3. What Changed

Required content:

- changes since prior report
- financial deltas
- valuation deltas
- transcript/management commentary changes
- macro/regime changes where relevant
- catalyst changes

### 4. Business Quality

Required content:

- business model
- segment mix where available
- revenue durability
- moat/competitive position
- cyclicality
- margin structure
- capital intensity
- management/capital allocation notes

### 5. Financial Statement Analysis

Required exhibits where data exists:

- 5-year revenue table
- 5-year gross margin and operating margin
- 5-year net income and free cash flow
- cash conversion
- debt, cash, liquidity
- share count and dilution/buybacks
- ROIC/ROE where inputs exist

Missing metrics must appear in omissions.

### 6. Value Discipline Scorecard

Required content:

- Piotroski-style input table where inputs exist
- profitability signals
- leverage/liquidity signals
- operating-efficiency signals
- earnings-quality/accrual signal
- contextual interpretation by company type
- value-trap warning when cheapness conflicts with deteriorating quality

### 7. Valuation

Required content:

- base, bull, and bear valuation
- assumptions table
- margin of safety
- inverse DCF or market-implied expectation when available
- sensitivity explanation
- valuation omissions

### 8. Risks And Kill Switches

Required content:

- key thesis risks
- falsifiable kill-switch conditions
- upcoming catalysts
- evidence needed for next review
- alert/watch items

### 9. Evidence Book

Required content:

- source list
- evidence excerpts
- freshness
- rights/source class where available
- evidence mapped to claims

### 10. Appendix

Required content:

- raw financial tables
- calculation notes
- valuation math
- omitted inputs
- data freshness table

---

## Minimum Completeness Rules

| Area | Complete If | Otherwise |
|---|---|---|
| Financial history | At least 3 annual periods, target 5 | Show sparse-data report state |
| Value discipline | Required inputs available for at least 5 of 9 Piotroski-style signals | Show partial score and missing inputs |
| Valuation | Spot/reference price and at least base assumptions exist | Show valuation omitted/degraded |
| Evidence | Material claims have evidence or metric support | Remove claim or show omission |
| PDF | Memo, exhibits, valuation, risks, evidence, appendix render | PDF v2 not closeable |

---

## Template Compliance Rule

A Deep Dive can render and still fail.

It fails if it violates any hard fail condition in `DEEPDIVE_REPORT_TEMPLATE.md` or any relevant gate in `DEEPDIVE_TEST_MATRIX.md`.

Examples:

- A PDF with pretty cards but no appendix fails.
- A mobile reader that begins with raw accordions fails.
- A value score without missing-input disclosure fails.
- A valuation label without assumptions fails.
- A memo with generic prose and no evidence-backed company argument fails.

---

## Writing Standard

Good Thesis writing:

- opens with a specific investment argument
- explains financial terms in plain English
- separates facts from interpretation
- tells the user why a number matters
- avoids repeated template phrases
- states uncertainty directly
- never sounds like a chatbot summary

Bad Thesis writing:

- "Revenue increased, therefore the thesis is positive."
- "The company remains strong" without evidence.
- "Valuation is attractive" without assumptions.
- "Watch execution" without defining what execution means.

---

## Visual Standard

Use data-native visuals:

- tables
- metric deltas
- valuation bands
- scenario bridges
- timeline of changes
- evidence ladders
- value scorecards
- risk matrices

Chart-rich institutional exhibit families are locked in `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`.

Do not use decorative images, logos, AI art, or fake charts.
