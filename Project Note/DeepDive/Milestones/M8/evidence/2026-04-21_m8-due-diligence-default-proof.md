# M8 Due Diligence Default Proof

**Milestone:** M8 - Due Diligence Default Upgrade  
**Date:** 2026-04-21  
**Status:** In Progress with one remaining closeout gap

---

## Summary

M8 is implemented across contracts, Dexter, Product API, and Android. The system now supports a canonical additive `due_diligence` layer with six locked long-form sections while preserving `investment_memo` as the short compatibility summary.

What is already proven:

- the additive contract and validators accept `due_diligence`
- Dexter emits all six due-diligence sections for full-data reports
- sparse and degraded runs remain omission-forward instead of inventing depth
- Product API exports a due-diligence PDF that lands in the 10-14 page target for full-data reports
- Android mapper/offline/reader unit coverage passes for summary-first due-diligence flows
- legacy reports continue to render through fallback behavior

What is still open:

- device or Maestro proof for the summary-first mobile reader with collapsed and expanded due-diligence sections

---

## Services And Contracts Touched

- `packages/contracts`
- `apps/dexter-worker`
- `apps/product-api`
- `apps/mobile/android`
- additive `AnalysisReport.due_diligence`

---

## Commands Run

The following quality gates were executed locally and passed:

```text
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/product-api exec tsc -p tsconfig.json
corepack pnpm --filter @thesis/product-api exec node --test dist/apps/product-api/tests/deepdive-m5-pdf-export.test.js
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat :app:testDebugUnitTest --console=plain
.\gradlew.bat :app:installDebug --console=plain
```

The Android unit test command was rerun after updating the due-diligence ordering fixture to the locked mobile reader order.

---

## Full-Data Runtime Evidence

The Product API was started in local in-memory mode and seeded with a full-data AAPL due-diligence report.

Artifacts:

- `evidence/2026-04-21/m8_due_diligence_full_report.json`
- `evidence/2026-04-21/m8_report_history.json`
- `evidence/2026-04-21/m8_due_diligence_full_report.pdf`
- `evidence/2026-04-21/m8_runtime_seed_summary.json`
- `evidence/2026-04-21/m8_pdf_render_summary.json`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_01.png`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_02.png`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_04.png`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_06.png`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_08.png`
- `evidence/2026-04-21/m8_due_diligence_full_report_page_10.png`

Verified properties:

- report contains `investment_memo`
- report contains all six canonical `due_diligence` sections
- exported PDF page count is `10`
- appendix and source-note pages remain present
- rendered pages do not expose raw internal keys or placeholder page titles

---

## Sparse, Degraded, And Legacy Proof

Sparse/degraded behavior and legacy fallback are currently proven through automated regression coverage rather than separate stored runtime artifacts.

Coverage sources:

- `apps/product-api/tests/deepdive-m1-contract.test.ts`
  - validates full, partial, sparse, degraded, no-prior, and legacy fixtures
  - rejects malformed due-diligence sections without `evidence_refs` or `omissions`
- `apps/dexter-worker/tests/pipeline.test.ts`
  - asserts full-data due-diligence section completeness
  - asserts sparse fixtures degrade honestly with omission language
- `apps/product-api/tests/deepdive-m5-pdf-export.test.ts`
  - proves sparse PDF export remains omission-aware
  - proves legacy reports stay exportable through fallback behavior

Result:

- sparse/degraded omission behavior: proven
- legacy fallback behavior: proven

Important compatibility note:

- legacy reports render through fallback behavior only
- M8 does not introduce lazy `due_diligence` projection or stored migration for old reports

---

## Mobile Reader Proof

The Android M8 reader implementation is present and unit-covered.

Covered locally:

- mapper support for six due-diligence sections
- offline codec round-trip for due-diligence reports
- summary-first outline ordering
- reader ordering aligned to the locked template
- debug app install to emulator

Remaining gap:

- no trustworthy device/emulator screenshot set was captured for the summary-first + expand interaction

Reason:

- the emulator session became unstable during proof attempts
- observed issues included `System UI isn't responding`, shell-service failures, and corrupted screenshot attempts

This means M8 mobile code is implemented and tested, but device-level closeout proof is still pending.

---

## Smoke-Step Outcome

| Smoke Step | Result | Basis |
|---|---|---|
| Step 1 - additive report shape checks | Pass | Contracts, Dexter, Product API, and Android unit checks passed |
| Step 2 - full-data report with six sections | Pass | Stored AAPL runtime artifact and PDF export |
| Step 3 - sparse/degraded omission honesty | Pass | Regression tests across contract, pipeline, and PDF export |
| Step 4 - PDF 10-14 page target with appendix | Pass | Stored full-data PDF rendered to 10 pages |
| Step 5 - mobile summary-first reader proof | Pending | Unit coverage is green, but screenshot/device proof is still open |

---

## Current Closeout Position

M8 is not ready to be marked fully closed yet.

The remaining work is narrow and explicit:

- capture trustworthy device or Maestro evidence for the summary-first mobile reader with expand-for-proof behavior
- finish the compatibility no-drift closeout bar if owner wants that demonstrated beyond current regression coverage
