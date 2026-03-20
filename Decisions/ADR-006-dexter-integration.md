# ADR-006: Dexter-First Deep Dive Architecture

**Date:** 2026-03 (revised)  
**Status:** Accepted (supersedes prior version)  
**Needed before:** M3  
**Deciders:** Engineering Lead, AI/Reasoning Engineer

---

## Context

Dexter (github.com/virattt/dexter) is an autonomous financial research agent with native capabilities for company analysis — including data retrieval, planning, section execution, scoring, and synthesis.

The prior version of this ADR (Option 3) required overriding Dexter's native data-fetching tools to route all data through `data-openbb`. While architecturally clean from a plane-separation perspective, this introduced unnecessary complexity and fought against Dexter's upstream design.

The platform has two product surfaces with fundamentally different data needs:

| Surface | Primary need |
|---|---|
| **Company Deep Dive** | Deep, company-specific research and analysis |
| **Market Pulse** | Broad market/macro data aggregation and news synthesis |

Forcing both surfaces through the same data path created friction without clear benefit.

## Decision

**Dexter upstream OSS becomes the primary engine for Company Deep Dive. OpenBB + news-ingest become the primary input layer for Market Pulse.**

Specifically:

- Dexter retains its native research behavior for Deep Dive — its data tools are **not overridden**
- `data-openbb` provides structured market, macro, and financial data for the **Market Pulse** path
- `news-ingest` provides approved-source news for the **Market Pulse** path
- Product API remains the sole public entry point and job orchestrator for both surfaces

## What Changed from Prior Version

| Prior ADR-006 | This revision |
|---|---|
| Dexter's data tools overridden to call `data-openbb` | Dexter uses its native research tools for Deep Dive |
| Financial Datasets API / Exa / Tavily keys not provisioned | Dexter's native provider keys are required for Deep Dive |
| `data-openbb` was the universal data source for all surfaces | `data-openbb` is scoped to Market Pulse |
| Single data path for both surfaces | Surface-specific data paths |

## LangSmith Decision

Unchanged from prior version. Dexter ships with LangSmith wired in. **LangSmith is retained** as the LLM tracing tool.

## Fork Pinning

Our fork `https://github.com/rzvsd/fintech` is pinned to commit `9e570f88abeded674125a53faaeaded3858dd672`. Upstream base is `https://github.com/virattt/dexter`. Upstream changes are reviewed before any upgrade — never auto-pulled.

## Consequences

- `apps/dexter-worker/` contains our Dexter fork as a dependency, pinned to a specific commit
- Dexter's native data tools are **retained**, not overridden — Dexter manages its own data retrieval for Deep Dive
- `data-openbb` and `news-ingest` serve the Market Pulse pipeline — they are not in the Deep Dive critical path
- Dexter's native provider keys (Financial Datasets API, etc.) must be provisioned for Deep Dive
- LangSmith account required before M3 begins
- M3+ documentation rewritten to reflect this split
- Prior "Dexter must not bypass OpenBB" rule removed
- M1 and M2 milestones unchanged

## Revisit When

- Dexter upstream releases a major version with architectural changes
- Platform scale requires replacing Dexter's agent loop with a custom implementation
- Deep Dive begins requiring data sources that Dexter does not natively support (may warrant selective `data-openbb` integration)
