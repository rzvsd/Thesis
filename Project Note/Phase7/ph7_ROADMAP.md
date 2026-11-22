# Thesis - Phase 7 Roadmap

**Status:** Active  
**Last Revised:** 2026-11-21 (statuses reconciled with `reviews/2026-09-06/END-TO-END-REVIEW.md` after the seven P1 fixes)

---

## Sequence

| Milestone | Name | Status | Open items (review 2026-09-06) |
|---|---|---|---|
| M1 | Pulse Market Tape & Clear Daily Context | Conditional | Malformed replay `as_of` is silently replaced by today |
| M2 | Pulse Editorial Freshness & Daily Delta | Conditional | Replays can read future Pulse reports; coarse daily-delta detection |
| M3 | Pulse Morning Newspaper Edition & Portfolio Radar | Conditional | Unsafe headline links fixed; row evidence validation still weak |
| M4 | Pulse Macro News & Geopolitical Shock Layer | Conditional | Dispatch now reads approved headlines; live news-ingest proof not recorded |
| M5 | User Research State & Analyst Refresh Agent | Conditional | Refresh can read future Deep Dives; malformed holdings can 500 |
| M6 | Guarded LLM Pulse Editorial Writer | Conditional | Fact grounding added; Anthropic/OpenAI fallback still conflicts with OpenRouter-only lock |
| M7 | Pulse Issue Plan & Professional Newspaper Polish | Superseded | Renderer intentionally replaced by M8/M10 |
| M8 | Pulse Morning Brief Reset | Conditional | Unsafe links fixed; internal omission labels still reach the footer |
| M9 | Dexter Evidence Quality Skills | Conditional | Fixture context no longer reaches live runs; `assertCustomerSafeText` has no caller |
| M10 | Pulse A+ Morning Brief Engagement Overhaul | Conditional | Yahoo default removed and grounding added; provider fallback and compliant price source open |
| M11 | Deep Dive Filing Intelligence Memo Revamp | Conditional | Reviewed filing text now wired; SEC/XBRL evidence still lacks source locators; no live proof |
| M12 | Deep Dive Financial Indicators & Value Lens | Conditional | TTM continuity fixed; negative denominators and price provenance open |
| M13 | Deep Dive Benchmarks & Investor Education | Active | TTM continuity fixed; closeout pending |

## Status Semantics

- `Validated` means implementation evidence exists under the milestone evidence folder, no open P1/P2 review finding remains, and the milestone is no longer the active planning surface.
- `Conditional` means the core implementation and evidence exist and no P1 blocker remains, but listed review findings are still open; it is not a production sign-off.
- `Blocked` means a P1 finding removes the milestone's central behavior or a production guarantee.
- `Superseded` means later milestones intentionally replaced the deliverable; it needs no repair.
- `Active` means this is the current closeout, polish, or production-proof surface.
- `Deferred` should be used for accepted scope that is intentionally moved out of Phase 7.
- `Done` should be used only when owner sign-off and production/deploy proof are both recorded.

---

## M1 Execution Order

1. land the Phase 7 doc pack and decision locks
2. add additive market-tape contracts and validators
3. add `data-openbb` market-tape endpoint with replay-safe `as_of`
4. wire `market_tape` into Morning Exception Briefing assembly
5. update HTML/PDF rendering
6. run focused contract, adapter, Pulse, and render verification
7. record evidence under `Project Note/Phase7/Milestones/M1/evidence/`

---

## Non-Goals For M1

- Deep Dive redesign
- War Room changes
- terminal-style live board
- intraday streaming
- paid provider adoption
- Yahoo runtime integration

---

## M2 Execution Order

1. add additive editorial Pulse contracts
2. wire Product API to load prior Pulse and calendar watch inputs
3. assemble deterministic editorial issue sections
4. update HTML/PDF rendering to prefer editorial issue flow
5. hide stale static sections from the main story flow
6. run contract, Product API, render, and smoke verification
7. record evidence under `Project Note/Phase7/Milestones/M2/evidence/`

## Non-Goals For M2

- LLM-written Pulse prose
- new app tab
- market-terminal dashboard
- trading recommendations
- provider expansion for Market Tape

---

## M3 Execution Order

