# Deep Dive Revamp Milestones

**Status:** M8 closeout pending; M9 implementation complete with final closeout pending
**Last Revised:** 2026-04-22
**Related Documents:** `DeepDive_ROADMAP.md`, `DeepDive_BLUEBOOK.md`, `DeepDive_PRD.md`, `DEEPDIVE_REPORT_STANDARD.md`, `DEEPDIVE_REFERENCE_MAPPING.md`, `DEEPDIVE_REPORT_TEMPLATE.md`, `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`, `DEEPDIVE_TEST_MATRIX.md`

---

## How To Read This Document

Each milestone defines:

- what ambiguity it removes
- what must be built
- what must be tested
- what acceptance proof is required
- what rollback looks like

A milestone is not closed unless every acceptance criterion is checked off or explicitly deferred by owner decision.

M0-M7 are the passed foundation milestones. M8 is the active follow-on upgrade that makes full due diligence the default Deep Dive output while preserving compatibility. M9 is the implemented follow-on upgrade that makes that due-diligence artifact more editorial, issuer-aware, and HTML/CSS-to-PDF disciplined without changing the canonical structure, with final closeout still pending the stricter mobile proof bar.

Milestone naming convention stays in the established DeepDive style:

- whole-number milestones for the main implementation path (`M0` ... `M9`)
- decimal-suffix milestones only when a cross-cutting slice must be inserted between locked milestones, as with `M5.2`

---

## Milestone Index

| # | Name | What It Produces |
|---|---|---|
| M0 | Report Standard and Interface Lock | Canonical report standard, decisions, and exact interface names |
| M1 | Structured Report Contract | Typed additive report artifact accepted by Product API, Dexter, and mobile |
| M2 | Financial Analysis Engine | Deterministic financial tables, trend metrics, quality metrics, omissions |
| M3 | Value Discipline Scorecard | Piotroski-inspired and context-aware value/quality section |
| M4 | Research Authoring Engine | Evidence-backed institutional memo writing |
| M5 | Institutional PDF Export | Serious PDF report with exhibits and appendix |
| M5.2 | Visual Exhibits Layer | Chart-rich, publication-worthy exhibits rendered from real report figures |
| M6 | Mobile Research Reader | Mobile Deep Dive reader backed by the structured artifact |
| M7 | End-to-End Quality and Device Proof | Full smoke, regression, device evidence, and closeout |
| M8 | Due Diligence Default Upgrade | Canonical `due_diligence` layer, compatibility summary behavior, 10-14 page PDF target, and summary-first mobile reader |
| M9 | Verbose Due Diligence Authoring And Editorial PDF Upgrade | Verbose editorial due diligence, issuer metadata, 10-14 page HTML/CSS-to-PDF export, and summary-first inline-expand mobile behavior |

---

# M0 - Report Standard and Interface Lock

## Goal

Define exactly what a serious Thesis Deep Dive report is before implementation begins.

## Deliverables

| Deliverable | Description |
|---|---|
| Report standard | Canonical structure in `DEEPDIVE_REPORT_STANDARD.md` |
| Reference mapping | Explicit translation from `report.pdf` and `value investing.pdf` to Thesis requirements |
| Report template | Editorial PDF and mobile reader template |
| Test matrix | Hard gates, fixtures, and fail conditions |
| Decision locks | Locked/open decisions in `DeepDive_DECISION_LOCKS.md` |
| ADRs | Deep Dive Revamp decision records |
| Milestone scaffolding | Foundation scaffolding for M0-M7 plus M5.2, with follow-on milestones added in the same numbering style |
| Interface naming | Public names for report artifact sections before M1 |

## Acceptance Criteria

- [x] DeepDive root docs exist in prior-phase style
- [x] Reference PDFs are documented as quality references, not source material to copy
- [x] Reference PDFs are mapped to exact Thesis requirements
- [x] Editorial PDF and mobile reader templates are locked
- [x] Test matrix defines hard gates and fail conditions
- [x] Foundation milestone folders M0-M7 plus M5.2 contain AGENTS, smoke plan, and evidence folder
- [x] Report structure is locked before contract implementation
- [x] Open decisions required before M1 are named

## Smoke Test

```text
Step 1: Confirm root docs exist.
Step 2: Confirm foundation milestone folders M0-M7 plus M5.2 milestone docs and evidence folders exist.
Step 3: Confirm report standard names all required sections.
Step 4: Confirm decisions file names locked and open decisions.
Step 5: Confirm reference mapping, report template, and test matrix exist.
```

