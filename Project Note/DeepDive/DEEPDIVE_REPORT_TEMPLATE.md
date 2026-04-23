# Deep Dive Report Template

**Status:** Active
**Last Revised:** 2026-04-22
**Applies To:** Deep Dive Revamp M1-M9, with M5.2 governing the visual exhibit layer

---

## Purpose

This is the canonical output template for the revamped Deep Dive.

It prevents the project from shipping another shallow report. If implementation cannot produce this structure, the milestone remains open.

---

## Normal Full-Data PDF Shape

Target length: 10-14 pages for a company with enough financial history and evidence.

Sparse reports may be shorter, but they must become explicit limited-coverage due-diligence reports with omissions, not fake complete reports.

M9 keeps the 10-14 page envelope but upgrades the serious export path to editorial HTML/CSS-to-PDF. The page labels below define the fixed order and target page neighborhoods. HTML/CSS layout may let a section spill into the next neighborhood when the report stays readable, omission-forward, and inside the overall page target.

---

## M9 Editorial Export Rules

- Export path is editorial HTML/CSS-to-PDF, not a UI screenshot or card dump.
- `investment_memo` remains a one-paragraph compatibility summary on the cover.
- Each canonical `due_diligence` section must open with a takeaway and then provide concise editorial body explaining evidence, causality, uncertainty, and omissions.
- Verbose does not mean bloated. Editing discipline must preserve the 10-14 page target for normal full-data reports.
- Issuer metadata must appear on the cover and in the appendix metadata table, or render as explicit metadata omissions.

---

## Page 1 - Deep Dive Cover, Issuer Metadata, And Compatibility Summary

### Required Content

- ticker and company name
- issuer metadata strip: primary exchange/listing, currency, domicile/region, sector/industry where available
- report date and data freshness
- signal, confidence, and stance label
- current/reference price when available
- fair value range and margin of safety when available
- one-paragraph `investment_memo` thesis
- decision question
- top 3 reasons this matters now
- top 3 thesis risks
- coverage truth summary

### Required Exhibits

- stance badge
- issuer metadata strip
- confidence/freshness strip
- fair value range or valuation omitted panel
- "what would change our mind" mini-list
- visual hierarchy strong enough that Page 1 does not read like a plain text export

### Fail Conditions

- The page reads like a generic company summary.
- There is no decision question.
- Signal/confidence appears without explanation.
- Issuer metadata or explicit metadata omissions are missing.
- Valuation appears without assumptions or omission status.

---

## Page 2 - Why Now, What Changed, And Coverage Truth

### Required Content

- why now
- market expectation being tested
- what changed since the prior report or baseline
- why the change matters for the thesis
- coverage truth / key omission summary
- what would make the view wrong

### Required Exhibits

- change timeline or top-change stack
- previous view versus current view table where prior report exists
- omission panel if no prior thesis exists
- grouped delta bars or equivalent visual when numeric change comparison exists

### Fail Conditions

- Why-now context is missing or buried.
- Changes are described without evidence or metrics.
- Prior-report absence is not explained.
- Coverage gaps are hidden until the appendix.

---

## Pages 3-4 - `financial_analysis`

### Required Content

- 3-5 year revenue history where available
- section takeaway summarizing the main financial reality
- gross margin and operating margin history where available
- net income and free cash flow history where available
- debt, cash, and liquidity where available
- share count and dilution/buyback trend where available
- Piotroski-style/value-discipline signal families where inputs exist
- plain-English explanation of the trend
- editorial body connecting the trend changes to thesis impact and uncertainty
- financial omissions

### Required Exhibits

- 5-year financial table or sparse-data equivalent
- metric delta cards for revenue, margins, FCF, debt, and share count
- cash-conversion panel
- value-discipline scorecard or explicit omission panel
- at least one real trend chart from report figures when 3+ periods exist

### Fail Conditions

- A metric is shown without required inputs.
- The report has data but does not show a multi-year table.
- Value-discipline logic disappears instead of being remapped into this section.
- Missing data is silently skipped.

---

## Page 5 - `competitive_positioning`

### Required Content

- business model in plain English
- section takeaway stating the core competitive conclusion
- segment or revenue mix where available
- moat or differentiation
- market structure and exposure
- cyclicality or concentration where known
- peer/reference framing when supported
- editorial body explaining why the positioning claim matters and where evidence is thin
- uncertainty notes for unsupported claims

### Required Exhibits

- business quality or positioning scorecard
- segment/revenue mix table when available
- moat/risk matrix
- segment/revenue mix visual when structured mix data exists

### Fail Conditions

- The section says "strong business" without explaining why.
- Segment data is invented or inferred without source support.
- Competitive claims appear without uncertainty labels when evidence is thin.

---

## Page 6 - `management_and_governance`

### Required Content

- leadership setup and tenure where evidence exists
- section takeaway on leadership/governance confidence
- capital allocation notes
- incentive alignment and governance structure where evidence exists
- disclosure quality / credibility notes
- controversies, controls, or governance gaps when evidenced
- editorial body linking governance evidence to capital allocation, credibility, or omission state
- omission state when coverage is limited

### Required Exhibits

- management/governance summary table
- capital allocation timeline or summary cards where available
- omission panel when leadership/governance coverage is incomplete

### Fail Conditions

- Management quality is asserted without evidence.
- Governance is silently skipped on thin coverage.
- Capital allocation is discussed without tying back to evidence or financial outcomes.

---

## Page 7 - `risks_and_challenges`

### Required Content

