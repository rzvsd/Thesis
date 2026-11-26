# PR-4a: compose-bom 2025.04.00 and the harness on Compose Multiplatform 1.7.3 (WP-H)

This note covers the isolated Compose bump (DESIGN-DIRECTION 4.1 item 4, 6.4; playbook 1.3). No features, no motion
changes and no upgrades to new 1.7 APIs: any regression on a device can be traced to this PR alone. The optional
upgrades (`sharedBounds`, `animateItem`, seekable predictive back, M3 1.3 `PullToRefreshBox`, text fields in sheets)
are left for PR-4b. Paths are relative to `apps/mobile/android/`.

## What changed

| File | Change | Why |
|---|---|---|
| `app/build.gradle.kts` | `compose-bom` 2024.06.00 → **2025.04.00** (Compose 1.7.8, Material3 1.3.x). Kotlin 1.9.24, `kotlinCompilerExtensionVersion = "1.5.14"`, AGP 8.5.2, compileSdk 35 unchanged. | The planned bump. 2025.04.00 is the newest BOM on Compose 1.7; 2025.04.01 is Compose 1.8 and must wait for Kotlin 2 (4.1). |
| `app/build.gradle.kts` | Adds `androidx.lifecycle:lifecycle-runtime-compose:2.8.3`. | `ThesisApp` now imports `androidx.lifecycle.compose.LocalLifecycleOwner`. Compose UI 1.7 already depends on it as `api("androidx.lifecycle:lifecycle-runtime-compose:2.8.3")` (androidx commit 6a3f5b39, "Move LocalLifecycleOwner to common"); declared so the import does not rest on a transitive edge. Same 2.8.3 as the other lifecycle artifacts. |
| `ui/ThesisApp.kt` | `rememberIsResumed()` and `CoveredBackScope()` read `androidx.lifecycle.compose.LocalLifecycleOwner`. | `androidx.compose.ui.platform.LocalLifecycleOwner` is deprecated in 1.7 (WARNING, an alias of the new one). Same object at run time. |
| `ui/theme/ThesisTheme.kt` | `RippleTheme` / `LocalRippleTheme` → `RippleConfiguration` / `LocalRippleConfiguration` (M3, `@ExperimentalMaterial3Api`), built by `thesisRippleConfiguration(palette)`. | `RippleTheme` and `LocalRippleTheme` are deprecated at **ERROR** level in material-ripple 1.7 and M3 1.3 components no longer read them. Same colour (`ink` of the palette in scope, so HeroBand keeps its own) and the same PressTint alpha for pressed, focused, hovered and dragged. |
| `ui/theme/KitTokens.kt` | `Kit.fieldLabelOverhang` 8 dp → **8 sp**. | Regression found by the render diff, see "Text fields" below. |
| `design-preview/build.gradle.kts` | CMP 1.6.11 → **1.7.3** (runtime, ui, foundation, material, material3, animation and `ui-test-junit4-desktop`); skiko runtime 0.8.4 → 0.8.18 (what ui-desktop 1.7.3 asks for); compose compiler stays 1.5.14; `androidx.arch.core` excluded next to `androidx.lifecycle`. | Keep the harness on the same Compose line as the app (4.1: designing blind otherwise). |
| `design-preview/README.md` | Versions, substitutions, ripple test. | |
| `design-preview/.../harness/RippleConfigurationTest.kt` (new) | Pins the ripple colour/alpha under `ThesisMaterialTheme` in paper, graphite and a hero palette, and draws a pressed M3 ripple to check the pixel is `ink` at 8% over the surface. | 4.4 "no ripple on kit/screen surfaces; residual M3 ripple = the press tint". |
| `design-preview/.../AccountSemanticsTest.kt` | `field()` matches on `EditableText` instead of the `SetText` action. | Foundation 1.7 adds `SetText` only when a field is editable (`CoreTextField`: `if (editable) setText {…}`); 1.6 added it always and refused the call. The locked email field on reset step 2 was no longer found. App behaviour is right: TalkBack still reads the field, as disabled. |
| `ui/components/Overlays.kt` (`ThesisSheet`), `ui/platform/SheetWindow.kt` (new, Android-only) + its design-preview shim, `ui/theme/ThesisTheme.kt` (`LocalStatusBarLight`) | The sheet keeps 1.2's top edge (status-bar padding), takes explicit `contentWindowInsets`, and its dialog window's bar icons follow the app palette and the HeroBand rule. | M3 1.3 moved `ModalBottomSheet` into an edge-to-edge dialog window (WP-INT, from review; see "Bottom sheets" below). |
| `design-preview/.../RenderScreen.kt`, `MacroInboxRenders.kt`, `ShellRenders.kt` | The capture loops run on the AWT thread and send the global snapshot's apply notifications every frame (`onUiThread`, `runEffects`); renders with a snackbar assert that it is on the host at capture. | Effect-written state reached the scene on the AWT thread in real time, so some renders (snackbars, Inbox undo) depended on timing (sweep, E). |

