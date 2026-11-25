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

    @Test
    fun dockHidesOnScrollDownAndShowsOnScrollUp() {
        assertFalse(ReportDockScroll.visibleAfter(visible = true, scrollY = 400, dy = 30, slopPx = slop))
        assertTrue(ReportDockScroll.visibleAfter(visible = false, scrollY = 400, dy = -30, slopPx = slop))
    }

    @Test
    fun dockKeepsItsStateForSmallMovesAndShowsAtTheTop() {
        assertFalse(ReportDockScroll.visibleAfter(visible = false, scrollY = 400, dy = 5, slopPx = slop))
        assertTrue(ReportDockScroll.visibleAfter(visible = true, scrollY = 400, dy = -5, slopPx = slop))
        assertTrue(ReportDockScroll.visibleAfter(visible = false, scrollY = 0, dy = 40, slopPx = slop))
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
