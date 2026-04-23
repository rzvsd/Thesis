# Phase 6 M6 End-to-End Smoke

- Date: 2026-04-23
- Run by: Codex
- Environment: local Windows dev stack, memory/store backends, fixture-mode official/first-party sources, admin bootstrap login
- Result: pass
- Evidence bundle: `Project Note/Phase6/Milestones/M6/evidence/m6-e2e-20260423T113852Z/`

## Services started

- `data-openbb`
- `news-ingest`
- `dexter-worker`
- `product-api`
- `scheduler`

## What was proved

- World Bank structural context returned a contract-valid payload with retrieval metadata and omission truth.
- IMF remained explicitly non-blocking in the local runtime path through omission-first unavailable coverage.
- Deep Dive completed end to end through Product API and Dexter worker with structural context enriching:
  - `competitive_positioning`
  - `growth_opportunities_and_outlook`
  - `risks_and_challenges`
- Deep Dive issuer metadata carried:
  - `currency`
  - `domicile_country`
  - `region`
  - `sector`
  - `industry`
- Morning Exception Briefing surfaced structural context in existing sections while Macro Stress kept the locked five-category model:
  - `rates`
  - `inflation`
  - `labor`
  - `growth`
  - `energy`
- Historical replay reran one Deep Dive and one Morning Exception Briefing with `as_of=2025-02-14` and no look-ahead leakage.
- Evaluation emitted a scored artifact with `7/7` checks passing.
- Debate remained internal-only with `publish_blocked=true` and `publish_route=null`.
- Phase 6 dependency scan passed with `0 deprecated provider findings`.

## Primary artifacts

- `m6-e2e-20260423T113852Z/world-bank-structural-context.json`
- `m6-e2e-20260423T113852Z/deep-dive-report.json`
- `m6-e2e-20260423T113852Z/morning-exception-briefing-latest.json`
- `m6-e2e-20260423T113852Z/replay-deep-dive-report.json`
- `m6-e2e-20260423T113852Z/replay-morning-exception-briefing.json`
- `m6-e2e-20260423T113852Z/historical-replay-artifact.json`
- `m6-e2e-20260423T113852Z/evaluation-artifact.json`
- `m6-e2e-20260423T113852Z/debate-artifact.json`
- `m6-e2e-20260423T113852Z/dependency-scan.json`
- `m6-e2e-20260423T113852Z/smoke-summary.json`

## Notes

- The local IMF proof used the current non-blocking unavailable posture rather than a separate runtime toggle being flipped mid-run.
- This run did not push to GitHub.

## Sign-Off State

- Owner: Approved on 2026-04-23
- Engineering Lead: Accepted by owner delegation on 2026-04-23
- Hosted GitHub CI: Deferred to the next push; not treated as an open Phase 6 blocker in the local closeout record
