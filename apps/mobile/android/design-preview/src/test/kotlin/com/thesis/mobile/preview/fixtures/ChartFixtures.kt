package com.thesis.mobile.preview.fixtures

import com.thesis.mobile.ui.charts.kit.ChartSeries
import com.thesis.mobile.ui.charts.kit.LineChartData
import com.thesis.mobile.ui.charts.kit.RankedBar
import com.thesis.mobile.ui.charts.kit.SmallMultiple
import com.thesis.mobile.ui.charts.kit.TimelineItem
import com.thesis.mobile.ui.charts.kit.TimelineState
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Chart kit fixtures (M2, ChartKitRenders and ChartKitSemanticsTest). The fiscal series are the sample report's
 * Apple figures (the renderer's charts 3, 4 and 19 in dd-shots), so the renders compare one to one.
 */
object ChartFixtures {
    private val DayMonth = DateTimeFormatter.ofPattern("d MMM", Locale.US)

    val fiscalYears: List<String> = (2015..2025).map { "FY$it" }

    /** Sales, $ (chart 3 / 19). */
    val sales: List<Double?> = listOf(233.7, 215.6, 229.2, 265.6, 260.2, 274.5, 365.8, 394.3, 383.3, 391.0, 416.2).map { it * 1e9 }

    /** Net profit, $ (chart 19). */
    val netProfit: List<Double?> = listOf(53.4, 45.7, 48.4, 59.5, 55.3, 57.4, 94.7, 99.8, 97.0, 93.7, 112.0).map { it * 1e9 }

    /** Gross and operating margin, % (chart 4). */
    val grossMargin: List<Double?> = listOf(40.1, 39.1, 38.5, 38.3, 37.8, 38.2, 41.8, 43.3, 44.1, 46.2, 46.9)
    val operatingMargin: List<Double?> = listOf(30.5, 27.8, 26.8, 26.7, 24.6, 24.1, 29.8, 30.3, 29.8, 31.5, 32.0)

    val margins = LineChartData(
        series = listOf(ChartSeries("Gross margin", grossMargin), ChartSeries("Operating margin", operatingMargin, colorIndex = 3)),
        xLabels = fiscalYears,
    )

    /** 90 daily macro stress readings ending on Mon 24 Nov 2025. */
    val stressDates: List<LocalDate> = (89 downTo 0).map { LocalDate.of(2025, 11, 24).minusDays(it.toLong()) }
    val stress90: List<Double?> = List(90) { i ->
        val t = i / 89.0
        30.0 + 24.0 * t + 7.0 * kotlin.math.sin(i / 6.0) + 3.0 * kotlin.math.sin(i / 2.3)
    }

    fun stress(days: Int): LineChartData = LineChartData(
        series = listOf(ChartSeries("Macro stress", stress90.takeLast(days), subject = true)),
        xLabels = stressDates.takeLast(days).map { DayMonth.format(it) },
        dates = stressDates.takeLast(days),
    )

    /** Compare names, indexed: revenue by fiscal year for three names (first common year = 100). */
    val indexedRevenue = LineChartData(
        series = listOf(
            ChartSeries("AAPL", sales, subject = true),
            ChartSeries("MSFT", listOf(93.6, 85.3, 90.0, 110.4, 125.8, 143.0, 168.1, 198.3, 211.9, 245.1, 281.7)),
            ChartSeries("NVDA", listOf(null, 5.0, 6.9, 9.7, 11.7, 10.9, 16.7, 26.9, 27.0, 60.9, 130.5)),
        ),
        xLabels = fiscalYears,
        indexed = true,
    )

    // Edge cases (section 6.2 M2 acceptance: empty, one point, equal values, NaN).
    val empty = LineChartData(listOf(ChartSeries("Macro stress", emptyList())), emptyList())
    val onePoint = LineChartData(listOf(ChartSeries("Macro stress", listOf(58.0))), listOf("24 Nov"))
    val equal = LineChartData(listOf(ChartSeries("Macro stress", List(12) { 50.0 })), List(12) { "${it + 1} Nov" })
    val withGaps = LineChartData(
        listOf(ChartSeries("Macro stress", listOf(41.0, 44.0, Double.NaN, null, 47.0, 52.0, Double.POSITIVE_INFINITY, 49.0, null, 55.0, 58.0))),
        List(11) { "${it + 14} Nov" },
    )

    val money: (Double) -> String = { Fmt.money(it) }

    /** Axis ticks: "$0" rather than "$0.00" at the zero line. */
    val moneyTick: (Double) -> String = { if (it == 0.0) "$0" else Fmt.money(it) }

    /** Share prices in whole dollars for the range bar ("$101"). */
    val price: (Double) -> String = { "$" + Fmt.number(it, 0) }
    val pct: (Double) -> String = { Fmt.pct(it, 1) }
    val pctTick: (Double) -> String = { Fmt.pct(it, 0) }
    val score: (Double) -> String = { Fmt.score(it) }
    val pts: (Double) -> String = { Fmt.pts(it) }

    val multiples = listOf(
        SmallMultiple("AAPL", sales, fiscalYears.takeLast(11), "Revenue, FY2015 to FY2025"),
        SmallMultiple("MSFT", listOf(93.6, 85.3, 90.0, 110.4, 125.8, 143.0, 168.1, 198.3, 211.9, 245.1, 281.7).map { it * 1e9 }, fiscalYears, "Revenue, FY2015 to FY2025"),
        SmallMultiple("NVDA", listOf(null, 5.0, 6.9, 9.7, 11.7, 10.9, 16.7, 26.9, 27.0, 60.9, 130.5).map { it?.times(1e9) }, fiscalYears, "Revenue, FY2016 to FY2025"),
        SmallMultiple("INTC", listOf(55.4, 59.4, 62.8, 70.8, 72.0, 77.9, 79.0, 63.1, 54.2, 53.1, null).map { it?.times(1e9) }, fiscalYears, "Revenue, FY2015 to FY2024"),
        SmallMultiple("NEWCO", List(11) { null }, fiscalYears, "No 10-K yet"),
    )

    val scenario = listOf(
        RankedBar("MSFT", -4.0, "−4 pts", "Cloud growth slows with enterprise budgets", tone = Tone.Unfavourable),
        RankedBar("AAPL", 6.0, "+6 pts", "Services margin holds when hardware volumes fall", tone = Tone.Favourable),
        RankedBar("NVDA", -11.0, "−11 pts", "Data-centre orders are the most rate-sensitive line", tone = Tone.Unfavourable),
        RankedBar("KO", 2.0, "+2 pts", "Pricing power offsets volume", tone = Tone.Favourable),
        RankedBar("NEWCO", null, Fmt.NOT_COMPUTED, "No report to stress yet"),
    )

    val evidence = listOf(
        RankedBar("Income statement", 112.0, "112"),
        RankedBar("Balance sheet", 64.0, "64"),
        RankedBar("Cash flow", 38.0, "38", subject = true),
        RankedBar("Segments", 6.0, "6"),
    )

    val journal = listOf(
        TimelineItem("Thesis written", "10-K FY2024 · 1 Nov 2024", "Services carry the margin; hardware is the cash engine."),
        TimelineItem("Drift flagged", "10-Q Q2 FY25 · 2 May 2025", "Gross margin fell 0.4 points; services growth slowed to 11%."),
        TimelineItem("Thesis reviewed", "10-K FY2025 · 31 Oct 2025", "Margin at an 11-year high; the drift reversed.", TimelineState.Current),
        TimelineItem("Next filing", "10-Q Q1 FY26 · late Jan 2026", state = TimelineState.Upcoming),
    )
}
