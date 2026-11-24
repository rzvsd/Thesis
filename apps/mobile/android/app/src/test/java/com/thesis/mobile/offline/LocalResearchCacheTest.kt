package com.thesis.mobile.offline

import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.SnapshotPoint
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
}
