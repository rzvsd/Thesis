# Deep Dive Revamp

**Status:** Active planning
**Last Revised:** 2026-04-20
**Predecessors:** Phase 2 M7 report UX, Phase 5 active intelligence, Phase 6 data substrate
**Reference PDFs:** `report.pdf`, `value investing.pdf`

---

## Purpose

Deep Dive Revamp turns Thesis from a short generated research summary into a serious investment research product.

The current Deep Dive proves that Thesis can assemble evidence, trust metadata, valuation panels, and a mobile reading flow. That is useful, but it does not yet feel like an institutional research memo or a report a user would rely on before allocating meaningful capital.

This workstream creates a new report standard:

- a structured investment memo
- deterministic financial analysis
- a value-investing discipline layer
- evidence-backed narrative writing
- a serious PDF artifact
- a mobile reader that summarizes without flattening the research

---

## Source References

| File | What It Teaches Thesis |
|---|---|
| `report.pdf` | Institutional research structure: central thesis, exhibits, charts, appendix, page discipline, evidence-backed narrative |
| `value investing.pdf` | Value-investing logic: historical financial statement signals, profitability, cash flow, leverage, liquidity, operating efficiency, F_SCORE discipline |

These PDFs are reference material. They do not authorize copying proprietary text, layouts, or branding. They define the quality bar and the reasoning patterns.

The exact translation from reference idea to Thesis requirement is locked in `DEEPDIVE_REFERENCE_MAPPING.md`.

---

## Core Product Question

Would a serious investor feel that the Deep Dive is worth reading before making or revisiting a capital allocation decision?

If the answer is no, the milestone is not done.

---

## Document Map

| Document | Purpose |
|---|---|
| `DeepDive_AGENTS.md` | Operating rules for this workstream |
| `DeepDive_BLUEBOOK.md` | Architecture and service boundaries |
| `DeepDive_PRD.md` | Product requirements and user experience intent |
| `DeepDive_MILESTONES.md` | Milestones, acceptance criteria, smoke tests, rollback |
| `DeepDive_ROADMAP.md` | Implementation sequence and dependencies |
| `DeepDive_DECISION_LOCKS.md` | Locked decisions and unresolved decisions |
| `DEEPDIVE_REPORT_STANDARD.md` | Canonical report structure and quality bar |
| `DEEPDIVE_REFERENCE_MAPPING.md` | What the two PDFs teach Thesis, and what must not be copied |
| `DEEPDIVE_REPORT_TEMPLATE.md` | Page-by-page PDF template and mobile reader template |
| `DEEPDIVE_TEST_MATRIX.md` | Required tests, fixtures, hard gates, and fail conditions |
| `DeepDive_ACCEPTANCE.md` | Workstream-level acceptance register |
| `Milestones/M#/` | Milestone-local guides, smoke plans, evidence |
| `Decisions/` | Deep Dive Revamp ADRs |

---

## Milestone Index

| # | Name | One-Line Outcome |
|---|---|---|
| M0 | Report Standard and Interface Lock | Defines what a serious Thesis report must be |
| M1 | Structured Report Contract | Adds the typed report artifact without breaking old reports |
| M2 | Financial Analysis Engine | Computes real financial tables, trends, and quality metrics |
| M3 | Value Discipline Scorecard | Adds Piotroski-inspired value logic with context-aware weighting |
| M4 | Research Authoring Engine | Upgrades Dexter from section assembly to evidence-backed memo writing |
| M5 | Institutional PDF Export | Produces a serious report artifact with exhibits and appendix |
| M6 | Mobile Research Reader | Turns mobile Deep Dive into a guided executive reading surface |
| M7 | End-to-End Quality and Device Proof | Proves the full workflow from run to report to PDF to phone |

---

## Non-Negotiables

- No fabricated data.
- No unsourced investment claims.
- No valuation without assumptions and omissions.
- No Piotroski score when required inputs are missing.
- No PDF that is just a screenshot of mobile cards.
- No UI-only closeout without backend/report artifact proof.
- Existing Deep Dive reports must remain readable.
- No milestone may close with a shallow report that violates `DEEPDIVE_REPORT_TEMPLATE.md`.
