# HANDOFF from F3 (Shell, navigation and data contract = WP-INT), PR-1

Changes F3 needs in files it does not own, and the contract it leaves for PR-3. Section numbers refer to
`docs/app-redesign/DESIGN-DIRECTION.md` (v2.1). Each item: file, change, reason.

## 1. For F4 (harness)

- `design-preview/src/test/kotlin/com/thesis/mobile/preview/SampleScreensTest.kt`: drop the `welcome`,
  `welcome-t0` and `login` renders (and their imports). Reason: 6.1 deletes `WelcomeScreen.kt` and
  `LoginScreen.kt` (dead since Onboarding/Auth replaced them; nothing in the app calls them). F3 did **not** delete
  them because the harness test would stop compiling. Once the test no longer references them, delete
  `app/src/main/java/com/thesis/mobile/ui/screens/WelcomeScreen.kt` and `LoginScreen.kt`.
- `design-preview/build.gradle.kts`: nothing new to exclude. `ui/shell/**` (incl. `UiState.kt`, which moved out
  of `MainViewModel.kt`), `ui/screens/AuthScreen.kt`, `SettingsScreen.kt`, `ResearchScreen.kt` all compile in the
  harness. `Phase4CopyTest` could now be staged too: `defaultNotificationPreferences()` moved to
  `ui/shell/UiState.kt` (same package `com.thesis.mobile.ui`).
- Smoke renders that called the Research tab through `DeepDiveScreen(report = null, ...)` can call
  `ResearchScreen(...)` (same look, fewer parameters). The whole shell renders through
  `ThesisShell(state, navigator, actions = object : ShellActions {})`; fixtures in
  `design-preview/src/test/kotlin/com/thesis/mobile/preview/fixtures/ShellFixtures.kt`.
- `tools/design-lint.sh --update-baseline --allow-raise` (F4 handoff item for the extraction commit): the tool is
  not on F3's base (fa8b6fc), so the baseline was not updated here. Run it when F3 and F4 merge: the extraction
  moved Auth/Settings code from `ThesisApp.kt` to `AuthScreen.kt`/`SettingsScreen.kt` (same counts, new files).

## 2. For F2 (kit and platform)

- `ui/platform/Back.kt`: F3 uses `androidx.activity.compose.BackHandler` directly, once, in `ThesisApp.kt`
  (`LoggedInApp`, enabled while `navigator.canGoBack` or the paywall is open; plus one for Password reset).
  When `Back.kt` lands, swap both for `ThesisBackHandler`, and wrap the shell's tab layer in
  `ThesisPredictiveBackHandler` (4.5: scale .90 + 8 dp shift with progress, commit = `actions.onBack()`).
  Reason: ui/platform is F2's; it is not on F3's base. **Open acceptance item:** "ThesisBackHandler /
  ThesisPredictiveBackHandler for every push" stays open until this swap lands in the PR-1 integration; until then
  back works but shows no predictive preview.
