package com.thesis.mobile.ui.copy

/**
 * Default strings of the chart kit (ui/charts/kit; docs/app-redesign/DESIGN-DIRECTION.md section 3 "Charts").
 * Screens pass their own words where a chart takes them; these are the kit's fallbacks and fixed labels.
 */
object ChartCopy {
    /** The table toggle in a chart card's foot. */
    const val SHOW_TABLE = "Show table"
    const val HIDE_TABLE = "Hide table"

    /** The honest absence inside a chart's dashed box. */
    const val NO_DATA = "No readings yet"

    /** The spoken summary of a chart (ChartMath.summary): "Macro stress, 30 days, from 41 to 58, now 58, Balanced". */
    fun summaryRange(from: String, to: String): String = "from $from to $to"
    fun summaryNow(value: String): String = "now $value"

    /** The summary's words when there is nothing to read: [NO_DATA] mid-sentence. */
    val summaryEmpty: String get() = NO_DATA.lowercase()

    /** A two-finger compare window in the chart readout ("2 Nov to 16 Nov"). */
    fun window(from: String, to: String): String = "$from to $to"

    /** The figure number above a chart card's title ("Chart 3"; the eyebrow sets it in capitals). */
    fun figure(number: Int): String = "Chart $number"

    /** RangeBar: the scenario names and the two marker labels. */
    const val BEAR = "Bear"
    const val BASE = "Base"
    const val BULL = "Bull"
    const val PRICE = "Price"
    const val YOUR_VALUE = "Your value"

    /** RangeBar label when bear and bull are the same figure ("Bear and bull $120"). */
    fun sameRange(bear: String, bull: String, figure: String): String = "$bear and ${bull.lowercase()} $figure"

    /** Timeline item states, read by TalkBack. */
    const val DONE = "Done"
    const val CURRENT = "Current"
    const val UPCOMING = "Upcoming"
}
