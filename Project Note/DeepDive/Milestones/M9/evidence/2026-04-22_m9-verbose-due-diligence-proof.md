# M9 Verbose Due Diligence And Editorial PDF Proof

**Milestone:** M9 - Verbose Due Diligence Authoring And Editorial PDF Upgrade  
**Date:** 2026-04-22  
**Status:** Implemented with one remaining closeout gap

---

## Summary

M9 is implemented across contracts, Dexter, Product API, and Android.

What is already proven:

- `due_diligence` remains the canonical six-section long-form artifact
- issuer metadata is additive and surfaces in the report header/metadata path
- full-data due-diligence reports now clear the long-form floor, landing above `1,700` authored words
- Product API exports due-diligence reports through the editorial HTML/CSS-to-PDF path
- the editorial export enforces actual rendered page count instead of trusting planned page count
- full-data AAPL and NVDA editorial exports both render to `10` pages
- sparse and legacy paths remain covered by automated regression tests
- Android summary-first reader behavior and inline expand are proven on the emulator with stored screenshots

What is still open:

- a physical-device or Maestro proof run for the M9 mobile flow was not completed in this shell
- export controls remain implemented and previously proven in M6, but were not re-captured as M9-specific mobile proof

---

## Services And Contracts Touched

- `packages/contracts`
- `apps/dexter-worker`
- `apps/product-api`
- `apps/mobile/android`
- additive `AnalysisReport.issuer`
- canonical `AnalysisReport.due_diligence`

---

## Commands Run

The following gates were executed locally and passed during M9 closeout:

```text
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api lint
corepack pnpm --filter @thesis/product-api exec tsc -p tsconfig.json
corepack pnpm --filter @thesis/product-api exec node --test dist/apps/product-api/tests/deepdive-m5-pdf-export.test.js

$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat app:testDebugUnitTest --tests "com.thesis.mobile.model.ReportViewMapperTest" --tests "com.thesis.mobile.model.DeepDiveReaderOutlineTest" --tests "com.thesis.mobile.offline.OfflineJsonCodecTest" --console plain --no-daemon
```

Notable runtime hardening added during closeout:

- due-diligence PDF export no longer silently falls back when the editorial path is available
- editorial export now throws if actual rendered page count does not match the planned editorial outline
- Product API now returns a structured 500 response for PDF export failures instead of resetting the socket

---

## Full-Data Editorial Evidence

Stored artifacts:

- `evidence/2026-04-22/m9_due_diligence_aapl_2026-04-22.json`
- `evidence/2026-04-22/m9_due_diligence_aapl_2026-04-22.pdf`
- `evidence/2026-04-22/m9_due_diligence_nvda_2026-04-22.json`
- `evidence/2026-04-22/m9_due_diligence_nvda_2026-04-22.pdf`
- `evidence/2026-04-22/m9_evidence_summary.json`
- rendered AAPL and NVDA page PNGs under the same folder

Verified properties from the stored evidence summary:

| Report | Due-Diligence Words | Template Pages | Rendered Pages |
|---|---:|---:|---:|
| AAPL | 1752 | 10 | 10 |
| NVDA | 1755 | 10 | 10 |

Editorial page titles:

1. Executive Summary
2. Financial Analysis
3. Financial Exhibits
4. Competitive Positioning
5. Management and Governance
6. Risks and Challenges
7. Growth Outlook
8. Valuation and Stance
9. Evidence and Omissions
10. Appendix

Result:

- full-data reports meet the verbose long-form floor
- editorial exports remain inside the `10-14` page target
- actual rendered page count now matches the planned outline

---

## Sparse And Legacy Regression Proof

Sparse/degraded and legacy behavior are currently proven through automated coverage.

Coverage sources:

- `packages/contracts/tests/analysis-report.test.ts`
  - validates issuer metadata and additive due-diligence schema behavior
  - rejects malformed due-diligence sections without evidence refs or omissions
- `apps/dexter-worker/tests/pipeline.test.ts`
  - asserts six-section completeness on full-data reports
  - asserts sparse fixtures remain omission-forward
  - asserts full-data due-diligence sections clear minimum paragraph/word bars
- `apps/product-api/tests/deepdive-m5-pdf-export.test.ts`
  - proves editorial full-data export
  - proves sparse editorial export
  - proves legacy fallback export

Result:

- sparse/degraded omission behavior: proven
- legacy fallback behavior: proven

---

## Mobile Reader Proof

Stored emulator screenshots:

- `evidence/2026-04-22/m9_reader_summary.png`
- `evidence/2026-04-22/m9_reader_expanded2.png`
- `evidence/2026-04-22/m9_reader_evidence_refs.png`
- additional scroll/expanded screenshots under the same folder

What these screenshots prove:

- summary-first Deep Dive reader opens successfully
- inline expansion reveals long-form due-diligence narrative
- expanded sections expose key points and evidence references
- the reader does not default to an always-open wall of prose

Important proof limitation:

- this proof came from an emulator-backed seeded fixture path, not a physical handset
- no Maestro CLI was available in this shell session
- export controls were not re-captured as M9-specific screenshots

---

## Swarm-Agent Review Notes

Swarm agents were used during M9 closeout to challenge the implementation and proof path.

Key outcomes incorporated into the code and docs:

- PDF export no longer hides editorial-render failures behind silent fallback
- editorial page counts are now verified from the rendered PDF bytes
- stale milestone docs were updated to reflect implemented code instead of leaving M9 as planned
- emulator-backed proof was chosen as the most honest available mobile verification path in this shell

---

## Smoke-Step Outcome

| Smoke Step | Result | Basis |
|---|---|---|
| Step 1 - contracts, Dexter, Product API, and Android checks | Pass | All targeted commands above completed successfully |
| Step 2 - full-data verbose due-diligence authoring | Pass | Stored AAPL and NVDA JSON artifacts clear long-form floor |
| Step 3 - issuer metadata or explicit omission behavior | Pass | Issuer metadata is present in full-data artifacts and validated by contract coverage |
| Step 4 - HTML/CSS-to-PDF editorial export in 10-14 page target | Pass | AAPL and NVDA editorial PDFs both render to 10 pages |
| Step 5 - sparse/degraded and legacy fallback behavior | Pass | Automated contract, pipeline, and export regressions are green |
| Step 6 - mobile summary-first plus inline-expand proof | Partial | Emulator screenshots exist, but physical-device or Maestro proof is still open |
| Step 7 - acceptance/docs updated with limitations | Pass | M9 docs now reflect implementation state and remaining proof gap |

---

## Current Closeout Position

M9 implementation is complete, but milestone closeout is not fully clean yet.

The remaining gap is narrow and explicit:

- capture physical-device or Maestro proof for the M9 summary-first inline-expand flow
- optionally re-capture export controls as M9-specific mobile evidence

Until then, M9 should be treated as:

- code complete
- automated quality gates green
- editorial PDF path proven
- emulator mobile proof captured
- final mobile closeout proof still pending
