# Phase 7 M3 - Pulse Morning Newspaper Edition & Portfolio Radar

## Summary

M3 makes Pulse easier to read as a morning issue. It adds a reader-friendly morning edition layer for market board cards, portfolio radar rows, catalysts, approved headlines, and sector pulse.

This milestone does not change Thesis doctrine. Pulse remains a research and conviction briefing, not a trading terminal, screener, or market dashboard.

## Goal

Make Pulse feel like something a customer can read with coffee: clear lead story, quick daily board, names they care about, catalysts to watch, and selected headlines to open separately.

## Deliverables

- Add `MarketPulseMorningEdition`
- Add optional `MarketPulseReport.morning_edition`
- Add optional Pulse sections:
  - `market_board`
  - `portfolio_radar`
  - `today_catalysts`
  - `headline_digest`
  - `sector_pulse`
- Update Product API assembly
- Update HTML/PDF renderer
- Add contract/render/Product API tests
- Generate evidence artifacts

## Locked Behavior

- Use existing Thesis visual system; do not copy screenshot colors.
- Hide modules that lack clean data.
- Do not show raw internal labels to customers.
- Portfolio radar is watchlist/portfolio-only.
- Headlines show headline, source, timestamp, and link only.
- Do not scrape or reproduce article bodies.
- Do not add Yahoo or Alpha Vantage to Market Tape runtime or provenance.

## Acceptance Criteria

- [ ] Contract validates with and without `morning_edition`
- [ ] Product API builds morning edition additively
- [ ] HTML/PDF render all M3 modules when fixture data exists
- [ ] Missing optional module data does not create broken cards
- [ ] Customer output avoids raw `data_incomplete` and `bounded_context`
- [ ] Evidence artifacts are recorded under this milestone

## Smoke Test

```text
Step 1: Generate a Pulse fixture with all M3 module types.
Step 2: Validate contracts and Product API tests.
Step 3: Export HTML/PDF.
Step 4: Confirm - market board, portfolio radar, catalysts, headlines, and sector pulse render.
Step 5: Confirm - headline digest includes only source/headline/link/time.
Step 6: Confirm - no terminal workflow or new app tab is introduced.
```
