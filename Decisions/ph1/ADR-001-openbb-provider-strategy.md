# ADR-001: OpenBB Provider Prioritization and Fallback Order

**Date:** 2026-03  
**Status:** Accepted  
**Needed before:** M2  
**Deciders:** Engineering Lead, Data Platform Engineer

---

## Context

OpenBB wraps multiple third-party financial data providers (FMP, Polygon, Alpha Vantage, and others). Without a defined priority order, `data-openbb` will behave unpredictably when a provider is down, rate-limited, or missing a specific field. We need a declared, documented hierarchy before building the data plane.

## Decision

| Data type | Primary provider | Fallback |
|---|---|---|
| Equity financials (income, balance sheet, cash flow) | FMP (Financial Modeling Prep) | Alpha Vantage |
| Market and price data (indices, quotes) | Polygon | FMP |
| Macro data (CPI, NFP, FOMC, rates) | FMP | None — macro has no fallback in v1 |
| FX and commodities | Polygon | None in v1 |

## Rationale

- FMP has the most complete SEC filing and earnings data for US equities
- Polygon is reliable for real-time and historical market/price data
- FMP is the approved provider for US macro data in v1 — no fallback is appropriate
- Alpha Vantage as equity fallback covers the most common missing fields when FMP is unavailable

## Consequences

- `data-openbb` must implement provider fallback logic per data type
- Each provider requires its own API key in environment secrets
- Rate limits differ per provider — Redis rate limiter must be configured independently per provider
- Macro and FX/commodity failures result in `data_unavailable` for those sections — no substitution

## Revisit When

- A provider changes pricing model or drops coverage of US equities
- A provider experiences repeated outages in production
- A new provider offers materially better coverage at lower cost
