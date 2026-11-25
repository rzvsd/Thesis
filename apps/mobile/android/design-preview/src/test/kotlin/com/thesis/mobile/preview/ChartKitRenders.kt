package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.ChartFixtures
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.ChartDrawOnRegistry
import com.thesis.mobile.ui.charts.kit.ChartHeights
import com.thesis.mobile.ui.charts.kit.ChartMath
import com.thesis.mobile.ui.charts.kit.ChartSeries
import com.thesis.mobile.ui.charts.kit.ColumnChart
import com.thesis.mobile.ui.charts.kit.DrawOnKind
import com.thesis.mobile.ui.charts.kit.LineChart
import com.thesis.mobile.ui.charts.kit.LineChartData
import com.thesis.mobile.ui.charts.kit.LineChartReadout
import com.thesis.mobile.ui.charts.kit.LineChartState
import com.thesis.mobile.ui.charts.kit.LocalChartDrawOn
import com.thesis.mobile.ui.charts.kit.MeterRow
import com.thesis.mobile.ui.charts.kit.RangeBar
import com.thesis.mobile.ui.charts.kit.RankedBar
import com.thesis.mobile.ui.charts.kit.RankedBars
import com.thesis.mobile.ui.charts.kit.ScaleBar
import com.thesis.mobile.ui.charts.kit.SmallMultiples
import com.thesis.mobile.ui.charts.kit.Sparkline
import com.thesis.mobile.ui.charts.kit.Timeline
import com.thesis.mobile.ui.charts.kit.chartTable
import com.thesis.mobile.ui.charts.kit.legendFor
import com.thesis.mobile.ui.charts.kit.macroStressBands
import com.thesis.mobile.ui.charts.kit.macroStressSegments
import com.thesis.mobile.ui.charts.kit.rememberLineChartState
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.macroStressDeltaTone
import com.thesis.mobile.ui.theme.macroStressLabel
import kotlinx.coroutines.delay
import org.junit.Test

/**
 * Chart kit gallery (M2, section 6.2): every chart in both themes, the edge-case inputs (empty, one point, equal
 * values, NaN), 1.3x and 2.0x font scale, 360 dp width, reduced motion, and mid-animation frames of the draw-on,
 * the range morph and a scrub.
 *
 * Run: gradle -p design-preview test -PrendersOnly -Pscreens.only='^kit-charts'
 */
class ChartKitRenders {

    @Test
    fun lines() {
        chartGallery("kit-charts-line", settleMs = 1_500) { Fresh { LineSpecimens() } }
    }

    @Test
    fun columns() {
        chartGallery("kit-charts-columns", settleMs = 1_500) { Fresh { ColumnSpecimens() } }
    }

    @Test
    fun barsAndScales() {
        chartGallery("kit-charts-bars", settleMs = 1_500) { Fresh { BarSpecimens() } }
    }

    @Test
    fun edgeCases() {
        chartGallery("kit-charts-edge", settleMs = 1_500) { Fresh { EdgeSpecimens() } }
    }

    @Test
    fun fontScale130() {
        chartGallery("kit-charts-scale130", fontScale = 1.3f, settleMs = 1_500) { Fresh { CompactSheet() } }
    }

    @Test
    fun fontScale200() {
        chartGallery("kit-charts-scale200", fontScale = 2.0f, settleMs = 1_500) { Fresh { CompactSheet() } }
    }

