# Thesis - Phase 7 Milestone Briefs

**Version:** 1.0  
**Status:** Active (M8 active; M1-M7 validated)
**Owner:** Engineering Lead + Product Lead  
**Last Revised:** 2026-05-01
**Related Documents:** `ph7_BLUEBOOK.md`, `ph7_PRD.md`, `ph7_ROADMAP.md`, `PH7_DECISION_LOCKS.md`

---

## How to Read This Document

Phase 7 begins after the Phase 6 substrate closeout. The Phase 7 pack is the current planning and doctrine layer for Pulse work. Earlier phase docs remain historical unless this pack explicitly points back to them.

Current milestone state is tracked in `ph7_ROADMAP.md`. As of 2026-05-01, M1-M7 have implementation evidence recorded and M8 is the active Pulse Morning Brief reset.

Proof for each milestone lives under:

```text
Project Note/Phase7/Milestones/M#/evidence/
```

---

## Milestone Index

| # | Name | What it produces |
|---|---|---|
| M1 | Pulse Market Tape & Clear Daily Context | Adds a free-data `market_tape` layer to Morning Exception Briefing so the report can explain daily market moves with clearer provenance, bounded commentary, and omission-forward fallback behavior |
| M2 | Pulse Editorial Freshness & Daily Delta | Adds an additive editorial issue layer so Pulse explains what changed, why it matters, what to watch, and what is signal versus noise without repeating stale context |
| M3 | Pulse Morning Newspaper Edition & Portfolio Radar | Adds reader-friendly morning modules for market board, portfolio radar, catalysts, headline digest, and sector pulse while hiding unavailable modules cleanly |
| M4 | Pulse Macro News & Geopolitical Shock Layer | Adds approved-source macro/geopolitical headline classification, severity, corroboration, and shock promotion without article-body scraping or trading calls |
| M5 | User Research State & Analyst Refresh Agent | Adds the persistent per-user analyst state that correlates watchlists, manual holdings, Deep Dive, Pulse, monitor freshness, and official context into typed personalization |
| M6 | Guarded LLM Pulse Editorial Writer | Adds an optional OpenRouter copy-editing layer that rewrites deterministic Pulse narrative without mutating facts, provenance, tickers, prices, or events |
| M7 | Pulse Newspaper Template Revamp | Replaces the old 13-module issue idea with the compact newspaper template: Tape, Changed, Names, Calendar, Headlines, Signal/Noise, Backdrop, and footer sources |
| M8 | Pulse Morning Brief Reset | Replaces newspaper-style rendering with a compact quiet/normal/event Morning Brief, deterministic daily delta, one useful insight, optional user/calendar/headline modules, and a strict six-field LLM copy contract |

---

# M1_Pulse Market Tape & Clear Daily Context

## Goal

Add a free-data market-tape substrate to Pulse so the briefing can explain daily market movement with clearer signal, clearer provenance, and omission-forward fallback behavior.

**Plain English:** Keep Morning Exception Briefing useful on days when filings and macro releases are quiet by giving it a disciplined read on the tape rather than letting it drift into filler.

## Deliverables

| Deliverable | Description |
|---|---|
| `MarketTapePack` contract | Additive market-tape contract with indices, cross-asset context, sector leadership, retrievals, and omissions |
| `data-openbb` tape endpoint | `GET /v1/market/tape?scope=daily&as_of=YYYY-MM-DD` |
| Pulse assembly update | `market_tape` becomes the first section in Morning Exception Briefing |
| Pulse renderer update | HTML/PDF export shows compact one-day tape changes, leaders/laggards, and coverage note |
| Omission-forward provider behavior | FRED-primary free runtime with explicit omission truth where free live coverage is incomplete |
| Evidence and smoke proof | Contract tests, adapter tests, Pulse tests, render proof, and end-to-end smoke evidence |

## Locked M1 Interface Plan

| Area | Locked shape |
|---|---|
| New contract | `packages/contracts/src/market-tape.ts` with `MarketTapePack`, `MarketTapeMove`, and `MarketTapeSectorLeadership` |
| Pulse contract extension | `MarketPulseReport` may add optional top-level `market_tape`; `MarketPulseSections` requires `market_tape` |
| Adapter endpoint | `GET /v1/market/tape?scope=daily&as_of=YYYY-MM-DD` on `data-openbb` |
| Pulse behavior | `market_tape` is a new section, not a replacement for `market_moves` |
| Commentary limit | Max 4 sentences in one short paragraph |

