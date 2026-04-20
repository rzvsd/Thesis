# Deep Dive Revamp Bluebook

**Status:** Active
**Last Revised:** 2026-04-20

---

## Architecture Doctrine

Deep Dive Revamp introduces a report compiler model.

```text
Data inputs
  -> deterministic analysis engine
  -> structured report artifact
  -> evidence-constrained narrative authoring
  -> mobile reader and PDF renderer
```

The report artifact is the source of truth. Mobile and PDF are renderers.

---

## Boundaries

| Boundary | Rule |
|---|---|
| Mobile -> Product API | Mobile never calls Dexter, OpenBB, SEC, or data services directly |
| Product API -> Dexter | Product API owns jobs, persistence, validation, and retrieval |
| Dexter -> data context | Dexter receives structured context and writes narrative from allowed facts |
| Contracts | All report artifact fields are typed in `packages/contracts` |
| PDF | PDF renders from the structured report artifact, not from mobile UI |
| Evidence | Evidence items remain source-linked and omission-aware |

---

## Canonical Artifact

The future canonical artifact is an additive `AnalysisReport` evolution, referred to in docs as `DeepResearchReport`.

Implementation may choose either:

- additive fields inside `AnalysisReport`, or
- a typed companion contract referenced by `AnalysisReport`

The choice is locked in M1 before coding begins.

Regardless of implementation choice, the artifact must contain enough structured data to render `DEEPDIVE_REPORT_TEMPLATE.md` without mobile or PDF inventing interpretation.

---

## Report Layers

| Layer | Owner | Description |
|---|---|---|
| Input context | Product API + data providers | Financial snapshots, transcripts, prices, filings, evidence |
| Deterministic analysis | Dexter worker or shared pure module | Trend math, value score, quality score, valuation, omissions |
| Narrative | Dexter worker | Memo writing constrained to structured facts |
| Persistence | Product API | Stores report artifact and export metadata |
| Mobile rendering | Android | Executive reader and proof navigation |
| PDF rendering | Product API or dedicated renderer path | Serious report artifact with exhibits and appendix |

Renderers must not derive missing report substance from UI heuristics. If the artifact lacks a required template section, the renderer shows an omission or degraded state.

---

## Deterministic Computations

These must not be invented by the LLM:

- revenue CAGR
- margin trends
- free cash flow trend
- cash conversion
- ROIC / ROE when inputs exist
- leverage and liquidity ratios
- share count change
- buyback/dilution trend
- Piotroski-style signals
- valuation range
- scenario math
- margin of safety
- evidence count
- omission count
- confidence impacts from missing data

These computations must be directly testable under `DEEPDIVE_TEST_MATRIX.md`.

---

## LLM Responsibilities

Dexter may write:

- investment thesis
- plain-language explanation of financial trends
- business-quality narrative
- value-discipline interpretation
- risk explanation
- conclusion and watch items

Dexter may not invent:

- financial values
- valuation assumptions
- source citations
- peer data
- Piotroski input values
- claims unsupported by evidence or computed metrics

---

## Data Requirements

Minimum complete report target:

- latest annual financial snapshot
- latest quarterly financial snapshot when available
- at least 5 years of annual financials where available
- latest transcript when available
- current or recent price reference
- evidence items for material claims
- valuation assumptions
- explicit missing-data list

Sparse reports are allowed only if they become omission-forward reports, not fake complete reports.

---

## Existing Systems To Preserve

- Deep Dive job lifecycle
- report history
- offline report cache
- report feedback
- notes
- scenario controls
- Phase 4 Research navigation
- admin/local test login
- existing reports without new fields

---

## Rollback Doctrine

Every milestone must be additive until M7.

Rollback path:

1. keep old report rendering active
2. hide new mobile sections behind missing-field fallback
3. disable PDF v2 export without deleting stored reports
4. preserve old report history and cache readability
