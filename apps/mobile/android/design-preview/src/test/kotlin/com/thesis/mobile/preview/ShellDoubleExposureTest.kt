package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.BackPreview
import com.thesis.mobile.ui.shell.ModalLayer
import com.thesis.mobile.ui.shell.NavEntry
import com.thesis.mobile.ui.shell.ReportBaseLayer
import com.thesis.mobile.ui.shell.ShellLayerEnv
import com.thesis.mobile.ui.shell.ShellMotionPx
import com.thesis.mobile.ui.shell.TabLayer
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * 4.5 "Screens are opaque, so nothing double-exposes", checked on pixels, with no hard cut either: the shell's own
 * layers (report base, tab, modal) over pages that are each one solid colour, stepped frame by frame through every
 * move. In no frame may two pages' colours both show (the text of two screens would overlap), and the leaving page
 * must still show in the first frames after the move (its exit is seen, not cut).
 */
class ShellDoubleExposureTest {

    @get:Rule
    val rule = createComposeRule()

    /** Each page's colour, by destination: one channel each, so a pixel tells which pages show through it. */
    private fun colourOf(entry: NavEntry): Color = when (entry.destination) {
        is Destination.History -> Color.Red
        is Destination.Report -> Color.Red
        is Destination.You -> Color.Green
        is Destination.YouPage -> Color.Red
        else -> Color.Blue
    }

    private fun setLayers(navigator: AppNavigator) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, false, BackPreview()) }
                val report = navigator.stack(navigator.currentTab).lastOrNull { it.destination is Destination.Report }
                val page: @androidx.compose.runtime.Composable (NavEntry) -> Unit = { entry ->
                    // Inset, so the slides never move a page's colour off the sampled points.
                    Box(Modifier.fillMaxSize().padding(40.dp).background(colourOf(entry)))
                }
                // An opaque black floor (the shell's root draws the page background), so a pixel's channels
                // measure how much of each page shows through.
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    ReportBaseLayer(report, navigator.tabTop.entryId, { navigator.lastMove }, env) { page(it) }
                    TabLayer(
                        target = navigator.tabTop,
                        move = { navigator.lastMove },
                        env = env,
                        drawnBelow = { it.destination is Destination.Report }
                    ) { page(it) }
                    ModalLayer(
                        target = navigator.modalStack.lastOrNull(),
                        onStack = { entry -> navigator.modalStack.any { it.entryId == entry.entryId } },
                        env = env
                    ) { page(it) }
                }
            }
        }
        rule.waitForIdle()
    }

    /** The red, green and blue presence (0..1) at the middle of the window. */
    private fun sample(): FloatArray {
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        val c = pixels[pixels.width / 2, pixels.height / 2]
        return floatArrayOf(c.red, c.green, c.blue)
    }

    /**
     * Runs [move] and steps 16 ms frames for 600 ms. [from] and [to] are the channels (0 red, 1 green, 2 blue) of
     * the leaving and arriving pages: never both above 0.2 in one frame; the leaving one still above 0.5 up to
     * [seenUntilMs] (48 ms: its exit is seen; a modal's rise covers the page under it with the 300 ms `EaseEnter`
     * fade, which is past half way at 32 ms, so only its first frame is checked); the arriving one at full
     * strength at the end.
     */
    private fun assertNoDoubleExposure(name: String, from: Int, to: Int, seenUntilMs: Int = 48, move: () -> Unit) {
        rule.mainClock.autoAdvance = false
        rule.runOnIdle(move)
        var elapsed = 0
        val frames = mutableListOf<String>()
        if (System.getenv("SHELL_FRAMES") != null) Runtime.getRuntime().addShutdownHook(Thread { println("== $name\n" + frames.joinToString("\n")) })
        while (elapsed <= 600) {
            rule.mainClock.advanceTimeBy(16)
            elapsed += 16
            val rgb = sample()
            frames += "%d ms: from %.2f, to %.2f".format(elapsed, rgb[from], rgb[to])
            assertTrue("$name double-exposes at $elapsed ms\n${frames.joinToString("\n")}", minOf(rgb[from], rgb[to]) < 0.2f)
            if (elapsed <= seenUntilMs) {
                assertTrue("$name cuts the leaving page at $elapsed ms\n${frames.joinToString("\n")}", rgb[from] > 0.5f)
            }
        }
        assertTrue("$name never arrives\n${frames.joinToString("\n")}", sample()[to] > 0.9f)
        rule.mainClock.autoAdvance = true
    }

    @Test
    fun pushAndPop() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        setLayers(navigator)
        assertNoDoubleExposure("push", from = 2, to = 0) { navigator.push(Destination.History()) }
        assertNoDoubleExposure("pop", from = 0, to = 2) { navigator.pop() }
    }

    @Test
    fun reportBaseLayerMoves() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        setLayers(navigator)
        assertNoDoubleExposure("push a report from a tab root", from = 2, to = 0) {
            navigator.push(Destination.Report("rep-AAPL", "AAPL"))
        }
        assertNoDoubleExposure("push Compare over the report", from = 0, to = 2) {
            navigator.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025"))
        }
        assertNoDoubleExposure("back from Compare to the report", from = 2, to = 0) { navigator.pop() }
        assertNoDoubleExposure("back from the report to the root", from = 0, to = 2) { navigator.pop() }
    }

    @Test
    fun modalRiseFallAndPagesInside() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Names) }
        setLayers(navigator)
        assertNoDoubleExposure("You rises", from = 2, to = 1, seenUntilMs = 16) { navigator.openModal(Destination.You) }
        assertNoDoubleExposure("You → Appearance", from = 1, to = 0) { navigator.push(Destination.YouPage("appearance")) }
        assertNoDoubleExposure("Appearance → You", from = 0, to = 1) { navigator.pop() }
        assertNoDoubleExposure("You falls", from = 1, to = 2) { navigator.pop() }
    }
}
