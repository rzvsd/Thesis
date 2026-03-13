Initial FIle - can be ignored.
Some initial ideas might be still standing - but is not the ultimate truth (!)







# Finance Intelligence Platform Bluebook

## 1. Mission
Build an Android-first financial intelligence product with two core user-facing capabilities:

1. **Company Deep Dive**  
   On-demand analysis of a public company across recent quarters, filings, debt/liquidity, major events, and an explainable research signal.

2. **Market Pulse**  
   A scheduled morning briefing that explains what changed in markets, macro, and major news since the last cycle.

### Non-goals for v1
- No trade execution
- No brokerage integration
- No portfolio rebalancing engine
- No autonomous investing actions
- No generic “AI that does everything”

---

## 2. Product Doctrine
This product is a **research and interpretation system**, not a trading bot.

Every user-facing output must be:
- structured
- explainable
- evidence-backed
- resilient to missing data
- safe to present without pretending certainty

The v1 signal is a **research signal**, not a buy/sell execution order.

---

## 3. System Planes
The system is split into three planes.

### Data Plane
Responsible for retrieving and normalizing inputs.

- **OpenBB**: structured finance and macro data
- **news-please**: news/article ingestion

### Reasoning Plane
Responsible for analysis and synthesis.

- **Dexter**: planning, reasoning, section analysis, scoring, and report generation

### Product Plane
Responsible for user experience and delivery.

- **Mobile app**
- **Product API**
- **Scheduler**
- **Storage**
- **Observability stack**

---

## 4. Core Stack
| Component | Role |
|---|---|
| **Postgres** | System of record |
| **Redis** | Queue, cache, ephemeral speed layer |
| **Dexter** | Analysis brain |
| **OpenBB** | Financial and macro data plane |
| **news-please** | News intake layer |
| **Sentry** | Operational health and tracing |
| **PostHog** | Product behavior and feature rollout |
| **Langfuse** | LLM traces, prompt lineage, eval visibility |

### Architectural interpretation
- **Postgres** stores durable truth
- **Redis** stores fast-moving temporary state
- **Dexter** thinks and writes
- **OpenBB** supplies governed financial facts
- **news-please** brings raw articles into the system
- **Sentry** answers: what broke?
- **PostHog** answers: what do users do?
- **Langfuse** answers: what did the model do?

---

## 5. Ownership Matrix
| Component | Must Own | Must Not Own |
|---|---|---|
| **Postgres** | Users, jobs, reports metadata, watchlists, audit events | Queue state, hot cache, temporary locks |
| **Redis** | Queue, retries, locks, ephemeral cache, rate limits | Durable truth, final reports |
| **Dexter** | Reasoning, scoring, synthesis, evidence assembly | Direct mobile access, auth, provider governance |
| **OpenBB** | Finance and macro retrieval, provider abstraction, normalization | Narrative writing, user-facing report rendering |
| **news-please** | Article extraction and feed intake | Importance scoring, final conclusions |
| **Sentry** | Errors, traces, operational failures | Product funnels, prompt lineage |
| **PostHog** | Product analytics, feature flags, behavior | Backend source of truth for errors |
| **Langfuse** | Prompt versions, LLM traces, eval records | Product analytics, infra error tracking |

### Forbidden overlaps
1. Dexter must not bypass OpenBB for finance/macro data unless explicitly approved.
2. The mobile app must never call OpenBB or raw providers directly.
3. PostHog is not the system of record for backend failures.
4. Redis must never become the accidental database.
5. news-please must not decide what matters. It only ingests.

---

## 6. Product Surfaces
### A. Company Deep Dive
User asks for one ticker and receives a structured report.

Expected sections:
- executive summary
- quarter-over-quarter and year-over-year changes
- revenue and margin analysis
- debt and liquidity
- acquisitions and major events
- management/risk commentary
- explainable research signal
- confidence
- evidence references

### B. Market Pulse
A scheduled daily briefing answering:
- what moved materially
- what likely drove those moves
- what changed since yesterday
- what is uncertain
- what to watch today

Expected inputs:
- market/index moves
- macro releases
- rates/FX/commodities
- material approved-source news
- optional watchlist overlays

---

## 7. Canonical Contracts
No service is allowed to freestyle JSON in production.

