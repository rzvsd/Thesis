package com.thesis.mobile.ui.charts.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * Chart kit maths (M2, docs/app-redesign/DESIGN-DIRECTION.md 6.2): every input shape the screens can hand a chart
 * (no data, one point, equal values, NaN and infinities, gaps, negatives) gives finite geometry and never throws.
 */
class ChartMathTest {

    private fun assertFiniteScale(s: NiceScale) {
        assertTrue("min finite: $s", s.min.isFinite())
        assertTrue("max finite: $s", s.max.isFinite())
        assertTrue("step finite and positive: $s", s.step.isFinite() && s.step > 0.0)
        assertTrue("min < max: $s", s.min < s.max)
        assertTrue("ticks finite: $s", s.ticks.all { it.isFinite() })
        assertTrue("ticks inside: $s", s.ticks.all { it >= s.min - 1e-9 && it <= s.max + 1e-9 })
        assertTrue("fraction finite: $s", s.fraction(s.min).isFinite() && s.fraction(s.max).isFinite())
    }

    // --- niceScale -------------------------------------------------------------------------------------------

    @Test
    fun emptyInputGivesTheUnitScale() {
        assertEquals(NiceScale.Unit, ChartMath.niceScale(emptyList()))
        assertFiniteScale(ChartMath.niceScale(emptyList(), includeZero = true))
    }

    @Test
    fun onlyNaNAndInfinitiesAreTreatedAsEmpty() {
        val s = ChartMath.niceScale(listOf(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, null))
        assertEquals(NiceScale.Unit, s)
    }

    @Test
    fun onePointSitsInsideAFiniteScale() {
        val s = ChartMath.niceScale(listOf(58.0))
        assertFiniteScale(s)
        assertTrue(58.0 > s.min && 58.0 < s.max)
    }

    @Test
    fun equalValuesArePaddedSoTheLineSitsMidPlot() {
        val s = ChartMath.niceScale(List(12) { 50.0 })
        assertFiniteScale(s)
        assertTrue(s.fraction(50.0) in 0.2..0.8)
    }

    @Test
    fun allZerosGiveZeroToOne() {
        val s = ChartMath.niceScale(listOf(0.0, 0.0, 0.0))
        assertFiniteScale(s)
        assertEquals(0.0, s.min, 0.0)
        assertTrue(s.max > 0.0)
    }

    @Test
    fun equalNegativeValuesWithZeroKeepZeroOnTop() {
        val s = ChartMath.niceScale(listOf(-4.0, -4.0), includeZero = true)
        assertFiniteScale(s)
        assertTrue(s.max >= 0.0 && s.min <= -4.0)
        assertEquals(0.0, s.baseline, 0.0)
    }

    @Test
    fun niceTicksUseOneTwoFiveSteps() {
        val s = ChartMath.niceScale(listOf(233.7e9, 416.2e9), includeZero = true)
        assertFiniteScale(s)
        assertEquals(0.0, s.min, 0.0)
        val mantissa = s.step / Math.pow(10.0, Math.floor(Math.log10(s.step)))
        assertTrue("step ${s.step}", mantissa in listOf(1.0, 2.0, 5.0).map { it })
        assertTrue("about 4 ticks, got ${s.ticks.size}", s.ticks.size in 3..ChartMath.maxTicks(ChartMath.TICKS))
    }

    @Test
    fun fixedDomainIsKept() {
        val s = ChartMath.niceScale(listOf(41.0, 58.0), fixed = 0.0..100.0)
        assertEquals(0.0, s.min, 0.0)
        assertEquals(100.0, s.max, 0.0)
        assertEquals(listOf(0.0, 20.0, 40.0, 60.0, 80.0, 100.0), s.ticks)
    }

    @Test
    fun aBrokenFixedDomainFallsBackToTheData() {
        assertFiniteScale(ChartMath.niceScale(listOf(1.0, 2.0), fixed = 5.0..5.0))
        assertFiniteScale(ChartMath.niceScale(listOf(1.0, 2.0), fixed = 0.0..Double.POSITIVE_INFINITY))
    }

    @Test
    fun tinyAndHugeRangesStayFinite() {
        assertFiniteScale(ChartMath.niceScale(listOf(1e-12, 2e-12)))
        assertFiniteScale(ChartMath.niceScale(listOf(-1e15, 1e15)))
        assertFiniteScale(ChartMath.niceScale(listOf(0.1, 0.30000000000000004)))
    }

    @Test
    fun floatNoiseIsRoundedAwayInTicks() {
        val s = ChartMath.niceScale(listOf(0.0, 0.3))
        assertTrue(s.ticks.toString(), s.ticks.none { it.toString().length > 6 })
    }

