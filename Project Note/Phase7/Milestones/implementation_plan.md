# Pulse Newspaper Template — Blueprint & Implementation Plan

## The Problem

Today's Pulse generates a **37KB HTML document** with **1,288 lines** of markup for what should be a **3-minute morning read**. The underlying data JSON is **75KB** with massive evidence repetition. Two consecutive days produce nearly identical output because:

1. **Macro context never changes** — CPI, unemployment, GDP are monthly/quarterly releases. Repeating them daily is noise.
2. **Structural context never changes** — World Bank observations (GDP level, population, Gini) update annually. They appear in full every day.
3. **Evidence blocks repeat identically** across 5+ sections — the same 4 FRED index citations appear in What Changed, Why It Matters, What To Watch, Signal vs Noise, and the lead story.
4. **The LLM rewrites the same 6 deterministic sentences** because there's nothing genuinely new to write about.
5. **Sections that should be empty show up with filler** — "No approved headline digest was supplied", "Portfolio radar was omitted" are confessions of missing data, not content.

> [!CAUTION]
> The current output is **a data-dump wearing newspaper CSS**, not a newspaper. The reader gets 1,288 lines where ~200 would suffice. This is the core UI/editorial problem.

---

## What a Newspaper Actually Is

A newspaper front page answers five questions in descending importance:

| Priority | Question | Newspaper Term | Time to Read |
|----------|----------|----------------|--------------|
| 1 | **What happened?** | Headline + lede | 15 seconds |
| 2 | **Why does it matter to me?** | Nut graf | 30 seconds |
| 3 | **What's the context?** | Background graf | 30 seconds |
| 4 | **What should I watch?** | Look-ahead | 20 seconds |
| 5 | **What's the evidence?** | Sources | On-demand |

Total: **under 3 minutes**. Everything else is a deep-read section the reader can skip.

---

## Proposed Pulse Template

### Section Hierarchy (7 sections, strict order)

```
┌─────────────────────────────────────────────┐
│  MASTHEAD (fixed)                           │
│  Date · Issue # · Ticker strip              │
├─────────────────────────────────────────────┤
│  ① THE TAPE  (always, 3-4 sentences)        │
│  What happened to markets yesterday.        │
│  Bar chart. One paragraph. Done.            │
├─────────────────────────────────────────────┤
│  ② WHAT CHANGED  (conditional)              │
│  Only appears if delta > threshold.         │
│  Compared to previous issue, explicitly.    │
├─────────────────────────────────────────────┤
│  ③ YOUR NAMES  (conditional)                │
│  Portfolio/watchlist radar table.            │
│  1-day and 5-day change. Why it moved.      │
│  OMIT ENTIRELY if no watchlist supplied.     │
├─────────────────────────────────────────────┤
│  ④ TODAY'S CALENDAR  (conditional)           │
│  CPI time, Fed speakers, earnings.          │
│  OMIT ENTIRELY if no events today.          │
├─────────────────────────────────────────────┤
│  ⑤ HEADLINES WORTH KNOWING  (conditional)   │
│  3-5 curated headlines from approved feeds. │
│  Source + one-sentence summary + link.      │
│  OMIT ENTIRELY if no fresh headlines.       │
├─────────────────────────────────────────────┤
│  ⑥ SIGNAL VS NOISE  (always, 2 bullets)     │
│  Signal: one sentence.                      │
│  Noise: one sentence.                       │
├─────────────────────────────────────────────┤
│  ⑦ THE BACKDROP  (suppressed if unchanged)  │
│  Macro regime + structural only when        │
│  something materially changed.              │
│  Otherwise: "Macro regime: elevated.        │
│  No change from previous issue."            │
├─────────────────────────────────────────────┤
│  FOOTER (fixed)                             │
│  Method · Sources · Disclaimer              │
│  Evidence links (collapsed/on-demand)       │
└─────────────────────────────────────────────┘
```

### What Gets Killed

| Current Section | Verdict | Reason |
|----------------|---------|--------|
| Lead Story (5+ paragraphs) | **Compress to 3-4 sentences** | Nobody reads 5 paragraphs about "the tape was higher" |
| Market Overview | **Merge into The Tape** | Redundant with lead story |
| Why It Matters | **Kill as standalone** | Fold the one useful sentence into The Tape or What Changed |
| Macro Regime (5 paragraphs) | **Compress or suppress** | Only show when regime *changes*. One line otherwise. |
| Company/Event Notes | **Kill** | "Issuer filing coverage: AAPL, MSFT, TSLA" is not a story |
| Coverage Notes | **Kill as visible section** | Move to footer metadata |
| Method card | **Collapse** | One line in footer, not a section |
| Evidence blocks (×5) | **Collapse all** | One "Sources" section at bottom, not inline per section |
| Structural Context | **Kill from daily** | Annual data does not belong in a daily briefing |

