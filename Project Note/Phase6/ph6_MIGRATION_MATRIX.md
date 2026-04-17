# Thesis - Phase 6 Migration Matrix

**Version:** 1.0  
**Status:** Working Document  
**Last Revised:** 2026-04-16

This file translates the Phase 6 doctrine into concrete replacement rules.

---

## 1. Core Rule

If an old feature depends on a paid, personal-use, or rights-ambiguous provider, it must end Phase 6 in one of four states:

1. **replaced** by an official/public-source or first-party path,
2. **reduced** to a rights-safe and supportable version,
3. **omitted** with explicit truth-state behavior,
4. **deferred** behind a new ADR and not treated as core product behavior.

---

## 2. Surface-by-Surface Mapping

| Surface / Capability | Old Assumption | Phase 6 Replacement | If Replacement Is Incomplete |
|---|---|---|---|
| Company Deep Dive core financial truth | Provider-backed fundamentals or wrapper convenience | SEC / EDGAR / XBRL / filing exhibits | Use official truth only; omit unsupported metrics explicitly |
| Deep Dive recent company context | News/transcript-heavy enrichment | First-party IR materials, company releases, filed exhibits, rights-clean call artifacts | Continue with official evidence and flag sparse context |
| Market Pulse / Morning Briefing | Quote-led heatmap + provider macro + news | Morning Exception Briefing from official macro, canonical disclosure events, and bounded context | Emit explicit no-material-change or reduced context briefing |
| Rates / FX / energy context | Market-data feed | Official public release or official public dataset | Omit the unsupported dimension and flag coverage |
| Fear & Greed | Quote-heavy composite from ambiguous sources | Macro Stress from official-only inputs | Remove the old feature; do not fake continuity |
| Earnings calendar | Provider-backed calendar feed | Three-state model: estimated, confirmed, actual | Surface uncertainty explicitly |
| Earnings War Room | Transcript + quote context as baseline | Prior filings, release artifacts, slides, confirmed/actual states, contradiction summary | Still generate without transcript text |
| Alerts | Price thresholds as core behavior | Canonical-event and conviction-state alerts | Disable unsupported price-trigger variants |
| Conviction freshness | Price movement heavily weighted | Thesis age, filing age, contradiction state, event recency, macro relevance | Mark as limited if a rule depended on missing inputs |
| Cross-name intelligence | Correlation-first inference | Filing relationships, shared exposures, evidence-linked propagation | Hold back low-confidence edges |
| Scenario stress | Beta/correlation/quote dependency | Macro/fundamental scenario engine with explicit omitted dimensions | Omit unsupported market-derived dimensions |
| News archive | Full-text storage convenience | Rights-aware summary/excerpt/link storage | Keep only safe metadata and links |
| Transcript store | Open corpus as default substrate | Rights-gated optional transcript use; first-party call artifacts first | Do not block product value |

---

## 3. Service-Boundary Mapping

| Service | Old Meaning | Phase 6 Meaning |
|---|---|---|
| `data-openbb` | Provider abstraction for market/macro data | Official/public-source adapter boundary (temporary name only) |
| `news-ingest` | News crawl and normalization | Bounded first-party context ingest + allowlisted summary/link intake |
| `dexter-worker` | Deep Dive reasoning with possible hidden provider assumptions | Deep Dive reasoning over official truth, first-party context, and deterministic omissions |
| `scheduler` | Daily pulse + provider-timed jobs | Official refresh cadence, event windows, briefing orchestration |
| `product-api` | User/API truth with provider-backed read models | User/API truth with canonical events, evidence rights, and source-state semantics |

---

## 4. Contract Mapping

| Old Contract / Expectation | Phase 6 Rule |
|---|---|
| `CanonicalFinanceData.provider` implying `fmp` or `polygon` | Replace with provider-agnostic official-source semantics or a versioned successor contract |
| `CanonicalNewsArticle.body_text` always treated as safe to store | Make text storage conditional on rights and display mode |
| Price-derived fields implied by report consumers | Make them optional, omittable, or replaced by deterministic alternative fields |
| Transcript text assumed as a default evidence block | Make transcripts optional; call artifacts are the safer base object |
| Market Pulse sections assuming quote completeness | Rewrite sections toward macro, disclosure, context, and explicit omission truth |

---

## 5. Deprecated Dependency Exit Rules

A deprecated dependency is considered removed from the core path only when all of the following are true:

- the dependency is not required for the affected smoke test,
- the dependency is not imported in the protected production path,
- the relevant UI or API no longer implies its old behavior,
- the omission or replacement rule is documented.

---

## 6. Final Test

At the end of Phase 6, Thesis should still be able to answer these questions without a paid market-data API:

- What changed in this company?
- What changed in macro that matters to this company?
- Is this upcoming earnings event estimated, confirmed, or actual?
- What evidence supports the current thesis?
- What is stale, contradictory, or newly important?

If the answer to any of the above still secretly depends on a deprecated provider, Phase 6 is not done.