## Locked Product Behavior

- `market_tape` appears first in the main report column.
- `market_moves` stays filing/event oriented.
- `market_tape` explains the day without turning Pulse into a market terminal.
- Commentary stays observational, bounded, and falsifiable.
- On quiet days, the section may explicitly say there was no material tape shift.
- No new app tab, dashboard, or terminal-style workflow is introduced.

## Locked Free-Data Policy

- **FRED is the approved production source for M1 live market-tape retrieval.**
- **Yahoo Finance is not allowed in production runtime or user-facing provenance.**
- **Alpha Vantage is not allowed in M1 production runtime.**
- If exact desired coverage is unavailable in the approved free live path, the system must degrade with omission truth instead of silent substitution.

## Locked M1 Source Scope

Core indices:

- S&P 500
- Dow Jones Industrial Average
- Nasdaq Composite
- Russell 2000

Cross-asset scope:

- VIX
- 10Y Treasury daily move
- 2Y Treasury daily move
- WTI daily move
- broad dollar index proxy
- high-yield spread or high-yield stress proxy

Sector basket:

- `XLB`, `XLE`, `XLF`, `XLI`, `XLK`, `XLP`, `XLRE`, `XLU`, `XLV`, `XLY`

Sector behavior:

- top 3 leaders
- bottom 3 laggards
- explicit omission truth if free live coverage is unavailable

## Acceptance Criteria

- [ ] `MarketTapePack` validates in full, partial, and limited coverage states
- [ ] `data-openbb` returns a contract-valid `market_tape` payload for `scope=daily`
- [ ] Pulse stores and serves the new `market_tape` section without changing Macro Stress contracts
- [ ] `market_tape` appears as the first main-column section in HTML/PDF export
- [ ] Commentary remains bounded and contains no trading-language drift
- [ ] FRED-backed coverage is visible with retrieval metadata and omission truth
- [ ] Yahoo and Alpha Vantage do not appear in production runtime or user-facing provenance for M1
- [ ] Replay-safe `as_of` behavior does not leak future observations

## Smoke Test

```text
Step 1: Start product-api, data-openbb, news-ingest, dexter-worker, and scheduler
Step 2: Request /v1/market/tape for a fixed as_of date
Step 3: Confirm - contract-valid payload, retrieval metadata, and omission truth are returned
Step 4: Trigger one Morning Exception Briefing run
Step 5: Confirm - market_tape appears first and market_moves remains filing-oriented
Step 6: Render HTML and PDF
Step 7: Confirm - one-day changes, leaders/laggards, and coverage note display cleanly
Step 8: Run one replayed Pulse with historical as_of
Step 9: Confirm - no look-ahead leakage
Step 10: Run dependency checks for forbidden provider leakage
Step 11: Confirm - Yahoo and Alpha Vantage do not appear in protected runtime paths or provenance
```

## Success

Morning Exception Briefing gets clearer daily signal without losing Thesis discipline.

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Tape commentary becomes filler or market-TV tone | Report review shows terminal-style narration or obvious hype language | Pulse loses product identity |
| Free-provider gaps are silently substituted | Provenance review shows hidden fallback or unlabeled proxy use | Trust degrades quickly |
| `market_moves` and `market_tape` blur together | Output repeats the same facts in both sections | Pulse becomes noisy |
| Market tape widens Macro Stress semantics | Contract diff or report review shows Macro Stress doing tape work | Product meaning drifts |

## Rollback

Disable `market_tape` generation and rendering while leaving additive contracts in place. Do not reactivate Yahoo or paid providers as a rollback shortcut.

## Dependencies

- Phase 6 closed
- Existing Morning Exception Briefing path remains healthy
- Product/API render path accepts additive section changes

## Owner

Product API Owner + Data Platform Engineer + Product Lead

---

# M2_Pulse Editorial Freshness & Daily Delta

## Goal

Add an editorial layer to Pulse so every issue reads like a daily financial briefing rather than a repeated data dump.

**Plain English:** Preserve the reviewed data model, but make the customer-facing issue explain what actually changed today, why it matters, and what the reader should watch next.

## Deliverables

