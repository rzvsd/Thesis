# HANDOFF from WP-A (Today: Home, Pulse, Weekly digest)

Changes needed outside WP-A's files. Each item gives the file, the change and the reason.

> **Integrator:** spec 6.0 rule 1 puts handoffs in the PR description. Move this file's content into the PR-3
> description and delete `HANDOFF-A.md` before `redesign/pr3` merges (it must not land in `rebuild`).

## WP-INT: `ui/shell/ShellDestinations.kt`

1. **TodayHome → HomeScreen: wire the new parameters.** All of them have defaults, so today's call still compiles.
   - `refreshing = state.isPulseRefreshing || state.isMacroRefreshing`
     - The header hairline, the pull-to-refresh line and the no-cache skeleton read it. Without it Home never shows a skeleton, and a pull shows no refresh line.
   - `snapshotDeltas = state.snapshotDeltas`
     - Feeds "since your last visit": state changes, "+4 since Tue" and the names headline.
   - `notedTickers = state.allNotes.mapNotNull { it.ticker?.uppercase() }.toSet()`
     - Draws the NoteMark on name rows.
   - `onOpenName = actions::onOpenName`
     - A name row opens Name (container transform). The fallback today is the Names tab.
   - `onOpenPulseAt = { kind -> actions.onOpenPulse(null) /* + chapter */ }`
     - Home's chapter rows and the tape open the Pulse at a chapter. To carry the chapter, add it to `Destination.Pulse` (or a one-shot field) and pass it to `PulseScreen(initialChapter = …)`.
   - `pulseExpectedAt = <Instant the next issue is due>` (an `Instant`, not a formatted string)
     - Only when the schedule is known. It fills the no-Pulse state: "Expected by 06:30." while that time is ahead,
       "Today’s Pulse is running late / It was due by 06:30." once it has passed. On a weekend or an exchange holiday Home says "No
       Pulse today: US markets are closed" with the next issue's day instead, whatever is passed.
   - `onAddName = { <Names tab with the add field focused> }` (spec 5.6)
     - The empty names state's "Add a name". Needs a one-shot "focus the add field" flag on the Names destination
       (WP-INT, with WP-B's Names screen reading it). Until it is passed, the button falls back to `onManageNames`
       (the Names tab, field not focused).
   - `onRetryMacro = actions::onRefreshMacro`
     - The macro card's "Try again" reloads macro stress, and the pull runs `onRetryPulse` and `onRetryMacro`
       (spec 5.6). Until it is wired the macro error card has no retry button: before, it was bound to
       `onRetryPulse`, which never reloads macro stress.
   - `pulseFailure = state.pulseFailureKind` (needs a new `UiState` field, see item 7)
     - The cached-copy banner says "Offline · showing 07:02" only for `RefreshFailureKind.OFFLINE`, else
       "Couldn’t refresh · showing 07:02"; the Pulse error state shows the offline copy only for OFFLINE. Home no
       longer matches the error text ("No internet connection"), the anti-pattern 5.12 removes.
   - The parameters that moved off Home are still accepted but unused: `lastViewedReport`, `onResumeLastViewed`, `onDismissResume`, `onOpenHistory`, `onOpenWeeklyDigest` and `onRunDeepDive`. Spec 5.6 moves "Continue reading" to Research > Recent and Weekly digest / History to Research > Tools. Remove the arguments once those entries exist there.
2. **Destination.Pulse: drop the `Box(Modifier.padding(padding))` wrapper and pass `padding = padding` to `PulseScreen`.**
   - Why: the HeroBand (`underTopBar = true`) and `ThesisTopBar` apply the status-bar inset themselves. Inside the padded Box the band would start below the status bar and add the inset again (spec 2.7, HeroBand screens rule).
   - Also pass these, all defaulted:
     - `loading = state.pulseReport == null && state.isPulseRefreshing`
     - `error = state.pulseError`
     - `refreshing = state.isPulseRefreshing`
     - `isExporting = <export in flight>`
     - `exportDoneAt = <epoch ms of the last export that succeeded>` (any value that changes per successful export).
       The confirm haptic plays only when it changes, never when an export fails (4.7: confirm = "export done").
       Failures stay with the platform's error toast; a `reject()` there is the shell's call.
     - `pulseFailure = state.pulseFailureKind` (item 7): with `error` set and a cached issue shown, the hero says
       "Offline · showing 06:30" or "Couldn’t refresh · showing 06:30", as Home does.
     - `monitorSnapshots = state.monitorSnapshots`
     - `onOpenName = actions::onOpenName`
     - `initialChapter`, see item 1
     - Optionally `onCopyText` (a platform toast after copying). Without it the screen writes to
       `LocalClipboardManager` (Android 13+ shows its own clipboard notice). No haptic for a copy: 4.7 keeps
       `confirm` for a note saved, an export done and a Deep Dive ready.
     - `onOpenSource` is optional: the default is `LocalUriHandler`.
   - `PulseScreen` calls `HeroUnderBars(collapsed)` itself.
3. **Destination.WeeklyDigest: drop the `Box(Modifier.padding(padding))` and pass `padding = padding`.**
   - The screen pads its list under its own `ThesisTopBar`, and the bar applies `TopBarInsets`.
   - Also pass:
     - `sentimentHistory = state.sentimentHistory`
     - `alerts = state.alertLedger`
     - `reportSummaries` (the cached report summaries by report id)
     - `onOpenReport = actions::onOpenReport`
     - `onOpenName = actions::onOpenName`
     - `onOpenInbox = { category -> <Inbox filtered by category> }`
     - `onOpenPulse = { actions.onOpenPulse(state.pulseReport?.cycleEnd) }`
     - `loading = <the first load of the cached state is in flight>` (for example
       `state.sentimentCurrent == null && state.isMacroRefreshing`): with nothing cached yet the digest shows a
       skeleton instead of "Nothing to sum up yet". The digest has no error state: it never fetches.
   - Until these callbacks are wired, the rows they open are plain text (no button role, no press), and "Open the
     Pulse" is left out. Same on the Pulse: without `onOpenName` its name rows are text (a tap never starts a
     Deep Dive build any more).
   - `stateChanges` needs item 4.
