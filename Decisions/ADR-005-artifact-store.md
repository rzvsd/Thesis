# ADR-005: Artifact Store Implementation

**Date:** 2026-03  
**Status:** Accepted  
**Needed before:** M4  
**Deciders:** Engineering Lead

---

## Context

Completed reports and evidence bundles need durable, retrievable object storage. This is the Artifact Store. Three options were evaluated:

| Option | Pros | Cons |
|---|---|---|
| **AWS S3** | Most mature, cheapest at scale, universally supported | Requires AWS account |
| **GCS** | Clean API, good tooling | Adds GCP dependency for one service |
| **Self-hosted (MinIO)** | No cloud cost, full control | Ops burden, reliability risk |

## Decision

**AWS S3.**

This was decided alongside ADR-004. Fly.io handles compute; S3 handles object storage. One AWS account is provisioned for S3 only.

## Implementation Rules

- One S3 bucket per environment (dev, staging, production)
- Reports are **write-once** — no mutations after storage
- Object key format: `reports/{report_id}/{version}.json`
- Evidence bundles: `evidence/{report_id}/{evidence_id}.json`
- Postgres stores the S3 key as `artifact_key` — not the full URL
- Bucket is **private** — all access via signed URLs issued by Product API
- Lifecycle policy: archive reports older than 12 months to S3 Glacier

## Consequences

- `apps/product-api/` handles all S3 read/write — no other service touches S3 directly
- Signed URL TTL: 1 hour (sufficient for report viewing session)
- Reports are never deleted by users — only archived
- AWS credentials stored in environment secrets — never in code

## Revisit When

- Storage costs exceed budget at scale
- A Fly.io-native object storage offering matures sufficiently
