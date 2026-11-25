package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Name model (5.11): notes trail order, the report action, filings figures, Since the last report, pager. */
class NameModelTest {

    private val fmt = Fmt(Clock.fixed(Instant.parse("2026-11-25T15:00:00Z"), ZoneOffset.UTC), ZoneOffset.UTC, is24h = true)

    private val reports = listOf(
        ReportHistoryItem("r2024", "j0", "deep_dive", "AAPL", "2024-11-04T13:00:00Z"),
        ReportHistoryItem("r2026", "j2", "deep_dive", "AAPL", "2026-11-02T13:00:00Z"),
        ReportHistoryItem("r2025", "j1", "deep_dive", "AAPL", "2025-11-05T13:00:00Z"),
        ReportHistoryItem("rmsft", "j9", "deep_dive", "MSFT", "2026-11-03T13:00:00Z"),
    )

    private val trail = listOf(
        NoteTrailEntry("r2024", "AAPL", "2024 note", "2026-01-10T00:00:00Z", "FY2024", "Holds."),
        NoteTrailEntry("r2025", "AAPL", "2025 note", "2025-11-06T00:00:00Z", "FY2025", "Holds, China caveat."),
    )

    private val summary = ReportSummaryView(
        reportId = "r2026", ticker = "AAPL", companyName = "Apple Inc.", generatedAt = "2026-11-02T13:00:00Z",
        filingPeriod = "FY2026", verdict = "Services carry margins.", changeSummary = null, annualHistory = emptyList(),
    )

    private val detail = NameDetailView(
        ticker = "AAPL", snapshot = null, delta = null, summary = summary, notesTrail = trail, alerts = emptyList(), reports = reports,
    )

    @Test
    fun `notes trail is newest report first, by report date not note date, and leaves other tickers out`() {
        val notes = nameNotes(detail)
        assertEquals(listOf("r2026", "r2025", "r2024"), notes.map { it.reportId })
        assertEquals("", notes[0].text)
        assertEquals("FY2026", notes[0].filing)
        assertEquals("Services carry margins.", notes[0].verdict)
        assertEquals("2025 note", notes[1].text)
    }

    @Test
    fun `the current report heads the trail even when an older report is dated later`() {
        val odd = detail.copy(reports = reports + ReportHistoryItem("r-late", "j7", "deep_dive", "AAPL", "2026-11-20T00:00:00Z"))
        assertEquals("r2026", nameNotes(odd).first().reportId)
        assertEquals("r-late", nameNotes(odd)[1].reportId)
    }

    @Test
    fun `carry forward is offered by the trail when the newest note is empty and an older one is not`() {
        val notes = nameNotes(detail)
        assertTrue(notes.first().text.isBlank())
        assertTrue(notes.drop(1).any { it.text.isNotBlank() })
    }

    @Test
    fun `a stored report opens and never builds`() {
        assertEquals(NameReportAction.Open("r2026"), nameReportAction(detail))
        val onlySnapshot = detail.copy(
            summary = null, reports = emptyList(),
            snapshot = ThesisMonitorSnapshotView("AAPL", "intact", "r", 0.7, reportId = "rs", updatedAt = "2026-11-25T00:00:00Z"),
        )
        assertEquals(NameReportAction.Open("rs"), nameReportAction(onlySnapshot))
        val onlyHistory = detail.copy(summary = null)
        assertEquals(NameReportAction.Open("r2026"), nameReportAction(onlyHistory))
    }

    @Test
    fun `build is offered only when no report exists`() {
        val none = NameDetailView("JPM", null, null, null, emptyList(), emptyList(), emptyList())
        assertEquals(NameReportAction.Build, nameReportAction(none))
        assertTrue(nameNotes(none).isEmpty())
    }

    private fun year(fy: Int, revenue: Double?, op: Double?, fcf: Double?, debt: Double?, cash: Double?, shares: Double?) =
        FinancialHistoryRowView(
            period = "FY$fy", periodType = "annual", fiscalYear = fy, revenue = revenue, operatingMargin = op,
            freeCashFlow = fcf, debtTotal = debt, cashAndEquivalents = cash, sharesOutstanding = shares,
        )

