# DDR-006 - Deep Dive Uses A Canonical Due Diligence Layer

**Status:** Accepted
**Date:** 2026-04-21

---

## Decision

`Deep Dive` remains the product entrypoint name, but the default long-form report becomes a canonical `due_diligence` layer.

That canonical layer contains exactly six sections:

- `financial_analysis`
- `competitive_positioning`
- `management_and_governance`
- `risks_and_challenges`
- `growth_opportunities_and_outlook`
- `valuation_and_thesis_stance`

`investment_memo` remains in the artifact as a short compatibility summary layer.

---

## Rationale

The M0-M7 revamp proved that Thesis can generate a serious report artifact, but the default product posture still leaned too heavily on memo-first presentation. The approved next step is to make due diligence the default shape while preserving the familiar `Deep Dive` entrypoint and backward-compatible summary behavior.

This keeps the product understandable on phone, but raises the default artifact to a fuller research standard.

---

## Consequences

- Contracts must treat `due_diligence` as the canonical long-form truth.
- `investment_memo` must summarize or project from the canonical report instead of becoming a second report system.
- Full-data PDF output now targets 10-14 pages.
- Mobile must be summary-first and expand into section proof.
- Omissions must stay explicit in every section.

---

## Guardrails

- Do not rename the Deep Dive product entrypoint.
- Do not let `investment_memo` contradict canonical due diligence.
- Do not drop value-discipline logic; remap it into the new section taxonomy.
- Do not hide sparse-data states with polished filler prose.