No other androidx dependency needs a bump for Compose 1.7: activity-compose 1.9.1 (`BackHandler`,
`PredictiveBackHandler`, `LocalOnBackPressedDispatcherOwner`) works with any Compose 1.x, lifecycle 2.8.3 is what
Compose UI 1.7 itself declares, `core-ktx` 1.13.1 and compileSdk 35 meet Compose 1.7's floor (compileSdk 34).
Vico is not a dependency any more (the macro charts are the kit's own), so the playbook's Vico smoke test does
not apply. Material 2 (`material`, for `pullRefresh` only) follows the BOM to 1.7.8.

## Harness substitutions, re-checked

- **androidx.collection.** CMP 1.7.3's `collection-internal:collection:1.7.3` JVM variant asks for Google's
  `androidx.collection:collection:1.4.0`. The only JVM copy on Maven Central is still JetBrains'
  `collection-desktop:1.6.0-beta02`, so the substitution stays. A bytecode link check (every class, field and
  method reference to `androidx/collection/` in the 1.7.3 jars and in the compiled app sources, resolved through
  supertypes against that jar) found **220 references, 0 unresolved**.
- **androidx.lifecycle.** CMP 1.7 pulls JetBrains' `org.jetbrains.androidx.lifecycle:*:2.8.4` from Maven Central
  (it holds `androidx.lifecycle.compose.LocalLifecycleOwner`); those ask for Google's `androidx.lifecycle:*:2.8.5`
  and `androidx.arch.core:core-common:2.2.0`, which stay excluded. The only 1.7.3 classes that reference the
  missing `Lifecycle`/`LifecycleRegistry`/`ViewModelStore` types are `ComposeContainer` (ComposeWindow /
  ComposePanel) and the `LocalInternalViewModelStoreOwner` it provides; `ImageComposeScene` and the ui-test rule
  use `CanvasLayersComposeScene` and never touch them, which the green run confirms.
- **androidx.annotation.** Still excluded; `collection-desktop:1.6.0-beta02` resolves JetBrains'
  `annotation-desktop:1.8.0-alpha01` from Maven Central, annotations only.
- No screen moved to `androidOnlyFiles`: everything that compiled on 1.6.11 compiles on 1.7.3 with no source
  change. The bump brought two WARNING-level deprecations: `KeyboardOptions(autoCorrect = …)` (10 call sites) and
  `animateItemPlacement` (NamesScreen). WP-INT cleared both at integration with no behaviour change:
  `autoCorrectEnabled = false` (the deprecated constructor only forwards to it) and
  `animateItem(fadeInSpec = null, placementSpec = ThesisMotion.spatial(), fadeOutSpec = null)` (Compose 1.7's own
  body of `animateItemPlacement`), plus the KDocs that described 1.6 / M3 1.2 (`Inputs.kt`, `DismissibleItem.kt`,
  `Rows.kt`). The harness now compiles with no deprecation warning. What is left for PR-4b is in
  [`HANDOFF-H.md`](HANDOFF-H.md).

**Android-only files.** CI is the only real compile. As a proxy, every file under `ui/`, `model/`, `data/`,
`launch/`, `offline/`, `network/` plus `MainActivity.kt` (including `ThesisApp`, `MainViewModel`, `ui/platform/*`,
`DeepDiveWebPage`) was compiled against CMP 1.7.3 with the android.jar (Robolectric android-all 15) and stubs for
activity, lifecycle (`androidx.lifecycle.compose.LocalLifecycleOwner` with the real signature), Room, Firebase and
RevenueCat: green, and the only deprecation left was `animateItemPlacement` (cleared at integration, above). The stubs are hand-written, so this
catches Compose API breaks, not activity/lifecycle signature drift.

## Render sweep, before and after

The whole design-preview suite was rendered on f757e20 (CMP 1.6.11) and on HEAD (CMP 1.7.3), and the 1050 PNGs present in
both runs were compared pixel by pixel (largest channel difference; above 16 counts as more than antialiasing).
Before/after pairs (before | after | mask: red = channel difference above 16, green = any difference) for one render
of each class A-D are committed in [`pr4a-pairs/`](pr4a-pairs/) (cropped, 128 colours). The full set from the run
(`report.tsv` plus 892 pairs) is in the WP-H scratchpad, `pr4a-H/diff-final/`, not committed (270 MB); `report.tsv`
has one row per render with the share of pixels above 0, 16 and 64 and the box of the pixels above 16.

| Result | Renders | What it is |
|---|---|---|
| Identical | 74 | |
| Differences of 16 or less only | 141 | Gradient and glow dither (skiko 0.8.4 → 0.8.18). |
| Above 16 on under 0.1% of pixels, none above 64 | 755 | Edge antialiasing of vector icons and glyphs: the same shapes in the same places (checked by crop on the Research list icon and the top-bar search icon). |
| Above 16 on under 0.1% of pixels, some above 64 | 22 | Small, local and real, checked one by one with a shift search: letter-spaced kickers 1-4 px to the left (B: `inbox-fs2-light` "PULSE", `kit-type-scale` "FIGURE", `dd-classic-whole` and `dd-classic-whole-free-light` "TOP RISKS"; 6); mid-animation frames 1-2 px apart vertically (D: `kit-motion-rolling-t090/t180`; 4); one label 1 px sideways (`kit-charts-line` end label "32.0%" right, `account-you-free-full` "Free" left; 4); and strong antialiasing with no shift on rounded card corners and one glyph (`kit-cards`, `-fs130`, `-360-fs200`, `inbox-fs13-dark` and `shell-inbox-scale1.3-dark` "Mark all as seen"; 8). |
| Above 16 on 0.1% or more, or a size change | 58 | The real changes, classified below. |

The 58, by cause (40 A, 6 B, 1 C, 6 D, 5 E):

- **A. Labelled text fields at large font scale (M3 1.3, intended upstream change).** At 1.3x / 2.0x a labelled
  `OutlinedTextField` is 2.4 dp / 8 dp taller, so everything below it moves down. Account auth and reset at
  scale 1.3/2.0, `names-loaded-font130/200`, `names-notes-360`, `research-root/search/history-font13/20`,
  `shell-{auth,names,research,today-history}-360-scale2.0`, `account-delete-dialog-360-scale2.0`, and
  `kit-controls-fs130` / `-360-fs200` (the only 4 size changes: 3322 → 3364 px and 4609 → 4756 px tall). Before the
  `Kit.fieldLabelOverhang` fix the kit's fill also showed as a band above the outline in these renders; after the fix
  fill and outline line up. Settled renders at 1.0x show no field change.
- **B. Letter-spaced sans text on desktop.** Kickers, eyebrows and badges with letter spacing start about 2 px
  (0.8 dp) earlier, 4 px at 2.0x: here `kit-atoms` (badges, 4 renders) and the onboarding "PULSE" kicker at 2.0x
  (`account-onboarding-2-pulse-360-scale2.0`), and 6 more in the "some above 64" row above. This is skiko 0.8.18
  shaping; Android shapes text with its own engine, so the app is not affected by it. It does mean the harness now
  differs from a device here: Android (like the 1.6.11 harness) puts half the letter spacing before the first glyph,
  so a kicker sits that much to the right of its column edge on a device, while the 1.7.3 harness draws it flush
  (2 px further left in `kit-atoms`, 4 px at 2.0x). Noted in the design-preview README.
- **C. The stock M3 `AlertDialog` specimen (`f1-m3`).** M3 1.3 changed the dialog container token from `Surface` to
  `SurfaceContainerHigh` (light 228,226,222 → 248,244,235; dark 20 → 28), and the 1.6 desktop also drew a scrim of
  about 10% over the dialog itself. Every dialog in the app is drawn by the kit with explicit colours, so no screen
  changes; a future stock M3 dialog or picker would pick up the new token.
- **D. Mid-animation frames.** `kit-motion-transform-t060/t120/t180` and `shell-motion-sample-arrives/dismiss-120ms`
  (and `kit-motion-rolling-t090/t180` in the "some above 64" row) differ by 1-2 px offsets, under one frame of
  progress. Every settled frame of the same sequences is unchanged.
- **E. Order-dependent harness scenes, present on 1.6.11 too.** `inbox-undo-done-dark`, `inbox-quiet-mid-dark`,
  `shell-you-snackbar-dark`, `shell-inbox-snackbar-light`, `shell-research-snackbar-open-light`. Their result depends
  on which tests ran before them in the same JVM, not on the Compose version:
  - Run on their own (`--tests` on the three methods `MacroInboxRenders.inboxUndoDone`, `.inboxQuietCollapseMid`,
    `ShellRenders.snackbarOverYou`), 1.6.11 and 1.7.3 give the same pictures (no pixel above 16), equal to the
    1.6.11 full suite: Undo brings the row back. In the 1.7.3 full suite (twice) Undo did not bring it back and the
    `inbox-quiet-mid` and `shell-you-snackbar-dark` frames differ too.
  - Run as two whole classes (`MacroInboxRenders`, `ShellRenders`), **1.6.11** gives that same "row not back"
    `inbox-undo-done` and the same `shell-you-snackbar-dark` as the 1.7.3 full suite, and a `shell-you-snackbar-light`
    that differs from both full suites. A 1.7.3 run of the two classes matches the 1.7.3 full suite.
  - The two `-light` snackbar renders: a second 1.6.11 full run differs from the first in the same way and matches
    HEAD.

  So none of the five is a regression. The device pass still checks the real gesture (checklist, Lists). The
  isolated and class reruns are in the WP-H scratchpad, `pr4a-H/r2/` (`iso-base`, `iso-head`, `class-base`,
  `class-head`). Separately, `shell-motion-push-60ms-dark` and `macro-morph-mid-dark` differed between two 1.7.3
  full runs (one of them matches 1.6.11, so they are not among the 58). The integration review's full 1.7.3 run
  added `kit-motion-stage-t080-dark` and `shell-motion-back-to-report-120ms-dark` (mid-animation frames that differed
  from both the 1.6.11 run and WP-H's 1.7.3 run) and showed `shell-you-snackbar-light` and
  `shell-research-snackbar-open-dark` without their snackbar. These are order-dependent in the same way.

  **Cause and fix (WP-INT).** Not order but timing. State that an effect coroutine writes (`LaunchedEffect` setting
  `shown` in `ThesisSnackbarHost`, the Inbox undo restoring a row, an `Animatable` target) lands in the global
  snapshot, and on desktop Compose's `GlobalSnapshotManager` sends its apply notifications from the AWT thread
  (skiko's `MainUIDispatcher`) in real time (checked in the CMP 1.7.3 `ui-desktop` bytecode; 1.6.11 works the same
  way), concurrently with the capture loop on the test thread. Whether a frame saw such a write raced the loop, so
  results moved with machine load and JIT warm-up. Measured: a probe rendering the "Deep Dive ready. / Open" shell
  scene 200 times in one JVM missed the snackbar 33 times (with the message on the host every time), and a first
  WP-INT full run captured `shell-inbox-snackbar-dark` and `shell-research-snackbar-open-dark` without it. The
  capture loops (`captureFrame` in `RenderScreen.kt`, the Inbox gesture scenes in `MacroInboxRenders.kt`) now run on
  the AWT thread (`onUiThread`), so `GlobalSnapshotManager` cannot run during a capture, and send the apply
  notifications themselves after each frame's coroutines (`runEffects`), as Android's frame loop does. The same probe
  then gave 200/200 snackbars and the identical frame sequence on every run. After the fix, a full suite run and a
  separate run of `ShellRenders`, `MacroInboxRenders` and the kit and shell motion classes gave 210 pixel-identical
  renders. Against WP-H's final 1.7.3 renders, the only changes are these scenes now settling the right way:
  `inbox-undo-done-dark` (Undo brings the row back: All 7, 3 new), `inbox-quiet-mid-dark` and
  `shell-you-snackbar-dark` (their snackbar now shows). Home's greeting follows the wall clock ("Good afternoon" /
  "Good evening"), not a change. `ShellRenders` also asserts, in each
  theme, that the snackbar's message is still on the host at the capture (a timed-out or dismissed message fails).

The residual M3 ripple was also checked as a pixel: a pressed `LocalIndication` on graphite paints 39/255 over a
22/255 surface on both 1.6.11 (`RippleTheme`) and 1.7.3 (`RippleConfiguration`), identical.

## Regression checklist (playbook 1.3 plus this WP's list)

| Area | Harness result | Needs a device / CI |
|---|---|---|
| Ripple / press | No kit or screen surface uses a ripple (`indication = null` + `thesisPress`, unchanged). The residual M3 ripple keeps `ink` at 6% / 8%: `RippleConfigurationTest` (config in three palettes, and the drawn pixel). No `Indication` class of our own, so the 1.7 "legacy Indication throws" change cannot hit. | Press a Switch thumb and a text field: the tint must look as on the PR-3 APK. |
| Text fields | **Regression found and fixed.** M3 1.3 pads a labelled `OutlinedTextField` by `BodySmallLineHeight / 2` = 8 **sp** (1.2.1: 8 dp). At 1.3x/2.0x font scale the field grew and the kit's fill (drawn from a fixed 8 dp) showed as a band above the outline. `Kit.fieldLabelOverhang` is now 8.sp: identical at 1.0x, aligned at 1.3x/2.0x. What remains is M3's own change: a labelled field is 2.4 dp (1.3x) / 8 dp (2.0x) taller, which leaves room for the larger floating label. Disabled fields drop the `SetText` accessibility action (correct). | IME, autofill (`AutofillNode` still works on 1.7), cursor handles. |
| Serif metrics (Newsreader) | Newsreader titles, ledes and story text keep their positions, line breaks and line heights; the serif glyphs differ only by edge antialiasing. Letter-spaced sans kickers start about 2 px earlier (sweep, B: skiko shaping, desktop only). | Android shapes text with its own engine; compare the serif headings on the phase APK. |
| Pager (onboarding) | API source-compatible (`beyondBoundsPageCount` default 0 → `beyondViewportPageCount` 0; new `snapPosition = Start` default = old behaviour). Onboarding renders and `AccountSemanticsTest` paging tests pass. | Fling feel and snapping (1.7 `TargetedFlingBehavior`). |
| Pull to refresh | M2 `pullRefresh` diff 1.6.11 → 1.7.3: `NestedScrollSource.Drag` renamed `UserInput`, inspectable wrapper removed; logic identical. `Refresh` renders unchanged. | Pull on Pulse, Home, Names. |
| Bottom sheets | **Window geometry changed by M3 1.3; kept as on 1.2 where it matters (WP-INT).** Bytecode of the two jars: M3 1.2.1 ran the sheet in `ModalBottomSheetPopup`, which wrapped the whole layout (sheet and scrim) in `windowInsetsPadding(systemBarsForVisualComponents.only(Vertical))`. M3 1.3 runs it in `ModalBottomSheetDialog`, an edge-to-edge dialog window; `BottomSheetDefaults.windowInsets` is now `safeDrawing.only(Bottom)` and is only applied as padding on the sheet *content* (`contentWindowInsets`), not the old whole-layout inset, and nothing adds a top inset. Left alone, a tall sheet (Licences, any sheet at 2.0x) would expand under the status-bar icons, and the dialog window, not `SystemBarAppearance`, would own the bar icons (M3 sets them from the system dark setting, ignoring ThemeMode and the HeroBand rule). `ThesisSheet` now: pads the sheet by `WindowInsets.statusBars` (top edge stops under the status bar, as on 1.2); passes `contentWindowInsets = { safeDrawing.only(Bottom) }` explicitly (surface runs under the nav bar, its content is padded by it, so the last row sits where it did); and wraps the call in `SheetWindowBars` (ui/platform, desktop shim is a pass-through), which gives M3 a `LocalConfiguration` whose night bit matches the palette and, from inside the sheet, sets the dialog window's icons from the palette and `LocalStatusBarLight` (the HeroBand rule). The scrim now also covers both bars (M3 1.3's own look; not changed). Desktop has no insets, so the sheet renders are unchanged; compiled by the harness and by the Android proxy compile. | Predictive-back shrink of the sheet on Android 14+ (new in M3 1.3). Top edge of a tall sheet: You > Licences, and any sheet at 2.0x font: the drag handle stays below the status-bar icons. Bottom: the last row sits above the gesture/3-button nav bar, the surface colour runs under it. Icon colour with the app theme set opposite to the system theme (app Dark on a light system and the reverse): status and nav icons readable while the sheet is open and after it closes. A sheet opened over a HeroBand at rest in the light theme: light status-bar icons. |
| WebView back | `DeepDiveWebPage` uses activity-compose `BackHandler` (unchanged version); `CoveredBackScope` now reads the new `LocalLifecycleOwner`, same object. | Back inside the report, back with a screen pushed over it. |
| Predictive back | `ThesisPredictiveBackHandler` wraps activity-compose 1.9.1's `PredictiveBackHandler` (unchanged). Shell motion renders and `ShellChromeMotionTest` pass. | The push/pop scrub on a device. |
| Motion | Mid-animation captures (`kit-motion-*-tNNN`, `shell-motion-sample-*-120ms`) differ by under a frame of progress; every settled frame is unchanged. No motion spec or token changed. | Feel of the push/pop and sheet motion on a device. |
| Lists | Names rows glide with `animateItem` (placement only, fades null: the same call `animateItemPlacement` makes on 1.7); Names dismiss renders unchanged; Inbox quiet/undo renders were timing-dependent in the harness on both versions; with the capture loop on the AWT thread they are deterministic and Undo brings the row back (sweep, E). | Inbox: swipe a row to quiet, then Undo: the row comes back in its place and the filter counts and the "new" count return to what they were. |
| Swipe to quiet (Inbox, Source) | `SwipeToQuiet` (`ui/components/Source.kt`) is the stock M3 `SwipeToDismissBox` (`confirmValueChange` plus a haptic from `snapshotFlow { targetValue }`); its anchors and thresholds come from Material3, which moves 1.2.1 → 1.3.x with this BOM. Compiles unchanged; the renders replay one swipe past the threshold and do not measure where the threshold is. | The haptic fires once, when the row crosses the threshold; releasing past it quiets the alert; releasing before it springs the row back with no haptic and no quiet. |

