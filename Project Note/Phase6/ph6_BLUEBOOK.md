# Thesis - Phase 6 Bluebook

**Version:** 1.0  
**Status:** Living Document  
**Last Revised:** 2026-04-16  
**Owner:** Platform Architect + Product Lead

> This document extends `BLUEBOOK cld.md`, `ph2_BLUEBOOK.md`, `ph3_BLUEBOOK.md`, `ph4_BLUEBOOK.md`, and `ph5_BLUEBOOK.md`.
>
> **Selective supersession note:** Phase 6 is the final architecture phase and explicitly supersedes prior assumptions that Thesis depends on OpenBB, FMP, Polygon, Alpha Vantage, yfinance, or any other paid or rights-ambiguous market-data API for its core product behavior. Where earlier docs refer to `data-openbb`, paid-provider-backed Market Pulse, beta-from-provider-price, or quote-native product requirements, those assumptions are deprecated by this document.
>
> The existing service boundary may temporarily keep the folder name `data-openbb` for migration continuity, but its production responsibility is redefined as an official/public-source adapter boundary. A later repository rename to `data-public` is allowed, but it is not required to begin the migration.

---

## Table of Contents

1. [Phase 6 Mission](#1-phase-6-mission)
2. [Phase 6 Product Doctrine](#2-phase-6-product-doctrine)
3. [Architecture Interpretation](#3-architecture-interpretation)
4. [Phase 6 Intelligence Systems](#4-phase-6-intelligence-systems)
5. [Service Ownership Extensions](#5-service-ownership-extensions)
6. [Contract Guidance](#6-contract-guidance)
7. [Compatibility Guardrails](#7-compatibility-guardrails)
8. [Operational Risk Register](#8-operational-risk-register)
9. [Final Standard](#9-final-standard)

---

## 1. Phase 6 Mission

Phase 6 exists to make Thesis sustainable, legally cleaner, and more durable by completing the transition to an official-source-first intelligence architecture.

The mission:

- remove dependency on paid and rights-ambiguous market-data APIs from core product behavior
- make official disclosures and official macro releases the hard truth layer
- make first-party company context a deliberate product edge
- preserve Thesis usefulness without pretending to be a quote terminal
- keep explainability, cost control, and shipping speed aligned instead of in conflict

Phase 6 is successful only if Thesis remains a serious intelligence product after the paid-market-data assumptions are removed.

---

## 2. Phase 6 Product Doctrine

Earlier doctrines still apply:

- no fabricated data
- no mobile bypass of service boundaries
- no opaque output without explainable evidence
- no score without traceable reasons

Phase 6 adds seven non-negotiables:

1. **Official-source-first truth.** SEC and official macro agencies outrank wrappers, aggregators, and media summaries.
2. **No quote theater.** If Thesis does not have licensed market data for a surface, that surface must not simulate quote completeness or precision.
3. **Rights-aware evidence.** Every stored evidence item must carry explicit storage and display permissions.
4. **First-party-before-third-party context.** IR pages, company press releases, investor presentations, and SEC exhibits outrank publisher interpretation.
5. **Deterministic substrate, narrated surface.** Diffs, freshness math, decay math, alert gating, and scenario math remain deterministic code; the LLM explains but does not decide those results.
6. **No scrape backbone.** Browser automation is allowlisted, event-driven, and bounded. It is never the system-of-record layer.
7. **Coverage honesty.** Missing market-derived inputs are surfaced explicitly; Thesis does not hide the difference between “not material” and “not covered.”

---

## 3. Architecture Interpretation

The three-plane architecture remains intact.

Phase 6 does not require a fourth plane and does not require a new fleet of services. It changes the meaning of the existing data-plane boundary.

### 3.1 Data-plane reinterpretation

The current data-plane shape remains:

- Product Plane
- Reasoning Plane
- Data Plane

But the data plane is reinterpreted as:

- **official-company truth** from SEC / EDGAR / XBRL / exhibits
- **official macro truth** from BLS, BEA, Treasury, Federal Reserve, and other official public datasets approved by Product and Legal
- **first-party company context** from IR pages, company-hosted press releases, investor presentations, webcast pages, and attached materials
- **bounded headline context** from allowlisted feeds and summaries, not a full-text publisher warehouse

### 3.2 Service-boundary reinterpretation

- `data-openbb` is no longer a paid-provider abstraction in production doctrine. It becomes the governed internal adapter layer for official/public-source retrieval and normalization.
- `news-ingest` is no longer treated as a broad “news crawler.” It becomes a bounded context-ingest service for allowlisted RSS, first-party company materials, and event-driven fetches.
- `dexter-worker` remains the Deep Dive reasoning engine, but it must stop depending on market-data shortcuts as hidden truth.

### 3.3 Product-surface reinterpretation

- **Company Deep Dive** remains a research surface built on filings, official history, first-party artifacts, and deterministic reasoning.
- **Market Pulse** remains a user-facing surface, but it is no longer required to behave like a quote-led market board. It becomes a disclosure- and macro-led exception briefing with bounded company context.
- **Scenario Stress** becomes macro/fundamental scenario stress by default, not beta/correlation theater.
- **Earnings workflows** become evidence-pack driven: confirmed schedule state, earnings-release artifact, management materials, and post-event contradiction tracking.

---

## 4. Phase 6 Intelligence Systems

| System | Purpose | Primary Owners |
|---|---|---|
| **Official Truth System** | Builds and refreshes canonical company and macro truth from official sources only | `data-openbb` (temporary boundary name), `product-api`, `scheduler` |
| **First-Party Context System** | Ingests IR pages, company releases, presentations, and filing exhibits as bounded enrichment | `news-ingest`, `scheduler`, `product-api` |
| **Rights and Provenance System** | Tracks what Thesis may store, excerpt, display, and link for every evidence item | `product-api`, `packages/contracts`, `mobile` |
| **Canonical Event System** | Normalizes filings, guidance changes, confirmed earnings events, macro releases, and disclosure changes into typed events | `product-api`, `scheduler`, `dexter-worker` |
| **Macro Stress System** | Replaces quote-heavy fear/greed behavior with an official-data-only macro stress view | `product-api`, `scheduler`, `mobile` |
| **Thesis-Native Scenario System** | Runs deterministic scenario and valuation logic without requiring beta, correlation, or real-time quote dependencies | `product-api`, `dexter-worker`, `mobile` |

### 4.1 Official Truth System

Minimum behaviors:

- SEC submissions and filing retrieval
- SEC company facts / XBRL normalization
- nightly and event-driven official refresh
- official macro release snapshots and revision-aware storage
- explicit missing-field and stale-data handling

### 4.2 First-Party Context System

Minimum behaviors:

- allowlisted IR and press-release source registry
- event-driven fetches only
- page-hash monitoring for watched corporate pages
- Exhibit 99.1 / 99.2 and related filing artifact capture where available
- no unbounded crawling across unknown domains

### 4.3 Rights and Provenance System

Minimum behaviors:

- evidence-level `rights_class`
- evidence-level `display_mode`
- evidence-level `source_rank`
- explicit distinction between full-text-safe, excerpt-only, headline-only, and link-only content
- auditability of why a given evidence item was stored and shown

### 4.4 Canonical Event System

Minimum event families:

- filing posted
- results released
- earnings date confirmed
- earnings date estimated
- guidance changed
- risk factor changed
- dividend / split / listing-status event
- macro release published
- first-party presentation / release published
- no-material-change pulse output

### 4.5 Macro Stress System

Phase 6 deprecates the prior fear-and-greed dependency on quote-heavy or rights-ambiguous inputs.

Macro Stress exists to answer:

- what official macro changed
- what remains tight, easing, or contradictory
- what matters for my names
- what should be reviewed before the next market open

This is a product interpretation layer, not a pseudo-trading index.

### 4.6 Thesis-Native Scenario System

Scenario Stress remains a first-class feature, but it is redefined around:

- rates shock
- inflation / labor / demand shock
- energy and commodity exposure where official inputs exist
- FX pressure where official inputs exist
- segment / geography sensitivity inferred from filings and company materials

Where price-derived or market-derived inputs are unavailable or unlicensed, those dimensions are omitted explicitly rather than estimated silently.

---

## 5. Service Ownership Extensions

| Service | Phase 6 Must Own | Phase 6 Must Not Own |
|---|---|---|
| `product-api` | Canonical event persistence, evidence rights metadata, earnings state truth, monitor compatibility, public API responses, alert reason-path serving | Hidden provider fallback rules or mobile-only truth |
| `scheduler` | Official refresh cadence, event-window fetch triggers, macro release ingestion timing, pulse generation, idempotent cutover jobs | Broad crawling or permanent storage of raw unpublished text |
| `data-openbb` | SEC and official macro adapter boundary, normalization, source-state and missing-field truth, no-paid-provider production path | Production reliance on OpenBB library, FMP, yfinance, or other provider wrappers |
| `news-ingest` | First-party context retrieval, allowlisted RSS intake, call artifact discovery, context dedupe, rights tagging | Full-text publisher warehousing, broad-market quote ingestion, interpretation ownership |
| `dexter-worker` | Deterministic-diff-aware synthesis, contradiction summaries, first-party artifact summarization, thesis-native scenario interpretation, omission logic when required inputs are absent | Paid market-data shortcuts, quote-derived signal invention, persistence of user monitor state |
| `mobile` | Provenance and freshness presentation, estimated-vs-confirmed event labeling, explicit no-material-change UX, evidence-safe source-opening behavior | Reconstructing missing quote coverage locally, implying real-time market-data support |
| `packages/contracts` | Additive typed contracts for canonical events, rights metadata, call artifacts, macro stress, earnings state, and migration-safe report versions | Product copy, provider-specific scraping rules, mobile-only helper state |

---

## 6. Contract Guidance

Phase 6 likely requires additive contract families or versioned extensions in `packages/contracts`.

| Contract Area | Purpose | Producer | Consumer |
|---|---|---|---|
| `CanonicalEvent` | Typed event substrate for filings, macro releases, earnings states, and corporate actions | `product-api`, `scheduler` | `mobile`, `dexter-worker` |
| `EvidenceRights` | Explicit storage/display rights and source rank metadata | `product-api`, `news-ingest`, `data-openbb` | `mobile`, `dexter-worker` |
| `CallArtifact` | Release, slides, webcast, transcript, or supplemental company material with completeness and rights flags | `news-ingest`, `product-api` | `dexter-worker`, `mobile` |
| `EarningsEventState` | `estimated`, `confirmed`, `actual`, with source and timestamp | `product-api`, `scheduler` | `mobile`, `dexter-worker` |
| `MacroStressSnapshot` | Official-only macro stress summary with missing-input audit trail | `scheduler`, `product-api` | `mobile` |
| `ContextItem` or versioned news contract | Rights-safe headline/summary/link item for first-party or allowlisted context | `news-ingest` | `product-api`, `mobile`, `dexter-worker` |
| `AnalysisReport` additive extension | Preserves existing report readability while adding provenance and rights-aware context metadata | `dexter-worker` | `product-api`, `mobile` |

Rules:

1. **No silent contract overload.** If the old `CanonicalNewsArticle` shape implies more text rights than Phase 6 allows, create a versioned replacement or additive companion contract.
2. **No provider-shaped truth.** Contract fields must not assume `fmp`, `polygon`, or other deprecated provider identities as the expected production path.
3. **No market-derived required fields where rights are absent.** Beta, intraday price windows, and similar fields must be optional or omitted with explicit flags.
4. **Every event contract supports confidence and state.** Especially for earnings timing: `estimated`, `confirmed`, `actual` must be explicit.
5. **Every evidence-bearing contract supports rights and provenance.** A source without rights metadata is incomplete.
6. **Stored historical reports remain readable.** Migration work may adapt old reports at read-time, but older stored artifacts must not become unreadable.

---

## 7. Compatibility Guardrails

1. **Three-plane continuity holds.** Phase 6 changes responsibilities, not the core system shape.
2. **Today / Names / Research / Inbox / You remain valid product ownership lanes.** Phase 6 changes substrate and intelligence quality, not top-level route meaning.
3. **Deep Dive remains usable even when first-party context is sparse.** SEC-backed history and filing evidence remain sufficient for a truthful report.
4. **Pulse delivery timing remains compatible.** The surface may change emphasis away from quote-led market moves, but the daily delivery loop remains stable.
5. **No placeholder quote features.** If a prior screen depended on price-heavy content, it must degrade to omission or an explicitly reduced variant.
6. **`data-openbb` may keep its folder name during migration, but by the end of Phase 6 no production-critical path may require the OpenBB library or paid-provider keys.**
7. **Transcript absence must not block product value.** Screens and workflows must rely first on releases, slides, filings, and other first-party artifacts.
8. **No new paid or personal-use API may enter the core path without a new ADR, legal review note, and cost review note.**
9. **Existing alert-ledger, monitor-state, and notification-preference semantics remain compatible.** Phase 6 changes input quality and evidence rules, not durable user control truth.
10. **Fear-and-greed continuation is not assumed.** If it cannot be supported by official-only inputs, Macro Stress replaces it.

---

## 8. Operational Risk Register

| Risk | Why It Matters | Required Control |
|---|---|---|
| Ghost dependency on OpenBB / FMP / yfinance remains in production paths | Hidden legal, cost, and runtime fragility survive the migration | Dependency inventory, CI assertion, and smoke proof that Phase 6 routes do not call deprecated providers |
| Rights bleed from stored text | Thesis could accidentally warehouse or display text beyond its rights | Mandatory evidence rights metadata, default excerpt-only storage, and allowlist review |
| First-party sites change layout or block automation | Event-driven context can silently degrade | Domain allowlist, page-hash monitors, fallback to SEC artifacts, and parser-specific smoke fixtures |
| Earnings timing is ambiguous | War Room and alerts lose trust if dates are implied too strongly | Three-state model: `estimated`, `confirmed`, `actual`, each with visible source and timestamp |
| Official macro series revise after release | Users may see changing interpretations without explanation | Retrieved-at timestamps, revision-aware storage, and explicit “revised since prior pull” flags where relevant |
| Scenario outputs imply false precision without price history | Users over-trust weak quant framing | Macro/fundamental scenario framing only; omit market-derived measures when unlicensed or unavailable |
| Coverage skews toward watched names and leaves the long tail thinner | Product expectations can outrun the actual system | Watched-name-first product promise, coverage metadata, and “not monitored yet” truth states |
| Market Pulse expectation drifts toward terminal behavior | Users expect quote heatmaps the product should not promise | Product copy, UX, and notification text emphasize change-that-matters, not quote-board completeness |
| Transcript provenance remains unclear | Commercial risk and evidence quality degrade | Use transcript text only when first-party or otherwise rights-clean; otherwise rely on call artifacts and releases |

---

## 9. Final Standard

Phase 6 is successful only if Thesis can truthfully operate as a serious intelligence product without paid market-data APIs in its core path.

The final standard is:

- Thesis runs on official disclosures, official macro releases, and first-party company context as its primary substrate
- no report, alert, or screen implies quote precision or redistribution rights the system does not actually possess
- every surfaced event has a resolvable reason path and provenance trail
- Morning Pulse remains useful through macro, disclosure, and watched-name context even when quote-board behavior is absent
- scenario and valuation outputs remain deterministic, explainable, and explicit about omitted inputs
- operating cost and legal surface area are materially lower than the prior provider-heavy path
- the product still feels like Thesis: explainable, thesis-native, exception-first, and honest about uncertainty
