package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.TrustMetadataView
import com.thesis.mobile.model.TrustThesisDriftView
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
        val op = m.table.rows.first { it.label == ResearchCopy.ROW_OPERATING }
        assertEquals(Fmt.bpsFromPoints(0.5), op.delta)
        // The result leads with its basis, so each figure in the title has a period (C1).
        assertTrue(m.headline!!.startsWith("FY2025 vs FY2024: revenue up"))
        assertTrue(m.headline!!.contains("operating margin"))
        // Header row 2 is the form only (the build dates are in the deck), so the columns fit a phone.
        assertEquals(listOf(ResearchCopy.FORM_10K, ResearchCopy.FORM_10K), m.table.columns.map { it.filing })
        assertTrue(m.deck.contains("12 Nov"))
        // The basis is in the title and the table header, not repeated in the deck.
        assertEquals(ResearchCopy.basis("FY2025", "FY2024", sameQuarter = false), m.table.labelHeader)
        assertFalse(m.deck.contains("FY2025"))
    }

    @Test
    fun keyFiguresHeadlineSaysFlatUpOrDown() {
        // Words, not notation: "up 50 bps", never "+50 bps", in a sentence.
        assertEquals("Revenue flat, operating margin up 50 bps", ResearchCopy.compareReportsHeadline(0.01, 50.0))
        assertEquals("Revenue up 6.4%, operating margin flat", ResearchCopy.compareReportsHeadline(6.4, 0.0))
        assertEquals("Revenue down 3.0%", ResearchCopy.compareReportsHeadline(-3.0, null))
        assertEquals("Operating margin down 20 bps", ResearchCopy.compareReportsHeadline(null, -20.0))
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
    fun aNameWhoseReportDidNotLoadSaysSoAndIsNotOfferedABuild() {
        // MSFT has a report, but neither the cache nor the server gave it back: "Couldn't load", not "No report yet".
        val failed = state.copy(summaries = state.summaries + ("MSFT" to null), errors = mapOf("MSFT" to "Could not reach Thesis."))
        val cols = compareNameColumns(failed, emptyMap())
        val msft = cols.first { it.ticker == "MSFT" }
        val nvda = cols.first { it.ticker == "NVDA" }
        assertTrue(msft.loadFailed)
        assertFalse(msft.hasReport)
        assertFalse("no report, no error: a build is offered", nvda.loadFailed)
        val table = compareNamesTable(cols)
        assertTrue(table.columns.any { it.period == "MSFT\n${ResearchCopy.COLUMN_LOAD_FAILED}" })
        assertTrue(table.columns.any { it.period == "NVDA\n${ResearchCopy.NO_REPORT_YET}" })
        assertEquals("Couldn’t load the MSFT report.", ResearchCopy.columnsLoadFailed(listOf("MSFT")))
        assertEquals("Couldn’t load the MSFT, NVDA and AMD reports.", ResearchCopy.columnsLoadFailed(listOf("MSFT", "NVDA", "AMD")))
    }

    @Test
    fun yearEndsNameTheColumnOnceKnown() {
        val cols = compareNameColumns(state, emptyMap(), mapOf("AAPL" to java.time.YearMonth.of(2025, 9)))
        val table = compareNamesTable(cols)
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
        val table = compareNamesTable(compareNameColumns(state, emptyMap()))
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
        val table = compareNamesTable(compareNameColumns(state, emptyMap()))
        assertTrue(table.columns[2].period.contains(ResearchCopy.NO_REPORT_YET))
        assertTrue(table.columns[0].subject)
        val op = table.rows.first { it.label == ResearchCopy.ROW_OPERATING }
        assertEquals(Fmt.pct((32.0 + 45.6) / 2, dp = 1), op.delta)
        assertEquals(ResearchCopy.MEDIAN, table.deltaHeader)
    }

    @Test
    fun compareNamesSourceNamesTheFilingAndOpensTheColumnsReport() {
        val columns = compareNameColumns(state, emptyMap())
        val aapl = columns.first { it.ticker == "AAPL" }
        var opened: Pair<String, String>? = null
        val src = compareNamesSource(aapl, NameMetric.Revenue, null) { id, t -> opened = id to t }
        assertEquals(ResearchCopy.FORM_ANNUAL, src.form)
        val link = src.evidence.single()
        assertEquals("Open the AAPL FY2025 report", link.label)
        assertFalse(link.external)
        link.onOpen()
        assertEquals(aapl.reportId to "AAPL", opened)
        // Without a way to open it, no link; the header carries no form line (Latest FY and the period say it).
        assertTrue(compareNamesSource(aapl, NameMetric.Revenue, null).evidence.isEmpty())
        assertTrue(compareNamesTable(columns).columns.all { it.filing == null })
    }

    @Test
    fun copyAsTableIsTabSeparatedWithPeriodAndFilingHeaderRows() {
        val tsv = compareNamesTsv(compareNameColumns(state, emptyMap()), fmt, zone)
        val lines = tsv.split("\n")
        assertEquals(listOf(ResearchCopy.METRIC, "AAPL", "MSFT", "NVDA", ResearchCopy.MEDIAN), lines[0].split("\t"))
        assertEquals(listOf(ResearchCopy.PERIOD, "FY2025", "FY2025", ResearchCopy.NO_REPORT_YET, ""), lines[1].split("\t"))
        // A summary names no form (a 20-F filer's annual report is not a 10-K): the line says "Annual filing".
        assertTrue(lines[2].startsWith(ResearchCopy.FILING + "\t" + ResearchCopy.FORM_ANNUAL))
        assertFalse(tsv.contains(ResearchCopy.FORM_10K))
        // No column has a value-discipline score here, so that row is left out (shownMetrics).
        assertEquals(3 + NameMetric.entries.size - 1, lines.size)
        lines.forEach { assertEquals(5, it.split("\t").size) }
        // Plain numbers a spreadsheet reads as numbers, the unit in the label; no report or no figure: empty.
        val revenue = lines.first { it.startsWith(metricTsvLabel(NameMetric.Revenue) + "\t") }.split("\t")
        assertEquals("Revenue (USD bn)", revenue[0])
        assertEquals("416.00", revenue[1])
        assertEquals("", revenue[3])
        val netCash = lines.first { it.startsWith(metricTsvLabel(NameMetric.NetCash) + "\t") }.split("\t")
        assertEquals("-40.00", netCash[1])
        assertFalse(tsv.contains(Fmt.MINUS))
        assertFalse(tsv.contains("$"))
        assertFalse(tsv.contains("\n\n"))
    }

    @Test
    fun noRowWearsTheMedianTintAndTheCaptionSaysWhatTheNextTapDoes() {
        val cols = compareNameColumns(state, emptyMap())
        // The kit's median row flag means a median; the median here is a column, so no row is tinted.
        assertTrue(compareNamesTable(sortColumns(cols, NameMetric.Operating)).rows.none { it.median })
        // Until a figure picks a row, a header tap sorts by the row the title speaks of.
        assertEquals(NameMetric.Operating, headlineMetric(cols))
        assertEquals(ResearchCopy.pickedRow(ResearchCopy.ROW_OPERATING), sortCaption(null, NameMetric.Operating))
        assertEquals(ResearchCopy.SORT_HINT, sortCaption(null, null))
        assertEquals(ResearchCopy.sortedBy(ResearchCopy.ROW_OPERATING), sortCaption(NameMetric.Operating, NameMetric.Operating))
        assertEquals(
            ResearchCopy.sortedThenPicked(ResearchCopy.ROW_OPERATING, ResearchCopy.ROW_GROSS),
            sortCaption(NameMetric.Operating, NameMetric.Gross),
        )
    }

    private fun drifted(r: DeepDiveReportView, comparableId: String?) = r.copy(
        changeSummary = DeepDiveChangeSummaryView(
            previousView = "Was a quality compounder", currentView = "Still one, at a fuller price",
            topChanges = listOf(DeepDiveTopChangeView("Buybacks", "up", "medium", "", "Each share owns more of the company.")),
        ),
        trustMetadata = comparableId?.let { TrustMetadataView(thesisDrift = TrustThesisDriftView("stable", "", comparableReportId = it)) },
    )

    @Test
    fun sinceTheLastReportShowsOnlyWhenTheOlderReportIsVerifiablyTheComparableOne() {
        val y23 = report("y23", "AAPL", fy(2022, 360e9, 29.0), fy(2023, 380e9, 29.0))
        val y24 = report("y24", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5))
        val y25 = report("y25", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5), fy(2025, 416e9, 32.0))
        fun since(a: DeepDiveReportView, b: DeepDiveReportView) = (compareReportsModel(a, b, fmt, zone) as ReportPair.Ready).model.since
        // No drift metadata: FY2023 with FY2025 would mislabel a one-year change as "since FY2023".
        assertNull(since(y23, drifted(y25, null)))
        // No drift metadata, consecutive fiscal years: shown.
        assertTrue(since(y24, drifted(y25, null)) != null)
        // The drift metadata names the comparable report: it must be the older one.
        assertTrue(since(y23, drifted(y25, "y23")) != null)
        assertNull(since(y24, drifted(y25, "y23")))
    }

    @Test
    fun bpsChangesComeFromTheShownPercentagesAndSharesKeepTheirMissingWord() {
        // 1.96% then 6.40% show as +2.0% and +6.4%: the change reads +440 bps (what the reader works out), not the
        // +444 bps of the unrounded inputs.
        assertEquals(4.4, shownPointsChange(1.96, 6.40)!!, 1e-9)
        assertEquals(4.5, shownPointsChange(2.04, 6.45)!!, 1e-9)
        assertNull(shownPointsChange(null, 6.4))
        assertEquals("15.2B", compactCount(15.2e9, Missing.NotDisclosed))
        assertEquals(Fmt.NOT_COMPUTED, compactCount(null, Missing.NotComputed))
        assertEquals(Fmt.NA, compactCount(null, Missing.NotMeaningful))
    }

    @Test
    fun compareReportsCopiesNumbersAndEveryFigureHasASource() {
        val older = report("old", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5))
        val newer = report("new", "AAPL", fy(2023, 380e9, 29.0), fy(2024, 391e9, 31.5), fy(2025, 416e9, 32.0))
        val m = (compareReportsModel(older, newer, fmt, zone) as ReportPair.Ready).model
        val lines = compareReportsTsv(m).split("\n")
        assertEquals(listOf(m.basis, "FY2024", "FY2025", ResearchCopy.CHANGE, ResearchCopy.CHANGE_UNIT), lines[0].split("\t"))
        val revenue = lines.first { it.startsWith("Revenue (USD bn)\t") }.split("\t")
        assertEquals(listOf("391.00", "416.00", "6.4", ResearchCopy.UNIT_PCT), revenue.drop(1))
        val op = lines.first { it.startsWith(ResearchCopy.withUnit(ResearchCopy.ROW_OPERATING, ResearchCopy.UNIT_PCT)) }.split("\t")
        assertEquals(listOf("31.5", "32.0", "50", ResearchCopy.UNIT_BPS), op.drop(1))
        assertFalse(compareReportsTsv(m).contains(Fmt.MINUS))
        m.table.rows.indices.forEach { r ->
            val src = compareReportsSource(m, r, 1)!!
            assertEquals(ResearchCopy.FORM_10K, src.form)
            assertEquals("FY2025", src.period)
        }
        assertEquals("FY2024", compareReportsSource(m, 0, 0)!!.period)
        var opened: String? = null
        val link = compareReportsSource(m, 0, 1) { opened = it }!!.evidence.single()
        assertEquals("Open the FY2025 report", link.label)
        link.onOpen()
        assertEquals("new", opened)
        assertNull(compareReportsSource(m, 0, 2))
        assertEquals(ResearchCopy.DERIVE_EPS, compareReportsSource(m, m.raw.indexOfFirst { it.metric == ReportMetric.Eps }, 1)!!.derivation)
    }

    @Test
    fun moreThanFourNamesKeepTheFirstFourAndNameTheRest() {
        val five = state.copy(
            tickers = listOf("AAPL", "MSFT", "NVDA", "COST", "AMZN"),
            summaries = state.summaries + mapOf("COST" to summary("COST", "Costco", 275e9, 3.6), "AMZN" to summary("AMZN", "Amazon", 640e9, 10.8)),
        )
        val cols = compareNameColumns(five, emptyMap())
        assertEquals(4, cols.size)
        assertFalse(cols.any { it.ticker == "AMZN" })
        assertEquals(listOf("AMZN"), leftOutNames(five))
        // Building the kit table must not throw (it takes at most four value columns).
        assertEquals(4, compareNamesTable(cols).columns.size)
        assertTrue(ResearchCopy.namesLeftOut(leftOutNames(five), 4).contains("AMZN"))
    }

    @Test
    fun valueDisciplineMedianIsTheMedianShareOfSignalsMet() {
        val discipline = { score: Int, n: Int -> 
            com.thesis.mobile.model.ValueDisciplineView(
                score = score, maxScore = n, availableSignals = n, completeness = "full", contextLabel = "", interpretation = "",
                doesNotProve = "", valueTrapWarning = com.thesis.mobile.model.ValueTrapWarningView(triggered = false, summary = ""),
            )
        }
        val cols = compareNameColumns(state, mapOf("AAPL" to discipline(3, 6), "MSFT" to discipline(4, 5)))
        val row = compareNamesTable(cols).rows.first { it.label == ResearchCopy.ROW_DISCIPLINE }
        // 3 of 6 and 4 of 5 are not on one basis: every cell and the median read as the share of signals met.
        assertEquals(Fmt.pct((0.5 + 0.8) / 2 * 100.0, dp = 0), row.delta)
        assertTrue(row.values.filter { it.isNotEmpty() }.all { it.endsWith("%") })
        assertEquals(NameMetric.entries, shownMetrics(cols))
        // On one basis the cells say "3 of 6" and the median says the same unit.
        val same = compareNamesTable(compareNameColumns(state, mapOf("AAPL" to discipline(3, 6), "MSFT" to discipline(4, 6))))
            .rows.first { it.label == ResearchCopy.ROW_DISCIPLINE }
        assertEquals("3.5 of 6", same.delta)
        assertTrue(same.values.filter { it.isNotEmpty() }.all { it.endsWith(" of 6") })
    }

    @Test
    fun theDisciplineRowIsLeftOutWhenNoColumnHasAScore() {
        // The shipped shape before a summary carries its report's score: never a row of "Not computed".
        val cols = compareNameColumns(state, emptyMap())
        assertFalse(NameMetric.Discipline in shownMetrics(cols))
        assertTrue(compareNamesTable(cols).rows.none { it.label == ResearchCopy.ROW_DISCIPLINE })
        assertFalse(compareNamesTsv(cols, fmt, zone).contains(ResearchCopy.ROW_DISCIPLINE_SIGNALS))
    }

    @Test
    fun twoReportDatesShareOneForm() {
        val thisYear = java.time.Instant.parse("2026-11-12T08:00:00Z")
        val lastYear = java.time.Instant.parse("2025-11-19T08:00:00Z")
        assertEquals("19 Nov 2025" to "12 Nov 2026", pairedDates(lastYear, thisYear, fmt, zone))
        assertEquals(fmt.shortDate(java.time.LocalDate.of(2026, 11, 12)), pairedDates(thisYear, thisYear, fmt, zone).second)
        assertFalse(pairedDates(thisYear, thisYear, fmt, zone).first!!.contains("2026"))
    }
}
