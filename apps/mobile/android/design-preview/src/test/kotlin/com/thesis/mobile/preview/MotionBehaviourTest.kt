package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.key
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
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.animations.StaggeredEntrance
import com.thesis.mobile.ui.motion.ContainerTransformHost
import com.thesis.mobile.ui.motion.Glyphs
import com.thesis.mobile.ui.motion.RollPlan
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.EntranceCoordinator
import com.thesis.mobile.ui.motion.EntranceRegistry
import com.thesis.mobile.ui.motion.ProvideEntranceScope
import com.thesis.mobile.ui.motion.RollingNumber
import com.thesis.mobile.ui.motion.ScrollSpyState
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisPullRefresh
import com.thesis.mobile.ui.motion.rememberDataEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberScrollSpy
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.preview.fixtures.TodayFixtures
import com.thesis.mobile.preview.fixtures.TodayLocals
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.tnum
import java.time.LocalDate
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
        // Each entry is its own subtree in the shell (keyed by entryId), so its blocks attach fresh.
        theme { key(scope) { ProvideEntranceScope(registry, scope) { Block("header", "block") } } }
        rule.mainClock.advanceTimeBy(1_000)
        scope = "entry-b"
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
    }

    @Test
    fun aNewIssueOpenedLaterStaggersOnItsFirstOpen() {
        val registry = EntranceRegistry()
        var issue by mutableStateOf("issue-1")
        var shown by mutableStateOf(true)
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "home-entry") {
                if (shown) {
                    val coordinator = rememberEntranceCoordinator(issue)
                    Box(Modifier.size(48.dp).testTag("block").staggeredEntrance("header", coordinator).background(red))
                }
            }
        }
        rule.mainClock.advanceTimeBy(1_000)
        change { shown = false } // away on another tab
        change { issue = "issue-2" } // a new issue lands meanwhile
        change { shown = true } // Home's first open for the new issue
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
        rule.mainClock.advanceTimeBy(ThesisMotion.Enter + 2L * 16)
        assertEquals(red.toArgb(), rule.onNodeWithTag("block").centre().toArgb())
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
    fun scrollSpyOpensOnTheRestoredChapterFromTheFirstFrame() {
        val seen = mutableListOf<Int>()
        val starts = listOf(0, 6, 12, 18)
        rule.mainClock.autoAdvance = false
        theme {
            val list = rememberLazyListState(initialFirstVisibleItemIndex = 7)
            val spy = rememberScrollSpy(list, starts)
            seen += spy.selected
            // 560 dp viewport: item 7 at the top, chapter III's start (item 12) at 320 dp, below the reading line.
            LazyColumn(Modifier.fillMaxWidth().height(560.dp), state = list) {
                items(24) { i -> Text("Item $i", Modifier.fillMaxWidth().height(64.dp)) }
            }
        }
        rule.mainClock.advanceTimeByFrame()
        rule.waitForIdle()
        // Every composition, the very first included, shows chapter II (item 7 is inside it): no flash of chapter I.
        assertEquals(listOf(1), seen.distinct())
    }

    @Test
    fun refreshBoxOffersARefreshActionAndAnnouncesRefreshing() {
        var refreshing by mutableStateOf(false)
        var refreshed = 0
        theme {
            ThesisPullRefresh(refreshing = refreshing, onRefresh = { refreshed++ }, modifier = Modifier.testTag("box")) {
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

    @Test
    fun aNewIssueWhileOnScreenNeverBlanksOrReplays() {
        val registry = EntranceRegistry()
        var issue by mutableStateOf("issue-1")
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "home-entry") {
                val coordinator = rememberEntranceCoordinator(issue)
                Column {
                    // Same size across the refresh, and one whose size changes (it is remeasured): both stay opaque.
                    Box(Modifier.size(48.dp).testTag("same").staggeredEntrance("header", coordinator).background(red))
                    val h = if (issue == "issue-1") 48.dp else 64.dp
                    Box(Modifier.size(48.dp, h).testTag("grows").staggeredEntrance("card", coordinator).background(red))
                }
            }
        }
        // First open: both stagger in.
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals(red.toArgb(), rule.onNodeWithTag("grows").centre().toArgb())
        rule.mainClock.advanceTimeBy(1_000)
        assertEquals(red.toArgb(), rule.onNodeWithTag("same").centre().toArgb())
        assertEquals(red.toArgb(), rule.onNodeWithTag("grows").centre().toArgb())

        change { issue = "issue-2" } // a new Pulse issue arrives by refresh while Home is on screen
        repeat(40) {
            assertEquals("frame $it", red.toArgb(), rule.onNodeWithTag("same").centre().toArgb())
            assertEquals("frame $it", red.toArgb(), rule.onNodeWithTag("grows").centre().toArgb())
            rule.mainClock.advanceTimeByFrame()
        }
    }

    @Test
    fun rollingNumberChangedMidRollContinuesFromWhereItIs() {
        lateinit var measurer: TextMeasurer
        theme { measurer = rememberTextMeasurer() }
        rule.runOnIdle {
            val glyphs = Glyphs(measurer, ThesisType.statValue.tnum())
            val at = 100f // the second refresh lands 100 ms into the first roll

            // New target for a rolling digit: rolls on from the strip's current position, up to the new digit.
            val first = RollPlan.build(previous = "10", text = "11", trend = 1, reduced = false, glyphs = glyphs)
            val now = first.columns[0].position(at)
            assertTrue("mid-roll at 100 ms: $now", now > 0f && now < 1f)
            val second = RollPlan.build("11", "12", 1, false, glyphs, prior = first, priorMs = at)
            assertEquals(now, second.columns[0].position(0f), 1e-4f)
            assertEquals(2f, second.columns[0].position(second.durationMs.toFloat()), 1e-4f)
            assertEquals(first.width(at), second.width(0f), 0.5f)

            // Unchanged target for a column still moving: its motion simply continues on the new clock.
            val a = RollPlan.build(previous = "10", text = "19", trend = 1, reduced = false, glyphs = glyphs)
            val b = RollPlan.build("19", "29", 1, false, glyphs, prior = a, priorMs = at)
            assertEquals(a.columns[0].position(at), b.columns[0].position(0f), 0.05f)
            assertEquals(a.columns[0].position(a.durationMs.toFloat()), b.columns[0].position(b.durationMs.toFloat()), 1e-4f)
            assertEquals(2f, b.columns[1].position(b.durationMs.toFloat()), 1e-4f)
        }
    }

    @Test
    fun rollingNumberChangedTwice100MsApartEndsOnTheLastValue() {
        var value by mutableIntStateOf(10)
        rule.mainClock.autoAdvance = false
        theme { RollingNumber(value, { it.toString() }, ThesisType.statValue) }
        rule.mainClock.advanceTimeByFrame()
        change { value = 11 }
        rule.mainClock.advanceTimeBy(100)
        change { value = 12 }
        rule.onNodeWithContentDescription("12").assertExists()
        rule.mainClock.advanceTimeBy(ThesisMotion.Roll + ThesisMotion.rollDelay(4) + 100L)
        rule.onNodeWithContentDescription("12").assertExists()
    }

    @Test
    fun rapidPillTapsKeepThePinOnTheLatestTap() {
        lateinit var spy: ScrollSpyState
        val starts = listOf(0, 10, 20, 30)
        rule.mainClock.autoAdvance = false
        theme {
            val list = rememberLazyListState()
            spy = rememberScrollSpy(list, starts)
            LazyColumn(Modifier.fillMaxSize(), state = list) {
                items(40) { i -> Text("Item $i", Modifier.fillMaxWidth().height(80.dp)) }
            }
        }
        rule.mainClock.advanceTimeByFrame()
        change { spy.jumpTo(2) }
        rule.mainClock.advanceTimeBy(50)
        change { spy.jumpTo(3) } // a second tap while the first glide runs
        val seen = mutableSetOf<Int>()
        repeat(120) {
            rule.mainClock.advanceTimeByFrame()
            rule.runOnIdle { seen += spy.selected }
        }
        assertEquals("no flicker through the chapters in between", setOf(3), seen)
    }

    @Test
    fun committedPredictiveBackClosesIntoTheRowNotBeside() {
        var open by mutableStateOf<String?>(null)
        rule.mainClock.autoAdvance = false
        theme {
            ContainerTransformHost(
                openKey = open,
                origin = Rect(0f, 200f, 400f, 300f),
                onClose = { open = null },
                list = { Box(Modifier.fillMaxSize().background(red)) },
                detail = { key -> Text("Detail $key") },
            )
        }
        change { open = "AAPL" }
        rule.mainClock.advanceTimeBy(1_000)
        runBlocking { assertTrue(PreviewBack.press()) } // swipes to progress 1, then commits
        rule.mainClock.advanceTimeByFrame()
        // Near the end of the close the page is almost the row again: its left edge is the row's left edge. If the
        // preview's 0.9 scale and 8 dp shift stayed, the shrinking clip would sit tens of px right of the row.
        repeat(ThesisMotion.ScreenOut / 16 - 2) { rule.mainClock.advanceTimeByFrame() } // frame by frame: the close runs
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        // The list is red; the closing page is paper. (The scrim tints the list slightly, so compare channels.)
        val edge = pixels[4, 250]
        assertTrue("the closing page covers the row's left edge: $edge", edge.green > 0.5f)
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Detail AAPL").assertDoesNotExist()
    }

    @Test
    fun aBlockAttachedAfterTheFirstOneLeftEarlyIsNeverHidden() {
        val registry = EntranceRegistry()
        var first by mutableStateOf(true)
        var late by mutableStateOf(false)
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "home-entry") {
                Column {
                    if (first) Block("header", "first")
                    if (late) Block("macro", "late")
                }
            }
        }
        rule.mainClock.advanceTimeBy(100)
        change { first = false } // a fast fling or tab switch inside the window: the only animating block leaves
        rule.mainClock.advanceTimeBy(1_000)
        // Nothing keeps the window's clock any more, so it closed with that block: no later key is granted an
        // entrance (which would hide it on its first frame before the clock could close the window).
        rule.runOnIdle {
            assertEquals(EntranceCoordinator.NO_ENTRANCE, registry.coordinator("home-entry", "issue-1").claim("probe"))
        }
        change { late = true } // scrolled in long after the window: on screen at once, never a blank frame
        assertEquals(red.toArgb(), rule.onNodeWithTag("late").centre().toArgb())
    }

    @Test
    fun rollStaggerLeadsFromTheRightmostChangedDigit() {
        lateinit var measurer: TextMeasurer
        theme { measurer = rememberTextMeasurer() }
        rule.runOnIdle {
            val glyphs = Glyphs(measurer, ThesisType.statValue.tnum())
            // A suffix never delays the digits: "12 new" -> "15 new", "12.5%" -> "13.0%".
            val suffix = RollPlan.build("12 new", "15 new", 1, false, glyphs)
            assertEquals(0, suffix.columns[4].delayMs)
            val percent = RollPlan.build("12.5%", "13.0%", 1, false, glyphs)
            assertEquals(0, percent.columns[1].delayMs)
            assertEquals(ThesisMotion.RollStagger, percent.columns[3].delayMs)
            // An unchanged digit to the right does not delay the changed one.
            assertEquals(0, RollPlan.build("1205", "1215", 1, false, glyphs).columns[1].delayMs)
        }
    }

    @Test
    fun rollingNumberRetargetedMidFadeContinuesFromWhatIsOnScreen() {
        lateinit var measurer: TextMeasurer
        theme { measurer = rememberTextMeasurer() }
        rule.runOnIdle {
            val glyphs = Glyphs(measurer, ThesisType.statValue.tnum())
            val at = 120f
            fun RollPlan.shown(column: Int, ms: Float) =
                columns[column].visibleAt(ms).map { Triple(it.char, it.alpha, it.offset) }.sortedBy { it.first }

            fun assertSame(expected: List<Triple<Char, Float, Float>>, actual: List<Triple<Char, Float, Float>>) {
                assertEquals(expected.map { it.first }, actual.map { it.first })
                expected.zip(actual).forEach { (e, a) ->
                    assertEquals(e.second, a.second, 0.01f)
                    assertEquals(e.third, a.third, 0.01f)
                }
            }

            // A sign still fading in gets a new character: both glyphs keep the opacity they have on screen.
            val sign = RollPlan.build("5", "-5", -1, false, glyphs)
            val plus = RollPlan.build("-5", "+5", 1, false, glyphs, prior = sign, priorMs = at)
            assertSame(sign.shown(1, at), plus.shown(1, 0f))
            assertEquals(listOf('+'), plus.shown(1, plus.durationMs.toFloat()).map { it.first })
            // ...and back to the sign it was leaving: it fades in from where it is, not from 0 or 100%.
            val back = RollPlan.build("+5", "-5", -1, false, glyphs, prior = plus, priorMs = at)
            assertSame(plus.shown(1, at), back.shown(1, 0f))

            // A rolling digit whose column leaves: the strip glyphs fade out where they stopped.
            val roll = RollPlan.build("19", "28", 1, false, glyphs)
            val gone = RollPlan.build("28", "8", -1, false, glyphs, prior = roll, priorMs = at)
            assertSame(roll.shown(1, at), gone.shown(1, 0f))
            assertTrue(gone.columns[1].visibleAt(gone.durationMs.toFloat()).isEmpty())
            assertEquals(0f, gone.width(gone.durationMs.toFloat()) - glyphs.width('8'), 0.5f)
        }
    }

    @Test
    fun rollingNumberWiderThanItsSlotIsScaledToFitNeverCut() {
        theme {
            Box(Modifier.size(width = 40.dp, height = 200.dp)) {
                RollingNumber(1_234_567, { it.toString() }, ThesisType.statValue)
            }
        }
        val width = rule.onNodeWithContentDescription("1234567").fetchSemanticsNode().size.width
        val slot = with(rule.density) { 40.dp.roundToPx() }
        assertTrue("fits its 40 dp slot: $width px of $slot", width <= slot)
        assertTrue("not collapsed: $width px", width > slot * 3 / 4)
    }

    @Test
    fun dataArrivingAfterTheFirstPaintNeverBlanksWhatIsOnScreen() {
        val registry = EntranceRegistry()
        var issue by mutableStateOf<String?>(null)
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(registry, "home-entry") {
                val coordinator = rememberDataEntranceCoordinator(issue)
                Column {
                    // Painted before the issue (header, macro card) and brought by the issue (what moved).
                    Box(Modifier.size(48.dp).testTag("header").staggeredEntrance(0, coordinator).background(red))
                    if (issue != null) {
                        Box(Modifier.size(48.dp).testTag("moved").staggeredEntrance(4, coordinator).background(red))
                    }
                }
            }
        }
        // No issue yet: nothing staggers, the header is opaque on its first frame.
        rule.mainClock.advanceTimeByFrame()
        assertEquals(red.toArgb(), rule.onNodeWithTag("header").centre().toArgb())
        rule.mainClock.advanceTimeBy(1_000)

        change { issue = "issue-1" } // the cold-start fetch (or a retry from the error state) lands
        repeat(40) {
            assertEquals("frame $it", red.toArgb(), rule.onNodeWithTag("header").centre().toArgb())
            assertEquals("frame $it", red.toArgb(), rule.onNodeWithTag("moved").centre().toArgb())
            rule.mainClock.advanceTimeByFrame()
        }
        change { issue = "issue-2" } // and a later refresh never staggers either
        repeat(20) {
            assertEquals("frame $it", red.toArgb(), rule.onNodeWithTag("header").centre().toArgb())
            rule.mainClock.advanceTimeByFrame()
        }
    }

    @Test
    fun homeKeepsItsBlocksWhenThePulseIssueLoadsAfterTheFirstPaint() {
        var pulse by mutableStateOf<PulseReportView?>(null)
        rule.mainClock.autoAdvance = false
        theme {
            ProvideEntranceScope(EntranceRegistry(), "home-entry") {
                // WP-A: Home reads "now" from LocalTodayClock / LocalFmt; the fixed Today clock keeps the eyebrow stable.
                TodayLocals {
                HomeScreen(
                    pulse = pulse, pulseLoadedFromCache = false, pulseFreshnessText = null, sentimentCurrent = null,
                    sentimentHistory = emptyList(), sentimentError = null, watchlist = listOf("AAPL", "MSFT"),
                    monitorSnapshots = emptyList(), padding = PaddingValues(), onOpenHistory = {},
                    onRunDeepDive = {}, onManageNames = {}, onRetryPulse = {}, onOpenMacroStressDashboard = {},
                    onOpenWeeklyDigest = {}, onOpenPulseBrief = {},
                )
                }
            }
        }
        // The header's eyebrow (Tue 24 Nov · Pre-market under the fixed clock) and the macro card's no-reading title.
        val date = TodayCopy.eyebrow(TodayFixtures.fmt.marketDate(LocalDate.of(2026, 11, 24)), TodayCopy.PHASE_PRE_MARKET).uppercase()
        rule.mainClock.advanceTimeBy(1_000)
        // Header (block 0) and the Macro Stress card (block 1) are on screen before the issue.
        val header = rule.onNodeWithText(date).captureToImage().toPixelMap()
        val macro = rule.onNodeWithText(TodayCopy.MACRO_NO_READING).captureToImage().toPixelMap()
        fun sameAs(expected: androidx.compose.ui.graphics.PixelMap, node: SemanticsNodeInteraction): Boolean {
            val now = node.captureToImage().toPixelMap()
            if (now.width != expected.width || now.height != expected.height) return false
            for (x in 0 until now.width) for (y in 0 until now.height) if (now[x, y] != expected[x, y]) return false
            return true
        }

        change { pulse = ShellFixtures.pulse }
        repeat(30) {
            assertTrue("header blanked at frame $it", sameAs(header, rule.onNodeWithText(date)))
            assertTrue("macro card blanked at frame $it", sameAs(macro, rule.onNodeWithText(TodayCopy.MACRO_NO_READING)))
            rule.mainClock.advanceTimeByFrame()
        }
    }
}
