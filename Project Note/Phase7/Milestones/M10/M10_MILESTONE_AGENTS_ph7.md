# Phase 7 M10 - Pulse A+ Morning Brief Engagement Overhaul

## Summary

M10 turns Pulse from a structurally correct report into a more engaging Morning Brief: adaptive by day type, richer in story, still deterministic underneath, and still evidence-bound.

This milestone intentionally follows M9 rather than replacing it. M9 is Dexter Evidence Quality Skills. M10 is the Pulse engagement overhaul.

## Goal

Create a 5-10 minute morning read that feels like a sharp analyst friend at coffee: scannable first, readable second, with one memorable observation and a clear throughline from tape to user names to macro context.

## Deliverables

| Deliverable | Description |
|---|---|
| Expanded editorial contract | Optional `morning_story`, `tape_color`, `names_narrative`, `one_thing`, and `mood` fields on `MarketPulseBriefEditorial` |
| Richer fact pack | Deterministic `narrative_facts`, one-thing candidate selection, and per-name context |
| Better fallback copy | Declarative reader-facing copy for quiet, normal, and event days |
| Expanded Dexter prompt | LLM prompt with deterministic fact pack, tension summary, and 500-word guarded output budget |
| Adaptive renderer | Quiet, normal, and event layouts with stronger hierarchy |
| New visual elements | One-thing callout, sector strip, larger sparklines, and richer name cards |
| Tests and proof | Contract, render, Product API, Dexter, typecheck, and lint evidence |

## Locked Behavior

- Deterministic facts remain the source of truth.
- LLM output cannot mutate facts, values, sources, tickers, prices, events, omissions, or provenance.
- Quiet days can be short and explicit.
- Optional modules hide when typed data is absent.
- No empty community-signal slot renders until an approved data path exists.
- No trading advice, price targets, execution language, broker/screener/terminal flow, or article-body scraping.

## Acceptance Criteria

- [ ] Expanded `MarketPulseBriefEditorial` validates with old and new reports
- [ ] Pulse fact pack includes narrative facts and one-thing selection
- [ ] Renderer branches for quiet, normal, and event modes
- [ ] One-thing callout renders when candidates exist
- [ ] Sector strip renders from sector leadership data when present
- [ ] Name cards render typed price/context rows without fake prices
- [ ] HTML/PDF copy avoids raw internal labels
- [ ] Focused render and Pulse tests pass
- [ ] Full workspace typecheck and lint pass

## Smoke Test

```text
Step 1: Build Product API.
Step 2: Render a normal/event Pulse fixture.
Step 3: Confirm - The Read, The One Thing, adaptive tape, Your Names, calendar/headlines, Honest Read, and Sources render.
Step 4: Render a quiet Pulse fixture.
Step 5: Confirm - issue collapses to a short quiet read and hides empty optional modules.
Step 6: Run contract tests.
Step 7: Run focused Product API Pulse/render tests.
Step 8: Run Dexter tests.
Step 9: Run workspace typecheck and lint.
```

## Rollback

Use the prior Morning Brief renderer path and disable expanded LLM fields. Do not weaken fact validation, source policy, or omission-forward behavior as a rollback shortcut.

## Owner

Product API Owner + Reasoning / ML Engineer + Product Lead
