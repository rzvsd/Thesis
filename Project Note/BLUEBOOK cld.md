# Finance Intelligence Platform — Bluebook
**Version:** 2.0  
**Status:** Living Document  
**Last Revised:** 2026-03  
**Owner:** Platform Architect  

---

## Table of Contents

1. [Mission](#1-mission)
2. [Product Doctrine](#2-product-doctrine)
3. [System Planes](#3-system-planes)
4. [Core Stack](#4-core-stack)
5. [Ownership Matrix](#5-ownership-matrix)
6. [Dexter Architecture](#6-dexter-architecture)
7. [Data Model](#7-data-model)
8. [Auth Strategy](#8-auth-strategy)
9. [Contract Schemas](#9-contract-schemas)
10. [Product Surfaces](#10-product-surfaces)
11. [Service Catalog](#11-service-catalog)
12. [Source-of-Truth Hierarchy](#12-source-of-truth-hierarchy)
13. [Dependency Risk Register](#13-dependency-risk-register)
14. [Scale Assumptions](#14-scale-assumptions)
15. [Folder Hierarchy](#15-folder-hierarchy)
16. [Delivery Doctrine](#16-delivery-doctrine)
17. [Smoke Test Doctrine](#17-smoke-test-doctrine)
18. [Milestones](#18-milestones)
19. [Anti-Frankenstack Rules](#19-anti-frankenstack-rules)
20. [Architecture Decision Records](#20-architecture-decision-records)
21. [Final Standard](#21-final-standard)

---

## 1. Mission

Build an **Android-first financial intelligence product** with two core user-facing capabilities:

**Company Deep Dive**  
On-demand, structured analysis of a public company across recent quarters, filings, debt/liquidity, major events, and an explainable research signal.

**Market Pulse**  
A scheduled morning briefing that explains what changed in markets, macro, and major news since the last cycle — and what it means.

### Non-Goals for v1

| Out of Scope | Reason |
|---|---|
| Trade execution | Regulatory, liability, out of mission |
| Brokerage integration | Execution dependency, out of v1 scope |
| Portfolio rebalancing | Requires persistent position tracking |
| Autonomous investing actions | Directly contradicts research-only doctrine |
| Generic AI assistant | Scope dilution |
| Web or iOS apps | Android-first; other platforms deferred |

---

## 2. Product Doctrine

This product is a **research and interpretation system**. It does not advise. It does not trade. It synthesizes structured evidence and presents it with explicit confidence levels and traceable references.

Every user-facing output **must be**:
- Structured (schema-validated, not free-form)
- Explainable (every claim traceable to an evidence item)
- Evidence-backed (no assertion without a source)
- Resilient to missing data (degrade gracefully, never fabricate)
- Honest about uncertainty (confidence scores are mandatory)

The v1 signal is a **research signal** — not a buy/sell recommendation. This distinction must survive every product decision and every prompt revision.

---

## 3. System Planes

The system is divided into three planes. Routing between planes depends on the product surface.

```
┌─────────────────────────────────────────────┐
│              PRODUCT PLANE                  │
│   Mobile App · Product API · Scheduler      │
│   Storage · Observability                   │
├─────────────────────────────────────────────┤
│              REASONING PLANE                │
│   Dexter (planning, analysis, synthesis)    │
├─────────────────────────────────────────────┤
│               DATA PLANE                   │
│   OpenBB · news-ingest · Artifact Store    │
└─────────────────────────────────────────────┘
```

**Surface-specific routing:**
- **Company Deep Dive:** Product API → Dexter. Dexter is the primary research engine and manages its own data retrieval.
- **Market Pulse:** Product API / Scheduler → Data Plane (OpenBB + news-ingest). Data is assembled from the Data Plane and synthesized into the briefing.
- **Always true:** The mobile app never calls any plane except Product API.

---

## 4. Core Stack

| Component | Role | Type |
|---|---|---|
| **Postgres** | System of record — durable truth | Infrastructure |
| **Redis** | Queue, cache, locks, rate limits | Infrastructure |
| **Dexter** | Primary Deep Dive research engine — planning, analysis, synthesis | Internal service (upstream OSS) |
| **OpenBB** | Market, macro, and financial data for Market Pulse | Internal service (wraps external providers) |
| **news-ingest** | Approved-source news intake and normalization for Market Pulse | Internal service |
| **Artifact Store** | Report artifacts and evidence bundles (S3-compatible) | Infrastructure |
| **Sentry** | Errors, traces, operational failures | Observability |
| **PostHog** | Product analytics, feature flags, user behavior | Observability |
| **LangSmith** | LLM prompt lineage, traces, eval records | Observability |

### One-line architectural interpretation

| Component | Answers |
|---|---|
| Postgres | What is the permanent state of the system? |
| Redis | What is happening right now? |
| Dexter | What does this company's data mean? (Deep Dive) |
| OpenBB | What are the broad market and macro facts? (Market Pulse) |
| news-ingest | What are people saying? (Market Pulse) |
| Artifact Store | Where do finished outputs live? |
| Sentry | What broke? |
| PostHog | What do users do? |
| LangSmith | What did the model do, and why? |

---

## 5. Ownership Matrix

### What each component owns

| Component | Must Own | Must Not Own |
|---|---|---|
| **Postgres** | Users, jobs, reports metadata, watchlists, audit events, ticker registry | Queue state, hot cache, temporary locks |
| **Redis** | Queue, retries, locks, ephemeral cache, rate limits | Durable truth, final reports, user records |
| **Dexter** | Deep Dive research, analysis, scoring, synthesis, evidence assembly, section generation | Auth, direct mobile access, Market Pulse data assembly |
| **OpenBB** | Market and macro data retrieval for Market Pulse, provider abstraction, normalization, key management | Company-level Deep Dive analysis, narrative writing, report rendering |
| **news-ingest** | Approved-source article extraction, feed intake, deduplication, normalization for Market Pulse | Importance ranking, final conclusions, display logic |
| **Artifact Store** | Serialized report blobs, evidence bundles, file attachments | Structured queries, metadata indexing (that belongs in Postgres) |
| **Sentry** | Errors, traces, operational failures, API exceptions | Product funnels, prompt lineage, A/B experiments |
| **PostHog** | Product analytics, feature flags, funnel behavior | Backend error source of truth, LLM tracing |
| **LangSmith** | Prompt versions, LLM traces, eval records, model lineage | Product analytics, infrastructure error tracking |

### Forbidden Overlaps (Hard Rules)

1. **Deep Dive is Dexter-led.** Dexter is the primary research engine for Company Deep Dive and manages its own data retrieval for that surface.
2. **Market Pulse is Data-Plane-led.** OpenBB + news-ingest are the primary data sources for Market Pulse. Dexter does not own or execute the Market Pulse pipeline.
3. **The mobile app must never call OpenBB, news-ingest, or Dexter directly.** All traffic routes through Product API.
4. **PostHog is not the system of record for backend failures.** Sentry is.
5. **Redis must never become the accidental database.** If a value needs to survive a Redis flush, it belongs in Postgres.
6. **news-ingest must not decide what matters.** It ingests and normalizes. Interpretation belongs to the consuming surface.
7. **Artifact Store is write-once per report.** Reports are never mutated after storage; a new version creates a new artifact.
8. **No observability tool overlap without declaring the primary system of record** for that class of event.

---

## 6. Dexter Architecture

Dexter is an **upstream open-source financial research agent** integrated as the primary engine for Company Deep Dive. It is not a single LLM call — it is a **planner-executor pipeline** with discrete, observable stages and native data retrieval capabilities.

### 6.1 Structure

```
AnalysisRequest
      │
      ▼
  [ Planner ]          Decides which sections to generate and in what order.
      │                Emits a SectionPlan.
      ▼
  [ Data Retrieval ]   Uses Dexter's native tools to fetch company-specific data.
      │                Validates completeness. Flags missing data explicitly.
      ▼
  [ Section Executors ]  One executor per report section, run in parallel where safe.
      │                  Each executor receives only the slice of context it needs.
      ▼
  [ Scorer ]           Computes research signal score from section outputs.
      │                Requires minimum evidence threshold to produce a score.
      ▼
  [ Synthesizer ]      Assembles executive summary and final report.
      │
      ▼
  AnalysisReport (schema-validated before emit)
```

### 6.2 Model Strategy

| Decision | Choice | Rationale |
|---|---|---|
| Primary model | claude-sonnet (latest stable) | Reasoning quality + cost balance |
| Fallback model | claude-haiku | Latency-sensitive sections only |
| Provider | Anthropic API | Single provider in v1; multi-provider is an ADR-gated decision |
| Prompt versioning | LangSmith | Every prompt has a named version; no inline prompt strings in production code |

### 6.3 Failure and Degradation Rules

| Failure | Dexter Behavior |
|---|---|---|
| Data source returns partial data | Flag affected sections as `data_incomplete`; continue with available data |
| Data source returns no data | Halt that section; surface explicit `data_unavailable` in report |
| LLM call fails (timeout / error) | Retry once with exponential backoff; on second failure, mark section `failed` |
| Score cannot meet minimum evidence threshold | Emit report without score; surface `signal_insufficient_data` flag |
| Entire pipeline fails | Mark job `failed` in Postgres; emit error to Sentry; do not surface partial report |

### 6.4 What Dexter is Not Allowed to Do

- Write to Postgres directly (results are returned to Product API for persistence)
- Invent data when a source is missing (degrade and flag; never fabricate)
- Execute any code against a live environment
- Serve as the primary data source for Market Pulse (that belongs to OpenBB + news-ingest)

---

## 7. Data Model

These are the core Postgres entities. Field lists are canonical; additional columns require an ADR or migration note.

### Core Entities

```
users
  id              UUID PK
  email           TEXT UNIQUE NOT NULL
  created_at      TIMESTAMPTZ
  plan            ENUM(free, pro)
  device_token    TEXT                  -- push notification handle

tickers
  id              UUID PK
  symbol          TEXT UNIQUE NOT NULL  -- e.g. AAPL
  exchange        TEXT
  company_name    TEXT
  listing_status  TEXT                  -- active, delisted, suspended
  source_feed     TEXT                  -- nasdaqlisted, otherlisted, daily_delta
  source_updated_at TIMESTAMPTZ
  last_synced_at  TIMESTAMPTZ

watchlists
  id              UUID PK
  user_id         UUID FK → users
  ticker_id       UUID FK → tickers
  added_at        TIMESTAMPTZ

jobs
  id              UUID PK
  type            ENUM(deep_dive, market_pulse)
  status          ENUM(queued, running, complete, failed)
  user_id         UUID FK → users (nullable for scheduled pulse)
  ticker_id       UUID FK → tickers (nullable for pulse)
  created_at      TIMESTAMPTZ
  started_at      TIMESTAMPTZ
  completed_at    TIMESTAMPTZ
  error_message   TEXT

reports
  id              UUID PK
  job_id          UUID FK → jobs
  type            ENUM(deep_dive, market_pulse)
  ticker_id       UUID FK → tickers (nullable for pulse)
  schema_version  TEXT NOT NULL         -- e.g. "v1.2"
  artifact_key    TEXT                  -- pointer to Artifact Store
  created_at      TIMESTAMPTZ
  is_current      BOOLEAN DEFAULT true  -- soft versioning

audit_events
  id              UUID PK
  user_id         UUID FK → users
  event_type      TEXT NOT NULL
  payload         JSONB
  created_at      TIMESTAMPTZ
```

### Design Principles

- All primary keys are UUIDs (no sequential integer IDs exposed externally).
- `reports` stores metadata only. The actual report content lives in the Artifact Store.
- `jobs` is the source of truth for async operation state. Redis queue entries point to job IDs.
- `audit_events` is append-only. No deletes, no updates.

---

## 8. Auth Strategy

### Scheme

**JWT-based authentication** with short-lived access tokens and long-lived refresh tokens.

| Token | TTL | Storage (client) |
|---|---|---|
| Access token | 15 minutes | In-memory only (never persisted to disk) |
| Refresh token | 30 days | Android Keystore (encrypted storage) |

### Flow

```
1. User authenticates (email + password, or Google Sign-In)
2. Product API issues: access_token (15m) + refresh_token (30d)
3. Mobile stores refresh_token in Android Keystore
4. Every API call sends access_token in Authorization: Bearer header
5. On 401 → mobile silently refreshes using refresh_token
6. On refresh failure → user is logged out; re-authentication required
```

### Rules

- Product API is the sole token issuer. No other service issues tokens.
- Dexter, OpenBB, and all internal services communicate over internal network with service-level auth (API key or mTLS — decided per environment).
- All tokens are invalidated on logout. Refresh tokens are stored server-side (Redis) for revocation support.
- No auth logic lives in the mobile app beyond token storage and refresh flow.

---

## 9. Contract Schemas

No service is allowed to invent JSON structure in production. All inter-service data must conform to a versioned schema in `packages/contracts`.

### 9.1 Core Contracts

#### `AnalysisRequest`
```typescript
{
  request_id: string          // UUID
  type: "deep_dive" | "market_pulse"
  ticker?: string             // required for deep_dive
  user_id?: string            // nullable for scheduled pulse
  job_id: string
  requested_at: string        // ISO 8601
  options?: {
    sections?: string[]       // override default section list
  }
}
```

#### `AnalysisReport`
```typescript
{
  report_id: string
  job_id: string
  schema_version: string      // "v1"
  type: "deep_dive" | "market_pulse"
  ticker?: string
  generated_at: string
  confidence: {
    score: number             // 0.0–1.0
    label: "high" | "medium" | "low" | "insufficient_data"
    limiting_factors: string[]
  }
  signal?: {
    value: "positive" | "neutral" | "negative" | "no_signal"
    reasons: string[]
    evidence: EvidenceItem[]
  }
  sections: ReportSection[]
  flags: string[]             // e.g. ["data_incomplete:revenue", "signal_insufficient_data"]
  data_sources: string[]
}
```

#### `ReportSection`
```typescript
{
  section_id: string
  title: string
  body: string
  status: "complete" | "data_incomplete" | "data_unavailable" | "failed"
  evidence: EvidenceItem[]
}
```

#### `EvidenceItem`
```typescript
{
  evidence_id: string
  source_type: "filing" | "article" | "financial_data" | "macro_data"
  source_name: string         // e.g. "SEC 10-Q 2024-Q3", "Reuters"
  excerpt: string
  retrieved_at: string
  url?: string
}
```

#### `CanonicalFinanceData`
```typescript
{
  ticker: string
  period: string              // e.g. "2024-Q3"
  provider: string            // e.g. "fmp", "polygon"
  retrieved_at: string
  data: {
    revenue?: number
    gross_margin?: number
    operating_income?: number
    net_income?: number
    eps?: number
    debt_total?: number
    cash_and_equivalents?: number
    free_cash_flow?: number
    [key: string]: number | undefined
  }
  missing_fields: string[]    // explicitly declared
}
```

#### `CanonicalNewsArticle`
```typescript
{
  article_id: string          // deterministic hash of URL
  source: string
  url: string
  title: string
  published_at: string
  retrieved_at: string
  body_text: string           // best available normalized text; RSS summary/excerpt accepted in v1
  tickers_mentioned: string[]
  is_approved_source: boolean
}
```

#### `CanonicalMacroData`
```typescript
{
  indicator: string           // e.g. "CPI", "NFP"
  value: number
  unit: string                // e.g. "percentage", "absolute"
  period: string              // e.g. "2024-03"
  provider: string
  retrieved_at: string
  missing_fields: string[]
}
```

#### `MarketPulseReport`
```typescript
{
  report_id: string
  schema_version: string
  generated_at: string
  cycle_start: string         // previous pulse timestamp
  cycle_end: string
  sections: {
    market_moves: ReportSection
    macro_releases: ReportSection
    rates_fx_commodities: ReportSection
    news_summary: ReportSection
    uncertainty_flags: ReportSection
    watchlist_overlay?: ReportSection
  }
  flags: string[]
  confidence: ConfidenceBlock
}
```

### 9.2 Contract Principles

- Every contract is versioned. Breaking changes increment the major version.
- All contracts live in `packages/contracts` as TypeScript types + JSON Schema.
- Validation happens at the boundary of every service (on ingress and egress).
- `body_text` in `CanonicalNewsArticle` must always be a string (no nulls); parser or source failures are handled at the service response level.
- Prompts must never define production structure. Dexter is told to emit JSON; the schema is enforced by the contract layer, not the prompt.
- `missing_fields` and `flags` arrays are mandatory, not optional. Explicit degradation is required.

---

## 10. Product Surfaces

### A. Company Deep Dive

User requests analysis of one ticker and receives a structured `AnalysisReport`.

**Expected sections:**
- Executive Summary
- Quarter-over-Quarter and Year-over-Year Changes
- Revenue and Margin Analysis
- Debt and Liquidity
- Acquisitions and Major Events
- Management Commentary and Risk Factors
- Research Signal (with reasons and evidence)
- Confidence Score and Limiting Factors
- Evidence References

**SLA target (v1):** Report available within 90 seconds of request submission.  
**Failure UX:** Job status polling shows `failed` with a user-facing message. Never a blank screen.

### B. Market Pulse

A scheduled daily briefing, generated at a fixed time (e.g., 06:30 EST), answering:
- What moved materially since the last cycle
- What likely drove those moves
- What macro data was released
- What is uncertain or contradictory
- What to watch today

**Inputs:**
- Market and index moves (via OpenBB)
- Macro releases (CPI, NFP, FOMC, etc.)
- Rates, FX, commodities
- Approved-source news articles (via news-ingest)
- Optional: watchlist ticker overlays

**Delivery:** Push notification to device → opens pre-rendered report. Report is stored and accessible historically.

---

## 11. Service Catalog

| Service | Purpose | Exposure | Owns |
|---|---|---|---|
| `mobile-app` | Android user interface | Public client | UI state, local cache |
| `product-api` | Auth, jobs, history, report retrieval, push, ticker-registry sync | Public (HTTPS) | Auth tokens, job orchestration, ticker registry |
| `dexter-worker` | Company Deep Dive reasoning pipeline | Private (internal) | Reasoning pipeline |
| `data-openbb` | Normalized finance and macro access | Private (internal) | Provider abstraction |
| `news-ingest` | Crawl, normalize, deduplicate approved-source news | Private (internal) | Article normalization |
| `scheduler` | Timed runs and automation (Market Pulse) | Private (internal) | Cron logic, pulse job emission |
| `postgres` | Durable state | Private | System of record |
| `redis` | Queue, cache, locks, rate limits | Private | Ephemeral state |
| `artifact-store` | Report blobs and evidence bundles (S3-compatible) | Private | Binary/large object storage |

### 11.1 Internal Service API Surface (M2)

Data plane services expose internal REST endpoints, primarily serving the **Market Pulse** pipeline. All success responses follow a `{"data": ...}` envelope.

| Endpoint | Method | Params | Success Envelope | Error Envelope | Primary Consumer |
|---|---|---|---|---|---|
| `/v1/finance/company` | `GET` | `ticker` | `{"data": CanonicalFinanceData}` | `{"data": null, "error": string}` | Market Pulse |
| `/v1/finance/macro` | `GET` | `scope` | `{"data": CanonicalMacroData}` | `{"data": null, "error": string}` | Market Pulse |
| `/v1/news` | `GET` | `date` | `{"data": CanonicalNewsArticle[]}` | `{"data": [], "error": true}` | Market Pulse |

---

## 12. Source-of-Truth Hierarchy

When there is ambiguity about what is true, the system must prefer these orders, depending on the surface:

**Company Deep Dive (Dexter-led):**
```
1. Primary data retrieved by Dexter (financial statements, filings, company data)
2. Primary text evidence from filings and articles
3. Dexter synthesis over those inputs
4. User-facing summary text
```

**Market Pulse (Data-Plane-led):**
```
1. Structured market/macro data from the governed OpenBB path
2. Approved-source news articles from news-ingest
3. Synthesis over those inputs
4. User-facing summary text
```

**Why this matters:** These orders prevent the product from surfacing unsupported claims. Synthesis is downstream of data — it cannot override it. User-facing text is downstream of synthesis — it cannot add claims not present in the synthesis.

---

## 13. Dependency Risk Register

### OpenBB Provider Risk (Market Pulse path)

OpenBB is an open-source aggregation library used in the **Market Pulse** pipeline. It wraps third-party data providers (FMP, Polygon, Alpha Vantage, etc.). This means the Market Pulse path inherits their rate limits, outages, key management complexity, and pricing changes.

| Risk | Mitigation |
|---|---|
| Provider outage | `data-openbb` returns `data_unavailable`; Market Pulse degrades affected sections; no fabricated data |
| Rate limit breach | Redis rate limiter on `data-openbb` egress; per-provider limit configuration |
| Provider key rotation | Keys stored in environment secrets (not in code); rotation procedure documented in runbooks |
| Provider drops a field | `missing_fields` array surfaces this explicitly; smoke tests catch schema drift |
| OpenBB API breaking change | Pin OpenBB version; upgrade only with a dedicated test run against golden fixtures |
| **Pending Keys** | **Provider key provisioning is incomplete. Blocks final live Market Pulse smoke validation, but implementation proceeds with fixtures/mocks.** |

### news-ingest Risk

`news-please` is a Python scraping library. At production scale it will encounter anti-scraping defenses, legal gray areas with financial publishers, and HTML parser brittleness.

| Risk | Mitigation |
|---|---|
| Anti-scraping blocks | Approved-source list is small and curated; consider RSS-first ingestion over HTML scraping |
| Legal / ToS issues | Only approved sources in the whitelist; legal review before adding any source |
| Parser failures | Failures return `null` body with error flag; Dexter treats as `data_unavailable` for that article |
| Upgrade path | If `news-please` proves unreliable at scale, migrate to NewsAPI or direct RSS feeds; this is an ADR-gated decision |

### LLM Provider Risk

| Risk | Mitigation |
|---|---|
| Anthropic API outage | Circuit breaker in Dexter; jobs queued during outage, not dropped |
| Model deprecation | Prompt versions pinned in LangSmith; model version explicit in every API call |
| Unexpected output format | Schema validation layer rejects malformed output; job marked `failed` and retried |
| Cost overrun | Per-job token budgets enforced in Dexter config; LangSmith tracks spend by job type |

---

## 14. Scale Assumptions

These are the v1 load assumptions. Architecture decisions must be validated against them. If assumptions change, a re-validation is required.

| Metric | v1 Assumption |
|---|---|
| Registered users | < 10,000 |
| Daily active users | < 1,000 |
| Concurrent Deep Dive requests | < 20 |
| Market Pulse jobs | 1 scheduled run/day (expandable to per-timezone) |
| Deep Dive SLA | < 90 seconds end-to-end |
| Report storage growth | ~500 reports/day × average 50KB = ~25MB/day |
| Postgres size at 12 months | < 50GB |

### Implications

- Redis + BullMQ (or equivalent) is sufficient for the job queue at this scale.
- A single Postgres instance with read replica is adequate.
- `data-openbb` can run as a single-instance service with Redis-backed rate limiting.
- Dexter can be horizontally scaled by adding worker instances behind the queue.
- No Kafka, no distributed tracing infrastructure beyond Sentry + LangSmith — this scale does not justify it.

---

## 15. Folder Hierarchy

```
finance-intelligence-platform/
├── BLUEBOOK cld.md                   ← this document
├── README.md
├── ROADMAP.md
├── DECISIONS/                    ← Architecture Decision Records (ADRs)
│   └── ADR-001-openbb-provider-strategy.md
├── docs/
│   ├── architecture/
│   ├── contracts/
│   ├── runbooks/
│   └── testing-doctrine.md
├── apps/
│   ├── mobile/                   ← Android app (Kotlin)
│   ├── product-api/              ← Public API (auth, jobs, reports)
│   ├── dexter-worker/            ← Reasoning pipeline
│   ├── data-openbb/              ← Finance/macro data service
│   ├── news-ingest/              ← News crawl and normalization
│   └── scheduler/                ← Market Pulse automation
├── packages/
│   ├── contracts/                ← Canonical TypeScript types + JSON Schema
│   ├── shared-types/             ← Common enums and utility types
│   ├── scoring-engine/           ← Signal scoring logic (tested independently)
│   ├── ui-schema/                ← Mobile rendering schemas
│   └── observability/            ← Shared Sentry/PostHog/LangSmith init
├── infra/
│   ├── docker-compose.yml        ← Local development environment
│   ├── terraform/                ← Cloud infrastructure
│   └── envs/                     ← Environment configs (no secrets)
├── data/
│   ├── golden/                   ← Golden response fixtures for smoke tests
│   └── seeds/                    ← Dev database seeds
├── tests/
│   ├── integration/
│   ├── smoke/
│   ├── e2e/
│   └── load/
└── .github/
    └── workflows/
```

### Structure Principles

- `apps/` contains independently deployable services and products.
- `packages/` contains only true shared modules. A package must be used by ≥2 apps to justify existence here.
- `infra/` contains deployment and environment logic. No business logic.
- `data/` contains golden datasets and seeds. Never real user data.
- `tests/` contains cross-service tests. Unit tests live inside each app.

---

## 16. Delivery Doctrine

A feature is not complete when it demos well.

A feature is complete only when it has:

| Requirement | Description |
|---|---|
| **Schema** | Input and output conform to a versioned contract |
| **Smoke test** | Automated test that validates the happy path end-to-end |
| **Owner** | A named service owns the behavior |
| **Observable** | Runtime behavior appears in Sentry, PostHog, or LangSmith as appropriate |
| **Rollback path** | Deployment can be reverted without data loss |
| **Defined failure mode** | What happens when this breaks is documented and tested |

### Definition of Done

Every milestone must produce a **deployable, testable increment**. A milestone that only passes unit tests is not done. A milestone that demos but has no smoke test is not done.

---

## 17. Smoke Test Doctrine

### Deep Dive Path

```
□ User can search for a ticker
□ Request is accepted by Product API and job is created in Postgres
□ Job enters Redis queue
□ Dexter picks up job and begins execution
□ Dexter performs native company-specific data retrieval and evidence collection
□ All active sections execute (or degrade with explicit status)
□ Each section returns one of: complete / data_incomplete / data_unavailable / failed
□ Scoring only proceeds when the minimum evidence threshold is met; otherwise signal = no_signal with reason
□ AnalysisReport validates against contracts/AnalysisReport schema
□ Evidence references exist for every scored claim
□ Report artifact is written to Artifact Store
□ Report metadata is written to Postgres
□ Mobile app receives job completion notification
□ Mobile app renders the returned report state without errors
```

### Market Pulse Path

```
□ Scheduler fires at configured time
□ Pulse job is created and enters queue
□ data-openbb returns market move data
□ news-ingest returns normalized articles within the cycle window
□ Market Pulse briefing is assembled from `data-openbb` + `news-ingest` inputs
□ MarketPulseReport validates against schema
□ Report is stored and retrievable by the mobile app
□ Mobile home screen renders the morning briefing
□ Push notification is delivered to registered devices
```

### Visibility Path

```
□ A deliberate API exception appears in Sentry with correct context
□ A user action (Deep Dive request) appears in PostHog with correct properties
□ A Dexter run appears in LangSmith with prompt version, model, token count, and job ID
□ A failed job appears in Sentry and Postgres with error message
□ Feature flag via PostHog correctly gates a feature in the mobile app
```

---

## 18. Milestones

| Milestone | Outcome | Acceptance Criteria |
|---|---|---|
| **M1 — Baseline** | Monorepo, folder structure, contracts, CI, local docker-compose runs | `docker-compose up` brings all services to healthy; contracts package compiles; CI passes |
| **M2 — Data Plane** | `data-openbb` and `news-ingest` operational with golden fixture tests | OpenBB returns validated `CanonicalFinanceData` for 3 test tickers; news-ingest returns validated `CanonicalNewsArticle` list; missing-data degradation is tested |
| **M3 — Dexter Foundation** | Dexter upstream integrated as the Deep Dive research engine | Dexter accepts `AnalysisRequest`, runs its research pipeline, produces schema-valid `AnalysisReport`; LangSmith traces visible |
| **M4 — Product API + Job System** | Auth, job queue, and report retrieval around Dexter-led Deep Dive | JWT auth flow works end-to-end; job created → queued → Dexter picks up → result stored; report retrievable via API |
| **M5 — Deep Dive v1** | Dexter-powered Deep Dive path live | All smoke tests for Deep Dive path pass; Dexter produces evidence-backed reports; < 90s SLA validated |
| **M6 — Market Pulse** | OpenBB + news-ingest-powered pulse pipeline live | Scheduler fires; OpenBB + news-ingest provide data; briefing generated, stored, and delivered; push notification sent |
| **M7 — Android MVP** | Mobile app delivers both surfaces | Deep Dive and Market Pulse render correctly on device; auth flow works; PostHog events firing |
| **M8 — Production Hardening** | System is observable, resilient, and deployable | All visibility smoke tests pass; failure modes are tested (provider down, LLM timeout); load test at 2× expected peak passes; runbooks written |

### Milestone Rule

No milestone is closed without:
1. All defined smoke tests passing in a staging environment
2. Defined acceptance criteria checked off by the owner
3. Rollback procedure confirmed executable

---

## 19. Anti-Frankenstack Rules

1. **No new tool** unless it fills a clearly documented ownership gap and is approved in an ADR.
2. **No direct provider calls from the mobile app.** All traffic routes through Product API.
3. **No production JSON invented inside prompt text.** Contracts define structure; prompts do not.
4. **No score without reasons and evidence.** A signal value without traceable evidence is not allowed.
5. **No temporary cron scripts** outside the scheduler service.
6. **No observability overlap** without declaring the primary system of record for that event class.
7. **No Market Pulse data retrieval** that bypasses `data-openbb` and `news-ingest`.
8. **No new package** in `packages/` used by only one app. Move it into that app.
9. **No secrets in code or in `infra/envs/`.** All secrets in environment secret management.
10. **No migration without a rollback script.**

---

## 20. Architecture Decision Records

ADRs live in `/DECISIONS/` and follow this template:

```markdown
# ADR-XXX: [Title]

**Date:** YYYY-MM
**Status:** Proposed | Accepted | Deprecated
**Deciders:** [names]

## Context
What is the situation that requires a decision?

## Decision
What was decided?

## Rationale
Why this option over the alternatives?

## Consequences
What becomes easier? What becomes harder?

## Revisit Condition
Under what circumstances should this decision be reconsidered?
```

### Decisions Required Before M3

| ADR | Decision Needed |
|---|---|
| ADR-001 | OpenBB provider prioritization and fallback order |
| ADR-002 | news-ingest approved source list and ingestion method (scrape vs RSS vs API) |
| ADR-003 | Mobile stack (Kotlin Native vs React Native vs Flutter) |
| ADR-004 | Cloud provider and deployment target |
| ADR-005 | Artifact Store implementation (S3, GCS, or self-hosted) |

---

## 21. Final Standard

The final result of this project is not just a working app.

The final result is a system with:

- A stable, written mission that survives personnel change
- Defined service boundaries that prevent ownership confusion
- Contract-driven development where schemas outlast any individual prompt or implementation
- Deployable products in independent, self-contained folder hierarchies
- Observable runtime behavior across all three observability planes (errors, product, model)
- Repeatable smoke tests that define what "working" means, not just what "passing" means
- Controlled failure modes where degradation is explicit and users never see fabricated data
- A roadmap and milestone structure that can be handed to a team without ambiguity
- An ADR history that explains *why*, not just *what*

That is the real end-state.

---

*This document is the source of truth for platform architecture. Changes to ownership, contracts, or service responsibilities require an update here before implementation.*
