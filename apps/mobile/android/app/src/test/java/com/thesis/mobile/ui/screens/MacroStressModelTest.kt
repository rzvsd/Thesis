package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.ui.copy.MacroStressCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

class MacroStressModelTest {
    private val zone: ZoneId = ZoneId.of("UTC")
    private val clock: Clock = Clock.fixed(ZonedDateTime.of(2025, 11, 25, 9, 0, 0, 0, zone).toInstant(), zone)
    private val fmt = Fmt(clock, zone, is24h = true)

    private fun sub(id: String, score: Double?, raw: Double? = null, notes: String? = null, available: Boolean = true) =
        SentimentSubScoreView(
            inputName = id,
            provider = "official_macro",
            available = available,
            weight = 1.0,
            normalizedScore = score,
            rawValue = raw,
            notes = notes,
        )

    private fun snap(
        date: String,
        score: Double,
        subs: List<SentimentSubScoreView> = emptyList(),
        missing: List<String> = emptyList(),
        calculatedAt: String = "${date}T12:00:00Z",
    ) = SentimentSnapshotView(
        id = "s-$date",
        marketDate = date,
        score = score,
        label = "",
        subScores = subs,
        missingInputs = missing,
        calculatedAt = calculatedAt,
    )

    private fun build(history: List<SentimentSnapshotView>, range: Int = 30) =
        MacroStressModels.build(history.lastOrNull(), history, range, fmt)!!

    @Test
    fun `rising stress is Unfavourable and reads as a rise this week`() {
        val m = build(listOf(snap("2025-11-17", 40.0), snap("2025-11-20", 43.0), snap("2025-11-24", 46.0)))
        assertEquals(6.0, m.delta!!, 1e-9)
        assertEquals(Tone.Unfavourable, m.deltaTone)
        assertEquals("and rose 6 points this week.", m.changeClause)
        assertEquals(MacroStressCopy.VS_WEEK_AGO, m.deltaReference)
        assertEquals(Fmt.pts(6.0), m.deltaText)
        assertEquals("Stress is Balanced", m.leadClause)
    }

    @Test
    fun `falling stress is Favourable and a flat week is Neutral`() {
        val fall = build(listOf(snap("2025-11-17", 72.0), snap("2025-11-24", 61.0)))
        assertEquals(Tone.Favourable, fall.deltaTone)
        assertEquals("and fell 11 points this week.", fall.changeClause)

        val flat = build(listOf(snap("2025-11-17", 50.2), snap("2025-11-24", 50.0)))
        assertEquals(Tone.Neutral, flat.deltaTone)
        assertEquals("and held steady this week.", flat.changeClause)
    }

    @Test
    fun `without a reading a week back the change is against the previous reading, by date`() {
        val m = build(listOf(snap("2025-11-21", 50.0), snap("2025-11-24", 51.0)))
        assertEquals("and rose 1 point since Fri 21 Nov.", m.changeClause)
        assertEquals("vs Fri 21 Nov", m.deltaReference)
    }

    @Test
    fun `one reading has no change to compare`() {
        val m = build(listOf(snap("2025-11-24", 30.0)))
        assertNull(m.delta)
        assertNull(m.changeClause)
        assertEquals(Tone.Neutral, m.deltaTone)
        assertEquals(MacroStressCopy.chartTitleOne(30.0), m.chartTitle)
    }

    @Test
    fun `the x axis carries dates, oldest first, within the selected range`() {
        val history = listOf(
            snap("2025-11-24", 46.0),
            snap("2025-11-10", 38.0),
            snap("2025-11-17", 40.0),
            snap("2025-11-20", 43.0),
        )
        val m = build(history, range = 7)
        assertEquals(listOf("20 Nov", "24 Nov"), m.chart.xLabels)
        assertEquals(listOf(LocalDate.of(2025, 11, 20), LocalDate.of(2025, 11, 24)), m.chart.dates)

        val month = build(history, range = 30)
        assertEquals(listOf("10 Nov", "17 Nov", "20 Nov", "24 Nov"), month.chart.xLabels)
        assertEquals(listOf(38.0, 40.0, 43.0, 46.0), month.chart.series.single().values)
        assertEquals("Stress rose from 38 to 46 over 30 days", month.chartTitle)
    }

    @Test
    fun `one reading per date, the later calculation wins`() {
        val readings = MacroStressModels.readings(
            null,
            listOf(
                snap("2025-11-24", 46.0, calculatedAt = "2025-11-24T15:00:00Z"),
                snap("2025-11-24", 44.0, calculatedAt = "2025-11-24T09:00:00Z"),
                snap("not a date", 10.0),
            ),
        )
        assertEquals(1, readings.size)
        assertEquals(46.0, readings.single().score, 1e-9)
    }

