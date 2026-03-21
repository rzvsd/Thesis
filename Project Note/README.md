# Finance Intelligence Platform

Name of the app : "Thesis" 
Marketing for the app : "Every position needs one"

****Thesis — every position needs one****

A research and interpretation system for public markets. Not a trading bot.

---

## What It Does

**Company Deep Dive** — On-demand structured analysis of a public company: financials, filings, debt/liquidity, major events, and an explainable research signal.

**Market Pulse** — A scheduled morning briefing explaining what moved, why, and what to watch — delivered to your Android device before markets open.

---

## Architecture in One Paragraph

The system is split into three planes. The **Reasoning Plane** (`dexter-worker`) is the primary engine for Company Deep Dive — it performs autonomous financial research using Dexter upstream OSS. The **Data Plane** (`data-openbb`, `news-ingest`) provides market, macro, and news data primarily for the Market Pulse morning briefing. The **Product Plane** (`product-api`, `mobile`, `scheduler`) orchestrates jobs and delivers reports to users. The mobile app never touches the data or reasoning planes directly. Nothing in the system fabricates data.

Full architecture: [`BLUEBOOK cld.md`](./BLUEBOOK cld.md)

---

## Monorepo Structure

```
apps/
  mobile/          Android app (Kotlin)
  product-api/     Public API — auth, jobs, report retrieval
  dexter-worker/   Reasoning pipeline
  data-openbb/     Finance and macro data service
  news-ingest/     News crawl and normalization
  scheduler/       Market Pulse automation

packages/
  contracts/       Canonical schemas — source of truth for all inter-service data
  shared-types/    Common enums and utility types
  scoring-engine/  Signal scoring logic
  ui-schema/       Mobile rendering schemas
  observability/   Shared Sentry / PostHog /LangSmith init

infra/             Docker, Terraform, environment configs
data/              Golden fixtures and dev seeds
tests/             Integration, smoke, e2e, load
```

---

## Core Stack

| Component | Role |
|---|---|
| Postgres | System of record |
| Redis | Queue, cache, locks |
| Dexter | Primary Deep Dive research engine (upstream OSS) |
| OpenBB | Market and macro data for Market Pulse |
| news-ingest | Approved-source news for Market Pulse |
| Artifact Store | Report blobs (S3-compatible) |
| Sentry | Errors and operational traces |
| PostHog | Product analytics and feature flags |
|LangSmith | LLM prompt lineage and eval |

---

## Local Development

```bash
# Start all services
docker-compose up

# Run smoke tests
pnpm test:smoke

# Run integration tests
pnpm test:integration
```

Prerequisites: Docker, Node.js 20+, Python 3.11+

Environment variables: copy `.env.example` to `.env` and fill in provider keys. Never commit secrets.

---

## Linear — Ticket Conventions

All work is tracked in Linear. No code is written without a ticket.

**Workspace:** [Linear project URL]

**Each milestone is a Linear Project:**

| Linear Project | Milestone |
|---|---|
| M1 — Baseline | Monorepo, contracts, CI |
| M2 — Data Plane | OpenBB + news ingest |
| M3 — Dexter Foundation | Dexter upstream integrated as Deep Dive engine |
| M4 — Product API + Job System | Auth, jobs, reports around Dexter-led Deep Dive |
| M5 — Company Deep Dive v1 | Dexter-powered Deep Dive path |
| M6 — Market Pulse | OpenBB + news-ingest-powered briefing pipeline |
| M7 — Android MVP | Mobile app |
| M8 — Product Quality / UX Refinement | Daily-loop polish, personalization, premium UX |
| M9 — Production Hardening | Observability, resilience, launch ops |

**Ticket naming:**

```
[M#] Short description of what is being built
[M#][BUG] Short description of what is broken
[M#][SPIKE] Short description of what is being investigated
```

**Every ticket must include:**
- Which service it touches
- Which contract it touches (if any)
- The acceptance criteria line from `MILESTONES.md` it satisfies

**Every bug ticket must include:**
- Steps to reproduce
- Expected vs. actual behavior
- Service that threw the error
- Sentry link if available
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**A ticket is not closed without:**
- A passing test covering the change
- Smoke test step confirmed if it maps to a milestone acceptance item

Full Linear rules: [`AGENTS.md`](./AGENTS.md)

---

## Key Documents

| Document | Purpose |
|---|---|
| [`BLUEBOOK cld.md`](./BLUEBOOK cld.md) | Architecture, ownership, contracts, doctrine |
| [`ROADMAP.md`](./ROADMAP.md) | Milestones and delivery plan |
| [`DECISIONS/`](./DECISIONS/) | Architecture Decision Records |
| [`docs/runbooks/`](./docs/runbooks/) | Operational procedures | * this is not used yet, path will be created as we develop the app
| [`docs/testing-doctrine.md`](./docs/testing-doctrine.md) | Testing standards | * this is not used yet, path will be created as we develop the app

---

## Guiding Principles

- Every output is structured, explainable, and evidence-backed.
- Degrade gracefully when data is missing. Never fabricate.
- Contracts define structure. Prompts do not.
- Observable by default — errors in Sentry, behavior in PostHog, model runs in LangSmith.
- A feature is not done until it has a smoke test, an owner, and a defined failure mode.

---

## Contributing

Before building anything, read the [Bluebook](./BLUEBOOK cld.md). Specifically:
- §5 Ownership Matrix — before touching any service boundary
- §9 Contract Schemas — before adding or changing inter-service data
- §19 Anti-Frankenstack Rules — before adding any new dependency
- §20 ADRs — before making any architectural decision

New architectural decisions require an ADR in `/DECISIONS/` before implementation.
