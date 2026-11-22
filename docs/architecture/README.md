# Architecture (current state)

Short description of what runs today. Decisions live in `Decisions/`. Operations live in `docs/runbooks/`.

## Services

All services run as containers from the root `docker-compose.yml`.

| Service | Port | Language | Role |
|---|---|---|---|
| `product-api` | 3001 | TypeScript (Node) | Public API for the app: auth, Deep Dive jobs, reports, Pulse, watchlist, alerts, push, subscriptions (RevenueCat webhook). Runs the Pulse job itself. Applies DB migrations on start (`AUTO_MIGRATE`) |
| `dexter-worker` | 3002 | TypeScript (Node) | Research engine. Takes Deep Dive jobs from the Redis queue, writes the report with the LLM provider, and posts it back to Product API. Also writes the Pulse brief |
| `data-openbb` | 3003 | Python | Market, company, macro and official-source (SEC) data, through OpenBB and provider keys |
| `news-ingest` | 3004 | Python | News and first-party context from RSS and HTML sources |
| `scheduler` | 3005 | TypeScript (Node) | Timed triggers (Pulse at 06:30 ET, macro stress, historical sync, notifications). Calls internal routes of Product API and data-openbb |
| `mobile` | 3006 | TypeScript (Node) | Health-only placeholder container. The real client is the Android app in `apps/mobile/android` (Kotlin, Compose) |
| `postgres` | 5432, host-local | Postgres 16 | Users, jobs, report index, subscriptions, devices, alerts, audit events. Migrations in `infra/migrations/` |
| `redis` | 6379, host-local | Redis 7 | Deep Dive job queue, rate limits |

Shared code is in `packages/` (contracts, scoring engine, shared types, Redis client, observability).

## Data flow

```
Android app --HTTPS--> product-api --queue--> redis --> dexter-worker --> LLM provider
                         |   ^                              |
                         |   +---- report, internal data ---+
                         +--> data-openbb   (market, macro, SEC)
                         +--> news-ingest   (news)
                         +--> postgres, report files (host disk; S3 optional)
scheduler --x-internal-token--> product-api, data-openbb
RevenueCat --webhook--> product-api          product-api --FCM--> Android app
```

- **Deep Dive:** the app calls `POST /jobs`. Product API queues the job in Redis. Dexter takes it, reads context from Product API internal routes, writes the report with the LLM, and posts it back. Product API stores it. The app polls `GET /jobs/:id` and reads `GET /reports/:id`.
- **Pulse:** the scheduler (or `POST /internal/pulse/dispatch`) starts a Pulse job in Product API. Product API pulls data from data-openbb and news-ingest, asks Dexter for the brief, stores the issue, and sends a `market_pulse_ready` push through FCM.
- **Subscriptions:** the app buys through Google Play with the RevenueCat SDK. RevenueCat calls `POST /v1/webhooks/revenuecat`. Product API stores the tier in Postgres.
- Internal routes (`/internal/*`) require the `x-internal-token` header.

## Live and fixture mode

`dexter-worker`, `data-openbb` and `news-ingest` have a fixture mode (`*_FIXTURE_MODE`, default `true` for local work) that serves canned data. The scheduler has a test mode. Product API uses stub providers for push and email unless configured. With `NODE_ENV=production` and `THESIS_ALLOW_PRODUCTION_FIXTURES=false`, each service refuses to start in fixture mode. Each `/health` response reports its mode, and `scripts/deploy/launch-proof-health.mjs` reads them.

## Deploy

One Linux host runs Docker Compose. The manual GitHub workflow `deploy-production` connects over SSH, checks out a ref, runs `docker compose up -d --build`, then runs health checks and `scripts/deploy/post-deploy-smoke.sh`. Runtime config is a `.env` file on the host. TLS for the public API is outside this repository. See `Decisions/ph1/ADR-009-hosting-as-built.md` (the Fly.io plan in ADR-004 was not built) and `docs/runbooks/launch-proof.md`.

`infra/docker-compose.yml` is an older copy that differs from the root file. The deploy uses the root file.

## CI

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`. Nothing in the repository records whether production is up. The launch-proof runbook records that by hand.
