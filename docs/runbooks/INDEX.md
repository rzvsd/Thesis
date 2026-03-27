# M9 Runbook Index

This index maps M9 smoke groups to concrete runbooks, ownership, and rollback commands.

## Mapping

| M9 Smoke Steps | Acceptance Link | Runbook | Primary Owner | Primary Command | Rollback Command |
|---|---|---|---|---|---|
| Steps 1-5 (Visibility) | AC #1, #2, #3 | [visibility-observability.md](./visibility-observability.md) | Engineering Lead | `POST /internal/pulse/dispatch` with `force_fail=true` + verify telemetry | `docker compose restart product-api` |
| Steps 6-17 (Provider outage) | AC #4, #5 | [provider-outage.md](./provider-outage.md) | Data Plane On-Call | `docker compose stop data-openbb` + trigger pulse | `docker compose start data-openbb` |
| Steps 18-22 (LLM timeout/failed jobs) | AC #6 | [failed-jobs.md](./failed-jobs.md) | Reasoning On-Call | submit Deep Dive timeout/failure scenario and verify resolved failed state | `docker compose restart dexter-worker` |
| Steps 23-25 (Redis flush) | AC #7 | [redis-flush-recovery.md](./redis-flush-recovery.md) | Platform On-Call | `redis-cli FLUSHALL` during queued/running job + verify recovery | `docker compose restart redis dexter-worker product-api` |
| Steps 30-33 (Deploy discipline) | AC #10, #13 | [deployment-rollback.md](./deployment-rollback.md) | Ops Lead | execute documented rollback drill by service | `git checkout <known_good_sha>` + `docker compose up -d --build <service>` |
| Steps 34-36 (Backup/restore) | AC #9, #12 | [database-backup-restore.md](./database-backup-restore.md) | Operations Lead | `pg_dump` + restore to `thesis_restore_smoke` + row count compare | `DROP DATABASE thesis_restore_smoke` |

## Notes

- Deep Dive-dependent checks remain owner-deferred where explicitly recorded in M9 docs.
- `deployment-rollback.md` is executable for current docker-hosted staging operations.
- CI/CD production deployment proof is tracked separately under M9 AC #13.