4. **Weekly state changes (spec 5.5 / 5.8 item 6).**
   - Change: a `List<SnapshotDelta>` of each followed name's current monitor reading against its reading at or before now minus 7 days, from the local snapshot history. The `snapshotDeltas` builder already compares against a reference time, so it can take "7 days ago" as that time.
   - Why: until this is passed, the "State changes" KPI reads "Not computed" and the section says "State changes appear once Thesis has a week of readings".
5. **Remove the shell's interim Today refresh `LoadingHairline` under the root bar.**
   - Why: Home now shows its own refresh line, either the `ScreenHeader` hairline or the pull line. Two lines at once break rule 10 (one infinite animation).
6. **`LocalTodayClock` (`ui/today/TodayTime.kt`) defaults to the system clock.**
   - No change is needed in the app.
   - Renders and tests provide `TodayFixtures.clock` together with a matching `LocalFmt`.
7. **`UiState.pulseFailureKind: RefreshFailureKind?`** (`MainViewModel.refreshPulse`, around line 1743).
   - Set it to the `failureKind` already computed there (null on success), and pass it to Home (item 1).
   - Why: `pulseLoadedFromCache` is true after any failure, including a 5xx while online, so Home cannot tell
     "offline" from "the server failed" without it.

## Before PR-3 merges: navigation that moved off Home (WP-E and WP-INT) — merge blocker

WP-INT confirms these rows exist before the PR-3 rubric review; WP-E's checklist must carry them.

Spec 5.6 moves three entries off Home, and Home no longer shows them. Their new homes are WP-E's (5.12):

- **Research > Tools must list "Weekly digest" and "History".** Today Home was the digest's only in-app entry; until
  the Tools rows exist it is reachable only from the weekly push notification and deep links (an R1 regression).
- **Research > Recent reports must start with "Continue reading"** (`onResumeLastViewed` / `onDismissResume`).
  Home was its only caller.
- Once both exist, WP-INT drops `lastViewedReport`, `onResumeLastViewed`, `onDismissResume`, `onOpenHistory`,
  `onOpenWeeklyDigest` and `onRunDeepDive` from the `HomeScreen(...)` call.

