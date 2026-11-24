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

# The app's own JVM unit tests (app/src/test): 34 tests
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

`app/src/test/java` is compiled and run here (JUnit 4, `org.json:json` standing in for Android's copy).
`Phase4CopyTest` (2 tests) is excluded because `defaultNotificationPreferences()` lives in `MainViewModel`.
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

`renderScreen(name, widthDp = 412, heightDp = 915, density = 2.625f, themes = [DARK, LIGHT], settleMs = 1500,
frameMs = 100) { }` wraps the content in `ThesisTheme` on a `colorScheme.background` box. Time is virtual:
`delay()` in effects and Compose animations advance together, so entrance animations have finished at `settleMs`
(use `settleMs = 0` for the first frame, a mid value to inspect motion). Use a larger `heightDp` for a full page.

## Not compiled here

Files listed in `androidOnlyFiles` in `build.gradle.kts` (MainViewModel, ThesisApp, the WebView report page, PDF
export, the CSV picker, the Vico sentiment screen, and two screens that call `viewModel()`). `src/shim/kotlin`
stubs the few symbols other files need from them; the WebView is drawn as a labelled placeholder. CI compiles the
Android-only files, so write them against the APIs on `app/build.gradle.kts`'s classpath. Keep
`ProductApiException` in sync with `ProductApiClient.kt`.

## How close is it to a device

Same Compose layout, Material3 components, colours, shapes, icons and animation code. Different: text is shaped
by Skia's paragraph engine (line breaks can differ by a word), there are no system bars or insets (content starts
at y = 0), and there is no ripple or touch state. `androidx.collection` comes from JetBrains' Maven Central copy
(`collection-desktop:1.6.0-beta02`); `androidx.annotation` and `androidx.lifecycle` are excluded.