| Deliverable | Description |
|---|---|
| Editorial issue contract | Add optional `editorial_issue` to `MarketPulseReport` with headline, dek, lead, issue contents, freshness state, watch items, and coverage notes |
| Editorial sections | Add optional `what_changed`, `why_it_matters`, `what_to_watch`, and `signal_vs_noise` sections |
| Prior Pulse comparison | Compare the current Pulse with the prior stored Pulse when available; use a clean baseline note when no prior Pulse exists |
| Calendar-backed watch items | Use the existing earnings-calendar path for tracked issuers as a watch-next input, separate from Market Tape provenance |
| Conditional rendering | Hide stale/static context from the main flow unless it changed or explains the day |
| Clean customer language | Translate internal status labels into plain coverage language |

## Locked M2 Interface Plan

| Area | Locked shape |
|---|---|
| New contract | `MarketPulseEditorialIssue` is additive and optional |
| Pulse report extension | `MarketPulseReport.editorial_issue?: MarketPulseEditorialIssue` |
| Section additions | `what_changed`, `why_it_matters`, `what_to_watch`, and `signal_vs_noise` are optional `ReportSection`s |
| Prior comparison | Product API reads the latest stored Pulse before writing the new one |
| Calendar input | Earnings calendar can support `what_to_watch`; it is not Market Tape provenance |

## Locked Product Behavior

- Pulse opens like a newsletter/newspaper issue.
- `market_tape` remains the lead story.
- `what_changed` explains delta from the prior Pulse or says this is a baseline issue.
- `why_it_matters` explains consequence without trade language.
- `what_to_watch` uses issuer calendar items when available and falls back to tape/macro watch points when not.
- `signal_vs_noise` separates confirmed movement from one-day overreach.
- Static structural context, method, and raw coverage states do not occupy the main story flow unless material.

## Acceptance Criteria

- [ ] `MarketPulseReport` validates with and without `editorial_issue`
- [ ] Product API produces a baseline editorial issue when no prior Pulse exists
- [ ] Product API produces a daily delta when a prior Pulse exists
- [ ] Earnings-calendar watch items appear when available
- [ ] Calendar unavailability degrades with a compact coverage note
- [ ] HTML/PDF render `market_tape`, `what_changed`, `why_it_matters`, `what_to_watch`, and `signal_vs_noise`
- [ ] Customer copy does not expose raw `data_incomplete`, `bounded_context`, or debug/provider labels
- [ ] No new app tab, terminal surface, trading workflow, or LLM dependency is introduced

## Smoke Test

```text
Step 1: Generate a first Pulse run for a fixed cycle date.
Step 2: Confirm - editorial issue says it is a baseline issue.
Step 3: Generate a second Pulse run for the next cycle date.
Step 4: Confirm - what_changed compares against the prior Pulse.
Step 5: Provide an earnings calendar event inside the 7-day watch window.
Step 6: Confirm - what_to_watch renders the event cleanly.
Step 7: Disable calendar access.
Step 8: Confirm - Pulse still renders with a coverage note and no broken section.
Step 9: Export HTML/PDF.
Step 10: Confirm - the issue reads as an editorial briefing and does not show raw internal status labels.
```

## Rollback

Stop generating `editorial_issue` and editorial sections while keeping the additive contract fields. The renderer falls back to the M1 deterministic Pulse layout.

## Owner

Product API Owner + Product Lead

---

# M3_Pulse Morning Newspaper Edition & Portfolio Radar

## Goal

Make Pulse read more like a morning financial newspaper issue: easier to scan at coffee, less technical on the surface, and still evidence-backed underneath.

**Plain English:** Keep the M1/M2 data discipline, but add the missing daily newspaper furniture: market board, portfolio radar, catalysts, selected headlines, and sector pulse.

## Deliverables

| Deliverable | Description |
|---|---|
| Morning edition contract | Add optional `morning_edition` to `MarketPulseReport` |
| Reader modules | Add optional `market_board`, `portfolio_radar`, `today_catalysts`, `headline_digest`, and `sector_pulse` sections |
| Portfolio radar | Render only portfolio/watchlist rows supplied to Pulse; do not create a public stock screener |
| Headline digest | Render approved source headline, source, time, and link only; no scraped article body |
| Catalyst block | Use earnings-calendar and canonical macro events as readable watch items |
| Newspaper renderer | Update HTML/PDF export so the issue is readable without raw internal labels |

## Locked M3 Interface Plan