## WP-K: kit proposals (rule 6.0.3)

- **`TickerRow(line2MaxLines: Int = 1)`** (round-3 and round-4 review, rubric A4, a starred item) — **PR-3 merge gate:
  the integrator blocks the PR-3 merge until this lands and WP-A's follow-up below is done.** Home's "Your names" line 2 is the reason a
  name matters, a sentence. The kit sets it on one line up to 1.3x, so at 1.3x even a 34-character reason ("Customer
  concentration rose again.", about 292 dp) does not fit the 278 dp left beside a two-character caption on a 412 dp
  phone. WP-A's interim (`fitNameRows` in `HomeScreen.kt`) measures each row against the real width and font scale:
  long captions, then compact ones ("−1", "Report · 23d"), then without the report age; and the reason's longest
  form that fits whole (the sentence, then cut at a clause or before a trailing phrase, `PulseText.rowForms`). That
  keeps every reason whole at 412 and 360 dp at 1.0x (tested), but not at 1.3x. With the parameter, Home passes 2
  and sets `REASON_LINES = 2` in `HomeScreen.kt`; then un-ignore `nameReasonsAreWholeAt412And1_3x` and
  `...At360And1_3x` in `TodaySemanticsTest`. Above 1.3x the kit already allows 2 lines, but at 2.0x on a 360 dp
  phone a reason still ellipsizes ("Customer / concentration rose …"); the kit should allow 3 lines above 1.3x
  (`line2MaxLines` + 1 there), which holds it. Spec 3 #11 says "1 line" for line 2: the spec owner updates it to
  "up to 2 lines" for the comfortable row.
  - WP-A's follow-up once it lands: `REASON_LINES = 2`, `REASON_LINES_LARGE = 3`, pass `line2MaxLines` from
    `NamesBlock`, un-ignore the two tests, and let `fitNameRows` keep the long captions ("−1 since 17 Nov") at
    412 dp and 1.0x (with two lines every reason fits beside them), so a score change is never shown without its
    reference period. Until then the compact "−1" is anchored only by the section headline ("…changed since your
    last visit").
  - Why no in-scope workaround is left: both cut reasons ("Customer concentration rose again.", "Search revenue
    held its growth rate.") have no clause to cut at; dropping words ("rose again" → "rose") changes what the
    sentence says, and dropping the score caption hides data. A hand-built row outside the kit would fork #11.
- **Scroll-spy reading line (`rememberScrollSpy`, optional).** The spy selects a chapter once its start crosses
  45% of the viewport. After a jump lands a short chapter under the pinned pills, the next chapter's start has
  already crossed that line. WP-A now holds the tapped (or opened-at) chapter's pill until the list moves from the
  landing (`PulseScreen.jumpTo`), so the selection is right. Once the reader scrolls on, the spy takes over and may
  select the next chapter after a scroll of a few pixels. A `readingLine` offset measured from below the pinned
  pills would make the spy itself agree with the landing.

- **`TickerRow(onClick: (() -> Unit)?)`**: non-interactive when null (no role, no press). WP-A's interim is
  `Modifier.inert(...)` in `ui/today/TodayRows.kt` (clears the row's semantics to one text description and consumes
  only the down event, so a drag still scrolls). With the kit change it goes away.
- **Promote `CategoryCountRow`** (`ui/today/TodayRows.kt`): a category square, a label and a tabular count, the
  anatomy spec 5.8 item 7 asks for as "DataRows (category square, count)". Either as its own row, or as
  `DataRow(leading = color)`. The Inbox can reuse it for its category filters.
- **Opaque pinned `ChapterPills`.** The pinned pills use `barBackground` at `BAR_ALPHA` 0.92; on the Pulse the
  32 sp chapter headlines scroll under them and show through between the chips as ghost text. Either a pinned
  variant of `ChapterPills` that is opaque, or `barBackground(opacity = 1f)` for the pills band. WP-A does not change
  kit files.
- **Ticker links in prose (5.25, rubric K1).** Story paragraphs and list items on the Pulse can name a ticker ("AAPL
  filed a new 8-K."). A `HighlightText`/`ClickableText` variant that links whole-word tickers from a given set to
  Name would let every visible ticker open Name. WP-A now leaves out of What changed every event whose ticker
  "Your names" already shows (those rows do open Name), so few remain.
- **Promote `PulseChapterRow`** (`ui/today/TodayRows.kt`): a title over one sentence (2 lines) with a coverage badge
  only when incomplete. Home's Today's Pulse uses it; Research's "Recent" rows have the same anatomy.

## Notes for the PR description

- **Spec owner sign-off needed (list for the PR description):** Markets "Show table" not added (below); weekly
  digest says "New reports", not "New filings" (below); Home names use the compact caption ("−1") at 1.0x until
  the TickerRow kit change lands (above); copy actions on the Pulse play no haptic (4.7, above).
- **No-Pulse state on Home (5.6, honest copy):** the spec title "Today’s Pulse arrives before the open" only while
  the open (and any due time) is still ahead; once the due time has passed, "Today’s Pulse is running late / It was
  due by 06:30."; once the market is open with no due time known (or one still ahead), "Today’s Pulse has not
  arrived yet".
- **Pulse and digest skeletons:** built as the final layout, as Home's is: the Pulse hero as eyebrow, two
  `heroLine` lines and the meta line (no `SkeletonHero`: its KPI grid is not in the brief's hero), then the first
  chapter's header and four rows in their `RowGroup` card; the digest's rows sit in their `RowGroup` card.
- **Home macro card:** "MACRO STRESS" is the card's eyebrow in every state (loaded, no reading, error), so a state
  change never moves the label in or out of the card. The error state is a `ThesisCard` with that eyebrow, the
  "Couldn’t load macro stress" title and "Try again", announced politely like the kit `ErrorState`.
- **Home's Pulse row for Your names** names the tickers ("AAPL and MSFT are in this issue"; up to three, then
  "and 2 more"); the Pulse chapter keeps its count headline, with the rows under it.
- **What changed without prose:** the count headline counts the events listed under it (the events "Your names"
  already shows are neither listed nor counted).

- **Home's skeleton (5.6, deliberate deviation):** the spec lists `SkeletonHero` + skeleton tape + 3 skeleton rows.
  Home has no HeroBand, so `SkeletonHero` would mis-shape the header; the skeleton is the final layout in skeleton
  form instead (eyebrow, two headline lines and the meta as `SkeletonText`, the tape as one text line in its 44 dp
  band, three rows in their `RowGroup` card) plus a `SkeletonCard` for the macro card, so nothing jumps when the
  data lands.
- **Home's Pulse kicker (5.6, honesty):** "Today’s Pulse" only over today's issue. An earlier issue (a weekend, a
  holiday, or before the next issue) is headed with its date, "Pulse · Fri 20 Nov", and the copy that said "today’s"
  about the issue now says "this issue" ("This issue has 5 chapters", "4 markets on this issue’s tape", "2 of your
  names are in this issue").
- **Home's names captions (5.6, 3 #11):** "+4 since Tue" and "Report · 23 days ago" as the spec shows when the
  reasons fit beside them; the compact "+4" and "Report · 23d" (then no report age) when they would cut a reason.
- **Cached-copy banners:** Home says "Offline · showing 06:30" for today's copy and "Offline · showing 06:30, Fri
  20 Nov" for an earlier one. The Pulse hero's banner says "Couldn’t refresh · showing this issue": its meta line
  right above already gives the time, and its eyebrow the date.
- **Home tape (5.6):** filtered to the briefing's six instruments by instrument id, else family: S&P 500, the
  Nasdaq (the Nasdaq 100 when the tape carries it, else the Composite), the 10-year, the VIX, the dollar (DXY, else
  the broad index) and WTI. The Pulse's Markets chapter keeps the whole tape.
- **Home eyebrow:** the phase word is New York's and is shown only when the device's date equals New York's date
  (else the eyebrow is the date alone, the "left out when unsure" rule). The eyebrow wraps only at " · ".
- **Signal and Noise (5.7):** side by side from 400 dp of window width (368 dp of content inside the gutters), so a
  412 dp phone shows them side by side; a 360 dp phone stacks them.
- **Weekly digest "New reports" (5.8):** the count comes from `ThesisMonitorSnapshotView.reportGeneratedAt`, when
  Thesis built the report, not when the company filed. The copy says "new reports", not "filed", until the snapshot
  carries a filing date (see "Later").
- **Pulse What changed (5.7):** prose sections are story paragraphs; the macro reading is a sentence with the series
  in reader words ("led by consumer prices and the 10-year Treasury yield"; an unknown series label drops the list);
  the issue's event list (filings, releases) is a compact list, without the events "Your names" already shows. An
  event is never the chapter headline: without prose it is a count ("2 filings and 1 macro release in this issue").
- **Pulse Sources:** "This issue cites N references" (a count, no claim that every figure is traced); one
  "Coverage" label over the notes in reader copy ("Sector leadership was not available for this issue."),
  near-duplicates dropped; sources that share a label are qualified ("SEC EDGAR · AAPL 8-K").

- **Pulse, Markets, "Show table" (5.7) — needs the spec owner's sign-off in the PR description:** not added. The `DataRow` group already is the table (instrument, level,
  change and % change, tabular, `marketTone`); a "Show table" toggle would show the same four columns a second
  time. "Copy as table" stays (tab-separated, pastes into a spreadsheet).
- **Home's fallback title:** "Good morning / afternoon / evening" by the local hour, not always "Good morning" (5.6):
  at 20:00 "Good morning" would be wrong. Shown only when there is no Pulse.
- **Home's headline:** the morning line is measured against the real width and font scale and shortened at its last
  clause boundary that fits two `headline` lines (never mid-word, no ellipsis); `PulseText.fitHeadline`.
- **Weekly digest states:** loaded, empty and loading (skeleton). No error state: it is built only from cached state.
- **design-lint:** one reviewed allowlist entry, Home's once-a-minute clock tick (`delay(wait)`), not motion timing.

## Tests outside WP-A's files — WP-INT acknowledgment needed (rule 6.0.1)

WP-INT (owner of `design-preview/**` and `tools/design-lint*`) acknowledges both edits below in the PR description:

- `tools/design-lint-allow.txt`: one entry for Home's once-a-minute clock tick (`delay(wait)` in `HomeScreen.kt`),
  wall-clock time for the eyebrow's market phase, not motion timing.

- `design-preview/.../MotionBehaviourTest.kt`, test `homeKeepsItsBlocksWhenThePulseIssueLoadsAfterTheFirstPaint`.
  - What changed: this is a minimal edit. The test wraps Home in `TodayLocals` (the fixed clock), finds the header by its new eyebrow ("TUE 24 NOV · PRE-MARKET") and finds the macro card by `TodayCopy.MACRO_NO_READING`. Before, it used the old date format and `Phase4Copy.todayMacroStressSourceNote`, which Home no longer shows.
  - What it checks is unchanged: the blocks don't blank when the issue lands after the first paint.
  - The harness owner (WP-INT) acknowledges this edit in the PR description. The eyebrow string comes from
    `TodayCopy.eyebrow(...)`, so the test follows the copy (it now carries no-break spaces and a non-breaking hyphen).

## Harness note (WP-INT / harness owner)

- A full-page render taller than 2400 dp (Pulse at 4800 dp) once deadlocked in `ImageComposeScene` (Recomposer lock against BroadcastFrameClock lock, test worker against the AWT EventQueue). `today-pulse-full` therefore renders at 2400 dp. The deadlock is a Compose Desktop 1.6 issue, not caused by the screen.

## Later (needs Razvan, from the spec)

- Headline times on the Pulse (5.7 "rows with source + time"): `EvidenceView` has no timestamp (source, excerpt,
  url only), so `Headline.at` stays null and the row shows the source alone. Needs `published_at` or
  `retrieved_at` on evidence in the Pulse payload (then `Models.kt` / `ProductApiClient`, WP-INT).

- The Pulse's "Compare with previous issue" (P2) needs `getPulseByDate(previous)`.
- Notes on the Pulse need a notes table.
- A filing date on `ThesisMonitorSnapshotView` (or the report summary) before the weekly digest can say a name
  "filed" this week; until then it counts new reports (spec section 8).
- A real weekly payload is needed for the week's index performance, the best and worst names, and next week's catalysts.
