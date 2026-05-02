# Thesis - Phase 7 Decision Locks

**Status:** Active  
**Last Revised:** 2026-05-02
**Purpose:** Lock the product, provider, and implementation decisions for Phase 7 before the milestone is widened in code.

---

## 1. Product Direction

| Area | Decision | Why |
|---|---|---|
| Phase scope | Phase 7 M1 is a Morning Exception Briefing refinement milestone | Keeps scope narrow and shippable |
| New section | `market_tape` is added as a new section, not a replacement for `market_moves` | Preserves filing/event semantics |
| Product identity | Thesis remains a research and conviction system, not a market terminal | Prevents surface drift |
| Commentary | `market_tape` commentary stays bounded, observational, and short | Keeps the report honest |

---

## 2. Provider Locks

- `FRED` is the approved production source for M1 market-tape live retrieval.
- `Yahoo Finance` is not allowed in M1 production runtime or user-facing provenance.
- `Alpha Vantage` is not allowed in M1 production runtime or user-facing provenance.
- If FRED does not provide clean free live coverage for a desired family, the system records omission truth instead of hidden substitution.

---

## 2A. Dependency Policy Lock

- Internal TypeScript services use workspace packages rather than private GitHub tarball dependencies.
- `apps/dexter-worker` does not consume the historical external `dexter` dependency pin from `github:rzvsd/fintech#9e570f88abeded674125a53faaeaded3858dd672`.
- The old Phase 1 Dexter dependency record is historical and superseded by this Phase 7 lock.
- Reintroducing a private or GitHub-pinned runtime dependency requires an explicit ADR, updated docs, reproducible CI/deploy proof, and owner approval.
- Runtime provider dependencies must be public/reproducible in CI or have documented secret-backed authentication that is not committed to the repo.

---

## 3. Section Order Lock

Morning Exception Briefing section order in M1:

1. `market_tape`
2. `official_macro_pressure`
3. `bounded_context`
4. `market_moves`
5. `canonical_events`
6. `uncertainty_flags`
7. `macro_releases`
8. `rates_fx_commodities`
9. `news_summary`

---

## 4. Market Tape Scope Lock

Core index scope:

- `SP500`
- `DJIA`
- `NASDAQCOM`
- Russell 2000 family if approved free live coverage exists; otherwise explicit omission

Cross-asset scope:

- `VIXCLS`
- 10Y Treasury daily move
- 2Y Treasury daily move
- `DCOILWTICO`
- broad dollar index proxy
- high-yield spread or high-yield stress proxy

Sector scope:

- `XLB`, `XLE`, `XLF`, `XLI`, `XLK`, `XLP`, `XLRE`, `XLU`, `XLV`, `XLY`
- use only if approved free live coverage is available
- otherwise degrade explicitly with omission truth

---

## 5. Narrative Threshold Locks

- `broadly higher` / `broadly lower` requires at least 3 of the 4 core index families to move in the same direction
- otherwise the broad tape read is `mixed`
- `no material tape shift` is used when all available core-index changes are small and no cross-asset stress threshold is crossed
- sector leadership is only called notable when the spread between top and bottom sector baskets is meaningfully wide
- cross-asset stress is only called notable when VIX, rates, dollar, credit, or oil moves clear reviewed day-over-day thresholds

M1 implementation thresholds:

- quiet core-index move threshold: `0.35%`
- notable sector spread threshold: `1.00%`
- notable VIX move threshold: `1.50`
- notable rates move threshold: `0.08`
- notable dollar move threshold: `0.50%`
- notable credit move threshold: `0.10`
- notable oil move threshold: `1.50%`

---

## 6. Contract Locks

- `packages/contracts/src/market-tape.ts` is the canonical M1 market-tape contract file
- `MarketPulseSections.market_tape` is required
- `MarketPulseReport.market_tape` is additive and optional
- `MacroStressCategory` and `MacroStressSnapshot` must not change in M1

---

## 7. Evidence And Omission Locks

- `market_tape` evidence uses `financial_data`
- retrieval metadata must name provider, source URL where available, and retrieval timestamp
- omission truth must name the missing family or instrument directly
- no hidden use of Yahoo or paid providers is allowed in production provenance

---

## 8. M2 Editorial Freshness Locks

