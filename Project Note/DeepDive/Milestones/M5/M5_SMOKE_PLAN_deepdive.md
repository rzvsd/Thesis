# M5 Smoke Plan - Institutional PDF Export

**Milestone:** M5 - Institutional PDF Export
**Status:** Passed (2026-04-20)

---

## Smoke Steps

1. Generate complete Deep Dive report.
2. Export PDF.
3. Render PDF pages to images.
4. Inspect cover, memo, financials, value score, valuation, risks, evidence, appendix.
5. Confirm source notes and omissions exist.
6. Confirm legacy export fallback remains available.
7. Confirm the PDF follows `DEEPDIVE_REPORT_TEMPLATE.md` and is not a mobile-card printout.

---

## Evidence Required

- PDF file path
- Rendered page screenshots
- Export test output
- Visual QA note
- Template compliance note

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Integration test generates a complete Deep Dive export path |
| 2 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Product API route emits binary PDF with `%PDF-1.4` header |
| 3 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | 9 PDF pages rendered to PNG via `fitz` |
| 4 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Memo/financials/value/valuation/risks/evidence/appendix all present in export shape |
| 5 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Source notes + omission-forward content captured in appendix/evidence pages |
| 6 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Legacy schema export test confirms fallback path is still exportable |
| 7 | Passed | `evidence/2026-04-20_m5-institutional-pdf-proof.md` | Fixed template-aligned page order with page numbers; not a mobile-card dump |
