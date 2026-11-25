package com.thesis.mobile.ui.screens.report

import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportHostModelTest {
    private val slop = 8

    private fun scroll(from: DockScroll, startY: Int, steps: List<Int>): DockScroll {
        var state = from
        var y = startY
        steps.forEach { dy ->
            y += dy
            state = ReportDockScroll.next(state, y, dy, slop)
        }
        return state
    }

    @Test
    fun dockHidesOnScrollDownAndShowsOnScrollUp() {
        assertFalse(ReportDockScroll.next(DockScroll(visible = true), scrollY = 400, dy = 30, slopPx = slop).visible)
        assertTrue(ReportDockScroll.next(DockScroll(visible = false), scrollY = 400, dy = -30, slopPx = slop).visible)
    }

    @Test
    fun aSlowReadingDragHidesTheDockOnceItsDistancePassesTheSlop() {
        // A reading drag: 4 px per frame, far under the slop per event.
        val afterTwo = scroll(DockScroll(visible = true), startY = 400, steps = List(2) { 4 })
        assertTrue(afterTwo.visible)
        val afterTen = scroll(DockScroll(visible = true), startY = 400, steps = List(10) { 4 })
        assertFalse(afterTen.visible)
        // And the same slowly back up shows it again.
        val back = scroll(afterTen, startY = 440, steps = List(10) { -4 })
        assertTrue(back.visible)
    }

    @Test
    fun aFlipInDirectionStartsTheDistanceOver() {
        // Down 6, up 6, down 6, ...: never 8 px in one direction, so the dock stays as it was.
        val jitter = scroll(DockScroll(visible = true), startY = 400, steps = List(20) { if (it % 2 == 0) 6 else -6 })
        assertTrue(jitter.visible)
        val hidden = scroll(DockScroll(visible = false), startY = 400, steps = List(20) { if (it % 2 == 0) -6 else 6 })
        assertFalse(hidden.visible)
    }

    @Test
    fun dockKeepsItsStateForSmallMovesAndShowsAtTheTop() {
        assertFalse(ReportDockScroll.next(DockScroll(visible = false), scrollY = 400, dy = 5, slopPx = slop).visible)
        assertTrue(ReportDockScroll.next(DockScroll(visible = true), scrollY = 400, dy = -5, slopPx = slop).visible)
        assertTrue(ReportDockScroll.next(DockScroll(visible = false, travel = 40), scrollY = 0, dy = 40, slopPx = slop).visible)
    }

    @Test
    fun aLongReadDoesNotPileUpDistance() {
        val far = scroll(DockScroll(visible = true), startY = 400, steps = List(500) { 4 })
        assertFalse(far.visible)
        // A short scroll up after a long read still shows the dock promptly.
        assertTrue(scroll(far, startY = 2400, steps = List(3) { -4 }).visible)
    }

    private fun note(reportId: String, text: String) =
        NoteTrailEntry(reportId = reportId, ticker = "AAPL", text = text, updatedAt = null, filingPeriod = null, verdict = null)

    @Test
    fun earlierNoteIsTheNewestNonEmptyNoteOfAnotherReport() {
        val trail = listOf(note("r3", "this one"), note("r2", "  "), note("r1", "older"))
        assertEquals("older", earlierNoteFor("r3", trail)?.text)
        assertEquals("this one", earlierNoteFor("r4", trail)?.text)
        assertNull(earlierNoteFor("r1", listOf(note("r1", "mine"))))
    }

    private fun item(id: String, ticker: String?, type: String, at: String) =
        ReportHistoryItem(reportId = id, jobId = "j$id", type = type, ticker = ticker, createdAt = at)

    @Test
    fun earlierReportsAreLikeForLikeAndNewestFirst() {
        val history = listOf(
            item("now", "AAPL", "deep_dive", "2026-11-01T00:00:00Z"),
            item("a", "aapl", "deep_dive", "2025-11-01T00:00:00Z"),
            item("b", "AAPL", "deep_dive", "2026-05-01T00:00:00Z"),
            item("b", "AAPL", "deep_dive", "2026-05-01T00:00:00Z"),
            item("c", "AAPL", "pulse", "2026-06-01T00:00:00Z"),
            item("d", "MSFT", "deep_dive", "2026-06-01T00:00:00Z"),
        )
        assertEquals(listOf("b", "a"), earlierReportsFor("now", "AAPL", history).map { it.reportId })
        assertEquals(emptyList<ReportHistoryItem>(), earlierReportsFor("now", null, history))
        assertEquals(emptyList<ReportHistoryItem>(), earlierReportsFor("now", " ", history))
    }

    @Test
    fun otherNamesLeaveOutTheSubjectAndDuplicates() {
        assertEquals(listOf("MSFT", "NVDA"), otherNamesFor("aapl", listOf("AAPL", " msft", "NVDA", "MSFT", "")))
        assertEquals(listOf("AAPL"), otherNamesFor(null, listOf("aapl")))
    }
}
