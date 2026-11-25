package com.thesis.mobile.ui.charts.kit

import androidx.compose.runtime.Immutable
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import java.time.LocalDate

/*
 * Chart data models (pure, no Compose drawing). Values are Double? so a gap is a null; NaN and infinities are
 * treated as gaps everywhere (ChartMath.sanitized).
 */

/**
 * One line of a [LineChart] or one column series of a [ColumnChart]. Colours come from the palette's `series`
 * in fixed order (gold, plum, sage, blue, clay, teal); [colorIndex] picks a slot explicitly. [subject] marks the
 * series the readout follows (the first one otherwise).
 */
@Immutable
data class ChartSeries(
    val name: String,
    val values: List<Double?>,
    val subject: Boolean = false,
    val colorIndex: Int? = null,
)

/**
 * A regime band behind a line ([from] to [to] on the value axis), filled with its [tone]'s mark colour at 6%.
 * Band edges are also the regime lines a scrub "clicks" across (section 4.6: 35 and 70 for Macro stress).
 */
@Immutable
data class ChartBand(val from: Double, val to: Double, val tone: Tone, val label: String? = null)

/**
 * Everything a [LineChart] and its [LineChartReadout] share. [xLabels] has one label per point ("24 Nov");
 * [dates] (optional, same length) lets the scrub tick on week boundaries. [indexed] rebases every series to
 * 100 at the first common value (Compare names).
 */
@Immutable
class LineChartData(
    val series: List<ChartSeries>,
    val xLabels: List<String>,
    val dates: List<LocalDate>? = null,
    val indexed: Boolean = false,
) {
    /** Number of points on the x axis (the longest of the series and the labels). */
    val count: Int = maxOf(xLabels.size, series.maxOfOrNull { it.values.size } ?: 0)

    /** The values as drawn: sanitised, padded to [count] with gaps, indexed when asked. */
    val plotted: List<List<Double?>> = run {
        val padded = series.map { s -> List(count) { i -> s.values.getOrNull(i).finiteOrNull() } }
        if (indexed) ChartMath.indexed(padded) else padded
    }

    /** True when no series has a single finite value. */
    val isEmpty: Boolean = plotted.all { s -> s.all { it == null } }

    /** Index of the series the readout follows. */
    val primary: Int = series.indexOfFirst { it.subject }.takeIf { it >= 0 } ?: 0

    /** The primary series' plotted values (empty when there are no series). */
    val primaryValues: List<Double?> get() = plotted.getOrNull(primary).orEmpty()

    /** The x label at [index], or "" when there is none. */
    fun labelAt(index: Int): String = xLabels.getOrNull(index).orEmpty()

    /** Week keys for scrub ticks, when [dates] cover every point. */
    val weekKeys: List<Long>? = dates?.takeIf { it.size >= count }?.let(ChartMath::weekKeys)

    override fun equals(other: Any?): Boolean =
        other is LineChartData && other.series == series && other.xLabels == xLabels && other.dates == dates &&
            other.indexed == indexed

    override fun hashCode(): Int = ((series.hashCode() * 31 + xLabels.hashCode()) * 31 + dates.hashCode()) * 31 +
        indexed.hashCode()
}

/** The words a [LineChartReadout] shows: value, date (or window), change and its signed amount. */
@Immutable
data class ReadoutText(val value: String, val date: String, val change: String?, val delta: Double?)