    @Test
    fun niceStepOfBadInputIsOne() {
        assertEquals(1.0, ChartMath.niceStep(Double.NaN), 0.0)
        assertEquals(1.0, ChartMath.niceStep(0.0), 0.0)
        assertEquals(1.0, ChartMath.niceStep(-3.0), 0.0)
    }

    @Test
    fun lerpedScaleIsBetweenBothEnds() {
        val a = ChartMath.niceScale(listOf(0.0, 50.0))
        val b = ChartMath.niceScale(listOf(0.0, 100.0))
        val mid = a.lerpTo(b, 0.5f)
        assertTrue(mid.max > a.max && mid.max < b.max)
        assertEquals(b.ticks, mid.ticks)
    }

    // --- resample and lerp (range morph) ---------------------------------------------------------------------

    @Test
    fun resampleOfEmptyIsAllGaps() {
        val r = ChartMath.resample(emptyList(), 10)
        assertEquals(10, r.size)
        assertTrue(r.all { it.isNaN() })
        assertEquals(0, ChartMath.resample(listOf(1.0), 0).size)
    }

    @Test
    fun resampleOfOnePointIsFlat() {
        assertTrue(ChartMath.resample(listOf(58.0), 120).all { it == 58.0 })
        assertTrue(ChartMath.resample(listOf(Double.NaN), 5).all { it.isNaN() })
    }

    @Test
    fun resampleKeepsEndsAndInterpolates() {
        val r = ChartMath.resample(listOf(0.0, 10.0), 3)
        assertEquals(0.0, r[0], 1e-9)
        assertEquals(5.0, r[1], 1e-9)
        assertEquals(10.0, r[2], 1e-9)
        assertEquals(ChartMath.MORPH_POINTS, ChartMath.resample(listOf(1.0, 2.0, 3.0)).size)
    }

    @Test
    fun resampleBreaksAtGapsAndNaN() {
        val r = ChartMath.resample(listOf(1.0, Double.NaN, 3.0, null, 5.0), 9)
        assertEquals(1.0, r[0], 1e-9)
        assertTrue(r[1].isNaN())
        assertEquals(3.0, r[4], 1e-9)
        assertEquals(5.0, r[8], 1e-9)
        assertTrue(r.none { it.isInfinite() })
    }

    @Test
    fun lerpMovesAndKeepsGaps() {
        val l = ChartMath.lerp(doubleArrayOf(0.0, Double.NaN, 4.0), doubleArrayOf(10.0, 2.0, Double.NaN), 0.5f)
        assertEquals(5.0, l[0], 1e-9)
        assertEquals(2.0, l[1], 1e-9) // a gap before: the new value
        assertTrue(l[2].isNaN()) // a gap after: stays a gap
    }

    // --- indexed mode ----------------------------------------------------------------------------------------

    @Test
    fun indexedRebasesAtTheFirstCommonValue() {
        val out = ChartMath.indexed(listOf(listOf(50.0, 100.0, 150.0), listOf(null, 10.0, 30.0)))
        assertEquals(listOf(50.0, 100.0, 150.0), out[0])
        assertEquals(listOf(null, 100.0, 300.0), out[1])
    }

    @Test
    fun indexedWithoutACommonIndexUsesEachSeriesOwnStart() {
        val out = ChartMath.indexed(listOf(listOf(20.0, null), listOf(null, 5.0)))
        assertEquals(100.0, out[0][0]!!, 1e-9)
        assertEquals(100.0, out[1][1]!!, 1e-9)
    }

    @Test
    fun indexedSeriesWithNoPositiveValueBecomesGaps() {
        val out = ChartMath.indexed(listOf(listOf(-1.0, 0.0, Double.NaN), listOf(1.0, 2.0, 3.0)))
        assertTrue(out[0].all { it == null })
        assertEquals(listOf(100.0, 200.0, 300.0), out[1])
        assertEquals(emptyList<List<Double?>>(), ChartMath.indexed(emptyList()))
    }

    // --- labels, ticks, columns ------------------------------------------------------------------------------

    @Test
    fun thinnedLabelsAlwaysKeepTheLatest() {
        assertEquals(emptyList<Int>(), ChartMath.thinnedLabels(0, 10f, 40f))
        assertEquals(listOf(0), ChartMath.thinnedLabels(1, 10f, 40f))
        val shown = ChartMath.thinnedLabels(30, 10f, 45f)
        assertEquals(29, shown.last())
        assertTrue(shown.zipWithNext().all { (a, b) -> (b - a) * 10f >= 45f })
        assertEquals(listOf(9), ChartMath.thinnedLabels(10, 0f, 40f))
        assertEquals(listOf(9), ChartMath.thinnedLabels(10, Float.NaN, 40f))
        assertEquals((0 until 5).toList(), ChartMath.thinnedLabels(5, 100f, 40f))
    }

