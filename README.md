# Thesis Monorepo

This repository is the implementation workspace for the Thesis Finance Intelligence Platform.

The canonical planning documents live under the `Project Note/` directory, which is split into two phases:

- [Phase 1 (MVP Build)](./Project%20Note/Phase1/README.md) — The technical foundation, Android MVP, and initial Deep Dive + Market Pulse capability.
- [Phase 2 (Monetization & Evolution)](./Project%20Note/Phase2/ph2_README.md) — Subscriptions, Fear & Greed Index, historical data, and the 3-tab UX redesign.

## Documentation Pointers

**Phase 1 Docs (Existing Architecture):**
- [AGENTS.md](./Project%20Note/Phase1/AGENTS.md)
- [BLUEBOOK cld.md](./Project%20Note/Phase1/BLUEBOOK%20cld.md) (Core Architecture)
- [ROADMAP.md](./Project%20Note/Phase1/ROADMAP.md)

**Phase 2 Docs (Active Roadmap):**
- [ph2_AGENTS.md](./Project%20Note/Phase2/ph2_AGENTS.md)
- [ph2_BLUEBOOK.md](./Project%20Note/Phase2/ph2_BLUEBOOK.md) (Architecture Extensions)
- [ph2_ROADMAP.md](./Project%20Note/Phase2/ph2_ROADMAP.md)
- [ph2_PRD.md](./Project%20Note/Phase2/ph2_PRD.md)
- [UX_ARCHITECTURE.md](../UX_ARCHITECTURE.md) (Target Vision)
- [new_PRODUCT_ROADMAP.md](../new_PRODUCT_ROADMAP.md) (Feature Backlog)

## Current Status

Entering Phase 2. The core monorepo, contracts, and Android client exist and are operational up to M9 standards. The active kickoff is M0 of Phase 2 (Open-Source Data Foundation).

## Local Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm m0:build-universe
pnpm m0:load
docker-compose up --build
```
