# PR-3 integration (WP-INT)

This note covers the merge of `wp/pr3-A` to `wp/pr3-G`, applied in that order with `--no-ff`. The other handoff files in this folder each list one WP's requests. This note says which of those requests the integrator applied and which wait for later work. Paths are relative to `apps/mobile/android/app/src/main/java/com/thesis/mobile/`.

## Applied

### Navigation and shell

- **Destinations.**
  - `Destination.Pulse(date, chapter)` opens the Pulse at a given chapter.
  - `Destination.Name(ticker, pagerScope, anchor)` takes an anchor, `ANCHOR_NOTES` or `ANCHOR_CHANGES`.
  - Back stacks saved by the PR-2 build still decode (`DestinationCodecTest`).
- **`AppNavigator`.** One-shot requests for Names ("focus the add field", "open the import panel") and for the Inbox category filter.
- **`ShellActions`.** Every screen callback the WPs asked for is now a member, with a default. `MainViewModel` implements all of them.
- **`ShellPlatform`.** Gains `shareText`, used for the notes export. `macroStressDashboard` is gone.
- **`UiState`.** New fields:
  - `authStatus`, a typed `AuthStatus` for WP-G's AuthScreen.
  - `pulseFailureKind`.
  - Inbox load error, sequence number and loaded flag.
  - `recentSearches`, persisted in `SessionStore`.
  - `reportSummaries`.
  - `weeklyStateChanges`.
  - The derived `companyNames`, `filingPeriods` and `notedReportIds`.
