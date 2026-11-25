package com.thesis.mobile.ui.motion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * EntranceCoordinator / EntranceRegistry (docs/app-redesign/DESIGN-DIRECTION.md 4.3 rule 2, 6.2 M1): a key is
 * granted an entrance at most once, for as long as its back-stack entry lives, whatever happens to the screen's
 * composition (scroll-back, tab return, refresh, recreation). The composed behaviour (dispose and recompose) is
 * covered in design-preview's MotionBehaviourTest.
 */
class EntranceCoordinatorTest {

    private val none = EntranceCoordinator.NO_ENTRANCE

    @Test
    fun claimGrantsOrdersOnceInClaimOrder() {
        val c = EntranceRegistry().coordinator("home")
        assertEquals(0, c.claim("header"))
        assertEquals(1, c.claim("tape"))
        assertEquals(2, c.claim("names"))
        assertEquals(none, c.claim("header"))
        assertEquals(none, c.claim("tape"))
        assertTrue(c.hasSeen("names"))
        assertFalse(c.hasSeen("macro"))
    }

    @Test
    fun aKeyNeverReplaysAcrossManyDisposals() {
        val registry = EntranceRegistry()
        val first = registry.coordinator("home", resetKey = "issue-42").claim("header")
        assertEquals(0, first)
        // Every "return" (tab switch, scroll back, refresh, Activity recreation with the ViewModel alive) asks the
        // registry again for the same entry and issue: same coordinator, the key stays seen.
        repeat(50) {
            val again = registry.coordinator("home", resetKey = "issue-42")
            assertEquals(none, again.claim("header"))
        }
        assertEquals(1, registry.size)
    }

    @Test
    fun sameScopeAndResetKeyGiveTheSameCoordinator() {
        val registry = EntranceRegistry()
        val a = registry.coordinator("entry-1", "issue-1")
        assertSame(a, registry.coordinator("entry-1", "issue-1"))
        assertNotSame(a, registry.coordinator("entry-2", "issue-1"))
    }

    @Test
    fun newDataIdentityAnimatesAgain() {
        val registry = EntranceRegistry()
        val monday = registry.coordinator("pulse", "issue-mon")
        assertEquals(0, monday.claim("morning-line"))
        val tuesday = registry.coordinator("pulse", "issue-tue")
        assertNotSame(monday, tuesday)
        assertEquals(0, tuesday.claim("morning-line"))
        assertEquals(none, registry.coordinator("pulse", "issue-tue").claim("morning-line"))
    }

    @Test
    fun releasedEntryStartsFresh() {
        val registry = EntranceRegistry()
        registry.coordinator("entry-7").claim("row")
        registry.release("entry-7")
        assertEquals(0, registry.size)
        assertEquals(0, registry.coordinator("entry-7").claim("row"))
    }

    @Test
    fun retainOnlyDropsPoppedEntries() {
        val registry = EntranceRegistry()
        registry.coordinator("a").claim("x")
        registry.coordinator("b").claim("x")
        registry.retainOnly(listOf("b"))
        assertEquals(1, registry.size)
        assertEquals(none, registry.coordinator("b").claim("x"))
        assertEquals(0, registry.coordinator("a").claim("x"))
    }

    @Test
    fun windowClosesOnTheFrameClock() {
        val c = EntranceRegistry().coordinator("home")
        assertEquals(0, c.claim("a"))
        assertTrue(c.isOpenAt(10_000L))
        assertTrue(c.isOpenAt(10_000L + ThesisMotion.EntranceWindow))
        assertFalse(c.isOpenAt(10_001L + ThesisMotion.EntranceWindow))
        // Closed for good: later keys (scrolled in) appear at once, and earlier frames do not reopen it.
        assertEquals(none, c.claim("late"))
        assertFalse(c.isOpenAt(10_000L))
        assertTrue(c.hasSeen("late"))
    }

    @Test
    fun windowClosesWhenTheLastTickingItemLeavesEarly() {
        val c = EntranceRegistry().coordinator("home")
        assertEquals(0, c.claim("a"))
        assertEquals(1, c.claim("b"))
        assertTrue(c.isOpenAt(1_000L))
        c.tickerStarted()
        c.tickerStarted()
        c.tickerStopped() // "a" detached: "b" still keeps the clock
        assertEquals(2, c.claim("c"))
        c.tickerStopped() // the last one detached inside the window: nothing keeps the clock any more
        assertEquals(none, c.claim("late"))
        assertFalse(c.isOpenAt(1_001L))
    }

    @Test
    fun closeEndsTheWindow() {
        val c = EntranceRegistry().coordinator("home")
        c.close()
        assertEquals(none, c.claim("a"))
        assertTrue(c.hasPlayed)
    }

    @Test
    fun savedStateSurvivesProcessDeathForTheSameIssue() {
        val before = EntranceRegistry()
        before.coordinator("home", "issue-42").claim("header")
        before.coordinator("pulse", "issue-42") // opened, nothing claimed yet: not played
        val saved = before.saveState()

        val after = EntranceRegistry().apply { restoreState(saved) }
        assertEquals(none, after.coordinator("home", "issue-42").claim("header"))
        assertEquals(none, after.coordinator("home", "issue-42").claim("tape"))
        assertEquals(0, after.coordinator("pulse", "issue-42").claim("morning-line"))
    }

    @Test
    fun savedStateDoesNotBlockANewIssue() {
        val before = EntranceRegistry()
        before.coordinator("home", "issue-42").claim("header")
        val after = EntranceRegistry().apply { restoreState(before.saveState()) }
        assertEquals(0, after.coordinator("home", "issue-43").claim("header"))
    }

    @Test
    fun savedStateRoundTripsRestoredMarkersUntilUsed() {
        val first = EntranceRegistry()
        first.coordinator("home", null).claim("header")
        val second = EntranceRegistry().apply { restoreState(first.saveState()) }
        // A second process death before Home is shown again keeps the marker.
        val third = EntranceRegistry().apply { restoreState(second.saveState()) }
        assertEquals(none, third.coordinator("home", null).claim("header"))
    }

    @Test
    fun staggerDelayIsCappedAtEightSteps() {
        assertEquals(0, ThesisMotion.staggerDelay(0))
        assertEquals(ThesisMotion.StaggerStep * 3, ThesisMotion.staggerDelay(3))
        assertEquals(ThesisMotion.StaggerStep * ThesisMotion.StaggerMaxSteps, ThesisMotion.staggerDelay(20))
    }

    @Test
    fun rollDelayLeadsFromTheRightAndCapsAtFour() {
        assertEquals(0, ThesisMotion.rollDelay(0))
        assertEquals(ThesisMotion.RollStagger, ThesisMotion.rollDelay(1))
        assertEquals(ThesisMotion.RollStagger * ThesisMotion.RollStaggerCap, ThesisMotion.rollDelay(9))
    }
}
