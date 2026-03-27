# Runbook: Visibility / Observability Smoke

## Go/No-Go

### Prechecks
- `docker compose ps` shows `product-api`, `dexter-worker`, `redis`, and `postgres` as running/healthy.
- Sentry DSN is configured for `product-api`.
- PostHog key is configured for mobile and/or product-api event pipeline.
- LangSmith tracing env is configured where Deep Dive tracing is expected.

### Success signal
- Deliberate failure event appears in Sentry with service and stack context.
- A user action appears in PostHog with expected event properties.
- A Deep Dive trace appears in LangSmith with job metadata.

### Abort signal
- `product-api` health endpoint fails.
- Any observability vendor endpoint is unreachable from the test environment.
- Auth/login path fails before event generation.

## Procedure

1. Confirm API health:
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3001/health"
```

2. Trigger deterministic failure in product-api (Sentry proof):
```powershell
$internal = @{ "x-internal-token" = "dev-internal-worker-token" }
$payload = @{ cycle_start="2026-03-31T00:00:00.000Z"; cycle_end="2026-03-31T23:59:00.000Z"; force_fail=$true } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/internal/pulse/dispatch" -Headers $internal -ContentType "application/json" -Body $payload
```

3. Submit a normal user action (Deep Dive request) for PostHog and LangSmith visibility, then confirm in dashboards.

## Evidence to save

- Sentry event ID and timestamp.
- PostHog event screenshot/export (`deep_dive_requested`).
- LangSmith trace link containing job ID.

## Rollback command

```powershell
docker compose restart product-api
```
