package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.animations.StaggeredEntrance
import com.thesis.mobile.ui.motion.ContainerTransformHost
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.EntranceRegistry
import com.thesis.mobile.ui.motion.ProvideEntranceScope
import com.thesis.mobile.ui.motion.RollingNumber
import com.thesis.mobile.ui.motion.ScrollSpyState
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisRefreshBox
import com.thesis.mobile.ui.motion.rememberEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberScrollSpy
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Behaviour of the motion kit (docs/app-redesign/DESIGN-DIRECTION.md 4, 6.2 M1) on the virtual frame clock:
 * entrances never replay (also after the screen is disposed and composed again, and for the deprecated
 * StaggeredEntrance wrapper in a lazy list scrolled away and back), RollingNumber is final on first paint,
 * skeleton timing, DismissibleItem, scroll-spy, refresh semantics and the container transform's back.
 */
class MotionBehaviourTest {

    @get:Rule
    val rule = createComposeRule()

    private val red = Color(0xFFFF0000)
    private val white = Color(0xFFFFFFFF)

    /** Applies a state change on the UI thread and lets one frame see it (the clock is manual in these tests). */
    private fun change(block: () -> Unit) {
        rule.runOnIdle(block)
        rule.mainClock.advanceTimeByFrame()
    }

    private fun SemanticsNodeInteraction.centre(): Color {
        val pixels = captureToImage().toPixelMap()
        return pixels[pixels.width / 2, pixels.height / 2]
    }

    private fun theme(reduced: Boolean = false, content: @Composable () -> Unit) = rule.setContent {
        ThesisTheme(mode = ThemeMode.Light, reduceMotion = reduced) {
            Box(Modifier.fillMaxSize().background(white)) { content() }
        }
    }

    @Composable
    private fun Block(key: Any, tag: String) {
        val coordinator = rememberEntranceCoordinator("issue-1")
        Box(Modifier.size(48.dp).testTag(tag).staggeredEntrance(key, coordinator).background(red))
    }