## Rollback

Remove Deep Dive Revamp docs only if owner abandons the workstream. Existing Deep Dive implementation remains unchanged.

---

# M1 - Structured Report Contract

## Goal

Create the typed report artifact that every renderer and service can trust.

## Deliverables

| Deliverable | Description |
|---|---|
| Contract fields | Typed sections for investment memo, financials, value score, valuation, risks, evidence, appendix |
| Runtime validation | Product API and Dexter validation for new fields |
| Backward compatibility | Old reports still parse and render |
| Fixture payloads | Full, partial, sparse, and legacy examples |

## Acceptance Criteria

- [x] Contract names and schema are implemented in `packages/contracts`
- [x] Product API validates new report artifact fields
- [x] Dexter can emit the new artifact shape
- [x] Old reports without new fields still deserialize
- [x] Contract tests cover full and sparse payloads
- [x] Contract fields can represent every required page/section in `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Fixtures satisfy `DEEPDIVE_TEST_MATRIX.md` full, partial, sparse, degraded, no-prior-thesis, and legacy categories
- [x] Unsupported required template sections degrade into omissions, not renderer guesses

## Smoke Test

```text
Step 1: Build contracts.
Step 2: Run Product API report validation tests.
Step 3: Run Dexter schema validation tests.
Step 4: Deserialize one old report fixture and one v2 report fixture.
Step 5: Confirm v2 fixture can drive the canonical report template.
```

## Rollback

Keep old report fields active and ignore new additive fields in mobile until fixed.

---

# M2 - Financial Analysis Engine

## Goal

Compute the real financial substance of the report.

## Deliverables

| Deliverable | Description |
|---|---|
| 5-year table builder | Annual and quarterly financial history where available |
| Trend metrics | CAGR, margins, FCF, debt, cash, share count, dilution |
| Quality metrics | ROIC/ROE, cash conversion, accrual quality where inputs exist |
| Omission engine | Missing metrics are explicit and confidence-impacting |
| Tests | Deterministic metric tests across complete and sparse data |

## Acceptance Criteria

- [x] Financial tables are generated from structured inputs
- [x] No metric is emitted without required inputs
- [x] Omission list explains missing inputs
- [x] Tests cover complete, partial, and sparse company histories
- [x] Existing Deep Dive job lifecycle still works
- [x] 3-5 year financial exhibit is present when data exists
- [x] Sparse-data and valuation-degraded fixtures produce explicit omission panels
- [x] Financial outputs satisfy the M2 rows in `DEEPDIVE_TEST_MATRIX.md`

## Smoke Test

```text
Step 1: Run financial engine unit tests.
Step 2: Generate report for AAPL/MSFT fixture.
Step 3: Confirm 5-year table and trend metrics exist where data exists.
Step 4: Confirm sparse fixture produces omissions, not fake values.
Step 5: Confirm each emitted metric has required input provenance.
```

## Rollback

Disable financial table rendering while preserving old report sections.

---

# M3 - Value Discipline Scorecard

## Goal

Add a value-investing lens grounded in financial statement signals.

## Deliverables

| Deliverable | Description |
|---|---|
| Piotroski-style inputs | Profitability, leverage/liquidity, operating efficiency, accruals, issuance |
| Context adapter | Interprets score differently for value/distressed vs quality/growth names |
| Value-trap warnings | Flags cheapness plus deteriorating quality |
| Plain-English explanation | Explains what the score means and does not mean |

## Acceptance Criteria

- [x] Scorecard computes only available signals
- [x] Missing signals are listed
- [x] Interpretation changes by company context
- [x] Tests cover value, quality mega-cap, sparse, and distressed fixtures
- [x] Mobile/PDF labels do not overstate the score
- [x] Scorecard aligns to the value-discipline section in `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Tests cover full, partial, sparse, value, quality, and distressed contexts
- [x] The scorecard includes "what this does not prove" language

## Smoke Test

```text
Step 1: Run value-score unit tests.
Step 2: Generate one quality mega-cap report and one value-style report.
Step 3: Confirm score interpretation differs appropriately.
Step 4: Confirm missing inputs degrade score confidence.
Step 5: Confirm no full score is emitted when required inputs are missing.
```

## Rollback

Hide the scorecard and keep financial analysis visible.

---

# M4 - Research Authoring Engine

## Goal

Upgrade Dexter from section assembly to evidence-backed investment memo writing.

## Deliverables

