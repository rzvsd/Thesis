# Thesis - Phase 7 Bluebook

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-05-02

---

## Phase 7 Frame

Phase 7 begins after the core Phase 6 cutover and focuses on product sharpness rather than substrate replacement.

M1 is deliberately narrow:

- Morning Exception Briefing only
- one new section: `market_tape`
- free-data only
- bounded commentary only

---

## Why This Exists

Pulse was already credible after Phase 6, but a lot of its inputs refresh on monthly or quarterly cadence. That means some daily cycles are honest but visually static.

`market_tape` exists so Pulse can explain the day when:

- equities moved materially
- volatility repriced
- yields moved
- oil or dollar context changed
- leadership and laggards mattered

without pretending Thesis is a quote board.

---

## Product Doctrine

The doctrine is:

- clearer daily context
- better report readability
- stronger provenance
- no terminal drift

Anything that makes Morning Exception Briefing look like a public market dashboard is out of scope for M1.

---

## M2 Editorial Doctrine

M2 treats Pulse as an issue, not a table of sections.

The issue should answer:

- what changed since the prior Pulse?
- why does that change matter for conviction?
- what should the reader watch next?
- what is confirmed signal versus one-day noise?

Static context is subordinate to the issue. If a fact did not change and does not explain the day, it should not take a main-story slot.

The M2 editorial layer is deterministic. It can later become an LLM-assisted writing surface, but only after the contract, evidence, and stale-section rules are proven.

---

## M3 Morning Newspaper Doctrine

M3 treats the Pulse issue as a reader experience.

The user should be able to open the briefing in the morning and understand:

- how the broad board moved
- what happened to names they actually follow
- what events may matter next
- which headlines are worth opening separately
- whether sector leadership is meaningful enough to mention

The system should not force the reader through internal coverage states before giving them the day.

The doctrine is:

- friendly surface
- disciplined evidence
- no invented market data
- no article body scraping
- no terminal drift

Modules are allowed to be absent. A missing portfolio radar is better than a fake portfolio radar.

---

## M4 Macro News Doctrine

Macro and geopolitical headlines matter when they change the interpretation of the day.

M4 gives Pulse a controlled way to account for those events:

- normal headlines stay in the background
- notable headlines become context
- shock headlines can move into the issue framing

The key trust rule is confirmation state. A reported attack is not the same as a confirmed attack. Pulse must preserve that distinction in customer copy.

The layer is intentionally not a news scraper. It works from approved headline/event inputs and shows headline, source, link, and time. Article bodies remain outside the M4 product path.
## M5 Analyst State Doctrine

M5 introduces the persistent analyst memory behind user-specific Pulse context. It should make Thesis feel like it remembers the user's followed names and manually declared holdings, but it must stay evidence-backed, deterministic, and non-executing.

The correct shape is a maintained research state, not a trading bot.

---

## M7 Issue Plan Doctrine

Pulse should be assembled like an issue, not dumped like a schema.

The deterministic issue plan is the editorial spine. It decides:

- The Tape placement
- one-line or expanded What Changed behavior
- Your Names, Calendar, and Headlines visibility
- Signal vs Noise placement
- Backdrop compression
- optional module visibility
- footer source/method placement
- which legacy technical sections stay out of the main reader flow

The issue plan is deliberately internal. It must not become a new product surface, dashboard, or public lab concept.

The old 13-module idea is superseded by the newspaper template in `Project Note/Phase7/Milestones/implementation_plan.md`.

The renderer should prefer:

- fewer stronger modules
- smaller, denser text
- compact charts where they clarify the read
- no orphaned headings in PDF output
- footer/method placement for provenance and limitations

---

## M10 Engagement Doctrine

Pulse should feel like a sharp colleague explaining the morning, not a schema export with nicer typography.

M10 adds room for a real Morning Story, but not room for hallucination. The deterministic fact pack decides the mode, facts, section visibility, one-thing candidate, and user-name context. The LLM may only improve wording inside a guarded budget.

The reader promise is:

- lead with the interesting thing
- show the tape cleanly
- connect tape, macro, and names
- be short when nothing happened
- never invent novelty to fill space

The visual system should remain compact and premium: one strong lead, clear data, one memorable callout, then the tail.
- no repeated inline evidence blocks

The LLM, when enabled, may improve wording only after the deterministic issue plan is created. It must not decide structure.

## M8 Morning Brief Doctrine

M8 corrects the product shape again: Pulse should feel like a premium morning brief, not a newspaper cosplay.

The user should know in seconds:

- did anything material change?
- what did the tape do?
- what is the one useful interpretation?
- did anything in my names matter?
- what should I keep on the calendar?

The brief should be brave enough to say "nothing material changed" on quiet days. That honesty is more premium than filler.

The renderer should favor:

- compact sections
- restrained data visuals
- no visible internal status labels
- no orphaned headings in PDF
- optional modules hidden when empty
- sources and method once at the end

The LLM is a copy editor only. It writes short sentences from a fact pack. It never becomes the analyst of record.
