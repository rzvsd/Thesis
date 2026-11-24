package com.thesis.mobile.model

import com.thesis.mobile.offline.OfflineJsonCodec
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * `market_tape` parsing on a real `/pulse/latest` payload: the 2026-04-25 issue produced by the Pulse pipeline
 * (`Project Note/Phase7/Milestones/M1/evidence/generated-2026-04-25/pulse-2026-04-25.json`), copied unchanged to
 * `src/test/resources/fixtures/pulse/`.
 */
class MarketTapeParserTest {

    private val fixture: JSONObject by lazy { JSONObject(readFixture("fixtures/pulse/pulse_latest_2026-04-25.json")) }

    @Test
    fun parsesEveryMoveOfTheRealIssueInServerOrder() {
        val tape = assertNotNullTape(MarketTapeParser.parse(fixture.optJSONObject("market_tape")))
        assertEquals("2026-04-25", tape.asOf)
        assertEquals("partial", tape.coverageState)
        assertEquals(listOf("SP500", "DJIA", "NASDAQCOM"), tape.indices.map { it.instrumentId })
        assertEquals(
            listOf("VIXCLS", "DGS10", "DGS2", "DCOILWTICO", "DTWEXBGS", "BAMLH0A0HYM2"),
            tape.crossAsset.map { it.instrumentId }
        )
        assertEquals(9, tape.moves.size)
    }

    @Test
    fun keepsLevelsChangesUnitsAndDates() {
        val tape = assertNotNullTape(MarketTapeParser.parse(fixture.optJSONObject("market_tape")))
        val spx = tape.moves.first { it.instrumentId == "SP500" }
        assertEquals("S&P 500", spx.label)
        assertEquals(5525.21, spx.value!!, 1e-9)
        assertEquals(40.44, spx.dailyChange!!, 1e-9)
        assertEquals(0.7373, spx.dailyChangePct!!, 1e-9)
        assertEquals("index", spx.unit)
        assertEquals("up", spx.direction)
        assertEquals("2026-04-25", spx.asOf)
        assertEquals("FRED S&P 500", spx.sourceName)
        assertEquals("https://fred.stlouisfed.org/series/SP500", spx.sourceUrl)

        val tenYear = tape.moves.first { it.instrumentId == "DGS10" }
        assertEquals("percent", tenYear.unit)
        assertEquals(4.29, tenYear.value!!, 1e-9)
        assertEquals("down", tenYear.direction)

        // The dollar index is in the tape (the old regex over prose never found it).
        val dxy = tape.moves.first { it.instrumentId == "DTWEXBGS" }
        assertEquals(MarketTapeFamily.Currency, dxy.family)
        assertEquals(120.84, dxy.value!!, 1e-9)
    }

    @Test
    fun familiesDriveColourNotInstrumentNames() {
        val tape = assertNotNullTape(MarketTapeParser.parse(fixture.optJSONObject("market_tape")))
        val byId = tape.moves.associateBy { it.instrumentId }
        assertEquals(MarketTapeFamily.CoreIndex, byId.getValue("SP500").family)
        assertEquals(MarketTapeFamily.Volatility, byId.getValue("VIXCLS").family)
        assertEquals(MarketTapeFamily.Rates, byId.getValue("DGS2").family)
        assertEquals(MarketTapeFamily.Commodity, byId.getValue("DCOILWTICO").family)
        assertEquals(MarketTapeFamily.Credit, byId.getValue("BAMLH0A0HYM2").family)
        // VIX, yields, the dollar and credit spreads are never green or red (principle 5).
        val neutral = tape.moves.filter { it.family.directionNeutral }.map { it.instrumentId }.toSet()
        assertEquals(setOf("VIXCLS", "DGS10", "DGS2", "DTWEXBGS", "BAMLH0A0HYM2"), neutral)
    }

    @Test
    fun theApiParserAndTheOfflineCacheKeepTheTape() {
        // OfflineJsonCodec round trip: what the app shows offline is the same tape.
        val tape = MarketTapeParser.parse(fixture.optJSONObject("market_tape"))
        val pulse = PulseReportView(
            reportId = fixture.getString("report_id"),
            generatedAt = fixture.getString("generated_at"),
            sections = emptyList(),
            cycleEnd = fixture.optString("cycle_end"),
            tape = tape
        )
        val decoded = OfflineJsonCodec.decodePulseReport(OfflineJsonCodec.encodePulseReport(pulse))
        assertEquals(tape, decoded?.tape)
    }

    @Test
    fun missingOrBrokenTapesAreNullNotErrors() {
        assertNull(MarketTapeParser.parse(null))
        assertNull(MarketTapeParser.parse(JSONObject()))
        assertNull(MarketTapeParser.parse(JSONObject("""{"indices": [], "cross_asset": []}""")))
        val partial = MarketTapeParser.parse(
            JSONObject(
                """{"as_of":"2026-11-24","indices":[{"instrument_id":"X","family":"core_index","direction":"up"},
                {"instrument_id":"SP500","label":"S&P 500","family":"new_family","value":"5000.5","daily_change_pct":null,
                 "direction":"UP"}],"cross_asset":"oops"}"""
            )
        )
        assertNotNull(partial)
        assertEquals("a move with no figure is dropped", listOf("SP500"), partial!!.moves.map { it.instrumentId })
        val move = partial.moves.single()
        assertEquals(5000.5, move.value!!, 1e-9)
        assertNull(move.dailyChangePct)
        assertEquals("up", move.direction)
        assertEquals(MarketTapeFamily.Unknown, move.family)
        assertTrue("unknown families stay neutral", move.family.directionNeutral)
        assertEquals("2026-11-24", move.asOf)
        assertFalse(partial.isEmpty)
    }

    private fun assertNotNullTape(tape: MarketTapeView?): MarketTapeView {
        assertNotNull("market_tape should parse", tape)
        return tape!!
    }

    /**
     * Test resources are on the classpath under Gradle's Android unit tests; design-preview stages only the
     * Kotlin sources, so fall back to the file next to the module.
     */
    private fun readFixture(path: String): String {
        javaClass.classLoader?.getResourceAsStream(path)?.use { return it.readBytes().toString(Charsets.UTF_8) }
        val candidates = listOf(
            File("src/test/resources/$path"),
            File("app/src/test/resources/$path"),
            File("../app/src/test/resources/$path"),
        )
        val file = candidates.firstOrNull { it.isFile }
            ?: error("fixture $path not found (cwd ${File(".").absolutePath})")
        return file.readText()
    }
}
