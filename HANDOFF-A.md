# HANDOFF from WP-A (Today: Home, Pulse, Weekly digest)

Changes needed outside WP-A's files. Each item gives the file, the change and the reason.

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
   - `pulseExpectedAt = "06:30"` (formatted with `LocalFmt.time`)
     - Only when the schedule is known. It fills the no-Pulse state's "Expected by" line.
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
     - `monitorSnapshots = state.monitorSnapshots`
     - `onOpenName = actions::onOpenName`
     - `initialChapter`, see item 1
     - Optionally `onCopyText` (a platform toast after copying). Without it the screen writes to `LocalClipboardManager` and plays the confirm haptic.
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

## Before PR-3 merges: navigation that moved off Home (WP-E and WP-INT)

Spec 5.6 moves three entries off Home, and Home no longer shows them. Their new homes are WP-E's (5.12):

- **Research > Tools must list "Weekly digest" and "History".** Today Home was the digest's only in-app entry; until
  the Tools rows exist it is reachable only from the weekly push notification and deep links (an R1 regression).
- **Research > Recent reports must start with "Continue reading"** (`onResumeLastViewed` / `onDismissResume`).
  Home was its only caller.
- Once both exist, WP-INT drops `lastViewedReport`, `onResumeLastViewed`, `onDismissResume`, `onOpenHistory`,
  `onOpenWeeklyDigest` and `onRunDeepDive` from the `HomeScreen(...)` call.

## WP-K: kit proposals (rule 6.0.3)

- **`TickerRow(onClick: (() -> Unit)?)`**: non-interactive when null (no role, no press). WP-A's interim is
  `Modifier.inert(...)` in `ui/today/TodayRows.kt` (clears the row's semantics to one text description and consumes
  only the down event, so a drag still scrolls). With the kit change it goes away.
- **Promote `CategoryCountRow`** (`ui/today/TodayRows.kt`): a category square, a label and a tabular count, the
  anatomy spec 5.8 item 7 asks for as "DataRows (category square, count)". Either as its own row, or as
  `DataRow(leading = color)`. The Inbox can reuse it for its category filters.
- **Promote `PulseChapterRow`** (`ui/today/TodayRows.kt`): a title over one sentence (2 lines) with a coverage badge
  only when incomplete. Home's Today's Pulse uses it; Research's "Recent" rows have the same anatomy.

## Notes for the PR description

- **Pulse, Markets, "Show table" (5.7):** not added. The `DataRow` group already is the table (instrument, level,
  change and % change, tabular, `marketTone`); a "Show table" toggle would show the same four columns a second
  time. "Copy as table" stays (tab-separated, pastes into a spreadsheet).
- **Home's fallback title:** "Good morning / afternoon / evening" by the local hour, not always "Good morning" (5.6):
  at 20:00 "Good morning" would be wrong. Shown only when there is no Pulse.
- **Home's headline:** the morning line is measured against the real width and font scale and shortened at its last
  clause boundary that fits two `headline` lines (never mid-word, no ellipsis); `PulseText.fitHeadline`.
- **Weekly digest states:** loaded, empty and loading (skeleton). No error state: it is built only from cached state.
- **design-lint:** one reviewed allowlist entry, Home's once-a-minute clock tick (`delay(wait)`), not motion timing.

## Tests outside WP-A's files

- `design-preview/.../MotionBehaviourTest.kt`, test `homeKeepsItsBlocksWhenThePulseIssueLoadsAfterTheFirstPaint`.
  - What changed: this is a minimal edit. The test wraps Home in `TodayLocals` (the fixed clock), finds the header by its new eyebrow ("TUE 24 NOV · PRE-MARKET") and finds the macro card by `TodayCopy.MACRO_NO_READING`. Before, it used the old date format and `Phase4Copy.todayMacroStressSourceNote`, which Home no longer shows.
  - What it checks is unchanged: the blocks don't blank when the issue lands after the first paint.

## Harness note (WP-INT / harness owner)

- A full-page render taller than 2400 dp (Pulse at 4800 dp) once deadlocked in `ImageComposeScene` (Recomposer lock against BroadcastFrameClock lock, test worker against the AWT EventQueue). `today-pulse-full` therefore renders at 2400 dp. The deadlock is a Compose Desktop 1.6 issue, not caused by the screen.

## Later (needs Razvan, from the spec)

- Headline times on the Pulse (5.7 "rows with source + time"): `EvidenceView` has no timestamp (source, excerpt,
  url only), so `Headline.at` stays null and the row shows the source alone. Needs `published_at` or
  `retrieved_at` on evidence in the Pulse payload (then `Models.kt` / `ProductApiClient`, WP-INT).

- The Pulse's "Compare with previous issue" (P2) needs `getPulseByDate(previous)`.
- Notes on the Pulse need a notes table.
- A real weekly payload is needed for the week's index performance, the best and worst names, and next week's catalysts.