| Area | Locked shape |
|---|---|
| New contract | `MarketPulseMorningEdition` in `packages/contracts/src/market-pulse-morning-edition.ts` |
| Report extension | `MarketPulseReport.morning_edition?: MarketPulseMorningEdition` |
| Optional sections | `market_board`, `portfolio_radar`, `today_catalysts`, `headline_digest`, `sector_pulse` |
| Runtime behavior | modules with no clean data are hidden, not rendered as broken-looking placeholders |

## Locked Product Behavior

- Pulse remains one briefing issue, not a dashboard.
- No new app tab, market terminal, screener, or intraday workflow is introduced.
- Screenshot ideas inform structure only; colors and brand styling stay Thesis-native.
- Portfolio radar is portfolio/watchlist-only.
- Headline digest displays headline/source/link/time only and does not ingest or reproduce article bodies.
- Customer-facing copy must avoid raw labels such as `data_incomplete`, `bounded_context`, and provider debug text.

## Acceptance Criteria

- [ ] `MarketPulseReport` validates with and without `morning_edition`
- [ ] Product API builds `morning_edition` without changing Market Tape provider locks
- [ ] HTML/PDF render market board, portfolio radar, catalysts, headlines, and sector pulse when data is present
- [ ] Missing headline/radar/sector rows hide cleanly or appear only as coverage notes, not broken cards
- [ ] No Yahoo or Alpha Vantage runtime dependency is added for Market Tape
- [ ] No scraped article body or copyrighted article text appears in Pulse output

## Smoke Test

```text
Step 1: Build a Pulse fixture with market tape, portfolio radar rows, approved headlines, catalysts, and sector rows.
Step 2: Validate the contract.
Step 3: Render HTML/PDF.
Step 4: Confirm - market board appears near the top.
Step 5: Confirm - portfolio radar shows only supplied watchlist names.
Step 6: Confirm - headlines show source/link only, not article body.
Step 7: Confirm - no raw internal labels leak into customer copy.
Step 8: Run Product API and contract tests.
```

## Rollback

Stop populating `morning_edition` and the optional reader modules. M2 editorial Pulse remains intact.

---

# M4_Pulse Macro News & Geopolitical Shock Layer

## Goal

Make Pulse capable of accounting for major macro and geopolitical news when approved headline inputs contain it.

**Plain English:** If a major event like a Taiwan conflict headline appears in approved sources, Pulse should not treat the morning as a normal market-tape day. It should label the event, show confirmation state, and explain why it changes the risk context.

## Deliverables

| Deliverable | Description |
|---|---|
| Macro news contract | Add `MarketPulseMacroNewsPack` and `MarketPulseMacroNewsItem` |
| Product API classifier | Build macro/geopolitical news state from explicit macro-news inputs and approved headline rows |
| Shock promotion | Promote shock-level macro/geopolitical items into the Pulse issue flow |
| Renderer section | Add `macro_news` section with severity and confirmation state |
| Safety policy | Headline/link/time/source only; no article-body scraping, no trading language |

## Locked M4 Interface Plan

| Area | Locked shape |
|---|---|
| New contract | `packages/contracts/src/market-pulse-macro-news.ts` |
| Report extension | `MarketPulseReport.macro_news?: MarketPulseMacroNewsPack` |
| Section extension | `MarketPulseSections.macro_news?: ReportSection` |
| States | `calm`, `watch`, `shock` |
| Confirmation | `reported`, `corroborated`, `official_confirmed` |

## Locked Product Behavior

- Macro/geopolitical news can change the Pulse lead only when it is notable or shock-level.
- Shock-level reported headlines must show confirmation state.
- Pulse must distinguish `reported` from `corroborated` and `official_confirmed`.
- Headlines remain headline/link/time/source only.
- No article-body scraping or article-body summarization is introduced.
- No trading calls, price targets, or tactical advice are introduced.

## Acceptance Criteria

- [ ] `MarketPulseReport` validates with and without `macro_news`
- [ ] Product API builds calm macro-news state when no approved macro/geopolitical headline exists
- [ ] Product API builds shock state from approved shock-level inputs
- [ ] Renderer shows macro news, severity, source count, and confirmation state
- [ ] Shock state appears in the issue contents and lead framing
- [ ] No article body text is required or rendered

## Rollback

Stop populating `macro_news` and omit `sections.macro_news`. M3 morning edition remains intact.

---

# M5_User Research State & Analyst Refresh Agent

## Goal

Build the persistent analyst layer that keeps each user's research context current across watchlist names and manual holdings, then feeds Pulse personalization from that maintained state.

