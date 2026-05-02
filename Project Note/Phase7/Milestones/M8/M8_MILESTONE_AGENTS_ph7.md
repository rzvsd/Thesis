# Phase 7 M8 - Pulse Morning Brief Reset

## Summary

M8 replaces the newspaper-style Pulse issue with a compact **Morning Brief**.

The daily unit is one scroll, designed to be read in roughly 90 seconds to 3 minutes. The renderer adapts to the day instead of forcing every cycle through the same density:

- `quiet`: nothing material changed; the brief says that plainly
- `normal`: the tape moved, but no shock or threshold changes the product posture
- `event`: macro shock, high-impact calendar, major cross-asset move, or tracked-name attention threshold

This is a reset of the customer-facing Pulse experience, not a concatenation of the previous M7 newspaper modules.

## Goal

Make Pulse feel like a premium morning digest:

- clear first sentence
- simple tape read
- deterministic daily delta
- one useful insight
- user-name context only when real data exists
- calendar/headline metadata only when real
- signal/noise always
- sources and method once in the footer

## Product Shape

Locked sections:

1. Morning Line
2. What Happened Yesterday
3. What Changed Since Yesterday
4. The Interesting Bit
5. Your Names, only when typed user/watchlist rows exist
6. Things To Watch, only when calendar rows exist
7. Headlines Worth Knowing, only as headline/source/time/link metadata
8. Signal vs Noise
9. Sources and Method footer

Removed from the main flow:

- newspaper volume/issue theater
- `In This Issue`
- standalone `Why It Matters`
- standalone `What To Watch`
- visible method cards
- visible coverage/debug labels
- repeated structural backdrop unless it explains the day

## Architecture

Data path:

```text
MarketPulseReport
  -> PulseBriefFactPack
  -> deterministic mode/delta/curiosity engine
  -> optional bounded LLM copy fields
  -> Pulse Brief HTML/PDF renderer
```

The LLM can write only:

- `morning_line`
- `yesterday_comment`
- `interesting_bit`
- `your_names_comment`
- `signal`
- `noise`

Total LLM copy must stay under 180 words. The LLM cannot choose sections, mutate facts, add tickers, add sources, add prices, infer causality, or create advice.

## Source Policy

Tier 1:

- FRED
- Treasury
- SEC EDGAR
- Federal Reserve
- BEA
- BLS
- EIA

Tier 2:

- official calendars/RSS metadata

Tier 3:

- headline/source/time/link metadata only from approved publisher feeds

Tier 4:

- blocked or avoided for Pulse production: Yahoo Finance runtime dependency, Alpha Vantage, scraped quote pages, article-body summaries, paid/news body scraping

## Acceptance Criteria

- [ ] Pulse export defaults to Morning Brief, not newspaper template
- [ ] quiet/normal/event modes are deterministic
- [ ] Morning Line is one sentence
- [ ] tape rows show compact daily changes
- [ ] daily delta is deterministic and honest when no prior Pulse exists
- [ ] The Interesting Bit is generated from deterministic candidates
- [ ] Your Names hides completely when no approved rows exist
- [ ] Things To Watch and Headlines hide when empty
- [ ] Signal vs Noise is always present
- [ ] sources/method appear once in a collapsed footer
- [ ] no raw `data_incomplete`, `bounded_context`, provider debug, or omitted-module apologies appear in customer copy
- [ ] LLM brief writer rejects unsupported tickers, advice, unsupported sources, and unapproved `because` causality
- [ ] HTML/PDF print rules prevent orphaned section headings

## Smoke Test

```text
Step 1: Build a Pulse with market_tape, morning_edition, macro_news, and user rows.
Step 2: Render HTML.
Step 3: Confirm Morning Brief structure appears and newspaper structure does not.
Step 4: Render a variant without user rows/calendar/headlines.
Step 5: Confirm optional modules hide without apology copy.
Step 6: Run the brief LLM validator against valid output.
Step 7: Confirm unsupported ticker, trading language, and because-causality are rejected.
Step 8: Export HTML/PDF and inspect page breaks, compactness, and source footer.
```

## Non-Goals

- no terminal workflow
- no new app tab
- no article-body scraping
- no paid provider dependency
- no freestyle LLM report writing
- no user execution or portfolio advice
