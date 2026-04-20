# Deep Dive Revamp PRD

**Status:** Active
**Last Revised:** 2026-04-20
**Product Surface:** Research -> Deep Dive, History, PDF export

---

## Problem

The current Deep Dive does not yet feel like a serious research report. It can show a thesis, evidence, trust metadata, and valuation cards, but the output often reads like a short generated summary rather than an investment memo.

For Thesis to justify trust and subscription value, Deep Dive must become the product's strongest artifact.

---

## User Promise

Thesis gives the user a serious company research report that explains:

- what the investment case is
- what changed
- whether the business is financially strong
- whether the valuation is reasonable
- what value-investing signals say
- what could break the thesis
- what evidence supports the conclusion
- what is missing or uncertain

---

## Target Users

| User | Need |
|---|---|
| Non-technical investor | Understand the thesis without reading raw filings |
| Serious individual investor | See the numbers, valuation, risks, and source trail |
| Builder/owner | Evaluate names with discipline before making or revisiting decisions |
| Analyst-style user | Export a credible report artifact with tables and evidence |

---

## User Experience

### In App

The phone experience is a guided reader:

1. verdict and thesis
2. what changed
3. financial quality
4. value discipline
5. valuation and scenarios
6. risks and kill switches
7. evidence and appendix entry

The mobile surface must feel clear, calm, and serious. It should not become a wall of tables.

### PDF

The PDF is the serious artifact:

1. cover and one-page memo
2. investment thesis
3. what changed
4. business quality
5. financial statement analysis
6. value discipline scorecard
7. valuation
8. risks and kill switches
9. evidence book
10. appendix tables

Normal target length: 8-12 pages when full data exists. Sparse-data reports may be shorter but must state omissions clearly.

The canonical page-by-page template is `DEEPDIVE_REPORT_TEMPLATE.md`. Implementation must follow it unless the owner records a new decision.

---

## Product Requirements

| Requirement | Definition |
|---|---|
| Institutional memo | Report opens with a clear investment argument and decision question |
| 5-year financial view | Revenue, margins, cash flow, debt, share count, and key quality metrics where available |
| Value discipline | Piotroski-inspired analysis plus quality/valuation context |
| Valuation discipline | DCF or deterministic valuation range with assumptions, scenarios, and margin of safety |
| Evidence-backed writing | Every material claim traces to evidence, metric, valuation input, or omission |
| Omission truth | Missing data is shown directly and affects confidence |
| Mobile readability | A user can understand the report on phone without reading every appendix table |
| Serious PDF | Export reads like a research artifact, not mobile-card printout |
| Backward compatibility | Old reports still open |
| Reference fidelity | `report.pdf` and `value investing.pdf` are mapped into Thesis requirements without copying text, branding, or proprietary layout |
| Testability | Output must satisfy `DEEPDIVE_TEST_MATRIX.md`, including hard fail conditions for shallow, unsupported, or fake-complete reports |

---

## Non-Goals

- Brokerage holdings sync
- Buy/sell execution
- Social/shared research
- Decorative AI images
- Copying the provided PDF layouts or text
- Turning Piotroski into the only investment score
- Replacing existing Research navigation

---

## Acceptance Summary

Deep Dive Revamp is successful when a user can open a company report and say:

> I understand the thesis, the numbers behind it, the valuation, the value-investing quality, what changed, what could break, and what evidence was used.
