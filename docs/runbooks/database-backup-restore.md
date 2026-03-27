# Runbook: Database Backup and Restore

## Go/No-Go

### Prechecks
- `postgres` container is healthy.
- Disk space is available for backup output.
- Target restore database name is reserved for smoke (`thesis_restore_smoke`).

### Success signal
- Backup file is generated successfully.
- Restore to `thesis_restore_smoke` succeeds.
- Row counts for core tables match source DB.

### Abort signal
- Backup command fails or output file is empty.
- Restore SQL errors out.
- Row-count mismatch on core verification tables.

## Procedure

1. Create backup directory and dump file:
```powershell
New-Item -ItemType Directory -Force -Path "artifacts/m9/backup" | Out-Null
docker compose exec -T postgres pg_dump -U postgres thesis > "artifacts/m9/backup/thesis.sql"
```

2. Create clean restore database:
```powershell
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS thesis_restore_smoke;"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE thesis_restore_smoke;"
```

3. Restore dump:
```powershell
Get-Content "artifacts/m9/backup/thesis.sql" | docker compose exec -T postgres psql -U postgres -d thesis_restore_smoke
```

4. Verify integrity (example row count checks):
```powershell
docker compose exec -T postgres psql -U postgres -d thesis -At -c "SELECT count(*) FROM jobs;"
docker compose exec -T postgres psql -U postgres -d thesis_restore_smoke -At -c "SELECT count(*) FROM jobs;"
```

5. Cleanup restore DB:
```powershell
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS thesis_restore_smoke;"
```

## Evidence to save

- Backup filename and size.
- Source/restore row counts for checked tables.
- Timestamp of restore verification.

## Rollback command

```powershell
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS thesis_restore_smoke;"
```
