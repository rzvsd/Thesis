# Deep Dive Visual Exhibits Standard

**Status:** Active  
**Last Revised:** 2026-04-22  
**Applies To:** Deep Dive Revamp M5.2, M6, M7, M8, M9

---

## Purpose

This document locks what "visually serious" means for Deep Dive exhibits.

The goal is not decorative charts. The goal is research visuals that make real figures easier to understand, compare, and trust.

The attached owner references point Thesis toward:

- institutional bar-chart exhibits
- comparison-heavy macro and company visuals
- distribution views where shape matters
- clear axis labeling and restrained color use
- chart-first explanation, not chart for decoration

These references define the quality bar only. Thesis must not copy proprietary layout, branding, fonts, or expression.

---

## Visual Doctrine

Every exhibit must be:

- data-native
- generated from real report figures
- omission-aware
- readable in PDF and on phone
- visually restrained and editorial
- accompanied by a plain-English takeaway

Every exhibit must not be:

- decorative filler
- fake precision
- logo-heavy
- gradient candy with weak meaning
- interactive-only if the same truth cannot survive in PDF

---

## Required Visual Direction

Thesis visual exhibits should feel:

- editorial, not dashboard-chaotic
- premium, not startup-generic
- mathematically calm, not noisy
- high-contrast but restrained
- serif-forward in titles, clean sans/mono in labels and metadata

The exhibit language should preserve Thesis colors and tone while adding stronger figure storytelling.

---

## Reference-Inspired Exhibit Families

These exhibit families are now approved for Deep Dive.

### 1. Grouped Comparison Bars

Use for:

- multi-country or multi-segment comparison
- prior/current/base-vs-latest comparisons
- margin, growth, inflation-style comparisons

Characteristics:

- 2-4 series max
- strong latest highlight
- muted comparison series
- direct legend with minimal clutter
- visible units on both chart and caption

### 2. Overlaid Peak-vs-Latest Bars

Use for:

- peak vs current demand
- peak vs current margin
- prior cycle vs latest quality indicators

Characteristics:

- pale "peak/reference" body
- darker "latest" body
- compact country/segment stacks
- visual answer is immediate without reading table rows

### 3. Distribution / Density Curves

Use for:

- valuation distribution
- peer multiple distribution
- inflation/category distribution
- return or margin-dispersion context

Characteristics:

- max 2-3 curves
- shaded region allowed when meaningful
- current vs historical vs stressed views only
- annotation must explain what the tail or center means

### 4. Delta / Contribution Bars

Use for:

- what changed in revenue growth
- margin bridge
- capital allocation impact
- macro or segment contribution

Characteristics:

- positive and negative contributions clearly separated
- zero line visible
- no more than 8-10 steps
- final interpretation sentence required

### 5. Range Bands

Use for:

- valuation low/base/high
- margin of safety
- scenario corridor

Characteristics:

- base case visually dominant
- spot/reference line clearly marked
- uncertainty explicitly captioned

### 6. Timelines

Use for:

- what changed since last thesis
- catalyst path
- risk escalation sequence
- management commentary progression

Characteristics:

- sparse, annotated, not overloaded
- each point must map to an evidence-backed event

### 7. Scorecards / Heat Tables

Use for:

- value-discipline signal families
- business quality sub-factors
- risk severity by category

Characteristics:

- clear pass/fail/unavailable semantics
- unavailable must be visually distinct from fail
- never imply a single score means the whole thesis is solved

### 8. Waterfall / Bridge Charts

Use for:

- fair value bridge
- earnings to cash flow bridge
- margin bridge

Characteristics:

- start, bridge components, and finish clearly labeled
- bridge steps tied to deterministic assumptions only

---

## Minimum Exhibit Set By Report Area

### Cover / Memo

- valuation range band or explicit valuation omission panel
- confidence/freshness strip

### Thesis / What Changed

- top-change stack or evidence timeline

### Business Quality

- business quality scorecard
- segment or revenue-mix visual when available

### Financial Analysis

- 3-5 year trend chart for revenue and margin
- cash conversion or FCF trend visual
- debt/cash/liquidity comparison visual when relevant

### Value Discipline

- signal-family scorecard
- missing-input block

### Valuation

- range band
- scenario compare chart
- waterfall/bridge when assumptions support it

### Risks / Kill Switches

- risk matrix
- catalyst timeline

### Evidence Book

- evidence ladder
- source freshness table or compact heat list

---

## Additional Approved Exhibit Types

These were not explicitly shown in the owner images, but they fit the same institutional standard and are approved:

- slope chart for prior-vs-current thesis deltas
- small-multiple sparklines for multi-metric trend comparison
- segmented stacked bars for revenue mix and recurring-vs-cyclical exposure
- tornado sensitivity chart for valuation assumptions
- thesis support matrix crossing claims vs evidence strength
- omission severity panel for sparse-data reports

---

## Styling Rules

- Use restrained palette hierarchy: neutral references, stronger current series, one danger color, one opportunity color.
- Titles should say what the chart proves, not only what it contains.
- Axis labels must include units.
- Legends should be compact and never fight the headline.
- Gridlines should be subtle.
- Footnotes/source notes belong with the chart when important.
- If the chart needs a paragraph to explain basic reading, redesign it.

---

## Fail Conditions

An exhibit fails if:

- it is generated from inferred or fake values
- it has no plain-English takeaway
- the same chart truth is not reproducible in PDF
- labels/axes/units are missing
- colors imply meaning that is not explained
- omission state is hidden
- it looks like a generic BI dashboard rather than an institutional research exhibit

---

## M5.2 Build Intent

M5 proved export structure.

M5.2 upgrades export quality from:

- correct but text-first

to:

- institutionally visual, chart-led, and publication-worthy

This milestone is the visual exhibit pass before M6 uses the same exhibit language on mobile.

M8 preserves this exhibit language while reorganizing the report into the `due_diligence` section taxonomy.

M9 preserves the same exhibit language while moving the serious export path to editorial HTML/CSS-to-PDF.
