# Deep Dive 2.0 report spec

This file keeps the Deep Dive the same for every company: the same chapters, charts and story style, and the
same depth. It also records how the design was made and why. If code or a later redesign disagrees with this
file, change this file first, in its own PR.

- **Reference:** [`mockup.html`](mockup.html) is the approved look, on sample Apple data. Open it in a browser.
  Razvan approved it on 2026-11-24 ("this is top notch"). Published copy:
  https://claude.ai/artifact/AE3pXkwtuwx8EMgsstJNca. Plan doc: https://claude.ai/artifact/CSQNcqDzC7u2rPzpK8AJ3x.
  Where the mockup and this file differ, this file wins. Section 11 lists the known differences.
- **Status:** design approved. The build phase is not picked yet (section 10).
- **Owners:** this file belongs to the Deep Dive redesign thread (`docs/**` is M5's path, cleared with the
  coordinator for this PR). The code it touches belongs to:
  - M2: reuse and runner (`supabase/functions/_lib/jobs`, `jobs/deep-dive`).
  - M3: filing period and precompute (`ticker_coverage`, `_lib/evaluators/precompute.ts`, `rebuild-daily.yml`).
  - M1: validator and share page (`_lib/reports`, feature `web`).
  - M4: PDF (`jobs/pdf`).
  - The report generator is `apps/dexter-worker`, which no milestone owns yet.

  See `docs/rebuild/OWNERSHIP.md`.

## 1. Rules that never change

1. **One report per company per filing.** After a new periodic filing, the daily precompute builds the report.
   If no precompute has run, the first request builds it. Every later request, from any customer, gets that same
   stored report until the company files again. Two customers never see two different reports for the same
   company and filing.
   - Periodic filings are 10-K, 10-Q, 20-F and 40-F, and their /A amendments when the financial statements
     change. 8-K, 6-K and NT filings never start a new report.
   - One report covers every share class of a company. Each class's ticker leads to the same report.
   - **Not yet true in code** (asked of M2 on 2026-11-24, agreed by Razvan):
     - Reuse ends on a clock today: 24 h for a user-run report (`DEEP_DIVE_REUSE_FRESHNESS_HOURS`) and 2160 h for
       a precompute (`_lib/jobs/wiring.ts`). It must last until the fingerprint changes.
     - Open jobs are deduplicated per user and ticker. Two customers who ask before the first job finishes each
       start a job. It must become one open job per ticker across users, and the second customer waits for it.
     - The fingerprint is `TICKER|schema_version|latest period` (`deepDiveFingerprint` in `_lib/jobs/service.ts`).
       The period comes from `ticker_coverage.latest_period` on lookup and from the report's
       `historical_context.latest_period` on store. Both must name the new filing for the fingerprint to change.
       With no period it falls back to `LATEST_UNKNOWN`, which never changes, so the report check must refuse a
       Deep Dive without a period.
2. **Frozen at the filing date.** The report's as-of date is the date of the filing it reads. Nothing in a stored
   report is recomputed or refreshed later. This includes the price parts (Razvan, 2026-11-24). The price action
   chapter shows the trading month that ends on the filing date. Events and guidance stop at that date.
3. **The price box.** It opens at the closing price on the filing date (`price_at_filing`, stored with its date).
   The reader may type another price. The value range marker, the header up or down figure, the P/E key number,
   the ratios, the sensitivity colours, the value meter and "growth the price assumes" all recompute in the
   browser. Nothing is stored. The stored story quotes only `price_at_filing` ("at the $N close on 30 Oct 2025").
   Without a licensed price feed there is no `price_at_filing`. Then the box opens empty ("Type a price"), the
   price cards say "Not seen: type a price to compare", and the story uses its no-price wording.
4. **Same chapters for every company.** All 13 chapters appear in the same order for every company. Missing data
   shows inside the chapter as "Not disclosed" or "Not seen", with the reason. A chapter is never dropped, a card
   is never left empty, and the layout never breaks.
5. **Every number has a source.** Each figure in a chart or a sentence comes from a fact-pack field (with its
   source and date) or from a derived field the template computed and stored under `derived.*`. Section 7 has
   the exact check.