---

## Data Inputs — What Each Section Needs

### ① The Tape (always present)

```typescript
interface TapeSection {
  // FROM: market_tape (FRED via data-openbb)
  indices: Array<{
    label: string;           // "S&P 500"
    value: number;           // 5484.77
    change_pct: number;      // +2.03
    direction: "up" | "down" | "flat";
  }>;  // max 4
  
  // FROM: market_tape.cross_asset
  cross_asset_summary: string;  // "VIX -4.3%, 10Y -2.5%, credit +2.0%"
  
  // FROM: market_tape.sector_leadership
  sector_leaders: string[];     // ["XLE +3.1%", "XLK +2.2%"]
  sector_laggards: string[];    // ["XLU -0.6%", "XLP -0.5%"]
  
  // LLM WRITES: 3-4 sentence narrative
  narrative: string;
}
```

**Freshness rule:** Always fresh — market tape changes daily by definition.

**Word budget:** 80 words max for narrative. The chart does the heavy lifting.

### ② What Changed (conditional)

```typescript
interface WhatChangedSection {
  visible: boolean;  // false if nothing material changed
  
  // COMPUTED: diff against previous issue
  deltas: Array<{
    category: "tape_breadth" | "macro_regime" | "sector_rotation" | "vix_regime" | "headline";
    previous: string;
    current: string;
    significance: "high" | "medium";
  }>;
  
  // LLM WRITES: 2-3 sentences about what's actually different
  narrative: string;
  
  // SPECIAL: "Nothing material changed since yesterday's issue."
  nothing_changed_fallback: string;
}
```

**Freshness rule:** Only visible if at least one `delta` exists. If all inputs are identical to yesterday, show a single line: *"No material change from yesterday's issue."* — and suppress the entire section body.

**Word budget:** 50 words max, or 10 words if nothing changed.

### ③ Your Names (conditional)

```typescript
interface YourNamesSection {
  visible: boolean;  // false if no watchlist/portfolio supplied
  
  // FROM: user portfolio/watchlist + market data
  rows: Array<{
    ticker: string;
    name: string;
    price: number;
    change_1d_pct: number;
    change_5d_pct: number;
    direction: "up" | "down" | "flat";
    catalyst?: string;  // "Earnings after close", "10-Q filed"
    evidence_id: string;
  }>;  // max 8
  
  // LLM WRITES: 1-2 sentences about portfolio-level exposure
  summary?: string;
}
```

**Freshness rule:** Always fresh when present (prices change daily). OMIT ENTIRELY when no watchlist exists — no "Portfolio radar was omitted because..." filler.

**Word budget:** 30 words for summary. The table is the content.

### ④ Today's Calendar (conditional)

```typescript
interface CalendarSection {
  visible: boolean;  // false if no events today or this week
  
  // FROM: economic calendar API + earnings calendar
  events: Array<{
    time: string;       // "08:30 ET" or "After Close"
    title: string;      // "CPI-U (April)"
    category: "macro" | "earnings" | "fed_speaker" | "other";
    impact: "high" | "medium";
    ticker?: string;    // for earnings
  }>;  // max 6
}
```

**Freshness rule:** Only show events for today + next 2 business days. OMIT ENTIRELY if empty.

**Word budget:** 0 words — this is a pure data table.

### ⑤ Headlines Worth Knowing (conditional)

```typescript
interface HeadlinesSection {
  visible: boolean;  // false if no approved headlines ingested
  
  // FROM: news-ingest service (approved RSS/API sources)
  headlines: Array<{
    headline: string;
    source_name: string;
    source_url: string;
    published_at: string;
    topic: "macro" | "policy" | "company" | "sector" | "geopolitical";
    one_sentence_summary: string;  // LLM-generated from article
    relevance_to_portfolio?: string;
  }>;  // max 5
}
```

**Freshness rule:** Only headlines from the last 24 hours. OMIT ENTIRELY if no fresh headlines. Never show "No approved headline digest was supplied" — just don't show the section.

