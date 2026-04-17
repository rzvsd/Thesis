# Thesis - Phase 6 Decision Locks

**Status:** Active  
**Last Revised:** 2026-04-17  
**Purpose:** Lock the minimum product, architecture, contract, and evidence decisions needed before Phase 6 implementation starts.

This file exists so Phase 6 does not begin with hidden ambiguity. If a milestone needs a decision that is not covered here, stop and ask before coding.

---

## 1. Locked Product Direction

| Area | Decision | Why |
|---|---|---|
| Phase scope | Phase 6 is the final **data-substrate architecture** phase, not the final architecture phase for the whole company | Leaves room for later security, release, monetization, and platform work |
| Product value | Premium value comes from reasoning, evidence, context discipline, freshness, and explainability, not from buying every market feed | Keeps Thesis differentiated from a quote terminal |
| Provider stance | OpenBB/FMP/Polygon/Alpha Vantage/yfinance-style dependencies are not allowed in protected core production paths | Removes cost, rights, and fragility risk |
| `data-openbb` name | Keep the folder/service name through Phase 6 for migration continuity; optional rename to `data-public` is post-phase backlog | Avoids churn while changing the production meaning |
| Transcripts | Transcript text is optional and rights-gated; first-party release artifacts, slides, filings, and webcast references come first | Keeps War Room and Deep Dive useful without unsafe transcript dependency |

---

## 2. Fear & Greed -> Macro Stress Transition

Phase 6 replaces the old Fear & Greed product promise with Macro Stress.

Locked behavior:

- Today may continue to show a market-context card, but the card becomes **Macro Stress**, not Fear & Greed.
- Macro Stress uses approved official macro inputs only.
- The old Fear & Greed dashboard must not imply live market sentiment, quote completeness, or provider-backed precision.
- If historical Fear & Greed snapshots already exist, they may remain readable as archived history only.
- Mobile copy must explain the transition in Thesis language: "official macro pressure," "what changed," "what matters to your names," and "no material change" where appropriate.
- If a Phase 6 path cannot support a prior quote-led widget honestly, the widget is omitted or explicitly marked unsupported instead of approximated.

Acceptance implication:

M3 cannot close if users can still reach a first-class Fear & Greed surface that depends on deprecated or rights-ambiguous inputs.

---

## 3. M0 Dependency Guard Scope

The M0 dependency guard protects active implementation paths. It must not fail simply because older historical documents mention superseded providers.

Protected paths:

- `apps/product-api/src/`
- `apps/scheduler/src/`
- `apps/dexter-worker/src/`
- `apps/data-openbb/`
- `apps/news-ingest/`
- `apps/mobile/android/app/src/main/`
- `packages/contracts/src/`
- `infra/` runtime and deployment config
- active Phase 6 documents

Allowed historical references:

- `Project Note/Phase1/` through `Project Note/Phase5/` when used as archived history
- older `Decisions/` records that are superseded by Phase 6
- evidence files that record previous behavior
- tests or fixtures that explicitly prove the guard fails for forbidden imports
- migration documents that explain what is being removed

Guard rule:

A deprecated provider term is allowed in documentation about migration or history. It is not allowed as an active runtime dependency, required env path, production import, mobile production shortcut, or current acceptance dependency unless explicitly marked archived/deprecated with an exit path.

---

## 4. Initial Source Registry Policy

M2 must implement a source registry before first-party context becomes user-facing.

Locked rules:

- No broad crawl.
- No default "any IR page is fine" rule.
- Every first-party domain must be registered with source class, allowed page types, storage/display mode, owner, and review date.
- Seed coverage may start with the supported smoke tickers from M1/M2, but exact domains must be validated in the source registry during implementation.
- Unknown domains default to reject.

Official macro scope for M1/M3:

- The first implementation should use a small official-source registry rather than a giant macro warehouse.
- Minimum source families: Federal Reserve/Treasury rates, BLS inflation/labor, BEA growth, and EIA energy where applicable.
- Exact series identifiers are implementation details owned by the M1 official-source registry and must be recorded in milestone evidence before M3 closes.

---

## 5. Locked Contract Names

Phase 6 contract changes must be additive or versioned. If an equivalent contract already exists, extend it deliberately rather than creating a duplicate shape.

Canonical contract files and public names:

| File | Public interfaces / types |
|---|---|
| `packages/contracts/src/official-source.ts` | `OfficialSourceReference`, `OfficialRetrievalMetadata`, `OfficialMissingFieldState` |
| `packages/contracts/src/evidence-rights.ts` | `EvidenceRightsClass`, `EvidenceDisplayMode`, `EvidenceRightsMetadata` |
| `packages/contracts/src/canonical-event.ts` | `CanonicalEvent`, `CanonicalEventFamily`, `CanonicalEventSourceState` |
| `packages/contracts/src/first-party-context.ts` | `FirstPartyContextItem`, `FirstPartySourceRegistryEntry`, `FirstPartyContextFetchState` |
| `packages/contracts/src/call-artifact.ts` | `CallArtifact`, `CallArtifactType`, `CallArtifactCompletenessState` |
| `packages/contracts/src/earnings-state.ts` | `EarningsEventState`, `EarningsEventTimingState`, `EarningsEventEvidenceState` |
| `packages/contracts/src/macro-stress.ts` | `MacroStressSnapshot`, `MacroStressInput`, `MacroStressState`, `MacroStressOmission` |
| `packages/contracts/src/analysis-report-context.ts` | `AnalysisReportEvidenceContext`, `AnalysisReportOmission`, `AnalysisReportSourceState` |

Contract rules:

- Do not overload existing provider-shaped fields to mean official-source truth.
- Do not make beta, correlation, quote windows, or transcript text required for Phase 6 core outputs.
- Every evidence-bearing response must carry rights and provenance metadata.
- Every omission must be explicit and user-safe.
- Older report artifacts must remain readable.

---

## 6. Evidence Folder Standard

Every milestone uses the same evidence pattern as successful prior phases:

```text
Project Note/Phase6/Milestones/M#/evidence/YYYY-MM-DD_short-proof-name.md
```

Each evidence file should include:

- environment
- command or manual flow
- result
- important logs or screenshots where relevant
- owner sign-off state
- rollback note

---

## 7. Open Decisions That Still Require Stop-And-Ask

These are not needed for the documentation normalization pass, but they must be resolved before the named milestone begins implementation.

| Decision | Needed before | Default if not decided |
|---|---|---|
| Exact first-party domains for seed issuers | M2 implementation | Reject unknown domains; use SEC/official evidence only |
| Exact official macro series IDs | M1/M3 implementation | Use only the locked source families and record selected series in evidence |
| Any licensed quote provider re-entry | Any implementation | Not allowed |
| Any licensed transcript provider | M4 implementation or later | Not allowed; use first-party call artifacts |
| Repo rename from `data-openbb` to `data-public` | Post-Phase 6 only | Keep `data-openbb` |

