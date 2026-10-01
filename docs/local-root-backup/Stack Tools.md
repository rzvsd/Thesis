# Stack Tools Reference — up to M4

This file is a plain-language reference for the main tools, services, and infrastructure used in the project up to **M4**.

It is meant to sit next to the folder-structure / architecture docs and answer one simple question:

**What is this thing, why do we have it, and what does it need?**

---

## Status legend

- **Implemented** = already wired and used in the current project flow
- **Used indirectly** = present behind another service / wrapper
- **Planned later** = not part of the active M1–M4 closeout path yet
- **Future option** = discussed, but not the current accepted target

---

## 1) `product-api`

- **Type:** Internal app / backend service
- **Status:** Implemented (M4)
- **What it is:** The main backend entrypoint for clients
- **Used for:** Auth, job creation, job status, report retrieval, report history
- **Important note:** This is the public-facing API layer. Clients should talk to this service, not directly to internal workers or data services.

---

## 2) `dexter-worker`

- **Type:** Internal app / reasoning worker
- **Status:** Implemented (M3)
- **What it is:** The Deep Dive research engine worker
- **Used for:** Running the Company Deep Dive pipeline — planning, research, section generation, scoring, synthesis
- **Important note:** Dexter is the primary engine for Deep Dive. It is not the auth layer and not the mobile-facing API.

---

## 3) `data-openbb`

- **Type:** Internal app / data service
- **Status:** Implemented (Phase 1, M2). Expanding in Phase 2
- **What it is:** A finance / macro data service that wraps OpenBB and normalizes outbound provider data
- **Used for:** Market/macro data retrieval, provider abstraction, normalized finance responses. Expanding to support S&P 500 historical data backfills via FMP in Phase 2.
- **Important note:** It is mostly for the Market Pulse side, not the main Deep Dive reasoning path.

---

## 4) `news-ingest`

- **Type:** Internal app / ingestion service
- **Status:** Implemented (Phase 1, M2). Expanding in Phase 2
- **What it is:** A service that collects and normalizes approved-source news
- **Used for:** News intake, crawl / RSS / parsing, normalization, deduplication. Expanding to handle weekly digest aggregation.
- **Important note:** It gathers articles, but it does not decide what matters. Interpretation happens later in consuming services.

---

## 5) `scheduler`

- **Type:** Internal app / automation service
- **Status:** Implemented (Phase 1). Expanding in Phase 2
- **What it is:** The timed job runner
- **Used for:** Scheduled / automated runs, especially the Market Pulse pipeline. Expanding in Phase 2 for nightly Fear & Greed calculations, earnings sync, and weekly digest crons.
- **Important note:** Key automation backbone for all new Phase 2 data features.

---

## 6) `mobile`

- **Type:** Client app
- **Status:** Implemented (Phase 1 MVP). Overhaul in Phase 2
- **What it is:** The Android application layer
- **Used for:** User interface, reports, login. Phase 2 introduces a total 3-tab navigation redesign, a Fear & Greed dashboard, and local Room caching for offline support.
- **Important note:** The mobile app should never call Dexter, OpenBB, or news-ingest directly. It goes through `product-api`.

---

## 7) PostgreSQL (`postgres`)

- **Current project note:** This is where permanent truth lives.

---

## 8) Redis (`redis`)

- **Type:** Infrastructure / in-memory data store
- **Status:** Implemented and working
- **What it is:** The fast queue/cache/lock layer
- **Used for:** Queue, retries, locks, ephemeral cache, rate limiting
- **API needed?** No public API subscription is needed
- **Credentials needed?** Usually a host/port and optionally password or `REDIS_URL`
- **How it is implemented:** App code pushes / reads keys or list entries from a running Redis service
- **What it stores:** Fast operational state — not durable business truth
- **How to query it:** `redis-cli` commands like `PING`, `KEYS`, `LLEN`, `LRANGE`
- **Current project note:** Redis connects the Product API job flow to the worker. It should not become the accidental database.

---

## 9) Artifact Store

- **Type:** Infrastructure / object storage
- **Status:** Implemented in the M4 report lifecycle
- **What it is:** Storage for completed report files / artifacts
- **Used for:** Serialized report blobs and evidence bundles
- **API needed?** Usually yes, but not a typical "developer API product" in the same sense as Claude/FMP. It is object storage access.
- **Credentials needed?** Usually bucket name + access key + secret + region / endpoint
- **How it is implemented:** The app writes the full finished report file to storage, then saves only metadata + `artifact_key` in Postgres
- **Current project note:** Postgres stores metadata; the actual report body lives here.

