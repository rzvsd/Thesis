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
  Reason: ui/platform is F2's; it is not on F3's base.
- `ui/navigation/ThesisTopBar.kt` / `ThesisBottomBar.kt`: F3 rewired them functionally (4 tabs with the Inbox
  "new" dot, no gold indicator; root bar = brand + Search + avatar; `ThesisBackTopBar` for pushed screens without
  a header). The kit's `ThesisTopBar(TopBarSpec)` / `ThesisBottomBar` restyle them; keep the call shapes used in
  `ui/shell/ThesisShell.kt` or update them there.

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

## 4. For WP-A (Today/Pulse, PR-3)

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

- `.github/workflows/**`: not touched (needs your OK). Nothing in F3 requires a workflow change; the new
  `src/testDebug` Room migration test runs under the existing `testDebugUnitTest`.
- Deviation, documented: the paywall stays state-driven (`UiState.paywallFeature`, drawn above the shell, closed
  by back) rather than a `Paywall` entry on the modal stack; the `Paywall` destination exists for later use.
- Deviation, documented: an alert whose route the app does not know lands on the Inbox tab root (there is no alert
  detail screen to push yet).
