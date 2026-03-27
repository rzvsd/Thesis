# Runbooks

This folder contains executable operational procedures for M9 hardening.

Start here:
- [INDEX.md](./INDEX.md) — smoke-step mapping, owners, and rollback commands
- [visibility-observability.md](./visibility-observability.md)
- [provider-outage.md](./provider-outage.md)
- [failed-jobs.md](./failed-jobs.md)
- [redis-flush-recovery.md](./redis-flush-recovery.md)
- [deployment-rollback.md](./deployment-rollback.md)
- [database-backup-restore.md](./database-backup-restore.md)

## Quick Run

From repo root:

```powershell
corepack pnpm runbooks:m9:smoke
```

Optional (includes backup/restore validation):

```powershell
corepack pnpm runbooks:m9:smoke:backup
```

Artifacts are written under `artifacts/m9/<timestamp>/`.
