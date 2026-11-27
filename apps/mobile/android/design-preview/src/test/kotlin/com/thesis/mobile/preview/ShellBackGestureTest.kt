package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runDesktopComposeUiTest
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Predictive back through the real shell (ThesisShell's handler, not the TabSeek alone; DESIGN-DIRECTION 4.5, 4.8):
 * a gesture held at 50%, then cancelled or committed, over a plain push and over a page opened from a row, and the
 * same under reduced motion. Each ends on a frame equal, pixel for pixel, to the page at rest: a cancel leaves no
 * preview, scale or seek behind, and a commit lands on the page under exactly as it rests.
 */
@OptIn(ExperimentalTestApi::class)
class ShellBackGestureTest {

    private val width = 360
    private val height = 760

    /** The War Rooms the shell asked to load (onEnsureWarRoom), in order. */
    private val ensuredWarRooms = mutableListOf<String>()

    private fun ComposeUiTest.step(ms: Int) {
        repeat((ms + 15) / 16) {
            mainClock.advanceTimeByFrame()
            waitForIdle()
        }
    }

    private fun ComposeUiTest.pixels(): PixelMap = onRoot().captureToImage().toPixelMap()

    /** Sampled pixels that differ between [a] and [b]. */
    private fun diff(a: PixelMap, b: PixelMap): Int {
        var n = 0
        for (y in 0 until a.height step 3) for (x in 0 until a.width step 3) {
            if (a[x, y].toArgb() != b[x, y].toArgb()) n++
        }
        return n
    }

    private fun shell(reducedMotion: Boolean = false, setup: AppNavigator.() -> Unit, script: ComposeUiTest.(AppNavigator) -> Unit) =
        runDesktopComposeUiTest(width = width, height = height) {
            val navigator = AppNavigator().apply(setup)
            val actions = object : ShellActions {
                override fun onBack(): Boolean = navigator.back()
                override fun onSelectTab(tab: ShellTab) {
                    navigator.selectTab(tab)
                }
                override fun onOpenNameIn(ticker: String, pagerScope: String?, anchor: String?) {
                    navigator.push(Destination.Name(ticker, pagerScope, anchor))
                }
                override fun onOpenHistoryItem(item: ReportHistoryItem) {
                    navigator.push(Destination.Report(item.reportId, item.ticker))
                }
                override fun onEnsureWarRoom(warRoomId: String) {
                    ensuredWarRooms += warRoomId
                }
            }
            mainClock.autoAdvance = false
            setContent {
                CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
                    ThesisTheme(mode = ThemeMode.Dark, reduceMotion = reducedMotion) {
                        ProvidePageBackground {
                            Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current)) {
                                ThesisShell(
                                    state = ShellFixtures.state,
                                    navigator = navigator,
                                    actions = actions,
                                    snackbarHostState = remember { SnackbarHostState() },
                                )
                            }
                        }
                    }
                }
            }
            step(1500)
            script(navigator)
        }

    /** Holds a back gesture at 50% (frames in between, as on a device) and returns it, still held. */
    private fun ComposeUiTest.holdAtHalf(): BackGestureDriver {
        val driver = BackGestureDriver()
        runOnIdle {
            driver.start()
            driver.progress(0f)
        }
        step(32)
        runOnIdle { driver.progress(0.25f) }
        step(32)
        runOnIdle { driver.progress(0.5f) }
        step(64)
        return driver
    }

    @Test
    fun aCancelledGestureOverAPushLeavesThePageAtRestAndACommitLandsOnThePageUnder() =
        shell(setup = { selectTab(ShellTab.Research) }) { navigator ->
            val root = pixels()
            runOnIdle { navigator.push(Destination.History()) }
            step(900)
            val history = pixels()
            assertTrue("History is on screen", diff(root, history) > 100)

            val held = holdAtHalf()
            assertTrue("the gesture previews the pop", diff(history, pixels()) > 100)
            runOnIdle { held.cancel() }
            step(1200)
            assertTrue(navigator.tabTop.destination is Destination.History)
            assertEquals("a cancel leaves no preview behind", 0, diff(history, pixels()))

            val again = holdAtHalf()
            runOnIdle { again.commit() }
            step(48)
            assertTrue("the commit runs on (the page is still leaving)", diff(root, pixels()) > 100)
            step(1200)
            assertEquals(Destination.Research, navigator.tabTop.destination)
            assertEquals("the commit lands on the page under, at rest", 0, diff(root, pixels()))
        }

    @Test
    fun aGestureOverAPageOpenedFromARowCancelsBackAndCommitsIntoTheRow() =
        shell(setup = { selectTab(ShellTab.Names) }) { navigator ->
            val names = pixels()
            onAllNodesWithText("AAPL", substring = false).onFirst().performClick()
            step(900)
            assertTrue(navigator.tabTop.destination is Destination.Name)
            assertTrue("opened from its row", navigator.transformOrigin(navigator.tabTop.entryId) != null)
            val name = pixels()

            val held = holdAtHalf()
            val half = pixels()
            assertTrue("the gesture starts the shrink", diff(name, half) > 100)
            runOnIdle { held.cancel() }
            step(1200)
            assertEquals("a cancel grows the page back whole", 0, diff(name, pixels()))

            val again = holdAtHalf()
            runOnIdle { again.commit() }
            step(1200)
            assertEquals(Destination.Names, navigator.tabTop.destination)
            assertEquals("the page shrank into its row: the list as it rests", 0, diff(names, pixels()))
        }

    @Test
    fun aBackOrAPushWhileACancelStillSettlesMovesOnWithoutACut() =
        shell(setup = { selectTab(ShellTab.Research) }) { navigator ->
            val root = pixels()
            runOnIdle { navigator.push(Destination.History()) }
            step(900)
            val history = pixels()

            // A quick second back, 100 ms into the cancel's settle: the pop runs on from where the settle got to.
            val held = holdAtHalf()
            runOnIdle { held.cancel() }
            step(100)
            runOnIdle { navigator.back() }
            step(32)
            assertTrue("the pop is still running, not cut to the page under", diff(root, pixels()) > 100)
            step(1200)
            assertEquals(Destination.Research, navigator.tabTop.destination)
            assertEquals("and lands on it at rest", 0, diff(root, pixels()))

            // A push, 100 ms into the cancel's settle: the settle rewinds (at most 90 ms), then the push runs.
            runOnIdle { navigator.push(Destination.History()) }
            step(900)
            assertEquals(0, diff(history, pixels()))
            val again = holdAtHalf()
            runOnIdle { again.cancel() }
            step(100)
            runOnIdle { navigator.push(Destination.CompareNames(listOf("AAPL", "MSFT"))) }
            step(32)
            val early = pixels()
            step(1200)
            assertTrue(navigator.tabTop.destination is Destination.CompareNames)
            val pushed = pixels()
            assertTrue("32 ms in, the push has not landed in one frame", diff(pushed, early) > 100)
        }

    @Test
    fun thePageUnderAHeldGestureLoadsNothingUntilItIsOnTop() =
        shell(setup = { selectTab(ShellTab.Research) }) { navigator ->
            runOnIdle { navigator.push(Destination.WarRoom("w1")) }
            step(900)
            runOnIdle { navigator.push(Destination.History()) }
            step(900)
            val before = ensuredWarRooms.toList()
            // Held and cancelled: the War Room under is composed for the preview but asks for nothing.
            val held = holdAtHalf()
            runOnIdle { held.cancel() }
            step(1200)
            assertEquals("a cancelled gesture loads nothing under it", before, ensuredWarRooms)
            // Committed: the War Room is on top again and ensures its room, as before PR-4b.
            val again = holdAtHalf()
            runOnIdle { again.commit() }
            step(1200)
            assertTrue(navigator.tabTop.destination is Destination.WarRoom)
            assertEquals(before + "w1", ensuredWarRooms)
        }

    @Test
    fun underReducedMotionAGestureNeitherSeeksNorPreviewsAndTheCommitCrossfades() =
        shell(reducedMotion = true, setup = { selectTab(ShellTab.Names) }) { navigator ->
            val names = pixels()
            onAllNodesWithText("AAPL", substring = false).onFirst().performClick()
            step(48)
            val opening = pixels()
            // A crossfade of whole pages, no transform from the row: the row's area and the far corner are both mixed.
            assertTrue("the page opens with a crossfade", diff(names, opening) > 100)
            step(900)
            val name = pixels()

            val held = holdAtHalf()
            assertEquals("no seek and no preview under reduced motion (4.8)", 0, diff(name, pixels()))
            runOnIdle { held.commit() }
            step(64)
            val mid = pixels()
            assertTrue("the commit crossfades", diff(name, mid) > 100 && diff(names, mid) > 100)
            step(900)
            assertEquals(Destination.Names, navigator.tabTop.destination)
            assertEquals(0, diff(names, pixels()))
        }
}
