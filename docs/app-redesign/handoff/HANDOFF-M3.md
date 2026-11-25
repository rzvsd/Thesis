# HANDOFF-M3 (PR-2, shell motion): changes needed in files M3 does not own

File, change, reason. Paths are relative to `apps/mobile/android/app/src/main/java/com/thesis/mobile/`.

## For the kit owners (ui/theme, ui/platform, ui/components; WP-K in PR-3)

1. `ui/platform/SystemBars.kt` (+ the design-preview shim `src/shim/.../ui/platform/SystemBars.kt`)
   - Change: `SystemBarAppearance(light: Boolean, statusBarLight: Boolean = light)`; set
     `isAppearanceLightStatusBars = statusBarLight`, `isAppearanceLightNavigationBars = light`.
   - Reason: 2.7 "status bar icons follow the top bar's collapsed flag on HeroBand screens" is a status-bar-only
     override. M3 applies it today from `ThesisApp.kt` (`StatusBarIconsOverHero`, a non-restartable SideEffect placed
     after ThesisTheme's own), which relies on SideEffect ordering. One owner of the window call is cleaner.
     Until this lands, keep `ThesisTheme`'s `SystemBarAppearance` call before `content`, in the theme's own restart
     scope (the note sits next to `StatusBarIconsOverHero` in `ThesisApp.kt`; M3 does not edit the theme).
2. `ui/theme/ThesisTheme.kt`
   - Change: add `statusBarOverHero: Boolean = false` and call
     `SystemBarAppearance(light = palette.isLight, statusBarLight = palette.isLight && !statusBarOverHero)`.
   - Reason: same as 1. Then `ThesisApp` passes its `overHero` value to the theme and `StatusBarIconsOverHero` goes.
3. `ui/components/Bars.kt` (`ThesisBottomBar`)
   - Change: the glyph `Crossfade` uses `tween(if (reduced) 0 else ThesisMotion.Quick)`; use
     `ThesisMotion.timed(reduced, ThesisMotion.Quick)` like the colour next to it.
   - Reason: rubric M2 (values from ThesisMotion only); behaviour is the same.

## For the screen owners (PR-3)

4. Screens that open on a HeroBand: `PulseScreen.kt` (WP-A), `DeepDiveLoadingScreen.kt` (WP-C), classic report
   hero in `DeepDiveScreen.kt` (WP-D), `AuthScreen.kt`, `OnboardingScreen.kt`, `PaywallScreen.kt` (WP-G).
   - Change: call `com.thesis.mobile.ui.shell.HeroUnderBars()` once in the screen. Screens under a shell top bar
     pass nothing (the shell collapses the bar on scroll); screens that draw their own bar (Pulse, Auth, Onboarding)
     pass their own state: `HeroUnderBars(collapsed = headerScrolledAway)`.
   - Reason: 2.7 "HeroBand screens rule". With it the shell's top bar reads the hero palette while the band is under
     it and crossfades to paper when it collapses, and the status bar icons turn light over the band in both themes
     (Auth, Onboarding and Password reset each have their own `ScreenChrome` provided by `ThesisApp`).
   - No production screen calls it yet (only the test fixture `HeroPageFixture`), so nothing in the app shows the
     hero → paper bar or the light status-bar icons until this lands. Put it on the PR-3 WP checklists: Pulse
     (WP-A), Deep Dive loading and classic hero (WP-C/WP-D), Auth, Onboarding and Paywall (WP-G).
5. Every screen that takes the shell's `padding` (`HomeScreen`, `NamesScreen`, `InboxScreen`, `ResearchScreen`, ...).
   - Change: apply the top part of `padding` as the list's `contentPadding`, not `Modifier.padding(padding)`.
   - Reason: 4.4 "Top bar: scroll under". The shell now reveals the bar's background and hairline once content
     scrolls 8 dp under it (nested scroll, no wiring needed), but with `Modifier.padding` the content is clipped at
     the bar's bottom edge instead of passing under the 92% bitmap.
6. `HomeScreen.kt` (WP-A) with M1's `EntranceCoordinator`.
   - Change: replace the `StaggeredEntrance`/`RevealAnimation` uses.
   - Reason: Home's entrance replays when Today returns after a pop, a tab switch or a predictive back (see the
     `shell-motion-pop-260ms` and `shell-motion-predictive-back-260ms` frames: Today arrives half drawn), and the
     Macro Stress figure counts up again, even under reduced motion (19 → 21 in reduced-motion frames). That breaks
     4.3.2, 4.6 ("never on first paint") and 4.8. Not an M3 regression, but visible in every shell flow: the
     integrator should make sure it lands before PR-2 ships.