    @Test
    fun thinnedTicksKeepTheBottomAndNeverTouch() {
        assertEquals(emptyList<Int>(), ChartMath.thinnedTicks(0, 10f, 10f))
        assertEquals(listOf(0, 1, 2, 3, 4), ChartMath.thinnedTicks(5, 50f, 14f))
        assertEquals(listOf(0, 2, 4), ChartMath.thinnedTicks(5, 15f, 14f))
        assertEquals(listOf(0), ChartMath.thinnedTicks(5, 0f, 14f))
    }

    @Test
    fun spreadLabelsKeepsGapsAndBounds() {
        val out = ChartMath.spreadLabels(listOf(50f, 52f, 51f), minGap = 10f, top = 0f, bottom = 100f)
        val sorted = out.sorted()
        assertTrue(sorted.zipWithNext().all { (a, b) -> b - a >= 10f - 1e-3f })
        val low = ChartMath.spreadLabels(listOf(99f, 100f, 98f), minGap = 10f, top = 0f, bottom = 100f)
        assertTrue(low.all { it in 0f..100f })
        assertTrue(low.sorted().zipWithNext().all { (a, b) -> b - a >= 10f - 1e-3f })
        assertEquals(emptyList<Float>(), ChartMath.spreadLabels(emptyList(), 10f, 0f, 1f))
    }

    @Test
    fun spreadLabelsToleratesASqueezedRange() {
        // A bar narrower than its widest label (a 0 or 40 dp layout pass): bottom < top must not throw.
        val out = ChartMath.spreadLabels(listOf(5f, 30f), minGap = 12f, top = 26f, bottom = 14f)
        assertEquals(2, out.size)
        assertTrue(out.all { it.isFinite() && it >= 26f - 1e-3f })
    }

    @Test
    fun spreadSpansMovesLabelsOnlyByTheirOverlap() {
        // Far apart: nothing moves.
        assertEquals(listOf(50f, 300f), ChartMath.spreadSpans(listOf(50f, 300f), listOf(40f, 80f), 8f, 0f, 400f))
        // Overlapping: each pair keeps half of each width plus the gap, not the widest label.
        val out = ChartMath.spreadSpans(listOf(200f, 210f), listOf(40f, 120f), 8f, 0f, 400f)
        assertEquals(20f + 8f + 60f, out[1] - out[0], 1e-3f)
        assertEquals(200f, out[0], 1e-3f) // the first stays on its anchor
        assertEquals(288f, out[1], 1e-3f)
        // Against the right edge: shifted back inside, gap kept.
        val edge = ChartMath.spreadSpans(listOf(390f, 395f), listOf(40f, 40f), 8f, 0f, 400f)
        assertEquals(380f, edge[1], 1e-3f)
        assertEquals(332f, edge[0], 1e-3f)
        // Too narrow: no throw, every centre finite.
        val tight = ChartMath.spreadSpans(listOf(5f, 6f, 7f), listOf(40f, 40f, 40f), 8f, 0f, 20f)
        assertTrue(tight.all { it.isFinite() })
        assertFalse(ChartMath.fitsInRow(listOf(40f, 40f, 40f), 8f, 20f))
        assertTrue(ChartMath.fitsInRow(listOf(40f, 40f), 8f, 88f))
        assertEquals(emptyList<Float>(), ChartMath.spreadSpans(emptyList(), emptyList(), 8f, 0f, 1f))
    }

    @Test
    fun columnWidthIsCappedAndShared() {
        assertEquals(24f, ChartMath.columnWidth(100f, 24f), 1e-3f)
        assertEquals(7.2f, ChartMath.columnWidth(10f, 24f), 1e-3f)
        assertEquals(0f, ChartMath.columnWidth(0f, 24f), 0f)
        assertEquals(0f, ChartMath.columnWidth(10f, 24f, seriesCount = 0), 0f)
        val grouped = ChartMath.columnWidth(100f, 24f, seriesCount = 2, gapPx = 2f)
        assertEquals(23f, grouped, 1e-3f)
        assertTrue(ChartMath.columnWidth(1f, 24f, seriesCount = 3, gapPx = 2f) >= 0f)
    }