    @Test
    fun narrow360() {
        chartGallery("kit-charts-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, settleMs = 1_500) { Fresh { CompactSheet() } }
    }

    @Test
    fun reducedMotionFirstFrame() {
        // Reduced motion: complete on the first frame (no draw-on).
        chartGallery("kit-charts-reduced", reducedMotion = true, settleMs = 0) { Fresh { CompactSheet(drawOn = true) } }
    }

    @Test
    fun drawOnFrames() {
        // Draw-on (900 ms EaseCalm): first frame, early, mid, labels fading in, done.
        listOf(0L, 150L, 300L, 400L, 1_200L).forEach { ms ->
            chartGallery("kit-charts-drawon-${ms}ms", settleMs = ms, frameMs = 50) { Fresh { CompactSheet(drawOn = true) } }
        }
    }

    @Test
    fun morphFrames() {
        // A range tap at 100 ms (30 days -> 90 days, same data identity): the line morphs over 500 ms.
        listOf(100L, 250L, 400L, 800L).forEach { ms ->
            chartGallery("kit-charts-morph-${ms}ms", settleMs = ms, frameMs = 50) { Fresh { MorphSpecimen() } }
        }
    }

    @Test
    fun reducedMotionMorphFrames() {
        // Reduced motion, range tap at 100 ms: a Quick (150 ms) crossfade of lines and end labels, no movement.
        listOf(160L, 400L).forEach { ms ->
            chartGallery("kit-charts-reducedmorph-${ms}ms", reducedMotion = true, settleMs = ms, frameMs = 10) {
                Fresh { MorphSpecimen() }
                Fresh { ColumnChangeSpecimen() }
            }
        }
    }

    @Test
    fun interruptedMorphFrames() {
        // 30 -> 90 days at 100 ms, then 90 -> 60 days at 300 ms (mid-morph): the second morph starts where the
        // line is, and the latest-value label stays on the moving end throughout.
        listOf(310L, 450L, 1_200L).forEach { ms ->
            chartGallery("kit-charts-interrupt-${ms}ms", settleMs = ms, frameMs = 10) { Fresh { InterruptSpecimen() } }
        }
    }

    @Test
    fun remountDoesNotReplay() {
        // Drawn on at 0 ms, left at 1000 ms, back at 1200 ms: complete at 1250 ms (once per data identity).
        chartGallery("kit-charts-replay-1250ms", settleMs = 1_250, frameMs = 10) { Fresh { RemountSpecimen() } }
    }

    @Test
    fun cardShadow() {
        // ChartCard keeps the light-theme card shadow of every ThesisCard (section 2.7).
        chartGallery("kit-charts-cards", settleMs = 1_500) { Fresh { CardSpecimens() } }
    }

    @Test
    fun scrubFrames() {
        chartGallery("kit-charts-scrub", settleMs = 600) { Fresh { ScrubSpecimens() } }
    }
}

/** [renderGallery] with a frame step, for mid-animation captures (same layout: specimens on the page colour). */
private fun chartGallery(
    name: String,
    widthDp: Int = PhoneSpec.WIDTH_DP,
    fontScale: Float = PreviewDefaults.fontScale,
    reducedMotion: Boolean = PreviewDefaults.reducedMotion,
    settleMs: Long = 1_500,
    frameMs: Long = 100,
    content: @Composable GalleryScope.() -> Unit,
) = renderScreen(
    name = name,
    widthDp = widthDp,
    heightDp = 6_000,
    settleMs = settleMs,
    frameMs = frameMs,
    fontScale = fontScale,
    reducedMotion = reducedMotion,
    glow = false,
    fitHeight = true,
) {
    Column(Modifier.fillMaxWidth().background(LocalThesisPalette.current.bg).padding(vertical = 8.dp)) {
        GalleryScope().content()
    }
}

/** Each render gets its own draw-on registry, so the light theme draws on like the dark one. */
@Composable
private fun Fresh(content: @Composable () -> Unit) {
    val registry = remember { ChartDrawOnRegistry() }
    CompositionLocalProvider(LocalChartDrawOn provides registry) { content() }
}

@Composable
private fun GalleryScope.LineSpecimens() {
    Section("LineChart")
    Specimen("Featured, regime bands, readout", "Macro stress, 30 days; Show table open") {
        MacroCard(rememberLineChartState(), days = 30, tableOpen = true)
    }
    Specimen("Two series, legend", "renderer chart 4 parity") {
        ChartCard(
            title = "Gross margin at its highest in 11 years",
            fignum = 4,
            subtitle = "% of sales, fiscal years",
            source = "Income statement",
            legend = legendFor(ChartFixtures.margins.series),
            table = chartTable(ChartFixtures.fiscalYears, ChartFixtures.margins.series, ChartFixtures.pct, "Fiscal year"),
        ) {
            LineChart(ChartFixtures.margins, valueFormat = ChartFixtures.pct, tickFormat = ChartFixtures.pctTick, includeZero = true)
        }
    }
    Specimen("Indexed mode", "Compare names: first common value = 100") {
        ChartCard(
            title = "NVDA grew fastest from the first common year",
            subtitle = "Revenue, indexed to 100 in FY2016",
            source = "10-K filings",
            legend = legendFor(ChartFixtures.indexedRevenue.series),
        ) {
            LineChart(ChartFixtures.indexedRevenue, valueFormat = { Fmt.number(it, 0) })
        }
    }
    Specimen("Sparkline", "ink 60% / subject gold (series[0]) with fill / empty") {
        Sparkline(ChartFixtures.stress90.takeLast(30), "Macro stress, 30 days", dataKey = null)
        Sparkline(ChartFixtures.stress90.takeLast(30), "Macro stress, 30 days", subject = true, fill = true)
        Sparkline(emptyList(), "Macro stress, no readings yet")
    }
}

@Composable
private fun MacroCard(state: LineChartState, days: Int, tableOpen: Boolean = false, dataKey: Any? = null) {
    val data = ChartFixtures.stress(days)
    val last = data.primaryValues.last()!!
    ChartCard(
        title = "Macro stress is ${macroStressLabel(last)} and rising",
        fignum = 1,
        subtitle = "Score 0 to 100, last $days days",
        source = "Thesis macro model",
        table = chartTable(data.xLabels, data.series, ChartFixtures.score, "Day"),
        initiallyShowTable = tableOpen,
        readout = {
            LineChartReadout(
                data, state,
                valueFormat = ChartFixtures.score,
                changeFormat = ChartFixtures.pts,
                nowLabel = "Mon 24 Nov",
                changeTone = ::macroStressDeltaTone,
            )
        },
    ) {
        LineChart(
            data,
            valueFormat = ChartFixtures.score,
            height = ChartHeights.Featured,
            bands = macroStressBands(),
            yRange = 0.0..100.0,
            state = state,
            dataKey = dataKey,
            summary = ChartMath.summary("Macro stress", data.primaryValues, ChartFixtures.score, "$days days", macroStressLabel(last)),
        )
    }
}

@Composable
private fun GalleryScope.ColumnSpecimens() {
    Section("ColumnChart")
    Specimen("Highlight last", "renderer chart 3 parity") {
        ChartCard(
            title = "Sales grew 5.9% a year since fiscal 2015",
            fignum = 3,
            subtitle = "Sales, fiscal years",
            source = "Income statement",
            table = chartTable(ChartFixtures.fiscalYears, listOf(ChartSeries("Sales", ChartFixtures.sales)), ChartFixtures.money, "Fiscal year"),
        ) {
            ColumnChart(listOf(ChartSeries("Sales", ChartFixtures.sales)), ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick)
        }
    }
    Specimen("Grouped, two series", "renderer chart 19 parity") {
        val series = listOf(ChartSeries("Sales", ChartFixtures.sales), ChartSeries("Net profit", ChartFixtures.netProfit))
        ChartCard(
            title = "Sales up 78% since fiscal 2015",
            fignum = 19,
            subtitle = "Sales and net profit, fiscal years",
            source = "Income statement",
            legend = legendFor(series, bars = true),
        ) {
            ColumnChart(series, ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick, highlightLast = false)
        }
    }
    Specimen("Negative values", "free cash flow with a loss year; data end rounded on both sides") {
        ColumnChart(
            listOf(ChartSeries("Free cash flow", listOf(4.2, 3.1, -1.8, -0.6, 2.4, 5.9).map { it * 1e9 })),
            listOf("FY2020", "FY2021", "FY2022", "FY2023", "FY2024", "FY2025"),
            valueFormat = ChartFixtures.money,
            tickFormat = ChartFixtures.moneyTick,
        )
    }
    Section("SmallMultiples")
    Specimen("Shared scale", "five names, one without data") {
        SmallMultiples(ChartFixtures.multiples, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick)
    }
}

@Composable
private fun GalleryScope.BarSpecimens() {
    Section("RankedBars")
    Specimen("Two-line, diverging", "Scenario Stress results; a missing value sorts last") {
        RankedBars(ChartFixtures.scenario, "Change in monitor score in the scenario, points")
    }
    Specimen("One line", "evidence counts; one subject") {
        RankedBars(ChartFixtures.evidence, "Figures cited, by statement")
    }
    Section("Meter")
    Specimen("MeterRow", "list (ink2 60%) / tone / subject / missing") {
        MeterRow("Value discipline", 62.0, "62", maxText = "100")
        MeterRow("Freshness", 35.0, "35", maxText = "100", tone = Tone.Attention)
        MeterRow("Monitor score", 81.0, "81", maxText = "100", subject = true)
        MeterRow("Coverage", null, "Not computed")
    }
    Section("RangeBar")
    Specimen("Bear to bull", "base mark, price and your value") {
        RangeBar(101.0, 157.0, ChartFixtures.price, base = 128.0, price = 142.0, yourValue = 150.0)
    }
    Specimen("Price outside the range", "the axis widens to include it") {
        RangeBar(101.0, 157.0, ChartFixtures.price, base = 128.0, price = 182.0)
    }
    Section("ScaleBar")
    Specimen("Macro stress", "58 Balanced / 22 Contained / 84 Elevated / missing") {
        listOf(58.0, 22.0, 84.0, null).forEach { v ->
            ScaleBar(v, macroStressSegments(), "Macro stress ${v ?: "not computed"} of 100")
        }
    }
    Section("Timeline")
    Specimen("Conviction journal", "done / current / upcoming") {
        Timeline(ChartFixtures.journal)
    }
}

@Composable
private fun GalleryScope.EdgeSpecimens() {
    Section("Edge cases")
    val cases = listOf(
        "Empty" to ChartFixtures.empty,
        "One point" to ChartFixtures.onePoint,
        "Equal values" to ChartFixtures.equal,
        "NaN, infinity and gaps" to ChartFixtures.withGaps,
    )
    cases.forEach { (name, data) ->
        Specimen("LineChart: $name") {
            LineChart(data, valueFormat = ChartFixtures.score, height = ChartHeights.Compact)
        }
    }
    cases.forEach { (name, data) ->
        Specimen("ColumnChart: $name") {
            ColumnChart(data.series, data.xLabels, valueFormat = ChartFixtures.score)
        }
    }
    Specimen("Sparkline: one point / equal / gaps") {
        Sparkline(ChartFixtures.onePoint.primaryValues, "one point")
        Sparkline(ChartFixtures.equal.primaryValues, "equal")
        Sparkline(ChartFixtures.withGaps.series[0].values, "gaps", fill = true)
    }
    Specimen("RankedBars and RangeBar: nothing to draw") {
        RankedBars(listOf(RankedBar("NEWCO", Double.NaN, "n/a")), "Change in monitor score, points")
        RangeBar(Double.NaN, 157.0, ChartFixtures.price)
        RangeBar(120.0, 120.0, ChartFixtures.price, price = 120.0)
    }
}

/** A short sheet with one of each, for the font-scale, width, reduced-motion and draw-on frames. */
@Composable
private fun GalleryScope.CompactSheet(drawOn: Boolean = false) {
    // The latest reading date as every chart's data identity: keys are kept apart per chart kind, so the line, the
    // columns, the bars and the sparkline all draw on (two charts of one kind would need keys of their own).
    @Suppress("UNUSED_PARAMETER")
    fun key(chart: String): Any? = if (drawOn) "2025-11-24" else null
    Specimen("LineChart") { MacroCard(rememberLineChartState(), days = 30, dataKey = key("macro")) }
    Specimen("ColumnChart") {
        ChartCard(title = "Sales grew 5.9% a year since fiscal 2015", fignum = 3, subtitle = "Sales, fiscal years", source = "Income statement") {
            ColumnChart(listOf(ChartSeries("Sales", ChartFixtures.sales)), ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick, dataKey = key("sales"))
        }
    }
    Specimen("RankedBars") { RankedBars(ChartFixtures.scenario.take(3), "Change in monitor score in the scenario, points", dataKey = key("scenario")) }
    Specimen("RangeBar and ScaleBar") {
        RangeBar(101.0, 157.0, ChartFixtures.price, base = 128.0, price = 142.0, yourValue = 150.0)
        ScaleBar(58.0, macroStressSegments(), "Macro stress 58 of 100, Balanced")
    }
    Specimen("Sparkline and Timeline") {
        Sparkline(ChartFixtures.stress90.takeLast(30), "Macro stress, 30 days", subject = true, fill = true, dataKey = key("spark"))
        Timeline(ChartFixtures.journal.take(3))
    }
}

@Composable
private fun GalleryScope.MorphSpecimen() {
    Specimen("Range morph", "30 days -> 90 days at 100 ms; same data identity, so no redraw from zero") {
        var days by remember { mutableStateOf(30) }
        LaunchedEffect(Unit) {
            delay(100)
            days = 90
        }
        // The chart drew on earlier this visit (same data identity): the range tap morphs, it does not redraw.
        val seen = remember { ChartDrawOnRegistry().apply { claim(DrawOnKind.Line to "2025-11-24") } }
        CompositionLocalProvider(LocalChartDrawOn provides seen) {
            MacroCard(rememberLineChartState(), days = days, dataKey = "2025-11-24")
        }
    }
}

@Composable
private fun GalleryScope.ScrubSpecimens() {
    Specimen("Scrub", "one finger at 4 Nov: readout rewritten, cursor, the rest of the line dimmed") {
        val state = remember { LineChartState() }
        LaunchedEffect(Unit) { state.scrubTo(9) }
        MacroCard(state, days = 30)
    }
    Specimen("Two-finger compare", "window 2 Nov to 16 Nov: change across the window") {
        val state = remember { LineChartState() }
        LaunchedEffect(Unit) { state.compare(7, 21) }
        MacroCard(state, days = 30)
    }
}

@Composable
private fun GalleryScope.ColumnChangeSpecimen() {
    Specimen("Column values change", "same identity, new values at 100 ms") {
        var later by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) {
            delay(100)
            later = true
        }
        val sales = if (later) ChartFixtures.sales.map { it?.times(1.18) } else ChartFixtures.sales
        ColumnChart(listOf(ChartSeries("Sales", sales)), ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick)
    }
}

