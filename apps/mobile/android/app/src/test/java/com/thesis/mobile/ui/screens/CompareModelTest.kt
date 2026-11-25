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
        // The same filing twice is not a comparison either, and says so in its own words.
        assertEquals(ReportPair.SameFiling, compareReportsModel(a, a.copy(reportId = "a2"), fmt, zone))
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
        val op = m.table.rows.first { it.label == ResearchCopy.ROW_OPERATING_SHORT }
        assertEquals(Fmt.bpsFromPoints(0.5), op.delta)
        assertTrue(m.headline!!.startsWith("Revenue up"))
        assertTrue(m.headline!!.contains("operating margin"))
        // Header row 2 is the form only (the build dates are in the deck), so the columns fit a phone.
        assertEquals(listOf(ResearchCopy.FORM_10K, ResearchCopy.FORM_10K), m.table.columns.map { it.filing })
        assertTrue(m.deck.contains("12 Nov"))
        // The basis is said once, in the table header, not in the title or the deck.
        assertEquals(ResearchCopy.basis("FY2025", "FY2024", sameQuarter = false), m.table.labelHeader)
        assertFalse(m.deck.contains("FY2025"))
        assertFalse(m.headline!!.contains("FY2025"))
    }

    @Test
    fun keyFiguresHeadlineSaysFlatUpOrDown() {
        assertEquals("Revenue flat, operating margin +50 bps", ResearchCopy.compareReportsHeadline(0.01, "+50 bps"))
        assertEquals("Revenue down 3.0%", ResearchCopy.compareReportsHeadline(-3.0, null))
        assertEquals("Operating margin −20 bps", ResearchCopy.compareReportsHeadline(null, "−20 bps"))
        assertNull(ResearchCopy.compareReportsHeadline(null, null))
    }

    @Test
    fun periodsDisplayThroughTheFormatterNeverRaw() {
        assertEquals("FY2025", periodDisplay("2025-FY"))
        assertEquals("Q3 FY25", periodDisplay("2025-Q3"))
        assertEquals("FY2025", periodDisplay("FY2025"))
        assertNull(periodDisplay(" "))
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
    fun namesWithoutAReportGoAfterTheOnesWithFiguresButTheSubjectStaysFirst() {
        val s = state.copy(tickers = listOf("AAPL", "NVDA", "MSFT"))
        assertEquals(listOf("AAPL", "MSFT", "NVDA"), compareNameColumns(s, emptyMap()).map { it.ticker })
        val subjectWithout = state.copy(tickers = listOf("NVDA", "AAPL", "MSFT"))
        assertEquals(listOf("NVDA", "AAPL", "MSFT"), compareNameColumns(subjectWithout, emptyMap()).map { it.ticker })
    }

    @Test
    fun aNameWithNoReportHasBlankCellsAndTheHeadlineCountsOnlyNamesWithTheFigure() {
        val cols = compareNameColumns(state, emptyMap())
        val nvda = cols.first { it.ticker == "NVDA" }
        assertEquals("", cellText(nvda, NameMetric.Revenue))
        assertEquals("", cellText(nvda, NameMetric.Discipline))
        // Two of the three have an operating margin: "of the two", never "of the three".
        assertEquals("MSFT has the widest operating margin of the two", compareNamesHeadline(cols))
    }

    @Test
    fun yearEndsNameTheColumnOnceKnown() {
        val cols = compareNameColumns(state, emptyMap(), mapOf("AAPL" to java.time.YearMonth.of(2025, 9)))
        val table = compareNamesTable(cols, fmt, zone)
        assertTrue(table.columns[0].period.endsWith("FY Sep-25"))
        assertTrue(table.columns[1].period.endsWith("FY2025"))
    }

    @Test
    fun revenueChartIndexesToTheFirstYearEveryLineHas() {
        val s = CompareNamesState(
            tickers = listOf("AAPL", "MSFT", "COST", "NVDA"),
            summaries = mapOf(
                "AAPL" to summary("AAPL", "Apple", 400e9, 30.0).copy(
                    annualHistory = listOf(fy(2022, 300e9, 30.0), fy(2023, 320e9, 30.0), fy(2024, 360e9, 30.0), fy(2025, 400e9, 30.0)),
                ),
                "MSFT" to summary("MSFT", "Microsoft", 280e9, 45.0).copy(
                    annualHistory = listOf(fy(2023, 200e9, 45.0), fy(2024, 240e9, 45.0), fy(2025, 280e9, 45.0)),
                ),
                "COST" to summary("COST", "Costco", 275e9, 3.6).copy(
                    annualHistory = listOf(fy(2023, 240e9, 3.6), fy(2024, 255e9, 3.6), fy(2025, 275e9, 3.6)),
                ),
                "NVDA" to null,
            ),
            isLoading = false,
        )
        val r = revenueSeries(s, compareNameColumns(s, emptyMap()))
        // AAPL's FY2022 is not on the chart: MSFT and COST start in FY2023, so every line is 100 there.
        assertEquals(listOf(2023, 2024, 2025), r.years)
        assertEquals(2023, r.baseYear)
        assertEquals(listOf("FY2023", "FY2024", "FY2025"), r.labels)
        assertEquals(listOf("AAPL", "MSFT", "COST"), r.series.map { it.name })
        assertTrue(r.series.all { line -> line.values.all { it != null } })
        // Growth from FY2023: MSFT 1.40, AAPL 1.25, COST 1.15.
        assertEquals("MSFT", r.leader)
        assertEquals("MSFT grew revenue the most since fiscal 2023", ResearchCopy.chartTitle(r.leader, r.baseYear))
    }

    @Test
    fun revenueChartWithNoCommonYearHasNoLeader() {
        val s = CompareNamesState(
            tickers = listOf("AAPL", "MSFT"),
            summaries = mapOf(
                "AAPL" to summary("AAPL", "Apple", 400e9, 30.0).copy(annualHistory = listOf(fy(2021, 300e9, 30.0), fy(2022, 320e9, 30.0))),
                "MSFT" to summary("MSFT", "Microsoft", 280e9, 45.0).copy(annualHistory = listOf(fy(2024, 240e9, 45.0), fy(2025, 280e9, 45.0))),
            ),
            isLoading = false,
        )
        val r = revenueSeries(s, compareNameColumns(s, emptyMap()))
        assertTrue(r.years.isEmpty())
        assertNull(r.leader)
        assertEquals("Revenue over the years", ResearchCopy.chartTitle(r.leader, r.baseYear))
    }

    @Test
    fun hiddenColumnsAreThoseThatDoNotFitBesideTheLabels() {
        val table = compareNamesTable(compareNameColumns(state, emptyMap()), fmt, zone)
        // Every text 10 px a character; padding 20, column minimum 80: label 21 chars -> 230, capped at 42%.
        val measure = { text: String, _: androidx.compose.ui.text.TextStyle ->
            val lines = text.split('\n')
            TextWidth(lines.maxOf { it.length } * 10, text.split(' ', '\n').maxOf { it.length } * 10)
        }
        assertEquals(emptyList<Int>(), hiddenColumns(table, 2000, 80, 20, measure))
        val narrow = hiddenColumns(table, 400, 80, 20, measure)
        assertTrue(narrow.isNotEmpty())
        // The median (the delta column, index columns.size) is past the edge on a narrow phone.
        assertTrue(table.columns.size in narrow)
        assertTrue(0 !in narrow)
    }

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
        // No report: a blank cell, not "Not computed" (a gap on our side).
        assertEquals("", revenue[3])
        assertFalse(tsv.contains("\n\n"))
    }
}