**Plain English:** Thesis keeps a typed research state for each user so Pulse can know what the user follows without turning the global Pulse artifact into a per-user report cache or falling back to brittle text matching.

## Deliverables

| Deliverable | Description |
|---|---|
| User research contracts | Add `UserResearchState`, `UserResearchNameState`, `UserResearchHolding`, `UserResearchDailyDelta`, `UserResearchOmission`, and `UserResearchEvidenceRef` |
| Product API storage | Add current-state and manual-holdings persistence for in-memory and Postgres stores |
| Manual holdings API | Add authenticated CRUD for user-declared holdings, without brokerage, execution, or order flow |
| Internal refresh route | Add `POST /internal/research-state/refresh`, protected by the existing internal token |
| Pulse personalization refactor | Replace regex-based `watchlist_overlay` runtime personalization with typed `UserResearchState` consumption |
| Compatibility bridge | Keep old optional Pulse contract fields compatible while moving runtime ownership to user research state |
| Evidence pack | Add refresh, personalized Pulse, export, refactor, and focused test proof under the M5 evidence folder |

## Locked M5 Interface Plan

| Area | Locked shape |
|---|---|
| New contract | `UserResearchState` is the owner of user-specific analyst context |
| Name state | Each watched/held ticker gets a `UserResearchNameState` or an explicit omission |
| Manual holdings | Holdings include ticker plus optional quantity, cost basis, label, and notes |
| Refresh route | `POST /internal/research-state/refresh` accepts `as_of`, `user_ids`, and `dry_run` |
| Pulse attachment | Authenticated Pulse read paths attach latest user research state; global stored Pulse remains global |
| Legacy fields | Old optional personalization fields can remain in contracts for compatibility but must not drive runtime personalization |

## Locked Product Behavior

- User scope is watchlist plus manual holdings.
- Manual holdings are self-declared research context only.
- No brokerage connection, trading workflow, order flow, or execution language is introduced.
- No LLM generation is introduced in M5.
- No WhatsApp, push-alert, Q&A, screener, or terminal-style workflow is introduced.
- `thesis_monitor_snapshots` remains an input/cache for M5 and is not deleted.
- Missing Deep Dive, monitor, Pulse, macro, calendar, or event inputs produce omissions instead of filler.
- Customer copy stays bounded: no buy/sell/hold calls, no price targets, no fake precision from one-day moves.
- Regex-based `watchlist_overlay` personalization is removed from runtime retrieval.

## Analyst Refresh Behavior

The refresh job combines:

- watchlist tickers
- manual holdings tickers
- latest Deep Dive report per ticker
- thesis monitor snapshot/freshness
- latest global Pulse
- market tape, macro stress, macro news, structural context when present in Pulse
- canonical events and calendar events

Refresh output is deterministic:

- baseline state when no prior user state exists
- daily delta when prior user state exists
- omission-forward state when key inputs are missing

Delta states are locked to:

- `unchanged`
- `new_event`
- `macro_context_changed`
- `thesis_freshness_changed`
- `coverage_changed`
- `needs_deep_dive_refresh`

## Acceptance Criteria

- [ ] M5 docs define User Research State as the stateful analyst layer
- [ ] `UserResearchState` validates with complete, partial, baseline, and omission-heavy data
- [ ] Manual holdings are supported without brokerage integration
- [ ] Internal refresh creates and updates user research state for a user with multiple names
- [ ] Every watchlist/holding ticker has either a name state or explicit omission
- [ ] Prior-state comparison creates daily deltas on later refreshes
- [ ] Authenticated Pulse consumes latest user research state for personalization
- [ ] Global Pulse remains cacheable and non-user-specific
- [ ] Regex-based `watchlist_overlay` personalization is removed from runtime use
- [ ] Missing inputs produce omissions, not filler
- [ ] No trading advice, execution language, or terminal workflow is introduced
- [ ] Evidence folder contains refresh proof, personalized Pulse proof, export proof, refactor proof, and test output proof

## Smoke Test