- `editorial_issue` is additive and optional on `MarketPulseReport`.
- No LLM is used for M2 Pulse prose.
- Prior Pulse comparison is deterministic and uses the latest stored `market_pulse` report when available.
- Missing prior Pulse produces a baseline note, not fake daily delta.
- `what_changed`, `why_it_matters`, `what_to_watch`, and `signal_vs_noise` are optional sections.
- Static structural context is hidden from the main story flow unless it changed, explains the day, or affects a coverage note.
- Customer-facing copy must not expose raw internal labels such as `data_incomplete`, `bounded_context`, or provider debug strings.

## 9. M2 Calendar Locks

- Earnings-calendar inputs may support `what_to_watch`.
- Calendar inputs are separate from Market Tape and do not relax the M1 Market Tape provider lock.
- Market Tape remains FRED-only for production live retrieval in Phase 7 M1-M2.
- Alpha Vantage remains excluded.
- Yahoo Finance remains excluded from Market Tape runtime and provenance.
- Calendar unavailability must degrade with a coverage note and must not block Pulse generation.

---

## 10. M3 Morning Newspaper Locks

- M3 adds a reader-facing morning edition layer, not a dashboard or terminal.
- `morning_edition` is additive and optional on `MarketPulseReport`.
- M3 optional sections are `market_board`, `portfolio_radar`, `today_catalysts`, `headline_digest`, and `sector_pulse`.
- Modules with no clean data are hidden from the main issue instead of rendering broken cards.
- Screenshot references are structure references only; Thesis colors, typography, and brand treatment remain native.
- Portfolio radar is limited to portfolio/watchlist rows supplied to Pulse.
- Headline digest may display approved publication headline, source, timestamp, and link only.
- Headline digest must not scrape, store, summarize, or reproduce article body text in M3.
- Customer copy must translate coverage limitations into plain language and must not expose raw `data_incomplete`, `bounded_context`, or debug/provider labels.

## 11. M3 Provider Locks

- Market Tape provider locks remain unchanged: FRED-only production live path in Phase 7.
- Alpha Vantage remains excluded from Phase 7 production runtime.
- Yahoo Finance remains excluded from Market Tape runtime and provenance.
- Any individual stock radar data must arrive through an approved portfolio/watchlist input path with explicit `financial_data` evidence.
- Missing portfolio price rows omit the radar module; Thesis must not invent prices.

---

## 12. M4 Macro News And Geopolitical Shock Locks

- `macro_news` is additive and optional on `MarketPulseReport`.
- `macro_news` may use explicit approved macro-news inputs and approved headline rows.
- Headline digest and macro-news handling remain headline/link/time/source only in M4.
- Article-body scraping, article-body storage, and article-body summarization are not introduced in M4.
- Shock claims must show confirmation state: `reported`, `corroborated`, or `official_confirmed`.
- Shock-level reported headlines must not be written as confirmed facts.
- Shock-level items can move into the issue flow and lead framing, but cannot become trading advice.
- No price targets, tactical trading instructions, or “buy/sell” language are allowed.
- If no approved macro/geopolitical headline input exists, Pulse records a calm state and does not invent news.

---

## 13. M5 User Research State Locks

- `UserResearchState` is the typed owner of user-specific analyst context.
- Manual holdings are allowed as user-declared context; no brokerage connection or execution path is introduced.
- Authenticated Pulse retrieval may overlay the latest `UserResearchState`; stored global Pulse artifacts remain non-user-specific.
- Regex text matching through `watchlist_overlay` is obsolete and must not be used for runtime personalization.
- Existing `thesis_monitor_snapshots` remains an input/cache to the broader state.
- No LLM generation, trading advice, price targets, WhatsApp workflow, public Q&A endpoint, or terminal-style surface is introduced in M5.

---

## 14. M6 Guarded LLM Editorial Writer Locks

- M6 allows LLM generation only as an optional editorial rewrite layer for Pulse.
- `PULSE_LLM_EDITORIAL_ENABLED=false` is the default.
- OpenRouter is the only M6 production LLM provider.
- Deterministic Pulse remains the source of truth.
- LLM output can update narrative/editorial fields only.
- LLM output cannot mutate market data, Macro Stress, user research state, source metadata, tickers, events, prices, or provenance.
- Malformed JSON, provider failure, missing key, timeout, unsupported ticker claims, or trading language must fall back to deterministic Pulse.
- No buy/sell/hold language, price targets, execution instructions, Q&A endpoint, broker connection, screener, or terminal workflow is introduced.

---

## 15. M7 Pulse Issue Plan And Newspaper Polish Locks

