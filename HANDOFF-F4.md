# HANDOFF from F4 (Harness and guards), PR-1

Changes F4 needs in files it does not own, plus the API contract its shims define. Section numbers refer to
`docs/app-redesign/DESIGN-DIRECTION.md` (v2.1). Each item: file, change, reason.

## 1. For F2: `ui/platform/*` must match the shims exactly

design-preview excludes the whole `ui/platform/` folder (`androidOnlyDirs` in `design-preview/build.gradle.kts`)
and compiles `design-preview/src/shim/kotlin/com/thesis/mobile/ui/platform/*.kt` instead. Any `ui/**` code that
calls these APIs compiles against the shim in the harness and against F2's files on Android, so the public
signatures must be identical. Reference Android implementations (activity-compose 1.9.1, core-ktx 1.13.1,
Compose 1.6.8, compileSdk 35), ready to paste:

### `ui/platform/Back.kt`

Change: create with this API. Reason: section 4 preamble (back handling goes through `ui/platform/Back.kt`).

```kotlin
package com.thesis.mobile.ui.platform

import androidx.activity.BackEventCompat
import androidx.activity.compose.BackHandler
import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

enum class BackSwipeEdge { Left, Right }

@Immutable
data class ThesisBackEvent(
    val progress: Float,
    val swipeEdge: BackSwipeEdge,
    val touchX: Float = 0f,
    val touchY: Float = 0f,
)

@Composable
fun ThesisBackHandler(enabled: Boolean = true, onBack: () -> Unit) {
    BackHandler(enabled = enabled, onBack = onBack)
}

@Composable
fun ThesisPredictiveBackHandler(
    enabled: Boolean = true,
    onBack: suspend (progress: Flow<ThesisBackEvent>) -> Unit,
) {
    PredictiveBackHandler(enabled = enabled) { events: Flow<BackEventCompat> ->
        onBack(events.map { it.toThesisBackEvent() })
    }
}

private fun BackEventCompat.toThesisBackEvent() = ThesisBackEvent(
    progress = progress,
    swipeEdge = if (swipeEdge == BackEventCompat.EDGE_RIGHT) BackSwipeEdge.Right else BackSwipeEdge.Left,
    touchX = touchX,
    touchY = touchY,
)
```

The harness version registers handlers with `PreviewBack`; tests call `PreviewBack.press()` (innermost enabled
handler wins, returns false when nothing handles back) to check "back never exits from a sub-screen".

### `ui/platform/PlatformHaptics.kt`

Change: create with this API; `ui/motion/Haptics.kt` (`ThesisHaptics`, F2) maps `press()`, `confirm()`, ... onto
`HapticKind`. Reason: section 4.7 (Android calls live in `ui/platform`); the 28 ms tick throttle uses
`SystemClock`, which is allowed only here.

```kotlin
package com.thesis.mobile.ui.platform

import android.os.Build
import android.os.SystemClock
import android.view.HapticFeedbackConstants as H
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

enum class HapticKind {
    Press, Confirm, Reject, ToggleOn, ToggleOff, Segment, Tick, Threshold, GestureStart, GestureEnd, LongPress,
}

@Stable
fun interface PlatformHaptics {
    fun perform(kind: HapticKind)
}

@Composable
fun rememberPlatformHaptics(): PlatformHaptics {
    val view = LocalView.current
    return remember(view) { ViewHaptics(view) }
}

private const val TICK_INTERVAL_MS = 28L

private class ViewHaptics(private val view: View) : PlatformHaptics {
    private var lastTickAt = 0L

    override fun perform(kind: HapticKind) {
        if (kind == HapticKind.Tick) {
            val now = SystemClock.uptimeMillis()
            if (now - lastTickAt < TICK_INTERVAL_MS) return
            lastTickAt = now
        }
        view.performHapticFeedback(constantFor(kind))
    }
}

private fun constantFor(kind: HapticKind): Int {
    val sdk = Build.VERSION.SDK_INT
    return when (kind) {
        HapticKind.Press -> H.VIRTUAL_KEY
        HapticKind.Confirm -> if (sdk >= 30) H.CONFIRM else H.VIRTUAL_KEY
        HapticKind.Reject -> if (sdk >= 30) H.REJECT else H.LONG_PRESS
        HapticKind.ToggleOn -> if (sdk >= 34) H.TOGGLE_ON else H.CONTEXT_CLICK
        HapticKind.ToggleOff -> if (sdk >= 34) H.TOGGLE_OFF else H.CONTEXT_CLICK
        HapticKind.Segment -> if (sdk >= 34) H.SEGMENT_TICK else H.CLOCK_TICK
        HapticKind.Tick -> if (sdk >= 34) H.SEGMENT_FREQUENT_TICK else H.CLOCK_TICK
        HapticKind.Threshold -> if (sdk >= 34) H.GESTURE_THRESHOLD_ACTIVATE else H.CONTEXT_CLICK
        HapticKind.GestureStart -> if (sdk >= 30) H.GESTURE_START else H.CLOCK_TICK
        HapticKind.GestureEnd -> if (sdk >= 30) H.GESTURE_END else H.CLOCK_TICK
        HapticKind.LongPress -> H.LONG_PRESS
    }
}
```

