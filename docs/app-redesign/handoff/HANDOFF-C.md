# HANDOFF-C (WP-C: Deep Dive host, generation, export), PR-3

Changes needed outside WP-C's files. Each row: file, change, reason. Items marked **PR-3 blocker** must land in
the same PR-3 window as WP-C, or the screen ships with a gap a reviewer flagged. This file is committed with the
branch; the integrator also pastes it into the PR description (6.0 rule 1).

## WP-INT (integrator: ThesisApp, MainViewModel, ui/shell, ui/navigation, Models, ProductApiClient)

1. **PR-3 blocker.** `ui/shell/ShellDestinations.kt` (where `DeepDiveNativeTools(...)` is built for a Report
   entry): pass `host = ReportHostExtras(isFollowing = ticker in state.watchlist, onFollowChange = { on -> add/remove
   ticker }, watchlist = state.watchlist, reportHistory = state.reportHistory, notesTrail =
   state.notesTrails[ticker].orEmpty(), onCompareNames = { tickers -> push Compare names(tickers) },
   onCompareReports = { earlierId, id -> push Compare reports(earlierId, id) })`. Reason: the Compare dock item and
   its sheet, and the earlier note above the notes field, only show when these are passed (null compare callbacks
   hide their controls). The kit `ReportTopBar` always draws the bookmark, so until `onFollowChange` and
   `isFollowing` are passed every report shows an unfilled "Follow AAPL" that plays the toggle haptic and does
   nothing (see WP-K 4 for the kit side).
2. Same place: `onOpenScenarioStress` should open Scenario Stress with the report's ticker preselected. Reason: 5.13
   dock "Stress" (the item is hidden while this is null).
3. `MainViewModel.saveReportNote`: drop the "Note saved." notice when the save comes from the report host's autosave
   (or entirely: the NoteBlock footer now shows Saving / Saved / Try again). Reason: 5.13 item 4, no snackbar per
   autosave.
4. **PR-3 blocker.** `ui/shell/ShellDestinations.kt`, `Destination.DeepDiveRunning` and the report-opening path:
   pass the generation inputs down to `DeepDiveLoadingScreen` through WP-D's `DeepDiveScreen` (see WP-D 1):
   `building = true` for `DeepDiveRunning` (false while a stored report opens), `ticker`, `jobStatus =
   state.jobStatus` (own build only), `onRetry` = run again. Reason: 5.14 stages are driven by the job status only;
   with no input (today `DeepDiveScreen.kt:126` calls `DeepDiveLoadingScreen(modifier = ...)`) a whole build shows
   the opening-report skeleton ("Loading the report") with no stage progress and no "you can leave" line.
5. `model/Models.kt` `ReportHistoryItem` and `ProductApiClient.listReports`: add the filing form and fiscal period
   the report reads (`filing_form`, `filing_period` or whatever `/reports` returns), if the API has them. Reason:
   "With an earlier report" filters by `type` (the kind of report, a Deep Dive), not by filing, so it can offer a
   10-Q based report next to a 10-K based one; with the form and period it can filter like for like and label each
   row "10-K FY2024 · built 14 Nov 2025" instead of "Built 14 Nov 2025".
