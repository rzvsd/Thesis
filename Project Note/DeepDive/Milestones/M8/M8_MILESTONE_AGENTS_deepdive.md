# M8 AGENTS - Due Diligence Default Upgrade

**Milestone:** Deep Dive Revamp M8 - Due Diligence Default Upgrade
**Status:** In Progress
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Engineering Lead + Product Lead |
| Depends on | M0-M7 plus M5.2 closed |
| Services | `packages/contracts`, `apps/product-api`, `apps/dexter-worker`, `apps/mobile/android` |
| Contracts | Additive `AnalysisReport` shape with canonical `due_diligence` plus compatibility `investment_memo` |

---

## Scope

- [x] Keep the user-facing product name `Deep Dive`
- [x] Add the canonical `due_diligence` report layer
- [x] Preserve `investment_memo` as a short compatibility summary
- [x] Remap existing financial/value-discipline truth into the new section taxonomy
- [x] Expand PDF target to 10-14 pages for full-data reports
- [x] Make mobile summary-first with expandable proof by section in code and unit coverage
- [x] Preserve strict omission honesty in every section
- [x] Preserve legacy report rendering and fallback behavior
- [ ] Capture device-level proof for mobile reader flow

## Out Of Scope

- Renaming the Deep Dive entrypoint
- New navigation surfaces
- New data providers beyond already allowed sources
- Brokerage/portfolio extensions
- Replacing the visual exhibit system with a new style language

## Required Tests

- Contract/schema tests for additive `due_diligence` shape
- Product API validation and retrieval tests
- Dexter fixture and generation tests
- PDF template/page-count verification
- Android reader and offline-cache tests
- Device or Maestro proof for summary-first plus expand behavior
- Legacy report fallback regression tests

## Definition Of Done

- [x] `due_diligence` is the canonical long-form layer and contains the six locked sections
- [ ] `investment_memo` remains present and does not drift from canonical report truth
- [x] Full-data PDF output fits the 10-14 page target or degrades honestly when sparse
- [ ] Mobile opens with summary and expands into proof without hiding thesis-critical information
- [x] Every section has explicit omission behavior
- [x] Legacy reports still render
- [x] `DeepDive_ACCEPTANCE.md` is updated with M8 implementation proof

## Open Implementation Flags

- Legacy compatibility is locked to fallback rendering only. Do not introduce lazy `due_diligence` projection or stored migration during M8 closeout.
- Keep value-discipline logic visible after taxonomy remap; do not let it disappear into generic financial prose.
- Treat management/governance thin coverage as omission state, not a generic personality paragraph.
- Device-level proof remains open. Emulator install succeeded, but trustworthy summary-first/expand screenshots were not captured because the Android runtime became unstable during proof attempts.