The harness records every call in `PreviewHaptics.log`, so semantics tests can assert the 4.7 map (for example,
"a filter chip tap performs nothing").

### `ui/platform/AnimatorScale.kt`

Change: create with this API (playbook 3.2). Reason: section 4.8. Not `@ReadOnlyComposable` (it remembers an
observer); the shim follows the same rule.

```kotlin
package com.thesis.mobile.ui.platform

import android.content.ContentResolver
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

private fun ContentResolver.animatorScale(): Float =
    Settings.Global.getFloat(this, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

@Composable
fun rememberAnimatorDurationScale(): Float {
    val resolver = LocalContext.current.contentResolver
    var scale by remember(resolver) { mutableFloatStateOf(resolver.animatorScale()) }
    DisposableEffect(resolver) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) { scale = resolver.animatorScale() }
        }
        resolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer,
        )
        scale = resolver.animatorScale() // catch a change between remember and register
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return scale
}

@Composable
fun rememberSystemReducedMotion(): Boolean = rememberAnimatorDurationScale() == 0f
```

### `ui/platform/CardShadow.kt`

Change: create with this API. Reason: section 2.7 (DD card shadow `0 10px 28px -20px`, ink @ 35%, API 28+,
nothing on 26-27). The geometry is a parameter so `ui/platform` stays free of dp literals: `ui/platform` is
inside the design-lint scope (7.2 excludes only theme, components, charts/kit, motion, icons). The kit card
calls it **before** its clip and background:
`Modifier.thesisCardShadow(p.cardShadow, p.ink.copy(alpha = .35f), ThesisShape radius 14.dp, offsetY = 10.dp,
blur = 28.dp, spread = (-20).dp).clip(shape).background(p.surface).border(...)` (values from `ThesisSpace` /
`ThesisShapes` tokens). `spread` follows CSS: negative shrinks the shadow rect on every side.

```kotlin
package com.thesis.mobile.ui.platform

import android.os.Build
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp

fun Modifier.thesisCardShadow(
    enabled: Boolean,
    color: Color,
    cornerRadius: Dp,
    offsetY: Dp,
    blur: Dp,
    spread: Dp,
): Modifier {
    if (!enabled || Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return this
    return drawBehind {
        val spreadPx = spread.toPx()
        val left = -spreadPx
        val top = -spreadPx
        val right = size.width + spreadPx
        val bottom = size.height + spreadPx
        if (right <= left || bottom <= top) return@drawBehind
        val radius = (cornerRadius.toPx() + spreadPx).coerceAtLeast(0f)
        // CSS blur B is a Gaussian sigma of B/2; Android converts a shadow radius r to sigma 0.57735 r + 0.5.
        val shadowRadius = ((blur.toPx() / 2f - 0.5f) / 0.57735f).coerceAtLeast(0f)
        val paint = Paint()
        paint.asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = android.graphics.Color.TRANSPARENT // only the shadow is drawn
            setShadowLayer(shadowRadius, 0f, offsetY.toPx(), color.toArgb())
        }
        drawIntoCanvas { it.drawRoundRect(left, top, right, bottom, radius, radius, paint) }
    }
}
```

The harness draws the same geometry with a Skia blur (`RenderKnobsTest.cardShadowDarkensBelowTheCardOnlyWhenEnabled`).

### `ui/platform/RenderFlags.kt`

Change: create; `pageBackground` / `PageBackgroundCache` paint the 165° gradient but skip both glows when
`RenderFlags.pageGlow` is false. Reason: section 2.7 (`-Dpreview.glow=false` for bulk state renders); a platform
flag keeps preview switches out of kit code.

```kotlin
package com.thesis.mobile.ui.platform

object RenderFlags {
    /** False only in design-preview bulk renders. */
    val pageGlow: Boolean get() = true
}
```

## 2. For F2: icons and the kit gallery

- `ui/icons/ThesisIcons.kt` (committed by F4 as allowed in 6.1): ownership passes to F2 (WP-K in PR-3). Do not
  edit by hand: add the glyph to `ICONS` in `tools/icons/make_icons.py` and rerun it; `--check` verifies the file
  is current. API: `ThesisIcons.X` (opsz 24) and `ThesisIcons.Small.X` (opsz 20), `TodayFilled`, `NamesFilled`,
  `ResearchFilled`, `InboxFilled`, `FollowFilled` for selected states.
