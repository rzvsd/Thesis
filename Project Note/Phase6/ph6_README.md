# Thesis - Phase 6 Pack

Name of the app : "Thesis"  
Marketing for the app : "Every position needs one"

**Thesis — every position needs one**

A final architecture phase that removes paid and rights-ambiguous market-data dependencies from the core Thesis product.

---

## What Phase 6 Changes

Phase 6 does **not** turn Thesis into a cheaper quote app.

Phase 6 turns Thesis into a cleaner, more defensible intelligence product built on:

- SEC / EDGAR / XBRL / filing exhibits
- official macro releases and official public datasets
- first-party company context such as IR pages, press releases, and investor presentations
- bounded headline / summary / link context where rights are explicit
- deterministic event, freshness, decay, and scenario logic
- LLM synthesis only after the deterministic substrate has spoken

---

## What Thesis Still Does

**Company Deep Dive** — structured company research grounded in filings, historical truth, first-party artifacts, and explicit evidence.

**Morning Exception Briefing** — a scheduled daily briefing that explains what changed in macro, watched-name disclosures, and first-party company context since the last cycle.

**Earnings War Room** — pre-event, event-day, and post-event workflows based on confirmed/estimated/actual timing, release artifacts, and contradiction tracking.

**Conviction Freshness / Scenario Stress** — deterministic freshness, decay, and macro/fundamental scenarios without pretending to own licensed quote completeness.

---

## Architecture in One Paragraph

The three-plane architecture stays intact. The Product Plane still owns user state, jobs, alerts, and delivery. The Reasoning Plane still centers on `dexter-worker` for synthesis and thesis-native interpretation. The Data Plane is repurposed: `data-openbb` remains only as a temporary service name while becoming an official/public-source adapter boundary, and `news-ingest` becomes a bounded first-party and allowlisted-context ingest service. The mobile app still never bypasses Product API. Nothing in Phase 6 reintroduces FMP, OpenBB, yfinance, Alpha Vantage, or any similar provider as production truth.

---

## Core Stack (Phase 6 Interpretation)

| Component | Role |
|---|---|
| Postgres | System of record |
| Redis | Queue, cache, locks, rate limits |
| Dexter | Reasoning, synthesis, contradiction handling, scenario interpretation |
| `data-openbb` (temporary name) | Official/public-source adapter boundary |
| `news-ingest` | First-party context ingest + allowlisted bounded context |
| Artifact Store | Report artifacts and evidence bundles |
| Sentry | Errors and operational traces |
| PostHog | Product analytics and feature flags |
| LangSmith | Prompt lineage and eval records |

---

## Key Rules

- No paid or personal-use market-data API is part of the core production path.
- No full-text warehousing without explicit rights support.
- No broad scraping backbone.
- No price-derived feature may imply coverage the system does not actually have.
- Missing market-derived inputs must be shown as missing, not guessed.
- Every event, alert, and claim must retain a reason path.

---

## Local Development and Testing

Phase 6 core smoke tests must run without FMP, Polygon, Alpha Vantage, or OpenBB provider keys.

Expected local requirements:

- Docker
- Node.js 20+
- Python 3.11+
- a compliant SEC `User-Agent` string for official-source retrieval
- optional first-party source allowlist config for bounded context tests

Phase 6 local development is valid only if the app can be exercised with official/public fixtures and no deprecated paid-provider dependency.

---

## Key Phase 6 Documents

| Document | Purpose |
|---|---|
| `ph6_BLUEBOOK.md` | Final architecture phase doctrine and ownership |
| `ph6_PRD.md` | Product requirements addendum for the no-paid-data Thesis |
| `ph6_MILESTONES.md` | Phase 6 milestone briefs |
| `ph6_AGENTS.md` | Phase-wide operating rules |
| `ph6_SECURITY.md` | Source, rights, secret, and fetch policy |
| `ph6_DOC_OVERRIDES.md` | Repo-wide changes needed so old docs stop contradicting Phase 6 |

---

## Guiding Principle

**Premium value must come from reasoning, context discipline, and explainability — not from buying every feed.**