7. `DeepDiveWebPage.kt` (WP-C).
   - Change: read `com.thesis.mobile.ui.shell.LocalEntryCovered`; while true set the WebView's
     `importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS` (back to AUTO after) and, if
     useful, pause timers/animations in the page.
   - Reason: the shell keeps the report composed under Compare, Stress, Name (alpha 0), You, Search and the paywall.
     The shell clears the Compose semantics of the report layer in all of these cases (and of the tab layer and the
     bottom bar while a modal or the paywall is open), but an `AndroidView`'s own View tree stays reachable by
     TalkBack.
8. `DeepDiveScreen.kt` / `DeepDiveWebReportState.kt` (WP-C/WP-D).
   - Change: crossfade loading → loaded with M1's `StateCrossfade`.
   - Reason: when a `Report` entry's report arrives, the shell crossfades its interim back bar into the report's
     own `ReportTopBar` (`Quick`, back arrow in the same place; frame `shell-motion-report-loaded-75ms`). The page
     body (loading screen → report host) still swaps in one frame inside `DeepDiveScreen`, which belongs to the
     screen.

## For WP-G (PR-3) and WP-INT

9. `PaywallScreen.kt` (WP-G, 5.23) and `ui/shell/ThesisShell.kt` (WP-INT).
   - Change: when Paywall becomes a full-screen destination, open it on the modal stack
     (`navigator.openModal(Destination.Paywall(feature))`) so it rises through `ModalLayer` (32 dp + fade, 300/240
     ms, crossfade under reduced motion), and delete the `if (paywallOpen) PaywallScreen(...)` Dialog branch of
     `ThesisShell` together with `paywallOpen`'s other uses (back handler, `coveredByModal`).
   - Reason: the Dialog is the one remaining entry into the shell that is not a 4.5 move: it uses the platform's
     window animation and ignores reduced motion. The paywall is opened by `UiState.paywallFeature` (ViewModel) and
     `PaywallScreen` is itself a Dialog, so the move needs WP-G's full-screen Paywall first. Track it for PR-3.

## For the spec owner (DESIGN-DIRECTION 4.5): a note on sequencing

10. 4.5 "Push within a tab" and "Open Paywall, You, Search".
   - Change (wording only; no new token, every total is the table's): record how the shell meets "Screens are
     opaque, so nothing double-exposes" inside the 4.2 totals. Shared-axis X takes `Screen` (300 ms) and splits
     its halves as the tab row's fade-through does: the old page goes 0 → −24 dp + fade out (90 ms `EaseExit`,
     `TabOut`), then the new page comes +24 dp → 0 + fade (210 ms `EaseEnter`, `TabIn`, starting at 90;
     `SHARED_AXIS_IN_DELAY`). The new page is drawn over the old one but transparent until it has gone, so the old
     page's exit (and a predictive back's .90 preview) is seen to its end. Modal rise (300 ms): the page background
     covers the page under it (150 ms `EaseEnter`); from 120 ms (under 1% of the page under it left) the content
     rises 32 dp and fades in (180 ms `EaseEnter`, `PushOut`). Modal close (240 ms): the content falls 32 dp and
     fades out (90 ms `EaseExit`), then the background uncovers the page under it (150 ms `EaseStandard`, so the
     page under it returns at once instead of after a blank moment). Fade-through's .985 → 1 scale applies to the page's content only, so
     the page glow never moves (4.3.4). Auth ↔ Password reset uses the same shared-axis X.
   - Reason: with both halves starting together and fading over their whole length, as the table reads, 180 ms
     `EaseExit` and 300 ms `EaseEnter` overlap (both pages ~50% at ~150 ms), or, with the new page opaque at once,
     the old page is cut in one frame. Round 2 ran the table's halves end to end (480 ms), which broke the 300 ms
     total; this keeps the total and the 24 dp / 32 dp travel and moves only where each fade sits.
     `ShellDoubleExposureTest` checks it on pixels (push, pop, the report base layer, rise, fall, pages inside the
     modal stack): no frame shows more than 3% of one page under the other.
   - Before PR-2 merges: the spec owner accepts this wording (or rules otherwise), and the app keeps one
     shared-axis X. M1's `ThesisTransitions.sharedAxisX` (ui/motion/Transitions.kt, literal 300/180) and this
     shell spec (`sharedAxisXOf` in ui/shell/ShellMotion.kt, 90 then 210) must not both ship: either M1's kit
     adopts the sequenced spec and the shell calls it, or M1's goes. Likewise `PREDICTIVE_BACK_SCALE` /
     `PREDICTIVE_BACK_SHIFT` point at M1's `ThesisMotion.BackScaleTo` / `BackShift` once M1 and M3 are integrated.

