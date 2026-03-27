# ph2_ADR-002: Fear & Greed Index Engine

## Status
Accepted

## Context
Phase 2 introduces a proprietary "Fear & Greed" market sentiment index based on multiple market indicators. This must be displayed on the mobile app's "Today" tab (M8) and explicitly tracked over a 90-day historical window. The inputs rely on various external data sources (VIX, options chains, ETF flows, breadth, etc.).

## Decision
The Fear & Greed index will not be calculated dynamically on the mobile client, nor will it be calculated dynamically by the API on user request.
- It will be implemented as a dedicated deterministic math engine (`packages/fear-greed-engine`).
- A `scheduler` cron job will run daily after market close (17:00 America/New_York) to pull the approved inputs, calculate the composite score, and write a single row to `fear_greed_snapshots` in Postgres. The cron skips non-trading days (weekends and US market holidays).
- `product-api` will serve two endpoints:
  - `GET /v1/market/fear-greed` — returns the last 90 snapshots for historical charting
  - `GET /v1/market/fear-greed/latest` — returns only the most recent snapshot (for the Today-tab card in M8)
- Each snapshot stores a `sub_scores` JSONB array preserving the full audit trail (raw value, normalized score, weight, provider, and availability status per input), plus a `missing_inputs` array that explicitly declares any inputs that were unavailable.
- The `id` field is a deterministic hash of `market_date`, enabling idempotent upsert-on-conflict.

## Open Sub-Decisions

These are operational decisions that must be resolved before M3 implementation begins. They are tracked as Gated Pre-Conditions in `M3_MILESTONE_AGENTS_ph2.md`.

| # | Decision | Status |
|---|---|---|
| G1 | Approved input list (which of the candidate indicators are in scope for M3) | **OPEN** |
| G2 | Weighting doctrine (equal, empirical, or other formula) | **OPEN** |
| G3 | Data providers per input (API sources, credentials, rate limits) | **OPEN** |
| G4 | Degradation policy when inputs are unavailable (re-weight, use prior day, or fail) | **OPEN** |
| G5 | Historical bootstrap range (backfill 90 days at launch, or start from day zero) | **OPEN** |

## Consequences
**Positive:**
- Client-side loading time is instantaneous (just reading a tiny JSON payload).
- Absolute historical consistency (the score calculated on March 1st will never change if the algorithm changes on March 15th, preserving the integrity of the historical chart).
- API provider costs are minimized (data is fetched exactly once per day, not per user session).
- Full audit trail in `sub_scores` enables score verification and debugging.

**Negative:**
- The index is not "live" during trading hours. It updates once per day. (Acceptable for an executive summary/sentiment gauge).
- Multiple data providers may be needed, increasing operational complexity and cost.

## Revisit Condition

Re-evaluate this ADR if:
- Users request intraday Fear & Greed updates
- The number of inputs grows beyond what a single nightly run can reasonably collect
- A single provider can supply all inputs, simplifying the architecture