- **Blocking item of the F1/F2 integration merge** (not a later follow-up): literals in F3's shell chrome that
  the kit and tokens replace (design-lint 7.2, rubric T1/T2/M2, counts them; `ThesisSpace`, `ThesisType`,
  `ThesisMotion` are not on F3's base fa8b6fc). Swap them when F1/F2 merge, then re-run
  `design-lint --update-baseline` for the new files:
  - `ui/shell/ThesisShell.kt`: `24.dp` (shared-axis shift) and `32.dp` (modal rise) → `ThesisMotion`/`ThesisSpace`
    tokens; every `tween(...)` with `LinearOutSlowInEasing`/`FastOutLinearInEasing` in `tabTransition` and
    `modalTransition` → `ThesisMotion` specs (`EaseEnter`/`EaseExit`; durations already match 4.5).
  - `ui/navigation/ThesisTopBar.kt`: `.heightIn(min = 56.dp)` (root and back bars; a minimum so a 2.0x title is
    not clipped; the back-bar title is one line with an ellipsis); `titleMedium.copy(fontWeight = ...)`
    in `ThesisBackTopBar` and `labelLarge.copy(...)` in `SubScreenBackRow` → kit `ThesisTopBar(TopBarSpec)`
    (`barTitle`). The brand already uses `labelSmall` (= `eyebrow` after F1) in `Primary` (= `accent`).
  - `ui/navigation/ThesisBottomBar.kt`: `BAR_HEIGHT = 64.dp` (min height), icon `24.dp` (now the spec value, still
    a literal), dot `6.dp` + `offset(2.dp)`, spacer `4.dp` → kit `ThesisBottomBar` with `navLabel`. The label
    already uses `labelMedium` (the slot F1 maps to Sans 500 12/16, i.e. `navLabel`), not `labelSmall` (which
    F1 maps to the tracked `eyebrow`), and selection is ink vs muted only (no `.copy(fontWeight)` swap). Check
    after the F1 merge that the tab labels did not turn into kickers.
    Keep the A4 behaviour: minimum (not fixed) item height, one-line label, label size capped in dp at 1.3x
    (`cappedForBar`; four labels cannot fit "Research" at 2.0x on 360 dp without breaking the word). This is a
    documented deviation from 2.3's "other styles scale freely" for this one label; `ThesisType.capped` can
    take it over.
  - `ui/shell/ShellDestinations.kt`: the War Room refresh loop `delay(WAR_ROOM_REFRESH_MS)` is a third poll next
    to the two allow-listed `MainViewModel` polls: **add it to the design-lint allowlist** when the tool lands (it
    is the 5.5 War Room auto-refresh, cancelled when the entry leaves composition) or move it into the ViewModel
    in PR-3. It calls `onAutoRefreshWarRoom()` = `refreshWarRoom(announce = false)`: no "War Room loaded."
    snackbar, no `war_room_viewed` event, no paywall, and a failure keeps the loaded War Room on screen.
- Icons: the Research tab uses `Icons.AutoMirrored.Filled.ManageSearch` (2.8: Research = `manage_search`; the
  magnifier is the top bar's Search). Swap for the `ThesisIcons` glyph when F2 lands.
- `ui/navigation/ThesisTopBar.kt` / `ThesisBottomBar.kt`: F3 rewired them functionally (4 tabs with the Inbox
  "new" dot, no gold indicator; root bar = brand + Search + avatar; `ThesisBackTopBar` for pushed screens without
  a header). The kit's `ThesisTopBar(TopBarSpec)` / `ThesisBottomBar` restyle them; keep the call shapes used in
  `ui/shell/ThesisShell.kt` or update them there.

## 2b. For WP-C/WP-D (report screens)

- `components/EmptyStateView.kt` `DeepDiveUnavailableState` / `screens/DeepDiveScreen.kt`: on a `Report(id)` entry
  whose open failed (render `shell-report-failed`), the shell now wires the error card's button to
  `onEnsureReport(id)` (open the stored report again), not to a new build. The label still reads
  "Retry Deep Dive"; add a label parameter (for example `retryLabel`, passed through `DeepDiveScreen`) so the
  shell can say "Open report again" (principle 11). On a failed `DeepDiveRunning` entry the button runs the build
  again through `onRetryDeepDive(ticker)`, which replaces the entry instead of stacking a second one.
- `EmptyStateActionButton`: the pill's label is clipped vertically at 2.0x (fixed height); use a minimum height.

## 3. For F1 (theme)

- `ui/theme/ThesisTheme.kt`: remove the `SideEffect` that sets `window.statusBarColor` /
  `navigationBarColor` (deprecated; under `enableEdgeToEdge()` it paints the bars opaque again). Status-bar icon
  appearance should follow the mode and the top bar's `collapsed` flag (5.1). Reason: MainActivity now calls
  `enableEdgeToEdge()`; the theme file is F1's.
- `res/values*/themes.xml`: `Theme.ThesisMobile` still sets `statusBarColor`/`navigationBarColor`; drop them and
  set the window background to `bg` per mode (paper in `values`, ink in `values-night`) (5.1).
- `res/values/splash.xml` (F3, new): `thesis_splash_background` is ink in both modes because the app ships dark
  only (`AppearancePrefs.themeMode` defaults to `Dark`). When light/Auto ships, change `values/splash.xml` to
  paper `#F5F1E8` and flip the default in `ui/shell/ShellPreferences.kt`.
- `marketTone` (2.2): key on `MarketTapeMoveView.family` (`MarketTapeFamily.directionNeutral`), not on
  instrument strings. `PulseReportView.tape` carries the family.

## 3b. For WP-G (account and entry)

- `res/values/splash.xml`: `windowSplashScreenAnimatedIcon` points at the raster `@mipmap/ic_launcher_foreground`
  as a placeholder (soft when the Android 12+ splash scales it). Switch it to `@drawable/ic_mark_t` (5.1) when
  WP-G delivers the vector mark.
- Onboarding, Auth and Password reset are wrapped by `ThesisApp` in `windowInsetsPadding(WindowInsets.safeDrawing)`
  (status/navigation bars, cutout and IME), because `enableEdgeToEdge()` stops adjustResize from resizing the
  window on API 30+. The screens must not add system-bar or IME padding of their own (it would double up).
  Verify on an API 30-34 device with the keyboard open on Log in.
- `InboxScreen` (WP-A/WP-B, not F3): at 2.0x on 360 dp its filter row is a fixed `Row`, so "Earnings" breaks
  letter by letter (render `shell-inbox-360-scale2.0`); 5.x `ChipRow` (scrolling `LazyRow`) fixes it.

## 4. For WP-A (Today/Pulse, PR-3) and WP-B (Names/Inbox)

Screen bodies that break at 360 dp x 2.0 (rule 6.0.6) under shell chrome that holds. Pre-existing, not F3's:
- `PulseScreen` header (WP-A): the date stacks one letter per line down the right edge and pushes the content off
  screen (render `shell-today-pulse-360-scale2.0`).
- `HomeScreen` Macro Stress card (WP-A): the title breaks mid-word ("Mac / ro / Stres / s") next to the score
  (render `shell-today-360-scale2.0`).
- `NamesScreen` filter chips (WP-B): "Catalysts Soon" breaks mid-word (render `shell-names-360-scale2.0`).
- `InboxScreen` filter chips (WP-B): "System" breaks letter by letter even at 412 dp x 1.0 (render `shell-inbox`);
  see also 3b. A scrolling `ChipRow` fixes all three chip rows.

- `PulseScreen.kt:691`: replace the regex over section prose with `pulse.tape` (`MarketTapeView`:
  indices + cross-asset, value, daily change, %, unit, family, direction, as-of; includes the dollar index).
  Parsed in `ProductApiClient.parsePulseReport`, kept in the offline cache, tested on the real 2026-04-25 issue.

## 5. ViewModel contract for PR-3 (5.5), all in `MainViewModel` / `UiState`

| Need | API |
|---|---|
| Name(ticker) | `onOpenName(ticker)` (push + load), `openName(ticker)` → `UiState.nameDetail` (snapshot, delta, report summary, notes trail, alerts, reports) |
| Notes | `notesTrail(ticker)` → `UiState.notesTrails[ticker]`; `allNotes()` → `UiState.allNotes`; notes are written through on every load/save |
| Compare | `loadCompare(a, b)` → `UiState.compareReports`; `loadCompareNames(tickers)` → `UiState.compareNames` |
| Search | `search(query)` → `UiState.searchResults` (names, reports, note text at once; server tickers after) |
| Since last visit | `UiState.snapshotDeltas` / `snapshotDelta(ticker)`, `lastNamesVisitAtMs`, `lastInboxVisitAtMs`, `hasNewInboxItems`, `onMarkInboxSeen()` |
| Refresh hairlines | `isPulseRefreshing`, `isMacroRefreshing`, `isBoardRefreshing`, `isInboxRefreshing`, `isHistoryLoading`, `isOpeningReport`, `isDeepDiveRunning`, `isWarRoomLoading`, `authBusy` |
| Appearance | `UiState.appearance` (`AppearancePrefs`: theme, up/down, reduce motion, names density), `onSetAppearance(...)` |

Destinations `Name`, `CompareReports`, `CompareNames` and `Search` exist (codec, navigator, shell) but draw a
placeholder until WP-B/WP-E add their screens to `ui/shell/ShellDestinations.kt`.

## 6. For the owner

- **Open acceptance item:** predictive back ("ThesisBackHandler / ThesisPredictiveBackHandler for every push",
  4.5 scale .90 + 8 dp shift). Back works through a plain `BackHandler` gated on `navigator.canGoBack`, but shows no
  preview until F2's `ui/platform/Back.kt` merges (section 2). At PR-1 integration: swap the handler for
  `ThesisBackHandler`, wrap the tab layer in `ThesisPredictiveBackHandler` with commit = `actions.onBack()`, keep
  the `canGoBack` gating.

- `.github/workflows/**`: not touched (needs your OK). Nothing in F3 requires a workflow change; the new
  `src/testDebug` Room migration test runs under the existing `testDebugUnitTest`.
- Deviation, documented: the paywall stays state-driven (`UiState.paywallFeature`, drawn above the shell, closed
  by back) rather than a `Paywall` entry on the modal stack; the `Paywall` destination exists for later use.
- Deviation, documented: an alert whose route the app does not know lands on the Inbox tab root (there is no alert
  detail screen to push yet).
