# Thesis Monorepo

This repository is the implementation workspace for the Thesis Finance Intelligence Platform.

Thesis is currently in **Phase 7**, focused on making Pulse a clearer daily financial briefing while preserving the product doctrine: research and conviction support, not a trading terminal, broker workflow, or public quant lab.

## Current Source Of Truth

Use the Phase 7 planning pack as the current governance layer:

- [Phase 7 Roadmap](./Project%20Note/Phase7/ph7_ROADMAP.md)
- [Phase 7 Milestones](./Project%20Note/Phase7/ph7_MILESTONES.md)
- [Phase 7 PRD](./Project%20Note/Phase7/ph7_PRD.md)
- [Phase 7 Bluebook](./Project%20Note/Phase7/ph7_BLUEBOOK.md)
- [Phase 7 Decision Locks](./Project%20Note/Phase7/PH7_DECISION_LOCKS.md)
- [Phase 7 Milestone Evidence](./Project%20Note/Phase7/Milestones/)

Older phase documents remain important, but they are historical unless a current Phase 7 document explicitly points back to them.

## Historical Planning Layers

- [Phase 1 MVP Build](./Project%20Note/Phase1/README.md) documents the original technical foundation, Android MVP, and early Deep Dive/Pulse architecture.
- [Phase 2 Monetization & Evolution](./Project%20Note/Phase2/ph2_README.md) documents subscriptions, historical data, UX evolution, and earlier product expansion work.
- Phase 3 through Phase 6 documents record shipped substrate, safety, and hardening decisions that Phase 7 builds on.

When historical docs conflict with Phase 7 docs or current code, treat Phase 7 plus current contracts/tests as authoritative and update the historical note or add a supersession note.

## Current Status

Phase 7 is active. M1-M6 have implementation evidence recorded and are tracked as validated in the Phase 7 roadmap. M7 is the active Pulse newspaper-template closeout and polish layer.

The current product emphasis is:

- Pulse as a readable daily financial briefing
- official/free-data market tape where available
- approved headline metadata without article-body scraping
- typed user research state for personalization
- guarded optional LLM copy editing after deterministic data assembly
- HTML/PDF exports suitable for review

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
