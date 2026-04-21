# M5.2 Evidence - Visual Exhibits Layer

**Date:** 2026-04-20  
**Milestone:** Deep Dive Revamp M5.2 - Visual Exhibits Layer  
**Status:** Passed

---

## Scope Proven

- The Product API institutional PDF renderer now outputs chart-rich vector exhibits instead of a text-first export only.
- The shipped exhibit set is real-data-backed and omission-aware:
  1. Cover valuation range band
  2. Financial grouped-bar exhibit
  3. Value-discipline signal map
  4. Valuation bridge exhibit
  5. Kill-switch coverage bars
- Sparse-data reports now render explicit omission panels where visual honesty would otherwise break.
- Legacy schema `1.x` report export remains available and omission-forward.

---

## Decisions Applied

- Implemented M5.2 inside the existing Product API renderer utility rather than adding a second rendering stack.
- Kept the visual language Thesis-native: thin borders, gold accenting, restrained neutral ink, and editorial exhibit cards.
- Locked the visual layer to deterministic figure mapping only; no decorative imagery or inferred chart values are emitted.

---

## Commands Run

```powershell
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/product-api test
```

Both commands passed.  
Full `product-api` suite result: **92 passed, 0 failed**.

---

## Smoke Checklist Results

1. Full-data report export: **Passed** (`deepdive-m5-pdf-export.test.ts`).
2. Chart-rich PDF generated to evidence folder: **Passed**.
3. Rendered PNG page proof: **Passed** (9 pages rendered).
4. Financial exhibit present: **Passed** (`Exhibit - Margin Profile`).
5. Value-discipline exhibit present: **Passed** (`Exhibit - Value Discipline Signal Map`).
6. Valuation exhibits present: **Passed** (`Exhibit - Valuation Range`, `Exhibit - Valuation Bridge`).
7. Risk/kill-switch exhibit present: **Passed** (`Exhibit - Kill-Switch Coverage`).
8. Sparse-data fallback behavior: **Passed** (dedicated sparse-report export test).
9. Legacy export compatibility: **Passed** (legacy-report export test).

---

## Visual QA Notes

- Page 1 now ends with a proper valuation range-band card instead of pure text only.
- Page 4 now shows a real grouped-bar comparison for gross versus operating margin progression.
- Page 5 now uses a readable signal-map card rather than clipped detail text.
- Page 6 now shows a compact valuation bridge that makes low/mid/high anchor differences legible.
- Page 7 now shows kill-switch rule coverage by signal family when those rules exist.
- Sparse cases remain honest: omission panels replace unsupported charts instead of implying precision.

---

## Artifact Paths

- PDF sample:  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample.pdf`

- Rendered pages:  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_01.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_02.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_03.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_04.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_05.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_06.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_07.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_08.png`  
  `Project Note/DeepDive/Milestones/M5_2/evidence/2026-04-20/m5_2_visual_export_sample_page_09.png`

---

## Representative Code Evidence

- Renderer utility: `apps/product-api/src/report-pdf.ts`
- Route integration: `apps/product-api/src/server.ts`
- Integration tests:
  - `apps/product-api/tests/deepdive-m5-pdf-export.test.ts`