6. `ui/shell` (top bar choice for a Report entry while it loads): use `ShellTopBar.None` for the Report entry
   while the report data loads, and pass `reportBar = ReportOpeningBar(ticker, onBack, following, onFollowChange)`
   to `DeepDiveLoadingScreen` (through WP-D's `DeepDiveScreen`). Reason: the opening skeleton then sits under the
   same surface `ReportTopBar` (THESIS + ticker) that the host draws next, so the open crossfade has one chrome
   instead of the shell's transparent back bar handing over to the report's surface bar. Render:
   `report-opening-report-bar-*.png`.

## WP-D (DeepDiveScreen.kt)

1. **PR-3 blocker.** `DeepDiveScreen.kt:126`: replace `DeepDiveLoadingScreen(modifier = Modifier.padding(padding))`
   with `DeepDiveLoadingScreen(padding = padding, building = <running entry>, ticker = <ticker>, jobStatus = <job
   status>, onRetry = onRetry, reportBar = <WP-INT 6>)` (add the parameters to DeepDiveScreen). Reason: the
   generation HeroBand runs under the status bar and the back bar (`HeroUnderBars`) and needs the shell padding, not
   a padded modifier. If WP-INT's wiring is not ready, at least pass `building = true` for running entries.
2. Export in the classic view (`ExportSection`): call `scope.launch { shareExport(context, renderReportPdf(...)) }` /
   `renderShareCard(...)` instead of the blocking `createPdfExport` / `createShareCard` on the main thread. Reason:
   5.24 "runs off the main thread"; the blocking functions are kept only so the classic view compiles.
3. `ViewTogglePill(label, onClick)` is now a kit `TextAction` (accent, 48 dp): no change needed, but drop any padding
   the caller added for the old pill.
4. The classic view no longer gets the "new view didn't load" snackbar: the host draws `ReportFallbackBanner` at the
   bottom of the classic view after a failed page load. Keep the bottom of the classic content clear by the banner's
   height when `onOpenNewView != null` (optional).

## WP-K (kit: ui/components, ui/format)

1. **PR-3 blocker.** `components/Bars.kt` `ReportDock`: a segment's `badge` wraps one letter per line when the row
   is full (4 segments at 412 dp; label `maxLines = 1` gets the width first). Give the badge `maxLines = 1,
   softWrap = false` and let a badged segment size to content, or render the badge as a superscript. Reason: 5.13
   "Conviction (Pro)"; WP-C passes no badge until then (`ReportCopy.PRO_BADGE` is ready), so free users only learn
   about the gate when they tap. Once it lands WP-C turns the badge on (one line in `DeepDiveWebReportState.kt`).
2. **PR-3 blocker (rubric A4, starred).** Same: at 2.0x font scale "Conviction" is clipped ("Convictio"; render
   `report-host-loaded-2.0x-*.png`, kept as the regression check). The dock could drop to icons or scroll at large
   font scales, or give each segment its intrinsic width.
3. Optional: a "flag" icon for Report feedback in the overflow (WP-C uses `ThesisIcons.Info`).
4. `components/Bars.kt` `ReportTopBar`: make `onFollowChange` (and `onOverflow`) nullable and hide the control when
   null. Reason: a report whose follow state is not wired, and the opening skeleton's bar (`ReportOpeningBar`,
   which has no overflow to offer yet), would then show no dead control. WP-C would then pass
   `extras.onFollowChange` straight through.
5. `components/Loading.kt` `SkeletonBlock`: the light fill (`surface2` on `bg`) is almost invisible on paper below
   the hero (render `report-opening-skeleton-light.png`). Consider `line` or a slightly darker skeleton token in
   light mode. WP-C already clips its chip skeletons to the pill shape.
6. `format/Fmt.kt`: add `shortDate(instant: Instant)` (the date in Fmt's zone), or expose the zone. Reason: screens
   must not call `ZoneId.systemDefault()` (2.1). WP-C uses `fmt.relative(instant)` for the earlier-report rows
   ("Built 23 days ago", then the date) until then.

## Shared harness (design-preview)

- `design-preview/src/shim/kotlin/com/thesis/mobile/ui/screens/PreviewAndroidStubs.kt`: WP-C added the new
  `DeepDiveWebPage` parameters (`onProgress`, `onLoaded`, `onScroll`, `onAddToNote`) and suspend stubs for
  `renderReportPdf` / `renderShareCard`. Committed with WP-C because the host does not compile in the harness
  without them; merge with any other WP's edits to that file.
- New `ui/copy/ReportCopy.kt` (WP-C's strings) next to the other copy objects.

## R1 checklist (for the PR description)

- Scenario run and the investment memo export: via **Classic view** (overflow, first row). The new view's dock
  opens Scenario Stress (WP-INT 2) and its overflow exports the full report PDF and the share card, following the
  5.13 dock and overflow lists; the base's new view had both through tool dialogs.
- Report feedback: the overflow's "Report feedback" (no preselection, Send once a reason is chosen, a sent state).
- Notes save: autosave in the new view, Save in the classic view.
- Follow / unfollow from the report: the bookmark, once WP-INT 1 is wired.

## Not checked in the harness

- The share card and PDF were checked only by code review: ReportExport.kt is Android-only and the harness cannot
  run `android.graphics.pdf` or `StaticLayout`. The pagination itself is unit tested (ExportPaginationTest).
- "Add to note" (ActionMode wrapper in DeepDiveWebPage.kt) is Android-only and could not be exercised in the harness;
  the script, parsing and formatting are unit tested.
