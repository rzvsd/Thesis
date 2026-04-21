# Deep Dive Test Matrix

**Status:** Active
**Last Revised:** 2026-04-20
**Applies To:** Deep Dive Revamp M1-M7, including M5.2 visual exhibits

---

## Purpose

This matrix defines the tests and evidence required to prove Deep Dive Revamp is real.

The point is simple: a report that renders successfully but reads like nonsense has failed.

---

## Hard Gates

| Gate | Failure Means |
|---|---|
| Contract gate | Renderers can invent or misread report meaning |
| Deterministic math gate | LLM can fabricate or distort financial facts |
| Evidence gate | Claims can appear without proof |
| Omission gate | Missing data can be hidden |
| PDF render gate | Export can look unprofessional or unreadable |
| Mobile device gate | The app can pass unit tests while failing on phone |
| Legacy fallback gate | Existing report history can break |

---

## Milestone Test Matrix

| Milestone | Required Tests | Required Evidence | Must Fail If |
|---|---|---|---|
| M1 Structured Report Contract | Contract schema tests; Product API validation tests; Dexter fixture validation; legacy report fixture parse | Full, partial, sparse, and legacy JSON fixtures; test output in M1 evidence | New fields are untyped; old reports fail; required omissions are absent |
| M2 Financial Analysis Engine | Unit tests for CAGR, margins, FCF, leverage, share count, cash conversion; sparse-data tests | Deterministic fixture outputs for AAPL/MSFT-style full data and sparse company | Any metric emits without required inputs; 3-5 year table is missing when data exists |
| M3 Value Discipline Scorecard | Unit tests for signal families; missing-input tests; company-context interpretation tests | Value, quality mega-cap, distressed, financial/special-case, and sparse fixtures | Full score is emitted with missing inputs; interpretation is identical across contexts |
| M4 Research Authoring Engine | Snapshot tests; claim-support tests; unsupported-claim rejection tests; degraded-data narrative tests | AAPL, MSFT, TSLA, and sparse snapshots; claim-to-evidence map | Memo is generic; material claim lacks evidence/metric/omission; missing data is hidden |
| M5 Institutional PDF Export | PDF generation tests; page render tests; visual inspection; old/new artifact export tests | Rendered PNG pages; PDF file; visual QA note in M5 evidence | PDF is a mobile card dump; clipped text; broken tables; missing page numbers; no appendix |
| M5.2 Visual Exhibits Layer | Visual-render tests; chart data-mapping tests; sparse-data fallback tests; PNG visual inspection; legacy export compatibility | Chart-rich PDF sample; rendered PNG pages; visual QA note comparing exhibit quality vs text-first export | Charts use fake/inferred values; output stays plain text-first; labels/units missing; sparse-data charts fake completeness |
| M6 Mobile Research Reader | Mapper unit tests; legacy fallback tests; Android UI tests; offline cache tests; device smoke | Screenshots or Maestro proof; mapper test output; offline reopen proof | Mobile starts with accordions; old report fails; PDF/mobile disagree; offline cache loses fields |
| M7 End-to-End Quality | Full stack smoke; report run; history reopen; PDF export; phone proof; regression tests | Final closeout evidence folder with commands, screenshots, and known limitations | Deep Dive cannot complete end to end; report lacks core sections; proof is not captured |

---

## Fixture Requirements

| Fixture | Required Because |
|---|---|
| Full-data quality mega-cap | Proves the best version of the report can be rich and serious |
| Full-data mature value company | Proves value discipline has teeth |
| Distressed or deteriorating company | Proves warning language and value-trap logic |
| Sparse-data company | Proves omissions are honest and useful |
| Legacy v1 report | Proves history and offline cache safety |
| Valuation-degraded report | Proves valuation does not fake precision |
| No-prior-thesis report | Proves "what changed" handles first-run reality |

---

## Acceptance-Level User Tests

These are non-technical acceptance tests. They should be used during owner review.

| Test | Pass Standard |
|---|---|
| First-page test | A user can explain the thesis, why now, and top risks after reading Page 1 |
| Numbers test | A user can see whether revenue, margins, cash flow, debt, and shares improved or deteriorated |
| Value-discipline test | A user understands whether the company is financially improving or becoming a value trap |
| Valuation test | A user can see the fair value range and the assumptions behind it |
| Evidence test | A user can trace the important claims to proof |
| Omission test | A user can see what Thesis does not know |
| Mobile test | A user can understand the report on phone without opening every proof accordion |
| Serious-artifact test | The PDF feels credible enough to save, share, or revisit before an investment decision |
| Visual-exhibit test | The PDF uses chart-rich exhibits that explain the numbers faster than plain text alone |

---

## Minimum Commands And Proof

Exact commands may change by implementation, but each milestone must record equivalents.

```powershell
corepack pnpm --filter @thesis/contracts test
corepack pnpm --filter @thesis/product-api test
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/mobile test
```

Android/device proof must include:

- phone or emulator identifier
- installed app version/build variant
- login proof
- Research -> Deep Dive run or report open
- evidence of core sections rendered
- offline or history reopen proof

PDF proof must include:

- generated PDF path
- rendered page images
- visual QA note
- known limitations, if any

---

## Closeout Rule

Do not close a milestone because "tests pass" if the report is still shallow.

Close only when:

- tests pass
- smoke proof exists
- acceptance criteria are updated
- output meets the report template
- omissions and limitations are explicit
