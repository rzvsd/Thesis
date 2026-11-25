package com.thesis.mobile.ui.charts.kit

import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToLong

/*
 * Chart kit maths (docs/app-redesign/DESIGN-DIRECTION.md, sections 3 "Charts" and 4.6). Pure Kotlin, no Compose:
 * the composables in this package only map these results to pixels, so every edge case (no data, one point, equal
 * values, NaN and infinities) is pinned by ChartMathTest on the JVM.
 *
 * Rule for every input: NaN and +/-infinity are gaps (the same as null), never a crash or a NaN coordinate.
 */

/** [this] when it is a finite number, else null (NaN and infinities are gaps). */
fun Double?.finiteOrNull(): Double? = this?.takeIf { it.isFinite() }

/** The values with NaN and infinities turned into gaps (null). */
fun List<Double?>.sanitized(): List<Double?> = map { it.finiteOrNull() }

/** The finite values only, in order. */
fun List<Double?>.finiteValues(): List<Double> = mapNotNull { it.finiteOrNull() }

/** Index of the first / last finite value, or -1. */
fun List<Double?>.firstFiniteIndex(): Int = indexOfFirst { it.finiteOrNull() != null }
fun List<Double?>.lastFiniteIndex(): Int = indexOfLast { it.finiteOrNull() != null }

/**
 * A "nice" value axis: [min] to [max] in [step]s of 1, 2 or 5 x 10^k, with the tick values ([ticks], both ends
 * included). [min] < [max] always holds and nothing is NaN, whatever the input.
 */
data class NiceScale(val min: Double, val max: Double, val step: Double, val ticks: List<Double>) {
    val span: Double get() = max - min

    /** 0 at [min], 1 at [max]. */
    fun fraction(v: Double): Double = (v - min) / span

    /** The value at [fraction] (0 = [min]). */
    fun valueAt(fraction: Double): Double = min + fraction * span

    /** Where the baseline goes: zero when the axis crosses it, else the bottom. */
    val baseline: Double get() = if (min <= 0.0 && max >= 0.0) 0.0 else min

    /** This scale moved [t] of the way to [other] (morph; ticks are [other]'s). */
    fun lerpTo(other: NiceScale, t: Float): NiceScale = NiceScale(
        min = min + (other.min - min) * t,
        max = max + (other.max - max) * t,
        step = other.step,
        ticks = other.ticks,
    )

    companion object {
        /** The scale used when there is no data at all. */
        val Unit: NiceScale = NiceScale(0.0, 1.0, 0.5, listOf(0.0, 0.5, 1.0))
    }
}

object ChartMath {
    /** Default tick count ("about 4 nice ticks", deep-dive-visual-language.md section 8). */
    const val TICKS = 4

    /** At most this many ticks for [target]; above it the step moves to the next nice value. */
    fun maxTicks(target: Int): Int = max(2, target) + 2

    /** Points both curves are resampled to for a range morph (section 4.6). */
    const val MORPH_POINTS = 120

    /** Share of the value added above and below a flat series so it sits mid-plot. */
    private const val FLAT_PAD = 0.10

    /**
     * Nice scale over [values] (gaps ignored). [includeZero] keeps 0 on the axis (columns, ranked bars);
     * [fixed] pins the domain (Macro stress 0 to 100) and only picks ticks inside it.
     * Empty input gives [NiceScale.Unit]; equal values are padded 10% each way (0 becomes 0 to 1).
     */
    fun niceScale(
        values: Iterable<Double?>,
        target: Int = TICKS,
        includeZero: Boolean = false,
        fixed: ClosedFloatingPointRange<Double>? = null,
    ): NiceScale {
        val finite = values.mapNotNull { it.finiteOrNull() }
        if (fixed != null && fixed.start.isFinite() && fixed.endInclusive.isFinite() && fixed.endInclusive > fixed.start) {
            return fixedScale(fixed.start, fixed.endInclusive, target)
        }
        if (finite.isEmpty()) return NiceScale.Unit
        var lo = finite.min()
        var hi = finite.max()
        if (includeZero) {
            lo = min(lo, 0.0)
            hi = max(hi, 0.0)
        }
        if (hi == lo) {
            if (lo == 0.0) {
                hi = 1.0
            } else {
                val pad = abs(lo) * FLAT_PAD
                if (includeZero && lo > 0.0) hi += pad else if (includeZero && hi < 0.0) lo -= pad else {
                    lo -= pad
                    hi += pad
                }
            }
        }
        return niceBetween(lo, hi, target)
    }

