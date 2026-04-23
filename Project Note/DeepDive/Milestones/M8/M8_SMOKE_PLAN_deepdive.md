# M8 Smoke Plan - Due Diligence Default Upgrade

**Milestone:** M8 - Due Diligence Default Upgrade
**Status:** In Progress

---

## Smoke Steps

1. Run contract, Product API, Dexter, and mobile checks relevant to the additive report shape.
2. Generate one full-data Deep Dive report and confirm `investment_memo` plus all six `due_diligence` sections exist.
3. Generate one sparse/degraded report and confirm every missing section degrades with explicit omissions.
4. Open a legacy report and confirm compatibility rendering still works.
5. Export a full-data PDF and confirm the 10-14 page target with evidence and appendix preserved.
6. Open the report on mobile and confirm summary-first reading plus expandable proof per due-diligence section.
7. Update the acceptance register with proof links and any explicit limitations.

---

## Evidence Required

- Test output summary
- One full-data structured report artifact
- Sparse/degraded proof from automated regression tests or stored structured artifact
- Legacy report fallback proof from automated regression tests or stored retrieval artifact
- Exported PDF path and rendered page images
- Mobile screenshots showing collapsed and expanded states
- Closeout note documenting omissions, limitations, and fallback behavior

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Pass | `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Contracts, Dexter, Product API, and Android unit checks passed for the additive report shape |
| 2 | Pass | `evidence/2026-04-21/m8_due_diligence_full_report.json`, `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Full-data report contains `investment_memo` plus all six canonical `due_diligence` sections |
| 3 | Pass | `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Sparse/degraded omission behavior is covered by contract, pipeline, and PDF regression tests |
| 4 | Pass | `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Legacy compatibility path is covered by Product API validation and PDF fallback tests |
| 5 | Pass | `evidence/2026-04-21/m8_due_diligence_full_report.pdf`, `evidence/2026-04-21/m8_pdf_render_summary.json`, `evidence/2026-04-21/m8_due_diligence_full_report_page_01.png` | Full-data PDF hit 10 pages with appendix/source notes preserved |
| 6 | Pending | `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Android unit coverage is green, but trustworthy device/emulator screenshots were not captured due runtime instability |
| 7 | Pass | `../../DeepDive_ACCEPTANCE.md`, `evidence/2026-04-21_m8-due-diligence-default-proof.md` | Acceptance register updated with explicit pass/pending split and limitations |