- **`ShellDestinations`.**
  - Every screen gets the parameters its WP asked for, including WP-E's new Compare reports, Compare names and Search entries, and WP-B's Name pager. (Corrected in review round 4: the Pulse's `isExporting` / `exportDoneAt` were not passed until then; its `onCopyText` / `onOpenSource` keep their defaults, the clipboard and the URI handler.)
  - `PendingScreen` is gone.
  - `DeepDiveScreenFor` passes `following`, `onFollowChange`, `openingStoredReport`, `building`, `ticker`, `jobStatus`, the `ReportOpeningBar` and `ReportHostExtras`. This covers HANDOFF-D 1 and 15 and HANDOFF-C 4.
- **`ThesisShell`.**
  - The paywall is a modal destination. `MainViewModel` opens it when a feature upgrade is published, and closes it when the feature is cleared.
  - Search draws its own bar.
  - War Room, Scenario stress and both Compare screens draw their own headers.
  - The shell draws a refresh line only over Research. The other roots draw their own.

### Screens (API alignment)

- **Home:** the PR-2 resume card, history and digest parameters are removed.
- **Settings:** the subscription offer parameters are removed.
- **Scenario stress:** the unused route callbacks are removed.
- **The Sentiment dashboard wrapper** (`MacroStressDashboardScreen`) is deleted.
- **`PlasmaOrb.kt` and the vico `compose-m3` dependency** are removed; nothing used them.
- **The preview stub `HoldingsCsvImportAction`** (HANDOFF-B 21) and the unused `Phase4Copy.names*` strings (B22) are removed.

### Kit (WP-K requests, applied by the integrator)

- **`TickerRow`:**
  - `onClick` is nullable. With null, the row is non-interactive.
  - `line2MaxLines` is new. The kit adds one line above 1.3x.
  - The company name is dropped when less than `Kit.tickerCompanyMin` (56 dp) is left for it.
  - WP-A's follow-up is done:
    - `REASON_LINES = 2` and `REASON_LINES_LARGE = 3`.
    - Home passes `line2MaxLines`.
    - `nameReasonsAreWholeAt412And1_3x` and `...At360And1_3x` run again.
    - The interim `Modifier.inert` is removed; Pulse and the weekly digest pass a null `onClick` instead.
  - Names' comfortable rows pass `line2MaxLines = 2`.
- **`ReportDock`:**
  - Each segment takes its label's intrinsic width, and spare room is shared equally. When the labels do not fit, the segments scroll sideways inside the pill.
  - Badges are one line.
  - Conviction now carries `ReportCopy.PRO_BADGE` for free accounts (HANDOFF-C 1 and 2).
- **`DockPanel`:** opaque, with `DOCK_PANEL_ALPHA = 1f` (HANDOFF-B, HANDOFF-C 7).
- **`ReportTopBar` and `ReportOpeningBar`:** `onFollowChange` and `onOverflow` are nullable. With null, the control is hidden (HANDOFF-D 9, HANDOFF-C).
- **`SinceLastReport`:**
  - `whyItMatters` sits on its own line and wraps instead of ellipsizing (HANDOFF-B, HANDOFF-E).
  - The eyebrow takes the kicker colour.

### Android-only files

These files are not compiled by the harness. They were written against Compose 1.6.8 and Material3 1.2.1:

- `MainViewModel`. The 250 ms ticker-suggestion debounce is on the design-lint allow list as a timing wait.
- `ThesisApp`. It adds the `shareText` chooser and removes `PreLoginInsets`.
- `SessionStore`.

## Deferred (not in this PR)

- **Container transform into a report (4.5):** list rows that open a *report* (History rows, Research's recent
  reports) keep the shared-axis push. The report WebView lives in the report base layer, under the tab layer, so a
  page cannot grow from a row over the list there without reordering the layers; that is shell work for PR-4. Rows
  that open Name (Names, Home) grow from the row (see "Review round 1").
- **A note search hit's exact entry:** Name opens scrolled to "Your notes", not to the matched entry: the kit
  `NotesTrail` exposes no per-entry positions (WP-K request: an entry key to bring into view).
- **Compare reports, a change's chapter (5.25):** a tapped change opens the newer report at its top. The change
  summary items (`DeepDiveTopChangeView`) carry no chapter, so there is nothing to pass to `Destination.Report`.
- **Compare names, "Share as image" (5.26, HANDOFF-E Skipped):** the overflow has "Copy as table" only. The share
  card's off-main-thread bitmap path (`renderShareCard`) draws the report's HeroBand, not a table; a table image
  needs its own Android-only renderer (PR-4).
- **Compare names table density (5.26, principle 13; WP-K):** with `onCellClick` the kit `CompareTable` raises every
  row to 48 dp, and at 412 dp the median and the fourth ticker sit behind "Swipe the table for …". The fix is a kit
  layout change: one 48 dp touch target per row over compact cells, and a column fit that keeps the median in view.
  Kept for the WP-K follow-up (with D8 below), because it changes the kit table every Research screen uses.
- **`MonthlyCoherenceSection` (HANDOFF-G 11):** kept, because renders still use it.
- **You page clock (HANDOFF-G 19):** the shell has no clock to pass yet.
- **Model, API and server items:** the filing form and filed date, fiscal year-ends, `valueDiscipline`, `five_year_trends`, kill-switch readings (HANDOFF-D 6), metric units (D10), the comparable report id and `thesisDrift` on summaries, and journal links (D14).
- **Optional kit polish:**
  - `CompareTable` column fit (D8).
  - `HeroBand` eyebrow rule and `KpiGrid` baselines (D12).
  - `InlineBanner` stacking at large scale (D18).
  - `Timeline` icons (D3).
  - An opaque pinned `ChapterPills`.
  - A scroll-spy reading line.
  - The `TickerRow` compact caption column and a rolling figure.
  - `CategoryCountRow` promotion.
  - The `Fmt` helpers.
  - Skeleton fill and `StageProgress` working flag.
  - Snackbar action order and dialog scroll.

## For the spec owner

- **Coverage claim (5.12 lede).** The spec's Research lede says "Read any US-listed company from its filings."
  while onboarding and the empty states use `ProductCopy.coverage` ("S&P 500 companies"), the copy file the product
  keeps true for the live coverage. Research now reads "Read S&P 500 companies from their filings." from
  `ProductCopy.coverage`, so one promise is made everywhere; please update the 5.12 lede to match (or change
  `ProductCopy.coverage` when the coverage widens, and every screen follows).

## Verification at the integration commit

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 454 tests, 0 failures, including `DestinationCodecTest` (new fields and
  PR-2 stacks) and `DeepDiveClassicModelTest.sampleAssetSpeaksTheProductVocabulary`.
- Renders, semantics and harness tests (`-PrendersOnly test`): 673 tests, 0 failures; 1,040 renders, dark and light.
  Two Today semantics tests were updated for the two-line reasons (`performScrollTo` before the macro retry tap) and
  the kit's non-interactive row (merged text instead of `inert`'s content description).
