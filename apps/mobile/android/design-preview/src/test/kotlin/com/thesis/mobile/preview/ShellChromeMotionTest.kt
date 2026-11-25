package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.preview.fixtures.heroPlatform
import com.thesis.mobile.preview.fixtures.newAccountState
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ShellPlatform
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The shell's chrome in motion (PR-2 M3, DESIGN-DIRECTION 4.4, 4.5, 4.8, 2.7), on the real shell: the tab roots'
 * bar stays still while the page bodies fade through, a snackbar under reduced motion shows at once at full size
 * (no Material3 fade-and-scale), and the status bar's icons switch once the leaving page has gone.
 */
class ShellChromeMotionTest {

    @get:Rule
    val rule = createComposeRule()

    private val host = SnackbarHostState()

    private fun setShell(
        navigator: AppNavigator,
        state: UiState = ShellFixtures.state,
        platform: ShellPlatform = ShellPlatform(),
        reducedMotion: Boolean = false,
    ) {
        val actions = object : ShellActions {
            override fun onBack(): Boolean = navigator.back()
            override fun onSelectTab(tab: ShellTab) {
                navigator.selectTab(tab)
            }
        }
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark, reduceMotion = reducedMotion) {
                // As ThesisApp: one page background, painted at the root, that the shell reuses.
                ProvidePageBackground {
                    Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current)) {
                        ThesisShell(state = state, navigator = navigator, actions = actions, platform = platform, snackbarHostState = host)
                    }
                }
            }
        }
        rule.waitForIdle()
    }

    private val search = SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("Search"))

    /** The window's pixels from the top edge down to [bottom] (the root bar's band), as ARGB ints. */
    private fun band(bottom: Dp): List<Int> {
        val pixels = rule.onRoot().captureToImage().toPixelMap()
        val rows = (bottom.value * rule.density.density).roundToInt().coerceAtMost(pixels.height)
        return buildList {
            for (y in 0 until rows) for (x in 0 until pixels.width) {
                val c = pixels[x, y]
                add(((c.red * 255).roundToInt() shl 16) or ((c.green * 255).roundToInt() shl 8) or (c.blue * 255).roundToInt())
            }
        }
    }

    private fun maxChannelDiff(a: List<Int>, b: List<Int>): Int = a.indices.maxOf { i ->
        maxOf(
            abs((a[i] shr 16 and 0xFF) - (b[i] shr 16 and 0xFF)),
            abs((a[i] shr 8 and 0xFF) - (b[i] shr 8 and 0xFF)),
            abs((a[i] and 0xFF) - (b[i] and 0xFF))
        )
    }

    @Test
    fun aSwitchBetweenTabRootsKeepsTheirBarStill() {
        // 4.5 fade-through moves the page bodies; the brand, search and avatar are the same on every root and stay.
        val navigator = AppNavigator()
        setShell(navigator)
        val barBottom = rule.onNode(search).getBoundsInRoot().bottom + 4.dp
        val rest = band(barBottom)
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { navigator.selectTab(ShellTab.Names) }
        var elapsed = 0
        while (elapsed <= 360) {
            rule.mainClock.advanceTimeBy(15)
            elapsed += 15
            val diff = maxChannelDiff(rest, band(barBottom))
            assertTrue("the root bar changes at $elapsed ms (max channel diff $diff)", diff <= 2)
        }
        rule.mainClock.autoAdvance = true
        assertEquals("one bar is read", 1, rule.onAllNodes(search).fetchSemanticsNodes().size)
    }

    @Test
    fun aPopToATabRootBringsItsBarInWithThePage() {
        // 4.5: in a pop the bar moves with its screen. Today's bar comes in with Today (fading, from -24 dp) and the
        // shell takes it over only once Today has settled: never at rest over a page that is still arriving.
        val navigator = AppNavigator()
        setShell(navigator)
        val barBottom = rule.onNode(search).getBoundsInRoot().bottom + 4.dp
        val rest = band(barBottom)
        rule.runOnIdle { navigator.push(Destination.History()) }
        rule.waitForIdle()
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { navigator.pop() }
        // History leaves in 90 ms; Today comes in over 210 ms after that. Frame by frame, as the clock only starts
        // the animations on the first frame after the pop. Between about 120 and 210 ms Today's body is still
        // arriving (faded, offset): its bar must be too, not drawn at rest over it.
        var elapsed = 0L
        while (elapsed < 208L) {
            rule.mainClock.advanceTimeBy(16)
            elapsed += 16
            if (elapsed < 128L) continue
            val diff = maxChannelDiff(rest, band(barBottom))
            assertTrue("the root bar is at rest at $elapsed ms, ahead of its page (max channel diff $diff)", diff > 40)
        }
        rule.mainClock.advanceTimeBy(400)
        rule.mainClock.autoAdvance = true
        rule.waitForIdle()
        val diff = maxChannelDiff(rest, band(barBottom))
        assertTrue("the root bar settles where it was (max channel diff $diff)", diff <= 2)
        assertEquals("one bar is read", 1, rule.onAllNodes(search).fetchSemanticsNodes().size)
    }

    @Test
    fun underReducedMotionASnackbarShowsAtOnceAtFullSize() {
        // 4.8: no rise, no fade, and no Material3 scale from .8 (4.3.8): the first frame is the resting frame.
        val navigator = AppNavigator()
        setShell(navigator, reducedMotion = true)
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { CoroutineScope(Dispatchers.Unconfined).launch { host.showThesisSnackbar("Saved.") } }
        rule.mainClock.advanceTimeBy(32)
        val message = SemanticsMatcher.expectValue(
            SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString("Saved."))
        )
        val early = rule.onNode(message, useUnmergedTree = true).getBoundsInRoot()
        val earlyBand = band(rule.onRoot().getBoundsInRoot().bottom)
        rule.mainClock.advanceTimeBy(1_000)
        val rest = rule.onNode(message, useUnmergedTree = true).getBoundsInRoot()
        assertEquals("same place and size at 32 ms as at rest", rest, early)
        assertTrue("the same pixels at 32 ms as at rest", maxChannelDiff(earlyBand, band(rule.onRoot().getBoundsInRoot().bottom)) <= 2)
        rule.mainClock.autoAdvance = true
    }

    @Test
    fun aSnackbarRisesWithoutScaling() {
        // 4.4: rise 12 dp + fade; its width is the resting width in every frame (no scale).
        val navigator = AppNavigator()
        setShell(navigator)
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { CoroutineScope(Dispatchers.Unconfined).launch { host.showThesisSnackbar("Saved.") } }
        val message = SemanticsMatcher.expectValue(
            SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString("Saved."))
        )
        val widths = mutableListOf<Dp>()
        repeat(8) {
            rule.mainClock.advanceTimeBy(16)
            widths += rule.onNode(message, useUnmergedTree = true).getBoundsInRoot().width
        }
        rule.mainClock.advanceTimeBy(1_000)
        val rest = rule.onNode(message, useUnmergedTree = true).getBoundsInRoot().width
        widths.forEach { assertEquals("no scale while it rises", rest.value, it.value, 0.5f) }
        rule.mainClock.autoAdvance = true
    }

    @Test
    fun theStatusBarSwitchesOnceTheLeavingPageHasGone() {
        // 2.7: Today opens on a HeroBand (light icons). A push puts History in front only once Today has left.
        val calls = mutableListOf<Boolean>()
        val navigator = AppNavigator()
        setShell(navigator, newAccountState, heroPlatform { calls += it })
        assertEquals("over the hero at rest", true, calls.lastOrNull())
        rule.mainClock.autoAdvance = false
        rule.runOnIdle { navigator.push(Destination.History()) }
        rule.mainClock.advanceTimeBy(48)
        assertEquals("Today is still leaving: its icons stay", true, calls.lastOrNull())
        rule.mainClock.advanceTimeBy(200)
        assertEquals("History is in front", false, calls.lastOrNull())
        rule.mainClock.autoAdvance = true
    }
}