1. add additive morning-edition contracts
2. wire Product API assembly for market board, portfolio radar, catalysts, headline digest, and sector pulse
3. update HTML/PDF rendering to show reader-friendly modules when data exists
4. document headline, provider, and hidden-when-empty behavior
5. run contract, Product API, render, and artifact verification
6. record proof under `Project Note/Phase7/Milestones/M3/evidence/`

## Non-Goals For M3

- live market terminal
- public stock screener
- intraday quote streaming
- article-body scraping
- LLM rewriting of publication headlines
- new paid data provider

---

## M4 Execution Order

1. add additive macro-news contracts
2. classify approved macro/geopolitical headline inputs by topic and severity
3. expose confirmation state and corroboration count
4. promote shock-level items into Pulse issue framing
5. render macro-news section in HTML/PDF
6. test calm and shock scenarios
7. record proof under `Project Note/Phase7/Milestones/M4/evidence/`

## Non-Goals For M4

- article-body scraping
- article-body summarization
- real-time breaking-news terminal
- market alerts or trading recommendations
- paid news provider integration

---

## M5 Execution Order

1. add additive user research state contracts
2. add manual holdings and user research state persistence
3. add internal refresh route with omission-forward deterministic assembly
4. replace runtime Pulse watchlist text matching with typed state overlay
5. add holdings, refresh, Pulse personalization, and contract tests
6. record proof under `Project Note/Phase7/Milestones/M5/evidence/`

## Non-Goals For M5

- brokerage integration
- order execution
- public Q&A agent
- WhatsApp delivery
- LLM-written research state
- new app tab or terminal UI

---

## M6 Execution Order

1. add optional `editorial_generation` metadata
2. add OpenRouter client and disabled-by-default config
3. guard LLM output with strict JSON, fact, ticker, and trading-language validation
4. apply LLM rewrite only after deterministic Pulse and user research personalization
5. prove fallback behavior for disabled, malformed, and policy-failed outputs
6. record proof under `Project Note/Phase7/Milestones/M6/evidence/`

## Non-Goals For M6

- deterministic source-of-truth replacement
- model-selected market facts
- trading advice or signals
- global per-user Pulse storage

---

## M7 Execution Order

1. add an internal deterministic `PulseIssuePlan`
2. make `implementation_plan.md` the canonical revamp reference
3. replace the old 13-module renderer with the strict newspaper hierarchy
4. fold market board, cross-asset read, and sector pulse into The Tape
5. hide optional modules when the typed data is absent
6. move evidence, coverage notes, and method into one footer area
7. tighten HTML/PDF typography and page-break behavior
8. cap the LLM editor to the compact 7-field contract and 600-token output
9. generate fresh sample HTML/PDF and focused render proof

## Non-Goals For M7

- new mandatory data providers
- article-body scraping or summarization
- new public app tab
- screener, terminal, or trading workflow
- letting the LLM decide issue structure
- restoring Market Overview, standalone Why It Matters, standalone What To Watch, Company/Event Notes, or visible Coverage Notes as main-flow sections

---

## M8 Execution Order

1. add a deterministic `PulseBriefFactPack`
2. classify each issue as quiet, normal, or event
3. compute daily delta and curiosity candidates from typed Pulse data
4. replace the customer-facing export renderer with the Morning Brief structure
5. add a strict six-field brief LLM contract and validator
6. hide empty optional modules without apology copy
7. render sources/method once in the footer
8. verify HTML/PDF compactness, page-break safety, and no raw internal labels

## Non-Goals For M8

- newspaper masthead/issue theater
- freestyle LLM report writing
- new data providers
- article-body scraping or summarization
- terminal, screener, broker, or trading workflow
- customer-facing provider debug labels or omitted-module apologies

---

## M9 Execution Order

1. preserve the current Pulse revamp work separately before touching Dexter
2. add the Dexter-native tool contract, safe runner, policy, evidence, and prompt-context helpers
3. add deterministic financial validator, evidence debate evaluator, and fixture-only recent context tools
4. wire the tools into Deep Dive generation as internal prompt context and conservative confidence limits
5. keep all tools disabled by default and optional at runtime
6. prove that no internal-only recent context leaks into customer report text
7. record proof under `Project Note/Phase7/Milestones/M9/evidence/`

## Non-Goals For M9