6. **Describe, never advise.** No buy, sell or hold. No ratings, no price targets, no "you should". The footer says
   it is a research summary, not financial advice. Section 4 has the banned words.
7. **One renderer.** The share link and the PDF show the same HTML+SVG page from one chart kit, and the PDF is
   printed from that page. The app screen shows it only if Razvan adds that to rule D3 (`docs/rebuild/DECISIONS.md`
   allows two app changes today).

## 2. Page layout

From top to bottom (see `mockup.html`):

| Part | What it holds |
| --- | --- |
| App bar | Brand, ticker, sample pill (only on sample data), theme switch (auto, light, dark) |
| Header (dark) | The filing in the eyebrow ("from the 10-K for fiscal 2025", or "from the 10-Q for Q2 fiscal 2026"), company name, exchange, sector, city, fiscal year end; confidence and evidence pills; a two-line thesis; the price box with the bear, base and bull range; six key numbers; the reading switch (Full story or Charts only) |
| Chapter chips | A sticky row with one chip per chapter. The chip for the chapter on screen is highlighted |
| Chapters | The 13 chapters below |
| Footer | As-of date (or sample note) and the "not financial advice" line |

Each chapter has the same anatomy:

1. **Kicker:** chapter number and name ("07 · Price & value"), phase badges, source line.
2. **Headline (h2):** names the topic, for example "How Apple makes money".
3. **Verdict:** one bold claim sentence, then one to three plain sentences. Sources uses one plain sentence.
4. **Story:** two to four paragraphs (section 4). Bottom line and Sources have none.
5. **Cards:** one to seven. Every titled card gets a number ("Chart 12") and a title.
   - Chart cards also get a subtitle with units, a legend when there are two or more series, a source line and a
     "Show table" button.
   - Text, chip, stat, scan and list cards may leave these out.
   - The Sources table card has no title and no number.
6. **Upshot:** one to four short sentences that start with "The upshot:" and name what to watch next. Sources has none.

Wide screens show two cards per row, and phones show one. Cards keep their own height (`align-items: start`).

## 3. The chapters

| # | id | Chip | Verdict answers | Cards (chart type) | Phase |
| --- | --- | --- | --- | --- | --- |
| 01 | `summary` | Summary | Good business? Price inside the model range? | Scorecard (meters, 0 to 10: four ranks plus price against the model range); what changed since the last filing (up, down, watch list) | 1 |
| 02 | `business` | Business | How does it make money? | Sales by product (donut, five largest plus Other); product sales over five years (stacked columns); gross margin by type (lines) | 2 |
| 03 | `countries` | Countries | Where do sales come from, where is it made? | Sales by region (ranked bars); regions over five years (lines); country exposure table with economic outlook and currency; where it is made (chips); legal entities by country (ranked bars) | 2 |
| 04 | `links` | Customers & suppliers | Who depends on whom? | Network map (radial on wide screens, flow on phones); who depends on the company (ranked bars); sales channels (segment bar) | 2, then 4 |
| 05 | `owners` | Owners & people | Who owns it, what do insiders do? | Ownership mix (segment bar); top holders with change on the quarter (ranked bars); insider sales by month (columns); board, pay and gatekeepers (chips) | 2 |
| 06 | `financials` | Financials | What happened over 11 years? | Sales and net profit (columns); EPS bridge from last year to this year (waterfall); margins (lines); free cash flow against profit (lines); buybacks and dividends (stacked columns); share count (line); cash against debt (columns) | 1 |
| 07 | `value` | Price & value | Is the price right? | Value range from five methods (range chart with the price line); what the price implies (table); P/E over time (line, phase 3); growth and margin against peers (scatter) | 1, then 3 |
| 08 | `action` | Price action | What did the price do in the month to the filing date? | Daily candles with drawings; volume; the month in numbers (stat grid); pattern scan; prices the chart marked; rules of thumb | 3 |
| 09 | `forecasts` | Forecasts | What could happen next? | History and three scenarios (fan); the three cases (table plus what each needs); fair value if inputs move (heat grid); what management said (callout) | 1, 2, then 4 |
| 10 | `risks` | Risks | What could break the thesis? | Debt coming due (columns); kill switches with status; risk factor changes (chips) | 1, then 4 |
| 11 | `events` | Events | What happened, in order? | Filings in the year to the filing date (timeline with 8-K item codes) | 2 |
| 12 | `bottom` | Bottom line | Does the story hold? | What would prove this story wrong (four numbered items, one per kill switch) | 1 |
| 13 | `sources` | Sources | Where does each number come from? | Source, licence, cost, phase and coverage for each part (table) | 1 |