- M7 introduces an internal deterministic `PulseIssuePlan`; it is not a new public contract.
- `Project Note/Phase7/Milestones/implementation_plan.md` is the canonical M7 revamp reference.
- The old 13-module M7 plan is superseded and must not be rebuilt.
- The locked issue hierarchy is: Masthead, The Tape, What Changed, Your Names, Today's Calendar, Headlines Worth Knowing, Signal vs Noise, The Backdrop, footer sources/method.
- `The Tape`, `Signal vs Noise`, and the footer are always present.
- `What Changed` may collapse to one line: `No material change from yesterday's issue.`
- `Your Names`, `Today's Calendar`, and `Headlines Worth Knowing` render only when real typed data exists.
- `Market Overview`, standalone `Why It Matters`, standalone `What To Watch`, standalone `Company / Event Notes`, visible `Coverage Notes`, visible method cards, and daily structural-context sections are killed from the main flow.
- Evidence appears once in the footer, not inline across repeated sections.
- `market_tape`, `morning_edition`, `editorial_issue`, `macro_news`, and `UserResearchState` remain data inputs, not competing render paths.
- LLM output remains a copy pass only; it cannot decide issue structure, module visibility, data values, sources, tickers, prices, or events.
- Quiet days bypass the LLM and render a valid short issue.
- HTML/PDF exports must stay compact, avoid orphaned headings with explicit print rules, and keep customer copy free of raw internal labels.

---

## 16. M8 Pulse Morning Brief Reset Locks

- M8 supersedes the M7 newspaper presentation as the customer-facing Pulse export default.
- Pulse is a Morning Brief, not a newspaper, dashboard, terminal, or report dump.
- The daily issue mode is deterministic: `quiet`, `normal`, or `event`.
- The locked reader flow is Morning Line, What Happened Yesterday, What Changed Since Yesterday, The Interesting Bit, optional Your Names, optional Things To Watch, optional Headlines Worth Knowing, Signal vs Noise, footer Sources and Method.
- The old newspaper volume/issue masthead, `In This Issue`, and standalone backdrop are removed from the main renderer.
- Empty optional modules hide completely; customer copy must not apologize for missing portfolio radar, headlines, or calendar rows.
- Daily delta is deterministic and must not fake comparison when no prior Pulse exists.
- The Interesting Bit is selected from deterministic candidates before any LLM wording.
- LLM brief copy is optional and limited to six fields: `morning_line`, `yesterday_comment`, `interesting_bit`, `your_names_comment`, `signal`, and `noise`.
- Total LLM brief copy must stay under 180 words.
- LLM output cannot decide structure, section visibility, facts, numbers, sources, tickers, prices, events, or provenance.
- LLM output cannot use buy/sell/hold language, price targets, execution language, unsupported tickers, unsupported source names, or `because` causality unless a future fact pack explicitly carries a causal link.
- Sources and method appear once in the footer.
- Source tiers remain: official/free data first, official calendars second, headline metadata only third, and no Yahoo/Alpha Vantage/article-body scraping in Pulse production.

---

## 17. M9 Dexter Evidence Quality Skills Locks

- M9 is a Dexter-owned internal evidence-quality milestone.
- M9 is separate from the existing `m9-due-diligence-*` prompt label; that label remains a due-diligence authoring/version marker, not the M9 skills milestone.
- TradingAgents-CN, last30days-skill, and scientific-agent-skills are inspiration/reference only in M9 and are not imported as runtime dependencies.
- New evidence tools are Dexter-native, optional, and disabled by default in production.
- The first M9 implementation does not modify Product API contracts, mobile UI, Docker services, public routes, or Pulse customer output.
- Financial validation is deterministic and omission-forward; missing values must not be treated as zero.
- Evidence debate is deterministic in M9 and may use supporting/challenging/unresolved internal language, but customer-facing bull/bear/buy/sell/hold/risk-manager language is forbidden.
- Recent context is fixture-only in M9. Live last30days integration requires later license, dependency, auth, rate-limit, source-policy, and ADR review.
- Social/community sources, including Reddit, X, YouTube, Hacker News, Polymarket, and generic web findings, default to `internal_only`.
- Polymarket may be used only as attention or consensus context, never as factual event confirmation.
- Internal-only recent context cannot be quoted, summarized, attributed, or treated as fact in customer-facing report copy.
- Tool failures must return omissions and must not block Deep Dive generation.
- No trading advice, price targets, position sizing, broker flow, public lab, terminal behavior, or social-source customer copy is introduced in M9.