@Composable
private fun GalleryScope.InterruptSpecimen() {
    Specimen("Interrupted morph", "30 -> 90 days at 100 ms, 90 -> 60 days at 300 ms") {
        var days by remember { mutableStateOf(30) }
        LaunchedEffect(Unit) {
            delay(100)
            days = 90
            delay(200)
            days = 60
        }
        val seen = remember { ChartDrawOnRegistry().apply { claim(DrawOnKind.Line to "2025-11-24") } }
        CompositionLocalProvider(LocalChartDrawOn provides seen) {
            MacroCard(rememberLineChartState(), days = days, dataKey = "2025-11-24")
        }
    }
}

@Composable
private fun GalleryScope.RemountSpecimen() {
    Specimen("Leave and come back", "drawn on at 0 ms, disposed at 1000 ms, composed again at 1200 ms: no replay") {
        var shown by remember { mutableStateOf(true) }
        LaunchedEffect(Unit) {
            delay(1_000)
            shown = false
            delay(200)
            shown = true
        }
        if (shown) {
            MacroCard(rememberLineChartState(), days = 30, dataKey = "2025-11-24")
        } else {
            Text("(away)", style = ThesisType.caption)
        }
    }
}

@Composable
private fun GalleryScope.CardSpecimens() {
    Specimen("ThesisCard and ChartCard", "the same shadow in light; the table expands inside, not the card") {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ThesisCard(title = "A plain kit card") { Text("Body copy for comparison.", style = ThesisType.bodySmall) }
            ChartCard(title = "Sales grew 5.9% a year since fiscal 2015", fignum = 3, subtitle = "Sales, fiscal years", source = "Income statement") {
                ColumnChart(listOf(ChartSeries("Sales", ChartFixtures.sales)), ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money, tickFormat = ChartFixtures.moneyTick)
            }
        }
    }
}

