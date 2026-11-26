package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.Density
import com.thesis.mobile.ui.components.LocalPageBackgroundCache
import com.thesis.mobile.ui.components.PageBackgroundCache
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.UpDownScheme
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.jetbrains.skia.Surface
import java.awt.EventQueue
import java.io.File
import kotlin.math.roundToInt

/** Which theme(s) to render. */
enum class PreviewTheme(val suffix: String, val mode: ThemeMode) {
    DARK("dark", ThemeMode.Dark),
    LIGHT("light", ThemeMode.Light),
}

/** Pixel 7-ish phone: 412 x 915 dp at 2.625 px/dp (1082 x 2402 px). */
object PhoneSpec {
    const val WIDTH_DP = 412
    const val HEIGHT_DP = 915

    /** Narrow phone for the A4 width check (section 6.0 rule 6). */
    const val NARROW_WIDTH_DP = 360

    /** Full-page capture height for scrolling screens (section 6.0 rule 6). */
    const val FULL_PAGE_HEIGHT_DP = 2400
    val density: Float get() = System.getProperty("screens.density")?.toFloatOrNull() ?: 2.625f
}

/** Defaults for the render knobs, from -P/-D properties forwarded by build.gradle.kts. */
object PreviewDefaults {
    /** -Pscreens.fontScale (default 1.0). */
    val fontScale: Float get() = System.getProperty("screens.fontScale")?.toFloatOrNull() ?: 1f

    /** -Ppreview.reducedMotion=true renders everything with reduced motion. */
    val reducedMotion: Boolean get() = System.getProperty("preview.reducedMotion") == "true"

    /** -Ppreview.glow=false skips the page glows (bulk state renders, section 2.7). */
    val glow: Boolean get() = System.getProperty("preview.glow") != "false"
}

/** Output directory for PNGs (set by Gradle: -Pscreens.out=..., default design-preview/build/screens). */
val screensOutDir: File
    get() = File(System.getProperty("screens.out") ?: "build/screens").also { it.mkdirs() }

