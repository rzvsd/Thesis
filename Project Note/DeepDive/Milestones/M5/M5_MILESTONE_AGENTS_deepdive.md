# M5 AGENTS - Institutional PDF Export

**Milestone:** Deep Dive Revamp M5 - Institutional PDF Export
**Status:** Pending
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

- [ ] Generate PDF from structured report artifact
- [ ] Include memo, thesis, financial exhibits, value score, valuation, risks, evidence, appendix
- [ ] Render pages for visual QA
- [ ] Add export tests
- [ ] Preserve legacy export fallback
- [ ] Prove PDF follows the page-by-page template, not mobile-card layout

## Out Of Scope

- Copying reference PDF layout or branding
- Decorative imagery
- New top-level app navigation

## Required Tests

- Product API export tests
- PDF generation smoke
- Rendered page visual inspection
- Legacy export fallback test
- M5 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [ ] PDF reads like a serious report artifact
- [ ] No clipped text or broken tables
- [ ] Source notes and omissions are present
- [ ] PDF satisfies `DEEPDIVE_REPORT_TEMPLATE.md`
- [ ] Smoke plan passes
