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
  - Every screen now gets its full parameters, including WP-E's new Compare reports, Compare names and Search entries, and WP-B's Name pager.
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

- **Name, "since-last-report" anchor (HANDOFF-F 6):** the destination carries the anchor, but Name has no scroll target for it yet, so it opens at the top.
- **Name toolbar (HANDOFF-B 15):** it does not move into the shell bar.
- **`onCompareWith`:** left null on Name and Names until a compare picker exists.
- **Compare names, per-ticker errors (HANDOFF-E):** not added.
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

## Verification at the integration commit

- `design-preview` compile (main + test): clean.
- App unit tests (`-PappTestsOnly test`): 454 tests, 0 failures, including `DestinationCodecTest` (new fields and
  PR-2 stacks) and `DeepDiveClassicModelTest.sampleAssetSpeaksTheProductVocabulary`.
- Renders, semantics and harness tests (`-PrendersOnly test`): 673 tests, 0 failures; 1,040 renders, dark and light.
  Two Today semantics tests were updated for the two-line reasons (`performScrollTo` before the macro retry tap) and
  the kit's non-interactive row (merged text instead of `inert`'s content description).
- `tools/design-lint.sh`: 0 findings, baseline 0 rows.
- `tools/gold-share.py`: 758 renders, max 7.50%, none at or above 8%.

## Notes for the review sweep

- Names' comfortable rows now give a reason two lines; at 360 dp and at 1.3x a long reason can still ellipsize after
  the second line (`names-loaded-360`, `names-loaded-font130`). The kit adds a third line only above 1.3x.