| Deliverable | Description |
|---|---|
| Memo prompt | Writes investment thesis from structured facts |
| Claim controls | Material claims require metric/evidence/omission support |
| Narrative sections | Thesis, what changed, business quality, valuation, risks |
| Snapshot tests | Company-specific output for AAPL, MSFT, TSLA, sparse fixture |

## Acceptance Criteria

- [x] Memo opens with a specific investment argument
- [x] Writing references computed facts instead of generic phrasing
- [x] Material claims map to evidence or computed metrics
- [x] Sparse data output is honest and useful
- [x] LangSmith prompt registration is complete or explicitly TBD with local prompt proof
- [x] Memo sections follow the writing template in `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Snapshot tests fail generic company-agnostic prose
- [x] Claim-to-evidence mapping is captured for material claims

## Smoke Test

```text
Step 1: Generate reports for AAPL, MSFT, TSLA, and sparse fixture.
Step 2: Confirm each memo is company-specific.
Step 3: Confirm unsupported claims are absent.
Step 4: Confirm degraded data still produces readable omission-forward prose.
Step 5: Confirm generic template-cloned prose fails the snapshot gate.
```

## Rollback

Use deterministic section summaries and keep the structured report artifact.

---

# M5 - Institutional PDF Export

## Goal

Produce a serious report artifact that can be downloaded, shared, and reviewed.

## Deliverables

| Deliverable | Description |
|---|---|
| PDF renderer | Generates report pages from structured artifact |
| Exhibits | Tables, valuation bands, scorecards, risks, evidence |
| Appendix | Raw financial tables, assumptions, omissions, source notes |
| Visual QA | Rendered PDF pages checked for layout defects |

## Acceptance Criteria

- [x] PDF includes one-page memo, thesis, financials, value score, valuation, risks, evidence, appendix
- [x] PDF is not a mobile screenshot or card dump
- [x] Missing data appears as omissions
- [x] Rendered pages are visually inspected
- [x] Export path works from Product API and mobile entry point
- [x] PDF follows the editorial template order and page-neighborhood rules in `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Rendered PNG pages are stored as evidence
- [x] Visual QA confirms exhibit captions, source notes, page numbers, and appendix

## Smoke Test

```text
Step 1: Generate a complete report.
Step 2: Export PDF.
Step 3: Render PDF pages to images.
Step 4: Confirm no clipped text, broken tables, unreadable charts, or missing page numbers.
Step 5: Confirm PDF is not a mobile-card printout and includes appendix/source notes.
```

## Rollback

Disable PDF v2 route and keep legacy export path.

---

# M5.2 - Visual Exhibits Layer

## Goal

Upgrade Deep Dive PDF output from structurally correct export to visually serious institutional research publication quality.

## Deliverables

| Deliverable | Description |
|---|---|
| Exhibit renderer upgrade | Real chart visuals generated from structured report figures |
| Exhibit family set | Grouped bars, overlay bars, density/distribution charts, bridges, timelines, scorecards, risk matrices |
| Visual styling system | Thesis-native editorial chart language for PDF exhibits |
| Sparse-data exhibit policy | Explicit omission panels and degraded chart fallbacks |
| Visual QA hardening | Chart-level PNG proof and readability checks |

## Acceptance Criteria

- [x] PDF charts are generated from real report figures, never decorative placeholders
- [x] Visuals follow `DEEPDIVE_VISUAL_EXHIBITS_STANDARD.md`
- [x] At least the following report areas gain chart-rich exhibits where data exists: financial analysis, value discipline, valuation, risks/kill switches
- [x] Cover/memo page includes a visually strong range band or equivalent pricing/valuation exhibit
- [x] Multi-period and comparison charts use clear units, legends, and restrained color hierarchy
- [x] Sparse-data reports show omission-forward fallback panels instead of fake complete visuals
- [x] Rendered PNG evidence proves the output is no longer text-first/plain-export quality
- [x] Visual QA confirms charts are readable, aligned, and feel publication-worthy rather than dashboard-generic

## Smoke Test

```text
Step 1: Generate a full-data Deep Dive report with M5.2 export.
Step 2: Confirm chart-rich exhibits appear on memo, financial, value, valuation, and risk pages where data exists.
Step 3: Render PDF pages to PNG and inspect legend readability, axis labels, units, and spacing.
Step 4: Generate a sparse-data report and confirm omission panels replace unsupported visuals.
Step 5: Confirm the export still preserves appendix, source notes, and legacy fallback behavior.
```

## Rollback