- `tools/design-lint.sh`: 0 findings, baseline 0 rows.
- `tools/gold-share.py`: 758 renders, max 7.50%, none at or above 8%.

## Review round 1

Fixes to the PR-3 review findings, in the integrator's files and, where a finding needed it, the screens and kit.

- **Watchlist remove failure (blocker).** `UiState.watchlistRemoveFailure` (a ticker and a sequence number) is
  published when a remove fails, also behind the feature flag; Names drops the ticker from its collapse and commit
  sets, so the row comes back. The `toList()` re-publish is gone.
- **First-load failures.** `watchlistLoadError` and `historyLoadError` are set in the loads' `onError` and cleared on
  success and logout; Names and History get them as `error`, so a failed first load ends on the failed state with
  Try again instead of an endless skeleton.
- **Inbox category from the weekly digest.** The Inbox applies `categoryRequest` in an effect and keeps the
  selection when the one-shot request is cleared (no `key` on it); the digest groups by `InboxModels.categoryKey`.
  Semantics test: the chip stays selected after the request is cleared.
- **Name after a restore.** `refreshHeldNameDetail()` rebuilds the held `nameDetail` when snapshots, history or
  alerts arrive, and refetches the summary when the new data names a report the first look did not find.
- **Compare names.** `ReportSummaryView.valueDiscipline` is cached with the summary and passed to the screen; with
  no score in any column the Discipline row is left out of the table and the TSV (render
  `research-compare-names-no-discipline` shows that production shape). Each ticker's report falls back
  to the open report and then the newest Deep Dive in the history (`compareNamesReportId`, unit-tested), so an
  unfollowed subject is no longer "No report yet". An "Open a name" line of ticker links opens Name.
- **Compare with.** The report dock's names picker is shared (`CompareNamesPickerSheet`): Name's overflow and the
  Names context sheet open it seeded with the ticker; Research > Tools opens it when more than four names are
  followed (up to four line up at once).
- **Name has one chrome row.** Name draws its own `ThesisTopBar` (back, the company name once the header scrolls
  away, the ticker under it, then the pager caption and arrows, follow and overflow); the shell gives it no bar
  (HANDOFF-B 15). The Monitor score tile carries the subject `Meter` (0 to 100) through a new `KpiSpec.meter`.
