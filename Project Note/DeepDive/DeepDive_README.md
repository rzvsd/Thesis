# Deep Dive Revamp

**Status:** M8 closeout pending; M9 planning active
**Last Revised:** 2026-04-22
**Predecessors:** Phase 2 M7 report UX, Phase 5 active intelligence, Phase 6 data substrate
**Reference PDFs:** `report.pdf`, `value investing.pdf`

---

## Purpose

Deep Dive Revamp turned Thesis from a short generated research summary into a serious investment research foundation.

That foundation is now complete through M7. The active follow-on path keeps `Deep Dive` as the entrypoint, makes full due diligence the default artifact in M8, and upgrades that artifact in M9 with verbose editorial authoring, issuer metadata, and HTML/CSS-to-PDF export while preserving backward compatibility and summary-first product ergonomics.

This follow-on standard requires:

- a canonical `due_diligence` layer
- six long-form due-diligence sections
- a short `investment_memo` compatibility layer
- deterministic financial and valuation discipline
- evidence-backed narrative writing
- a serious 10-14 page HTML/CSS-to-PDF editorial artifact
- issuer metadata in the report surface and metadata appendix
- a mobile summary-first reader that expands inline into proof

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
| `DEEPDIVE_REPORT_TEMPLATE.md` | Editorial PDF template and mobile reader template |
| `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md` | Approved exhibit families, styling, and fail conditions for chart-rich output |
| `DEEPDIVE_TEST_MATRIX.md` | Required tests, fixtures, hard gates, and fail conditions |
| `DeepDive_ACCEPTANCE.md` | Workstream-level acceptance register |
| `Milestones/M#/`, `Milestones/M5_2/`, `Milestones/M8/`, and `Milestones/M9/` | Milestone-local guides, smoke plans, and evidence |
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
| M5.2 | Visual Exhibits Layer | Turns PDF exhibits into chart-rich, publication-worthy research visuals |
| M6 | Mobile Research Reader | Turns mobile Deep Dive into a guided executive reading surface |
| M7 | End-to-End Quality and Device Proof | Proves the full workflow from run to report to PDF to phone |
| M8 | Due Diligence Default Upgrade | Keeps the `Deep Dive` name while making full due diligence the default artifact |
| M9 | Verbose Due Diligence Authoring And Editorial PDF Upgrade | Makes due diligence read like an editorial report and exports it through a 10-14 page HTML/CSS-to-PDF path |

---

## Non-Negotiables

- No fabricated data.
- No unsourced investment claims.
- No valuation without assumptions and omissions.
- No Piotroski-style summary without missing-input disclosure.
- No `investment_memo` claim that outruns the canonical `due_diligence` sections.
- No PDF that is just a screenshot of mobile cards.
- No UI-only closeout without backend/report artifact proof.
- Existing Deep Dive reports must remain readable.
- No milestone may close with a shallow report that violates `DEEPDIVE_REPORT_TEMPLATE.md`.
