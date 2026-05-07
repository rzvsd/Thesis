# Thesis - Phase 7 PRD Addendum

**Version:** 1.0
**Status:** Living Document
**Last Revised:** 2026-05-04
**Owner:** Product Lead + Platform Architect

> This document extends `PRD.md`. It does not replace the base PRD.

---

## 1. Product Intent

Phase 7 improves Morning Exception Briefing by making the daily market backdrop easier to read on days when the most obvious changes are in broad indices, volatility, credit, rates, oil, or sector leadership.

The product intent is still:

- explain what changed
- explain why it matters
- keep the report bounded and trustworthy
- avoid dashboard theater

Phase 7 does **not** turn Thesis into a trading terminal, intraday monitor, or persona-driven market narrator.

---

## 2. What Changes In Product Terms

Morning Exception Briefing gains a new section:

- `market_tape`

It sits ahead of the other narrative sections because it gives the user the clearest first read on what the day looked like in markets before the report moves into official macro pressure, bounded context, and filing/event coverage.

`market_tape` is meant to answer:

- did the tape move broadly higher, lower, or mixed?
- which risk buckets led or lagged?
- did volatility, rates, credit, oil, or the dollar reinforce that move?
- was the day quiet enough that the honest read is "no material tape shift"?

---

## 3. What Still Does Not Change

- `market_moves` remains filing/event oriented
- Macro Stress remains the existing five-category model
- Deep Dive and War Room are not part of Phase 7 M1
- no new app tab or top-level market dashboard is introduced
- no user-facing backtest, debate, or terminal-style product surface is introduced

---

## 4. Source Policy

Phase 7 M1 uses a free-data policy:

- `FRED` is the approved production source for live tape retrieval in M1
- `Yahoo Finance` is excluded from production runtime and provenance
- `Alpha Vantage` is excluded from production runtime in M1

If exact free live coverage does not exist for a desired family, Thesis must say so explicitly instead of pretending the data exists.

As of M8, Pulse rendering uses the Morning Brief shape. The product promise is no longer "daily newspaper"; it is the few market, macro, and user-name facts that changed while the user was away. The issue must adapt to quiet, normal, and event days instead of forcing all days into the same density.

---

## 5. Commentary Rules

`market_tape` commentary must remain:

- short
- observational
- provenance-aware
- falsifiable

It must not contain:

- trade recommendations
- target language
- persona language
- sentiment theater
- exaggerated regime claims from one move alone

---

## 6. Rendering Rules

The Morning Exception Briefing render must show:

- compact one-day change displays
- a short tape summary paragraph
- compact leaders / laggards
- a clear coverage note when a family is omitted

The right rail stays focused on:

- Macro Stress
- structural backdrop
- coverage / method discipline

It must not become a mini-terminal.

## 10. M8 Morning Brief Reset

M8 resets the customer-facing Pulse export around a tighter daily reading experience:

- one-sentence Morning Line
- compact tape row
- deterministic change list
- one Interesting Bit
- user names only when real typed rows exist
- calendar and headlines only when real metadata exists
- Signal vs Noise always
- sources/method once in the footer

The brief may use optional LLM wording only for six short copy fields after deterministic facts and deltas exist. The LLM cannot choose sections, mutate facts, invent causality, add tickers, add sources, or create trading advice.

---

## 11. M11 Deep Dive Filing Intelligence Memo

M11 gives Deep Dive the same product-quality lift that Pulse received, but with a different center of gravity: SEC filings.

The Deep Dive export should answer:

- what changed in the latest 10-Q or 10-K?
- how did the company change versus the prior quarter, same quarter last year, and prior annual filing?
- did revenue, margins, cash flow, debt, share count, and segment mix tell the same story?
- did management language support or distract from the numbers?
- what needs confirmation in the next filing?

The first customer-visible win is PDF/HTML export quality. The Android app can keep using the existing Deep Dive open/download flow.

LLM commentary is allowed only after deterministic filing facts exist. The LLM explains the filing like a sharp analyst for a smart non-expert reader; it does not choose facts, mutate numbers, add sources, or provide trading advice.

---

## 11. M10 Pulse A+ Engagement Overhaul

M10 keeps the Morning Brief shape but makes it more readable and memorable:

- richer Morning Story
- deterministic narrative facts
- one memorable observation
- adaptive quiet/normal/event density
- richer user-name context
- sector strip and expanded sparklines where typed data exists
- evidence and method still in one footer

