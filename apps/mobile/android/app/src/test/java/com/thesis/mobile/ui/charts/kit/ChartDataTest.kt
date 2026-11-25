package com.thesis.mobile.ui.charts.kit

import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * Chart data models (M2): the line data as drawn, the readout words, "Show table", the draw-on registry and the
 * Macro stress regimes. Edge inputs: empty, one point, equal values, NaN.
 */
class ChartDataTest {

    private val fmt: (Double) -> String = { Fmt.number(it, 0) }
    private val change: (Double) -> String = { (if (it > 0) "+" else "") + Fmt.number(it, 0) }

    private fun line(vararg values: Double?, labels: List<String>? = null) = LineChartData(
        series = listOf(ChartSeries("Macro stress", values.toList(), subject = true)),
        xLabels = labels ?: values.indices.map { "${it + 1} Nov" },
    )

    @Test
    fun plottedValuesAreSanitisedAndPadded() {
        val d = LineChartData(
            series = listOf(ChartSeries("A", listOf(1.0, Double.NaN)), ChartSeries("B", listOf(Double.POSITIVE_INFINITY))),
            xLabels = listOf("a", "b", "c"),
        )
        assertEquals(3, d.count)
        assertEquals(listOf(1.0, null, null), d.plotted[0])
        assertEquals(listOf(null, null, null), d.plotted[1])
        assertFalse(d.isEmpty)
        assertEquals(0, d.primary)
    }

    @Test
    fun emptyDataIsEmpty() {
        assertTrue(LineChartData(emptyList(), emptyList()).isEmpty)
        assertTrue(line().isEmpty)
        assertTrue(line(Double.NaN, null).isEmpty)
        assertEquals(emptyList<Double?>(), LineChartData(emptyList(), emptyList()).primaryValues)
    }

    @Test
    fun dataEqualityIsByValue() {
        assertEquals(line(1.0, 2.0), line(1.0, 2.0))
        assertEquals(line(1.0, 2.0).hashCode(), line(1.0, 2.0).hashCode())
        assertFalse(line(1.0, 2.0) == line(1.0, 3.0))
    }

    @Test
    fun weekKeysNeedADatePerPoint() {
        val dates = (0..2).map { LocalDate.of(2025, 11, 22).plusDays(it.toLong()) }
        val d = LineChartData(listOf(ChartSeries("A", listOf(1.0, 2.0, 3.0))), listOf("a", "b", "c"), dates)
        assertEquals(3, d.weekKeys!!.size)
        val short = LineChartData(listOf(ChartSeries("A", listOf(1.0, 2.0, 3.0))), listOf("a", "b", "c"), dates.take(2))
        assertNull(short.weekKeys)
    }

    // --- readout ---------------------------------------------------------------------------------------------

    @Test
    fun readoutOfEmptyDataSaysNotComputed() {
        val r = ChartReadouts.readout(line(), fmt, change, nowLabel = "Mon 24 Nov")
        assertEquals(Fmt.NOT_COMPUTED, r.value)
        assertEquals("Mon 24 Nov", r.date)
        assertNull(r.change)
        assertNull(r.delta)
    }

    @Test
    fun readoutOfOnePointHasNoChange() {
        val r = ChartReadouts.readout(line(58.0), fmt, change)
        assertEquals("58", r.value)
        assertNull(r.change)
        val scrub = ChartReadouts.readout(line(58.0), fmt, change, scrubIndex = 5)
        assertEquals("58", scrub.value)
        assertNull(scrub.change)
    }

    @Test
    fun readoutAtRestIsTheLatestAgainstTheWindowStart() {
        val r = ChartReadouts.readout(line(null, 41.0, 50.0, 58.0, Double.NaN), fmt, change, nowLabel = "now")
        assertEquals("58", r.value)
        assertEquals("now", r.date)
        assertEquals("+17", r.change)
        assertEquals(17.0, r.delta!!, 1e-9)
    }

    @Test
    fun readoutOfEqualValuesIsAZeroChange() {
        val r = ChartReadouts.readout(line(50.0, 50.0, 50.0), fmt, change)
        assertEquals(0.0, r.delta!!, 0.0)
    }

    @Test
    fun scrubbingAGapSaysSoWithoutAChange() {
        val d = line(41.0, Double.NaN, 58.0)
        val r = ChartReadouts.readout(d, fmt, change, scrubIndex = 1)
        assertEquals(Fmt.NOT_COMPUTED, r.value)
        assertEquals("2 Nov", r.date)
        assertNull(r.change)
        val end = ChartReadouts.readout(d, fmt, change, scrubIndex = 99)
        assertEquals("58", end.value)
        assertEquals("+17", end.change)
    }

