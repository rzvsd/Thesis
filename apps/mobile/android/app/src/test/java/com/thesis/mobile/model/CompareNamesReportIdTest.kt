package com.thesis.mobile.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Which report Compare names reads for each name (`compareNamesReportId`), followed or not. */
class CompareNamesReportIdTest {

    private val history = listOf(
        ReportHistoryItem("r-old", "j1", "deep_dive", "NVDA", "2026-09-01T10:00:00Z"),
        ReportHistoryItem("r-new", "j2", "deep_dive", "nvda", "2026-11-01T10:00:00Z"),
        ReportHistoryItem("p-1", "j3", "pulse", "NVDA", "2026-11-20T10:00:00Z"),
    )
    private val snapshots = listOf(
        ThesisMonitorSnapshotView(ticker = "AAPL", state = "intact", reason = "", score = 78.0, reportId = "r-aapl", updatedAt = "2026-11-20T10:00:00Z"),
    )

    @Test
    fun `a followed name reads its monitor snapshot's report`() {
        assertEquals("r-aapl", compareNamesReportId("AAPL", snapshots, history, openReportId = null))
    }

    @Test
    fun `a name you do not follow falls back to the open report, then to its newest deep dive`() {
        assertEquals("r-open", compareNamesReportId("NVDA", snapshots, history, openReportId = "r-open"))
        // A Pulse is not a Deep Dive; the newest Deep Dive wins, whatever the ticker's case.
        assertEquals("r-new", compareNamesReportId("NVDA", snapshots, history, openReportId = null))
    }

    @Test
    fun `a name with no report anywhere has none`() {
        assertNull(compareNamesReportId("TSLA", snapshots, history, openReportId = null))
    }
}