**Word budget:** ~15 words per headline summary.

### ⑥ Signal vs Noise (always present)

```typescript
interface SignalNoiseSection {
  signal: string;  // One sentence. What's real.
  noise: string;   // One sentence. What to ignore.
}
```

**Freshness rule:** Always present. Must be genuinely different from yesterday. If the underlying data hasn't changed enough to warrant a new signal/noise split, say: *"Signal: No new signal emerged. Noise: Unchanged index levels are not a story."*

**Word budget:** 30 words total. Two sentences. That's it.

### ⑦ The Backdrop (suppressed if unchanged)

```typescript
interface BackdropSection {
  visible: boolean;
  
  // Only when regime changed:
  regime_label: string;          // "Elevated"
  regime_changed: boolean;       // compared to previous issue
  regime_change_detail?: string; // "Moved from moderate to elevated"
  
  // Compact summary — NOT the full World Bank + BLS dump
  one_liner: string;  // "Macro: elevated (2Y high, CPI high). GDP growth: 2.1%."
}
```

**Freshness rule:** When `regime_changed === false`, show only: *"Macro regime: Elevated. Unchanged."* — one line, not a section.

**Word budget:** 15 words when unchanged. 60 words when changed.

---

## LLM Editorial Contract for Dexter

> [!IMPORTANT]
> The LLM is an **editor**, not a **reporter**. It rewrites deterministic facts into readable prose. It does not invent facts, add tickers, or generate opinions.

### System Prompt (Revised)

```
You are Thesis Pulse's morning editor.

RULES:
1. You receive a JSON fact pack. Every number, ticker, date, and source 
   in your output MUST come from this pack. Invent nothing.
2. Write like the Financial Times, not like a blog. Short sentences. 
   Active voice. No superlatives. No exclamation marks.
3. Total output: under 300 words across all fields combined.
4. If a section has no new data compared to yesterday, say so in 
   ≤10 words rather than rephrasing the same information.
5. Never use: buy, sell, hold, price target, entry, exit, stop loss,
   take profit, overweight, underweight, outperform, underperform.
6. The reader has 3 minutes. Respect that.
```

### Output Shape (Revised)

```json
{
  "headline": "12 words max, newspaper style, ALL CAPS",
  "lede": "3 sentences max, 80 words max",
  "what_changed": "2 sentences max, 50 words max — or 'No material change.'",
  "signal": "1 sentence, 15 words max",
  "noise": "1 sentence, 15 words max",
  "backdrop": "1 sentence if unchanged, 3 sentences if changed",
  "your_names_summary": "1-2 sentences about portfolio exposure, if names supplied"
}
```

### What the LLM Should NOT Do

| Bad Pattern | Why | Fix |
|-------------|-----|-----|
| "The point for Thesis is not the index move alone..." | Meta-commentary about the product | Just state what happened |
| "A daily tape becomes useful when it shows whether..." | Explaining methodology to the reader | Skip it |
| "Coverage was broad enough to let the story stand..." | Internal QA language leaking into editorial | Remove |
| "The customer-facing conclusion is straightforward..." | Breaking the fourth wall | Just write the conclusion |
| Repeating the same 4 evidence items 5 times | Redundant citation | One evidence section at bottom |
| 5 paragraphs to say "markets were higher" | Bloat | 3 sentences, done |

---

## Visual Template Constraints

### Target Dimensions

| Property | Current | Target |
|----------|---------|--------|
| HTML file size | 37 KB | **< 12 KB** |
| Line count | 1,288 | **< 400** |
| Estimated read time | "5 minutes" (actually 8+) | **3 minutes** |
| Sections rendered | 11 + footer | **4-7** (conditional) |
| Evidence blocks visible | 5 inline blocks | **1 collapsed** |
| CSS overhead | ~980 lines | **~300 lines** |

### Layout Rules

1. **The entire issue fits on 2 phone screens** (not 6)
2. **No section header without content** — if the section is empty, it doesn't exist
3. **Evidence is a footnote section**, not inline
4. **Macro data appears once** — in the backdrop, never repeated
5. **The bar chart stays** — it's the best part of the current design
6. **Ticker strip stays** — good, compact, informative
7. **Section separators are thin rules**, not padded cards

### Typography Tightening

| Element | Current | Proposed |
|---------|---------|----------|
| Lead paragraph | 12.8px, 1.48 line-height | **11.5px, 1.4** |
| Body text | 10.4px | **10.4px** (keep) |
| Section headers | 15.5px uppercase | **12px uppercase** |
| Evidence items | Inline full blocks | **8px footnote list** |

