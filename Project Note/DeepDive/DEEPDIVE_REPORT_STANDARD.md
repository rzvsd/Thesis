# Deep Dive Institutional Report Standard

**Status:** Active
**Last Revised:** 2026-04-22
**Companion Docs:** `DEEPDIVE_REFERENCE_MAPPING.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`, `DEEPDIVE_TEST_MATRIX.md`

---

## Quality Bar

A completed Deep Dive must read like a full due diligence report with an executive summary on top and an editorial body underneath it, not like a short generated memo pretending to be due diligence.

It must answer:

- what is the decision question and current stance?
- what do the financials and value-discipline signals say?
- how strong is the competitive position?
- what does management and governance signal?
- what could break the thesis?
- where can growth or upside come from?
- what valuation and thesis stance follow?
- what evidence supports the conclusion?
- what is missing?

---

## Canonical Artifact Topology

The report has three layers.

### 1. `investment_memo` Summary Layer

Required fields:

- ticker and company name
- date generated
- issuer metadata strip where supported: primary exchange/listing, currency, domicile/region, sector/industry
- signal / stance
- confidence
- coverage truth summary
- one-paragraph thesis
- decision question
- why now
- top changes
- top risks
- fair value range or valuation omission state

This layer is short and summary-first. It must not contradict the canonical `due_diligence` layer.

### 2. `due_diligence` Canonical Layer

The canonical layer must contain exactly these six sections:

1. `financial_analysis`
2. `competitive_positioning`
3. `management_and_governance`
4. `risks_and_challenges`
5. `growth_opportunities_and_outlook`
6. `valuation_and_thesis_stance`

### 3. Supporting Proof Layers

Required supporting content:

- issuer metadata / listing context
- evidence book
- omissions ledger
- appendix tables
- data freshness
- calculation notes
- generation metadata

`DEEPDIVE_REPORT_TEMPLATE.md` defines how those layers appear in PDF pages and the mobile reader.

---

## M9 Editorial Authoring Standard

Verbose does not mean bloated.

For a normal full-data report:

- each canonical section opens with a clear takeaway before the deeper proof
- each section then carries enough editorial body to explain what changed, why it matters, what supports the claim, and what remains uncertain
- sections should read like short institutional report pages, not bullet-only filler or padded generic prose
- `investment_memo` remains short and compatibility-safe even when the canonical report becomes more detailed
- issuer metadata must be visible on the report surface or rendered as an explicit metadata omission

---

## Canonical Due-Diligence Sections

### 1. `financial_analysis`

Required content:

- 3-5 year revenue history where available
- gross margin and operating margin history where available
- net income and free cash flow history where available
- debt, cash, and liquidity where available
- share count and dilution/buyback trend where available
- ROIC/ROE and cash conversion where inputs exist
- Piotroski-style/value-discipline signal families where inputs exist
- plain-English explanation of what the numbers mean
- financial omissions

Required exhibits where data exists:

- 5-year financial table
- multi-period trend charts
- cash-conversion panel
- debt/cash/liquidity comparison
- value-discipline scorecard or omission state

### 2. `competitive_positioning`

Required content:

- business model and market structure in plain English
- segment or revenue mix where available
- moat or differentiation
- customer/supplier concentration or cyclicality when known
- peer/reference framing when allowed data exists
- uncertainty notes for unsupported competitive claims

### 3. `management_and_governance`

Required content:

- leadership setup and tenure where evidence exists
- capital allocation track record
- incentive alignment and governance structure where evidence exists
- disclosure quality, execution credibility, or control concerns where evidenced
- management/governance omissions when coverage is thin

### 4. `risks_and_challenges`

Required content:

- top thesis risks
- falsifiable kill-switch conditions
- watch items
- evidence needed for next review
- challenge ranking and timeframe where possible

### 5. `growth_opportunities_and_outlook`

Required content:

- why now / what changed
- reinvestment runway or growth vectors
- catalysts and opportunity set
- scenario drivers and constraints
- outlook omissions and uncertainty

### 6. `valuation_and_thesis_stance`

Required content:

- base, bull, and bear scenarios
- valuation assumptions
- fair value range
- margin of safety
- inverse expectation or market-implied view when available
- stance synthesis
- confidence explanation
- "what would change our mind"
- valuation omissions

---

## Supporting Proof Layers

### Evidence Book

Required content:

- source list
- freshness
- claim mapping
- contradiction or uncertainty notes

### Appendix

Required content:

- raw financial tables
- calculation notes
- valuation math
- issuer metadata table
- omitted inputs
- data freshness table
- model/prompt metadata where appropriate

---

## Minimum Completeness Rules

| Area | Complete If | Otherwise |
|---|---|---|
| Summary layer | Decision question, thesis, top changes, top risks, and coverage truth exist | Show limited-coverage summary state |
| Issuer metadata | Ticker/company plus report date, exchange/listing, currency, and domicile/sector context where supported | Show explicit metadata omissions |
| `financial_analysis` | At least 3 annual periods, target 5 | Show sparse-data financial analysis with omissions |
| `management_and_governance` | At least one sourced management or governance observation exists | Show explicit coverage gap; do not guess |
| `valuation_and_thesis_stance` | Spot/reference price and at least base assumptions exist | Show valuation omitted/degraded |
| Evidence | Material claims have evidence or metric support | Remove claim or show omission |
| PDF | Summary + six due-diligence sections + issuer metadata + evidence/appendix render within the template | The active editorial-report milestone is not closeable |

---

## Template Compliance Rule

A Deep Dive can render and still fail.

It fails if it violates any hard fail condition in `DEEPDIVE_REPORT_TEMPLATE.md` or any relevant gate in `DEEPDIVE_TEST_MATRIX.md`.

Examples:

- A PDF with a strong first page but no `management_and_governance` section fails.
- A mobile reader that hides the whole thesis behind expansions fails.
- A summary layer that overstates conviction beyond `due_diligence` support fails.
- A cover page without issuer metadata or explicit metadata omissions fails.
- A valuation label without assumptions fails.
- A due-diligence section with hidden missing data fails.

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
- "Management is strong" without evidence.
- "Valuation is attractive" without assumptions.
- "Watch execution" without defining what execution means.

---

## Visual Standard

Use data-native visuals:

- tables
- metric deltas
- valuation bands
- scenario bridges
- timelines of change
- evidence ladders
- value-discipline scorecards
- risk matrices

Chart-rich institutional exhibit families are locked in `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`.

Do not use decorative images, logos, AI art, or fake charts.