## For the kit owner (WP-K): snackbar host

11. `ui/components/Overlays.kt` (`ThesisSnackbarHost`).
   - Change: stop wrapping Material3's `SnackbarHost`; draw `ThesisSnackbar` from `hostState.currentSnackbarData`
     with the kit's own rise/fade and time-out (as `ShellSnackbarHost` in `ui/shell/ThesisShell.kt` now does).
   - Reason: Material3 1.2.1's `SnackbarHost` runs `FadeInFadeOutWithScale` (scale from .8, fades) on top of the
     kit's 12 dp rise, against 4.3.8, and ignores reduced motion (4.8). The shell no longer uses the kit host; once
     the kit host is fixed, the shell can go back to it (the time-out rules match `snackbarTimeoutMillis`).

## Known limits (no change requested)

- `UiState.deepDiveReport` holds one report. If a build is started from a screen pushed over a report (Scenario
  Stress → a ticker), the new build clears it and the covered report's page is rebuilt on return. Compare reports,
  Compare names, Scenario Stress and Name do not touch it, so back from them restores the live page.
- The bars' 92% bitmap slice (`barBackground`, ui/components/PageBackground.kt) is placed by `positionInWindow`
  inside the page, so during a predictive-back preview a collapsed bar's glow slice is offset by the preview's
  .90 scale (the page's own background is right: `OpaqueEntry` passes its origin from outside the preview layer
  via `pageBackground(p, origin)`). Subtle at 92% over a dark bar; WP-K can give `barBackground` the same origin
  hook (a CompositionLocal set by the shell) if it shows.
- The bar's collapse state comes from nested-scroll deltas only. A programmatic jump to the top
  (`scrollToItem(0)`, e.g. a future tap-tab-to-top) leaves it collapsed until the next drag. A screen that adds
  such a jump should report its state with `HeroUnderBars(collapsed = ...)`/`ownCollapsed`, or WP-INT adds a
  `ScreenChrome` reset for it.
- Predictive back previews only the leaving page over the page background: Compose 1.6 has no seekable
  `AnimatedContent`, so the page under it cannot be shown during the gesture (PR-4, playbook 8c).

## Integration status (WP-INT, redesign/pr2)

Done in the PR-2 integration: 1 and 2 (`SystemBarAppearance(light, statusBarLight)`, `ThesisTheme(statusBarOverHero)`;
`ThesisApp` passes its value and `StatusBarIconsOverHero` is gone), 3, 5 for the tab roots that scroll (Home, Names,
Inbox: `padding.exceptTop()` plus the top in `contentPadding`), 6, 7 (`DeepDiveWebPage` hides the WebView's View tree
and pauses it while covered), 8 (`DeepDiveScreen` runs loading → report → failed through `StateCrossfade`), 10 (4.5
wording updated; one shared-axis X; `PREDICTIVE_BACK_*` point at `ThesisMotion.BackScaleTo` / `BackShift`), 11 (the kit
`ThesisSnackbarHost` draws `ThesisSnackbar` itself; the shell uses it again).
Deferred to PR-3: 4 (no screen opens on a HeroBand yet), 5 for pushed screens (their PR-3 redesign), 9 (needs WP-G's
full-screen Paywall).

**Known exception to the M3 exit criteria** (state it in the PR-2 description): "no hard cuts left in `ThesisShell`"
and "reduced-motion path uses crossfades" hold for every entry except the Paywall, which still opens as a platform
`Dialog` (the platform's window animation, no 4.5 modal rise, no reduced-motion path). Item 9 moves it onto the modal
stack once WP-G's full-screen Paywall (5.23) lands; it is on the WP-G and WP-INT checklists in DESIGN-DIRECTION 6.3
("Carried from the PR-2 review").

Review round 1 polish for WP-K (no change in PR-2): the collapsed bar's 92% page slice lets saturated content show
through as a muted block (Home's filled gold "Dashboard" behind THESIS in `shell-motion-today-scrolled-light`, chip
labels in `shell-motion-inbox-scrolled-dark`). Removing the gold button outside a HeroBand (WP-A, carried from PR-1)
takes the worst case away; WP-K then re-checks the slice against Deep Dive's sticky chip-nav bar and raises its
opacity or fades content under the bar if it still reads as clutter.
