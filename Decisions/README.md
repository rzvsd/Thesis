# Decisions

Architecture decision records (ADRs), grouped by the phase in which they were written.
Deep Dive decision records (DDR-001 to DDR-007) are in
[`Project Note/DeepDive/Decisions/`](../Project%20Note/DeepDive/Decisions/).

An ADR records why a choice was made at the time. It can be out of date. For what is true
now, read [`docs/CURRENT_STATE.md`](../docs/CURRENT_STATE.md). When an ADR and the code
disagree, the code wins: add a new ADR or a supersession note, do not edit history silently.

Known gaps between ADRs and the current state:

- `ph1/ADR-004-cloud-provider.md` names Fly.io. The deploy workflow uses Docker Compose over SSH. The as-built record is in progress (PR #75).
- `ph2/ph2_ADR-002-fear-greed-engine.md` is replaced by `ph6/ph6_ADR-005-macro-stress-replaces-fear-greed.md`, but the Fear & Greed screen and routes still exist.
- `ph2/ph2_ADR-003-revenuecat-monetization.md` is accepted, but its setup items (RevenueCat project and keys, Play product IDs, gated-feature list) are still open.

Open owner decisions (price provider, launch market, LLM budget per Deep Dive, hosting
target) are listed in `docs/CURRENT_STATE.md`. Record each one here as a new ADR when it is
made.