**3.1 Industry variants.** Each swap keeps the same card slot, chart type and title pattern, so no company gets a
thinner chapter.

| Industry (SIC) | Swaps |
| --- | --- |
| Banks (6020-6099) | Gross margin becomes net interest margin. Free cash flow becomes net income against dividends. Cash against debt becomes loans against deposits |
| Insurers (6311-6411) | Gross margin becomes the combined ratio where it is tagged, else the loss ratio |
| REITs (6798) | EPS becomes FFO per share. Free cash flow becomes FFO against dividends |

**3.2 Fixed choices.**

- **Segments:** the five largest plus Other. A one-segment company shows its revenue breakdown note, or else
  "Not disclosed: one reported segment". Renamed segments are charted under the latest names, with a footnote.
- **Ranks:** against the company's own index (S&P 500, 400 or 600), or else all US-listed filers for the same
  quarter. The subtitle names the group.
- **Peers:** the 7 companies with the closest revenue in the same 4-digit SIC. Widen to 3 digits if fewer than 4
  are found.
- **Kill switches** belong to the report, not to a user: the label is "Kill switches". Every report has exactly
  four, picked by fixed rules, using the first that has data:
  1. Sales growth of the largest segment or the company, at half its 5-year rate.
  2. The main margin of the industry variant, at its 5-year low.
  3. The change in the largest region or customer, at -10%.
  4. A leverage or share-count measure, at the worst year in 10.

  Thresholds are stored fields. A user may follow a switch in the app, and that never changes the report.
- **"What changed"** and "risk factor changes" compare with the previous periodic filing's fact pack, not the
  previous stored report. With no prior filing they show "Not seen: first filing on record".
- **Foreign filers:** use `ifrs-full` tags when `us-gaap` ones are missing. Show amounts in the reporting currency,
  with its code in every subtitle. Per-share values are converted to the trading currency at the filing-date rate
  and adjusted by the ADR ratio. Both the rate and the ratio are stored fields.
- **When the latest filing is a 10-Q:** the 11-year charts use fiscal years, and the latest-year figures and
  ratios use trailing twelve months, labelled TTM.

## 4. How the text reads (the story style)

Razvan asked for "a more verbose detail on the sections ... like a story". The model was a sell-side outlook
report he shared. We kept its techniques and left out its house voice and its advice.

- **Verdict:** a claim, not a label, for example "iPhone is half of sales, services is the growth engine."
- **Paragraphs:** two or three per chapter (four in Price action), each about 60 to 110 words. Each opens with a
  short bold topic sentence ("Services is the quiet engine."). Openers such as "The first reason...",
  "Second, ..." and "But this understates..." are used where they fit, and adversity comes before outcome.
- **Numbers:** every number is set against something (last year, 2015, peers, the total) and explained in plain
  words ("about four dollars in every five").
- **Chart pointers:** paragraphs point to charts as "Chart N". The renderer numbers the titled cards in page order
  and fills in the references. A reference only points to a card in the same chapter.
- **Upshot:** names a condition or number from the report to watch, for example a kill switch threshold.
- **Big question:** the summary ends with one question that follows from the data, for example "Can services and
  buybacks keep earnings per share growing while iPhone barely grows and China shrinks?" The Bottom line chapter
  answers it and lists what would prove the answer wrong.
