package com.thesis.mobile.offline

import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.TAB_DATA_MAX_AGE_MS
import com.thesis.mobile.model.isFresh
import com.thesis.mobile.model.searchLocal
import com.thesis.mobile.model.snapshotDeltaSince
import com.thesis.mobile.model.toReportSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalResearchCacheTest {

    private fun row(year: Int, revenue: Double?) = FinancialHistoryRowView(
        period = "FY$year", periodType = "annual", fiscalYear = year, revenue = revenue, operatingMargin = 0.3
    )

    private val report = DeepDiveReportView(
        reportId = "rep-1",
        ticker = " aapl ",
        generatedAt = "2026-11-01T10:00:00Z",
        issuer = IssuerView("Apple Inc."),
        storyHeader = DeepDiveStoryHeaderView(
            headline = "Services now carries the margin",
            thesisSummary = "", whyNow = "", readerTakeaway = "", stanceLabel = ""
        ),
        changeSummary = DeepDiveChangeSummaryView(
            previousView = "10-K FY2024: hardware led",
            currentView = "10-K FY2025: services led",
            topChanges = listOf(DeepDiveTopChangeView("Services margin", "up", "high", "Mix", "Margin"))
        ),
        financialAnalysis = FinancialAnalysisView(annualHistory = (2018..2025).map { row(it, it * 1e9) }.reversed()),
        signalValue = null,
        confidenceLabel = null,
        confidenceScore = null,
        sections = emptyList()
    )

    @Test
    fun summaryKeepsWhatNameAndCompareNeed() {
        val summary = report.toReportSummary()
        assertEquals("AAPL", summary.ticker)
        assertEquals("Apple Inc.", summary.companyName)
        assertEquals("FY2025", summary.filingPeriod)
        assertEquals("Services now carries the margin", summary.verdict)
        assertEquals(listOf(2021, 2022, 2023, 2024, 2025), summary.annualHistory.map { it.fiscalYear })
    }

    @Test
    fun summaryRoundTripsThroughTheCacheCodec() {
        val summary = report.toReportSummary()
        assertEquals(summary, OfflineJsonCodec.decodeReportSummary(OfflineJsonCodec.encodeReportSummary(summary)))
        val bare = DeepDiveReportView(
            reportId = "rep-2", ticker = null, signalValue = null, confidenceLabel = null,
            confidenceScore = null, sections = emptyList()
        ).toReportSummary()
        assertEquals(bare, OfflineJsonCodec.decodeReportSummary(OfflineJsonCodec.encodeReportSummary(bare)))
        assertNull(OfflineJsonCodec.decodeReportSummary("{}"))
        assertNull(OfflineJsonCodec.decodeReportSummary("not json"))
    }

    @Test
    fun snapshotDeltaComparesWithTheReadingBeforeTheLastVisit() {
        val history = listOf(
            SnapshotPoint("AAPL", 100, "intact", 60.0, 0.9, null),
            SnapshotPoint("AAPL", 200, "intact", 62.0, 0.9, null),
            SnapshotPoint("MSFT", 150, "watch", 40.0, 0.5, null),
            SnapshotPoint("AAPL", 400, "watch", 55.0, 0.8, "rep-1"),
        )
        val current = history.last()
        val delta = snapshotDeltaSince(current, history, sinceMs = 250)
        assertEquals(200L, delta.previous?.takenAtMs)
        assertEquals(-7.0, delta.scoreChange!!, 1e-9)
        assertTrue(delta.stateChanged)

        val noHistory = snapshotDeltaSince(current, history, sinceMs = 50)
        assertNull(noHistory.previous)
        assertNull(noHistory.scoreChange)
        assertFalse(noHistory.stateChanged)
    }

    @Test
    fun localSearchFindsNamesReportsAndNoteText() {
        val history = listOf(
            ReportHistoryItem("r1", "j1", "deep_dive", "AAPL", "2026-10-01T10:00:00Z"),
            ReportHistoryItem("r2", "j2", "deep_dive", "AAPL", "2026-11-01T10:00:00Z"),
            ReportHistoryItem("r3", "j3", "pulse", null, "2026-11-02T10:00:00Z"),
        )
        val summaries = mapOf("r2" to report.copy(reportId = "r2").toReportSummary())
        val notes = listOf(
            NoteTrailEntry("r1", "AAPL", "Services margin is the whole case", null, "FY2025", null),
            NoteTrailEntry("r9", "MSFT", "", null, null, null),
        )
        val byTicker = searchLocal("aapl", listOf("AAPL", "MSFT"), history, summaries, notes)
        assertEquals(listOf("AAPL"), byTicker.names)
        assertEquals("newest report first", listOf("r2", "r1"), byTicker.reports.map { it.reportId })
        assertEquals(listOf("r1"), byTicker.notes.map { it.reportId })

        val byNote = searchLocal("margin", listOf("AAPL"), history, summaries, notes)
        assertEquals(listOf("r1"), byNote.notes.map { it.reportId })
        assertTrue(byNote.names.isEmpty() && byNote.reports.isEmpty())
        assertTrue(searchLocal("  ", listOf("AAPL"), history, summaries, notes).isEmpty)
    }

    @Test
    fun tabDataYoungerThanFiveMinutesIsFresh() {
        val now = 1_000_000_000L
        assertTrue(isFresh(now - 60_000, now))
        assertFalse(isFresh(now - TAB_DATA_MAX_AGE_MS, now))
        assertFalse("never fetched", isFresh(null, now))
        assertFalse("a clock that went back refetches", isFresh(now + 5_000, now))
    }
}