- **Name anchors.** `ANCHOR_NOTES` (Notes view, note search hits) scrolls to "Your notes" without focusing the
  editor; the new `ANCHOR_WRITE_NOTE` (the board's Write a note) focuses it; `ANCHOR_CHANGES` (drift alerts)
  scrolls to "Since the last report".
- **Container transform (4.5) for rows that open Name.** `AppNavigator.pushFrom(origin)` records the tapped row's
  bounds for the entry it pushes; the tab layer grows that page from the row over the list (300 ms) and shrinks it
  back on the pop (240 ms), with the list under the scrim (`ShellTransition.ContainerIn` / `ContainerOut`; reduced
  motion keeps the crossfade). Names and Home rows pass their bounds. Test: `ShellLayersTest`.
- **Names reasons wrap.** Comfortable rows let the reason wrap whole (`REASON_MAX_LINES`, a runaway bound only).
- **Dead legacy components deleted:** `SignalBadge`, `SectionAccordion`, `ConfidenceRing`, `EvidenceDots` and
  `ui/animations/StaggeredEntrance` (its MotionBehaviourTest case goes). With the last `Icons.*` call gone,
  `material-icons-extended` leaves `app/build.gradle.kts` (and the harness).
- **Smaller fixes.** The classic Deep Dive exports through `renderReportPdf` / `renderShareCard` off the main thread;
  Inbox rows drop the ticker the row's line 1 already shows (`InboxCopy.rowTitle`, unit-tested); Search re-issues a
  query restored after process death; an invalid API URL on Auth shows in its status line; a restored Paywall
  stays open and its purchases log its feature (corrected in review round 2: before that it closed on arrival); the SessionStore KDoc is back on `clearVisitMarkers`; Research's Continue reading
  resumes a past Pulse issue too; unfollowing from Name or the report bar says "Removed X from Names"; Home's
  headline says "changed state"; the what-if copy no longer says "rerun".

Kept as they are, with reasons:

- **Compare reports opens a change at its chapter.** `DeepDiveTopChangeView` has no chapter, so a change opens the
  report at the top (listed under Deferred).
- **A note search hit opens its exact entry.** `NotesTrail` has no entry positions; the hit scrolls to "Your notes"
  (WP-K request, listed under Deferred).
- **Container transform into a report.** The report WebView lives in the base layer under the tab layer, so the
  grow-from-row is done for Name only; reports keep the push (PR-4).

### Verification after review round 1

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 461 tests, 0 failures (new: `CompareNamesReportIdTest`,
  `InboxRowTitleTest`, the Discipline-row case in `CompareModelTest`).
- Renders, semantics and harness tests (`-PrendersOnly test`): 675 tests, 0 failures; 1,042 renders, dark and light.
- `tools/design-lint.sh`: 0 findings in 91 files, baseline 0 rows.
- `tools/gold-share.py`: 760 renders, max 7.50%, none at or above 8%.

## Review round 2

- **Name's "See alerts" opens this name's alerts (major, 5.11 item 3).** `AppNavigator.inboxTicker` is a one-shot
  request next to `inboxCategory` (`requestInboxTicker` / `clearInboxTicker`, cleared by `reset`);
  `ShellActions.onOpenInboxFor(ticker)` sets it and opens the Inbox root. `InboxScreen(tickerRequest, initialTicker)`
  scopes the list, chips, lede and counts to alerts that concern the ticker (own or related, as Name counts them)
  under a removable "× NVDA" chip (spoken "NVDA alerts only. Remove filter"); a ticker with none says
  "No alerts for X." with "Show all alerts". Renders `inbox-ticker`, `inbox-ticker-none`; semantics test.
- **Compare names, per-ticker errors.** `CompareNamesState.errors` (ticker to cause) is set when a name has a
  report that neither the cache nor the server gave back. Its column reads "Couldn't load", one Attention banner
  ("Couldn't load the MSFT report.") offers Try again, and "Build report" is offered only for a name with no report.
  Every column failed: the screen's ErrorState. Re-entry retries. Render `research-compare-names-column-failed`;
  unit test in `CompareModelTest`.
- **Thesis drift lands on one page.** A `names` push or Inbox-ledger route of type thesis_drift / contrarian_alert
  (or the drift category, for alerts) with a ticker pushes `Name(ticker, ANCHOR_CHANGES)` on the Names tab (the row
  stays pinned under it), where the Inbox's own drift route goes (5.25). Other Names links are unchanged (5.5).
- **Restored Paywall.** `init` publishes the restored `Destination.Paywall`'s feature before the first publish, so
  the modal stays open after process death; `purchaseFeature()` reads the published feature only.
- **Name re-open.** `onEnsureName` reopens a held name with no summary only when a report for it is now known, so
  coming back to a report-less Name no longer reloads it (no notes blink, no repeated `listReports`).
- **Container transform after rotation.** The shell reports its size (`AppNavigator.onWindowSize`); a change drops
  the saved origins, so the pop falls back to the shared axis. Unit test.
- **Name's note pins the report offline** (`saveNoteFor` calls `setDeepDiveNotePinned`, as `saveReportNote` does).
- **Follow says "Added X to Names"** (`NamesCopy.added`) from Name and the report bar; the Names board's own field
  (`onAddNameFromBoard`) adds the row in place without a snackbar.
- **DeepDiveScreen names no android.\* type (6.0 rule 5).** `ReportExporter` and `rememberReportExporter` move to
  the Android-only `ReportExport.kt` (preview stubs in `PreviewAndroidStubs.kt`); the classic report calls
  `exporter.fullReport / memo / shareCard(report)`.
- **No haptic on a copy (4.7).** Compare names, Compare reports and Macro Stress drop `confirm()` on "Copy as
  table"; the Copied check is the feedback.
- **Home Macro stress with fewer than two readings** shows "Score 0 to 100" (the scale is its reference). The
  `StatusBadge` stays: 5.6 item 5 lists it with the title, and it carries the band's tone.
- **SectionHeader at large font (kit).** From font scale 1.5 the trailing action moves under the headline, so the
  headline keeps the full width (render `today-home-360-2_0x`).
- **One net cash convention.** Both compare tables label the signed row "Net cash (debt)", as Name's years table.
- **Export memo in the report's words.** "Research memo"; "Model base case: $212.00 (model range $180.00 to
  $240.00)"; the paywall's list says "research memo".
