package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.FilingMetricDeltaView
import com.thesis.mobile.preview.fixtures.DeepDiveFixtures
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The classic Deep Dive's data layer (WP-D): periods, figures, the five-year series, hero KPIs, chapters, quotes. */
class DeepDiveClassicModelTest {

    private val structured = DeepDiveFixtures.structured
    private val sample = DeepDiveFixtures.sample

    @Test
    fun periodsReadEveryForm() {
        assertEquals("Q4 FY25", ClassicFormat.periodLabel("2025-Q4"))
        assertEquals("FY2025", ClassicFormat.periodLabel("2025-FY"))
        assertEquals("FY2025", ClassicFormat.periodLabel("FY2025"))
        assertEquals(ParsedPeriod(2025, 3), ClassicFormat.parsePeriod("Q3 FY25"))
        assertEquals("fiscal 2025", ClassicFormat.periodWords("2025-FY"))
        assertEquals("10-K FY2025", ClassicFormat.filingLabel("10-K", "2025-FY"))
        assertEquals("TTM", ClassicFormat.periodLabel("TTM"))
        assertNull(ClassicFormat.periodLabel(" "))
    }

    @Test
    fun figuresGoThroughFmt() {
        assertEquals("$416B", ClassicFormat.value(416.2e9, "currency"))
        assertEquals("46.9%", ClassicFormat.value(46.9, "pct"))
        assertEquals("33.1×", ClassicFormat.value(33.1, "multiple"))
        assertEquals("${Fmt.MINUS}3.10M", ClassicFormat.count(-3.1e6))
        assertEquals(Fmt.NOT_DISCLOSED, ClassicFormat.value(null, "currency"))
        // No raw doubles: the old classic view printed 391035000000.00.
        assertFalse(ClassicFormat.plain(391_035_000_000.0).contains("000000"))
    }

    @Test
    fun marginChangesAreBasisPointsAndOtherChangesSignedPercents() {
        val margin = FilingMetricDeltaView("Gross margin", "2025-FY", "2024-FY", "pct", 46.9, 46.2, 0.7, "improved", "")
        val revenue = FilingMetricDeltaView("Revenue", "2025-FY", "2024-FY", "currency", 1.0, 1.0, -9.2, "weakened", "")
        assertEquals("+70 bps", ClassicFormat.change(margin))
        assertEquals("${Fmt.MINUS}9.2%", ClassicFormat.change(revenue))
        assertEquals(Tone.Favourable, ClassicFormat.tone("improved"))
        assertEquals(Tone.Unfavourable, ClassicFormat.tone("weakened"))
        assertEquals(DeltaBasis.Fiscal, ClassicFormat.basis(margin))
    }

    @Test
    fun splitLeadTakesTheFirstSentence() {
        assertEquals("One." to "", ClassicFormat.splitLead("One. "))
        val (lead, rest) = ClassicFormat.splitLead("Fiscal 2025 was a margin year. Revenue rose 6.4%.")
        assertEquals("Fiscal 2025 was a margin year.", lead)
        assertEquals("Revenue rose 6.4%.", rest)
    }

    @Test
    fun fiveYearFromHistoryReadsMarginFractionsAsPercents() {
        val five = FiveYearSeries.fromHistory(structured.financialAnalysis!!.annualHistory)!!
        assertEquals((2020..2025).toList(), five.years)
        assertEquals(46.9, five.grossMargin.last()!!, 1e-9)
        assertEquals("FY2020", five.labels.first())
        val (from, pct) = five.growthPct(five.revenue)!!
        assertEquals(2020, from)
        assertEquals(51.6, pct, 0.1)
    }

    @Test
    fun sampleFiveYearComesFromTheIndicatorTrends() {
        val five = DeepDiveFixtures.sampleFiveYear
        assertNotNull(five)
        five!!
        assertEquals(2025, five.years.last())
        assertEquals(FiveYearSeries.SPAN, five.years.size)
        assertEquals(265e9, five.revenue.last()!!, 1.0)
        assertNull("two years ago is not in the payload", five.revenue[five.years.indexOf(2023)])
        assertEquals(DeepDiveCopy.filingSource, five.source)
        assertNull(FiveYearSeries.fromIndicatorsJson(JSONObject("{}")))
    }

    @Test
    fun heroKpisPreferFiscalYearLinesWithPeriodAndReference() {
        val kpis = heroKpis(structured, null)
        assertEquals(4, kpis.size)
        assertEquals("Revenue, FY2025", kpis[0].label)
        assertEquals("$416B", kpis[0].value)
        assertEquals("+6.4%", kpis[0].delta)
        assertEquals("vs FY2024", kpis[0].reference)
        assertEquals("Operating margin, FY2025", kpis[1].label)
        assertEquals("+50 bps", kpis[1].delta)
        assertEquals(Tone.Unfavourable, kpis[2].deltaTone)
    }

    @Test
    fun sampleHeroUsesTheFiscalYearLines() {
        val kpis = heroKpis(sample, DeepDiveFixtures.sampleFiveYear)
        assertTrue(kpis.isNotEmpty())
        assertEquals(0, kpis.size % 2)
        assertEquals("Revenue, FY2025", kpis.first().label)
        assertEquals("vs FY2024", kpis.first().reference)
    }

    @Test
    fun heroKpisFallBackToTheAnnualHistory() {
        val kpis = heroKpis(structured.copy(filingRead = null), null)
        assertEquals("Revenue, FY2025", kpis.first().label)
        assertEquals("32.0%", kpis[1].value)
        assertEquals("+50 bps", kpis[1].delta)
    }

