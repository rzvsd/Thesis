# Runbook: Failed Jobs / Timeout Handling

## Go/No-Go

### Prechecks
- `product-api` and `dexter-worker` are healthy.
- Auth and job submission endpoints are reachable.
- Sentry is configured in `product-api`.

### Success signal
- Job transitions to terminal state (`failed` or `complete`) within expected timeout.
- Failure path records `error_message` in job record.
- Sentry event is created for forced or timeout failure.

### Abort signal
- Job remains non-terminal beyond timeout window.
- Job fails without `error_message`.
- `/jobs/<id>` status cannot be queried.

## Forced failure drill (deterministic)

```powershell
$internal = @{ "x-internal-token" = "dev-internal-worker-token" }
$payload = @{ cycle_start="2026-04-02T00:00:00.000Z"; cycle_end="2026-04-02T23:59:00.000Z"; force_fail=$true } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/internal/pulse/dispatch" -Headers $internal -ContentType "application/json" -Body $payload
```

Confirm:
- returned job ID exists
- status resolves to `failed`
- Sentry event exists with same job ID in context

## Deep Dive timeout drill

Run M9 timeout smoke procedure:
- simulate Anthropic timeout
- verify one retry
- verify second failure marks section failed and job terminal

## Evidence to save

- Job IDs, terminal statuses, and `error_message`.
- Sentry event IDs for failed jobs.

## Rollback command

```powershell
docker compose restart dexter-worker product-api
```