object ChartReadouts {
    /**
     * The readout for [data]:
     * - at rest: the latest primary value, [nowLabel] (or the last x label) and the change from the window start;
     * - scrubbing at [scrubIndex]: that point's value and label, change from the window start;
     * - comparing [compare] (two fingers): the value at its end, "a to b", change from a to b.
     * A missing point reads [missing] and has no change.
     */
    fun readout(
        data: LineChartData,
        format: (Double) -> String,
        changeFormat: (Double) -> String,
        nowLabel: String? = null,
        scrubIndex: Int = -1,
        compare: IntRange? = null,
        missing: String = Fmt.NOT_COMPUTED,
    ): ReadoutText {
        val v = data.primaryValues
        val first = v.firstFiniteIndex()
        val last = v.lastFiniteIndex()
        if (first < 0) return ReadoutText(missing, nowLabel ?: data.labelAt(data.count - 1), null, null)
        fun change(from: Double?, to: Double?): Pair<String?, Double?> {
            if (from == null || to == null) return null to null
            val d = to - from
            return changeFormat(d) to d
        }
        return when {
            compare != null -> {
                val a = compare.first.coerceIn(0, data.count - 1)
                val b = compare.last.coerceIn(0, data.count - 1)
                val to = v.getOrNull(b)
                val (text, d) = change(v.getOrNull(a), to)
                ReadoutText(to?.let(format) ?: missing, "${data.labelAt(a)} to ${data.labelAt(b)}", text, d)
            }
            scrubIndex >= 0 -> {
                val i = scrubIndex.coerceIn(0, data.count - 1)
                val at = v.getOrNull(i)
                val (text, d) = if (i > first) change(v[first], at) else null to null
                ReadoutText(at?.let(format) ?: missing, data.labelAt(i), text, d)
            }
            else -> {
                val (text, d) = if (last > first) change(v[first], v[last]) else null to null
                ReadoutText(format(v[last]!!), nowLabel ?: data.labelAt(last), text, d)
            }
        }
    }
}

/**
 * "Show table" (section 3): a [CompareTableModel] of a chart's values, one row per x label (newest first by
 * default) and one column per series (at most [CompareTableModel.MAX_COLUMNS]). A gap reads [missing]. Returns
 * null when there is nothing to list.
 */
fun chartTable(
    xLabels: List<String>,
    series: List<ChartSeries>,
    format: (Double) -> String,
    labelHeader: String = "",
    missing: String = Fmt.NOT_COMPUTED,
    newestFirst: Boolean = true,
): CompareTableModel? {
    val cols = series.take(CompareTableModel.MAX_COLUMNS)
    val count = maxOf(xLabels.size, cols.maxOfOrNull { it.values.size } ?: 0)
    if (cols.isEmpty() || count == 0) return null
    if (cols.all { s -> s.values.all { it.finiteOrNull() == null } }) return null
    val indices = (0 until count).let { if (newestFirst) it.reversed() else it }
    val rows = indices.map { i ->
        CompareRow(
            label = xLabels.getOrNull(i).orEmpty(),
            values = cols.map { s -> s.values.getOrNull(i).finiteOrNull()?.let(format) ?: missing },
        )
    }
    return CompareTableModel(
        columns = cols.map { s -> CompareColumn(period = s.name, subject = s.subject) },
        rows = rows,
        labelHeader = labelHeader,
    )
}

/**
 * Draw-on bookkeeping (section 4.6): a chart draws on **once per data identity** (the latest reading date or the
 * report id), not once per visit, so coming back to Macro Stress the same day shows the chart complete.
 * The process-wide instance is [Process]; tests and previews provide their own through `LocalChartDrawOn`.
 * Bounded: the oldest keys are forgotten past [capacity].
 */
class ChartDrawOnRegistry(private val capacity: Int = DEFAULT_CAPACITY) {
    private val seen = LinkedHashSet<Any>()

    /** True when [key] has drawn on before. */
    @Synchronized
    fun isSeen(key: Any): Boolean = key in seen

    /** Records [key]; returns true the first time (the caller should draw on), false after that. */
    @Synchronized
    fun claim(key: Any): Boolean {
        if (key in seen) return false
        seen += key
        if (seen.size > capacity) seen.remove(seen.first())
        return true
    }

    companion object {
        const val DEFAULT_CAPACITY = 256

        /** The app process's registry (survives screen disposal, not process death). */
        val Process: ChartDrawOnRegistry = ChartDrawOnRegistry()
    }
}
