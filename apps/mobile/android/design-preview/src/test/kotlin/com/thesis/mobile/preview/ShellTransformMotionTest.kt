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
        // Half way: the page on top is still whole (it only slides off, over 180 ms, once the back commits); the
        // page under is composed beneath it, coming in.
        assertEquals(peek!!.entryId, seek.transitionState.targetState.entryId)
        assertEquals(onTop.argb(), centre().argb())

        rule.runOnIdle { seek.update(1f) }
        rule.mainClock.advanceTimeBy(64)
        assertEquals("a gesture held to the end never takes the page on top off", onTop.argb(), centre().argb())
        assertEquals("it only seeks the page under's part of the pop", 0.4f, seek.transitionState.fraction, 0.01f)

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
        // 60 ms into the 300 ms pop (the gesture's half of its first 120 ms) plus two frames: the page on top has not
        // started to leave, so nothing jumped back to the start or on to the end.
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

    @Test
    fun aGestureSeeksOnlyFromALayerAtRest() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek)
        rule.mainClock.advanceTimeBy(500)
        rule.runOnIdle { navigator.push(Destination.History()) }
        step(64)
        assertTrue("the push is still running", !seek.atRestOn(navigator.tabTop))
        step(600)
        assertTrue(seek.atRestOn(navigator.tabTop))
    }

    @Test
    fun aHeldGestureSeeksTheShrinkOfATransformedPageOnlyPartWayAndItStaysReadable() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Names) }
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setTabLayer(navigator, seek, withMarker = true)
        rule.mainClock.advanceTimeBy(500)
        rule.runOnIdle {
            navigator.pushFrom(Rect(0f, 160f, 360f, 240f)) { navigator.push(Destination.Name("AAPL")) }
        }
        step(900)
        val rest = markerBounds(pixels())!!
        val peek = navigator.backSeekTarget(reducedMotion = false)!!
        rule.runOnIdle { seek.begin(peek, intoRow = true) }
        listOf(0.25f, 0.5f, 1f).forEach { p ->
            rule.runOnIdle { seek.update(p) }
            step(48)
            val frame = pixels()
            val marker = markerBounds(frame)
            assertNotNull("at $p the page's content still shows", marker)
            val c = frame[marker!!.center.x.toInt(), marker.center.y.toInt()]
            // White content over the container: its red channel is about the content's alpha.
            val minAlpha = if (p <= 0.5f) 0.6f else 0.45f
            assertTrue("at $p the content is readable (marker $c)", c.red > minAlpha)
            var page = 0
            var all = 0
            for (y in 0 until frame.height step 4) for (x in 0 until frame.width step 4) {
                val px = frame[x, y]
                if (px.blue > px.red || px.green > 0.45f) page++
                all++
            }
            if (p <= 0.5f) assertTrue("at $p the page still covers most of the layer (${page * 100 / all}%)", page * 2 > all)
            assertTrue("the marker shrinks toward the row, never past the preview cap", marker.width > rest.width * 0.5f)
        }
        // A cancel brings the page back whole.
        rule.runOnIdle { seek.end(committed = false) }
        step(900)
        assertEquals(rest, markerBounds(pixels()))
    }

    // ---- Interruptions (a new move before the last one ends)

    private val tabColours = mapOf(
        ShellTab.Today to Color(0xFFFF0000),
        ShellTab.Names to Color(0xFF00FF00),
        ShellTab.Research to Color(0xFF0000FF),
    )

    private fun setColouredTabs(navigator: AppNavigator, seek: TabSeek) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, false, BackPreview()) }
                TabLayer(
                    target = navigator.tabTop,
                    move = { navigator.lastMove },
                    env = env,
                    drawnBelow = { false },
                    modifier = Modifier.background(Color.Black),
                    seek = seek,
                ) { entry ->
                    val colour = when (entry.destination) {
                        is Destination.History -> Color(0xFFFFFFFF)
                        Destination.Today -> tabColours.getValue(ShellTab.Today)
                        Destination.Names -> tabColours.getValue(ShellTab.Names)
                        else -> tabColours.getValue(ShellTab.Research)
                    }
                    Box(Modifier.fillMaxSize().background(colour))
                }
            }
        }
    }

    @Test
    fun twoQuickTabTapsNeverFlashTheTabInBetween() {
        val navigator = AppNavigator()
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setColouredTabs(navigator, seek)
        step(500)
        rule.runOnIdle { navigator.selectTab(ShellTab.Names) }
        step(96)
        rule.runOnIdle { navigator.selectTab(ShellTab.Research) }
        val greens = mutableListOf<Float>()
        repeat(40) {
            step(16)
            greens += centre().green
        }
        assertTrue("the tab tapped past never shows in full (green per frame: $greens)", greens.all { it < 0.9f })
        assertEquals("the second tap lands", tabColours.getValue(ShellTab.Research).argb(), centre().argb())
        assertTrue(seek.atRestOn(navigator.tabTop))
    }

    @Test
    fun aBackRightAfterAPushReversesItSmoothly() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        val seek = TabSeek(navigator.tabTop)
        rule.mainClock.autoAdvance = false
        setColouredTabs(navigator, seek)
        step(500)
        rule.runOnIdle { navigator.push(Destination.History()) }
        step(112)
        val atBack = centre().red // History is white: its red channel is its share
        rule.runOnIdle { navigator.back() }
        val reds = mutableListOf<Float>()
        repeat(30) {
            step(16)
            reds += centre().red
        }
        assertTrue("History never jumps to full after the back (red per frame from $atBack: $reds)", reds.all { it < 0.9f })
        assertTrue("it never grows again after the back: $reds", reds.zipWithNext().all { (a, b) -> b <= a + 0.02f })
        assertTrue("it leaves within 120 ms: $reds", reds[7] < 0.05f)
        assertEquals(tabColours.getValue(ShellTab.Research).argb(), centre().argb())
        assertTrue(seek.atRestOn(navigator.tabTop))
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

    private fun setReportOverList(navigator: AppNavigator, mode: ThemeMode) {
        rule.setContent {
            ThesisTheme(mode = mode) {
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
    }

    @Test
    fun aReportOpenedFromARowGrowsOverTheListAndShrinksBackIntoIt() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        rule.mainClock.autoAdvance = false
        setReportOverList(navigator, ThemeMode.Dark)
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
        // The report's container (its page background), in the base layer, is drawn over the list where it grows;
        // its content (the WebView on a device) waits at alpha 0 until the bounds have settled.
        assertTrue("the report's container covers the list where it grows ($nearMid)", nearMid.red < 0.3f)
        assertTrue("the report's content is not drawn in the overlay ($nearMid)", nearMid.green < 0.3f)
        assertTrue("the list still shows outside the growing report ($farMid)", farMid.red > farMid.green)
        val greens = (0 until 16).map { step(16); far().green }
        assertTrue("then the content fades in, in place: $greens", greens.any { it > 0.05f && it < 0.95f })
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

    @Test
    fun aReportGrowsAndShrinksAsItsOwnNavyCoverNeverAsABlankPage() {
        // 2.7, 4.5: in the light theme a report's container is not cream then navy: under the top bar's `bg`
        // it carries the report's hero, so the navy arrives with the bounds; the content (a WebView on a device)
        // is not drawn while the bounds grow and fades in over the cover once they settle. On the way back it fades
        // out over the shrink's first `ReportContentOut` (75 ms), over the cover, instead of leaving in one frame.
        val navigator = AppNavigator().apply { selectTab(ShellTab.Research) }
        rule.mainClock.autoAdvance = false
        setReportOverList(navigator, ThemeMode.Light)
        rule.mainClock.advanceTimeBy(500)
        val dp = rule.density.density
        val inHero = { pixels().let { it[it.width / 2, ((56 + 160) * dp).toInt()] } }
        val inTopBar = { pixels().let { it[it.width / 2, (20 * dp).toInt()] } }
        fun Color.luma() = 0.2126f * red + 0.7152f * green + 0.0722f * blue
        fun Color.isReport() = green > 0.8f && red < 0.2f && blue < 0.2f

        rule.runOnIdle {
            navigator.pushFrom(Rect(0f, 0f, 240f, 96f)) { navigator.push(Destination.Report("rep-AAPL", "AAPL")) }
        }
        step(208)
        val hero = inHero()
        assertTrue("the navy hero grows with the bounds ($hero)", hero.luma() < 0.3f && !hero.isReport())
        assertTrue("the top bar's band is the page's light bg (${inTopBar()})", inTopBar().luma() > 0.7f)
        step(ThesisMotion.Screen - 208 + 16)
        assertTrue("settled: still the cover, the content starts at alpha 0 (${inHero()})", inHero().luma() < 0.3f)
        step(600)
        assertEquals("then the content over it", reportColour.argb(), inHero().argb())

        rule.runOnIdle { navigator.pop() }
        val greens = (0 until 6).map { step(16); inHero().green }
        assertTrue("the content fades out, it is not cut: $greens", greens.any { it > 0.15f && it < 0.85f })
        assertTrue("and only ever fades: $greens", greens.zipWithNext().all { (a, b) -> b <= a + 0.01f })
        listOf(128, 176).fold(96) { done, ms ->
            step(ms - done)
            val c = inHero()
            assertTrue("$ms ms into the shrink the content is gone ($c)", c.green < 0.3f)
            ms
        }
        step(600)
        assertEquals(under.argb(), inHero().argb())
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
