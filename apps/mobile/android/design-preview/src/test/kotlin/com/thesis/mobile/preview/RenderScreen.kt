package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import org.jetbrains.skia.EncodedImageFormat
import java.io.File
import kotlin.math.roundToInt

/** Which theme(s) to render. DARK is what the app ships today (ThesisTheme() defaults). */
enum class PreviewTheme(val suffix: String) { DARK("dark"), LIGHT("light") }

/** Pixel 7-ish phone: 412 x 915 dp at 2.625 px/dp (1081 x 2402 px). */
object PhoneSpec {
    const val WIDTH_DP = 412
    const val HEIGHT_DP = 915
    val density: Float get() = System.getProperty("screens.density")?.toFloatOrNull() ?: 2.625f
}

/** Output directory for PNGs (set by Gradle: -Pscreens.out=..., default design-preview/build/screens). */
val screensOutDir: File
    get() = File(System.getProperty("screens.out") ?: "build/screens").also { it.mkdirs() }

/**
 * Renders [content] inside the app theme to `<screens.out>/<name>-<dark|light>.png` and returns the files.
 *
 * - Time is virtual: `delay()` in LaunchedEffects and Compose animations both advance together, in
 *   [frameMs] steps, for [settleMs] before the frame is captured (so StaggeredEntrance etc. have finished).
 *   Use `settleMs = 0` to capture the first frame, or a mid-animation value to inspect motion.
 * - [heightDp] > 915 gives a "tall" capture: scrollable screens lay out more content (full-page look).
 * - `-Pscreens.only=<regex>` skips names that do not match; `-Pscreens.theme=dark|light` limits themes.
 */
@OptIn(ExperimentalCoroutinesApi::class)
fun renderScreen(
    name: String,
    widthDp: Int = PhoneSpec.WIDTH_DP,
    heightDp: Int = PhoneSpec.HEIGHT_DP,
    density: Float = PhoneSpec.density,
    themes: List<PreviewTheme> = PreviewTheme.entries,
    settleMs: Long = 1_500,
    frameMs: Long = 100,
    content: @Composable () -> Unit,
): List<File> {
    System.getProperty("screens.only")?.takeIf { it.isNotBlank() }?.let { only ->
        if (!Regex(only).containsMatchIn(name)) return emptyList()
    }
    val themeFilter = System.getProperty("screens.theme")?.lowercase()
    val selected = themes.filter { themeFilter.isNullOrBlank() || it.suffix == themeFilter }

    return selected.map { theme ->
        val scheduler = TestCoroutineScheduler()
        val dispatcher = StandardTestDispatcher(scheduler)
        val scene = ImageComposeScene(
            width = (widthDp * density).roundToInt(),
            height = (heightDp * density).roundToInt(),
            density = Density(density),
            coroutineContext = dispatcher,
        ) {
            ThesisTheme(darkTheme = theme == PreviewTheme.DARK, dynamicColor = theme == PreviewTheme.LIGHT) {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                    content()
                }
            }
        }
        try {
            var nowMs = 0L
            scene.render(0)
            scheduler.runCurrent()
            while (nowMs < settleMs) {
                nowMs += frameMs
                scheduler.advanceTimeBy(frameMs)
                scheduler.runCurrent()
                scene.render(nowMs * 1_000_000)
            }
            val image = scene.render(nowMs * 1_000_000 + 1)
            val png = image.encodeToData(EncodedImageFormat.PNG)
                ?: error("PNG encoding failed for $name")
            File(screensOutDir, "$name-${theme.suffix}.png").apply { writeBytes(png.bytes) }
                .also { println("rendered ${it.absolutePath} (${image.width}x${image.height})") }
        } finally {
            scene.close()
        }
    }
}