```text
Step 1: Start Product API and required local dependencies.
Step 2: Create a test user with watchlist names and at least one manual holding.
Step 3: Ensure one Deep Dive artifact and one global Pulse artifact exist.
Step 4: Run POST /internal/research-state/refresh with fixed as_of.
Step 5: Confirm - a contract-valid UserResearchState is stored.
Step 6: Confirm - every watchlist/holding ticker has either a name state or explicit omission.
Step 7: Run a second refresh with changed fixture inputs.
Step 8: Confirm - daily deltas compare against the prior state.
Step 9: Retrieve /pulse/latest as the authenticated user.
Step 10: Confirm - Pulse personalization comes from UserResearchState, not regex text matching.
Step 11: Export Pulse HTML/PDF.
Step 12: Confirm - customer copy is readable, personalized, evidence-backed, and free of raw debug labels.
Step 13: Confirm - no new app tab, WhatsApp, Q&A endpoint, screener, broker connection, or trading workflow exists.
```

## Failure Modes

| What breaks | How we detect it | Impact |
|---|---|---|
| Global Pulse becomes per-user | Store review shows user-specific report artifacts replacing global Pulse | Cacheability and product semantics drift |
| Regex personalization survives | Runtime scan finds `withWatchlistOverlay` or `watchlist_overlay` read-path use | Brittle personalization remains |
| Holdings imply brokerage integration | API or UI suggests execution, positions from broker, or trade actions | Product crosses into execution territory |
| Missing inputs become filler | Personalized sections invent context without Deep Dive/monitor/Pulse evidence | Trust degrades |
| Analyst state becomes LLM prose | Refresh path depends on model output instead of deterministic typed assembly | M5 scope expands and becomes hard to verify |

## Rollback

Disable the internal refresh route and authenticated Pulse state attachment while leaving additive contracts and tables in place. Keep manual holdings inert and continue serving global Pulse without user personalization. Do not restore regex-based `watchlist_overlay` runtime personalization as a rollback shortcut.

## Dependencies

- Phase 7 M1-M4 Pulse substrate remains healthy
- Existing auth and internal-token guard remain healthy
- Watchlist, report metadata, artifact store, calendar, canonical events, and thesis monitor stores remain available

## Owner

Product API Owner + Reasoning / ML Engineer + Product Lead

---

# M6_Guarded LLM Pulse Editorial Writer

## Goal

Add an optional LLM editorial writer for Pulse that turns deterministic Pulse and `UserResearchState` into a more readable morning briefing while preserving evidence, provenance, and product doctrine.

**Plain English:** Let an LLM improve how Pulse reads, but never let it become the source of market facts, user facts, ratings, prices, or trading instructions.

## Deliverables

| Deliverable | Description |
|---|---|
| OpenRouter client | Add a small Product API OpenRouter chat-completions client with timeout and sanitized errors |
| Editorial writer | Build a guarded writer that receives only a whitelisted evidence pack from deterministic Pulse and user research state |
| Policy validator | Reject malformed JSON, trading language, unsupported tickers, and unsupported claims |
| Contract metadata | Add optional `editorial_generation` metadata to `MarketPulseReport` |
| Runtime wiring | Apply the writer on authenticated Pulse retrieval after user personalization |
| Evidence export | Generate JSON/HTML/PDF from a mocked OpenRouter response |

## Locked Interface Plan

| Area | Locked shape |
|---|---|
| Provider | OpenRouter only for M6 |
| Default state | `PULSE_LLM_EDITORIAL_ENABLED=false` |
| Output surface | Narrative/editorial fields only |
| Fallback | Deterministic Pulse is returned when disabled, unavailable, invalid, or rejected |
| Metadata | `editorial_generation` records mode/status/provider/model/prompt version without exposing secrets |

## Locked Product Behavior

- Deterministic Pulse remains authoritative.
- LLM output cannot mutate market tape values, Macro Stress, provenance, sources, user research state, tickers, events, or prices.
- No buy/sell/hold language, price targets, execution instructions, or terminal-style signals.
- No new app tab, Q&A endpoint, broker connection, screener, WhatsApp workflow, or public lab surface.
- No secrets in docs, tests, logs, generated artifacts, or committed env files.

## Acceptance Criteria

- [ ] Product API builds with LLM editorial config disabled by default
- [ ] Contract validates with and without `editorial_generation`
- [ ] Valid OpenRouter JSON can update editorial narrative fields
- [ ] Disabled, missing-key, malformed JSON, provider error, timeout, and policy-failed output fall back to deterministic Pulse
- [ ] LLM cannot add unsupported tickers or trading advice
- [ ] HTML/PDF exports render the LLM-edited issue without raw debug/provider noise
- [ ] No secrets are committed

## Smoke Test

