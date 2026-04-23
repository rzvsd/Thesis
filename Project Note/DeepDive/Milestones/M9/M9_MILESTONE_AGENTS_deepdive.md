# M9 AGENTS - Verbose Due Diligence Authoring And Editorial PDF Upgrade

**Milestone:** Deep Dive Revamp M9 - Verbose Due Diligence Authoring And Editorial PDF Upgrade
**Status:** Implemented; final closeout pending physical-device or Maestro proof
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Engineering Lead + Product Lead |
| Depends on | M0-M8, with M8 closeout proof still required |
| Services | `packages/contracts`, `apps/product-api`, `apps/dexter-worker`, `apps/mobile/android` |
| Contracts | Additive `AnalysisReport` shape with canonical `due_diligence`, compatibility `investment_memo`, issuer metadata, and editorial export metadata |

---

## Scope

- [x] Keep the user-facing product name `Deep Dive`
- [x] Preserve the canonical six-section `due_diligence` taxonomy from M8
- [x] Upgrade due-diligence authoring from compressed section fill to a verbose editorial standard
- [x] Keep `investment_memo` short and compatibility-safe
- [x] Upgrade the serious export path to 10-14 page HTML/CSS-to-PDF editorial output
- [x] Add issuer metadata to the report cover and metadata appendix with omission-forward behavior
- [x] Keep mobile summary-first with inline section expansion into proof
- [x] Preserve evidence, omission ledger, appendix, and legacy fallback behavior

## Out Of Scope

- Renaming the Deep Dive entrypoint
- New top-level app navigation
- New data providers beyond already allowed sources
- Replacing the six-section `due_diligence` taxonomy with a second report structure
- Turning mobile into a default full-text PDF reader
- Introducing a separate PDF-renderer service outside Product API

## Required Tests

- Contract/schema tests for issuer metadata and additive editorial export fields
- Dexter authoring tests for verbose due-diligence section quality
- Product API HTML/CSS-to-PDF export and validation tests
- PDF print/layout and page-count verification
- Android reader/offline tests for summary-first inline-expand behavior
- Legacy fallback regression tests
- Milestone evidence bundle for HTML, PDF, rendered pages, and mobile proof

## Definition Of Done

- [x] Full-data reports keep the six canonical `due_diligence` sections while meeting the verbose editorial writing standard
- [x] `investment_memo` remains present, short, and bounded by canonical due-diligence truth
- [x] Editorial HTML/CSS-to-PDF export fits the 10-14 page target for full-data reports or degrades honestly when sparse
- [x] Issuer metadata is visible in the report surface and appendix metadata, with explicit omissions when unavailable
- [x] Mobile still opens summary-first and expands inline into proof without defaulting to long-form text
- [x] Evidence, omissions, and appendix survive the editorial export path
- [x] Legacy reports still render and compatibility consumers still function
- [x] `DeepDive_ACCEPTANCE.md` is updated with M9 implementation proof
- [ ] Physical-device or Maestro closeout proof is recorded for the summary-first inline-expand mobile flow

## Open Implementation Flags

- Preserve the exact six-section `due_diligence` taxonomy from M8. M9 upgrades authoring depth and export quality; it does not create a competing structure.
- Keep `investment_memo` as a one-paragraph compatibility summary. Verbose authoring belongs in canonical due diligence, not in the summary layer.
- Product API remains the owner of the editorial HTML/CSS-to-PDF path. Do not introduce a separate renderer service.
- Issuer metadata must degrade honestly. Missing listing, sector, domicile, or currency context becomes a metadata omission, not a guessed field.
- Mobile remains summary-first with inline expansion. Do not let verbose authoring silently turn the phone experience into a default expanded report.

## Current Closeout Note

M9 implementation is landed across contracts, Dexter, Product API, and Android. Automated quality gates are green, the editorial PDF evidence bundle exists for full-data AAPL and NVDA runs, and emulator-backed screenshots prove summary-first plus inline-expand reader behavior.

The remaining closeout gap is stricter proof mode, not missing implementation:

- no physical-device M9 screenshot set was captured in this shell
- no runnable Maestro CLI was available in this shell session
- export controls were previously proven in M6, but were not re-captured as M9-specific mobile evidence