    @Test
    fun deltaTablesGroupByBasisAndHeadlineIsGenerated() {
        val tables = deltaTables(structured.filingRead!!.metricDeltas)
        assertEquals(listOf(DeltaBasis.Fiscal, DeltaBasis.Year), tables.map { it.basis })
        assertEquals("FY2024", tables[0].referencePeriod)
        assertEquals("Revenue up 6.4% in fiscal 2025", filingHeadline(structured.filingRead!!.metricDeltas))
        assertEquals(DeepDiveCopy.filingTitle, filingHeadline(emptyList()))
        val model = deltaTableModel(tables[0], "10-K")
        assertEquals(2, model.columns.size)
        assertTrue(model.columns[1].subject)
        assertEquals(listOf("$391B", "$416B"), model.rows.first().values)
    }

    @Test
    fun chaptersFollowTheContent() {
        assertEquals(
            listOf(
                ClassicChapter.Summary, ClassicChapter.Filing, ClassicChapter.Financials, ClassicChapter.Value,
                ClassicChapter.Risks, ClassicChapter.Evidence, ClassicChapter.Desk,
            ),
            classicPlan(structured, null, withDesk = true).chapters,
        )
        val samplePlan = classicPlan(sample, DeepDiveFixtures.sampleFiveYear, withDesk = false)
        assertTrue(ClassicChapter.Financials in samplePlan.chapters)
        assertTrue(ClassicChapter.Filing in samplePlan.chapters)
        assertFalse(ClassicChapter.Desk in samplePlan.chapters)
        assertNotNull(samplePlan.fiveYear)
        assertEquals(
            listOf(ClassicChapter.Findings, ClassicChapter.Evidence),
            classicPlan(DeepDiveFixtures.legacy, null, withDesk = false).chapters,
        )
    }

    @Test
    fun chapterTitlesAreGeneratedAndNeverAdvise() {
        val plan = classicPlan(structured, null, withDesk = true)
        val titles = plan.chapters.map { chapterHead(structured, plan, it).title }
        assertTrue(titles.toString(), "Revenue up 52% since FY2020" in titles)
        assertTrue(titles.toString(), "The model range runs from $186.00 to $262.00" in titles)
        assertTrue(titles.toString(), "2 lines would change the thesis" in titles)
        val banned = Regex("""\b(buy|sell|hold|upside|target|cheap|attractive)\b""", RegexOption.IGNORE_CASE)
        titles.forEach { assertFalse(it, banned.containsMatchIn(it)) }
        assertEquals(structured.storyHeader!!.readerTakeaway, chapterUpshot(structured, ClassicChapter.Summary))
        assertNull(chapterUpshot(structured, ClassicChapter.Risks))
    }

    @Test
    fun heroEyebrowAndBadges() {
        assertEquals("Deep Dive · from the 10-K for fiscal 2025", heroEyebrow(structured))
        assertEquals("Deep Dive · from the 10-Q for Q4 FY25", heroEyebrow(sample))
        val badges = heroBadges(structured, sample = false).map { it.text }
        assertEquals(listOf("Fresh", "Evidence 14 sources", "Confidence medium"), badges)
        assertEquals(DeepDiveCopy.sampleBadge, heroBadges(sample, sample = true).first().text)
    }

    @Test
    fun openSourcesKeepOnlyWebAddresses() {
        val sources = openSources(structured)
        assertTrue(sources.isNotEmpty())
        assertTrue(sources.all { it.url.startsWith("https://") })
        assertEquals(sources.size, sources.distinctBy { it.url }.size)
    }

    @Test
    fun quotesCarryTheirChapterAndFiling() {
        val quote = NoteQuotes.format("Gross margin  reached\n46.9%.", QuoteSource(4, "Financials", "aapl", "10-K FY2025"))
        assertEquals("> “Gross margin reached 46.9%.” (Ch. 04 Financials, AAPL 10-K FY2025)", quote)
        assertEquals(quote, NoteQuotes.append("  ", quote))
        assertEquals("Mine\n\n$quote", NoteQuotes.append("Mine\n", quote))
    }

    @Test
    fun scenarioInputsAreCheckedAsTyped() {
        assertEquals(10, ScenarioInput.years("10"))
        assertNull(ScenarioInput.years("0"))
        assertNull(ScenarioInput.years("31"))
        assertEquals(2.5, ScenarioInput.percent("2.5%")!!, 1e-9)
        assertEquals(-1.0, ScenarioInput.percent("${Fmt.MINUS}1")!!, 1e-9)
        assertEquals("2.5", ScenarioInput.fieldText(0.025))
        assertEquals(Triple(null, null, null), ScenarioInput.errors("", "", ""))
        assertEquals(DeepDiveCopy.errYears, ScenarioInput.errors("abc", "2", "8").first)
        assertEquals(DeepDiveCopy.errPercent, ScenarioInput.errors("10", "x", "8").second)
        assertEquals(DeepDiveCopy.errWaccAboveGrowth, ScenarioInput.errors("10", "3", "2").third)
    }

    @Test
    fun copyHasNoBannedWords() {
        val banned = Regex("""\b(buy|sell|hold|upside|downside|target|cheap|expensive|attractive|entry|exit|stop)\b""", RegexOption.IGNORE_CASE)
        val strings = listOf(
            DeepDiveCopy.modelRange, DeepDiveCopy.modelRangeTitle, DeepDiveCopy.priceInReport, DeepDiveCopy.modelValueVsPrice,
            DeepDiveCopy.convictionPro, DeepDiveCopy.sampleNote, DeepDiveCopy.disclaimer,
        ) + DeepDiveCopy.feedbackOptions.map { it.second }
        strings.forEach { assertFalse(it, banned.containsMatchIn(it)) }
    }
}