    @Test
    fun indexAtClampsAndRounds() {
        assertEquals(0, ChartMath.indexAt(-50f, 0f, 100f, 11))
        assertEquals(10, ChartMath.indexAt(500f, 0f, 100f, 11))
        assertEquals(5, ChartMath.indexAt(51f, 0f, 100f, 11))
        assertEquals(0, ChartMath.indexAt(50f, 0f, 100f, 1))
        assertEquals(0, ChartMath.indexAt(50f, 100f, 100f, 5))
    }

    // --- scrub haptics (4.6 / 4.7) ---------------------------------------------------------------------------

    @Test
    fun crossingARegimeLineIsASegment() {
        val values = listOf(34.0, 36.0, 37.0)
        assertEquals(ScrubHaptic.Segment, ChartMath.scrubHaptic(0, 1, values, listOf(35.5, 69.5)))
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(1, 2, values, listOf(35.5, 69.5), weekKeys = listOf(1L, 1L, 1L)))
    }

    @Test
    fun crossingAWeekIsATickAndGapsNeverSegment() {
        val dates = (0..13).map { LocalDate.of(2025, 11, 10).plusDays(it.toLong()) } // Mon 10 Nov .. Sun 23 Nov
        val keys = ChartMath.weekKeys(dates)
        val values = List(14) { 50.0 }
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(0, 6, values, weekKeys = keys))
        assertEquals(ScrubHaptic.Tick, ChartMath.scrubHaptic(6, 7, values, weekKeys = keys))
        val gappy = listOf(30.0, null, 80.0)
        assertFalse(ChartMath.scrubHaptic(0, 1, gappy, listOf(35.5), weekKeys = listOf(0L, 0L, 0L)) == ScrubHaptic.Segment)
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(2, 2, gappy))
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(-1, 2, gappy))
    }

    @Test
    fun withoutDatesTicksFallInBuckets() {
        // 30 points (a 30-day chart without dates): buckets of 7, about weekly, never every point.
        val month = List(30) { 50.0 }
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(0, 1, month))
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(5, 6, month))
        assertEquals(ScrubHaptic.Tick, ChartMath.scrubHaptic(6, 7, month))
        val ticks = (0 until 29).count { ChartMath.scrubHaptic(it, it + 1, month) == ScrubHaptic.Tick }
        assertEquals(4, ticks)
        // Long series: about 24 buckets across the width (240 points, buckets of 10).
        val long = List(240) { 50.0 }
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(8, 9, long))
        assertEquals(ScrubHaptic.Tick, ChartMath.scrubHaptic(9, 10, long))
        assertEquals(ScrubHaptic.None, ChartMath.scrubHaptic(0, 1, emptyList()))
    }

    // --- ranked bars and summaries ---------------------------------------------------------------------------

    @Test
    fun rankedDescendingPutsGapsLastAndKeepsTies() {
        val items = listOf("a" to 1.0, "b" to null, "c" to 5.0, "d" to Double.NaN, "e" to 1.0, "f" to -3.0)
        val ranked = ChartMath.rankedDescending(items) { it.second }.map { it.first }
        assertEquals(listOf("c", "a", "e", "f", "b", "d"), ranked)
    }

    @Test
    fun summaryReadsEveryShape() {
        val fmt: (Double) -> String = { it.toInt().toString() }
        assertEquals("Macro stress, 30 days, no readings yet", ChartMath.summary("Macro stress", emptyList(), fmt, "30 days", "Balanced"))
        assertEquals("Macro stress, now 58, Balanced", ChartMath.summary("Macro stress", listOf(Double.NaN, 58.0), fmt, qualifier = "Balanced"))
        assertEquals(
            "Macro stress, 30 days, from 41 to 58, now 58, Balanced",
            ChartMath.summary("Macro stress", listOf(41.0, null, 50.0, 58.0), fmt, "30 days", "Balanced"),
        )
    }

    @Test
    fun bandOfCountsBoundaries() {
        assertEquals(0, ChartMath.bandOf(10.0, listOf(35.5, 69.5)))
        assertEquals(1, ChartMath.bandOf(50.0, listOf(35.5, 69.5)))
        assertEquals(2, ChartMath.bandOf(90.0, listOf(35.5, 69.5)))
    }

    // --- regime lines (scrub segment haptic) -----------------------------------------------------------------

    @Test
    fun regimeLinesAreTheInteriorBandEdgesOnly() {
        val lines = ChartMath.regimeLines(macroStressBands())
        assertEquals(listOf(35.5, 69.5), lines)
        // A reading of exactly 100 (or 0) is not across a regime line.
        val values = listOf(99.0, 100.0, 0.0, 1.0)
        assertFalse(ChartMath.scrubHaptic(0, 1, values, lines, weekKeys = listOf(0L, 0L, 0L, 0L)) == ScrubHaptic.Segment)
        assertFalse(ChartMath.scrubHaptic(2, 3, values, lines, weekKeys = listOf(0L, 0L, 0L, 0L)) == ScrubHaptic.Segment)
        assertTrue(ChartMath.regimeLines(emptyList()).isEmpty())
    }

    // --- exact morph curves ----------------------------------------------------------------------------------

    @Test
    fun morphStartsAndEndsOnTheExactLines() {
        // 90 noisy daily readings to 30: 120 even samples would shave the peaks; the union grid keeps every vertex.
        val ninety = List(90) { i -> if (i % 2 == 0) 40.0 else 60.0 + i % 7 }
        val thirty: List<Double?> = List(30) { i -> 50.0 + (i % 3) * 5.0 }
        val from = ChartMath.morphCurve(ninety)
        val to = ChartMath.morphCurve(thirty)
        val pair = ChartMath.morphPair(from, to)
        assertTrue("at least the spec's 120 points", pair.grid.size >= ChartMath.MORPH_POINTS)
        val start = pair.at(0f)
        val end = pair.at(1f)
        ninety.forEachIndexed { i, v -> assertEquals("from vertex $i", v, start.at(i / 89.0), 1e-9) }
        thirty.forEachIndexed { i, v -> assertEquals("to vertex $i", v!!, end.at(i / 29.0), 1e-9) }
        // Between two vertices the start curve is the straight segment of the old line.
        assertEquals((ninety[10] + ninety[11]) / 2.0, start.at(10.5 / 89.0), 1e-9)
    }

    @Test
    fun morphCurvesKeepGapsAndEdgeCases() {
        val gappy = ChartMath.morphCurve(listOf(1.0, null, 3.0, Double.NaN, 5.0))
        assertEquals(1.0, gappy.at(0.0), 0.0)
        assertTrue(gappy.at(0.1).isNaN())
        assertEquals(3.0, gappy.at(0.5), 0.0)
        assertTrue(gappy.at(1.5).isNaN())
        assertEquals(5.0, gappy.lastValue()!!, 0.0)
        // One value is a flat line; none is all gaps; padding to a longer x grid leaves the tail empty.
        assertEquals(58.0, ChartMath.morphCurve(listOf(58.0)).at(0.3), 0.0)
        assertEquals(null, ChartMath.morphCurve(emptyList()).lastValue())
        val padded = ChartMath.morphCurve(listOf(1.0, 2.0), count = 5)
        assertEquals(2.0, padded.at(0.25), 0.0)
        assertTrue(padded.at(0.75).isNaN())
        // A gap in the old line takes the new value at once; a gap in the new line stays a gap.
        val mid = ChartMath.morphPair(gappy, ChartMath.morphCurve(listOf(10.0, 10.0, null, 10.0, 10.0))).at(0.5f)
        assertEquals(5.5, mid.at(0.0), 1e-9)
        assertEquals(10.0, mid.at(0.25), 1e-9)
        assertTrue(mid.at(0.5).isNaN())
    }

    // --- draw-on visibility ----------------------------------------------------------------------------------

    @Test
    fun drawOnStartsWhenHalfOfANormalChartIsShown() {
        assertFalse(drawOnSeen(full = 400f, shownWidth = 300f, shownHeight = 199f, window = 2000f))
        assertTrue(drawOnSeen(full = 400f, shownWidth = 300f, shownHeight = 200f, window = 2000f))
        // Off screen, unmeasured or zero-width: never seen.
        assertFalse(drawOnSeen(full = 400f, shownWidth = 0f, shownHeight = 400f, window = 2000f))
        assertFalse(drawOnSeen(full = 0f, shownWidth = 300f, shownHeight = 0f, window = 2000f))
        assertFalse(drawOnSeen(full = 400f, shownWidth = 300f, shownHeight = 0f, window = 2000f))
    }

    @Test
    fun drawOnStartsForAChartTallerThanTwiceTheWindow() {
        // A 5000 px ranked list in a 2000 px window can show at most 2000 px, less than half of itself.
        assertTrue(drawOnSeen(full = 5000f, shownWidth = 300f, shownHeight = 2000f, window = 2000f))
        assertTrue(drawOnSeen(full = 5000f, shownWidth = 300f, shownHeight = 600f, window = 2000f))
        assertFalse(drawOnSeen(full = 5000f, shownWidth = 300f, shownHeight = 599f, window = 2000f))
        // No window size known: fall back to half of the chart.
        assertTrue(drawOnSeen(full = 400f, shownWidth = 300f, shownHeight = 200f, window = 0f))
    }
}