    /** Nice ticks inside a pinned domain: the domain is kept, ticks are the nice multiples inside it. */
    private fun fixedScale(lo: Double, hi: Double, target: Int): NiceScale {
        var step = niceStep((hi - lo) / max(1, target))
        var ticks = ticksBetween(ceil(lo / step - EPS) * step, hi, step)
        var guard = 0
        while (ticks.size > maxTicks(target) && guard++ < GUARD) {
            step = nextNice(step)
            ticks = ticksBetween(ceil(lo / step - EPS) * step, hi, step)
        }
        return NiceScale(lo, hi, step, ticks)
    }

    private fun niceBetween(lo: Double, hi: Double, target: Int): NiceScale {
        var step = niceStep((hi - lo) / max(1, target))
        var guard = 0
        while (guard++ < GUARD) {
            val nMin = floor(lo / step + EPS) * step
            val nMax = ceil(hi / step - EPS) * step
            val count = ((nMax - nMin) / step).roundToLong() + 1
            if (count <= maxTicks(target)) return NiceScale(clean(nMin, step), clean(nMax, step), step, ticksBetween(nMin, nMax, step))
            step = nextNice(step)
        }
        return NiceScale(lo, hi, hi - lo, listOf(lo, hi))
    }

    private const val EPS = 1e-9
    private const val GUARD = 64

    /** The nice step (1, 2 or 5 x 10^k) closest to [raw] (d3's tick rule). */
    fun niceStep(raw: Double): Double {
        if (!raw.isFinite() || raw <= 0.0) return 1.0
        val power = 10.0.pow(floor(log10(raw)))
        val err = raw / power
        val m = when {
            err >= 7.07 -> 10.0
            err >= 3.16 -> 5.0
            err >= 1.41 -> 2.0
            else -> 1.0
        }
        return m * power
    }

    /** The next larger nice step: 1 -> 2 -> 5 -> 10. */
    fun nextNice(step: Double): Double {
        val power = 10.0.pow(floor(log10(step) + EPS))
        val m = step / power
        return when {
            m < 1.5 -> 2.0 * power
            m < 3.5 -> 5.0 * power
            else -> 10.0 * power
        }
    }

    private fun ticksBetween(from: Double, to: Double, step: Double): List<Double> {
        val out = ArrayList<Double>()
        var i = 0
        while (i < GUARD) {
            val t = from + i * step
            if (t > to + step * EPS * 1e3) break
            out += clean(t, step)
            i++
        }
        return out
    }

    /** Rounds float noise away (0.30000000000000004 -> 0.3) at the step's precision. */
    private fun clean(v: Double, step: Double): Double {
        val decimals = max(0, -floor(log10(step)).toInt() + 2)
        val f = 10.0.pow(decimals)
        val r = Math.round(v * f) / f
        return if (r == -0.0) 0.0 else r
    }

    /**
     * [values] resampled to [n] evenly spaced points from the first to the last index (linear between neighbours).
     * A sample next to a gap is NaN, so the curve breaks there. Empty input gives all NaN; one value is a flat line.
     */
    fun resample(values: List<Double?>, n: Int = MORPH_POINTS): DoubleArray {
        if (n <= 0) return DoubleArray(0)
        val v = values.sanitized()
        if (v.isEmpty()) return DoubleArray(n) { Double.NaN }
        if (v.size == 1) return DoubleArray(n) { v[0] ?: Double.NaN }
        return DoubleArray(n) { i ->
            val pos = if (n == 1) (v.size - 1).toDouble() else i.toDouble() * (v.size - 1) / (n - 1)
            val lo = floor(pos).toInt().coerceIn(0, v.size - 1)
            val hi = min(lo + 1, v.size - 1)
            val f = pos - lo
            val a = v[lo]
            val b = v[hi]
            when {
                a != null && (f < EPS || lo == hi) -> a
                b != null && f > 1 - EPS -> b
                a != null && b != null -> a + (b - a) * f
                else -> Double.NaN
            }
        }
    }

