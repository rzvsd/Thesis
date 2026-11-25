package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.FilingMetricDeltaView
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
import java.time.Clock
import java.time.ZoneId
import java.time.ZonedDateTime

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
        // current, one, three and five years ago: the years in between are not in the payload, so they are left
        // out instead of drawn as empty slots under a year label.
        assertEquals(listOf(2020, 2022, 2024, 2025), five.years)
        assertFalse(five.consecutive)
        assertEquals(265e9, five.revenue.last()!!, 1.0)
        assertTrue(five.revenue.all { it != null })
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
        assertEquals("", model.labelHeader)
        // The narrow shape: now and the change, the reference period in the change header.
        val compact = deltaTableModel(tables[0], "10-K", compact = true)
        assertEquals(listOf("FY2025"), compact.columns.map { it.period })
        assertEquals("vs FY2024", compact.deltaHeader)
        assertEquals(listOf("$416B"), compact.rows.first().values)
        assertEquals("+6.4%", compact.rows.first().delta)
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
        assertTrue(titles.toString(), "The model range runs from $186 to $262" in titles)
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
        assertEquals("> \"Gross margin reached 46.9%.\" (Ch. 04 Financials, AAPL 10-K FY2025)", quote)
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
            DeepDiveCopy.modelRange, DeepDiveCopy.modelRangeCaption, DeepDiveCopy.priceInReport, DeepDiveCopy.yourValueGap("+3.9%"),
            DeepDiveCopy.convictionPro, DeepDiveCopy.deskPro, DeepDiveCopy.sampleNote, DeepDiveCopy.disclaimer,
        ) + DeepDiveCopy.feedbackOptions.map { it.second }
        strings.forEach { assertFalse(it, banned.containsMatchIn(it)) }
    }

    @Test
    fun axisAndHeadlineMoneyIsWhole() {
        assertEquals("$0", ClassicFormat.wholeMoney(0.0))
        assertEquals("$186", ClassicFormat.wholeMoney(185.6))
        assertEquals("$1.2K", ClassicFormat.wholeMoney(1204.0))
        assertEquals("$300B", ClassicFormat.wholeMoney(300e9))
        assertEquals("$50B", ClassicFormat.wholeMoney(50e9))
        assertEquals("$2.5B", ClassicFormat.wholeMoney(2.5e9))
        assertEquals("${Fmt.MINUS}$20", ClassicFormat.wholeMoney(-20.0))
        assertEquals("50%", ClassicFormat.wholePct(50.0))
        assertEquals("$180", ClassicFormat.rangeMoney(180.0))
        assertEquals("$241.50", ClassicFormat.rangeMoney(241.5))
    }

    private fun entries(report: com.thesis.mobile.model.DeepDiveReportView, plan: ClassicPlan): ClassicItems =
        ClassicItems().apply { addChapters(report, plan, ClassicContext(report.ticker, null, null, {})) }

    @Test
    fun chartCardsAreNumberedAcrossChapters() {
        // Five-year revenue (1), margins (2), the model range (3), sources per section (4): the next is 5.
        val items = entries(structured, classicPlan(structured, null, withDesk = false))
        assertEquals(5, items.nextFigure())
        assertTrue(items.entries.any { it.key.startsWith("ev-bars") })
    }

    @Test
    fun sampleHasNoModelRangeToDraw() {
        // The bundled asset has no valuation block, so the Value chapter keeps its static title and draws no range
        // bar; the range bar is pinned by the structured fixture (HANDOFF-D: waiver asked of the spec owner).
        assertNull(sample.valuation)
        val plan = classicPlan(sample, DeepDiveFixtures.sampleFiveYear, withDesk = false)
        assertTrue(ClassicChapter.Value in plan.chapters)
        assertEquals(DeepDiveCopy.valueTitle, chapterHead(sample, plan, ClassicChapter.Value).title)
        val keys = entries(sample, plan).entries.map { it.key }
        assertTrue(keys.toString(), keys.any { it.startsWith("fin-five") })
        assertFalse(keys.toString(), keys.any { it.startsWith("value-range") || it.startsWith("value-band") })
    }

    @Test
    fun filingPointsSkipWhatTheChapterAlreadySays() {
        val points = filingPoints(sample)
        val lede = chapterHead(sample, classicPlan(sample, null, withDesk = false), ClassicChapter.Filing).lede!!
        val said = "${lede.first} ${lede.second} ${sample.filingRead!!.whatChanged}".lowercase()
        assertTrue(points.isNotEmpty())
        points.forEach { assertFalse(it, said.contains(it.lowercase())) }
        assertTrue(sample.filingRead!!.topChanges.size > points.size)
    }

    @Test
    fun sampleHeroNamesTheCompany() {
        val shown = sampleWithIssuer(sample)
        assertEquals(DeepDiveCopy.sampleIssuer, shown.issuer?.name)
        assertEquals(structured, sampleWithIssuer(structured))
    }

    @Test
    fun modelKeysAreWordsOrHidden() {
        assertEquals("Discounted cash flow model", DeepDiveCopy.modelName("dcf_v2"))
        assertEquals("Reverse discounted cash flow model", DeepDiveCopy.modelName("reverse_dcf"))
        assertNull(DeepDiveCopy.modelName("xgb_2025"))
    }

    @Test
    fun journalMetaDoesNotRepeatTheTitle() {
        assertNull(journalEventLabel("Opposite case built", "opposite_case_generated"))
        assertEquals("Kill switch fired", journalEventLabel("Gross margin line crossed", "kill_switch_alert_fired"))
    }

    @Test
    fun killSwitchSubLineDoesNotRepeatTheSignal() {
        assertEquals("Line: Gross margin under 44%", killSwitchSub("gross_margin", "Gross margin under 44%"))
        assertEquals("Services growth · Line: under 5%", killSwitchSub("services_growth", "under 5%"))
        assertNull(killSwitchSub("", null))
    }

    @Test
    fun metricDeltasAreOneTablePerBasis() {
        val panel = com.thesis.mobile.model.MetricDeltaPanelView(
            title = "What moved",
            metrics = listOf(
                com.thesis.mobile.model.MetricDeltaItemView("Revenue", 70.0, 65.0, 7.7, "qoq", "improved"),
                com.thesis.mobile.model.MetricDeltaItemView("Revenue", 70.0, 60.0, 16.7, "yoy", "improved"),
                com.thesis.mobile.model.MetricDeltaItemView("Gross margin", 70.0, 68.0, 2.9, "qoq", "improved"),
            ),
        )
        val tables = metricDeltaTables(panel)
        assertEquals(listOf(DeepDiveCopy.basisQuarter, DeepDiveCopy.basisYear), tables.map { it.label })
        assertEquals(listOf("Revenue", "Gross margin"), tables[0].full.rows.map { it.label })
        assertEquals("on the quarter", tables[0].full.columns.last().filing)
        assertEquals(1, tables[0].compact.columns.size)
    }

    private val zone: ZoneId = ZoneId.of("Europe/Bucharest")
    private val fmt = Fmt(Clock.fixed(ZonedDateTime.of(2026, 11, 24, 7, 2, 0, 0, zone).toInstant(), zone), zone, is24h = true)

    @Test
    fun coherencePeriodReadsIsoDatesAndNeverShowsThemRaw() {
        assertEquals("October 2025", coherencePeriod("2025-10-01", "2025-10-31", fmt))
        assertEquals("February 2024", coherencePeriod("2024-02-01", "2024-02-29", fmt))
        assertEquals("1 to 15 Nov", coherencePeriod("2026-11-01", "2026-11-15", fmt))
        assertEquals("27 Oct 2025 to 2 Nov 2025", coherencePeriod("2025-10-27", "2025-11-02", fmt))
        // A timestamp that starts with a date reads the same.
        assertEquals("October 2026", coherencePeriod("2026-10-01T00:00:00Z", "2026-10-31T23:59:59Z", fmt))
        // What does not parse is shown as sent; nothing to show is null.
        assertEquals("Q3 to Q4", coherencePeriod("Q3", "Q4", fmt))
        assertNull(coherencePeriod("", " ", fmt))
        val iso = Regex("""\d{4}-\d{2}-\d{2}""")
        assertFalse(iso.containsMatchIn(coherencePeriod("2025-10-01", "2025-10-31", fmt)!!))
    }

    @Test
    fun rangeChartTitleSaysWhereThePriceSits() {
        assertEquals("Price in report is 6% above the model's base case", modelRangeTitle(205.0, 251.0, 228.0, 241.5))
        assertEquals("Price in report is 10% below the model's base case", modelRangeTitle(180.0, 260.0, 220.0, 198.0))
        assertEquals(DeepDiveCopy.rangeTitleAtBase, modelRangeTitle(205.0, 251.0, 228.0, 228.5))
        assertEquals(DeepDiveCopy.rangeTitleBelowBear, modelRangeTitle(205.0, 251.0, 228.0, 190.0))
        assertEquals(DeepDiveCopy.rangeTitleAboveBull, modelRangeTitle(205.0, 251.0, 228.0, 270.0))
        assertEquals(DeepDiveCopy.rangeTitleInside, modelRangeTitle(205.0, 251.0, null, 230.0))
        assertEquals("The model's base case is $228", modelRangeTitle(205.0, 251.0, 228.0, null))
        assertEquals(DeepDiveCopy.modelRangeCaption, modelRangeTitle(205.0, 251.0, null, null))
        val banned = Regex("""\b(upside|downside|target|cheap|expensive|attractive)\b""", RegexOption.IGNORE_CASE)
        listOf(
            modelRangeTitle(205.0, 251.0, 228.0, 241.5), DeepDiveCopy.rangeTitleAtBase, DeepDiveCopy.rangeTitleBelowBear,
            DeepDiveCopy.rangeTitleAboveBull, DeepDiveCopy.rangeTitleInside,
        ).forEach { assertFalse(it, banned.containsMatchIn(it)) }
    }

    @Test
    fun indicatorGroupSaysASharedPeriodOnce() {
        fun ind(period: String) = com.thesis.mobile.model.IndicatorView("profitability", "ROIC", 30.0, "pct", period, "")
        assertEquals("Profitability, FY2025" to false, indicatorGroupHead("Profitability", listOf(ind("2025-FY"), ind("FY2025"))))
        assertEquals("Growth" to true, indicatorGroupHead("Growth", listOf(ind("2025-FY"), ind("2025-Q4"))))
        assertEquals("Growth" to false, indicatorGroupHead("Growth", listOf(ind(""), ind(" "))))
    }

    @Test
    fun trustScorecardsAndRangeBandsAreDrawn() {
        val trust = com.thesis.mobile.model.TrustScorecardPanelView(
            title = "How far to trust it", freshnessState = "degraded", contradictionState = "none_found", evidenceCount = 14,
        )
        val empty = com.thesis.mobile.model.TrustScorecardPanelView(title = "Nothing stated")
        val report = structured.copy(visualPanels = structured.visualPanels + trust + empty)
        assertEquals(listOf(trust), trustScorecards(report))
        assertEquals(
            listOf("Freshness" to "Getting old", "Contradictions" to "None found", "Evidence" to "14 sources"),
            trustScorecardRows(trust),
        )
        assertTrue(ClassicChapter.Evidence in classicPlan(report, null, withDesk = false).chapters)
        val same = com.thesis.mobile.model.RangeBandPanelView(title = "Range", lowValue = 205.0, highValue = 251.0)
        val other = com.thesis.mobile.model.RangeBandPanelView(title = "Peers", lowValue = 150.0, highValue = 300.0)
        val open = com.thesis.mobile.model.RangeBandPanelView(title = "Open", lowValue = 150.0)
        assertEquals(listOf(other), rangeBands(listOf(same, other, open), 205.0 to 251.0))
        assertEquals(listOf(same, other), rangeBands(listOf(same, other, open), null))
    }

    @Test
    fun explainersAloneAreReadingNotesNotEvidence() {
        // The sample has education boxes and no sources: its last chapter is reading notes.
        val onlyExplainers = classicPlan(sample, DeepDiveFixtures.sampleFiveYear, withDesk = false)
        assertEquals(ClassicChapter.Reading, onlyExplainers.chapters.last())
        assertFalse(ClassicChapter.Evidence in onlyExplainers.chapters)
        assertEquals(DeepDiveCopy.readingTitle, chapterHead(sample, onlyExplainers, ClassicChapter.Reading).title)
        val bare = structured.copy(
            sections = emptyList(), investmentMemo = null, coverageTruth = null, trustMetadata = null, visualPanels = emptyList(),
        )
        val plan = classicPlan(bare, null, withDesk = false)
        assertTrue(plan.chapters.toString(), ClassicChapter.Reading in plan.chapters)
        assertFalse(ClassicChapter.Evidence in plan.chapters)
        assertEquals("How to read the numbers", chapterHead(bare, plan, ClassicChapter.Reading).title)
    }
}
