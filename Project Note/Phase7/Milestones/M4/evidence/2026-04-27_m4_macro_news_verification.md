# Phase 7 M4 Macro News Verification - 2026-04-27

## Scope

Phase 7 M4 adds a Pulse-only macro news and geopolitical shock layer so major public events can move to the front of the Morning Pulse without turning Thesis into a news terminal, trading signal product, or unbounded headline scraper.

The implemented path is deterministic and omission-forward. It uses approved headline metadata only: title, source, URL, timestamp, topic, severity, confirmation state, corroboration count, affected regions, affected assets, and evidence references. Article bodies are not ingested.

## Implemented

- Added additive `MarketPulseMacroNewsPack` contract support.
- Extended `MarketPulseReport` with optional `macro_news`.
- Extended Pulse sections with optional `macro_news`.
- Added Product API deterministic macro-news assembly helpers.
- Added validation for macro-news states, topic, severity, confirmation, evidence, affected regions, and affected assets.
- Added renderer support so macro shock/watch content appears near the front of the issue, after Market Tape.
- Added a macro-shock fixture/export proving that a Taiwan Strait-style shock can become the lead issue context.
- Updated Phase 7 docs and decision locks for M4.

## Generated Artifacts

- `Project Note/Phase7/Milestones/M4/evidence/generated-2026-04-27/pulse-2026-04-27-macro-shock.json`
- `Project Note/Phase7/Milestones/M4/evidence/generated-2026-04-27/pulse-2026-04-27-macro-shock.html`
- `Project Note/Phase7/Milestones/M4/evidence/generated-2026-04-27/pulse-2026-04-27-macro-shock.pdf`
- `Project Note/Phase7/Milestones/M4/evidence/generated-2026-04-27/pulse-2026-04-27-macro-shock-full.png`

PDF proof:

- Exists: yes
- Page count: 8
- Size: 793,073 bytes

## Test Evidence

Passing focused proof:

- `corepack pnpm --filter @thesis/contracts test`
  - Result: pass
  - Proof: 15 contract tests passed.
- `corepack pnpm --filter @thesis/product-api build`
  - Result: pass
- `node --test dist/apps/product-api/tests/market-pulse-render.test.js`
  - Result: pass
  - Proof: macro-news HTML rendering and print/page-break assertions passed.
- `node --test dist/apps/product-api/tests/market-pulse.test.js`
  - Result: pass
  - Proof: deterministic Pulse assembly still builds a calm issue by default and keeps macro_news omitted from visible sections when there is no macro event.

Full-suite caveat:

- `corepack pnpm --filter @thesis/product-api test` was attempted twice after M4.
- Both attempts timed out/hung with no useful failure output.
- This is not counted as full-suite pass evidence for M4.
- Focused M4-relevant Product API tests and the Product API build did pass.

## Copy And Safety Checks

The generated fixture contains:

- Macro shock headline surfaced in the lead issue.
- Macro News section near the front of the issue.
- Visible confirmation state and source count.
- Coverage note explaining that headline/link/time/source metadata is used and article bodies are not ingested.

The customer-facing artifact avoids:

- raw provider-debug noise
- raw internal status labels such as `data_incomplete`
- buy/sell language
- price targets
- persona-style trading narration
- direct publication of unconfirmed article-body claims

## Acceptance Notes

M4 answers the user question: if a major macro/geopolitical event is represented in approved headline metadata, Pulse can now elevate it, classify it, explain why it matters, and show a visible confirmation/coverage note.

M4 does not yet prove live ingestion from external publications end to end. That belongs to the later approved-headline-source ingestion milestone. This implementation gives Product API, contracts, validation, rendering, and export a safe destination for that data.

