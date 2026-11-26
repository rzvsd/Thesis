package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisPullRefresh
import com.thesis.mobile.ui.motion.thesisItemMotion
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.BackGesture
import com.thesis.mobile.ui.shell.BackPreview
import com.thesis.mobile.ui.shell.NavEntry
import com.thesis.mobile.ui.shell.ReportBaseLayer
import com.thesis.mobile.ui.shell.ShellLayerEnv
import com.thesis.mobile.ui.shell.ShellMotionPx
import com.thesis.mobile.ui.shell.ShellTransformScope
import com.thesis.mobile.ui.shell.TabLayer
import com.thesis.mobile.ui.shell.TabSeek
import com.thesis.mobile.ui.shell.backSeekTarget
import com.thesis.mobile.ui.shell.rememberShownReport
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * PR-4b motion on Compose 1.7 (DESIGN-DIRECTION 4.4, 4.5, 4.8), with exact pixels: the shell's own layers over
 * flat coloured pages, so each assertion reads one colour.
 *
 * - Seekable predictive back: a gesture scrubs the tab layer's pop; a cancel goes back to the page on top and
 *   rests there; a commit runs on from where the finger left it (no jump) to the page under.
 * - Container transform (shared bounds): no jump at the end (the frame after the move is pixel for pixel the page
 *   at rest), a uniform scale (a square stays square, so text is never stretched), and a report opened from a row
 *   grows over the tab layer's list although it lives in the base layer.
 * - Reduced motion: no seek, no transform.
 * - `animateItem` fades: an item that joins a list fades in while its neighbours glide; first paint never fades;
 *   reduced motion fades but never glides.
 * - Pull to refresh on Material3 1.3: the content follows the pull, a release past 72 dp refreshes once, the gap
 *   rests at 16 dp while refreshing and closes after.
 */
class ShellTransformMotionTest {

    @get:Rule
    val rule = createComposeRule()

    private val onTop = Color(0xFF0000FF)
    private val under = Color(0xFFFF0000)
    private val reportColour = Color(0xFF00FF00)
    private val marker = Color(0xFFFFFFFF)

    private fun pixels(): PixelMap = rule.onRoot().captureToImage().toPixelMap()

    private fun centre(): Color = pixels().let { it[it.width / 2, it.height / 2] }

    private fun Color.argb() = toArgb()

    /**
     * Runs [ms] of frames one at a time, letting effects run between them (the tab layer follows the navigator
     * from a LaunchedEffect, as on a device, where each frame runs its effects).
     */
    private fun step(ms: Int) {
        repeat((ms + 15) / 16) {
            rule.mainClock.advanceTimeByFrame()
            rule.waitForIdle()
        }
    }

