package com.thesis.mobile.ui.today

import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.MarketTapeMoveView
import com.thesis.mobile.model.MarketTapeView
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The tape view model (marketTone by family, bps for rates, reading order) and the Pulse prose clean-up. */
class TapeAndTextTest {

    private fun move(id: String, label: String, family: MarketTapeFamily, value: Double, change: Double, pct: Double, unit: String) =
        MarketTapeMoveView(
            instrumentId = id, label = label, family = family, familyRaw = family.wire, value = value,
            previousValue = value - change, dailyChange = change, dailyChangePct = pct, unit = unit,
            direction = if (change > 0) "up" else "down", asOf = "2026-11-23", retrievedAt = null, sourceName = null, sourceUrl = null,
        )

    private val tape = MarketTapeView(
        asOf = "2026-11-23", coverageState = "complete", summary = null,
        indices = listOf(move("SP500", "S&P 500", MarketTapeFamily.CoreIndex, 5525.21, 40.44, 0.7373, "index")),
        crossAsset = listOf(
            move("VIXCLS", "VIX", MarketTapeFamily.Volatility, 17.43, 0.78, 4.2834, "index"),
            move("DGS10", "Treasury 10Y", MarketTapeFamily.Rates, 4.29, -0.03, -0.6944, "percent"),
            move("DCOILWTICO", "WTI", MarketTapeFamily.Commodity, 63.02, -1.14, -1.8423, "usd_per_barrel"),
            move("DTWEXBGS", "Nominal Broad Dollar Index", MarketTapeFamily.Currency, 120.84, 0.22, 0.1824, "index"),
            move("BAMLH0A0HYM2", "US High Yield OAS", MarketTapeFamily.Credit, 3.67, 0.04, 1.0782, "percent"),
        ),
    )

    @Test
    fun indicesAndCommoditiesAreTonedBySignTheRestStayNeutral() {
        val byId = TapeModel.lines(tape).associateBy { it.id }
        assertEquals(Tone.Favourable, byId.getValue("SP500").tone)
        assertEquals(Tone.Unfavourable, byId.getValue("DCOILWTICO").tone)
        // A rising VIX, a falling yield, a firmer dollar and a wider spread carry no verdict colour.
        assertEquals(Tone.Neutral, byId.getValue("VIXCLS").tone)
        assertEquals(Tone.Neutral, byId.getValue("DGS10").tone)
        assertEquals(Tone.Neutral, byId.getValue("DTWEXBGS").tone)
        assertEquals(Tone.Neutral, byId.getValue("BAMLH0A0HYM2").tone)
    }

    @Test
    fun readingOrderNamesLevelsAndChanges() {
        val lines = TapeModel.lines(tape)
        assertEquals(listOf("SP500", "DGS10", "VIXCLS", "DTWEXBGS", "DCOILWTICO", "BAMLH0A0HYM2"), lines.map { it.id })
        val spx = lines.first()
        assertEquals("S&P 500", spx.short)
        assertEquals("5,525.21", spx.level)
        assertEquals("+0.7%", spx.change)
        assertEquals("+40.44 · +0.7%", spx.delta)
        val ten = lines[1]
        assertEquals("10Y", ten.short)
        assertEquals("10-year Treasury yield", ten.name)
        assertEquals("4.29%", ten.level)
        assertEquals("−3 bps", ten.change)
        assertEquals("−3 bps", ten.delta)
        assertEquals("$63.02", lines.first { it.id == "DCOILWTICO" }.level)
        assertEquals("+4 bps", lines.first { it.id == "BAMLH0A0HYM2" }.change)
        assertEquals("Dollar", lines.first { it.id == "DTWEXBGS" }.short)
    }

    @Test
    fun copyAsTableIsTabSeparatedWithAHeader() {
        val rows = TapeModel.tsv(tape).lines()
        assertEquals("Instrument\tLevel\tChange\tChange %", rows.first())
        assertEquals("S&P 500\t5,525.21\t+40.44\t+0.7%", rows[1])
        assertEquals("10-year Treasury yield\t4.29%\t−3 bps\t−0.7%", rows[2])
        assertEquals("", TapeModel.tsv(null))
    }

