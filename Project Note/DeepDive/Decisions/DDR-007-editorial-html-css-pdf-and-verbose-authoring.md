# DDR-007 - Deep Dive Uses Editorial HTML/CSS-to-PDF Export And Verbose Due Diligence Authoring

**Status:** Accepted
**Date:** 2026-04-22

---

## Decision

M9 keeps the canonical six-section `due_diligence` layer from M8, but upgrades the report standard in two ways:

- the long-form `due_diligence` body becomes a verbose editorial report rather than compressed section fill
- the serious export path becomes HTML/CSS-to-PDF editorial output while staying inside the 10-14 page target for normal full-data reports

This upgrade also makes issuer metadata a required part of the report surface and preserves mobile as a summary-first inline-expand reader.

---

## Rationale

M8 establishes the canonical long-form due-diligence shape, but that alone does not guarantee the report reads like a serious editorial artifact. The next gap is quality of explanation and quality of print rendering: the report must explain more, but do so with editing discipline and print-ready layout rather than uncontrolled verbosity or UI-derived exports.

---

## Consequences

- `investment_memo` stays short and compatibility-safe while verbose detail belongs to canonical `due_diligence`
- editorial PDF export remains owned by Product API and uses an HTML/CSS print path instead of a separate renderer service
- issuer metadata becomes mandatory on the report cover and metadata appendix, with omission-forward fallback when fields are unavailable
- mobile remains summary-first and expands inline into proof rather than defaulting to long-form text
- tests must prove authoring depth, print quality, page discipline, issuer metadata, and backward compatibility

---

## Guardrails

- Do not change the six-section `due_diligence` taxonomy.
- Do not let `investment_memo` become a second long-form report.
- Do not let full-data reports spill past 14 pages without explicit editorial degradation or owner-approved change.
- Do not invent issuer metadata fields when they are unsupported.
- Do not turn mobile into a default expanded report view.
