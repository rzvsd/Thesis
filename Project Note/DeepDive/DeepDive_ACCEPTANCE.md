# Deep Dive Revamp Acceptance Register

**Status:** M8 closeout pending; M9 implementation complete with final closeout pending
**Last Revised:** 2026-04-22

---

## Foundation Acceptance (M0-M7)

| Requirement | Status | Evidence |
|---|---|---|
| Formal Deep Dive workstream docs exist | Passed | `Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` |
| Report standard is locked | Passed | `DEEPDIVE_REPORT_STANDARD.md` |
| Reference PDFs are mapped to Thesis requirements | Passed | `DEEPDIVE_REFERENCE_MAPPING.md` |
| Editorial PDF and mobile reader template is locked | Passed | `DEEPDIVE_REPORT_TEMPLATE.md` |
| Test matrix and hard fail gates are locked | Passed | `DEEPDIVE_TEST_MATRIX.md` |
| Structured report contract exists | Passed | `Milestones/M1/evidence/2026-04-20/m1-contract-proof.md` |
| Financial analysis engine exists | Passed | `Milestones/M2/evidence/2026-04-20_m2-financial-analysis-proof.md` |
| Value discipline scorecard exists | Passed | `Milestones/M3/evidence/2026-04-20_m3-value-discipline-proof.md` |
| Dexter authors memo-quality narrative | Passed | `Milestones/M4/evidence/2026-04-20_m4-research-authoring-proof.md` |
| Institutional PDF export exists | Passed | `Milestones/M5/evidence/2026-04-20_m5-institutional-pdf-proof.md` |
| Visual exhibit layer exists | Passed | `Milestones/M5_2/evidence/2026-04-20_m5_2-visual-exhibits-proof.md` |
| Mobile reader renders new artifact | Passed | `Milestones/M6/evidence/2026-04-21_m6-device-reader-proof.md` |
| End-to-end device and PDF proof complete | Passed | `Milestones/M7/evidence/2026-04-21_m7-closeout-proof.md` |
| Live OpenRouter Deep Dive generation is proven | Passed | `Milestones/M7/evidence/2026-04-21/m7_live_closeout_summary.json` |

---

## Follow-On Upgrade Acceptance (M8 Due Diligence Default)

| Requirement | Status | Evidence |
|---|---|---|
| `Deep Dive` remains the user-facing product name | Passed | `DeepDive_DECISION_LOCKS.md`, `Decisions/DDR-006-due-diligence-default-layer.md` |
| Follow-on milestone naming is locked as `M8` in existing DeepDive style | Passed | `DeepDive_DECISION_LOCKS.md`, `DeepDive_MILESTONES.md`, `DeepDive_ROADMAP.md` |
| Canonical `due_diligence` layer with six sections is locked in docs | Passed | `DeepDive_BLUEBOOK.md`, `DEEPDIVE_REPORT_STANDARD.md`, `DEEPDIVE_REPORT_TEMPLATE.md` |
| `investment_memo` remains a short compatibility summary layer | Passed | `DeepDive_BLUEBOOK.md`, `DeepDive_DECISION_LOCKS.md` |
| M8 milestone scaffolding exists | Passed | `Milestones/M8/M8_MILESTONE_AGENTS_deepdive.md`, `Milestones/M8/M8_SMOKE_PLAN_deepdive.md` |
| Additive `due_diligence` contract and validators are implemented | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Dexter emits all six canonical due-diligence sections for full-data reports | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Sparse and degraded due-diligence paths remain omission-forward | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Full-data PDF export produces a due-diligence report in the 10-14 page target | Passed | `Milestones/M8/evidence/2026-04-21/m8_due_diligence_full_report.pdf`, `Milestones/M8/evidence/2026-04-21/m8_pdf_render_summary.json`, `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Legacy reports still render through fallback behavior | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Android summary-first mapper/offline/unit coverage is green for due-diligence reports | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Stored M8 evidence bundle exists for full-data report JSON, PDF, and rendered pages | Passed | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| Device or Maestro proof for summary-first + expand behavior is recorded | Pending | `Milestones/M8/evidence/2026-04-21_m8-due-diligence-default-proof.md` |
| M8 closeout is complete | Pending | `DeepDive_MILESTONES.md`, `Milestones/M8/M8_SMOKE_PLAN_deepdive.md` |

---

## M8 Closeout Bar

The follow-on upgrade is complete only when:

- a generated report contains `investment_memo` plus the six canonical `due_diligence` sections
- full-data PDF output lands in the 10-14 page target with evidence and appendix
- phone reader is summary-first and expands into proof without losing report truth
- old reports still render
- missing data is explicit in every section
- tests and smoke evidence are recorded
- the output satisfies the reference mapping, report template, and test matrix

---

## Follow-On Upgrade Acceptance (M9 Verbose Due Diligence Authoring And Editorial PDF Upgrade)

| Requirement | Status | Evidence |
|---|---|---|
| Follow-on milestone naming continues as `M9` in the existing DeepDive style | Passed | `DeepDive_DECISION_LOCKS.md`, `DeepDive_MILESTONES.md`, `DeepDive_ROADMAP.md` |
| M9 milestone scaffolding exists | Passed | `Milestones/M9/M9_MILESTONE_AGENTS_deepdive.md`, `Milestones/M9/M9_SMOKE_PLAN_deepdive.md` |
| Verbose due-diligence authoring standard is locked in docs | Passed | `DEEPDIVE_REPORT_STANDARD.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `Decisions/DDR-007-editorial-html-css-pdf-and-verbose-authoring.md` |
| Editorial HTML/CSS-to-PDF export remains inside the 10-14 page target in docs | Passed | `DeepDive_DECISION_LOCKS.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `Decisions/DDR-007-editorial-html-css-pdf-and-verbose-authoring.md` |
| Issuer metadata requirement is locked in docs | Passed | `DeepDive_DECISION_LOCKS.md`, `DEEPDIVE_REPORT_STANDARD.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `DeepDive_PRD.md` |
| Mobile remains summary-first with inline expand in docs | Passed | `DeepDive_DECISION_LOCKS.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `DeepDive_PRD.md` |
| M9 implementation is complete | Passed | `Milestones/M9/evidence/2026-04-22_m9-verbose-due-diligence-proof.md` |
| M9 evidence bundle exists | Passed | `Milestones/M9/evidence/2026-04-22_m9-verbose-due-diligence-proof.md`, `Milestones/M9/evidence/2026-04-22/` |
| M9 closeout is complete | Pending | `DeepDive_MILESTONES.md`, `Milestones/M9/M9_SMOKE_PLAN_deepdive.md` |

---

## M9 Closeout Bar

The editorial follow-on upgrade is complete only when:

- a generated report keeps `investment_memo` short while all six canonical `due_diligence` sections meet the verbose editorial standard
- full-data HTML/CSS-to-PDF output lands in the 10-14 page target with issuer metadata, evidence, and appendix preserved
- phone reader is summary-first and expands inline into proof without defaulting to expanded long-form text
- sparse and legacy reports remain omission-forward and backward compatible
- tests, smoke proof, rendered pages, and mobile screenshots are recorded
- the output satisfies the reference mapping, report template, and test matrix