- top thesis risks
- section takeaway on the main risk posture
- falsifiable kill-switch conditions
- upcoming challenge checkpoints
- watch items
- editorial body explaining why the leading risks matter now and what evidence would change the view
- evidence needed for next review

### Required Exhibits

- risk matrix
- catalyst/challenge timeline
- kill-switch table with trigger, evidence source, and action

### Fail Conditions

- Risks are generic.
- Kill switches are not falsifiable.
- Dates, uncertainty, or next-check evidence are missing.

---

## Page 8 - `growth_opportunities_and_outlook`

### Required Content

- why now / what changed synthesis
- section takeaway on the main upside or runway claim
- reinvestment runway or upside vectors
- catalysts and growth opportunities
- scenario drivers and constraints
- editorial body separating supported opportunity from speculation
- outlook omissions and uncertainty

### Required Exhibits

- opportunity stack or timeline
- driver table or scenario input summary
- omission panel when outlook is low-confidence

### Fail Conditions

- Growth upside is generic or slogan-like.
- The section repeats Page 2 without forward-looking discipline.
- Outlook uncertainty is hidden.

---

## Pages 9-10 - `valuation_and_thesis_stance`

### Required Content

- base, bull, and bear scenarios
- section takeaway linking valuation to current stance
- valuation assumptions
- fair value range
- margin of safety
- sensitivity explanation
- inverse expectation or market-implied view when available
- stance synthesis
- editorial body connecting assumptions, risks, and what changes the stance
- confidence explanation
- valuation omissions

### Required Exhibits

- valuation range band
- scenario comparison table
- assumption table
- valuation bridge when inputs support it
- distribution/bridge-style visual when scenario spread is best shown visually

### Fail Conditions

- "Undervalued" or "overvalued" appears without assumptions.
- Scenario math is not deterministic.
- Stance is disconnected from valuation and risks.
- Missing price or assumption data does not produce a degraded valuation state.

---

## Page 11 - Evidence Book And Omission Ledger

### Required Content

- evidence list
- source class
- evidence freshness
- claim mapping
- contradiction or uncertainty notes
- centralized omission ledger

### Required Exhibits

- evidence ladder
- source freshness table
- claim-to-evidence matrix
- omission table with section mapping

### Fail Conditions

- Material claims do not map to evidence, metrics, or omissions.
- Evidence is present but freshness is hidden.
- Omissions are scattered and impossible to inspect quickly.

---

## Pages 12-14 - Appendix, Metadata, And Issuer Context

### Required Content

- raw financial tables
- calculation notes
- valuation math
- issuer metadata table
- missing inputs
- data freshness table
- model/prompt metadata where appropriate

### Required Exhibits

- appendix financial table
- assumptions table
- issuer metadata table
- report generation metadata
- chart notes, axis units, and exhibit footnotes where visual exhibits require them

### Fail Conditions

- The PDF has no appendix when complex calculations exist.
- Calculations cannot be inspected.
- Issuer metadata or metadata omissions are not inspectable.
- Metadata or omissions are not centralized.

---

## M5.2 Visual Exhibit Standard

The PDF must move beyond correct structure into visually persuasive, data-native explanation.

This layer is governed by `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`.

### Required Visual Behavior

- Use chart-rich exhibits when they explain the numbers faster than prose alone.
- Prefer grouped bars, overlaid peak-vs-latest bars, distribution curves, contribution bars, range bands, timelines, waterfalls, and scorecards.
- Keep every exhibit tied to explicit values already present in the report artifact or deterministically derived from it.
- If the data is too sparse for a clean chart, render an omission-aware panel instead of a fake chart.
- Make the page feel editorial and institutional, not like a spreadsheet export or BI dashboard.

### Required Visual Quality Checks

- Axes, units, legends, and period labels must be readable in PDF and page renders.
- Exhibits must earn their space; do not add decorative charts that repeat the paragraph above them.
- Visual hierarchy must still preserve the summary-first reading flow.
- The chart language should feel cohesive across financials, competition, management, risks, outlook, and valuation.

---

## Mobile Reader Template

Mobile is not a mini-PDF. It is the summary-first reading path over the same report artifact.

M5.2 governs the PDF chart language first. M6, M8, and M9 must inherit the same exhibit truth, not invent a second visual interpretation.

Required order:

1. Hero summary: ticker, company, stance, confidence, freshness, one-sentence thesis.
2. Read this first: decision question, why now, top changes, top risks, coverage truth.
3. `financial_analysis`: collapsed takeaway plus inline expand for multi-year table, trends, and value-discipline proof.
4. `competitive_positioning`: collapsed takeaway plus inline expand for mix, moat, and uncertainty proof.
5. `management_and_governance`: collapsed takeaway plus inline expand for leadership, capital allocation, and governance proof.
6. `risks_and_challenges`: collapsed takeaway plus inline expand for kill switches and watch items.
7. `growth_opportunities_and_outlook`: collapsed takeaway plus inline expand for catalysts, upside, and uncertainty.
8. `valuation_and_thesis_stance`: collapsed takeaway plus inline expand for ranges, assumptions, and what changes our mind.
9. Evidence, omissions, appendix, and export entry.

Mobile fail conditions:

- The reader starts with raw accordions.
- The user cannot understand the thesis without expanding every proof section.
- Verbose long-form text is expanded by default instead of preserving the summary-first flow.
- PDF and mobile disagree on stance, valuation, risks, or omissions.
- A canonical due-diligence section is only available in PDF.
- Old reports cannot render with fallback.
