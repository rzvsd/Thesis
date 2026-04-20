# Deep Dive Reference Mapping

**Status:** Active
**Last Revised:** 2026-04-20
**Applies To:** Deep Dive Revamp M0-M7

---

## Purpose

This document translates the two reference PDFs into Thesis requirements.

It exists because "use this PDF as inspiration" is too weak. A builder must know exactly what quality bar the references create, what we adopt, what we reject, and how tests prove the result.

The references are:

| File | Pages | Role |
|---|---:|---|
| `report.pdf` | 28 | Institutional research-report standard: narrative hierarchy, exhibit discipline, forecast tables, source notes, appendix behavior |
| `value investing.pdf` | 42 | Value-investing discipline: historical financial statement signals, profitability, cash flow, leverage, liquidity, operating efficiency, F_SCORE logic |

These PDFs are quality references only. Thesis must not copy their text, proprietary layout, charts, branding, or distinctive expression.

---

## Reference 1: `report.pdf`

### What It Teaches

| Observed Pattern | Thesis Requirement |
|---|---|
| Starts with a strong central research claim | Every Deep Dive opens with a company-specific investment argument, not a generic generated summary |
| Uses a clear title, date, authorship/context, and publication discipline | PDF Page 1 must identify ticker, company, generation date, data freshness, signal, confidence, fair value range, and decision question |
| Builds the report around exhibits | Every major conclusion must be supported by a table, scorecard, valuation bridge, timeline, evidence ladder, or omission panel |
| Uses source notes under charts/tables | PDF and mobile proof sections must show source class/freshness for data-backed exhibits |
| Separates narrative from appendix data | Mobile shows the executive path first; PDF carries appendix tables and assumptions at the end |
| Explains changes over time | Deep Dive must include "what changed" as a primary section, not an optional paragraph |
| Uses concise exhibit captions | Every visual panel must answer "what this shows" and "why it matters" |
| Keeps a consistent professional hierarchy | PDF and mobile must use predictable heading, exhibit, source, and appendix structure |

### What Thesis Must Not Copy

| Do Not Copy | Reason |
|---|---|
| Branding, logos, page styling, or proprietary layout | Reference is not a design license |
| Exact text, titles, section phrasing, or chart design | Thesis needs its own voice and visual system |
| Macro-report structure as a company-report structure | Thesis reports are company Deep Dives, not global macro outlooks |
| Unsupported certainty | Thesis must show omissions and uncertainty when inputs are missing |

---

## Reference 2: `value investing.pdf`

### What It Teaches

| Observed Pattern | Thesis Requirement |
|---|---|
| Uses historical accounting data to separate stronger and weaker firms | Deep Dive must include a financial-statement quality section, not only narrative sentiment |
| Looks at profitability, cash generation, leverage/liquidity, operating efficiency, and issuance | Value Discipline Scorecard must group signals into those same families |
| Treats F_SCORE as a screening discipline, not an absolute truth | Thesis must explain what the score means, what it does not mean, and when it is less decisive |
| Values missing/weak fundamentals as information | Missing signals and deteriorating signals must reduce confidence or be explicitly explained |
| Is most powerful for value/high book-to-market contexts | Thesis must contextualize value discipline for quality mega-caps, growth names, cyclical names, banks, and sparse-data names |

### Thesis Value Discipline Families

| Family | Example Inputs | Thesis Behavior |
|---|---|---|
| Profitability | net income, return on assets, operating margin, gross margin | Show whether the business earns real profit from its asset base |
| Cash conversion | operating cash flow, free cash flow, accruals | Explain whether accounting profit becomes cash |
| Leverage and liquidity | debt, cash, current assets/liabilities where available | Show whether the balance sheet supports or threatens the thesis |
| Operating efficiency | asset turnover, margin improvement, cost structure | Show whether the company is becoming more productive |
| Capital discipline | share count change, issuance, buybacks | Show whether shareholders are being diluted or supported |

### What Thesis Must Not Do

| Forbidden Behavior | Correct Behavior |
|---|---|
| Emit a full Piotroski score when inputs are missing | Emit partial score, missing inputs, and confidence impact |
| Treat a high score as a buy recommendation | Explain that it is one lens inside thesis, valuation, and evidence |
| Penalize every growth company like a distressed value screen | Adapt interpretation by company type |
| Use the LLM to decide signal values | Compute deterministic signals first, then let Dexter explain them |

---

## Required Traceability

Every Deep Dive Revamp milestone must preserve this chain:

```text
Reference requirement
  -> report standard section
  -> contract field
  -> deterministic test or fixture
  -> mobile/PDF render proof
  -> acceptance evidence
```

If any link is missing, the milestone is not complete.

---

## Builder Checklist

- [ ] Did the report open with a real investment argument?
- [ ] Did every major claim have a metric, evidence item, or explicit omission?
- [ ] Did financial history include 3-5 years where data exists?
- [ ] Did value discipline explain both score and context?
- [ ] Did the report include exhibit-style visuals rather than decorative cards?
- [ ] Did missing data produce omission panels, not fake conclusions?
- [ ] Did PDF output feel like a report artifact, not a mobile screenshot?
- [ ] Did mobile preserve the same research truth as PDF?

