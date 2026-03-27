# Runbook: Deployment Rollback (Current Docker Staging Model)

## Go/No-Go

### Prechecks
- Current release SHA is captured (`git rev-parse HEAD`).
- Known-good SHA is identified and validated.
- `docker compose ps` shows baseline healthy state before rollback drill.

### Success signal
- Selected service(s) are rebuilt from known-good SHA.
- Health checks return healthy after rollback.
- No unexpected schema/version mismatch in runtime logs.

### Abort signal
- Known-good SHA cannot be checked out cleanly.
- Service fails health checks after rollback.
- Database migration state is incompatible with target build.

## Important scope note

This runbook is for the current docker-hosted staging operation model.
CI/CD-only production deployment proof remains a separate M9 gate (AC #13).

## Procedure

1. Capture current SHA:
```powershell
git rev-parse HEAD
```

2. Switch to known-good commit:
```powershell
git checkout <known_good_sha>
```

3. Rebuild and restart impacted service(s):
```powershell
docker compose up -d --build product-api dexter-worker data-openbb news-ingest scheduler mobile
```

4. Validate health:
```powershell
docker compose ps
Invoke-RestMethod -Method Get -Uri "http://localhost:3001/health"
```

## Per-service rollback command matrix

| Service | Rollback command |
|---|---|
| product-api | `docker compose up -d --build product-api` |
| dexter-worker | `docker compose up -d --build dexter-worker` |
| data-openbb | `docker compose up -d --build data-openbb` |
| news-ingest | `docker compose up -d --build news-ingest` |
| scheduler | `docker compose up -d --build scheduler` |
| mobile (shim container) | `docker compose up -d --build mobile` |

## Evidence to save

- Current SHA and rollback target SHA.
- Before/after health outputs.
- Any migration compatibility notes.

## Rollback command

```powershell
git checkout <known_good_sha>
docker compose up -d --build product-api dexter-worker data-openbb news-ingest scheduler mobile
```
