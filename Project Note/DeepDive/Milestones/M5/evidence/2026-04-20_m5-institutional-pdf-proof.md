# M5 Evidence - Institutional PDF Export

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M5 - Institutional PDF Export  
**Status:** Passed

---

## Scope Proven

- Product API now exports a multi-page institutional Deep Dive PDF from the structured report artifact.
- Export route is authenticated and access-controlled: `GET /v1/reports/:reportId/export/pdf`.
- Export remains legacy-safe: schema `1.x` reports still export with explicit omission language.
- PDF structure follows the locked template order:
  1. Cover and memo
  2. Thesis and what changed
  3. Business quality
  4. Financial analysis
  5. Value discipline
  6. Valuation and scenarios
  7. Risks and kill switches
  8. Evidence book
  9. Appendix

---

## Decisions Applied (Recommended Path)

- Resolved M5 open decision O2 with a Product API-owned renderer utility (`report-pdf.ts`), no new service introduced.
- Implemented deterministic text-first PDF rendering from `AnalysisReport` fields, omission-forward when fields are missing.
- Preserved existing mobile export entry behavior as fallback while backend institutional export path is introduced.

---

## Commands Run

```powershell
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/product-api test
```

Both commands passed.

---

## Smoke Checklist Results

1. Complete Deep Dive report export route: **Passed** (`deepdive-m5-pdf-export.test.ts`).
2. PDF generation path: **Passed** (integration test + generated artifact file).
3. Render pages to images for visual QA: **Passed** (9 PNG renders captured).
4. Cover/memo/financial/value/valuation/risks/evidence/appendix presence: **Passed** (page-title and content assertions + visual renders).
5. Source notes and omissions: **Passed** (appendix and omission-forward text assertions).
6. Legacy fallback export: **Passed** (`deepdive-m5-pdf-export.test.ts` legacy case).
7. Template compliance and non-card-dump shape: **Passed** (fixed page structure + page numbering).

---

## Artifact Paths

- PDF sample:  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample.pdf`
- Rendered pages:  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_01.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_02.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_03.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_04.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_05.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_06.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_07.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_08.png`  
  `Project Note/DeepDive/Milestones/M5/evidence/2026-04-20/m5_institutional_export_sample_page_09.png`

---

## Representative Code Evidence

- Product API renderer utility: `apps/product-api/src/report-pdf.ts`
- Product API route integration: `apps/product-api/src/server.ts`
- Integration tests:
  - `apps/product-api/tests/deepdive-m5-pdf-export.test.ts`