    @Test
    fun twoFingerCompareReadsTheWindow() {
        val d = line(40.0, 45.0, 50.0, 62.0)
        val r = ChartReadouts.readout(d, fmt, change, compare = 1..3)
        assertEquals("62", r.value)
        assertEquals("2 Nov to 4 Nov", r.date)
        assertEquals("+17", r.change)
        val wide = ChartReadouts.readout(d, fmt, change, compare = -3..40)
        assertEquals("1 Nov to 4 Nov", wide.date)
    }

    // --- Show table ------------------------------------------------------------------------------------------

    @Test
    fun chartTableListsNewestFirstWithHonestGaps() {
        val t = chartTable(listOf("FY23", "FY24", "FY25"), listOf(ChartSeries("Sales", listOf(1.0, Double.NaN, 3.0), subject = true)), fmt, "Fiscal year")!!
        assertEquals(listOf("FY25", "FY24", "FY23"), t.rows.map { it.label })
        assertEquals(listOf("3", Fmt.NOT_COMPUTED, "1"), t.rows.map { it.values[0] })
        assertTrue(t.columns[0].subject)
        assertEquals("Fiscal year\tSales\nFY25\t3\nFY24\tNot computed\nFY23\t1", t.toTsv())
    }

    @Test
    fun chartTableOfNothingIsNull() {
        assertNull(chartTable(emptyList(), emptyList(), fmt))
        assertNull(chartTable(listOf("a"), listOf(ChartSeries("A", listOf(Double.NaN))), fmt))
        assertNull(chartTable(emptyList(), listOf(ChartSeries("A", emptyList())), fmt))
    }

    @Test
    fun chartTableTakesAtMostTheTableColumns() {
        val many = (1..6).map { ChartSeries("S$it", listOf(it.toDouble())) }
        val t = chartTable(listOf("x"), many, fmt)!!
        assertEquals(CompareTableModel.MAX_COLUMNS, t.columns.size)
        assertEquals(1, chartTable(listOf("x"), many, fmt, newestFirst = false)!!.rows.size)
    }

    // --- legend ----------------------------------------------------------------------------------------------

    @Test
    fun legendOnlyForTwoOrMoreSeries() {
        assertTrue(legendFor(listOf(ChartSeries("A", listOf(1.0)))).isEmpty())
        val l = legendFor(listOf(ChartSeries("A", listOf(1.0)), ChartSeries("B", listOf(2.0), colorIndex = 3)), bars = true)
        assertEquals(listOf(0, 3), l.map { it.colorIndex })
        assertTrue(l.all { it.bar })
    }

    // --- draw-on once per data identity ----------------------------------------------------------------------

    @Test
    fun drawOnIsClaimedOncePerIdentity() {
        val r = ChartDrawOnRegistry()
        assertFalse(r.isSeen("macro/2025-11-24"))
        assertTrue(r.claim("macro/2025-11-24"))
        assertTrue(r.isSeen("macro/2025-11-24"))
        assertFalse(r.claim("macro/2025-11-24"))
        assertTrue(r.claim("macro/2025-11-25"))
    }

    @Test
    fun drawOnRegistryIsBounded() {
        val r = ChartDrawOnRegistry(capacity = 2)
        r.claim(1)
        r.claim(2)
        r.claim(3)
        assertFalse(r.isSeen(1))
        assertTrue(r.isSeen(2) && r.isSeen(3))
    }

    // --- Macro stress regimes --------------------------------------------------------------------------------

    @Test
    fun macroStressSegmentsCoverTheScaleWithTheThreeWords() {
        val s = macroStressSegments()
        assertEquals(0.0, s.first().from, 0.0)
        assertEquals(100.0, s.last().to, 0.0)
        assertTrue(s.zipWithNext().all { (a, b) -> a.to == b.from })
        assertEquals(listOf(Tone.Favourable, Tone.Neutral, Tone.Unfavourable), s.map { it.tone })
        assertEquals(listOf("Contained", "Balanced", "Elevated"), s.map { it.label })
        // Integer scores land in their regime: 35 Contained, 36 Balanced, 69 Balanced, 70 Elevated.
        val edges = s.drop(1).map { it.from }
        assertEquals(listOf(0, 1, 1, 2), listOf(35.0, 36.0, 69.0, 70.0).map { ChartMath.bandOf(it, edges) })
        assertEquals(3, macroStressBands().size)
    }
}
