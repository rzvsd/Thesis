# M0 Smoke Plan - Deep Dive Revamp

**Milestone:** M0 - Report Standard and Interface Lock
**Status:** Passed

---

## Purpose

Prove that Deep Dive Revamp is a governed workstream before implementation starts.

---

## Smoke Steps

1. Confirm root docs exist.
2. Confirm reference PDFs exist.
3. Confirm foundation M0-M7 folders exist.
4. Confirm each foundation milestone has AGENTS, smoke plan, and evidence folder.
5. Confirm decisions are present under `Decisions/`.
6. Confirm report standard names required sections.
7. Confirm reference mapping exists and references both PDFs.
8. Confirm report template defines PDF pages and mobile reader order.
9. Confirm test matrix defines milestone gates and fail conditions.

---

## Evidence Required

- File inventory
- Decision inventory
- Report standard path
- Smoke summary JSON or Markdown note

---

## Pass/Fail

| Step | Result | Evidence | Notes |
|---|---|---|---|
| 1 | PASS | `Project Note/DeepDive/Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` | Root docs present |
| 2 | PASS | `Project Note/DeepDive/Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` | `report.pdf` and `value investing.pdf` present |
| 3 | PASS | `Project Note/DeepDive/Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` | Foundation M0-M7 folders present |
| 4 | PASS | `Project Note/DeepDive/Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` | AGENTS, smoke plan, and evidence folder present for the foundation milestones |

Historical scope note:
- This smoke captured the original foundation scaffold before later follow-on milestones were added.
| 5 | PASS | `Project Note/DeepDive/Milestones/M0/evidence/2026-04-20/m0-docs-inventory.json` | DDR-001 through DDR-004 present |
| 6 | PASS | `Project Note/DeepDive/DEEPDIVE_REPORT_STANDARD.md` | Required sections are named |
| 7 | PASS | `Project Note/DeepDive/DEEPDIVE_REFERENCE_MAPPING.md` | Both reference PDFs mapped to Thesis requirements |
| 8 | PASS | `Project Note/DeepDive/DEEPDIVE_REPORT_TEMPLATE.md` | PDF page template and mobile reader order locked |
| 9 | PASS | `Project Note/DeepDive/DEEPDIVE_TEST_MATRIX.md` | Milestone gates, fixtures, and fail conditions locked |