- **Banned in text and labels:**
  - Advice and rating words: buy, sell, hold, accumulate, overweight, underweight, outperform, undervalued,
    overvalued, cheap, expensive, upside, downside, target, entry, exit, stop, opportunity, attractive, bullish,
    bearish.
  - Style: em dashes, exclamation marks, jargon without a plain explanation, invented history ("as we have long
    said"), and current-events claims without a dated source.
  - Empty table cells show "n/a" or "Not disclosed", never a dash.

**How the text is made.** Each paragraph is a template with slots, and each slot names a field, for example
`services_sales_fy`, `services_growth_pct` or `total_growth_pct`. The template picks its words from the data:
grew or shrank, faster or slower. Fixture mode (no model) still produces the full story. In Phase 4 a language
model may reword the filled text. The output is rejected if it contains a number that is not in the input, or
drops one that is.

## 5. Price action chapter (rules)

Razvan asked for a one-month price action section that uses "some (not all)" of the details from Al Brooks's
"10 Best Price Action Trading Patterns", with the patterns drawn on the chart. The rules below are the chosen
subset. Code computes them from daily bars, with no language model, and the text only describes them.

**Data.**
- 21 regular-session daily bars (open, high, low, close, volume). The last bar is the last session that closed at
  or before the filing's EDGAR acceptance time.
- 20 earlier closes warm up the 20-day average. Seed it with their simple mean, then apply the exponential
  update with k = 2/21.
- Prices are split-adjusted but not dividend-adjusted.
- Chart the share class with the highest 20-day average dollar volume (the ADR for a foreign filer), and name it
  in the subtitle.
- Prices need a licensed feed that allows display (Phase 3).

**Definitions.**
- **Swing high:** a bar whose high is above the highs of the 2 bars on each side. A swing low is the mirror case.
- **Near:** within 0.25 × ATR(14), or within 1% of price when there are fewer than 14 bars.
- **Box (trading range):** at least 5 bars, each overlapping the one before it, with at least two tests of the top
  or the bottom. A test is a high or low near the edge that closes back inside.
- **Push:** a swing high above the previous swing high, or a swing low below the previous swing low.
- **Average body:** the mean body size of all window bars before the bar being judged, with at least 5 bars.

**Scan rows** (seven, in this order):

| Check | Rule | Statuses |
| --- | --- | --- |
| Trend | Swing highs and lows rising or falling. Strong when at most 1 of the last 15 closes is on the wrong side of the 20-day average | Strong up, Strong down, Up, Down, Not seen |
| Breakout | A close beyond the box, with a body at least 1.5 × the average body and a close in the outer quarter of the bar's range. Report the body and volume ratios | Found, Not seen |
| Breakout test | A later bar comes back near the breakout level while closes stay beyond it | Held, Not seen |
| Measured move | Breakout level plus the box height. Report how far the high came from it | Near, Watch, Not seen |
| Climax run | Bars in a row with no lower low (or no higher high). 10 or more is a climax | Climax, Not stretched |
| Wedge | Three pushes in one direction. Two pushes is "Watch" | Found, Watch, Not seen |
| Failed breakout | A close back inside the box after a breakout | Found, Not seen |

The box is an input to these checks and a drawing, not a scan row. "Prices the chart marked" is its own card:
the measured-move level, the month high and low, the 20-day average and the breakout level.

**Drawings:**
- the shaded box, with its height and the box floor as a dashed line;
- the breakout level as a solid line;
- a dashed trend line through the swing lows (or highs);
- the 20-day average;
- the measured-move level, with a "+$N" arrow;
- lettered marks (A, B, C, ...) that a key under the chart explains.

Up days are blue (`--s4`) and down days clay (`--s5`). Phones keep the drawings, use shorter labels and drop the
trend-line label.

**When a pattern is missing:**
- **No box this month:** Breakout, Breakout test, Measured move and Failed breakout say "Not seen: no trading range
  this month". The chart draws the candles, the 20-day average and the trend line (if Trend is found). The story
  uses the trend wording. The levels card lists the month high, month low and 20-day average.
- **5 to 20 bars** (recent listing): draw what exists. Pattern rows say "Not seen: only N trading days since listing".
- **Fewer than 41 bars:** no 20-day average, with the reason.
- **No price data or no licence:** keep the chapter and its cards, and show "Not disclosed: no licensed price data
  for this date" in each. The P/E history and 52-week rows in chapter 07 say the same.

**Wording:** call it the "measured-move level", not a target. State the base rates from the book as constants:
- about 4 in 10 early reversal patterns are followed by a real reversal, and about 6 in 10 after a strong breakout;
- about 3 in 4 rising channels break their lower trend line;
- markets tend to try things twice.

Credit the rules to Al Brooks, and say plainly that the chapter describes the chart and is not a trading signal.

## 6. Chart rules

- **Chart type follows the data's job:**
  - columns for amounts over years;
  - lines for rates;
  - ranked bars for shares;
  - a donut only for six parts or fewer;
  - a range chart for value;
  - a grid for sensitivity;
  - a waterfall for a bridge.
- **Marks:** one y-axis per chart, never two. Thin marks and 4px rounded bar ends (3px on the narrow daily volume bars).
- **Titles:** the card title is a conclusion sentence ("Share count down 35% since 2015"), and the subtitle gives
  the units.
- **Labels:** label only the latest value, except bridges (label every step) and the one bar a title is about (the
  breakout day's volume). Labels over marks get a halo in the card colour. Year ticks are counted back from the
  last year so the spacing stays even.
- **Interaction:** every chart has a hover or tap tooltip. Charts drawn from a data series also have a "Show
  table" view and a source line.
- **Colour:**
  - Palette in fixed order: gold, plum, sage, blue, clay, teal (`--s1` to `--s6`), validated for colour-blind
    readers in light and dark.
  - Light mode uses the report paper tokens (`docs/pulse-report/DESIGN.md`), and dark mode the Android app tokens.
  - Faded marks mean "needs phase 3".
- **Phones:** no horizontal scroll at 360px, and tables become stacked label and value blocks.

## 7. Same depth for every company

- **Fact pack:** one per company per filing, built by jobs before anyone asks, from the same sources for every
  company:
  - SEC company facts, XBRL notes, 13F, Forms 3/4/5, 13D/G, proxy and 8-K;
  - World Bank and GLEIF;
  - later, licensed prices.

  A Deep Dive only reads the fact pack, calculates and draws.
- **Coverage score:** each report counts how many of its fields were filled, and shows the gaps in Sources.
- **Report check** (to build with Phase 1). It refuses to store a report unless:
  - all 13 chapters are present with a verdict, chapters 01 to 11 also have a story and an upshot, and Bottom line
    has an upshot;
  - the filing period is known (no `LATEST_UNKNOWN`);
  - every number in the text passes one of these:
    - it equals a fact-pack field;
    - it equals a `derived.*` field after rounding to the shown precision;
    - it is in `REPORT_CONSTANTS`: form and 8-K item codes, fiscal-year labels, "Chart N", "20-day",
      "S&P 500/400/600", and the base rates in section 5.

    Word fractions ("four in five", "twice") must come from a field.
  - every "Chart N" points to a titled card in the same chapter;
  - no banned word, em dash or exclamation mark appears.

  It sits beside `assertIncomingAnalysisReport` (`supabase/functions/_lib/reports/validation.ts`, owned by M1).
  Changes there go through M1 or the coordinator.
- **Golden set:** about 10 very different companies are rendered on every change: a mega cap, a bank, a REIT, an
  insurer, a small loss-maker, a foreign filer, a recent IPO, a one-segment company and a many-segment company.
  Each is checked at 360, 390, 760 and 1000px, in light and dark, for:
  - no horizontal scroll;
  - no page errors;
  - no overlapping labels (text box check);
  - no empty cards.

## 8. Limits from the live runner (M2)

- **Storage and version:** the report body goes to bucket `report-artifacts` and must pass
  `assertIncomingAnalysisReport`. A new report shape needs a new `schema_version`, and any change to that string
  changes the fingerprint. The hard-coded `"2.0"` must change at the same time in two places, or nothing will be
  reused:
  - the reuse lookup in `_lib/jobs/service.ts` (M2);
  - the precompute planner in `_lib/evaluators/precompute.ts` (M3).

  Add the new shape checks to the validator (M1).
- **Run time:** a user-run Deep Dive, including claim, install and build, must finish within the workflow's
  10-minute timeout (`rebuild-deep-dive.yml`). The sweeper fails a job at 10.5 minutes.
- **Daily cap:** user dispatches share a global cap of 15 per UTC day (`DEEP_DIVE_DAILY_CAP`), and re-dispatches
  count. Precomputes run in sequence inside the daily precompute job and do not use that cap.
- **Completion effects:** they read report fields in `supabase/functions/_lib/jobs/effects/`:
  - kill switches;
  - contrarian anchor;
  - name relationships;
  - monitor snapshot;
  - conviction journal;
  - filing alerts.

  Keep those fields.
- **Fixture mode:** it stays the default until Razvan sets a model budget (AGENTS rule 11). Live Deep Dives return
  the fixture report today.

## 9. How the analysis stays thorough

Depth comes from data and fixed rules, not from a good run:
- every company gets the same fact pack;
- the same chapter list and the same templates;
- industry variants instead of empty cards;
- fixed rules for peers, ranks and kill switches;
- the report check and the golden set before any change ships.

A language model can make the wording richer in Phase 4. It never decides what goes in the report, and it never
adds a number.

## 10. Open decisions

| Decision | Status |
| --- | --- |
| Which phase to build first | Card posted 2026-11-23. Recommended: Phase 1 with Phase 2 data jobs alongside |
| Licensed prices (price box default, price action, P/E history) | Needs a quote and Razvan's OK. No free plan allows display to paying users |
| Model budget for Phase 4 | Not set, so fixture mode stays |
| App screen shows the web report | Not allowed by D3 today. Needs a new decision from Razvan |
| Reuse until the next filing; one open job per ticker | Agreed by Razvan 2026-11-24. Requested from M2 |
| Header stance pill | The mockup shows "Stance: Neutral, watch margins". Under rule 6 it becomes a plain summary of what to watch, with no rating words. Confirm with Razvan when building |

## 11. Where the mockup differs from this file

The mockup was approved for its look. Build from this file where they differ:
- **Dates:** the sample dates come from before rule 2. The price month (18 Sep to 16 Oct 2026), the events up to
  30 Jul 2026 and the 30 July guidance all fall after the fiscal 2025 filing.
- **Price box:** it opens at an example price of $191 with a note about live prices, not at `price_at_filing`
  (rule 3).
- **Labels and symbols:** "Your kill switches", "a kill switch you can turn on", "Measured-move target", "Levels to
  watch", the stance pill, a dash in the Americas currency cell and a "!" watch icon.
- **Missing table views:** some chart cards have no "Show table" or source line (scorecard, channel and ownership
  bars, P/E line, heat grid).

## 12. How this design was made

1. **2026-11-23.** Razvan asked for an elegant, clearly sectioned Deep Dive with many charts:
   - past years and forecasts;
   - countries, customers, suppliers and stakeholders;
   - price analysis;
   - free data where possible.

   The audit of the rebuild branch found PDF overlaps, a cramped phone layout, lost non-English characters and a
   silent wait.
2. Free-data licences were checked:
   - SEC data is free.
   - World Bank is CC BY 4.0.
   - IMF needs permission.
   - OpenSanctions is non-commercial.
   - No free price plan allows display.

   The plan doc has the full list.
3. A working mockup was built on sample Apple data:
   - a chart kit and a validated palette;
   - screenshots at phone, tablet and desktop widths in both themes, with each overlap fixed before publishing.
4. **2026-11-24.** Razvan asked to keep the exact format and add a one-month price action chapter with the patterns
   drawn, plus more verbose, story-like text.
   - The text was written chapter by chapter.
   - A separate reviewer checked every number against the data.
   - A final review looked for layout defects and for contradictions between chapters.
5. Razvan then set rules 1 and 2: one shared report per filing, frozen at the filing date, including the price parts.