    @Test
    fun `an unknown range falls back to 30 days`() {
        assertEquals(30, MacroStressModels.normalizeRange(45))
        assertEquals(90, MacroStressModels.normalizeRange(90))
    }

    @Test
    fun `the factor headline names the input that did most of the rise`() {
        val before = snap(
            "2025-11-21",
            45.0,
            listOf(sub("TREASURY_DAILY_10Y", 55.0), sub("BLS_UNEMPLOYMENT_RATE", 25.0), sub("EIA_WTI_SPOT", 55.0)),
        )
        val after = snap(
            "2025-11-24",
            55.0,
            listOf(sub("TREASURY_DAILY_10Y", 85.0), sub("BLS_UNEMPLOYMENT_RATE", 25.0), sub("EIA_WTI_SPOT", 55.0)),
        )
        val m = build(listOf(before, after))
        assertEquals("Treasury 10-year yield did most of the rise", m.factorHeadline)
        val treasury = m.factors.first { it.key == "TREASURY_DAILY_10Y" }
        assertEquals(30.0, treasury.change!!, 1e-9)
        assertEquals(Tone.Unfavourable, treasury.changeTone)
        assertEquals("+30 pts since Fri 21 Nov", treasury.changeText)
        assertEquals(MacroStressCopy.changeSince("Fri 21 Nov"), m.factorDeck)
    }

    @Test
    fun `with no change the headline names the heaviest input, or says pressure is even`() {
        assertEquals(
            "Consumer prices, CPI-U carries the most pressure",
            build(listOf(snap("2025-11-24", 55.0, listOf(sub("BLS_CPI_U_ALL_ITEMS", 85.0), sub("BEA_REAL_GDP", 25.0))))).factorHeadline,
        )
        assertEquals(
            MacroStressCopy.EVEN_PRESSURE,
            build(listOf(snap("2025-11-24", 55.0, listOf(sub("BLS_CPI_U_ALL_ITEMS", 55.0), sub("BEA_REAL_GDP", 55.0))))).factorHeadline,
        )
        assertEquals(MacroStressCopy.NO_FACTORS, build(listOf(snap("2025-11-24", 55.0))).factorHeadline)
    }

    @Test
    fun `missing inputs carry their reason, each once`() {
        val s = snap(
            "2025-11-24",
            50.0,
            listOf(sub("EIA_WTI_SPOT", null, available = false)),
            missing = listOf("BEA_REAL_GDP:stale_period", "EIA_WTI_SPOT:provider_error", "BEA_REAL_GDP:stale_period"),
        )
        val missing = MacroStressModels.missing(s)
        assertEquals(2, missing.size)
        assertEquals("Real GDP growth", missing[0].label)
        assertEquals(MacroStressCopy.missingReason("stale_period"), missing[0].reason)
        assertEquals("WTI crude oil, spot", missing[1].label)
        assertEquals(MacroStressCopy.missingReason("provider_error"), missing[1].reason)
    }

    @Test
    fun `an input reads its value and period in words`() {
        assertEquals("21 Nov", MacroStressModels.period("rates|fresh|10Y above 4.25% (2025-11-21).", fmt))
        assertEquals("Oct 2025", MacroStressModels.period("inflation|fresh|CPI rising (2025-10).", fmt))
        assertEquals("Q3 2025", MacroStressModels.period("growth|stale|GDP slowing (2025-Q3).", fmt))
        assertNull(MacroStressModels.period("no period here", fmt))
        val reading = MacroStressModels.reading(sub("TREASURY_DAILY_10Y", 85.0, raw = 4.4, notes = "x (2025-11-21)."), fmt)
        assertNotNull(reading)
        assertTrue(reading!!.endsWith(", 21 Nov"))
    }

    @Test
    fun `the readings table is newest first with toned changes`() {
        val m = build(listOf(snap("2025-11-20", 40.0), snap("2025-11-24", 46.0)))
        val table = m.table!!
        assertEquals(listOf("Mon 24 Nov", "Thu 20 Nov"), table.rows.map { it.label })
        assertEquals("+6", table.rows.first().delta)
        assertEquals(Tone.Unfavourable, table.rows.first().deltaTone)
        assertNull(table.rows.last().delta)
        assertEquals(MacroStressCopy.TABLE_CHANGE, table.deltaHeader)
    }

    @Test
    fun `no readings builds nothing`() {
        assertNull(MacroStressModels.build(null, emptyList(), 30, fmt))
    }
}
