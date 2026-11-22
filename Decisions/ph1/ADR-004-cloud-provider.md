# ADR-004: Cloud Provider and Deployment Target

**Date:** 2026-03  
**Status:** Not implemented. Superseded in part by [ADR-009](./ADR-009-hosting-as-built.md): production runs on one Docker Compose host, deployed over SSH. The hosting target is open.  
**Needed before:** M4  
**Deciders:** Engineering Lead, Founder

---

## Context

Before M4 (Product API + Job System), infrastructure must be provisioned. We need a declared cloud provider and deployment model. Three options were evaluated:

| Option | Pros | Cons |
|---|---|---|
| **AWS** | Most mature, widest service selection, S3 native | Most complex, highest ops overhead, cost unpredictable at small scale |
| **GCP** | Strong data tooling, clean Kubernetes | Less familiar to most engineers, fewer community resources |
| **Fly.io** | Extremely simple deployment, low ops overhead, predictable pricing | Smaller ecosystem, fewer managed services |

## Decision

**Fly.io for application services in v1.**  
**AWS S3 for Artifact Store** (object storage only — not full AWS deployment).

## Rationale

- At <10k users, Fly.io's simplicity and predictable pricing outweigh AWS's breadth
- Fly.io handles Postgres, Redis, and containerized services natively — no Kubernetes needed at v1 scale
- AWS S3 is used only for object storage (reports, evidence bundles) — it is the most mature and cost-effective option for this specific use case
- This combination avoids full AWS complexity while retaining the best-in-class storage option

## Consequences

- `infra/` contains Fly.io configuration (`fly.toml` per service)
- Postgres and Redis are managed by Fly.io in v1
- Artifact Store uses AWS S3 — one AWS account required for S3 only
- All services deploy via `flyctl` through CI/CD — no manual SSH
- Scaling beyond v1 may require migration to AWS or GCP — this is an acceptable future cost

## Revisit When

- Monthly infrastructure cost exceeds budget threshold
- A service requires a capability Fly.io cannot provide (e.g. GPU instances for model inference)
- Scale requires managed Kubernetes