Core contracts:
- `AnalysisRequest`
- `AnalysisReport`
- `MarketPulseReport`
- `CanonicalFinanceData`
- `CanonicalNewsArticle`
- `EvidenceItem`

### Contract principles
- version everything
- validate everything
- never let prompts define production structure
- every major claim must be traceable to evidence

---

## 8. Folder Hierarchy Vision
```text
finance-intelligence-platform/
├── README.md
├── BLUEBOOK.md
├── ROADMAP.md
├── OWNERSHIP_MATRIX.md
├── ARCHITECTURE.md
├── DECISIONS/
├── docs/
├── apps/
│   ├── mobile/
│   ├── product-api/
│   ├── dexter-worker/
│   ├── data-openbb/
│   ├── news-ingest/
│   └── scheduler/
├── packages/
│   ├── contracts/
│   ├── shared-types/
│   ├── scoring-engine/
│   ├── ui-schema/
│   └── observability/
├── infra/
├── data/
├── tests/
└── .github/
```

### Meaning of the structure
- **apps/** contains deployable services and products
- **packages/** contains true shared modules only
- **docs/** contains architecture, contracts, runbooks, and testing doctrine
- **infra/** contains deployment and environment logic
- **data/** contains golden datasets and fixtures
- **tests/** contains integration, smoke, end-to-end, and load testing

---

## 9. Service Catalog
| Service | Purpose | Exposure |
|---|---|---|
| **mobile-app** | user interface | public client |
| **product-api** | auth, jobs, history, report retrieval | public |
| **dexter-worker** | deep-dive and pulse reasoning pipeline | private |
| **data-openbb** | normalized finance and macro access | private |
| **news-ingest** | crawl and normalize approved-source news | private |
| **scheduler** | timed runs and automation | private |
| **postgres** | durable state | private |
| **redis** | queue/cache/locks | private |
| **artifact-store** | report artifacts and evidence bundles | private |

---

## 10. Source-of-Truth Hierarchy
When there is ambiguity, the system must prefer this order:

1. **Structured finance and macro data** from the governed OpenBB path
2. **Primary text evidence** from filings and approved articles
3. **Dexter synthesis** over those inputs
4. **User-facing summary text**

This prevents the product from drifting into unsupported claims.

---

## 11. Delivery Doctrine
A feature is not complete when it demos well.
A feature is complete only when it has:

- schema
- smoke test
- owner
- observable runtime behavior
- rollback path
- defined failure mode

### Definition of done
Every milestone must end with a deployable, testable increment.

---

## 12. Milestones
| Milestone | Outcome |
|---|---|
| **M1** | Product and architecture baseline |
| **M2** | Data plane foundation: OpenBB + news ingest |
| **M3** | Dexter extraction and adapters |
| **M4** | Product API and job system |
| **M5** | Company Deep Dive v1 |
| **M6** | Market Pulse subsystem |
| **M7** | Android MVP |
| **M8** | Visibility and production hardening |

### Milestone rule
No milestone is considered complete without smoke tests and defined acceptance criteria.

---

## 13. Smoke Test Doctrine
### Deep Dive path
- company search works
- request is accepted
- job enters queue
- Dexter executes
- OpenBB data retrieval works
- report validates against schema
- evidence references exist
- mobile app renders result

### Market Pulse path
- scheduler fires
- OpenBB market data retrieval works
- news-ingest returns normalized articles
- ranking pipeline runs
- Dexter generates morning briefing
- report is stored and retrievable
- mobile home screen renders it

### Visibility path
- API exception appears in Sentry
- user action appears in PostHog
- Dexter run appears in Langfuse with prompt/model lineage

---

## 14. Anti-Frankenstack Rules
1. No new tool unless it fills a clearly documented ownership gap.
2. No direct provider integrations from the mobile app.
3. No production JSON invented inside prompt text.
4. No score without reasons and evidence.
5. No temporary cron script outside the scheduler/job model.
6. No observability overlap without declaring the primary system of record.
7. No finance/macro retrieval path that bypasses the data plane casually.

---

## 15. Final Architect-Manager Standard
The final result of this project is not just a working app.

The final result is a system with:
- a stable mission
- defined service boundaries
- contract-driven development
- deployable products in their own folder hierarchies
- observable behavior
- repeatable smoke tests
- controlled failure modes
- a roadmap that can be handed to a team without ambiguity

That is the real end-state.

