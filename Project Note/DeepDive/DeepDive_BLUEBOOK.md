# Deep Dive Revamp Bluebook

**Status:** Active
**Last Revised:** 2026-04-22

---

## Architecture Doctrine

Deep Dive Revamp introduces a report compiler model with a summary layer over a canonical due-diligence artifact and an editorial print path over the same report truth.

```text
Data inputs
  -> deterministic analysis engine
  -> canonical due_diligence layer
  -> compatibility investment_memo summary
  -> issuer metadata and proof layers
  -> mobile reader and editorial HTML/CSS-to-PDF renderer
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

The canonical artifact remains an additive `AnalysisReport` evolution.

M8 locks two report layers inside that additive shape. M9 keeps those two layers and adds issuer metadata plus editorial export expectations alongside them:

- `investment_memo`: short summary layer kept for compatibility, legacy consumers, and summary-first entry points
- `due_diligence`: canonical long-form layer with six required sections:
  - `financial_analysis`
  - `competitive_positioning`
  - `management_and_governance`
  - `risks_and_challenges`
  - `growth_opportunities_and_outlook`
  - `valuation_and_thesis_stance`

Supporting proof layers remain required alongside those report layers:

- issuer metadata / listing context
- evidence book / claim mapping
- omissions ledger
- appendix tables
- data freshness
- calculation notes
- generation metadata

`investment_memo` may summarize or mirror the canonical layer, but it must not introduce report truth that is absent from `due_diligence`.

Regardless of presentation choice, the artifact must contain enough structured data to render `DEEPDIVE_REPORT_TEMPLATE.md` without mobile or PDF inventing interpretation.

---

## Report Layers

| Layer | Owner | Description |
|---|---|---|
| Input context | Product API + data providers | Financial snapshots, transcripts, prices, filings, evidence |
| Deterministic analysis | Dexter worker or shared pure module | Trend math, value score, quality score, valuation, omissions |
| Summary layer | Dexter worker | Short `investment_memo` compatible with existing clients and summary-first views |
| Canonical due diligence | Dexter worker plus deterministic modules | Six-section long-form report that owns the detailed thesis |
| Issuer metadata and proof layers | Product API + Dexter worker | Listing context, report freshness, appendix metadata, evidence, omissions, and export metadata |
| Persistence | Product API | Stores report artifact, issuer metadata, and export metadata |
| Mobile rendering | Android | Summary-first inline-expand reader and proof navigation |
| PDF rendering | Product API editorial HTML/CSS-to-PDF path | Serious report artifact with exhibits, issuer metadata, and appendix |

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

- summary thesis and why now
- plain-language explanation of financial trends
- competitive-positioning narrative
- management/governance narrative
- value-discipline interpretation
- risk explanation
- growth/outlook narrative
- conclusion and watch items

Dexter may not invent:

- financial values
- valuation assumptions
- source citations
- peer data
- Piotroski input values
- management quality claims without evidence
- claims unsupported by evidence or computed metrics

---

## Data Requirements

Minimum complete report target:

- latest annual financial snapshot
- latest quarterly financial snapshot when available
- at least 5 years of annual financials where available
- latest transcript when available
- current or recent price reference
- issuer metadata block where supported: primary exchange/listing, currency, domicile/region, and sector/industry context
- evidence items for material claims
- valuation assumptions
- management/governance evidence where available
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

Every milestone must be additive through M9.

Rollback path:

1. keep old report rendering active
2. hide new mobile sections behind missing-field fallback
3. disable M9 editorial HTML/CSS export behavior without deleting stored reports
4. preserve old report history and cache readability
