# Phase 7 M7 - Pulse Newspaper Template Revamp

## Summary

M7 replaces the previous 13-module Pulse idea with the compact newspaper template locked in:

```text
Project Note/Phase7/Milestones/implementation_plan.md
```

The goal is not to add more cards. The goal is to make Pulse feel like a professional morning financial briefing: short, readable at coffee, evidence-backed, and free of implementation anatomy.

## Canonical Section Order

1. Masthead
2. The Tape
3. What Changed
4. Your Names, only when portfolio/watchlist rows exist
5. Today's Calendar, only when dated catalysts exist
6. Headlines Worth Knowing, only when approved headlines exist
7. Signal vs Noise
8. The Backdrop
9. Footer sources and method

## What Is Removed From Main Flow

- Market Overview as a standalone section
- standalone Why It Matters
- standalone What To Watch
- standalone Company / Event Notes
- visible Coverage Notes card
- visible Method card
- daily Structural Context section
- repeated inline evidence blocks
- any raw `data_incomplete`, `bounded_context`, or provider-debug labels

Useful data from those old sections can still feed the Tape, What Changed, Backdrop, or footer sources. The old presentation is gone.

## Product Lock

Pulse remains a research and conviction briefing. It does not become:

- a quote terminal
- a screener
- a trading alert product
- a public AI investor-persona product

The LLM editorial writer, when enabled, is only a copy editor. It cannot decide issue structure or invent facts.

## Implementation Notes

- `apps/product-api/src/pulse-issue-plan.ts` owns deterministic visibility and quiet-day detection.
- `apps/product-api/src/market-pulse-render.ts` renders only the new newspaper hierarchy.
- `apps/product-api/src/pulse-editorial-writer.ts` uses the revised compact JSON contract and caps OpenRouter output at 600 tokens.
- Quiet days bypass LLM generation and render a valid short issue.
- Evidence appears once in the footer.
- Coverage limitations are footer metadata, not a main story card.

## Provider Notes

- Market Tape remains FRED-only for production runtime.
- Yahoo and Alpha Vantage remain excluded from Market Tape runtime and provenance.
- Fed speeches and Fed press RSS are approved candidates for official/free calendar and headline enrichment.
- BLS release-calendar HTML is an approved candidate for macro calendar enrichment.
- Yahoo earnings calendar is not reliable enough for production because it returns 429/blocked responses.
- Earnings alternatives to evaluate next: issuer IR calendars, SEC filing/event-derived proxy, Nasdaq calendar if stable, or a manually curated weekly calendar file.
- 404/429 provider failures must skip the affected optional section or create footer omission truth; they must not render broken cards.

## Evidence Checklist

- [ ] Product API build
- [ ] Focused renderer test
- [ ] Focused LLM editorial writer test
- [ ] Generated compact Pulse HTML
- [ ] Generated compact Pulse PDF
- [ ] Provider 404/429 alternatives note

## Rollback

Re-enable the previous renderer only as an emergency path. Do not restore the 13-module issue model, repeated inline evidence, raw customer-facing status labels, or weak filler sections.
