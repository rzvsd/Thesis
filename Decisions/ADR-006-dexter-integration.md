# ADR-006: Dexter Integration Strategy

**Date:** 2026-03  
**Status:** Accepted  
**Needed before:** M3  
**Deciders:** Engineering Lead, AI/Reasoning Engineer

---

## Context

Dexter (github.com/virattt/dexter) is an autonomous financial research agent that will serve as the reasoning engine. However, Dexter's native implementation fetches financial data directly via Financial Datasets API and Exa/Tavily web search — bypassing the governed `data-openbb` service entirely. This conflicts with the platform architecture.

Three integration options were evaluated:

| Option | Description | Architecture impact |
|---|---|---|
| **Option 1** | Replace Dexter's data tools with calls to `data-openbb` | Clean — plane separation preserved |
| **Option 2** | Let Dexter own data retrieval — drop `data-openbb` | Breaks plane separation, loses contract governance |
| **Option 3** | Run side by side — Dexter calls `data-openbb` as its data source | Clean — preserves architecture, requires deliberate wiring |

## Decision

**Option 3 — Dexter calls `data-openbb` as its governed data source.**

Dexter's native data-fetching tools (Financial Datasets API, Exa, Tavily) are **overridden in our fork** to route through `data-openbb` instead. Dexter's planning, execution, and self-reflection logic is retained unchanged.

## What Gets Overridden in the Fork

| Dexter native tool | Replaced with |
|---|---|
| `get_income_statements` | `data-openbb` → `CanonicalFinanceData` |
| `get_balance_sheet` | `data-openbb` → `CanonicalFinanceData` |
| `get_cash_flow_statements` | `data-openbb` → `CanonicalFinanceData` |
| Web search (Exa/Tavily) | `news-ingest` → `CanonicalNewsArticle` |

Dexter's planner, section executors, scorer, and synthesizer are **not modified**.

## LangSmith Decision

Dexter ships with LangSmith wired in. **LangSmith is retained** as the LLM tracing tool. All references to Langfuse in platform documents are updated to LangSmith.

## Fork Pinning

Our fork is pinned to commit `v2026.3.8` (latest stable as of 2026-03). Upstream changes are reviewed before any upgrade — never auto-pulled.

## Consequences

- `apps/dexter-worker/` contains our Dexter fork as a dependency, pinned to a specific commit
- Data tool override is the single custom integration point — isolated to one adapter layer
- `CanonicalFinanceData` and `CanonicalNewsArticle` contracts are the seam between Dexter and the data plane
- Financial Datasets API, Exa, and Tavily keys are **not provisioned** — they are unused
- LangSmith account required before M3 begins

## Revisit When

- Dexter upstream releases a major version with architectural changes
- Dexter adds native support for external data source injection (eliminating need for override)
- Platform scale requires replacing Dexter's agent loop with a custom implementation