## Tests

- design-preview, full suite on HEAD (`/opt/gradle/bin/gradle test`): BUILD SUCCESSFUL, 1156 tests, 0 failures (684 preview harness, render and semantics tests, 472 app unit tests run by the harness). Re-run after the WP-INT fixes: 1156 tests, 0 failures, no Compose deprecation warning in the compile.
- Android proxy compile (CMP 1.7.3 + android.jar + stubs, now also for `LocalConfiguration` and `DialogWindowProvider`), after the WP-INT fixes: green, including `ui/platform/SheetWindow.kt`, with no deprecation warning.
- `tools/design-lint.sh`: OK, 0 findings, none above baseline (no screen file touched).
- `tools/gold-share.py` on the HEAD renders: 768 images, max 7.62%, 0 at or above 8% (unchanged from before).

## Risks only CI or a device can confirm

1. **CI compile of the Android-only files** against the real androidx 1.7.8 / M3 1.3.x jars (the proxy compile
   above used CMP 1.7.3 sources of the same line and stubs for activity/lifecycle).
2. **Dependency graph.** Confirm the BOM resolved as expected:
   `./gradlew :app:dependencies --configuration releaseRuntimeClasspath | grep -E "androidx.compose.(animation|foundation|ui|material3?):"`
   should show 1.7.8 for ui/foundation/animation and a 1.3.x material3; `androidx.lifecycle:*` should stay 2.8.x.
   AGP 8.5.2 may warn that it was tested up to compileSdk 34 (unchanged from today). Google Maven is blocked where
   this PR was made, so the transitive androidx versions the BOM brings in were not resolved here. Two CI failures
   would point at them rather than at our code:
   - `Module was compiled with an incompatible version of Kotlin. The binary version of its metadata is 2.1.0, expected
     version is 1.9.0` (or 2.0.0): some dependency pulled in a kotlin-stdlib or Kotlin-compiled library too new for
     Kotlin 1.9.24. Find it with `:app:dependencies` and pin it back, or move PR-4a's BOM down a step.
   - `checkDebugAarMetadata` failing with `Dependency '…' requires libraries and applications that depend on it to
     compile against version 36 or later of the Android APIs` (an AAR's `minCompileSdk` above our compileSdk 35):
     same fix, pin the named artifact to the previous version.
3. **Device pass** on a release APK for the checklist's right-hand column, especially the M3 1.3 sheet (its
   predictive-back animation, which arrives with the BOM, and the window geometry and bar icons that `ThesisSheet`
   and `SheetWindowBars` now set: no device has run them) and the pager's fling.
