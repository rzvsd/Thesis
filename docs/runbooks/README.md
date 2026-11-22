# Runbooks

This folder contains executable operational procedures for hardening milestones (M4 and M9).

Start here:
- [INDEX.md](./INDEX.md) — smoke-step mapping, owners, and rollback commands
- [visibility-observability.md](./visibility-observability.md)
- [provider-outage.md](./provider-outage.md)
- [failed-jobs.md](./failed-jobs.md)
- [redis-flush-recovery.md](./redis-flush-recovery.md)
- [deployment-rollback.md](./deployment-rollback.md)
- [database-backup-restore.md](./database-backup-restore.md)
- [launch-proof.md](./launch-proof.md) — one-time production live proof (health/mode script, Deep Dive, Pulse, push, Play test purchase)

## Quick Run

From repo root:

```powershell
corepack pnpm runbooks:m9:smoke
```

Optional (includes backup/restore validation):

```powershell
corepack pnpm runbooks:m9:smoke:backup
```

M4 alert/readiness smoke:

```powershell
corepack pnpm runbooks:m4:smoke
```

M5 launch-gate smoke:

```powershell
corepack pnpm runbooks:m5:smoke
```

Artifacts are written under `artifacts/m4/runbooks/<timestamp>/`, `artifacts/m5/launch-gate/<timestamp>/`, and `artifacts/m9/<timestamp>/`.
