package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.preview.fixtures.heroPlatform
import com.thesis.mobile.preview.fixtures.newAccountState
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.BackPreview
import com.thesis.mobile.ui.shell.NavEntry
import com.thesis.mobile.ui.shell.ReportBaseLayer
import com.thesis.mobile.ui.shell.ScreenChrome
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ShellLayerEnv
import com.thesis.mobile.ui.shell.ShellMotionPx
import com.thesis.mobile.ui.shell.TabLayer
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlinx.coroutines.runBlocking

/**
 * PR-2 M3 acceptance (DESIGN-DIRECTION 6.2): scroll position survives tab switches and Name(A) → Name(B) → back;
 * back from Compare restores the live report and its scroll; the covered report gets no touches; the top bar's
 * scroll reveal follows nested scroll; predictive back pops and is off at the root (no double back handling).
 *
 * The layer tests drive the shell's own layers (ShellLayers.kt: the same `TabLayer` and `ReportBaseLayer` that
 * `ThesisShell` uses) with plain 100-row lists, so positions are exact; the shell tests use the real shell.
 */
class ShellLayersTest {

    @get:Rule
    val rule = createComposeRule()

    /** Every page's list state, by entryId, as last composed (a recreated page replaces its entry). */
    private val lists = mutableMapOf<String, LazyListState>()
    private var reportCreations = 0
    private var reportDisposals = 0
    private var reportClicks = 0

    @Composable
    private fun Page(entry: NavEntry) {
        val state = rememberLazyListState()
        SideEffect { lists[entry.entryId] = state }
        LazyColumn(state = state, modifier = Modifier.fillMaxSize().testTag("list-${entry.entryId}")) {
            items(100) { Text("${entry.entryId} row $it", Modifier.height(48.dp)) }
        }
    }

    @Composable
    private fun ReportPage(entry: NavEntry) {
        remember { reportCreations++ }
        DisposableEffect(Unit) { onDispose { reportDisposals++ } }
        Box(Modifier.fillMaxSize().clickable { reportClicks++ }) { Page(entry) }
    }

