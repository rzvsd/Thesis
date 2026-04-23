# Deep Dive Revamp PRD

**Status:** Active
**Last Revised:** 2026-04-22
**Product Surface:** Research -> Deep Dive, History, PDF export

---

## Problem

The M0-M7 revamp established a serious report foundation, and M8 makes full due diligence the default artifact. The next gap is editorial depth and export quality: the report can still feel too compressed, and the serious PDF path still needs a print-first editorial standard.

For Thesis to justify trust and subscription value, `Deep Dive` must remain the product entrypoint while the default report becomes a verbose, issuer-aware due diligence artifact with summary-first ergonomics on mobile and a serious HTML/CSS-to-PDF editorial export.

---

## User Promise

Thesis gives the user a serious company due diligence report that explains:

- the decision question and current stance
- what changed and why now
- what the financials and value-discipline signals say
- how strong the competitive position is
- what management and governance signal
- what risks and challenges could break the thesis
- what growth opportunities and outlook could improve it
- what valuation and thesis stance follow
- what evidence supports the conclusion
- what is missing or uncertain

---

## Target Users

| User | Need |
|---|---|
| Non-technical investor | Understand the thesis without reading raw filings |
| Serious individual investor | See the numbers, valuation, risks, governance, and source trail |
| Builder/owner | Evaluate names with discipline before making or revisiting decisions |
| Analyst-style user | Export a credible report artifact with tables and evidence |

---

## User Experience

### In App

The phone experience is summary-first and inline proof-expandable:

1. hero summary: ticker, company, stance, confidence, freshness, one-sentence thesis
2. why now: decision question, top changes, top risks, coverage truth
3. `financial_analysis`
4. `competitive_positioning`
5. `management_and_governance`
6. `risks_and_challenges`
7. `growth_opportunities_and_outlook`
8. `valuation_and_thesis_stance`
9. evidence, omissions, appendix entry, and PDF export

Each long-form section must open with a short takeaway and then expand inline into proof. The user must not need to open every proof module just to understand the thesis, and verbose due-diligence writing must not default to expanded long-form text on phone.

### PDF

The PDF is the serious artifact, generated through the editorial HTML/CSS-to-PDF path:

1. Deep Dive cover and compatibility summary
2. why now / what changed / coverage truth
3. `financial_analysis`
4. `competitive_positioning`
5. `management_and_governance`
6. `risks_and_challenges`
7. `growth_opportunities_and_outlook`
8. `valuation_and_thesis_stance`
9. evidence book and omission ledger
10. appendix tables and metadata

Normal target length: 10-14 pages when full data exists. Sparse-data reports may compress below that target, but only if omissions are explicit and supporting pages degrade honestly. M9 keeps the same page target while adding more editorial due-diligence body, issuer metadata, and print-layout discipline.

The canonical editorial PDF and mobile reader template is `DEEPDIVE_REPORT_TEMPLATE.md`. Implementation must follow it unless the owner records a new decision.

---

## Product Requirements

| Requirement | Definition |
|---|---|
| Keep `Deep Dive` name | The user-facing product entrypoint remains `Deep Dive` |
| Due diligence by default | The default output is a full due diligence report, not just a short memo |
| Canonical `due_diligence` layer | The long-form artifact has six required sections and is the source of truth |
| `investment_memo` compatibility | A short summary layer remains for compatibility and summary-first entry points |
| Verbose due-diligence authoring | Each canonical section opens with a takeaway and includes enough editorial body to explain evidence, causality, uncertainty, and omissions |
| Financial and value discipline | Financial statement analysis, trend math, and Piotroski-style/contextual value logic stay present inside the due-diligence model |
| Competitive positioning | The report explains moat, market structure, segment/revenue mix, and peer framing when evidence exists |
| Management and governance | The report surfaces leadership, incentives, capital allocation, and governance evidence or omissions |
| Risks and outlook | Risks/challenges and growth/outlook are distinct, explicit sections |
| Valuation and thesis stance | Deterministic valuation range, assumptions, scenarios, margin of safety, and stance synthesis remain mandatory |
| Issuer metadata | The report surfaces ticker/company identity plus listing, currency, domicile/region, and sector/industry context where supported, with explicit metadata omissions otherwise |
| Omission truth | Missing data is shown directly and affects confidence in every section |
| Mobile readability | A user can understand the report on phone before expanding detailed proof, and proof expands inline instead of replacing the summary-first flow |
| Serious PDF | Export reads like a research artifact, not a mobile-card printout, and uses the HTML/CSS-to-PDF editorial path inside the 10-14 page target |
| Backward compatibility | Old reports still open and compatibility consumers still function |
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
- Renaming the Deep Dive entrypoint

---

## Acceptance Summary

Deep Dive Revamp is successful when a user can open a company report and say:

> I understand the thesis, the financials, the competitive position, the management and governance picture, the main risks, the growth outlook, the valuation, the supporting evidence, and what Thesis still does not know.