4. Text on Android: the harness checks layout with Skia; Android line breaking for the serif can still differ by a
   word as before.

## Rubric self-score (items that apply to a dependency bump)

| Item | Score | Note |
|---|---|---|
| T1 Token compliance | 3 | `tools/design-lint.sh`: 0 findings. The only token change is `Kit.fieldLabelOverhang` (8 dp → 8 sp, in `ui/theme`). |
| U1 Unit tests | 3 | 1156 tests, 0 failures, plus the new `RippleConfigurationTest` (4 tests). |
| R1 No behaviour regressions | 2 | Auth, reset, onboarding paging, dismiss, shell back and predictive-back tests green; WebView back, sheet back gesture, pager fling and pull to refresh still need the device pass. |
| A4 Font scale and width | 3 | The fill/outline band at 1.3x/2.0x was found by the sweep and fixed; no clipping or overlap at 1.3x, 2.0x or 360 dp. Fields are taller by M3's own change. |
| V3 Density and restraint (no ripple) | 3 | No ripple on kit or screen surfaces; the residual M3 ripple is pixel-identical to PR-3. |
| M2 Motion quality | 3 | No motion value changed; only mid-animation sampling moved by under a frame. |
| P1 Performance | 3 | No app code path changed apart from the ripple configuration, which is remembered per palette. The full suite ran in 30 min on HEAD; the 1.6.11 run cannot be compared because it shared the machine with another build. |

V1 and L1 do not apply: no colour, glow or light-theme token changed, and settled 1.0x renders differ only by
antialiasing apart from the stock M3 dialog specimen (sweep, C).
