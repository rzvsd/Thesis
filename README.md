# Thesis Monorepo

This repository is the implementation workspace for the Thesis Finance Intelligence Platform.

Thesis is a research and conviction-support product (Pulse daily brief and Deep Dive filing memo), not a trading terminal, broker workflow, or public quant lab.

## Current Source Of Truth

Read [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md) first. It says what is built, what is live versus fixture, the open owner decisions, and the launch checklist. It also defines the status words (Validated versus Done).

## Historical Planning Layers

The phase packs (Phase 1 to Phase 7, Deep Dive, Safety) in [Project Note/](./Project%20Note/README.md) are history. They are superseded by `docs/CURRENT_STATE.md`. Decision records are in [Decisions/](./Decisions/README.md).

## Dependency Policy As Of Phase 7

- Internal TypeScript services should depend on workspace packages, not private GitHub tarball dependencies.
- Node installs in CI and Docker images use `pnpm install --frozen-lockfile`; update `pnpm-lock.yaml` intentionally when package metadata changes.
- Python service dependencies are modeled in the root `pyproject.toml` and locked by `uv.lock`. CI runs `uv lock --locked --python 3.11` so Python drift is visible.
- `apps/data-openbb/requirements.txt` is the reproducible base dependency set used by CI/container smoke. The optional pinned OpenBB fork remains in `apps/data-openbb/requirements-live.txt` because that private GitHub fork is not available to unauthenticated CI runners.
- `apps/dexter-worker` no longer consumes the historical external `dexter` package pin from `github:rzvsd/fintech#9e570f88abeded674125a53faaeaded3858dd672`.
- The old Phase 1 Dexter dependency record is historical and superseded by the Phase 7 worker implementation. Do not re-add that dependency without an explicit ADR, updated docs, reproducible CI proof, and owner approval.
- Runtime provider dependencies must be reproducible in CI/deploy proof. Private Git dependencies require documented authentication or replacement with a public/released package path.
- Secrets stay outside the repo and must never be committed.

## Production Safety Defaults

Local `.env.example` values are for development only. When `NODE_ENV=production`, services fail fast if they see known local defaults such as `dev-jwt-secret-change-me`, `dev-internal-worker-token`, `AUTH_EXPOSE_VERIFICATION_TOKEN=true`, the default Postgres password, or fixture/test modes. Fixture mode in production is allowed only for explicit proof jobs with `THESIS_ALLOW_PRODUCTION_FIXTURES=true`.

## Local Commands

```bash
pnpm install --frozen-lockfile
python -m uv lock --locked --python 3.11
pnpm lint
pnpm typecheck
pnpm test
docker-compose up --build
```
