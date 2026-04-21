# M5 AGENTS - Institutional PDF Export

**Milestone:** Deep Dive Revamp M5 - Institutional PDF Export
**Status:** Closed (2026-04-20)
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Product API Engineer + PDF/Design Owner |
| Depends on | M1-M4 closed |
| Services | `apps/product-api`, PDF rendering utility, mobile export entry if needed |
| Contracts | PDF export metadata and report artifact |

---

## Scope

- [x] Generate PDF from structured report artifact
- [x] Include memo, thesis, financial exhibits, value score, valuation, risks, evidence, appendix
- [x] Render pages for visual QA
- [x] Add export tests
- [x] Preserve legacy export fallback
- [x] Prove PDF follows the page-by-page template, not mobile-card layout

## Out Of Scope

- Copying reference PDF layout or branding
- Decorative imagery
- New top-level app navigation

## Required Tests

- [x] Product API export tests
- [x] PDF generation smoke
- [x] Rendered page visual inspection
- [x] Legacy export fallback test
- [x] M5 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [x] PDF reads like a serious report artifact
- [x] No clipped text or broken tables
- [x] Source notes and omissions are present
- [x] PDF satisfies `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Smoke plan passes

## Decisions Applied

- Resolved M5 O2 ownership as Product API-owned renderer utility (`report-pdf.ts`) with no new service.
- Implemented institutional export route at `GET /v1/reports/:reportId/export/pdf`.
- Preserved existing mobile export entry as fallback behavior to avoid regression while introducing backend institutional export.

## Evidence

- `Milestones/M5/evidence/2026-04-20_m5-institutional-pdf-proof.md`