    @Test
    fun `filings figures compare the latest annual row with the one before, ignoring quarters`() {
        val rows = listOf(
            year(2026, 110.0, 0.32, 22.0, 30.0, 50.0, 95.0),
            year(2025, 100.0, 0.30, 25.0, 40.0, 30.0, 100.0),
            FinancialHistoryRowView(period = "Q1 FY2027", periodType = "quarterly", fiscalYear = 2027, fiscalQuarter = 1, revenue = 30.0),
        )
        val f = filingsFigures(rows)!!
        assertEquals("FY2026", f.period)
        assertEquals("FY2025", f.priorPeriod)
        assertEquals(0.10, f.growth!!, 1e-9)
        assertEquals(0.20, f.fcfMargin!!, 1e-9)
        assertEquals(20.0, f.netCash!!, 1e-9)
        assertEquals(-10.0, f.priorNetCash!!, 1e-9)
        assertEquals(-0.05, f.shareChange!!, 1e-9)

        val kpis = filingsKpis(f)
        assertEquals(6, kpis.size)
        assertTrue("every figure names its period", kpis.all { it.label.endsWith("FY2026") })
        assertEquals("+200 bps", kpis[2].delta)
        assertEquals(Tone.Favourable, kpis[2].deltaTone)
        assertEquals("−500 bps", kpis[3].delta)
        assertEquals("+10.0%", kpis[1].value)
        assertTrue(kpis.drop(1).all { it.reference?.contains("FY2025") == true })
    }

    @Test
    fun `missing inputs read as words, never as zero`() {
        val f = filingsFigures(listOf(year(2026, null, null, null, null, null, null)))!!
        assertNull(f.priorPeriod)
        val kpis = filingsKpis(f)
        assertEquals(Fmt.NOT_DISCLOSED, kpis[0].value)
        assertEquals(Fmt.NOT_COMPUTED, kpis[1].value)
        assertNull(filingsFigures(emptyList()))
    }

    @Test
    fun `the table shows at most four years with the latest as subject`() {
        val rows = (2022..2026).map { year(it, 100.0 + it, 0.3, 20.0, 10.0, 20.0, 100.0) }
        val table = filingsTable(filingsFigures(rows)!!)
        assertEquals(listOf("FY2023", "FY2024", "FY2025", "FY2026"), table.columns.map { it.period })
        assertTrue(table.columns.last().subject)
        assertTrue(table.toTsv().startsWith("Metric\tFY2023"))
    }

    @Test
    fun `since the last report maps up to three changes and dates both views`() {
        val changes = listOf("up", "down", "mixed", "watch").map { DeepDiveTopChangeView("t-$it", it, "high", "why", "matters $it") }
        val withChange = summary.copy(changeSummary = DeepDiveChangeSummaryView("before", "after", changes))
        val model = sinceLastReportModel(withChange, nameNotes(detail.copy(summary = withChange)), fmt, ZoneOffset.UTC)!!
        assertEquals(3, model.changes.size)
        assertEquals(listOf(true, false, null), model.changes.map { it.up })
        assertEquals("FY2026 · 2 Nov", model.currentFiling)
        assertEquals("FY2025 · 5 Nov 2025", model.previousFiling)
        assertNull(sinceLastReportModel(summary, emptyList(), fmt, ZoneOffset.UTC))
    }

    @Test
    fun `pager position and neighbours follow the board order`() {
        val order = listOf("MSFT", "AAPL", "NVDA")
        assertEquals(NamePager(2, 3), namePagerOf(order, "aapl"))
        assertEquals("MSFT" to "NVDA", nameNeighbours(order, "AAPL"))
        assertEquals(null to "AAPL", nameNeighbours(order, "MSFT"))
        assertNull(namePagerOf(order, "JPM"))
        assertNull(namePagerOf(listOf("AAPL"), "AAPL"))
    }
}