/**
 * Renders [content] inside the app theme to `<screens.out>/<name>-<dark|light>.png` and returns the files.
 *
 * - Time is virtual: `delay()` in LaunchedEffects and Compose animations both advance together, in
 *   [frameMs] steps, for [settleMs] before the frame is captured (so entrance animations have finished).
 *   Use `settleMs = 0` to capture the first frame, or a mid-animation value to inspect motion.
 * - [heightDp] > 915 gives a "tall" capture: scrollable screens lay out more content (full-page look).
 *   [fitHeight] = true measures the content (wrap-content height, at most [heightDp]) and crops the PNG to it,
 *   for galleries.
 * - [fontScale] is the user's font size setting (1.3 and 2.0 for the A4 smoke renders); it scales sp only.
 * - [reducedMotion] is passed to `ThesisTheme(reduceMotion = ...)` and to the AnimatorScale shim (as if the
 *   system animator scale were 0), so `LocalReducedMotion` is true either way.
 * - [glow] = false makes `RenderFlags.pageGlow` false: pageBackground skips the two glows (cheap bulk renders).
 * - [upDown] picks the up/down colour scheme (You > Appearance).
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
    fontScale: Float = PreviewDefaults.fontScale,
    reducedMotion: Boolean = PreviewDefaults.reducedMotion,
    glow: Boolean = PreviewDefaults.glow,
    upDown: UpDownScheme = UpDownScheme.Classic,
    fitHeight: Boolean = false,
    content: @Composable () -> Unit,
): List<File> {
    System.getProperty("screens.only")?.takeIf { it.isNotBlank() }?.let { only ->
        if (!Regex(only).containsMatchIn(name)) return emptyList()
    }
    val themeFilter = System.getProperty("screens.theme")?.lowercase()
    val selected = themes.filter { themeFilter.isNullOrBlank() || it.suffix == themeFilter }

    return withPreviewProperties(
        "preview.reducedMotion" to reducedMotion.toString(),
        "preview.glow" to glow.toString(),
    ) {
        selected.map { theme ->
            val image = captureFrame(
                widthDp, heightDp, density, fontScale, settleMs, frameMs, fitHeight,
            ) {
                ThesisTheme(mode = theme.mode, upDown = upDown, reduceMotion = reducedMotion) {
                    val box = if (fitHeight) Modifier.fillMaxWidth() else Modifier.fillMaxSize()
                    // The app's page background (2.7) under every render, from one cached bitmap sized to the
                    // render (as ThesisApp provides one for the window); `glow = false` keeps the gradient and skips
                    // the glows. Sized by this box, so `fitHeight` still measures the content, not the scene.
                    val cache = remember { PageBackgroundCache() }
                    CompositionLocalProvider(LocalPageBackgroundCache provides cache) {
                        Box(box.onSizeChanged { cache.areaSize = it }.pageBackground(LocalThesisPalette.current)) {
                            content()
                        }
                    }
                }
            }
            val (w, h) = image.width to image.height
            val png = try {
                image.encodeToData(EncodedImageFormat.PNG) ?: error("PNG encoding failed for $name")
            } finally {
                image.close()
            }
            File(screensOutDir, "$name-${theme.suffix}.png").apply { writeBytes(png.bytes) }
                .also { println("rendered ${it.absolutePath} (${w}x$h)") }
        }
    }
}

/**
 * Lays out and draws [content] in an [ImageComposeScene] on virtual time and returns the last frame.
 * With [fitHeight] the content is measured at wrap-content height and the image is cropped to it.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun captureFrame(
    widthDp: Int,
    heightDp: Int,
    density: Float,
    fontScale: Float,
    settleMs: Long,
    frameMs: Long,
    fitHeight: Boolean,
    content: @Composable () -> Unit,
): Image = onUiThread {
    val scheduler = TestCoroutineScheduler()
    val dispatcher = StandardTestDispatcher(scheduler)
    var measuredPx = -1
    val scene = ImageComposeScene(
        width = (widthDp * density).roundToInt(),
        height = (heightDp * density).roundToInt(),
        density = Density(density, fontScale),
        coroutineContext = dispatcher,
    ) {
        if (fitHeight) {
            Box(
                Modifier.fillMaxWidth().wrapContentHeight(Alignment.Top, unbounded = false)
                    .onSizeChanged { measuredPx = it.height },
            ) { content() }
        } else {
            content()
        }
    }
    try {
        // Intermediate frames are closed at once: each is a full-size native Skia image, and a tall render
        // keeps dozens of them alive until a GC otherwise (exit 137 on long render classes).
        var nowMs = 0L
        scene.render(0).close()
        runEffects(scheduler)
        while (nowMs < settleMs) {
            nowMs += frameMs
            scheduler.advanceTimeBy(frameMs)
            runEffects(scheduler)
            scene.render(nowMs * 1_000_000).close()
        }
        val image = scene.render(nowMs * 1_000_000 + 1)
        if (!fitHeight || measuredPx <= 0 || measuredPx >= image.height) {
            image
        } else {
            crop(image, image.width, measuredPx).also { image.close() }
        }
    } finally {
        scene.close()
    }
}

/**
 * Runs [block] (a whole capture loop) on the AWT event thread and returns its result.
 *
 * State written by an effect coroutine (a `LaunchedEffect` setting a `mutableStateOf`, `SnackbarHostState`
 * posting a message) lands in the global snapshot. On desktop, Compose's `GlobalSnapshotManager` sends its apply
 * notifications from the AWT thread (skiko's `MainUIDispatcher`) in real time, concurrently with a capture loop on
 * the test thread. That race made some renders depend on timing: about 1 in 6 snackbar scenes captured no snackbar,
 * and the Inbox undo sometimes captured the row not back (PR4A-BOM.md sweep E). With the loop on the AWT thread
 * itself, `GlobalSnapshotManager` cannot run until the capture is done, and [runEffects] sends the notifications
 * at fixed points of the virtual clock: the same frames every run.
 */
internal fun <T> onUiThread(block: () -> T): T {
    if (EventQueue.isDispatchThread()) return block()
    var result: Result<T>? = null
    EventQueue.invokeAndWait { result = runCatching(block) }
    return checkNotNull(result).getOrThrow()
}

/**
 * Runs the coroutines due on the virtual clock, then sends the global snapshot's apply notifications, so the next
 * frame recomposes with what those coroutines wrote (as Android's frame loop does). Call it on the [onUiThread]
 * thread.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun runEffects(scheduler: TestCoroutineScheduler) {
    scheduler.runCurrent()
    Snapshot.sendApplyNotifications()
}

private fun crop(image: Image, width: Int, height: Int): Image {
    val surface = Surface.makeRasterN32Premul(width, height)
    surface.canvas.drawImage(image, 0f, 0f)
    return surface.makeImageSnapshot()
}

/** Sets system properties for the duration of [block] (read by the ui/platform shims) and restores them. */
internal fun <T> withPreviewProperties(vararg props: Pair<String, String>, block: () -> T): T {
    val previous = props.map { (key, _) -> key to System.getProperty(key) }
    props.forEach { (key, value) -> System.setProperty(key, value) }
    try {
        return block()
    } finally {
        previous.forEach { (key, value) ->
            if (value == null) System.clearProperty(key) else System.setProperty(key, value)
        }
    }
}