- Kit gallery: `design-preview/.../preview/KitGallery.kt` (`renderGallery`, `Specimen`, `Section`) is the
  scaffold; `KitGalleryRenders.kt` holds the foundation sheets (palette, hero palette, type scale 1x/2x, fonts,
  icons, RTL). Change: F2 adds its component renders in new files using `renderGallery` (for example
  `KitButtonsRenders.kt`, `KitCardsRenders.kt`; 6.0 rule 6 names files `<Area>Renders.kt`) or, after F4 merges,
  edits `KitGalleryRenders.kt` below the "F2" marker. Reason: exclusive ownership while both WPs are open.
- Semantics: `SemanticsAsserts.kt` gives `rule.assertAllTouchTargetsAtLeast()` (A1), `assertRole`,
  `assertIsHeading`, `assertIsLiveRegion` for the kit `SemanticsTest`. The touch check uses layout bounds:
  Compose expands every small pointer target's hit area to 48 dp, so touch bounds always pass; a target meets A1
  when `minimumInteractiveComponentSize()` (or an explicit 48 dp) gives it a 48 dp layout.

## 3. For F1

- `ui/theme/ThesisTheme.kt`: provide `LocalReducedMotion provides (reduceMotion || rememberSystemReducedMotion())`
  (from `ui/platform/AnimatorScale.kt`). Reason: 4.8 ("system animator scale is 0 or the in-app toggle"). The
  harness's `renderScreen(reducedMotion = true)` sets both, so either wiring renders correctly.
- `ui/theme/ThesisTheme.kt`: the `@Deprecated ThesisTheme(darkTheme, dynamicColor)` overload has no caller left
  in design-preview (RenderScreen now calls `ThesisTheme(mode = ..., upDown = ..., reduceMotion = ...)`); remove it
  when convenient.
- `ThesisFonts.kt`: F1's version (object `ThesisFonts` with `Newsreader`, `NewsreaderDisplay`, `Sans` and the five
  `R.font.newsreader_*` faces) matches the shim's API and file/weight table exactly. Verified by a trial merge of
  `wp/pr1-F1` (cc0481e) into this branch: design-preview compiles, 106 tests pass, renders show Newsreader.
- Font size note for 2.3: `tools/fonts/make_newsreader.py` with the specified subset (Latin Extended-A included)
  produces 374 KB for the five files (GPOS kerning is most of it), not "about 290 KB". The budget check in the
  script is set to 400 KB.

## 4. For F3 / WP-INT

- `design-preview/.../preview/RenderScreen.kt` and `design-preview/build.gradle.kts` pass to WP-INT after this
  merges (6.0 rule 2). New `renderScreen` parameters: `fontScale`, `reducedMotion`, `glow`, `upDown`, `fitHeight`
  (after the old ones, so positional callers still compile).
- `tools/design-lint-baseline.txt` is per file. Extracting `AuthScreen.kt`, `SettingsScreen.kt` and
  `ResearchScreen.kt` moves findings to new files (baseline 0), so the extraction commit must run
  `tools/design-lint.sh --update-baseline --allow-raise` and the total must not rise. `ui/shell/**` and
  `ui/navigation/**` are in scope from the first line.
- `ScreenSmokeRenders.research` renders `DeepDiveScreen`'s search state; once `ResearchScreen.kt` exists the
  smoke render should call it instead (F4 or WP-INT, whoever owns design-preview tests then).
- `PreviewBack.press()` can drive `ThesisShell` renders/tests for "back never exits from a sub-screen".

## 5. For the owner (Razvan): skipped, needs your OK (`.github/workflows/**`)

Not done by F4, because workflow files need the owner's approval:
1. `.github/workflows/design-preview.yml` (new, non-blocking): on `pull_request`, set up JDK 17 + Gradle 8.14.3
   (not the repo wrapper), cache `~/.gradle`, then run from `apps/mobile/android`:
   `gradle -p design-preview test` (compile + app unit tests + harness tests + renders),
   `tools/design-lint.sh`, `tools/design-lint.sh --self-test`,
   `python3 tools/gold-share.py design-preview/build/screens`, and upload `design-preview/build/screens/*.png` as
   an artifact. Install the preview fonts first (Roboto, Noto Serif via Google Fonts, plus
   `design-preview/fonts/99-thesis-preview.conf`), or renders fall back to DejaVu.
2. `.github/workflows/rebuild-test-apk.yml`: add `redesign/**` to its branch triggers (6.0), so each phase
   produces a phone APK.

## 6. Deviations from the doc, for the record

- design-lint: `\b` added before `tween(` and `spring(` (7.2 lists `tween\(`, which also matches
  `Duration.between(` in F1's `Fmt.kt`).
- gold-share: a pixel also needs HSV value >= 0.20 (default; `--min-value 0` is the literal T3 rule), so the dark
  page glow does not count as gold. The 18 Deep Dive renderer shots measure 0.2-6.4% with it.
- Semantics touch-target check uses layout bounds, not `touchBoundsInRoot` (reason in section 2 above).