    @Test
    fun cleanRemovesResidueAndMakesUnitsReadable() {
        assertEquals("AAPL filed a new 8-K.", PulseText.clean("AAPL filed a new 8-K (filing_posted)."))
        assertEquals("Treasury 10Y: 4.29% (25 Apr).", PulseText.clean("Treasury 10Y: 4.29 percent [medium] (2026-04-25)."))
        assertEquals("CPI-U All Items: 312.23 (Apr 2026).", PulseText.clean("CPI-U All Items: 312.23 index [high] (2026-04)."))
        assertEquals("Real GDP: 2.1% annualized (Q2 2026).", PulseText.clean("Real GDP: 2.1 annualized_percent [low] (2026-Q2)."))
        assertEquals("WTI Spot: \$63.02 a barrel.", PulseText.clean("WTI Spot: 63.02 usd_per_barrel."))
        assertEquals("Uncertainty flags for this cycle: market tape incomplete.", PulseText.clean("Uncertainty flags for this cycle: data_incomplete:market_tape."))
        assertEquals("", PulseText.clean(null))
    }

    @Test
    fun sentencesDoNotBreakOnInitialsOrAbbreviations() {
        assertEquals(
            listOf("The U.S. Treasury sold bills.", "Apple Inc. filed an 8-K.", "Yields fell."),
            PulseText.sentences("The U.S. Treasury sold bills. Apple Inc. filed an 8-K. Yields fell. Yields fell."),
        )
    }

    @Test
    fun numberedListsBecomeItemsWithoutTheirRepeatedSubject() {
        assertEquals(
            listOf("AAPL filed a new 8-K.", "MSFT filed a new 8-K.", "CPI update published."),
            PulseText.listItems(
                "1. AAPL - AAPL filed a new 8-K (filing_posted). 2. MSFT - MSFT filed a new 8-K (filing_posted). " +
                    "3. BLS_CPI_U_ALL_ITEMS - CPI update published (macro_release_published).",
            ),
        )
        assertNull(PulseText.listItems("Stocks rose. Yields fell 0.03 points."))
    }

    @Test
    fun coverageAndPipelineNotesAreSplitFromTheStory() {
        val (story, notes) = PulseText.splitCoverage(
            PulseText.clean(
                "US risk assets were broadly higher on the day. Sector leadership was unavailable in the approved free " +
                    "live path for this run. Coverage note: Sector ETF leadership is not available.",
            ),
        )
        assertEquals(listOf("US risk assets were broadly higher on the day."), story)
        assertEquals(2, notes.size)
        assertEquals("Sector ETF leadership is not available.", notes.last())
    }

    @Test
    fun pressureLevelsAndCoverageNotesAreNotStoryText() {
        assertEquals(
            "Macro pressure is elevated: CPI-U All Items, Treasury 10Y.",
            PulseText.clean("Macro pressure is elevated: CPI-U All Items (high), Treasury 10Y (medium)."),
        )
        val (story, notes) = PulseText.splitCoverage(PulseText.clean("Issuer filing coverage this cycle: AAPL, MSFT."))
        assertEquals(emptyList<String>(), story)
        assertEquals(listOf("Issuer filing coverage this cycle: AAPL, MSFT."), notes)
    }

    @Test
    fun aHeadlineIsShortenedAtAClauseNeverMidWord() {
        val line = "Stocks rose for a third day as Treasury yields eased and credit spreads tightened."
        assertEquals(
            listOf(line, "Stocks rose for a third day as Treasury yields eased.", "Stocks rose for a third day."),
            PulseText.headlineForms(line),
        )
        // The longest form that fits wins; nothing fits -> the shortest form, still a whole clause.
        assertEquals("Stocks rose for a third day as Treasury yields eased.", PulseText.fitHeadline(line) { it.length <= 60 })
        assertEquals(line, PulseText.fitHeadline(line) { true })
        assertEquals("Stocks rose for a third day.", PulseText.fitHeadline(line) { false })
        // Cuts that would leave almost nothing are not offered.
        assertEquals(listOf("Oil rose as supply fell."), PulseText.headlineForms("Oil rose as supply fell."))
        // A comma inside a number is not a clause boundary.
        assertEquals(
            listOf("The S&P 500 closed at 5,525.21 after a quiet session.", "The S&P 500 closed at 5,525.21."),
            PulseText.headlineForms("The S&P 500 closed at 5,525.21 after a quiet session."),
        )
    }

    @Test
    fun oneSentenceCutsAtAWordBoundary() {
        assertEquals("Short.", PulseText.oneSentence("Short. Second."))
        val long = "word ".repeat(40).trim() + "."
        val cut = PulseText.oneSentence(long, limit = 30)
        assertEquals("word word word word word word…", cut)
        assertEquals("sec.gov", PulseText.host("https://www.sec.gov/AAPL"))
    }
}