Keep M5 text-first institutional export active and disable the M5.2 visual renderer path until chart defects are fixed.

---

# M6 - Mobile Research Reader

## Goal

Make the phone experience feel like a guided research reader, not random cards.

## Deliverables

| Deliverable | Description |
|---|---|
| Executive reader | Verdict, thesis, what changed, value discipline, valuation, risks |
| Exhibit cards | Data-native mobile visuals backed by report artifact |
| Proof navigation | Evidence and appendix remain reachable |
| Offline cache | New artifact fields round-trip offline |
| Legacy fallback | Old reports still render cleanly |

## Acceptance Criteria

- [x] Mobile reads the structured report artifact
- [x] Old reports still render
- [x] Deep Dive screen remains one continuous readable flow
- [x] PDF export entry point is visible where appropriate
- [x] Android unit tests and device smoke pass
- [x] Mobile reader follows the order in `DEEPDIVE_REPORT_TEMPLATE.md`
- [x] Mobile and PDF render the same report truth for signal, valuation, risks, and omissions
- [x] Device proof shows executive reader, financial quality, value discipline, valuation, risks, evidence, and export entry

## Smoke Test

```text
Step 1: Install app on phone.
Step 2: Login.
Step 3: Run/open Deep Dive.
Step 4: Confirm memo, financial quality, value score, valuation, risks, evidence, and export entry render.
Step 5: Force offline cache path and reopen report.
Step 6: Confirm old report fallback and new artifact rendering both work.
```

## Rollback

Return to current Deep Dive screen using legacy presentation fields.

---

# M7 - End-to-End Quality and Device Proof

## Goal

Close the foundation workstream with real evidence.

## Deliverables

| Deliverable | Description |
|---|---|
| Full test run | Contracts, Product API, Dexter, Android, PDF, Maestro |
| Device evidence | Physical phone screenshots or Maestro proof |
| Regression proof | Login, Research, History, Deep Dive, offline, export |
| Closeout docs | Acceptance and evidence updated |

## Acceptance Criteria

- [x] Deep Dive run completes end to end
- [x] Report artifact contains required sections
- [x] PDF export opens and renders cleanly
- [x] Mobile reader displays the artifact correctly
- [x] Old report fallback is verified
- [x] Evidence is stored under milestone folders
- [x] The generated report passes owner-level tests in `DEEPDIVE_TEST_MATRIX.md`
- [x] Device proof and PDF proof are both attached to M7 evidence
- [x] Known limitations are explicit and do not violate locked hard gates

## Smoke Test

```text
Step 1: Start full local stack.
Step 2: Login on phone.
Step 3: Run AAPL or MSFT Deep Dive.
Step 4: Open report from History.
Step 5: Export PDF.
Step 6: Verify all core sections and evidence.
Step 7: Run owner acceptance checklist from `DEEPDIVE_TEST_MATRIX.md`.
```

## Rollback

Keep structured artifacts stored but route mobile and export back to old rendering until defects are fixed.

---

# M8 - Due Diligence Default Upgrade

## Goal

Keep the product entrypoint named `Deep Dive` while making the default artifact a full due diligence report with a canonical `due_diligence` layer and a short compatibility `investment_memo` summary.

## Deliverables

| Deliverable | Description |
|---|---|
| Canonical due-diligence layer | `due_diligence` becomes the authoritative long-form report shape |
| Six-section taxonomy | `financial_analysis`, `competitive_positioning`, `management_and_governance`, `risks_and_challenges`, `growth_opportunities_and_outlook`, `valuation_and_thesis_stance` |
| Compatibility summary layer | `investment_memo` remains present as a short summary for legacy consumers and summary-first entry points |
| PDF expansion | Full-data PDF target becomes 10-14 pages while preserving evidence and appendix |
| Mobile summary-first reader | Phone view opens with summary and expands into detailed proof by due-diligence section |
| Omission honesty rules | Every due-diligence section has explicit sparse-data and omission behavior |
| Regression/test plan | Fixtures, smoke tests, and hard gates for section mapping, compatibility, pagination, and mobile summary flow |

## Acceptance Criteria

