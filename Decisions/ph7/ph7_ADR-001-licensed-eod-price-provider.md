# ph7_ADR-001: Licensed End-of-Day Price Provider

## Status
Proposed - **pending owner decision (Razvan)**. The integration point is built. No vendor is chosen.

## Context
Thesis has no legitimate price source. Four product surfaces need a price:

| Consumer | Where | Needs |
|---|---|---|
| Pulse followed-name rows ("Your Names") | `apps/dexter-worker/src/pulse-brief.ts` | latest close and previous close |
| Contrarian alerts (anchor + daily evaluation) | `apps/product-api/src/server.ts` | latest close |
| Kill-switch `price_move_pct` rules | `apps/product-api/src/server.ts` | latest close |
| Deep Dive valuation ratios and DCF versus spot | `apps/dexter-worker/src/pipeline.ts` -> `financial-indicators.ts`, `dcf/index.ts` | latest close |

Before this change, the product-api consumers and the Pulse rows read the unofficial Yahoo Finance chart API, and live Deep Dives had no price at all. A Yahoo path conflicts with the Phase 6 provider stance (`Project Note/Phase6/PH6_DECISION_LOCKS.md`: no yfinance-style dependencies in protected core paths) and with ph6_ADR-001 (official-source-first data plane). ph6_ADR-001 allows a revisit "only if a specific licensed provider solves a proven product gap". These four surfaces are that gap.

## What is built (provider-agnostic)
- One interface in the data service: `GET /v1/market/eod-prices?tickers=AAPL,MSFT` on `apps/data-openbb` (`src/prices.py`). It returns, per ticker, `available`, `close`, `previous_close`, `as_of` and `currency`, or `available: false` with a `reason`.
- `PRICE_PROVIDER` selects the adapter. Default `none`: every ticker is unavailable (`price_provider_not_configured`). Consumers keep their existing hide-when-missing behavior (rows omitted, valuation ratios omitted with a `price_source` omission, DCF without spot, alerts skipped).
- `PRICE_PROVIDER_API_KEY` holds the vendor key. Never commit it.
- All four consumers call this one endpoint through `PRICE_SERVICE_BASE_URL` (default `http://data-openbb:3003`). The Yahoo price paths and the `SENTIMENT_YAHOO_BASE_URL` / `DEXTER_PULSE_PRICE_BASE_URL` settings are removed.
- Adding a vendor is one adapter class registered in `ADAPTERS` in `src/prices.py`. The module docstring has the template.

## Decisions the owner must make

| # | Decision | Options / notes | Status |
|---|---|---|---|
| P1 | **Display licence** | The deciding factor. The licence must allow showing prices (and values derived from them: change %, P/E, market cap, DCF upside) to end users of a **paid consumer app**, on mobile, with storage/caching of daily closes. Many low-cost tiers are "internal use" or "personal use" only. Get the display and redistribution terms in writing. Check required attribution text and exchange fees. | **OPEN** |
| P2 | **Provider** | Choose after P1. Pick a vendor whose consumer-display terms fit P1 and whose coverage fits the launch market (US-only vs US + EU is also still open). | **OPEN** |
| P3 | **EOD vs delayed** | End-of-day closes are enough for all four consumers (Pulse is a morning brief; alerts evaluate daily; Deep Dive is not intraday). EOD licences are usually cheaper and simpler than 15-minute delayed. Recommendation: EOD only. | **OPEN** (recommendation: EOD) |
| P4 | Attribution in the app | If the licence requires a source credit, the mobile app must show it next to prices. Not built yet. | **OPEN** (depends on P1/P2) |

## Consequences
**Positive:**
- One place to swap or add a provider. Consumers do not change.
- Safe default: with no provider, the product shows no prices instead of unlicensed prices.

**Negative:**
- Until P1-P2 are closed, production has no prices: Pulse "Your Names" rows fall back to the deterministic report, contrarian and kill-switch price rules do not fire, and Deep Dive omits price-dependent valuation.

## Out of scope / follow-ups
- `apps/data-openbb` still uses `yfinance` for the live earnings calendar (`CALENDAR_PROVIDER`). That is calendar data, not prices, and is not covered here.
- `apps/product-api/src/sentiment.ts` still contains an unused Yahoo-based Fear & Greed builder (`buildFearGreedSnapshot`). Nothing imports it. It can be deleted separately.