```text
Step 1: Generate or load a deterministic Pulse with UserResearchState.
Step 2: Enable the LLM editorial writer with a mocked OpenRouter response.
Step 3: Confirm - editorial narrative changes and editorial_generation metadata is present.
Step 4: Render HTML/PDF.
Step 5: Confirm - report remains readable, evidence-backed, and free of trading language.
Step 6: Return malformed JSON.
Step 7: Confirm - deterministic Pulse is returned.
Step 8: Return buy/sell/hold language.
Step 9: Confirm - deterministic Pulse is returned.
```

## Rollback

Set `PULSE_LLM_EDITORIAL_ENABLED=false`. The deterministic Pulse path remains intact and no generated data tables need to be rolled back.

---

# M7_Pulse Issue Plan & Professional Newspaper Polish

## Goal

Replace the prior 13-module Pulse issue plan with the compact newspaper template defined in `Project Note/Phase7/Milestones/implementation_plan.md`.

**Plain English:** Keep the data, but stop showing the plumbing. Pulse should open with the tape, the real daily delta, relevant user names, the calendar, approved headlines, signal versus noise, and one compact backdrop line.

## Deliverables

| Deliverable | Description |
|---|---|
| PulseIssuePlan | Add an internal deterministic issue plan that owns the new strict hierarchy and quiet-day behavior |
| Newspaper renderer | Render Masthead, The Tape, What Changed, Your Names, Today's Calendar, Headlines Worth Knowing, Signal vs Noise, The Backdrop, and footer sources |
| Old-idea cleanup | Remove the old visible Market Overview, standalone Why It Matters, standalone What To Watch, Company/Event Notes, Coverage Notes card, visible Method card, and daily Structural Context card from the main flow |
| Footer evidence | Move evidence and limitations into one footer source/method area |
| Render polish | Tighten typography, reduce dense technical language, and improve PDF page-break rules |
| Evidence export | Generate refreshed HTML/PDF proof using the planned issue flow |

## Locked Interface Plan

| Area | Locked shape |
|---|---|
| Contract impact | No new public contract in M7 |
| Source of truth | Deterministic Pulse remains authoritative |
| Issue structure | Internal `PulseIssuePlan` controls the new newspaper order |
| LLM role | Copy polish only after issue planning; quiet days bypass the LLM |
| Legacy sections | Useful evidence may feed Tape, Changed, Backdrop, or footer, but weak technical cards do not render as main sections |

## Locked Product Behavior

- Pulse stays a research and conviction briefing, not a terminal or screener.
- The Tape is the first story and absorbs market-board/cross-asset/sector context.
- What Changed collapses to a one-line no-material-change note when appropriate.
- Portfolio Radar appears only when typed watchlist/holding rows exist.
- Today's Calendar appears only when real dated catalysts exist.
- Headlines are metadata only: headline, source, link, time.
- Coverage notes and method move to the footer.
- Evidence appears once in the footer, not inline across repeated sections.
- Raw labels such as `data_incomplete`, `bounded_context`, and provider debug wording must not leak into the report.

## Acceptance Criteria

- [ ] `PulseIssuePlan` produces a stable issue order for editorial Pulse
- [ ] Renderer outputs only the new newspaper hierarchy
- [ ] The Tape renders daily market board, equity breadth, leadership, and cross-asset read
- [ ] Weak legacy sections are hidden from main editorial flow
- [ ] Coverage notes move to the footer in plain language
- [ ] Inline evidence blocks are not repeated across sections
- [ ] HTML/PDF exports use smaller text and page-break rules to reduce orphaned headings
- [ ] Focused render test proves the new structure and no raw internal labels
- [ ] No new provider, app tab, terminal workflow, screener, or trading advice is introduced

## Smoke Test

```text
Step 1: Load a Pulse report with market tape, morning edition, editorial issue, and macro news.
Step 2: Build the internal issue plan.
Step 3: Confirm - Tape, What Changed, Your Names, Calendar, Headlines, Signal vs Noise, and Backdrop are ordered intentionally.
Step 4: Confirm - weak legacy sections are not rendered as main cards.
Step 5: Render HTML/PDF.
Step 6: Confirm - report is readable, smaller, and free of raw internal labels.
Step 7: Confirm - no repeated inline evidence, visible method card, trading language, or terminal workflow appears.
```

## Rollback

Re-enable the previous renderer only as an emergency path. Do not restore the 13-module issue model, repeated inline evidence, raw customer-facing status labels, or weak filler sections.