    /** Element-wise lerp of two curves of equal length; a NaN on either side stays NaN. */
    fun lerp(from: DoubleArray, to: DoubleArray, t: Float): DoubleArray {
        require(from.size == to.size) { "Curves must have the same length" }
        return DoubleArray(to.size) { i ->
            val a = from[i]
            val b = to[i]
            if (a.isNaN() || b.isNaN()) b else a + (b - a) * t
        }
    }

    /**
     * Indexed mode (Compare names): every series rebased so its value at the first index where **all** series
     * have a positive value equals 100. If there is no common index, each series uses its own first positive
     * value. A series with no positive value cannot be indexed and becomes all gaps.
     */
    fun indexed(series: List<List<Double?>>): List<List<Double?>> {
        if (series.isEmpty()) return series
        val clean = series.map { it.sanitized() }
        val length = clean.maxOf { it.size }
        val common = (0 until length).firstOrNull { i -> clean.all { s -> (s.getOrNull(i) ?: 0.0) > 0.0 } }
        return clean.map { s ->
            val baseIndex = common ?: s.indexOfFirst { (it ?: 0.0) > 0.0 }
            val base = s.getOrNull(baseIndex ?: -1)
            if (base == null || base <= 0.0) s.map { null } else s.map { v -> v?.let { it / base * 100.0 } }
        }
    }

    /**
     * Which of [count] evenly spaced x labels to draw so that none overlap: counting back from the **last**, so the
     * latest is always labelled. [slotPx] is the distance between two points, [labelPx] the widest label plus its gap.
     */
    fun thinnedLabels(count: Int, slotPx: Float, labelPx: Float): List<Int> {
        if (count <= 0) return emptyList()
        if (count == 1) return listOf(0)
        val every = if (slotPx <= 0f || !slotPx.isFinite()) count else max(1, ceil(labelPx / slotPx).toInt())
        return (count - 1 downTo 0 step every).toList().reversed()
    }

    /**
     * Which y tick labels to draw when the plot is short (large font scale): every k-th tick from the bottom, so
     * labels [labelPx] tall never touch at [spacingPx] between ticks. Grid lines stay for every tick.
     */
    fun thinnedTicks(count: Int, spacingPx: Float, labelPx: Float): List<Int> {
        if (count <= 0) return emptyList()
        val every = if (spacingPx <= 0f || !spacingPx.isFinite()) count else max(1, ceil(labelPx * TICK_LABEL_AIR / spacingPx).toInt())
        return (0 until count step every).toList()
    }

    /** Tick labels need this much of their height as room to breathe. */
    private const val TICK_LABEL_AIR = 1.25f

    /**
     * End labels of several lines at their y positions ([ys], px), pushed apart to at least [minGap] and kept
     * inside [top]..[bottom]. Returns the new positions in the input order.
     */
    fun spreadLabels(ys: List<Float>, minGap: Float, top: Float, bottom: Float): List<Float> {
        if (ys.isEmpty()) return ys
        val order = ys.indices.sortedBy { ys[it] }
        val placed = FloatArray(ys.size)
        var last = Float.NEGATIVE_INFINITY
        for (i in order) {
            val y = max(ys[i].coerceIn(top, bottom), last + minGap)
            placed[i] = y
            last = y
        }
        // Pushed past the bottom: shift the stack up, keeping the gaps, but never above the top.
        val overflow = placed[order.last()] - bottom
        if (overflow > 0f) {
            var next = bottom
            for (i in order.reversed()) {
                val y = min(placed[i], next)
                placed[i] = max(y, top)
                next = placed[i] - minGap
            }
        }
        return placed.toList()
    }

    /** Column (bar) width: min([maxPx], 72% of the band) for one series; grouped bars share it minus [gapPx]. */
    fun columnWidth(bandPx: Float, maxPx: Float, seriesCount: Int = 1, gapPx: Float = 0f): Float {
        if (bandPx <= 0f || seriesCount <= 0) return 0f
        val group = min(maxPx * seriesCount, bandPx * COLUMN_SHARE)
        return max(0f, (group - gapPx * (seriesCount - 1)) / seriesCount)
    }

