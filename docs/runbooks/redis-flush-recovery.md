# Runbook: Redis Flush Recovery

## Go/No-Go

### Prechecks
- `redis`, `product-api`, and `dexter-worker` are healthy.
- Recovery scheduler is enabled in product-api config.
- Auth path works and can queue a Deep Dive job.

### Success signal
- After `FLUSHALL`, queued/running job does not stay orphaned.
- Job resolves to `complete` or `failed` with explicit error.
- Product-api logs recovery corrections (`Job recovery pass completed with corrections`).

### Abort signal
- Job remains `queued` for longer than configured stale threshold + recovery window.
- Redis cannot be restarted after flush.

## Procedure

1. Stop worker:
```powershell
docker compose stop dexter-worker
```

2. Queue a Deep Dive job and capture `job_id`.

3. Flush Redis:
```powershell
docker compose exec -T redis redis-cli FLUSHALL
```

4. Restart worker:
```powershell
docker compose up -d dexter-worker
```

5. Poll `/jobs/<id>` until terminal.

## Evidence to save

- Job ID and transition (`queued` -> terminal state).
- Relevant product-api logs showing recovery pass.

## Rollback command

```powershell
docker compose restart redis dexter-worker product-api
```
