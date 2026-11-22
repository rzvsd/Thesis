# ADR-009: Hosting and Deployment As Built

**Date:** 2026-11
**Status:** Accepted (records current state). Supersedes the implementation part of ADR-004. The long-term hosting target is **Open**.
**Needed before:** Launch proof (audit roadmap item 5)
**Deciders:** Founder (open part)

---

## Context

ADR-004 chose Fly.io for application services, managed Postgres and Redis on Fly.io, and deploys with `flyctl` from CI ("no manual SSH").

None of that was built. The repository contains no `fly.toml`, no `flyctl` step and no Fly.io configuration. A reader of ADR-004 gets a wrong picture of production.

## What is actually used (facts from the repository)

| Area | As built | Source |
|---|---|---|
| Compute | One Linux host that runs Docker Compose | `.github/workflows/deploy-production.yml`, `docker-compose.yml` |
| Deploy | Manual `workflow_dispatch` of `deploy-production`, protected `production` environment. The job connects over SSH (`appleboy/ssh-action`), runs `git checkout <ref>`, then `docker compose up -d --build`, then health checks and `scripts/deploy/post-deploy-smoke.sh` | same workflow |
| Host secrets for CI | `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_PRIVATE_KEY`, `PROD_REPO_DIR`, `PROD_SMOKE_EMAIL`, `PROD_SMOKE_PASSWORD`, `PROD_INTERNAL_WORKER_TOKEN` | same workflow |
| Runtime config | A `.env` file in `PROD_REPO_DIR` on the host, read by Docker Compose. Not in git | `docker-compose.yml` |
| Postgres | `postgres:16-alpine` container, named volume `postgres-data` on the host | `docker-compose.yml` |
| Redis | `redis:7-alpine` container, append-only file, password required when `NODE_ENV=production` | `docker-compose.yml` |
| Artifact store | Host directory `./data/artifacts`. Product API supports S3 (`ARTIFACT_STORE_MODE=s3`). Compose passes the `ARTIFACT_*` variables, but S3 is off unless the host `.env` sets them, so the S3 part of ADR-005 is not active by default | `apps/product-api/src/config.ts`, `docker-compose.yml` |
| TLS / public HTTPS | Not in the repository. Compose publishes plain HTTP ports. The Android release build requires an `https://` API URL with two certificate pins, so a TLS proxy must exist on or in front of the host | `apps/mobile/android/app/build.gradle.kts` |
| Second deploy mode | `mode=proof` builds the stack on the CI runner in fixture mode. It proves the images start. It does not prove production | same workflow |

`infra/docker-compose.yml` is an older copy that differs from the root `docker-compose.yml`. The deploy uses the root file.

## Decision

1. The current production deployment is **one host, Docker Compose, deployed over SSH by the manual `deploy-production` workflow**. Documentation and runbooks describe this setup.
2. The Fly.io deployment in ADR-004 is **not implemented**. ADR-004 stays for history and points here.
3. Whether to stay on a single Compose host or move to Fly.io (or another platform) is **open**. This record does not decide it.

## Open questions for the owner

- Keep the single Compose host for launch, or move to a managed platform?
- Turn on S3 for reports (ADR-005), or accept host-disk artifacts with the existing backup runbook?
- Where TLS terminates and who renews the certificate (the Android pins must match it).

## Consequences

- The launch-proof runbook (`docs/runbooks/launch-proof.md`) and `docs/architecture/README.md` describe the Compose host.
- If the owner later picks a managed platform, a new ADR replaces this one, and the deploy workflow, runbooks and architecture README change with it.

## Revisit When

- The owner decides the hosting target.
- One host is no longer enough for load or availability.