- **Coverage.** Research's lede reads from `ProductCopy.coverage` (see "For the spec owner").
- **History first-load failure render** uses the production shape (`loaded = true`, error), so it shows Try again.

Kept for later, with reasons: "Share as image" on Compare names and the compare table's density (listed under
Deferred).

### Verification after review round 2

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 465 tests, 0 failures (new: the drift route, the Inbox ticker request,
  the window-size origins, the failed compare column).
- Renders, semantics and harness tests (`-PrendersOnly test`): 679 tests, 0 failures; 1,048 renders, dark and light.
- `tools/design-lint.sh`: 0 findings in 91 files, baseline 0 rows.
- `tools/gold-share.py`: 766 renders, max 7.50%, none at or above 8%.

## Review round 3

- **Name's margins (blocker).** Live reports store `gross_margin` / `operating_margin` as percents (the worker's
  fact-pack `percent()`: 46.9; the contract fixture's `operating_margin: 32.2`), and Name multiplied them by 100
  ("3,220.0%", "+7,000 bps"). `marginScale(rows)` (the renderer's per-report rule, moved from CompareNamesScreen to
  `screens/MarginScale.kt`) now normalises them once in `filingsFigures`: `operatingMargin` /
  `priorOperatingMargin` are percents, `FilingsFigures.marginPct()` scales the table's gross and operating rows,
  `marginDelta` takes percent points (the FCF margin, a computed fraction, is passed x100). The source sheet,
  "Show the last four years" and "Copy figures as table" read the same values. Name's years also read "FY2025" when
  the payload writes "2025-FY" (`periodDisplay`). `NamesFixtures` now uses percent margins, as `ResearchFixtures`
  and the live payload do; `NamesFixtures.contractAnnual` is the contract fixture's history, rendered as
  `name-contract-history` (asserts "32.2%", "+40 bps"). `NameModelTest`: percent rows ("32.0%", "+70 bps"), the
  legacy fraction shape on one scale, and the raw TSV.