- importing TradingAgents-CN, last30days-skill, scientific-agent-skills, or other external repos
- live last30days calls
- Product API, contract, mobile, Docker, or public route changes
- new Pulse customer sections
- trading advice, price targets, broker flows, social-source customer copy, public lab, or terminal behavior
- treating M9 as the same thing as the existing `m9-due-diligence-*` prompt label

---

## M10 Execution Order

1. restore the preserved Pulse Morning Brief revamp work deliberately
2. expand `MarketPulseBriefEditorial` with richer narrative fields and mood
3. add deterministic narrative facts, one-thing selection, and per-name context to the Pulse brief fact pack
4. replace defensive fallback copy with declarative reader-facing copy
5. add an expanded Dexter Pulse editorial prompt with deterministic tension summary
6. overhaul the HTML/PDF renderer into adaptive quiet, normal, and event layouts
7. add The One Thing callout, sector strip, larger sparklines, and richer name cards
8. update render and contract tests
9. record proof under `Project Note/Phase7/Milestones/M10/evidence/`

## Non-Goals For M10

- new providers or article-body scraping
- LLM-selected facts, data values, sources, tickers, or section visibility
- broker, screener, terminal, trading, price-target, or execution workflow
- visible empty community-signal slots before approved data exists
- weakening omission-forward behavior or source discipline

---

## M11 Execution Order

1. add additive `filing_intelligence` contract on `AnalysisReport`
2. reuse SEC companyfacts/XBRL snapshots for QoQ, YoY, and annual filing comparisons
3. add bounded SEC filing-section text extraction utility with omission-forward behavior
4. build deterministic Dexter filing-intelligence fact rows and memo fallback
5. add guarded LLM filing analyst pass that can rewrite memo fields only
6. add Deep Dive PDF/HTML opening pages for Filing Read, What Changed, and Good / Bad / Interesting
7. keep mobile unchanged beyond opening/downloading the improved PDF
8. run contracts, data-openbb, Dexter, Product API export, typecheck, lint, and dependency guard proof
9. record proof under `Project Note/Phase7/Milestones/M11/evidence/`

## Non-Goals For M11

- Pulse changes
- Android screen rewrite
- new public route or app tab
- raw SEC filing dumps in customer output
- buy/sell/hold language, price targets, allocation, broker workflow, or quant-lab behavior
- LLM mutation of numbers, facts, tickers, sources, or provenance

---

## M12 Execution Order

1. add additive `financial_indicators` contract on `AnalysisReport`
2. build deterministic Dexter financial-indicator calculator
3. compute valuation ratios only when approved spot/reference price exists
4. compute profitability, growth, balance-sheet, cash-quality, and capital-allocation ratios from SEC/XBRL snapshots
5. create five-year trend rows with current, 1Y, 3Y, and 5Y values when annual history exists
6. classify the company through an explanatory value lens
7. render Financial Indicators & Value Lens plus 5-Year Trend Board pages in Deep Dive export
8. run contracts, Dexter, Product API export, typecheck, lint, and dependency guard proof
9. record proof under `Project Note/Phase7/Milestones/M12/evidence/`

## Non-Goals For M12

- Pulse changes
- new price provider integration
- scraped quote pages
- LLM-computed ratios
- trading advice, price targets, allocation, broker flow, or terminal behavior

---

## M13 Execution Order

1. extend `financial_indicators` with typed price provenance, TTM basis notes, benchmark rows, and investor education boxes
2. build true TTM flow metrics from the latest four quarterly snapshots while keeping latest balance-sheet fields for cash, debt, equity, assets, and shares
3. add ROIC, interest coverage, current/quick ratio, asset-turnover, gross-profit/assets, buyback/dividend/payout indicators when inputs exist
4. add reviewed benchmark context bands without claiming full peer-perfect comparability
5. update Deep Dive PDF/HTML pages to show price provenance, benchmark interpretation, and plain-English finance education
6. add proof cases for missing price and ugly-company value-trap behavior
7. record proof under `Project Note/Phase7/Milestones/M13/evidence/`

## Non-Goals For M13

- adopting a paid market-data provider
- scraping quote pages
- pretending reviewed benchmark bands are exact peer comps
- adding buy/sell/hold, target-price, allocation, broker, public lab, or terminal workflow language
- changing Pulse
