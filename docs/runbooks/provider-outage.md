# Runbook: Provider Outage (Market Pulse + Deep Dive)

## Go/No-Go

### Prechecks
- `product-api`, `data-openbb`, `news-ingest`, `dexter-worker`, `redis`, `postgres` are healthy.
- Internal worker token is available for `/internal/pulse/dispatch`.
- At least one authenticated test user can query pulse/deep-dive outputs.

### Success signal
- Outage scenario produces degraded output with explicit `data_unavailable` flags.
- No fabricated values appear in degraded sections.
- Sentry captures the degraded/failure path where required.

### Abort signal
- Healthy baseline pulse/deep-dive request fails before outage simulation.
- Service restart fails after outage test.

## Market Pulse outage procedure

1. Stop data-openbb:
```powershell
docker compose stop data-openbb
```

2. Dispatch pulse run:
```powershell
$internal = @{ "x-internal-token" = "dev-internal-worker-token" }
$payload = @{ cycle_start="2026-04-01T00:00:00.000Z"; cycle_end="2026-04-01T23:59:00.000Z" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/internal/pulse/dispatch" -Headers $internal -ContentType "application/json" -Body $payload
```

3. Verify affected sections are `data_unavailable` and report still exists.

4. Restore data-openbb:
```powershell
docker compose start data-openbb
```

## Deep Dive outage procedure

Follow M9 smoke doctrine for blocking Dexter upstream providers and verifying degraded sections with no fabrication.

## Evidence to save

- Pulse report ID + section statuses.
- Sentry event ID(s).
- Confirmation log that service was restored after outage drill.

## Rollback command

```powershell
docker compose start data-openbb dexter-worker
```