---

## 10) Sentry

- **Type:** Observability / monitoring
- **Status:** Implemented for M4 error visibility
- **What it is:** Error and failure monitoring
- **Used for:** Capturing failed jobs, backend exceptions, stack traces, operational failures
- **API needed?** Not in the usual sense; what you need is a **DSN**
- **Credentials needed?** `SENTRY_DSN`
- **How it is implemented:** The app initializes the Sentry SDK and sends exceptions/events to the Sentry project
- **Current project note:** This is how you verify that failures are visible, instead of disappearing silently.

---

## 11) LangSmith

- **Type:** Observability / LLM tracing
- **Status:** Implemented for M3 Dexter tracing
- **What it is:** Prompt and reasoning trace visibility for LLM workflows
- **Used for:** Prompt versioning, traces, token usage, timing, execution lineage
- **API needed?** Yes
- **Credentials needed?** LangSmith project setup + API key
- **How it is implemented:** Dexter / reasoning code sends traces and prompt metadata to LangSmith
- **Current project note:** LangSmith is the source of truth for production prompt lineage, not Sentry.

---

## 12) PostHog

- **Type:** Observability / product analytics
- **Status:** Planned later, not active in M4 closeout
- **What it is:** Product analytics and feature-flag tooling
- **Used for:** User behavior, funnels, analytics, feature flags
- **API needed?** Yes
- **Credentials needed?** PostHog project key / config
- **Current project note:** Important in the overall architecture, but not a current M4 blocker.

---

## 13) OpenBB

- **Type:** External library / provider abstraction layer used behind `data-openbb`
- **Status:** Used indirectly
- **What it is:** An open-source financial data framework that can talk to provider backends
- **Used for:** Market/macro data access through the `data-openbb` service
- **API needed?** OpenBB itself is not the paid provider; the underlying provider usually needs keys
- **Current project note:** OpenBB is the wrapper / abstraction, not the final data provider by itself.

---

## 14) FMP (Financial Modeling Prep)

- **Type:** External data provider
- **Status:** Used / discussed as a practical provider path
- **What it is:** A market / company financial data provider
- **Used for:** Finance data behind the OpenBB path and as a cheaper provider option versus more expensive alternatives
- **API needed?** Yes
- **Credentials needed?** FMP API key
- **Current project note:** This is a realistic cost-conscious provider path for finance data.

---

## 15) Financial Datasets API

- **Type:** External data provider
- **Status:** Used in Dexter-native Deep Dive context, but not recommended for future spend right now
- **What it is:** A financial evidence/data provider for Dexter’s native finance path
- **Used for:** Company Deep Dive evidence retrieval in the Dexter-native flow
- **API needed?** Yes
- **Credentials needed?** Financial Datasets API key
- **Current project note:** Discussed as expensive; not recommended for future purchase right now if a cheaper path is available.

---

## 16) Anthropic / Claude

- **Type:** External LLM provider
- **Status:** Used in reasoning path
- **What it is:** The language model provider used to let Dexter think / write / synthesize
- **Used for:** Report writing, synthesis, reasoning, section generation
- **API needed?** Yes
- **Credentials needed?** Anthropic API key
- **Current project note:** This is the LLM brain provider, separate from data providers like FMP or Financial Datasets.

---

## 17) Docker / Docker Compose

- **Type:** Local infrastructure / runtime tooling
- **Status:** Implemented and used actively
- **What it is:** The local containerized environment for running the stack
- **Used for:** Starting services together, local validation, smoke tests, health checks
- **API needed?** No
- **Current project note:** This is how the local multi-service environment is currently brought up and tested.

---

## 18) Fly.io

- **Type:** Cloud hosting / deployment target
- **Status:** Current accepted v1 target
- **What it is:** The accepted deployment target for application services
- **Used for:** Hosting app services, plus managed Postgres and Redis in the accepted v1 architecture
- **API needed?** Operationally yes (deployment / platform credentials), but not a product data API
- **Current project note:** This is the currently accepted architecture target for app services.

---

## 19) AWS S3

- **Type:** Cloud object storage
- **Status:** Current accepted v1 artifact-store target
- **What it is:** The accepted object storage target for report artifacts and evidence bundles
- **Used for:** Artifact Store only — not the full cloud stack
- **API needed?** Yes — object storage credentials/access
- **Current project note:** Current accepted target for artifact storage in v1.

---

## 20) Hetzner VPS