The M8 six-field/180-word LLM copy limit is superseded by a guarded 1500-word M10 limit. Normal/event issues target 150-210 words per visible narrative section so the report can explain, not merely label, each part of the morning. The LLM still cannot decide facts, mutate values, add sources, add tickers, infer unsupported causality, or create trading advice.

Quiet days are intentionally short. A brief that says "nothing moved the needle" is a valid output when the reviewed data supports it.

## 7. M2 Editorial Freshness

M2 adds an editorial issue layer to Pulse:

- headline
- dek
- lead
- issue contents
- what changed
- why it matters
- what to watch
- signal versus noise

The layer is deterministic and evidence-backed in M2. It does not use an LLM to invent prose.

The report should avoid stale daily repetition. Slow-moving structural or method context belongs in the story only when it changed, explains the day, or affects a coverage note.

`What To Watch` may use the existing earnings-calendar path for tracked issuers. This is separate from Market Tape and does not change the M1 provider lock for tape data.

---

## 8. M3 Morning Newspaper Edition

M3 makes Pulse easier to read in the first morning pass.

The issue may add:

- market board: compact daily index/cross-asset cards
- portfolio radar: watchlist-only stock rows
- today's catalysts: earnings and macro events worth watching
- headlines worth knowing: approved source headline/link/time only
- sector pulse: compact sector leadership/laggard strip when reviewed sector rows exist

These modules are not mandatory. If clean rows are missing, the module hides and the issue stays readable.

M3 does not add a public screener, terminal, live quote board, or headline scraping product. The goal is clarity, not market theater.

Headline digest policy:

- show source, headline, timestamp, and link
- do not ingest or reproduce article body text
- do not paraphrase article content unless a later milestone adds an approved summarization policy

Portfolio radar policy:

- use only portfolio/watchlist names
- show previous value, latest value, and daily change when supplied
- omit the module when rows are missing rather than inventing prices

---

## 9. M4 Macro News And Geopolitical Shock Layer

M4 makes Pulse aware of major macro and geopolitical headlines when approved inputs contain them.

It should answer:

- is there a normal, notable, or shock-level macro/geopolitical event?
- is the event merely reported, corroborated, or officially confirmed?
- which regions and asset buckets are affected?
- does this change the reader's interpretation of the market tape?

M4 does not make Pulse a breaking-news product. It does not scrape article bodies, reproduce article copy, or issue trading instructions.

If an event like a China/Taiwan conflict appears in approved sources, Pulse can show it as macro news and promote it into the issue framing. If no approved input exists, Pulse stays calm and does not infer the event from market movement alone.

---

## 10. M5 User Research State

M5 adds the persistent per-user analyst state behind Pulse personalization.

The state combines watchlist names, manual holdings, latest Deep Dive reports, thesis monitor freshness, latest global Pulse, market tape, macro stress, macro news, structural context, and official events when available.

Pulse should use this typed state for authenticated personalization instead of runtime text matching. Manual holdings are context only and must not imply brokerage connectivity, order management, or trading advice.

---

## 11. M7 Pulse Newspaper Template Revamp

M7 replaces the old planned-section stack with the compact newspaper template in `Project Note/Phase7/Milestones/implementation_plan.md`.

The reader-facing goal is simple: a person should be able to read Pulse with coffee in the morning and understand:

- what the market did
- what actually changed from the prior issue
- what matters for their tracked names
- what is on today's calendar
- which approved headlines matter
- what is noise
- where evidence and coverage limits live

M7 adds an internal `PulseIssuePlan` that decides module order and visibility. This keeps the report professional while preserving deterministic data ownership.

Main-flow modules should be:

1. Masthead
2. The Tape
3. What Changed
4. Your Names, only when watchlist/holding rows exist
5. Today's Calendar, only when dated items exist
6. Headlines Worth Knowing, only when approved headline metadata exists
7. Signal vs Noise
8. The Backdrop
9. Footer sources and method

The following should not appear as standalone main-story cards in editorial Pulse:

- Market Overview
- Why It Matters
- What To Watch
- Company / Event Notes
- Coverage Notes
- visible Method card
- daily Structural Context
- repeated inline evidence blocks
- bounded context
- canonical events
- macro releases
- rates / FX / commodities matrix
- news summary

Their useful evidence can still feed The Tape, What Changed, The Backdrop, or the footer. The goal is not to delete data; it is to stop presenting implementation anatomy as customer copy.
