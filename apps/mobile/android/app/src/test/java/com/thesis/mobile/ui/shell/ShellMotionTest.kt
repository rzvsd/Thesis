package com.thesis.mobile.ui.shell

import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.platform.BackSwipeEdge
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Shell motion rules (DESIGN-DIRECTION 4.4, 4.5, 4.8): which transition each navigator move gets, the top bar's
 * scroll reveal and hero state, and the predictive-back preview's bookkeeping.
 */
class ShellMotionTest {

    // ---- 4.5 transitions

    @Test
    fun eachMoveGetsItsSection45Transition() {
        assertEquals(ShellTransition.FadeThrough, shellTransitionFor(NavMove.Tab, reducedMotion = false))
        assertEquals(ShellTransition.Forward, shellTransitionFor(NavMove.Push, reducedMotion = false))
        assertEquals(ShellTransition.Backward, shellTransitionFor(NavMove.Pop, reducedMotion = false))
        // A replaced entry (build → report), a restore and a modal change under the tab layer only crossfade.
        assertEquals(ShellTransition.Crossfade, shellTransitionFor(NavMove.Replace, reducedMotion = false))
        assertEquals(ShellTransition.Crossfade, shellTransitionFor(NavMove.None, reducedMotion = false))
        assertEquals(ShellTransition.Crossfade, shellTransitionFor(NavMove.Modal, reducedMotion = false))
    }

    @Test
    fun reducedMotionCrossfadesEveryMove() {
        NavMove.entries.forEach { move ->
            assertEquals(move.name, ShellTransition.Crossfade, shellTransitionFor(move, reducedMotion = true))
        }
        val you = NavEntry(Destination.You, "e1")
        val page = NavEntry(Destination.YouPage("appearance"), "e2")
        assertEquals(ShellTransition.Crossfade, modalTransitionFor(null, you, forward = false, reducedMotion = true))
        assertEquals(ShellTransition.Crossfade, modalTransitionFor(you, page, forward = true, reducedMotion = true))
    }

    @Test
    fun modalsRiseAndFallAndMoveOnXInside() {
        val you = NavEntry(Destination.You, "e1")
        val page = NavEntry(Destination.YouPage("appearance"), "e2")
        assertEquals(ShellTransition.Rise, modalTransitionFor(null, you, forward = false, reducedMotion = false))
        assertEquals(ShellTransition.Fall, modalTransitionFor(you, null, forward = true, reducedMotion = false))
        // Inside the modal stack: the X axis, with the old page opaque under the new one (no tab layer bleed).
        assertEquals(ShellTransition.ForwardOver, modalTransitionFor(you, page, forward = true, reducedMotion = false))
        assertEquals(ShellTransition.BackwardOver, modalTransitionFor(page, you, forward = false, reducedMotion = false))
    }

    @Test
    fun navigatorMovesFeedTheTransitions() {
        val navigator = AppNavigator()
        navigator.push(Destination.Pulse())
        assertEquals(ShellTransition.Forward, shellTransitionFor(navigator.lastMove, false))
        navigator.pop()
        assertEquals(ShellTransition.Backward, shellTransitionFor(navigator.lastMove, false))
        navigator.selectTab(com.thesis.mobile.ui.navigation.ShellTab.Names)
        assertEquals(ShellTransition.FadeThrough, shellTransitionFor(navigator.lastMove, false))
        navigator.push(Destination.DeepDiveRunning("AAPL"))
        navigator.replaceTop(Destination.Report("rep-1", "AAPL"))
        assertEquals(ShellTransition.Crossfade, shellTransitionFor(navigator.lastMove, false))
    }

    // ---- 4.4 top bar: scroll under, hero → paper

    private fun chrome(scrolled: Float = 0f) = ScreenChrome(scrolled, collapseAfterPx = 21f)

