# M9 Smoke Plan - Verbose Due Diligence Authoring And Editorial PDF Upgrade

**Milestone:** M9 - Verbose Due Diligence Authoring And Editorial PDF Upgrade
**Status:** Implemented; final closeout pending physical-device or Maestro proof

---

## Smoke Steps

1. Run contract, Product API, Dexter, and mobile checks relevant to verbose due-diligence authoring, issuer metadata, and editorial export.
2. Generate one full-data Deep Dive report and confirm `investment_memo` remains short while all six `due_diligence` sections render with verbose editorial body.
3. Confirm issuer metadata appears on the cover and metadata appendix, or degrades with explicit metadata omissions.
4. Export one full-data report through the HTML/CSS-to-PDF editorial path and confirm the 10-14 page target with evidence and appendix preserved.
5. Generate sparse/degraded and legacy reports and confirm omission-forward behavior plus fallback compatibility still hold.
6. Open the report on mobile and confirm summary-first reading plus inline expansion into proof by due-diligence section.
7. Update the acceptance register with proof links, known limitations, and any explicit deferrals.

---

## Evidence Required

- Test output summary
- One full-data structured report artifact
- One full-data editorial HTML export artifact
- One full-data editorial PDF plus rendered page images
- Issuer metadata snapshot or appendix metadata table proof
- Sparse/degraded proof from automated regression tests or stored structured artifact
- Legacy report fallback proof from automated regression tests or stored retrieval artifact
- Mobile screenshots showing collapsed and inline-expanded states
- Print QA note documenting layout quality, page count, omissions, and limitations

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | Pass | `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | Contract, Dexter, Product API, and targeted Android reader/offline checks passed |
| 2 | Pass | `evidence/2026-04-22/`, `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | AAPL and NVDA artifacts clear the verbose long-form floor |
| 3 | Pass | `evidence/2026-04-22/`, `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | Issuer metadata is present in the full-data artifacts and validated in contract coverage |
| 4 | Pass | `evidence/2026-04-22/`, `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | Editorial HTML/CSS-to-PDF exports render to 10 pages and preserve the appendix path |
| 5 | Pass | `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | Sparse/degraded and legacy behavior are covered by automated regression tests |
| 6 | Partial | `evidence/2026-04-22/m9_reader_summary.png`, `evidence/2026-04-22/m9_reader_expanded2.png`, `evidence/2026-04-22/m9_reader_evidence_refs.png` | Emulator-backed summary-first and inline-expand proof exists; physical-device or Maestro proof is still open |
| 7 | Pass | `../../DeepDive_ACCEPTANCE.md`, `evidence/2026-04-22_m9-verbose-due-diligence-proof.md` | Acceptance register now records implemented state and the remaining closeout gap |
