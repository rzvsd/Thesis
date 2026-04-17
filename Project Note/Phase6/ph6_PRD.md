# Thesis - Phase 6 PRD Addendum

**Version:** 1.0  
**Status:** Living Document  
**Last Revised:** 2026-04-16  
**Owner:** Product Lead + Platform Architect

> This document extends `PRD.md`. It does not replace the original product requirements document.
>
> Phase 6 is the final architecture phase. It redefines Thesis around official-company truth, official macro truth, first-party company context, and rights-aware evidence. Any old expectation that Thesis must behave like a quote-led market terminal is deprecated by this addendum.

---

## Table of Contents

1. [Phase 6 Product Intent](#1-phase-6-product-intent)
2. [What Thesis Is After Phase 6](#2-what-thesis-is-after-phase-6)
3. [What Thesis Is Still Not](#3-what-thesis-is-still-not)
4. [Phase 6 Legal and Source Boundaries](#4-phase-6-legal-and-source-boundaries)
5. [Surface Updates](#5-surface-updates)
6. [Feature Rules](#6-feature-rules)
7. [Business Rules](#7-business-rules)
8. [Edge Cases and Failure Behavior](#8-edge-cases-and-failure-behavior)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Open Questions](#10-open-questions)

---

## 1. Phase 6 Product Intent

Phase 6 sharpens Thesis rather than shrinking it.

The product intent is:

- explain what changed in a company or in macro conditions
- show why that change matters to a held or watched thesis
- surface only meaningful exceptions
- keep conviction freshness explicit over time
- stay explainable and legally cleaner by grounding outputs in official and first-party evidence

Phase 6 does not optimize for institutional-terminal completeness. It optimizes for a serious early-stage intelligence product that a real user can trust.

---

## 2. What Thesis Is After Phase 6

Thesis is a mobile-first financial intelligence product built on five layers:

1. **Official issuer truth** — filings, XBRL facts, exhibits, and filing history.
2. **Official macro truth** — macro releases, rates, FX, energy, and fiscal context from official sources.
3. **First-party company context** — IR pages, company-hosted releases, presentations, webcast pages, and filed exhibits.
4. **Canonical events** — deterministic typed events such as `filing_posted`, `earnings_date_confirmed`, `guidance_changed`, `macro_release_published`.
5. **Narrated intelligence** — LLM explanations, contradiction summaries, question generation, and scenario interpretation downstream of deterministic truth.

---

## 3. What Thesis Is Still Not

Phase 6 keeps the non-goals intact and adds a few sharper clarifications.

| Incorrect expectation | Thesis behavior after Phase 6 |
|---|---|
| “Show me a complete real-time market board” | Thesis surfaces change-that-matters, not a licensed quote terminal |
| “Give me universal price alerts” | Alerts are event-first and thesis-first; price-dependent behavior is omitted unless explicitly supported |
| “Use any transcript you can find” | Transcript text is optional and rights-gated; first-party call artifacts come first |
| “Store every article body for search later” | Thesis stores only what rights allow, often headline/summary/link or excerpt-only |
| “Compute market-quality beta/correlation everywhere” | Scenario and valuation logic use macro/fundamental and thesis-native inputs when market-derived inputs are unavailable |

---

## 4. Phase 6 Legal and Source Boundaries

### 4.1 Hard truth sources

The following are acceptable as hard truth when implemented within the documented adapter boundary:

- SEC / EDGAR / XBRL / company submissions / filing exhibits
- official macro agency releases and official public datasets
- official rates, FX, energy, and fiscal releases from approved public agencies

### 4.2 Enrichment sources

The following may enrich the product when explicitly allowlisted:

- company IR pages
- company-hosted press releases and presentations
- webcast landing pages and related call materials
- allowlisted RSS or summary/link feeds with bounded storage rights

### 4.3 Prohibited core assumptions

Phase 6 prohibits treating the following as production truth for the core product path:

- FMP, OpenBB, Alpha Vantage, Polygon, Twelve Data, or similar providers
- yfinance / Yahoo style wrappers
- personal-use data plans
- broad publisher scraping
- open transcript corpora with unclear or mixed commercial rights

### 4.4 Rights-aware content rule

Every evidence item must carry a source-rights posture before it can be stored or shown:

- `official_public`
- `first_party_corporate`
- `licensed_headline`
- `licensed_fulltext`
- `restricted_excerpt_only`
- `link_only`

If the rights posture is unknown, the item is incomplete and cannot be treated as production-safe evidence.

---

## 5. Surface Updates

### 5.1 Company Deep Dive

Deep Dive remains a primary surface.

Phase 6 Deep Dive is built from:

- filing history and XBRL truth
- first-party company artifacts
- deterministic period-over-period and thesis-relevant diffs
- contradiction summaries and freshness context
- optional transcript text only when provenance is clean enough to use

Deep Dive does **not** require licensed quote completeness to be useful.

### 5.2 Morning Exception Briefing

The old quote-led reading of Market Pulse is deprecated.

Phase 6 Morning Exception Briefing answers:

- what official macro changed since the last cycle
- what changed in my watched names at the filing or first-party layer
- what is confirmed vs estimated vs uncertain
- what likely deserves a deeper review today
- whether nothing material changed

The absence of a large price board is not a product failure if the briefing is still useful.

### 5.3 Alerts / Exception Engine

Alerts fire on canonical events and deterministic state changes such as:

- new filings
- guidance changes
- material risk-factor or segment changes
- earnings date confirmation
- results released
- dividend / split / listing-status changes
- macro events relevant to followed names
- conviction freshness decay crossing a review threshold

Alerts must never depend on fake quote completeness.

### 5.4 Earnings War Room

War Room becomes a first-party and official-evidence workflow.

It must support:

- `estimated`, `confirmed`, and `actual` earnings state
- prior filing baseline
- prior management promises / guidance references
- release exhibit capture
- slide deck capture where available
- contradiction and follow-up question generation

Transcript text is optional, not required for War Room usefulness.

### 5.5 Freshness / Decay / Conviction Monitoring

Freshness must be driven by:

- thesis age
- filing age
- unresolved contradictions
- earnings cycle completion
- first-party release changes
- official macro changes relevant to the thesis

Phase 6 makes it unacceptable to let price-only movement dominate freshness if quote rights and coverage are limited.

### 5.6 Cross-Name Intelligence

Cross-name intelligence remains in-scope, but Phase 6 shifts its default substrate toward:

- supply/customer relationships described in filings
- shared macro exposures
- shared geography or segment exposures
- partner/M&A/industry event propagation based on evidence

Price-correlation-only relationship inference is explicitly de-emphasized.

### 5.7 Scenario Stress

Scenario Stress becomes a macro/fundamental scenario surface.

Allowed primary dimensions:

- rates
- inflation
- labor
- energy / commodities
- FX
- segment demand shock
- geography stress

If a scenario would require licensed market data that Thesis does not own, that scenario must either omit that dimension or declare it unsupported.

---

## 6. Feature Rules

### 6.1 Source-state visibility

Users must be able to see at least these truth states where relevant:

- confirmed
- estimated
- actual
- unavailable
- not monitored yet
- revised since prior pull

### 6.2 Evidence behavior

Every surfaced claim must still show source references. In Phase 6, the UX must also respect rights:

- some items open a filing or source URL directly
- some items show only a bounded summary and a source link
- some items show only that the evidence exists but cannot be fully displayed in-app

### 6.3 Quote-derived omissions

If a prior view once depended on price-derived behavior, the app must either:

- omit it,
- relabel it as unavailable, or
- show a reduced variant that does not imply market-data completeness.

### 6.4 Watchlist / My Names

The user-facing framing may remain “My Names,” but the backend model still behaves like a watchlist. Phase 6 adds stronger event relevance and source-state labeling, not brokerage or portfolio behavior.

---

## 7. Business Rules

| Rule | Detail |
|---|---|
| **No fabricated market completeness** | If Thesis lacks licensed or supported quote coverage, it must not simulate real-time or universal price behavior |
| **No evidence without rights posture** | Every stored evidence item must carry a rights class and display mode |
| **No transcript dependency for core value** | Deep Dive and War Room must remain useful without transcript text |
| **No broad scrape default** | Browser automation is event-driven and domain-allowlisted only |
| **No market-derived required valuation input** | Beta/correlation-style inputs are optional; omission must be explicit |
| **No “all clear” hallucination** | “No material change” is a deterministic state, not a language flourish |
| **No old provider ghosting** | Deprecated provider calls are treated as regression bugs |

---

## 8. Edge Cases and Failure Behavior

| Situation | What the system does |
|---|---|
| No confirmed earnings date exists yet | Surface `estimated` or `unavailable` with source and timestamp |
| Filing exists but first-party IR page is missing or changed layout | Proceed with official evidence and flag missing first-party context |
| First-party release is present but full-text rights are limited | Store a bounded summary/excerpt as allowed and link to source |
| Transcript is unavailable or provenance is unclear | Use release, slides, and filed materials; do not block War Room |
| Macro series revises after prior pull | Surface revised state and update reasoning context |
| A screen used to show price behavior that is no longer supported | Omit or degrade explicitly rather than show approximate placeholders |
| Two sources disagree on earnings timing | Surface the conflict and do not silently choose unless the priority order resolves it |
| No material changes occurred | Generate an explicit no-material-change output rather than a padded briefing |

---

## 9. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| Deep Dive generation | Keep the current Deep Dive SLA target where feasible; omit unsupported data rather than block the report |
| Morning Exception Briefing delivery | Available before the configured pre-market window ends |
| Event-state updates | New official or first-party events become visible on the next scheduled or triggered refresh |

### Reliability

| Metric | Target |
|---|---|
| Core product value without deprecated providers | Must remain intact |
| Official-source refresh observability | All failed official pulls are visible operationally |
| Rights-state correctness | No evidence item should be displayed outside its allowed display mode |

### Security and source discipline

- no real secrets committed
- no provider-key dependency required for core smoke tests
- no production reliance on a developer laptop for source allowlists or secret files
- all event-driven fetch policies documented and reviewable

---

## 10. Open Questions

| Question | Needed By | Owner | Status |
|---|---|---|---|
| Which first-party domains are in the default allowlist for Phase 6 launch? | M2 | Product + Legal | Open |
| Which official macro series are mandatory for Macro Stress v1? | M3 | Product | Open |
| Which old quote-led UI components are omitted vs preserved in reduced form? | M3 | Product + Mobile | Open |
| Do we keep the `data-openbb` folder name through full launch or rename to `data-public` during Phase 6? | M1 | Engineering Lead | Open |
| Which transcript sources, if any, are considered rights-clean enough beyond first-party artifacts? | M4 | Legal + Product | Open |