    /** The shell's report base layer and tab layer over [navigator], without the screens. */
    private fun setLayers(navigator: AppNavigator, reducedMotion: Boolean = false) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, reducedMotion, BackPreview()) }
                val report = navigator.stack(navigator.currentTab).lastOrNull { it.destination is Destination.Report }
                Box(Modifier.fillMaxSize()) {
                    ReportBaseLayer(report, navigator.tabTop.entryId, { navigator.lastMove }, env) { ReportPage(it) }
                    TabLayer(
                        target = navigator.tabTop,
                        move = { navigator.lastMove },
                        env = env,
                        drawnBelow = { it.destination is Destination.Report }
                    ) { entry ->
                        // Compare reports is an empty page here: nothing on it takes a tap.
                        if (entry.destination is Destination.CompareReports) Box(Modifier.fillMaxSize()) else Page(entry)
                    }
                }
            }
        }
    }

    private fun move(block: () -> Unit) {
        rule.runOnIdle(block)
        rule.waitForIdle()
    }

    @Test
    fun nameAToNameBAndBackReturnsToAsScroll() {
        val navigator = AppNavigator().apply {
            selectTab(ShellTab.Names)
            push(Destination.Name("AAPL"))
        }
        setLayers(navigator)
        val a = navigator.tabTop.entryId
        rule.onNodeWithTagSafe("list-$a").performScrollToIndex(40)

        move { navigator.push(Destination.Name("MSFT")) }
        val b = navigator.tabTop.entryId
        assertNotEquals(a, b)
        assertEquals("MSFT opens at its top", 0, lists.getValue(b).firstVisibleItemIndex)
        rule.onNodeWithTagSafe("list-$b").performScrollToIndex(12)

        move { navigator.pop() }
        assertEquals("back on AAPL at the row it was left on", 40, lists.getValue(a).firstVisibleItemIndex)
    }

    @Test
    fun tabSwitchKeepsEachTabsScroll() {
        val navigator = AppNavigator()
        setLayers(navigator)
        val today = navigator.tabTop.entryId
        rule.onNodeWithTagSafe("list-$today").performScrollToIndex(25)

        move { navigator.selectTab(ShellTab.Names) }
        val names = navigator.tabTop.entryId
        rule.onNodeWithTagSafe("list-$names").performScrollToIndex(7)

        move { navigator.selectTab(ShellTab.Today) }
        assertEquals(25, lists.getValue(today).firstVisibleItemIndex)
        move { navigator.selectTab(ShellTab.Names) }
        assertEquals(7, lists.getValue(names).firstVisibleItemIndex)
    }

    @Test
    fun backFromCompareRestoresTheLiveReportAndItsScroll() {
        val navigator = AppNavigator().apply {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
        }
        setLayers(navigator)
        val report = navigator.tabTop.entryId
        rule.onNodeWithTagSafe("list-$report").performScrollToIndex(33)
        val liveState = lists.getValue(report)

        move { navigator.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025")) }
        assertEquals("the report stays composed under Compare", 0, reportDisposals)

        move { navigator.pop() }
        assertEquals("never rebuilt: no reload, no new token", 1, reportCreations)
        assertEquals(0, reportDisposals)
        assertSame("the same live page", liveState, lists.getValue(report))
        assertEquals(33, lists.getValue(report).firstVisibleItemIndex)
    }

    @Test
    fun theReportIsDroppedWhenItsEntryIsPopped() {
        val navigator = AppNavigator().apply {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
        }
        setLayers(navigator)
        move { navigator.pop() }
        assertEquals(1, reportDisposals)
    }

    @Test
    fun aCoveredReportGetsNoTouches() {
        val navigator = AppNavigator().apply {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
        }
        setLayers(navigator)
        rule.onRoot().performClick()
        assertEquals("on top, the report takes taps", 1, reportClicks)

        move { navigator.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025")) }
        rule.onRoot().performClick()
        assertEquals("a tap on an empty part of Compare stops there", 1, reportClicks)

        move { navigator.pop() }
        rule.onRoot().performClick()
        assertEquals(2, reportClicks)
    }

    @Test
    fun reducedMotionKeepsTheSameState() {
        val navigator = AppNavigator().apply {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
        }
        setLayers(navigator, reducedMotion = true)
        val report = navigator.tabTop.entryId
        rule.onNodeWithTagSafe("list-$report").performScrollToIndex(9)
        move { navigator.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025")) }
        move { navigator.pop() }
        assertEquals(1, reportCreations)
        assertEquals(9, lists.getValue(report).firstVisibleItemIndex)
    }

    @Test
    fun scrollingUnderTheBarCollapsesItAndTheTopUncollapsesIt() {
        val chrome = ScreenChrome(0f, 21f)
        rule.setContent {
            Box(Modifier.fillMaxSize().nestedScroll(chrome.nestedScroll)) {
                LazyColumn(Modifier.fillMaxSize().testTag("list")) {
                    items(100) { Text("row $it", Modifier.height(48.dp)) }
                }
            }
        }
        assertFalse(chrome.collapsed)
        rule.onNodeWithTagSafe("list").performTouchInput { swipeUp() }
        rule.waitForIdle()
        assertTrue(chrome.collapsed)
        rule.onNodeWithTagSafe("list").performTouchInput { swipeDown() }
        rule.onNodeWithTagSafe("list").performTouchInput { swipeDown() }
        rule.waitForIdle()
        assertFalse(chrome.collapsed)
    }

    // ---- The real shell

    private fun setShell(
        navigator: AppNavigator,
        state: com.thesis.mobile.ui.UiState = ShellFixtures.state,
        platform: com.thesis.mobile.ui.shell.ShellPlatform = com.thesis.mobile.ui.shell.ShellPlatform()
    ) {
        val actions = object : ShellActions {
            override fun onBack(): Boolean = navigator.back()
            override fun onSelectTab(tab: ShellTab) {
                navigator.selectTab(tab)
            }
        }
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                ThesisShell(
                    state = state,
                    navigator = navigator,
                    actions = actions,
                    platform = platform,
                    snackbarHostState = remember { SnackbarHostState() }
                )
            }
        }
    }

    private val verticalScroll = SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)

    private fun todayScroll(): Float =
        rule.onAllNodes(verticalScroll).onFirst().fetchSemanticsNode()
            .config[SemanticsProperties.VerticalScrollAxisRange].value()

    @Test
    fun shellKeepsTodaysScrollAcrossATabSwitch() {
        val navigator = AppNavigator()
        setShell(navigator)
        rule.onAllNodes(verticalScroll).onFirst().performTouchInput { swipeUp() }
        rule.waitForIdle()
        val scrolled = todayScroll()
        assertTrue("Today scrolled ($scrolled)", scrolled > 0f)

        move { navigator.selectTab(ShellTab.Inbox) }
        move { navigator.selectTab(ShellTab.Today) }
        assertEquals(scrolled, todayScroll(), 0.5f)
    }

    @Test
    fun predictiveBackPopsAndIsOffAtTheRoot() {
        val navigator = AppNavigator()
        setShell(navigator)
        rule.waitForIdle()
        val atRoot = PreviewBack.enabledCount
        assertEquals("nothing handles back at Today's root: the system goes home", 0, atRoot)

        move { navigator.push(Destination.History()) }
        assertTrue(PreviewBack.enabledCount >= 1)
        rule.runOnIdle { runBlocking { assertTrue(PreviewBack.press()) } }
        rule.waitForIdle()
        assertEquals(Destination.Today, navigator.tabTop.destination)
        assertEquals(0, PreviewBack.enabledCount)
    }

    @Test
    fun statusBarIsOverTheHeroAtRestAndLeavesItOnceCollapsed() {
        // 2.7: an entry that declares its HeroBand (HeroUnderBars) under the shell's top bar puts the status bar
        // over the hero (light icons, both themes) until content scrolls under the bar.
        val calls = mutableListOf<Boolean>()
        val navigator = AppNavigator()
        setShell(navigator, newAccountState, heroPlatform { calls += it })
        rule.waitForIdle()
        assertEquals("over the hero at rest", true, calls.lastOrNull())

        // From mid-screen: a swipe from the bottom edge starts on the bottom bar.
        rule.onAllNodes(verticalScroll).onFirst().performTouchInput { swipeUp(startY = bottom * 0.8f, endY = bottom * 0.4f) }
        rule.waitForIdle()
        assertTrue("the hero page scrolled", todayScroll() > 0f)
        assertEquals("collapsed: back to the theme's icons", false, calls.lastOrNull())

        rule.onAllNodes(verticalScroll).onFirst().performTouchInput { swipeDown() }
        rule.waitForIdle()
        assertEquals("back at the top: over the hero again", true, calls.lastOrNull())

        // A pushed screen without a HeroBand is what the status bar sits over now.
        move { navigator.push(Destination.History()) }
        assertEquals(false, calls.lastOrNull())
        move { navigator.pop() }
        assertEquals(true, calls.lastOrNull())
    }

    @Test
    fun aModalTakesTheLayersUnderItOutOfTheAccessibilityTree() {
        val navigator = AppNavigator()
        setShell(navigator)
        rule.waitForIdle()
        val search = SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("Search"))
        val todayTab = SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString("Today")))
        assertTrue("Today's root bar is read", rule.onAllNodes(search).fetchSemanticsNodes().isNotEmpty())
        assertTrue("the bottom bar is read", rule.onAllNodes(todayTab).fetchSemanticsNodes().isNotEmpty())

        move { navigator.openModal(Destination.You) }
        assertTrue("Today's page is not read under You", rule.onAllNodes(search).fetchSemanticsNodes().isEmpty())
        assertTrue("the bottom bar is not read under You", rule.onAllNodes(todayTab).fetchSemanticsNodes().isEmpty())

        move { navigator.pop() }
        assertTrue(rule.onAllNodes(search).fetchSemanticsNodes().isNotEmpty())
    }

    /**
     * 4.5 container transform: a Name pushed from a list row grows from the row's bounds over the list (the list
     * still shows outside the growing page mid-move), covers the layer at rest, and shrinks back into the row on
     * the pop. A push without an origin keeps the shared axis. Coloured pages, so the pixels are exact.
     */
    @Test
    fun aNameOpenedFromARowGrowsFromItAndShrinksBackIntoIt() {
        val navigator = AppNavigator().apply { selectTab(ShellTab.Names) }
        val listColour = androidx.compose.ui.graphics.Color(0xFFFF0000)
        val pageColour = androidx.compose.ui.graphics.Color(0xFF0000FF)
        rule.mainClock.autoAdvance = false
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                val holder = rememberSaveableStateHolder()
                val env = remember { ShellLayerEnv(holder, ShellMotionPx(63, 84), 21f, false, BackPreview()) }
                TabLayer(
                    target = navigator.tabTop,
                    move = { navigator.lastMove },
                    env = env,
                    drawnBelow = { false },
                    originOf = { navigator.transformOrigin(it.entryId) },
                ) { entry ->
                    val colour = if (entry.destination is Destination.Name) pageColour else listColour
                    Box(Modifier.fillMaxSize().background(colour))
                }
            }
        }
        rule.mainClock.advanceTimeBy(500)
        val size = rule.onRoot().fetchSemanticsNode().size
        val far = { rule.onRoot().captureToImage().toPixelMap()[size.width - 2, size.height - 2] }
        val near = { rule.onRoot().captureToImage().toPixelMap()[20, 20] }

        rule.runOnIdle {
            navigator.pushFrom(androidx.compose.ui.geometry.Rect(0f, 0f, 200f, 96f)) { navigator.push(Destination.Name("AAPL")) }
        }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeBy(60)
        assertNotEquals("mid-move, the far corner still shows the list", pageColour.toArgb(), far().toArgb())
        rule.mainClock.advanceTimeBy(500)
        assertEquals("at rest the page covers the layer", pageColour.toArgb(), far().toArgb())

        rule.runOnIdle { navigator.pop() }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeBy(150)
        assertNotEquals("the page shrinks toward its row: the far corner is the list again", pageColour.toArgb(), far().toArgb())
        assertNotEquals("the row corner is still the page's", listColour.toArgb(), near().toArgb())
        rule.mainClock.advanceTimeBy(500)
        assertEquals(listColour.toArgb(), far().toArgb())
        assertEquals(listColour.toArgb(), near().toArgb())
        assertEquals("no origin left for a plain push", null, navigator.transformOrigin(navigator.push(Destination.Name("MSFT")).entryId))
    }

    private fun androidx.compose.ui.test.junit4.ComposeContentTestRule.onNodeWithTagSafe(tag: String) =
        onNode(SemanticsMatcher.expectValue(SemanticsProperties.TestTag, tag), useUnmergedTree = true)
}
