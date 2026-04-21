# M5.2 Smoke Plan - Visual Exhibits Layer

**Milestone:** M5.2 - Visual Exhibits Layer
**Status:** Passed (2026-04-20)

---

## Smoke Steps

1. Generate a full-data Deep Dive report.
2. Export PDF with the M5.2 visual layer enabled.
3. Render PDF pages to images.
4. Confirm the report uses chart-rich exhibits rather than plain text-first panels alone.
5. Confirm at least one financial exhibit, one valuation exhibit, and one change/risk exhibit are visually rendered from real report figures.
6. Confirm axes, legends, units, and period labels are readable.
7. Generate a sparse-data/degraded report and confirm omission-aware panels replace unsupported charts.
8. Confirm legacy export path still works.
9. Confirm the PDF still follows `DEEPDIVE_REPORT_TEMPLATE.md` and `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`.

---

## Evidence Required

- Chart-rich PDF path
- Rendered PNG page proofs
- Visual QA note
- Sparse/degraded fallback proof
- Legacy compatibility test output
- Exhibit checklist mapped to approved visual families

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Full-data AAPL fixture exported through live renderer |
| 2 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Chart-rich PDF sample written to milestone evidence folder |
| 3 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Nine rendered PNG page proofs captured with PyMuPDF |
| 4 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Memo, financial, value, valuation, and risk pages now include real-data exhibits |
| 5 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Financial bars, value scorecard, valuation bridge, and kill-switch coverage all render from artifact data |
| 6 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Visual QA confirms axes/labels/legends remain readable after renderer cleanup |
| 7 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Sparse fixture test proves omission-aware panels replace unsupported visuals |
| 8 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Legacy schema export remains exportable and omission-forward |
| 9 | Passed | `evidence/2026-04-20_m5_2-visual-exhibits-proof.md` | Output aligns to report template and visual exhibits standard |