    /** The tab layer alone over [navigator], driven by [seek]; History is blue, any other page red. */
    private fun setTabLayer(navigator: AppNavigator, seek: TabSeek, reducedMotion: Boolean = false, withMarker: Boolean = false) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, reducedMotion, BackPreview()) }
                TabLayer(
                    target = navigator.tabTop,
                    move = { navigator.lastMove },
                    env = env,
                    drawnBelow = { false },
                    originOf = { navigator.transformOrigin(it.entryId) },
                    seek = seek,
                ) { entry ->
                    val pushed = entry.destination is Destination.History || entry.destination is Destination.Name
                    Box(Modifier.fillMaxSize().background(if (pushed) onTop else under)) {
                        if (pushed && withMarker) Box(Modifier.offset(100.dp, 300.dp).size(60.dp).background(marker))
                    }
                }
            }
        }
    }

    private fun researchWithHistory() = AppNavigator().apply {
        selectTab(ShellTab.Research)
        push(Destination.History())
    }

    // ---- Seekable predictive back

    @Test
    fun aBackGestureScrubsThePopAndACancelSettlesBackOnThePageOnTop() {
        val navigator = researchWithHistory()
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek)
        rule.mainClock.advanceTimeBy(500)
        assertEquals(onTop.argb(), centre().argb())

        val peek = navigator.backSeekTarget(reducedMotion = false)
        assertNotNull("a plain pop inside the tab seeks", peek)
        rule.runOnIdle {
            seek.begin(peek!!)
            seek.update(0.5f)
        }
        rule.mainClock.advanceTimeBy(64)
        // Half way: the page on top is still whole (it leaves over the last 90 ms only); the page under is composed
        // beneath it, coming in.
        assertEquals(peek!!.entryId, seek.transitionState.targetState.entryId)
        assertEquals(onTop.argb(), centre().argb())

        rule.runOnIdle { seek.update(0.95f) }
        rule.mainClock.advanceTimeBy(64)
        val late = centre()
        assertTrue("near the end of the gesture the page under shows through ($late)", late.red > late.blue)

        rule.runOnIdle { seek.end(committed = false) }
        rule.mainClock.advanceTimeByFrame()
        assertTrue(seek.gesture is BackGesture.Cancelling)
        rule.mainClock.advanceTimeBy(900)
        assertNull("the cancel is over", seek.gesture)
        assertEquals("back on the page on top, at rest", onTop.argb(), centre().argb())
        assertEquals(navigator.tabTop.entryId, seek.transitionState.currentState.entryId)
        assertEquals(navigator.tabTop.entryId, seek.transitionState.targetState.entryId)
    }

    @Test
    fun aCommittedBackGestureRunsOnFromWhereTheFingerLeftIt() {
        val navigator = researchWithHistory()
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek)
        rule.mainClock.advanceTimeBy(500)
        val peek = navigator.backSeekTarget(reducedMotion = false)!!
        rule.runOnIdle {
            seek.begin(peek)
            seek.update(0.5f)
        }
        rule.mainClock.advanceTimeBy(64)
        assertEquals(onTop.argb(), centre().argb())

        rule.runOnIdle {
            navigator.pop()
            seek.end(committed = true)
        }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        // 150 ms into the 300 ms pop plus two frames: the page on top has not started to leave, so nothing jumped
        // back to the start or on to the end.
        assertEquals("the commit continues from the gesture's position", onTop.argb(), centre().argb())
        rule.mainClock.advanceTimeBy(500)
        assertNull(seek.gesture)
        assertEquals("the page under, at rest", under.argb(), centre().argb())
        assertEquals(navigator.tabTop.entryId, seek.transitionState.currentState.entryId)
    }

    @Test
    fun onlyAPlainPopInsideTheTabSeeks() {
        val plain = researchWithHistory()
        assertNotNull(plain.backSeekTarget(reducedMotion = false))
        assertNull("reduced motion (4.8): no seek", plain.backSeekTarget(reducedMotion = true))
        assertNull("a tab root does not seek", AppNavigator().backSeekTarget(reducedMotion = false))
        plain.openModal(Destination.You)
        assertNull("back closes the modal", plain.backSeekTarget(reducedMotion = false))
        val reportOnTop = AppNavigator().apply {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
        }
        assertNull("a report is drawn by the base layer", reportOnTop.backSeekTarget(reducedMotion = false))
        reportOnTop.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025"))
        assertNull("nor is a report under the page", reportOnTop.backSeekTarget(reducedMotion = false))
    }

    // ---- Container transform

    /** The bounds of the marker square (near-white pixels) in [p], or null when none shows. */
    private fun markerBounds(p: PixelMap): Rect? {
        var l = Int.MAX_VALUE
        var t = Int.MAX_VALUE
        var r = -1
        var b = -1
        for (y in 0 until p.height) for (x in 0 until p.width) {
            val c = p[x, y]
            if (c.green > 0.45f && c.red > 0.45f && c.blue > 0.45f) {
                if (x < l) l = x
                if (y < t) t = y
                if (x > r) r = x
                if (y > b) b = y
            }
        }
        return if (r < 0) null else Rect(l.toFloat(), t.toFloat(), r + 1f, b + 1f)
    }

    @Test
    fun aTransformScalesUniformlyAndEndsOnTheRestingPageWithoutAJump() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Names) }
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek, withMarker = true)
        rule.mainClock.advanceTimeBy(500)
        rule.runOnIdle {
            navigator.pushFrom(Rect(0f, 160f, 360f, 240f)) { navigator.push(Destination.Name("AAPL")) }
        }
        step(150)
        val mid = markerBounds(pixels())
        assertNotNull("the page's content shows half way", mid)
        val ratio = mid!!.width / mid.height
        assertTrue("the page scales uniformly (marker ${mid.width} x ${mid.height}): text is never stretched", abs(ratio - 1f) < 0.06f)

        step(ThesisMotion.Screen)
        val justAfter = pixels()
        step(600)
        val rest = pixels()
        assertEquals("the move ends where the page rests", markerBounds(rest), markerBounds(justAfter))
        var diff = 0
        for (y in 0 until rest.height step 3) for (x in 0 until rest.width step 3) {
            if (rest[x, y].argb() != justAfter[x, y].argb()) diff++
        }
        assertEquals("no frame jumps after the transform ends", 0, diff)
        assertEquals(onTop.argb(), rest[rest.width - 2, rest.height - 2].argb())
    }

    @Test
    fun reducedMotionOpensARowsPageWithoutATransform() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Names) }
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek, reducedMotion = true)
        rule.mainClock.advanceTimeBy(500)
        rule.runOnIdle {
            navigator.pushFrom(Rect(0f, 0f, 200f, 96f)) { navigator.push(Destination.Name("AAPL")) }
        }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeBy(60)
        val p = pixels()
        // A crossfade of whole pages: the row's corner and the far corner are the same mix (nothing grows from the row).
        assertEquals(p[20, 20].argb(), p[p.width - 2, p.height - 2].argb())
        rule.mainClock.advanceTimeBy(400)
        assertEquals(onTop.argb(), centre().argb())
    }

    @Test
    fun aReportOpenedFromARowGrowsOverTheListAndShrinksBackIntoIt() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        rule.mainClock.autoAdvance = false
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, false, BackPreview()) }
                val seek = remember { TabSeek(navigator.tabTop) }
                val origin: (NavEntry) -> Rect? = { navigator.transformOrigin(it.entryId) }
                ShellTransformScope(Modifier.fillMaxSize()) {
                    ReportBaseLayer(
                        entry = rememberShownReport(navigator, seek.shown),
                        tabTopId = seek.shown.entryId,
                        move = { navigator.lastMove },
                        env = env,
                        originOf = origin,
                    ) { Box(Modifier.fillMaxSize().background(reportColour)) }
                    TabLayer(
                        target = navigator.tabTop,
                        move = { navigator.lastMove },
                        env = env,
                        drawnBelow = { it.destination is Destination.Report },
                        originOf = origin,
                        seek = seek,
                    ) { Box(Modifier.fillMaxSize().background(under)) }
                }
            }
        }
        rule.mainClock.advanceTimeBy(500)
        val near = { pixels()[20, 20] }
        val far = { pixels().let { it[it.width - 2, it.height - 2] } }
        assertEquals(under.argb(), far().argb())

        rule.runOnIdle {
            navigator.pushFrom(Rect(0f, 0f, 240f, 96f)) { navigator.push(Destination.Report("rep-AAPL", "AAPL")) }
        }
        step(180)
        val nearMid = near()
        val farMid = far()
        assertTrue("the report, in the base layer, is drawn over the list where it grows ($nearMid)", nearMid.green > nearMid.red)
        assertTrue("the list still shows outside the growing report ($farMid)", farMid.red > farMid.green)
        step(600)
        assertEquals("at rest the report covers the layer", reportColour.argb(), far().argb())

        rule.runOnIdle { navigator.pop() }
        step(140)
        val farOut = far()
        val nearOut = near()
        assertTrue("the report shrinks toward its row: the far corner is the list again ($farOut)", farOut.red > farOut.green)
        assertNotEquals("the row's corner is still the report's", under.argb(), nearOut.argb())
        step(600)
        assertEquals(under.argb(), far().argb())
        assertEquals(under.argb(), near().argb())
    }

    // ---- animateItem fades

    private val colours = mapOf("a" to Color(0xFFFF0000), "b" to Color(0xFF00FF00), "c" to Color(0xFF0000FF), "d" to Color(0xFFFFFF00))

    private fun setList(items: List<String>, reducedMotion: Boolean) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark, reduceMotion = reducedMotion) {
                LazyColumn(Modifier.fillMaxSize().background(Color.Black)) {
                    items(items, key = { it }) { key ->
                        Box(thesisItemMotion().fillMaxWidth().height(100.dp).background(colours.getValue(key)))
                    }
                }
            }
        }
    }

    private fun at(yDp: Int): Int = pixels()[10, (yDp * rule.density.density).toInt()].argb()

    @Test
    fun anItemThatJoinsAListFadesInWhileItsNeighboursGlide() {
        val items = mutableStateListOf("b", "c")
        rule.mainClock.autoAdvance = false
        setList(items, reducedMotion = false)
        rule.mainClock.advanceTimeByFrame()
        assertEquals("first paint never fades", colours.getValue("b").argb(), at(50))

        rule.runOnIdle { items.add("d") }
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals("the new item starts transparent", colours.getValue("d").argb(), at(250))
        rule.mainClock.advanceTimeBy(500)
        assertEquals(colours.getValue("d").argb(), at(250))

        rule.runOnIdle { items.add(0, "a") }
        rule.mainClock.advanceTimeByFrame()
        assertEquals("c glides from its old place", colours.getValue("c").argb(), at(150))
        rule.mainClock.advanceTimeBy(800)
        assertEquals(colours.getValue("a").argb(), at(50))
        assertEquals(colours.getValue("b").argb(), at(150))
    }

    @Test
    fun underReducedMotionItemsFadeButNeverGlide() {
        val items = mutableStateListOf("b", "c")
        rule.mainClock.autoAdvance = false
        setList(items, reducedMotion = true)
        rule.mainClock.advanceTimeByFrame()
        rule.runOnIdle { items.add(0, "a") }
        rule.mainClock.advanceTimeByFrame()
        assertEquals("b takes its new place at once", colours.getValue("b").argb(), at(150))
        assertNotEquals("a fades in", colours.getValue("a").argb(), at(50))
        rule.mainClock.advanceTimeBy(400)
        assertEquals(colours.getValue("a").argb(), at(50))
    }

    // ---- Pull to refresh (Material3 1.3)

    @Test
    fun aPullPastTheThresholdRefreshesOnceAndTheGapRestsThenCloses() {
        var refreshing by mutableStateOf(false)
        var refreshed = 0
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                ThesisPullRefresh(refreshing = refreshing, onRefresh = { refreshed++ }, modifier = Modifier.fillMaxSize().testTag("box")) {
                    LazyColumn(Modifier.fillMaxSize()) { items(30) { Text("Row $it", Modifier.height(48.dp)) } }
                }
            }
        }
        val restTop = rule.onNodeWithText("Row 0").getBoundsInRoot().top
        val gap = { rule.onNodeWithText("Row 0").getBoundsInRoot().top - restTop }

        rule.onNodeWithTag("box").performTouchInput {
            down(Offset(centerX, 40f))
            repeat(30) { moveBy(Offset(0f, 20f)) }
        }
        rule.waitForIdle()
        val pulled = gap()
        assertTrue("the content follows the pull ($pulled)", pulled > ThesisMotion.RefreshTravel * 0.9f)
        assertTrue("capped just past the arming point ($pulled)", pulled <= ThesisMotion.RefreshTravel * ThesisMotion.RefreshOverPull + 1.dp)
        assertEquals(0, refreshed)

        rule.onNodeWithTag("box").performTouchInput { up() }
        rule.waitForIdle()
        assertEquals("a release past 72 dp refreshes once", 1, refreshed)

        refreshing = true
        rule.waitForIdle()
        assertEquals("the gap rests at 16 dp while refreshing", ThesisMotion.RefreshRest.value, gap().value, 1f)

        refreshing = false
        rule.waitForIdle()
        assertEquals("then it closes", 0f, gap().value, 1f)
        assertEquals(1, refreshed)
    }
}
