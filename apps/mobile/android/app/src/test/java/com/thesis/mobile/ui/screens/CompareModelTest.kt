package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.Missing
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.ZoneId
import java.time.ZonedDateTime

/** Compare reports (5.17) and Compare names (5.26): filing keys, like for like, the key-figure table, TSV. */
class CompareModelTest {
    private val zone: ZoneId = ZoneId.of("UTC")
    private val fmt = Fmt(Clock.fixed(ZonedDateTime.of(2026, 11, 24, 9, 0, 0, 0, zone).toInstant(), zone), zone, is24h = true)

    private fun fy(year: Int, revenue: Double, op: Double, shares: Double = 15.0e9, ni: Double = revenue * 0.25) =
        FinancialHistoryRowView(
            period = "$year-FY", periodType = "annual", fiscalYear = year, revenue = revenue,
            grossMargin = 46.0, operatingMargin = op, netIncome = ni, freeCashFlow = revenue * 0.2,
            debtTotal = 100.0e9, cashAndEquivalents = 60.0e9, sharesOutstanding = shares,
        )

    private fun report(id: String, ticker: String, vararg rows: FinancialHistoryRowView) = DeepDiveReportView(
        reportId = id, ticker = ticker, generatedAt = "2026-11-12T08:00:00Z",
        signalValue = null, confidenceLabel = null, confidenceScore = null, sections = emptyList(),
        financialAnalysis = FinancialAnalysisView(annualHistory = rows.toList()),
    )

    @Test
    fun filingKeysReadEveryPeriodSpelling() {
        assertEquals(FilingKey(2025), filingKeyOf("2025-FY"))
        assertEquals(FilingKey(2025, 3), filingKeyOf("2025-Q3"))
        assertEquals(FilingKey(2025), filingKeyOf("FY2025"))
        assertEquals(FilingKey(2025), filingKeyOf("FY25"))
        assertEquals(FilingKey(2025, 3), filingKeyOf("Q3 FY25"))
        assertEquals(FilingKey(2025), filingKeyOf("FY Sep-25"))
        assertNull(filingKeyOf("latest"))
        assertNull(filingKeyOf(null))
    }

    @Test
    fun likeForLikeIsAnnualWithAnnualOrTheSameQuarter() {
        assertTrue(likeForLike(FilingKey(2024), FilingKey(2025)))
        assertTrue(likeForLike(FilingKey(2024, 3), FilingKey(2025, 3)))
        assertFalse(likeForLike(FilingKey(2025, 2), FilingKey(2025, 3)))
        assertFalse(likeForLike(FilingKey(2025), FilingKey(2025, 3)))
    }

    @Test
    fun reportsOfTwoCompaniesOrUnlikeFilingsAreRefused() {
        val a = report("a", "AAPL", fy(2025, 400e9, 30.0))
        val m = report("m", "MSFT", fy(2025, 250e9, 44.0))
        assertEquals(ReportPair.OtherCompanies, compareReportsModel(a, m, fmt, zone))
        val q = report("q", "AAPL", FinancialHistoryRowView(period = "2025-Q3", periodType = "quarterly", fiscalYear = 2025, fiscalQuarter = 3, revenue = 90e9))
        assertEquals(ReportPair.NotLikeForLike, compareReportsModel(a, q, fmt, zone))
        // The same filing twice is not a comparison either.
        assertEquals(ReportPair.NotLikeForLike, compareReportsModel(a, a.copy(reportId = "a2"), fmt, zone))
    }