    @Test
    fun entranceRunsOnceAndNeverReplaysAfterDisposalAndRecomposition() {
        val registry = EntranceRegistry()
        var shown by mutableStateOf(true)
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "home-entry") {
                if (shown) Block("header", "block")
            }
        }
        // First open: hidden on its first frame, then it rises in.
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
        rule.mainClock.advanceTimeBy(ThesisMotion.Enter + 2L * 16)
        assertEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())

        // Leave (tab switch: the screen is disposed) and come back several times: complete on the first frame.
        repeat(3) {
            shown = false
            rule.mainClock.advanceTimeBy(500)
            rule.onNodeWithTag("block").assertDoesNotExist()
            shown = true
            rule.mainClock.advanceTimeByFrame()
            assertEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
        }
        assertEquals(1, registry.size)
    }

    @Test
    fun anotherEntryOrIssueStillAnimates() {
        val registry = EntranceRegistry()
        var scope by mutableStateOf("entry-a")
        rule.mainClock.autoAdvance = false
        theme { ProvideEntranceScope(registry, scope) { Block("header", "block") } }
        rule.mainClock.advanceTimeBy(1_000)
        scope = "entry-b"
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
    }

    @Test
    fun reducedMotionAppearsAtOnce() {
        rule.mainClock.autoAdvance = false
        theme(reduced = true) { ProvideEntranceScope(EntranceRegistry(), "home") { Block("header", "block") } }
        rule.mainClock.advanceTimeByFrame()
        assertEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
    }

    @Suppress("DEPRECATION")
    @Test
    fun deprecatedStaggeredEntranceNeverReplaysOnScrollBack() {
        val registry = EntranceRegistry()
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "pulse-entry") {
                LazyColumn(Modifier.fillMaxSize().testTag("list")) {
                    items(40) { i ->
                        StaggeredEntrance(index = i) {
                            Box(Modifier.fillMaxWidth().height(120.dp).testTag("row$i").background(red))
                        }
                    }
                }
            }
        }
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("row0").centre().toArgb())
        rule.mainClock.advanceTimeBy(1_000)
        assertEquals(red.toArgb(), rule.onNodeWithTag("row0").centre().toArgb())

        // Scroll far away (row 0 leaves composition) and back: row 0 is complete on its first frame back, and a
        // row first composed after the window (row 30) appears at once too.
        rule.onNodeWithTag("list").performScrollToIndex(30)
        rule.mainClock.advanceTimeByFrame()
        assertEquals(red.toArgb(), rule.onNodeWithTag("row30").centre().toArgb())
        rule.onNodeWithTag("row0").assertDoesNotExist()
        rule.onNodeWithTag("list").performScrollToIndex(0)
        rule.mainClock.advanceTimeByFrame()
        assertEquals(red.toArgb(), rule.onNodeWithTag("row0").centre().toArgb())
    }

    @Test
    fun rollingNumberIsFinalOnFirstPaintAndAnnouncesTheNewValue() {
        var value by mutableDoubleStateOf(41.0)
        rule.mainClock.autoAdvance = false
        theme { RollingNumber(value, { it.toInt().toString() }, ThesisType.statValue) }
        rule.mainClock.advanceTimeByFrame()
        rule.onNodeWithContentDescription("41").assertExists()
        value = 58.0
        rule.mainClock.advanceTimeByFrame()
        rule.onNodeWithContentDescription("58").assertExists()
        rule.onNodeWithText("58").assertExists()
        rule.mainClock.advanceTimeBy(ThesisMotion.Roll + ThesisMotion.rollDelay(4) + 100L)
        rule.onNodeWithContentDescription("58").assertExists()
    }

    @Test
    fun skeletonWaitsForTheGraceAndStaysForTheMinimum() {
        var loading by mutableStateOf(true)
        var shown = false
        rule.mainClock.autoAdvance = false
        theme { shown = rememberShowSkeleton(loading) }
        rule.mainClock.advanceTimeBy(ThesisMotion.SkeletonGrace - 60)
        assertFalse("no skeleton inside the grace", shown)
        rule.mainClock.advanceTimeBy(120)
        assertTrue("skeleton after the grace", shown)
        change { loading = false } // the load finished almost at once
        rule.mainClock.advanceTimeBy(ThesisMotion.SkeletonMinShow - 120)
        assertTrue("kept for the minimum", shown)
        rule.mainClock.advanceTimeBy(200)
        assertFalse("hidden after the minimum", shown)
    }

    @Test
    fun fastLoadNeverShowsASkeleton() {
        var loading by mutableStateOf(true)
        var everShown = false
        rule.mainClock.autoAdvance = false
        theme { if (rememberShowSkeleton(loading)) everShown = true }
        rule.mainClock.advanceTimeBy(ThesisMotion.SkeletonGrace - 100)
        change { loading = false }
        rule.mainClock.advanceTimeBy(1_000)
        assertFalse(everShown)
    }

    @Test
    fun dismissibleItemCollapsesThenReportsAndUndoExpandsBack() {
        var removing by mutableStateOf(false)
        var removed = 0
        rule.mainClock.autoAdvance = false
        theme {
            Column {
                DismissibleItem(removing = removing, onRemoved = { removed++ }) {
                    Box(Modifier.fillMaxWidth().height(64.dp).testTag("row"))
                }
            }
        }
        rule.mainClock.advanceTimeBy(500)
        assertEquals(0, removed)
        change { removing = true }
        rule.mainClock.advanceTimeBy(ThesisMotion.Base / 2L)
        assertEquals("not before the collapse ends", 0, removed)
        rule.mainClock.advanceTimeBy(ThesisMotion.Base + 200L)
        assertEquals(1, removed)
        rule.onNodeWithTag("row").assertDoesNotExist()
        change { removing = false } // undo
        rule.mainClock.advanceTimeBy(1_000)
        rule.onNodeWithTag("row").assertExists()
        assertEquals(1, removed)
    }

    @Test
    fun scrollSpyFollowsTheReadingLineAndPinsTheTappedChapter() {
        lateinit var spy: ScrollSpyState
        lateinit var list: LazyListState
        val starts = listOf(0, 10, 20, 30)
        theme {
            list = rememberLazyListState()
            spy = rememberScrollSpy(list, starts)
            LazyColumn(Modifier.fillMaxSize(), state = list) {
                items(40) { i -> Text("Item $i", Modifier.fillMaxWidth().height(80.dp)) }
            }
        }
        rule.runOnIdle { assertEquals(0, spy.selected) }
        rule.runOnIdle { runBlocking { list.scrollToItem(12) } }
        rule.runOnIdle { assertEquals(1, spy.selected) }
        rule.runOnIdle { spy.jumpTo(3) }
        rule.runOnIdle { assertEquals(3, spy.selected) }
        rule.waitForIdle()
        rule.runOnIdle { assertEquals(3, spy.selected) }
    }

    @Test
    fun refreshBoxOffersARefreshActionAndAnnouncesRefreshing() {
        var refreshing by mutableStateOf(false)
        var refreshed = 0
        theme {
            ThesisRefreshBox(refreshing = refreshing, onRefresh = { refreshed++ }, modifier = Modifier.testTag("box")) {
                Text("Content")
            }
        }
        val action = rule.onNodeWithTag("box").fetchSemanticsNode().config.getOrNull(SemanticsActions.CustomActions)
        assertEquals("Refresh", action?.single()?.label)
        rule.runOnIdle { action!!.single().action() }
        assertEquals(1, refreshed)
        refreshing = true
        rule.waitForIdle()
        val line = rule.onNodeWithContentDescription("Refreshing").fetchSemanticsNode().config
        assertEquals(LiveRegionMode.Polite, line.getOrNull(SemanticsProperties.LiveRegion))
        assertNull(rule.onNodeWithTag("box").fetchSemanticsNode().config.getOrNull(SemanticsActions.CustomActions))
    }

    @Test
    fun containerTransformOpensAndBackClosesIntoTheRow() {
        var open by mutableStateOf<String?>(null)
        theme {
            ContainerTransformHost(
                openKey = open,
                origin = Rect(0f, 200f, 400f, 300f),
                onClose = { open = null },
                list = { Text("List") },
                detail = { key -> Text("Detail $key") },
            )
        }
        rule.onNodeWithText("Detail AAPL").assertDoesNotExist()
        open = "AAPL"
        rule.waitForIdle()
        rule.onNodeWithText("Detail AAPL").assertExists()
        runBlocking { assertTrue(PreviewBack.press()) }
        rule.waitForIdle()
        assertNull(open)
        rule.onNodeWithText("Detail AAPL").assertDoesNotExist()
        assertEquals(0, PreviewBack.enabledCount)
    }

    @Test
    fun intRollingNumberCountsKeepPrefixAndSuffix() {
        var count by mutableIntStateOf(3)
        theme { RollingNumber(count, { "$it new" }, ThesisType.body) }
        rule.onNodeWithContentDescription("3 new").assertExists()
        count = 12
        rule.waitForIdle()
        rule.onNodeWithContentDescription("12 new").assertExists()
    }
}
