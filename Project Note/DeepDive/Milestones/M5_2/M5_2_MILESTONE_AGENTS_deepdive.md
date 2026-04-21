# M5.2 AGENTS - Visual Exhibits Layer

**Milestone:** Deep Dive Revamp M5.2 - Visual Exhibits Layer
**Status:** Closed (2026-04-20)
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Product API Engineer + Report Design Owner |
| Depends on | M1-M5 closed |
| Services | `apps/product-api`, PDF rendering utility, report artifact visual-mapping logic |
| Contracts | Structured report artifact, PDF exhibit descriptors, visual exhibit metadata if needed |

---

## Scope

- [x] Upgrade the PDF from structurally serious to visually publication-worthy
- [x] Render chart-rich exhibits from real report figures only
- [x] Apply the approved visual families from `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`
- [x] Keep omission-aware fallback when data is sparse or degraded
- [x] Preserve Thesis visual language while making exhibits more editorial and legible
- [x] Keep legacy export compatibility and deterministic figure mapping

## Out Of Scope

- Decorative or synthetic imagery
- Copying proprietary report layouts or branding
- Mobile-first chart implementation
- New external data providers only for exhibit polish

## Required Tests

- Chart data-mapping tests
- PDF visual-render tests
- Sparse-data fallback tests
- Legacy export compatibility tests
- M5.2 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] PDF contains chart-rich exhibits that materially improve readability
- [x] Every exhibit is backed by real report data or deterministic transforms
- [x] Sparse-data paths render omission-aware panels instead of fake completeness
- [x] Output satisfies `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`
- [x] Smoke plan passes

## Decisions Applied

- M5.2 is a dedicated milestone between M5 and M6 so visual richness is implemented before mobile inherits the exhibit language.
- Visual references set quality direction only; Thesis does not copy proprietary layouts.
- The visual layer remains memo-first and evidence-honest.
- Implemented chart-rich vector exhibits directly inside the Product API renderer with no new service or external chart dependency.
- Locked the shipped exhibit set to range band, grouped bars, scorecard, valuation bridge, and kill-switch coverage, each with omission-aware fallback.

## Evidence

- `Milestones/M5_2/evidence/2026-04-20_m5_2-visual-exhibits-proof.md`