- **Classic Deep Dive margins** (`FiveYearSeries.fromHistory`, the hero's history KPIs) use `marginScale(rows)` per
  report instead of the per-value guess, so a thin margin stored as a percent (0.8) is never drawn as 80%.
  `ClassicFormat.marginPercent` is gone. Unit test `fiveYearMarginsUseOneScalePerReport`.
- **Status chatter (C1, major).** Success messages are no longer sent: Loaded report from history, Loaded cached
  report (now "You're offline. Showing your saved copy of this report."), Loaded pulse for <ISO date>, War Room
  loaded, Login successful (log-in publishes `message = null`, so a stale "Session expired" cannot show once signed
  in), Scenario updated / stress run complete / stress run loaded, Opposite case ready, Subscription status
  refreshed, Search returned N result(s), Pulse PDF ready (the share sheet is the feedback), Biometric lock
  enabled / disabled (the switch is the feedback). Every remaining user-facing string the ViewModel publishes lives
  in `ui/copy/AppMessages.kt` in product vocabulary (Names, not watchlist or feature flag; Log in; no ISO date
  format; no "Please retry"), so the design lint's copy pass covers them. `AuthStatus.fromMessage` matches the
  first sentence of the same constants.
- **Inbox scope.** A category request (Weekly digest > Alerts by category) ends a name's scope (Name > See alerts)
  in `InboxScreen`, so the category is shown instead of silently dropped. "Mark all as seen" is offered on the
  whole Inbox only, never inside a name's scope (it marks every alert).
- **Pulse PDF off the main thread (P1).** `writePulsePdfExport` (ReportExport.kt) writes on Dispatchers.IO;
  `exportPulsePdf(onReady: suspend ...)` shares back on Main and reports a failure there as "The Pulse PDF could
  not be made."
- **One label for operating margin.** "Op. margin" is gone from both compare tables (`ROW_OPERATING_SHORT`
  removed); they say "Operating margin", as Name and the Deep Dive do.
- **Value discipline in one unit.** Compare names' cells and median both read "4 of 6" / "3.5 of 6" when every name
  has the same number of signals available; otherwise every cell and the median read as the share met ("65%"),
  the counts in the source sheet. Unit test.
- **Copy figures as table in plain numbers (principle 13).** Name's years (`filingsTsv`) and Macro Stress's
  readings (`MacroStressModels.tsv`) copy as Compare names / reports do: ASCII minus, no grouping, the unit in the
  label ("Revenue (USD bn)", "Score (0 to 100)", "Change (pts)"), an empty cell when missing, ISO dates for the
  spreadsheet. Unit tests.
- **Every visible ticker opens Name (5.25).** Compare reports shows "Open AAPL" under its header
  (`onOpenName`, wired in the shell; semantics test). A History Deep Dive row's long press opens a sheet with
  "Open report" and "Open AAPL"; the tap still opens the report (`ResearchRow.onLongClick`, `longPress()` haptic).
- **Names compact rows.** The state square sits in the leading column, as in the comfortable rows (state, ticker,
  figure, change, note); `CompactRowDividerInset` is now `LeadingRowDividerInset` at every scale. The spec's
  TickerRow line (section 3, #11) is updated to match.
- **Held Name detail.** `refreshHeldNameDetail` rebuilds or refetches only while a Name entry for the held ticker is
  on some stack (`AppNavigator.isOnAnyStack`); `onEnsureName` brings a held name up to date when its page comes
  back.
- **Paywall bookkeeping.** Every navigation that closes the modals goes through `closeModalsAndForget()`
  (`closeModals` + `forgetClosedPaywall`): Compare names / reports, Pulse, Pulse chapter, report, Deep Dive start.
- **Dead freshness text.** `HomeScreen(pulseFreshnessText)`, `UiState.pulseFreshnessText` and
  `formatPulseFreshness` (New York time, "Offline cache • Last updated ...") are removed.
- **Launcher.** The ten orphaned `mipmap-*/ic_launcher_foreground.png` / `ic_launcher_background.png` are deleted.

Not taken, with reasons:

- **Dropping the "N new" pill on comfortable Names rows.** It counts new *alerts*, which a changed state or a score
  delta does not say; the company name already gives way first (`dropBelow(Kit.tickerCompanyMin)`). Kept.
- **Legacy `ic_launcher.png` / `ic_launcher_round.png`.** With minSdk 26 they are never shown, but removing the
  only unqualified `@mipmap/ic_launcher` is a resource-resolution change no build here can verify (Google Maven is
  blocked). Left for a build-verified cleanup.

### PR-4 / WP-K tracking list (K1, M1)

Carried from Deferred, each with the change it needs:

1. **Done in PR-4b (WP-M).** ~~Report rows' container transform (4.5): History and Research's recent reports keep
   the shared-axis push.~~ Report rows grow into the report (`sharedBounds`, the report's cover while the bounds move).
2. **Done in PR-4b (WP-K)**, anchor `Destination.Name.noteEntryAnchor`. ~~A note search hit's exact entry:~~ Name opens at "Your notes". Needs `NotesTrail` entry keys (kit, WP-K) to
   bring the matched entry into view.
3. **A Compare reports change's chapter:** opens the newer report at its top. Needs a chapter on
   `DeepDiveTopChangeView` (model + worker) to pass to `Destination.Report`.
4. **Done in PR-4b (WP-K)**: every column and the median in view at 412 dp. ~~Compare names at 412 dp:~~ the median and the fourth ticker sit behind "Swipe the table". Needs the
   `CompareTable` column fit and one 48 dp target per row over compact cells (kit, WP-K, with D8).

### Verification after review round 3

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 470 tests, 0 failures (new: percent and legacy margins on Name, Name's
  raw TSV, the classic Deep Dive's one margin scale, Macro Stress's raw TSV, value discipline on one basis).
- Renders, semantics and harness tests (`-PrendersOnly test`): full run exit 0, then Name, Names, Research renders
  and `ResearchSemanticsTest` again after the last test edits (145 tests, 0 failures); 1,050 renders on disk,
  including the new `name-contract-history`.
- `tools/design-lint.sh`: 0 findings in 93 files (`ui/copy/AppMessages.kt` now in the copy pass), baseline 0 rows.
- `tools/gold-share.py`: 768 renders, max 7.50%, none at or above 8%.
- Android-only files changed (not compiled here): `MainViewModel.kt`, `ThesisApp.kt`, `ReportExport.kt`; checked
  by hand against Kotlin 1.9 / coroutines (named catch parameters, `suspend` callback type, existing imports).

## Review round 4

- **Pulse PDF export state (major, 5.7 item 1, 4.7).** `UiState.isExportingPulse` is set before the request goes
  out and cleared in a `finally`; `exportPulsePdf` ignores a call while it is set, so a second tap starts no second
  download or share sheet. `UiState.pulseExportDoneAt` (epoch ms) is recorded once `onReady` has opened the share
  sheet. The shell passes both to `PulseScreen(isExporting, exportDoneAt)`: the inline arc runs while exporting and
  the "export done" confirm plays on success. Logout clears both. `onCopyText` / `onOpenSource` keep their defaults.
- **Name's filings grid is the featured grid (2.3).** "From the filings" passes `featured = true` (serif
  `kpiValue`, as the Deep Dive's KPI block); the monitor grid stays on `statValue`.
- **No haptic on a copy (4.7, H1).** Name's two "Copy figures as table" handlers and Scenario Stress's copy drop
  `confirm()`, as Compare names, Compare reports and Macro Stress did in round 2.
- **Long presses are named for TalkBack (A3).** The kit's long-press rows take `onLongClickLabel` (`DataRow`,
  `TickerRow`, `KpiTile`, the card in `Cards.kt`), applied here as WP-K. History's Deep Dive rows say "Open AAPL";
  Names rows say "More actions" (`NamesCopy.MORE_ACTIONS`).
- **Preview stubs match the real types.** `ReportExporter(scope, context, onFailed)` has the real constructor and
  `DeepDivePagePrinter.isLoading` starts true, so a direct call that compiles in the harness compiles in CI.
- **Launcher rasters.** The ten legacy `mipmap-*/ic_launcher.png` / `ic_launcher_round.png` are regenerated from
  `ic_mark_t` (gold T on #0A0A0A, square and round, the adaptive icon's centre 72 of 108 units), so no old-mark
  asset ships. They stay in place, so `@mipmap/ic_launcher` resolves exactly as before.
- **Every report opens under one chrome (5.13).** `onOpenReport` and `onResumeLastViewed` fall back to the
  history's ticker for that report id (then the open report's), so Research's recent rows, Search hits, the War
  Room and Continue reading open under the `ReportOpeningBar` too.
- **Note autosave keeps the snackbar.** `saveReportNote` no longer publishes `message = null`, so a "Deep Dive
  ready" with its Open, or an error, stays while the reader types a note.
- **`LOAD_FAILED` moves to `AppMessages`**, under the copy lint, with the other ViewModel messages.
- **Names' Undo is not queued.** `onShowUndo` dismisses the snackbar on screen first, as the Inbox's quiet and
  turn-off do.
- **Source sheets open their report (#47, 1.1).** Name's filings tiles, Compare names' cells and Compare reports'
  cells end on "Open the FY2025 report" / "Open the AAPL FY2025 report" (`ScoreCopy.openSourceReport`, an in-app
  `SourceLink`), which closes the sheet and opens that report (`CompareNamesScreen(onOpenReport)`, wired in the
  shell). Per-figure filing links wait for the payload (data item below).
- **No false form on Compare names (2.4).** A summary names no form, and a 20-F or 40-F filer's annual report is
  not a 10-K: the source sheet and Copy as table say "Annual filing" (`ResearchCopy.FORM_ANNUAL`), the deck and the
  chart source say "annual filing", and the table header drops its form line ("Latest FY" and the period say it),
  which also makes the header one line shorter on a phone. Compare reports keeps the report's own
  `filingRead.form` (its 10-K fallback is unchanged: the full report carries the form).
- **Stress scale in the house form.** "Stress score 0 to 100, higher is more exposed"; "Stress score (0 to 100)".
- **The War Room's subject opens Name (5.25).** "Open AAPL" sits under the header, as on Compare reports.
- **Scenario Stress "By name" no longer repeats the bars.** Only names with a break badge or sources get a row
  (`stressRowHasDetail`); the rest are one "Open a name" line of ticker links (`TickerLinkLine`, shared with Compare
  names).
- **`Phase4Copy` is gone.** The four tab labels move to `ShellCopy`; the ~50 unused legacy strings and
  `notificationFamilyLabel` are deleted. `Phase4CopyTest` becomes `NotificationDefaultsTest` (the defaults case
  only). The spec's mentions (DESIGN-DIRECTION 5.x Notifications, 7.x test list) are for the spec owner to update.

Not taken, with reasons:

- **Compare names table density (two findings).** Still item 4 of the PR-4 / WP-K list, at its top. The fix
  changes the kit `CompareTable` every Research screen uses (compact cells under one 48 dp row target, a column
  fit that keeps the median in view), which needs its own render and semantics pass across those screens. This
  round takes the part that is safe here: the header loses its form line.

Data item added to the PR-4 list: **per-figure filing links** on `ReportSummaryView` (accession or document URL per
figure), so a source sheet can link the filing itself and not only the report.

### Verification after review round 4

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 470 tests, 0 failures (new: the source sheets' report links on Name,
  Compare names and Compare reports, "Annual filing" in Compare names, the By name row rule; `Phase4CopyTest`'s
  family-label case goes with `Phase4Copy`).
- Renders, semantics and harness tests (`-PrendersOnly test`): 680 tests, 0 failures, 1,050 renders; then the
  Scenario Stress and Compare names renders again after the `TickerLinkLine` flow change.
- `tools/design-lint.sh`: 0 findings in 94 files, baseline 0 rows.
- `tools/gold-share.py`: 768 renders, max 7.50%, none at or above 8%.
- Android-only files changed (not compiled here): `MainViewModel.kt` (export flag in `try` / `finally`,
  `reportTicker`, `AppMessages.LOAD_FAILED`, `saveReportNote`); checked by hand against Kotlin 1.9 and the
  existing imports (`System.currentTimeMillis`, `CancellationException` already used there).
