package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.preview.fixtures.MacroInboxFixtures
import com.thesis.mobile.ui.charts.kit.ChartDrawOnRegistry
import com.thesis.mobile.ui.charts.kit.LocalChartDrawOn
import com.thesis.mobile.ui.components.LocalPageBackgroundCache
import com.thesis.mobile.ui.components.PageBackgroundCache
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.copy.InboxCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.MacroStressScreen
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.delay
import org.jetbrains.skia.EncodedImageFormat
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.roundToInt

/**
 * WP-F renders (section 6.0 rule 6): Macro Stress (5.9) and the Inbox (5.21) loaded, loading, empty and failed, in
 * both themes; 1.3x and 2.0x font scale, 360 dp and full page; reduced motion; and mid-animation frames of the
 * chart draw-on, the range morph, a row expanding, a quiet collapsing and its Undo.
 *
 * Run: gradle -p design-preview test -PrendersOnly -Pscreens.only='^(macro|inbox)-'
 */
class MacroInboxRenders {

    // ---- Macro Stress

    @Test fun macro() = render("macro-loaded") { Macro() }

    @Test fun macroFullPage() = render("macro-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Macro() }

    @Test fun macroFontScale13() = render("macro-fs13", fontScale = 1.3f, themes = listOf(PreviewTheme.DARK)) { Macro() }

    @Test fun macroFontScale2() = render(
        "macro-fs2",
        fontScale = 2f,
        heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP,
        themes = listOf(PreviewTheme.LIGHT),
    ) { Macro() }

    @Test fun macroNarrow() = render("macro-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Macro() }

    @Test fun macroSevenDays() = render("macro-7d", themes = listOf(PreviewTheme.LIGHT)) { Macro(range = 7) }

    @Test fun macroLoading() = render("macro-loading", glow = false) {
        Macro(current = null, history = emptyList(), refreshing = true)
    }

    @Test fun macroEmpty() = render("macro-empty", glow = false) { Macro(current = null, history = emptyList()) }

    @Test fun macroError() = render("macro-error", glow = false) {
        Macro(current = null, history = emptyList(), error = "The macro service did not answer.")
    }

    @Test fun macroRefreshFailed() = render("macro-refresh-failed", glow = false, themes = listOf(PreviewTheme.DARK)) {
        Macro(error = "The macro service did not answer.")
    }

    @Test fun macroReducedMotion() = render("macro-reduced", reducedMotion = true, themes = listOf(PreviewTheme.DARK)) { Macro() }

    /** The 90 day range, settled: the x axis and the title after a range change. */
    @Test fun macroNinetyDays() = render("macro-90d", themes = listOf(PreviewTheme.DARK)) { Macro(range = 90) }

    /**
     * The chart drawing on, part way (first paint of a reading date). A registry of its own: the process-wide one
     * has already seen this reading date when another test in this class ran first, and would start it complete.
     */
    @Test fun macroDrawOnMid() = render("macro-drawon-mid", settleMs = 400, themes = listOf(PreviewTheme.DARK)) {
        CompositionLocalProvider(LocalChartDrawOn provides remember { ChartDrawOnRegistry() }) { Macro() }
    }

    /** A finger held on the chart: the cursor, the regime line and the readout rewritten for that day. */
    @Test fun macroScrub() = scene("macro-scrub", captureAtMs = SCRUB_AT_MS + 400, content = { Macro() }) { scrub(it) }

    /** 30D to 90D: the line morphing between ranges, 120 ms in. */
    @Test fun macroMorphMid() = render("macro-morph-mid", settleMs = MOVE_AT_MS + 120, frameMs = 10, themes = listOf(PreviewTheme.DARK)) {
        var range by remember { mutableIntStateOf(30) }
        LaunchedEffect(Unit) {
            delay(MOVE_AT_MS)
            range = 90
        }
        Macro(range = range)
    }

    // ---- Inbox

    @Test fun inbox() = render("inbox-loaded") { Inbox() }

    @Test fun inboxFullPage() = render("inbox-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Inbox() }

    @Test fun inboxFontScale13() = render("inbox-fs13", fontScale = 1.3f, themes = listOf(PreviewTheme.DARK)) { Inbox() }

    @Test fun inboxFontScale2() = render(
        "inbox-fs2",
        fontScale = 2f,
        heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP,
        themes = listOf(PreviewTheme.LIGHT),
    ) { Inbox(expanded = "a1") }

    @Test fun inboxNarrow() = render("inbox-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) {
        Inbox(expanded = "a1")
    }

    @Test fun inboxExpandedDrift() = render("inbox-expanded-drift") { Inbox(expanded = "a1") }

    @Test fun inboxExpandedLocked() = render("inbox-expanded-locked", themes = listOf(PreviewTheme.LIGHT)) { Inbox(expanded = "a2") }

    @Test fun inboxFiltered() = render("inbox-filtered", themes = listOf(PreviewTheme.DARK)) { Inbox(category = "earnings") }

    @Test fun inboxLoading() = render("inbox-loading", glow = false) { Inbox(alerts = emptyList(), loading = true) }

    @Test fun inboxEmpty() = render("inbox-empty", glow = false) { Inbox(alerts = emptyList()) }

    @Test fun inboxError() = render("inbox-error", glow = false) {
        Inbox(alerts = emptyList(), error = "The Inbox service did not answer.")
    }

    /** Every alert quiet: says so, and the footer offers them. */
    @Test fun inboxAllQuiet() = render("inbox-all-quiet", glow = false, themes = listOf(PreviewTheme.LIGHT)) {
        Inbox(alerts = MacroInboxFixtures.alerts.map { it.copy(mutedAt = "2025-11-25T07:00:00Z") })
    }

    @Test fun inboxRefreshFailed() = render("inbox-refresh-failed", glow = false, themes = listOf(PreviewTheme.LIGHT)) {
        Inbox(error = "The Inbox service did not answer.", refreshError = "The Inbox service did not answer.")
    }

    /** An action failed (feedback could not save): the list stays, nothing replaces it. */
    @Test fun inboxActionError() = render("inbox-action-error", glow = false, themes = listOf(PreviewTheme.DARK)) {
        Inbox(error = "Couldn’t save your feedback.")
    }

    @Test fun inboxReducedMotion() = render("inbox-reduced", reducedMotion = true, themes = listOf(PreviewTheme.DARK)) {
        Inbox(expanded = "a1")
    }

    /** A row expanding in place (AlertRow's animateContentSize on `spatial`), 120 ms after the tap. */
    @Test fun inboxExpandMid() = scene("inbox-expand-mid", captureAtMs = TAP_AT_MS + 120) { tap(it, ROW_X_DP, FIRST_ROW_Y_DP, TAP_AT_MS) }

    /** A real swipe toward the start: the row 140 ms into its collapse after the release, the Undo snackbar rising. */
    @Test fun inboxQuietCollapseMid() = scene("inbox-quiet-mid", captureAtMs = SWIPE_END_MS + 140) { swipe(it) }

    /** Late in the collapse: the row's slice of the card, a thin strip, still carries the card's top edge. */
    @Test fun inboxQuietCollapseLate() = scene("inbox-quiet-late", captureAtMs = SWIPE_END_MS + 300) { swipe(it) }

    /** After the collapse: the card has closed over the row; the snackbar offers Undo. */
    @Test fun inboxQuietDone() = scene("inbox-quiet-done", captureAtMs = SWIPE_END_MS + 900) { swipe(it) }

    /** Undo: the row coming back, 160 ms after the tap. */
    @Test fun inboxUndoMid() = scene("inbox-undo-mid", captureAtMs = UNDO_AT_MS + 160) {
        swipe(it)
        tap(it, UNDO_X_DP, UNDO_Y_DP, UNDO_AT_MS)
    }

    /** Undo, settled: the row is back in its place, at rest. */
    @Test fun inboxUndoDone() = scene("inbox-undo-done", captureAtMs = UNDO_AT_MS + 1_000) {
        swipe(it)
        tap(it, UNDO_X_DP, UNDO_Y_DP, UNDO_AT_MS)
    }

    // ---- Screens with the fixtures

    @Composable
    private fun Macro(
        range: Int = 30,
        current: SentimentSnapshotView? = MacroInboxFixtures.macroCurrent,
        history: List<SentimentSnapshotView> = MacroInboxFixtures.macroHistory,
        error: String? = null,
        refreshing: Boolean = false,
    ) = Fixed {
        MacroStressScreen(
            current = current,
            history = history,
            selectedRangeDays = range,
            sentimentError = error,
            onSelectRange = {},
            onBack = {},
            refreshing = refreshing,
            onRefresh = {},
        )
    }

    @Composable
    private fun Inbox(
        alerts: List<AlertLedgerItemView> = MacroInboxFixtures.alerts,
        error: String? = null,
        refreshError: String? = null,
        loading: Boolean = false,
        expanded: String? = null,
        category: String? = null,
    ) = Fixed {
        InboxScreen(
            padding = PaddingValues(),
            alerts = alerts,
            inboxError = error,
            onRefresh = {},
            onOpenAlert = {},
            onUnlockDetail = {},
            onSubmitFeedback = { _, _ -> },
            onQuietAlertType = {},
            onDisableAlertType = {},
            isLoading = loading,
            lastInboxVisitAtMs = MacroInboxFixtures.lastVisitAtMs,
            onMarkAllSeen = {},
            onOpenName = {},
            onOpenWarRoom = {},
            initialCategory = category,
            initialExpandedId = expanded,
            refreshError = refreshError,
            clock = MacroInboxFixtures.clock,
        )
    }

    @Composable
    private fun Fixed(content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalFmt provides MacroInboxFixtures.fmt, content = content)
    }

    private fun render(
        name: String,
        widthDp: Int = PhoneSpec.WIDTH_DP,
        heightDp: Int = PhoneSpec.HEIGHT_DP,
        fontScale: Float = 1f,
        reducedMotion: Boolean = false,
        glow: Boolean = true,
        settleMs: Long = 2_000,
        frameMs: Long = 100,
        themes: List<PreviewTheme> = PreviewTheme.entries,
        content: @Composable () -> Unit,
    ) {
        val files = renderScreen(
            name,
            widthDp = widthDp,
            heightDp = heightDp,
            fontScale = fontScale,
            reducedMotion = reducedMotion,
            glow = glow,
            settleMs = settleMs,
            frameMs = frameMs,
            themes = themes,
            content = content,
        )
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    /** A pointer event at [atMs] on the scene, in dp. */
    private class Touch(val atMs: Long, val type: PointerEventType, val xDp: Float, val yDp: Float)

    private fun tap(events: MutableList<Touch>, xDp: Float, yDp: Float, atMs: Long) {
        events += Touch(atMs, PointerEventType.Press, xDp, yDp)
        events += Touch(atMs + FRAME_MS, PointerEventType.Release, xDp, yDp)
    }

    /** A finger pressed on the chart, dragged past the touch slop to the middle of the window, and held. */
    private fun scrub(events: MutableList<Touch>) {
        events += Touch(SCRUB_AT_MS, PointerEventType.Press, SCRUB_FROM_X_DP, CHART_Y_DP)
        val steps = 8
        for (i in 1..steps) {
            val x = SCRUB_FROM_X_DP + (SCRUB_TO_X_DP - SCRUB_FROM_X_DP) * i / steps
            events += Touch(SCRUB_AT_MS + i * FRAME_MS, PointerEventType.Move, x, CHART_Y_DP)
        }
    }

    /** A finger swipe toward the start across the first row, released past the threshold. */
    private fun swipe(events: MutableList<Touch>) {
        val steps = ((SWIPE_END_MS - SWIPE_AT_MS) / FRAME_MS).toInt()
        events += Touch(SWIPE_AT_MS, PointerEventType.Press, SWIPE_FROM_X_DP, FIRST_ROW_Y_DP)
        for (i in 1..steps) {
            val x = SWIPE_FROM_X_DP + (SWIPE_TO_X_DP - SWIPE_FROM_X_DP) * i / steps
            events += Touch(SWIPE_AT_MS + i * FRAME_MS, PointerEventType.Move, x, FIRST_ROW_Y_DP)
        }
        events += Touch(SWIPE_END_MS + FRAME_MS, PointerEventType.Release, SWIPE_TO_X_DP, FIRST_ROW_Y_DP)
    }

    /**
     * A screen ([content], the Inbox by default) in an [ImageComposeScene] on virtual time, driven by real touch
     * events ([script]) and captured at [captureAtMs]: the frames between a gesture and its result, which a settled
     * render cannot show.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    private fun scene(
        name: String,
        captureAtMs: Long,
        themes: List<PreviewTheme> = listOf(PreviewTheme.DARK),
        content: @Composable () -> Unit = { Inbox() },
        script: (MutableList<Touch>) -> Unit,
    ) {
        if (!selected(name)) return
        val events = mutableListOf<Touch>().also(script).sortedBy { it.atMs }.toMutableList()
        val density = PhoneSpec.density
        themes.forEach { theme ->
            withPreviewProperties("preview.reducedMotion" to "false", "preview.glow" to "true") {
                val scheduler = TestCoroutineScheduler()
                val scene = ImageComposeScene(
                    width = (PhoneSpec.WIDTH_DP * density).roundToInt(),
                    height = (PhoneSpec.HEIGHT_DP * density).roundToInt(),
                    density = Density(density, 1f),
                    coroutineContext = StandardTestDispatcher(scheduler),
                ) {
                    ThesisTheme(mode = theme.mode) {
                        val cache = remember { PageBackgroundCache() }
                        CompositionLocalProvider(LocalPageBackgroundCache provides cache) {
                            Box(
                                Modifier.fillMaxSize()
                                    .onSizeChanged { cache.areaSize = it }
                                    .pageBackground(LocalThesisPalette.current),
                            ) { content() }
                        }
                    }
                }
                try {
                    var now = 0L
                    scene.render(0).close()
                    scheduler.runCurrent()
                    while (now < captureAtMs) {
                        now += FRAME_MS
                        while (events.isNotEmpty() && events.first().atMs <= now) {
                            val e = events.removeAt(0)
                            scene.sendPointerEvent(
                                eventType = e.type,
                                position = Offset(e.xDp * density, e.yDp * density),
                                timeMillis = e.atMs,
                                type = PointerType.Touch,
                            )
                        }
                        scheduler.advanceTimeBy(FRAME_MS)
                        scheduler.runCurrent()
                        scene.render(now * 1_000_000).close()
                    }
                    val image = scene.render(now * 1_000_000 + 1)
                    val png = try {
                        image.encodeToData(EncodedImageFormat.PNG)!!.bytes
                    } finally {
                        image.close()
                    }
                    val file = File(screensOutDir, "$name-${theme.suffix}.png").apply { writeBytes(png) }
                    assertTrue(file.length() > 0)
                    println("rendered ${file.absolutePath}")
                } finally {
                    scene.close()
                }
            }
        }
    }

    private fun selected(name: String): Boolean =
        System.getProperty("screens.only")?.takeIf { it.isNotBlank() }?.let { Regex(it).containsMatchIn(name) } ?: true

    private companion object {
        const val MOVE_AT_MS = 2_000L
        const val FRAME_MS = 16L

        // The first row (NVDA) at 412 dp wide with no shell padding, and the snackbar's action.
        const val ROW_X_DP = 200f
        const val FIRST_ROW_Y_DP = 300f
        const val TAP_AT_MS = 800L
        const val SWIPE_AT_MS = 800L
        const val SWIPE_END_MS = 1_000L
        const val SWIPE_FROM_X_DP = 380f
        const val SWIPE_TO_X_DP = 60f
        const val UNDO_AT_MS = 2_400L
        const val UNDO_X_DP = 360f
        const val UNDO_Y_DP = 870f

        // Macro Stress: the chart's plot at 412 dp wide, from its right part to the middle of the window.
        const val SCRUB_AT_MS = 2_000L
        const val CHART_Y_DP = 640f
        const val SCRUB_FROM_X_DP = 300f
        const val SCRUB_TO_X_DP = 200f
    }
}
