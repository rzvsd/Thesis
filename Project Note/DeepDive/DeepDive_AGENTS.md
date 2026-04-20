# Deep Dive Revamp - AGENTS.md

**Scope:** Deep Dive Revamp workstream. Every milestone, every service touched by this report overhaul.
**Read this first. Then read `Milestones/M#/M#_MILESTONE_AGENTS_deepdive.md`.**

---

## Who You Are

You are implementing the institutional research-report layer of Thesis.

Your job is not to make Deep Dive prettier. Your job is to make Deep Dive more trustworthy, more useful, and more serious by grounding every claim in structured data, evidence, valuation logic, and explicit omissions.

When a product or investment-methodology decision is missing, stop and flag it. Do not invent doctrine inside code.

---

## Document Hierarchy

| Document | What It Governs |
|---|---|
| `DEEPDIVE_REPORT_STANDARD.md` | Canonical report structure and quality bar |
| `DEEPDIVE_REFERENCE_MAPPING.md` | How `report.pdf` and `value investing.pdf` become Thesis requirements |
| `DEEPDIVE_REPORT_TEMPLATE.md` | Required PDF pages and mobile reader order |
| `DEEPDIVE_TEST_MATRIX.md` | Required tests, fixtures, hard gates, and fail conditions |
| `DeepDive_BLUEBOOK.md` | Architecture, contracts, service ownership |
| `DeepDive_MILESTONES.md` | Acceptance criteria, smoke tests, rollback |
| `DeepDive_ROADMAP.md` | Implementation sequence |
| `DeepDive_PRD.md` | Product requirements and user-facing behavior |
| `DeepDive_DECISION_LOCKS.md` | Locked decisions and open decisions |
| `DeepDive_AGENTS.md` | Workstream operating rules |
| `Milestones/M#/` | Milestone-local implementation guide and smoke plan |
| `Decisions/DDR-*.md` | Deep Dive Revamp architecture decisions |

Earlier Phase 1-6 documents still govern existing service boundaries, auth, data, notification, and mobile rules. This workstream extends them.

---

## Before Any Code

- [ ] Read this file.
- [ ] Read `DEEPDIVE_REPORT_STANDARD.md`.
- [ ] Read `DEEPDIVE_REFERENCE_MAPPING.md`.
- [ ] Read `DEEPDIVE_REPORT_TEMPLATE.md`.
- [ ] Read `DEEPDIVE_TEST_MATRIX.md`.
- [ ] Read the current milestone in `DeepDive_MILESTONES.md`.
- [ ] Read the current milestone-local AGENTS file.
- [ ] Identify all contracts touched.
- [ ] Identify all services touched.
- [ ] Confirm whether the change affects existing Deep Dive, History, offline cache, PDF export, or mobile rendering.
- [ ] Confirm what data is deterministic and what text is LLM-authored.

---

## Core Rules

1. **Facts before prose.** The report compiler computes facts before Dexter writes narrative.
2. **LLM narrates; it does not decide math.** Valuation, quality score, value score, trend math, omissions, and evidence counts are deterministic.
3. **Evidence owns claims.** A material claim must link to an evidence item, a calculated metric, or an explicit omission.
4. **Missing data is a product state.** Missing inputs produce omissions, not fake charts or vague copy.
5. **Mobile is not the report.** Mobile is the reader. The durable report artifact is the source.
6. **PDF is not decorative export.** The PDF is a serious research artifact with pages, exhibits, appendix, and source notes.
7. **Value investing is contextual.** Piotroski-style logic is powerful, but not universal. It must be interpreted by company type and data availability.
8. **Backward compatibility is mandatory.** Existing reports without new fields must still deserialize and render.
9. **No source copying.** The reference PDFs define quality and structure, not copy, brand, or proprietary layout.
10. **Do not close a milestone without proof.** Tests, smoke evidence, and docs must agree.
11. **No shallow report closeout.** A report that technically renders but fails the template/user tests is not accepted.

---

## Service Ownership

| Service | Ownership In This Workstream |
|---|---|
| `packages/contracts` | Typed report artifact and report-section schemas |
| `apps/product-api` | Report persistence, validation, retrieval, export orchestration |
| `apps/dexter-worker` | Evidence-backed narrative authoring and report compilation |
| `apps/data-openbb` | Data retrieval support where existing paths provide financial data |
| `apps/scheduler` | No default ownership unless a milestone explicitly needs background generation |
| `apps/mobile/android` | Mobile report reader, offline cache, PDF entry points |
| `qa/maestro` | Device smoke and regression proof |

---

## Quality Gates

Every implementation milestone must run the relevant subset:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm --filter @thesis/contracts test` when contracts change
- `corepack pnpm --filter @thesis/product-api test` when Product API changes
- `corepack pnpm --filter @thesis/dexter-worker test` when report generation changes
- Android unit tests when mobile model, mapper, cache, or UI changes
- Maestro/device smoke when mobile user flow changes
- milestone-specific hard gates from `DEEPDIVE_TEST_MATRIX.md`

If a full command cannot run locally, record the environment reason and run the narrowest meaningful substitute.

---

## Stop And Ask

Stop before implementation if any of these are unclear:

- whether a new report field is canonical or presentation-only
- whether a provider/data source is allowed
- how to interpret a missing financial metric
- whether Piotroski should be weighted for a specific company type
- whether a valuation assumption should be hard-coded
- whether a PDF section is required or optional
- whether old reports may be migrated or only rendered via fallback
