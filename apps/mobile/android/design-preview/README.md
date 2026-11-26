# design-preview: compile, test and render the app's Compose UI on a plain JVM

A standalone Gradle build. It is **not** part of the Android build: `../settings.gradle.kts` does not include
it, so `:app` is unaffected. It compiles the app's `ui/**` and `model/**` sources unchanged (a `Sync` task stages
a filtered copy into `build/app-src`) against Compose Multiplatform Desktop 1.6.11, which is the same Compose 1.6 /
Material3 1.2.1 code as `compose-bom:2024.06.00`. It renders composables with Skia (`ImageComposeScene`) to PNG.
It needs only Maven Central and the Gradle Plugin Portal: no Android SDK, no Google Maven, no emulator.

## Requirements

- **Gradle 8.x** (8.14.3 tested), for example `/opt/gradle/bin/gradle`. Do not use the repo's `gradlew`: it is
  Gradle 9, which the Kotlin 1.9.24 Gradle plugin does not support. Because this folder has its own
  `settings.gradle.kts`, it is its own root build: `../gradle/gradle-daemon-jvm.properties` (JetBrains JDK 21 from
  foojay) does not apply, and the JDK that runs Gradle (17+) is used.
- **Fonts** (renders only). Install Roboto, Noto Serif and Noto Sans Mono (Android's default sans, serif and mono),
  then map "Noto Sans" (what Compose Desktop asks for as `FontFamily.Default`) to Roboto:
  `cp fonts/99-thesis-preview.conf ~/.config/fontconfig/conf.d/ && fc-cache -f`. Without them, renders fall back
  to DejaVu and look clearly different.

## Commands (run from `apps/mobile/android`)

```bash
G=/opt/gradle/bin/gradle

# Compile the app UI + model sources and the render tests (about 25 s clean, a few s incremental)
$G -p design-preview compileKotlin compileTestKotlin

# The app's own JVM unit tests (app/src/test): all of them
$G -p design-preview test -PappTestsOnly

# Renders -> design-preview/build/screens/<name>-dark.png and <name>-light.png
$G -p design-preview test -PrendersOnly
$G -p design-preview test -PrendersOnly -Pscreens.only='^home'   # names matching a regex
$G -p design-preview test -PrendersOnly -Pscreens.theme=dark     # one theme only
$G -p design-preview test -PrendersOnly -Pscreens.out=/abs/dir -Pscreens.density=2
```

Add `--offline` once dependencies are cached. Compile errors point at `design-preview/build/app-src/...`; the paths
under `com/thesis/mobile/...` match `app/src/main/java/` one for one.

## Unit tests

`app/src/test/java` is compiled and run here (JUnit 4, `org.json:json` standing in for Android's copy), all of it
since PR-1 moved `defaultNotificationPreferences()` to `ui/shell/UiState.kt` (`NotificationDefaultsTest` included).
This does not replace CI's `:app:testDebugUnitTest`, but it runs the same test code.

## Writing a render

Add a test under `src/test/kotlin/com/thesis/mobile/preview/`:

```kotlin
class MyScreensTest {
    @Test
    fun names() {   // block body: JUnit 4 test methods must return Unit
        renderScreen("names-3-tickers") {
            NamesScreen(padding = PaddingValues(), watchlist = listOf("AAPL", "MSFT"), /* ... */)
        }
    }
}
```

`renderScreen(name) { }` wraps the content in `ThesisTheme(mode, upDown, reduceMotion)` on a
`colorScheme.background` box and writes `<name>-dark.png` and `<name>-light.png`. Parameters (all optional):

| Parameter | Default | Use |
|---|---|---|
| `widthDp`, `heightDp`, `density` | 412, 915, 2.625 | `PhoneSpec.NARROW_WIDTH_DP` (360) for the width check, `PhoneSpec.FULL_PAGE_HEIGHT_DP` (2400) for a full page |
| `themes` | dark and light | `listOf(PreviewTheme.DARK)` for one theme |
| `settleMs`, `frameMs` | 1500, 100 | virtual time before the capture: `0` = first frame, a mid value to inspect motion |
| `fontScale` | 1.0 (`-Pscreens.fontScale`) | the user's font size: 1.3 and 2.0 smoke renders (rubric A4) |
| `reducedMotion` | false (`-Ppreview.reducedMotion=true`) | `ThesisTheme(reduceMotion = true)` and the AnimatorScale shim reports scale 0 (rubric M3) |
| `glow` | true (`-Ppreview.glow=false`) | false makes `RenderFlags.pageGlow` false, so the page glows are skipped (bulk state renders) |
| `upDown` | `UpDownScheme.Classic` | `ColourBlind` |
| `fitHeight` | false | crop the PNG to the content's height (galleries) |

Time is virtual: `delay()` in effects and Compose animations advance together, so entrance animations have
finished at `settleMs`.

Kit gallery: `KitGallery.kt` has `renderGallery(name) { Specimen("Label") { ... } }` (a cropped, labelled column of
specimens on the page background); `KitGalleryRenders.kt` holds the foundation sheets (palette, type scale,
icons) and the kit components.

## Semantics tests

`org.jetbrains.compose.ui:ui-test-junit4-desktop` is on the test classpath (`createComposeRule()`).
`SemanticsAsserts.kt` adds `assertAllTouchTargetsAtLeast()` (rubric A1: every clickable laid out at 48 dp or more),
`assertTouchTargetAtLeast()`, `assertRole(Role.Tab)`, `assertIsHeading()` and `assertIsLiveRegion()`.

## Android-only APIs and their shims

| App file (not compiled here) | Shim in `src/shim/kotlin` | Preview behaviour |
|---|---|---|
| `ui/theme/ThesisFonts.kt` (R.font) | same path | loads `app/src/main/res/font/newsreader_*.ttf` (`-Ppreview.fontDir` overrides); system serif while absent |
| `ui/platform/Back.kt` | same path | `ThesisBackHandler` / `ThesisPredictiveBackHandler` register with `PreviewBack`; tests call `PreviewBack.press()` |
| `ui/platform/PlatformHaptics.kt` | same path | `rememberPlatformHaptics()` records into `PreviewHaptics.log` |
| `ui/platform/AnimatorScale.kt` | same path | scale 0 when `preview.reducedMotion=true`, else 1 |
| `ui/platform/CardShadow.kt` | same path | `Modifier.thesisCardShadow(...)` as a Skia blurred rounded rect (CSS box-shadow geometry) |
| `ui/platform/RenderFlags.kt` | same path | `pageGlow` follows `preview.glow` |

The whole `ui/platform/` folder is excluded (`androidOnlyDirs`). The API contract for the Android side is in the
shim files' KDoc; keep both in sync.

## Harness tests

`gradle -p design-preview test -PharnessOnly` runs the harness's own tests (`preview/harness/`): render size,
font scale, reduced motion, glow, `fitHeight`, card shadow, the back/haptics/font shims and the semantics helpers.
They are part of the renders half (`-PrendersOnly`), not of the app's unit tests (`-PappTestsOnly`).
Their PNGs go to a temp folder, never into `screens.out`, so a `render.sh` run lists only real renders.

## Not compiled here

Files listed in `androidOnlyFiles` and `androidOnlyDirs` in `build.gradle.kts` (MainViewModel, ThesisApp, the WebView
report page, PDF export, the CSV picker, two screens that call `viewModel()`,
`ui/theme/ThesisFonts.kt` and `ui/platform/`). `src/shim/kotlin`
stubs the few symbols other files need from them; the WebView is drawn as a labelled placeholder. CI compiles the
Android-only files, so write them against the APIs on `app/build.gradle.kts`'s classpath. Keep
`ProductApiException` in sync with `ProductApiClient.kt`.

## Known limits

- Skia's native memory grows with many tall `ImageComposeScene`s in one JVM (a whole kit sheet class was once killed
  with exit 137), so every test class except the app unit tests runs in its own forked JVM (`forkEvery = 1`).
- Compose Desktop 1.6 can deadlock (Recomposer lock against the BroadcastFrameClock lock, with the AWT
  GlobalSnapshotManager) when a frame callback forces a LazyList remeasure, for example `animateScrollToItem`
  during a render. Set initial scroll positions by jumping on first placement (as the kit's ChapterPills does),
  not by animating.

## How close is it to a device

Same Compose layout, Material3 components, colours, shapes, icons and animation code. Different: text is shaped
by Skia's paragraph engine (line breaks can differ by a word), there are no system bars or insets (content starts
at y = 0), and there is no ripple or touch state. `androidx.collection` comes from JetBrains' Maven Central copy
(`collection-desktop:1.6.0-beta02`); `androidx.annotation` and `androidx.lifecycle` are excluded.