- **Type:** Cloud VPS option
- **Status:** Future option only — not the currently accepted target
- **What it is:** A simpler / cheaper VPS hosting option discussed for later
- **Used for:** Possible future deployment target if the architecture is formally changed
- **API needed?** No data API; it is infrastructure hosting
- **Current project note:** If adopted officially, it should be treated as an ADR + infra rollout decision, not an implicit swap.

---

## 21) Email Provider

- **Type:** External service
- **Status:** Needed for proper non-local verification flow
- **What it is:** The service that sends verification emails
- **Used for:** Auth verification emails during registration
- **API needed?** Yes
- **Credentials needed?** Provider API key / SMTP credentials depending on provider
- **Current project note:** In local testing, verification tokens may be exposed directly. In a safer environment, a real email provider should be used instead.

---

## 22) JWT

- **Type:** Auth mechanism / token format
- **Status:** Implemented in M4 auth flow
- **What it is:** The token format used for access and refresh tokens
- **Used for:** Authenticated API requests and session flow
- **API needed?** No external API
- **Credentials needed?** Strong signing secret(s)
- **Current project note:** Access token is short-lived; refresh token is longer-lived and revocation is server-side.

---

## 23) Sessions

- **Type:** Auth/session persistence concept
- **Status:** Implemented in M4 auth flow
- **What it is:** Server-side session/revocation tracking
- **Used for:** Logout invalidation, refresh control, session management
- **Where it lives:** Backed by persistent storage (`sessions` table in Postgres)
- **Current project note:** This is why logout and refresh behavior can be controlled server-side rather than trusting the client alone.

---

## 24) Verification Tokens

- **Type:** Auth verification mechanism
- **Status:** Implemented in M4 auth flow
- **What it is:** Tokens used to verify new user email registration
- **Used for:** Turning a newly registered account into a verified account
- **Where it lives:** Persisted in the `verification_tokens` table
- **Current project note:** In local testing, the verification token may be exposed directly for convenience. This should be disabled in safer environments.

---

## 25) Internal Worker Token / Internal Secret

- **Type:** Internal service auth / hardening
- **Status:** Important for safer deployment; not a user-facing tool
- **What it is:** Secret(s) used for trusted communication between internal services
- **Used for:** Locking down internal worker or privileged internal routes
- **Current project note:** Strong internal secrets are part of future production hardening.

---

## Short summary by category

### Internal apps
- `product-api` = auth + jobs + report retrieval
- `dexter-worker` = Deep Dive research engine
- `data-openbb` = finance/macro data service
- `news-ingest` = approved-source news service
- `scheduler` = timed automation
- `mobile` = app UI

### Infrastructure
- `postgres` = durable truth
- `redis` = queue / fast state
- `artifact-store` = completed report files
- Docker = local runtime
- Fly.io = accepted app hosting target
- AWS S3 = accepted artifact-store target
- Hetzner VPS = future optional hosting path

### Observability
- Sentry = failures / exceptions
- LangSmith = prompt + LLM trace lineage
- PostHog = analytics / feature flags (later)

### External providers
- Anthropic / Claude = reasoning model
- FMP = finance data provider
- Financial Datasets API = finance evidence provider (currently considered expensive)
- Email provider = verification delivery

---

## Practical mental model

- **Postgres** answers: *What is the permanent state of the system?*
- **Redis** answers: *What is happening right now?*
- **Dexter** answers: *What does this company’s data mean?*
- **data-openbb** answers: *What are the broader market/macro facts?*
- **news-ingest** answers: *What approved-source news came in?*
- **Artifact Store** answers: *Where does the finished report file live?*
- **Sentry** answers: *What broke?*
- **LangSmith** answers: *What did the model do?*

---

## Phase 2 Additions (Planned)

### `packages/fear-greed-engine` (Future)
- **What it is:** A utility package storing the mathematical logic to compute the 0-100 composite sentiment index from 10 inputs.
- **Used by:** `scheduler` nightly job, `product-api` serving endpoints.

### `packages/historical-data` (Future)
- **What it is:** A package to normalize 5-years of EDGAR/FMP data and feed it into Dexter for analytical context.
- **Used by:** `data-openbb` for ingestion, `dexter-worker` for context.
- **Note:** Relies heavily on PostgreSQL persistence to prevent runaway API costs.

### RevenueCat / Stripe (Third-Party)
- **What it is:** Managed subscription infrastructure.
- **Role:** Handles Google Play/Stripe purchasing in the mobile app and syncs `PRO` tier status to `product-api` via webhooks.