    @Test
    fun barCollapsesOnlyOnceContentIsMoreThan8dpUnderIt() {
        val chrome = chrome()
        assertFalse(chrome.collapsed)
        chrome.onScrolled(consumedY = -20f, leftoverY = 0f)
        assertFalse("20 px is not past 8 dp (21 px)", chrome.collapsed)
        chrome.onScrolled(consumedY = -2f, leftoverY = 0f)
        assertTrue(chrome.collapsed)
        chrome.onScrolled(consumedY = 10f, leftoverY = 0f)
        assertFalse("back above the threshold", chrome.collapsed)
    }

    @Test
    fun reachingTheTopResetsAnyDrift() {
        val chrome = chrome(scrolled = 400f)
        assertTrue(chrome.collapsed)
        // The list could not take the whole upward drag: it is at its top, whatever the offset said.
        chrome.onScrolled(consumedY = 30f, leftoverY = 12f)
        assertEquals(0f, chrome.scrolledPx)
        assertFalse(chrome.collapsed)
        // Never below zero.
        chrome.onScrolled(consumedY = 50f, leftoverY = 0f)
        assertEquals(0f, chrome.scrolledPx)
    }

    @Test
    fun heroBandIsUnderTheBarsUntilTheyCollapse() {
        val chrome = chrome()
        assertFalse("no hero declared", chrome.overHero)
        chrome.heroBand = true
        assertTrue(chrome.overHero)
        chrome.onScrolled(consumedY = -100f, leftoverY = 0f)
        assertFalse("collapsed: paper palette, theme status bar", chrome.overHero)
        chrome.onScrolled(consumedY = 100f, leftoverY = 1f)
        assertTrue(chrome.overHero)
    }

    @Test
    fun aScreenWithItsOwnBarReportsItsOwnCollapse() {
        val chrome = chrome(scrolled = 500f)
        chrome.heroBand = true
        chrome.ownCollapsed = false
        assertFalse("the screen says it has not collapsed, whatever the scroll", chrome.collapsed)
        assertTrue(chrome.overHero)
        chrome.ownCollapsed = true
        assertFalse(chrome.overHero)
    }

    @Test
    fun scrollOffsetSurvivesSaveAndRestore() {
        val saver = ScreenChrome.saver(collapseAfterPx = 21f)
        val chrome = chrome()
        chrome.onScrolled(consumedY = -300f, leftoverY = 0f)
        val saved = with(saver) { androidx.compose.runtime.saveable.SaverScope { true }.save(chrome) }!!
        val restored = saver.restore(saved)!!
        assertEquals(300f, restored.scrolledPx)
        assertTrue(restored.collapsed)
    }

    // ---- 4.5 predictive back

    @Test
    fun previewFollowsTheGestureOnTheClosingPageOnly() {
        val preview = BackPreview()
        preview.start("e7")
        preview.update(0.4f, BackSwipeEdge.Right)
        assertEquals("e7", preview.entryId)
        assertEquals(0.4f, preview.progress)
        assertEquals(BackSwipeEdge.Right, preview.edge)
        preview.update(1.6f, BackSwipeEdge.Right)
        assertEquals("progress is clamped", 1f, preview.progress)
    }

    @Test
    fun committedPreviewLastsUntilTheLeavingPageIsGone() {
        val preview = BackPreview()
        preview.start("e7")
        preview.update(0.8f, BackSwipeEdge.Left)
        // The pop took e7 off screen: it keeps its transform into its exit transition.
        preview.commit(CoroutineScope(Dispatchers.Unconfined), stillOnScreen = false)
        assertEquals("e7", preview.entryId)
        assertEquals(0.8f, preview.progress)
        // Another page leaving does not end it.
        preview.onLeft("e3")
        assertEquals("e7", preview.entryId)
        // e7's exit ran and it left the composition: the preview is over (a page that comes back is full size).
        preview.onLeft("e7")
        assertNull(preview.entryId)
        assertEquals(0f, preview.progress)
    }

    @Test
    fun aNewGestureOnAnotherPageStartsFromFullSize() {
        val preview = BackPreview()
        preview.start("e7")
        preview.update(0.5f, BackSwipeEdge.Left)
        preview.start("e9")
        assertEquals("e9", preview.entryId)
        assertEquals(0f, preview.progress)
    }
}