    /** Share of a band a column (or a group of columns) may fill. */
    const val COLUMN_SHARE = 0.72f

    /** Nearest point index for an x position on a plot from [left] to [right] with [count] points. */
    fun indexAt(x: Float, left: Float, right: Float, count: Int): Int {
        if (count <= 1 || right <= left) return 0
        val f = ((x - left) / (right - left)).coerceIn(0f, 1f)
        return Math.round(f * (count - 1)).coerceIn(0, count - 1)
    }

    /** Which band (by [boundaries], ascending) a value falls in: 0 below the first boundary. */
    fun bandOf(value: Double, boundaries: List<Double>): Int = boundaries.count { value >= it }

    /**
     * The haptic for a scrub step from [prev] to [next] (section 4.6 / 4.7): [ScrubHaptic.Segment] when the
     * value crosses a regime line in [boundaries], else [ScrubHaptic.Tick] when the step crosses a week boundary
     * ([weekKeys], one per point; without dates, buckets of [fallbackBucket] points), else none. Gaps never tick.
     */
    fun scrubHaptic(
        prev: Int,
        next: Int,
        values: List<Double?>,
        boundaries: List<Double> = emptyList(),
        weekKeys: List<Long>? = null,
        fallbackBucket: Int = max(1, values.size / SCRUB_BUCKETS),
    ): ScrubHaptic {
        if (prev == next || prev < 0 || next < 0 || prev >= values.size || next >= values.size) return ScrubHaptic.None
        val a = values[prev].finiteOrNull()
        val b = values[next].finiteOrNull() ?: return ScrubHaptic.None // landing on a gap: no tick
        if (a != null && boundaries.isNotEmpty() && bandOf(a, boundaries) != bandOf(b, boundaries)) {
            return ScrubHaptic.Segment
        }
        val crossed = if (weekKeys != null && prev < weekKeys.size && next < weekKeys.size) {
            weekKeys[prev] != weekKeys[next]
        } else {
            prev / fallbackBucket != next / fallbackBucket
        }
        return if (crossed) ScrubHaptic.Tick else ScrubHaptic.None
    }

    /** Buckets across a chart without dates (playbook section 10: about 24 ticks across the width). */
    const val SCRUB_BUCKETS = 24

    /** ISO week key per date (Monday-based), for [scrubHaptic]. */
    fun weekKeys(dates: List<LocalDate>): List<Long> =
        dates.map { it.with(DayOfWeek.MONDAY).toEpochDay() }

    /** Sort order for ranked bars: descending by value, gaps last, ties keep their order. */
    fun <T> rankedDescending(items: List<T>, value: (T) -> Double?): List<T> =
        items.withIndex().sortedWith(
            compareBy<IndexedValue<T>> { if (value(it.value).finiteOrNull() == null) 1 else 0 }
                .thenByDescending { value(it.value).finiteOrNull() ?: 0.0 }
                .thenBy { it.index },
        ).map { it.value }

    /**
     * The spoken summary of a chart (section 3: "Macro stress, 30 days, from 41 to 58, now 58, Balanced").
     * With one reading: "..., now 58"; with none: "..., [emptyText]".
     */
    fun summary(
        subject: String,
        values: List<Double?>,
        format: (Double) -> String,
        window: String? = null,
        qualifier: String? = null,
        emptyText: String = "no readings yet",
    ): String {
        val finite = values.finiteValues()
        val parts = mutableListOf(subject)
        if (!window.isNullOrBlank()) parts += window
        when {
            finite.isEmpty() -> parts += emptyText
            finite.size == 1 -> parts += "now ${format(finite[0])}"
            else -> {
                parts += "from ${format(finite.first())} to ${format(finite.last())}"
                parts += "now ${format(finite.last())}"
            }
        }
        if (!qualifier.isNullOrBlank() && finite.isNotEmpty()) parts += qualifier
        return parts.joinToString(", ")
    }
}

/** What a scrub step should feel like. */
enum class ScrubHaptic { None, Tick, Segment }