    @Test
    fun keyFiguresPutTheOlderFilingFirstWithChanges() {
        val older = report("old", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5))
        val newer = report("new", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5), fy(2025, 416e9, 32.0))
        val ready = compareReportsModel(newer, older, fmt, zone) as ReportPair.Ready
        val m = ready.model
        assertEquals("AAPL", m.ticker)
        assertEquals(FilingKey(2024), m.older.key)
        assertEquals(FilingKey(2025), m.newer.key)
        assertEquals(listOf("FY2024", "FY2025"), m.table.columns.map { it.period })
        assertTrue(m.table.columns[1].subject)
        val revenue = m.table.rows.first { it.label == ResearchCopy.ROW_REVENUE }
        assertEquals(listOf(Fmt.money(391e9), Fmt.money(416e9)), revenue.values)
        assertEquals(Fmt.signedPct((416.0 / 391.0 - 1) * 100), revenue.delta)
        val op = m.table.rows.first { it.label == ResearchCopy.ROW_OPERATING }
        assertEquals(Fmt.bpsFromPoints(0.5), op.delta)
        assertTrue(m.headline!!.startsWith("Revenue up"))
    }

    @Test
    fun marginScaleReadsLegacyFractions() {
        val pct = listOf(fy(2025, 100.0, 30.0, ni = 25.0))
        assertEquals(1.0, marginScale(pct), 0.0)
        val fraction = listOf(fy(2025, 100.0, 0.30, ni = 25.0).copy(grossMargin = 0.46))
        assertEquals(100.0, marginScale(fraction), 0.0)
        val f = figuresFor(fraction)!!
        assertEquals(30.0, f.operatingMarginPct.value!!, 1e-9)
    }

    @Test
    fun figuresComputeGrowthAgainstTheYearBeforeAndSayWhyWhenMissing() {
        val f = figuresFor(listOf(fy(2024, 100.0, 30.0, shares = 10.0), fy(2025, 110.0, 31.0, shares = 9.5)))!!
        assertEquals(FilingKey(2025), f.key)
        assertEquals(10.0, f.revenueGrowthPct.value!!, 1e-9)
        assertEquals(-5.0, f.sharesChangePct.value!!, 1e-9)
        assertEquals(-40.0e9, f.netCash.value!!, 1.0)
        val single = figuresFor(listOf(fy(2025, 110.0, 31.0)))!!
        assertNull(single.revenueGrowthPct.value)
        assertEquals(Missing.NotComputed, single.revenueGrowthPct.missing)
    }

    @Test
    fun medianNeedsTwoValues() {
        assertNull(median(listOf(1.0)))
        assertEquals(2.0, median(listOf(3.0, 1.0, 2.0))!!, 0.0)
        assertEquals(2.5, median(listOf(4.0, 1.0, 2.0, 3.0))!!, 0.0)
        assertEquals(1.5, median(listOf(1.0, Double.NaN, 2.0))!!, 0.0)
    }

    private fun summary(ticker: String, company: String, rev: Double, op: Double) = ReportSummaryView(
        reportId = "s-$ticker", ticker = ticker, companyName = company, generatedAt = "2026-11-12T08:00:00Z",
        filingPeriod = "2025-FY", verdict = null, changeSummary = null,
        annualHistory = listOf(fy(2024, rev / 1.1, op), fy(2025, rev, op)),
    )

    private val state = CompareNamesState(
        tickers = listOf("AAPL", "MSFT", "NVDA"),
        summaries = mapOf(
            "AAPL" to summary("AAPL", "Apple", 416e9, 32.0),
            "MSFT" to summary("MSFT", "Microsoft", 281e9, 45.6),
            "NVDA" to null,
        ),
        isLoading = false,
    )

    @Test
    fun sortingByAColumnPutsGapsLastAndKeepsTiesInOrder() {
        val cols = compareNameColumns(state, emptyMap())
        assertEquals(listOf("AAPL", "MSFT", "NVDA"), sortColumns(cols, null).map { it.ticker })
        assertEquals(listOf("MSFT", "AAPL", "NVDA"), sortColumns(cols, NameMetric.Operating).map { it.ticker })
        assertEquals(listOf("AAPL", "MSFT", "NVDA"), sortColumns(cols, NameMetric.Revenue).map { it.ticker })
    }

    @Test
    fun tableShowsNoReportYetAndTheMedian() {
        val table = compareNamesTable(compareNameColumns(state, emptyMap()), fmt, zone)
        assertTrue(table.columns[2].period.contains(ResearchCopy.NO_REPORT_YET))
        assertTrue(table.columns[0].subject)
        val op = table.rows.first { it.label == ResearchCopy.ROW_OPERATING }
        assertEquals(Fmt.pct((32.0 + 45.6) / 2, dp = 1), op.delta)
        assertEquals(ResearchCopy.MEDIAN, table.deltaHeader)
    }

    @Test
    fun copyAsTableIsTabSeparatedWithPeriodAndFilingHeaderRows() {
        val tsv = compareNamesTsv(compareNameColumns(state, emptyMap()), fmt, zone)
        val lines = tsv.split("\n")
        assertEquals(listOf(ResearchCopy.METRIC, "AAPL", "MSFT", "NVDA", ResearchCopy.MEDIAN), lines[0].split("\t"))
        assertEquals(listOf(ResearchCopy.PERIOD, "FY2025", "FY2025", ResearchCopy.NO_REPORT_YET, ""), lines[1].split("\t"))
        assertTrue(lines[2].startsWith(ResearchCopy.FILING + "\t" + ResearchCopy.FORM_10K))
        assertEquals(3 + NameMetric.entries.size, lines.size)
        lines.forEach { assertEquals(5, it.split("\t").size) }
        val revenue = lines.first { it.startsWith(ResearchCopy.ROW_REVENUE + "\t") }.split("\t")
        assertEquals(Fmt.money(416e9), revenue[1])
        assertEquals(Fmt.NOT_COMPUTED, revenue[3])
        assertFalse(tsv.contains("\n\n"))
    }
}