---

## Data Pipeline Changes Required

### New Inputs Needed

| Input | Source | Frequency | Status |
|-------|--------|-----------|--------|
Input	Free Source	Method	Status
Market tape	FRED (already integrated)	API (key in .env)	✅ Working
Fed speeches	federalreserve.gov/feeds/speeches.xml	RSS — confirmed working, no key	✅ Ready to wire
Fed press releases / FOMC	federalreserve.gov/feeds/press_all.xml	RSS — confirmed working, no key	✅ Ready to wire
Headlines / news	Reuters feeds.reuters.com/reuters/businessNews	RSS — already in APPROVED_SOURCES	⚠️ In fixture mode
Bloomberg	feeds.bloomberg.com/markets/news.rss	RSS — already in APPROVED_SOURCES	⚠️ In fixture mode
BLS release calendar	bls.gov/schedule/news_release/	Public HTML — scrapeable	📋 Needs wiring
Treasury release dates	home.treasury.gov (already scraped for rates)	API	✅ Already in
Earnings calendar	Yahoo Finance /calendar/earnings	Returns 429 — blocked	❌ Needs alternative
Portfolio watchlist prices	FRED series for ETFs/indexes (what's tracked now)	API	⚠️ Only indexes, not tickers

### Provider Corrections From 2026-04-28 Probe

The older provider table above is superseded by the current provider decision table below where the two conflict.

| Input | Free Source | Method | Current Decision |
|-------|-------------|--------|------------------|
| Market tape | FRED, already integrated | API, key in `.env` | Keep as production source |
| Fed speeches | `federalreserve.gov/feeds/speeches.xml` | RSS, no key | Ready to wire |
| Fed press releases / FOMC | `federalreserve.gov/feeds/press_all.xml` | RSS, no key | Ready to wire |
| BEA releases | `apps.bea.gov/rss/rss.xml` | RSS, no key | Ready to wire |
| Census economic calendar | `census.gov/economic-indicators/calendar-listview.html` | Public HTML | Ready to wire with parser |
| BLS published observations | `api.bls.gov/publicAPI/v2/timeseries/data` | API, no key | Ready for data freshness, not calendar |
| BLS release calendar/RSS | `bls.gov/schedule/news_release/bls.ics` and `bls.gov/feed/*` | ICS/RSS | Blocked with 403 from this environment; use official fallback |
| Bloomberg headlines | `feeds.bloomberg.com/markets/news.rss` | RSS, no key | Reachable, optional headline metadata only if source policy approves |
| Reuters legacy feed | `feeds.reuters.com/reuters/businessNews` | RSS | Dead DNS; do not rely on it |
| Treasury release dates | `home.treasury.gov` / TreasuryDirect | Official pages/RSS | Approved candidate |
| Earnings calendar | Broker/API provider or manual reviewed calendar | TBD | Yahoo excluded from Market Tape; avoid as hard dependency |
| Portfolio watchlist prices | FRED only for index/ETF coverage today | API | Individual equities need a separate approved free source or omission truth |

### Diff Engine (Previous-Issue Comparison)

The most impactful change. Before the LLM runs, compute:

```typescript
interface PulseDelta {
  tape_breadth_changed: boolean;       // "higher" → "lower"
  macro_regime_changed: boolean;       // "elevated" → "moderate"
  sector_leadership_rotated: boolean;  // new leader vs yesterday
  vix_regime_crossed: boolean;         // crossed 20 threshold
  new_headlines_count: number;         // 0 = suppress headlines section
  new_calendar_events_count: number;   // 0 = suppress calendar section
  portfolio_movers: string[];          // tickers that moved > 2%
  nothing_material_changed: boolean;   // all above are false/0
}
```

When `nothing_material_changed === true`, the entire issue becomes:

> **QUIET DAY. NO MATERIAL CHANGE.**
> 
> Markets were flat. Macro regime unchanged. No new headlines of note.
> Your names were steady. Nothing demands attention this morning.
> 
> *Full tape in the archive. Next issue tomorrow.*

That's a **valid newspaper issue**. The Wall Street Journal runs "Markets Drift in Quiet Session" on slow days. Pulse should too.

---

## Proposed Changes

### Product API (`apps/product-api`)

#### [MODIFY] [pulse-issue-plan.ts](file:///C:/BOTS/Thesis/fintech/apps/product-api/src/pulse-issue-plan.ts)
- Replace 13-module plan with 7-section plan matching the new hierarchy
- Add `PulseDelta` computation comparing current report to previous
- Add `nothing_material_changed` flag that collapses the entire issue
- Remove `hidden_legacy_sections` — everything not in the template is gone

#### [MODIFY] [pulse-editorial-writer.ts](file:///C:/BOTS/Thesis/fintech/apps/product-api/src/pulse-editorial-writer.ts)
- Replace system prompt with the tighter editorial contract above
- Reduce `maxTokens` from current value to 600 (forces brevity)
- Add word-count validation to `validateDraft`
- Change output shape to match the new 7-field structure
- Add `nothing_changed` short-circuit that skips LLM entirely

#### [MODIFY] [market-pulse-render.ts](file:///C:/BOTS/Thesis/fintech/apps/product-api/src/market-pulse-render.ts)
- Rewrite HTML template to match the 7-section layout
- Kill inline evidence blocks — move to single footer section
- Make all conditional sections truly conditional (no empty-state messages)
- Cut CSS from ~980 to ~300 lines
- Add `data-section-visible` attributes for section suppression

#### [MODIFY] [market-pulse.ts](file:///C:/BOTS/Thesis/fintech/apps/product-api/src/market-pulse.ts)
- Add `PulseDelta` to `buildEditorialIssue`
- Suppress structural_context from daily output (move to weekly/on-change)
- Stop repeating macro_stress observations across multiple sections
- Add `nothing_material_changed` early-exit path

### Dexter Worker (`apps/dexter-worker`)

#### [MODIFY] Dexter LLM integration
- Update the Pulse editorial prompt to match the new contract
- Enforce the word budget in the LLM call
- Add "quiet day" template that bypasses LLM entirely

### News Ingest (`apps/news-ingest`)

#### [NEW] Pulse headline feed
- Wire approved RSS/API sources into the Pulse data pipeline
- Output `MarketPulseHeadlineItem[]` that feeds section ⑤

---

## Verification Plan

### Automated Tests
- Generate two consecutive daily Pulse reports with identical macro data
- Assert that sections with no delta are suppressed or show "No change" one-liner
- Assert HTML output < 15 KB and < 500 lines
- Assert LLM output < 300 words total
- Assert no evidence block appears more than once in HTML

### Manual Verification
- Side-by-side comparison: current 1,288-line output vs new ~350-line output
- Read-time test: new issue should be readable in under 3 minutes
- "Quiet day" test: feed identical data two days in a row, confirm the short-form issue renders

---

## Open Questions

> [!IMPORTANT]
> **Headline sources:** Which RSS/API feeds are approved for Pulse headlines? Options include:
> - Reuters wire (requires licensing)
> - MarketWatch RSS (free, attribution required)
> - Fed/Treasury press releases (official, free)
> - SEC EDGAR filing alerts (already integrated)
> 
> This choice affects what "Headlines Worth Knowing" can actually contain.

2026-04-28 decision: use official feeds first. Reuters legacy RSS is removed as a reliable free runtime option because the probed URL no longer resolves. Bloomberg Markets RSS is reachable, but it remains optional headline metadata only and requires source-policy approval before customer-facing use.

> [!IMPORTANT]
> **Portfolio data source:** How does the user's watchlist/portfolio get into the system today? Is there a defined input contract, or does this need to be built from scratch? The current code has `UserResearchState` and `portfolioRadarRows` but they're always empty.

> [!WARNING]
> **Economic calendar API:** A real calendar (CPI release times, Fed speaker schedules, earnings dates) is the single biggest freshness unlock. Which provider? Options:
> - `TradingEconomics` (paid, comprehensive)
> - `FRED release calendar` (free, macro only)
> - Manual curated JSON per week (labor-intensive but zero-dependency)

2026-04-28 decision: prefer official-first calendar stitching: Fed release calendar/RSS, BEA RSS, Census calendar HTML, and BLS public data API for published observation freshness. BLS `.ics` and RSS returned `403` from this environment, so BLS calendar rows need a manually reviewed official fallback or a different allowed access path before they become production runtime.

> [!IMPORTANT]
> **Scope of this plan:** Should we implement the full data pipeline (headlines, calendar, portfolio) in this pass, or focus first on the template/layout/editorial compression with current data, then wire new inputs incrementally?