- [x] `Deep Dive` remains the user-facing product entrypoint and no new top-level navigation is introduced
- [x] The canonical artifact defines `due_diligence` as the long-form source of truth with exactly the six approved sections
- [ ] `investment_memo` remains present as a short compatibility summary and does not introduce truth absent from `due_diligence`
- [ ] Existing financial analysis and value-discipline work survives inside the due-diligence model without creating a second competing taxonomy
- [x] Full-data PDF target becomes 10-14 pages and follows `DEEPDIVE_REPORT_TEMPLATE.md`
- [ ] Mobile reader is summary-first with expandable proof/detail modules for each due-diligence section
- [x] Each due-diligence section has explicit omission and sparse-data behavior
- [x] Legacy reports and compatibility consumers continue to render via fallback behavior
- [x] Tests cover full, partial, sparse, degraded, and legacy fixtures for section mapping, omissions, and pagination/reader behavior
- [ ] M8 evidence proves section completeness, compatibility behavior, PDF template fit, and mobile summary-first flow

## Smoke Test

```text
Step 1: Run contract and validation tests for the additive report shape.
Step 2: Generate one full-data report and confirm `investment_memo` plus all six `due_diligence` sections exist.
Step 3: Generate sparse and legacy fixtures and confirm omissions/fallbacks behave honestly.
Step 4: Export a full-data PDF and confirm the 10-14 page target with evidence and appendix still present.
Step 5: Open the report on mobile and confirm summary-first reading plus section-level expansion into proof.
```

## Rollback

Keep the M7 artifact and reader behavior as default, and gate M8 `due_diligence` rendering behind additive compatibility fallback until section parity and regressions are clean.

Implementation note:

- Legacy compatibility is locked to fallback rendering behavior. M8 does not introduce lazy `due_diligence` projection or stored migration for old reports.

---

# M9 - Verbose Due Diligence Authoring And Editorial PDF Upgrade

## Goal

Keep the canonical M8 due-diligence artifact, but make it read and export like a serious editorial report without breaking compatibility or the summary-first mobile experience.

## Deliverables

| Deliverable | Description |
|---|---|
| Verbose due-diligence authoring standard | Each canonical section gains a takeaway plus enough editorial body to explain evidence, causality, omissions, and uncertainty |
| Editorial HTML/CSS export | Full-data reports export through the HTML/CSS-to-PDF path while staying inside the 10-14 page target |
| Issuer metadata surface | Cover and appendix metadata expose issuer/listing context or explicit metadata omissions |
| Mobile inline-expand preservation | Phone remains summary-first and expands into proof inline instead of defaulting to long-form text |
| Regression/test plan | Hard gates and evidence for authoring depth, issuer metadata, page discipline, print QA, and backward compatibility |

## Acceptance Criteria

- [x] The canonical `due_diligence` artifact keeps exactly the six approved sections and each section meets the verbose editorial writing standard
- [x] `investment_memo` remains present as a short compatibility summary and does not become a second long-form report
- [x] Full-data HTML/CSS-to-PDF editorial export lands in the 10-14 page target and preserves evidence, omissions, and appendix truth
- [x] Issuer metadata is visible on the report cover and appendix metadata, or degrades with explicit metadata omissions
- [x] Mobile reader remains summary-first with inline section expansion into proof and does not default to expanded long-form text
- [x] Sparse and degraded reports remain omission-forward under the editorial standard
- [x] Legacy reports and compatibility consumers continue to render via fallback behavior
- [x] Tests cover verbose authoring quality, issuer metadata, editorial print/layout, page target, mobile summary flow, and legacy fallback
- [ ] M9 evidence proves authoring depth, metadata completeness, editorial PDF quality, and mobile summary-first inline-expand behavior to the final physical-device or Maestro closeout standard

## Smoke Test

```text
Step 1: Run contract, Product API, Dexter, and mobile checks relevant to verbose due-diligence authoring, issuer metadata, and editorial export.
Step 2: Generate one full-data report and confirm `investment_memo` stays short while all six `due_diligence` sections meet the verbose editorial standard.
Step 3: Confirm issuer metadata appears on the cover and metadata appendix, or degrades with explicit metadata omissions.
Step 4: Export a full-data report through the HTML/CSS-to-PDF path and confirm the 10-14 page target with evidence and appendix preserved.
Step 5: Open the report on mobile and confirm summary-first reading plus inline expansion into proof.
Step 6: Generate sparse and legacy fixtures and confirm omission-forward behavior plus compatibility fallback.
```

## Rollback

Keep the M8 due-diligence default and prior export behavior active, and gate M9 editorial HTML/CSS export plus verbose authoring behavior behind fallback until layout, pagination, and mobile regressions are clean.

Implementation note:

- M9 upgrades authoring depth and editorial export quality. It does not rename the product, change the six-section taxonomy, or move renderer ownership outside Product API.
