package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.ChartFixtures
import com.thesis.mobile.ui.charts.kit.CHART_NO_DATA
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.ChartDrawOnRegistry
import com.thesis.mobile.ui.charts.kit.ChartHeights
import com.thesis.mobile.ui.charts.kit.ChartMath
import com.thesis.mobile.ui.charts.kit.ColumnChart
import com.thesis.mobile.ui.charts.kit.HIDE_TABLE
import com.thesis.mobile.ui.charts.kit.LineChart
import com.thesis.mobile.ui.charts.kit.LineChartReadout
import com.thesis.mobile.ui.charts.kit.LineChartState
import com.thesis.mobile.ui.charts.kit.LocalChartDrawOn
import com.thesis.mobile.ui.charts.kit.MeterRow
import com.thesis.mobile.ui.charts.kit.RangeBar
import com.thesis.mobile.ui.charts.kit.RankedBars
import com.thesis.mobile.ui.charts.kit.SHOW_TABLE
import com.thesis.mobile.ui.charts.kit.ScaleBar
import com.thesis.mobile.ui.charts.kit.Sparkline
import com.thesis.mobile.ui.charts.kit.Timeline
import com.thesis.mobile.ui.charts.kit.chartTable
import com.thesis.mobile.ui.charts.kit.macroStressBands
import com.thesis.mobile.ui.charts.kit.macroStressSegments
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PreviewHaptics
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.macroStressDeltaTone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Chart kit semantics and gestures (M2; rubric A1, A3, H1): every chart is summarised for TalkBack, chart card
 * titles are headings, "Show table" is a 48 dp target that expands the values, ranked rows and timeline items are
 * one stop each, and the scrub follows the 4.7 haptic map (start, week ticks, end; a vertical drag is the page's).
 */
class ChartKitSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    @Before
    fun clearHaptics() = PreviewHaptics.clear()

    private fun setCharts(content: @Composable () -> Unit) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                val registry = remember { ChartDrawOnRegistry() }
                CompositionLocalProvider(LocalChartDrawOn provides registry) {
                    Column(Modifier.width(PhoneSpec.WIDTH_DP.dp).verticalScroll(rememberScrollState())) { content() }
                }
            }
        }
    }

    @Test
    fun lineChartIsSummarised() {
        val data = ChartFixtures.stress(30)
        val summary = ChartMath.summary("Macro stress", data.primaryValues, ChartFixtures.score, "30 days", "Balanced")
        setCharts { LineChart(data, valueFormat = ChartFixtures.score, summary = summary) }
        rule.onNodeWithContentDescription(summary).assertExists()
        assertTrue(summary, summary.startsWith("Macro stress, 30 days, from "))
    }

    @Test
    fun defaultSummariesComeFromTheData() {
        setCharts {
            LineChart(ChartFixtures.margins, valueFormat = ChartFixtures.pct)
            ColumnChart(listOf(com.thesis.mobile.ui.charts.kit.ChartSeries("Sales", ChartFixtures.sales)), ChartFixtures.fiscalYears, valueFormat = ChartFixtures.money)
        }
        rule.onNodeWithContentDescription("Gross margin, from 40.1% to 46.9%, now 46.9%", substring = true).assertExists()
        rule.onNodeWithContentDescription("Sales, from ", substring = true).assertExists()
    }

    @Test
    fun emptyChartsSayWhatIsMissing() {
        setCharts {
            LineChart(ChartFixtures.empty)
            Sparkline(emptyList(), "Macro stress, no readings yet")
        }
        rule.onNodeWithContentDescription(CHART_NO_DATA).assertExists()
        rule.onNodeWithContentDescription("Macro stress, no readings yet").assertExists()
    }

    @Test
    fun chartCardTitleIsAHeadingAndShowTableExpandsTheValues() {
        val data = ChartFixtures.stress(30)
        setCharts {
            ChartCard(
                title = "Macro stress is Balanced and rising",
                fignum = 1,
                subtitle = "Score 0 to 100, last 30 days",
                source = "Thesis macro model",
                table = chartTable(data.xLabels, data.series, ChartFixtures.score, "Day"),
            ) {
                LineChart(data, valueFormat = ChartFixtures.score, height = ChartHeights.Compact)
            }
        }
        rule.onNodeWithText("Macro stress is Balanced and rising").assertIsHeading()
        rule.onNodeWithText("CHART 1", ignoreCase = true).assertExists()
        rule.onNodeWithText("Day").assertDoesNotExist()
        rule.onNodeWithText(SHOW_TABLE).assertTouchTargetAtLeast().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(HIDE_TABLE).assertExists()
        rule.onNodeWithText("Day").assertExists()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun rankedRowsMeterRowsAndScalesAreOneStopEach() {
        setCharts {
            RankedBars(ChartFixtures.scenario, "Change in monitor score in the scenario, points")
            MeterRow("Monitor score", 81.0, "81", maxText = "100", subject = true)
            ScaleBar(58.0, macroStressSegments(), "Macro stress 58 of 100, Balanced")
            RangeBar(101.0, 157.0, ChartFixtures.price, base = 128.0, price = 142.0)
        }
        rule.onNodeWithContentDescription("AAPL, +6 pts, Services margin holds when hardware volumes fall").assertExists()
        rule.onNodeWithContentDescription("NEWCO, Not computed, No report to stress yet").assertExists()
        rule.onNodeWithContentDescription("Monitor score, 81 of 100").assertExists()
        rule.onNodeWithContentDescription("Macro stress 58 of 100, Balanced").assertExists()
        rule.onNodeWithContentDescription("Bear \$101, base \$128, bull \$157, price \$142").assertExists()
    }

    @Test
    fun timelineItemsCarryTheirState() {
        setCharts { Timeline(ChartFixtures.journal) }
        rule.onNodeWithText("Thesis reviewed", useUnmergedTree = true).assertExists()
        val current = SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Current")
        rule.onNode(current).assertExists()
        rule.onNode(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Upcoming")).assertExists()
    }

    @Test
    fun horizontalDragScrubsWithTheHapticMap() {
        val data = ChartFixtures.stress(90)
        val state = LineChartState()
        setCharts {
            LineChartReadout(data, state, valueFormat = ChartFixtures.score, changeFormat = ChartFixtures.pts, nowLabel = "Mon 24 Nov", changeTone = ::macroStressDeltaTone)
            LineChart(
                data,
                modifier = Modifier.testTag("chart"),
                valueFormat = ChartFixtures.score,
                bands = macroStressBands(),
                yRange = 0.0..100.0,
                state = state,
            )
        }
        var sawScrub = false
        rule.onNodeWithTag("chart").performTouchInput {
            down(Offset(width * 0.15f, height / 2f))
            moveBy(Offset(40f, 0f))
            repeat(20) { moveBy(Offset(width * 0.03f, 0f)) }
            sawScrub = state.scrubIndex >= 0
        }
        rule.waitForIdle()
        assertTrue("scrub index set while the finger is down", sawScrub || state.scrubIndex >= 0)
        rule.onNodeWithTag("chart").performTouchInput { up() }
        rule.waitForIdle()
        val log = PreviewHaptics.log
        assertEquals(HapticKind.GestureStart, log.first())
        assertEquals(HapticKind.GestureEnd, log.last())
        assertTrue("week ticks across ~2 months: $log", log.count { it == HapticKind.Tick } >= 2)
        assertTrue("only scrub haptics: $log", log.all { it in setOf(HapticKind.GestureStart, HapticKind.GestureEnd, HapticKind.Tick, HapticKind.Segment) })
        assertEquals(-1, state.scrubIndex)
        assertFalse(state.active)
        rule.onNodeWithText("Mon 24 Nov").assertExists()
    }

    @Test
    fun verticalDragBelongsToThePage() {
        val state = LineChartState()
        setCharts {
            LineChart(ChartFixtures.stress(30), modifier = Modifier.testTag("chart"), valueFormat = ChartFixtures.score, state = state)
        }
        rule.onNodeWithTag("chart").performTouchInput {
            down(center)
            repeat(10) { moveBy(Offset(0f, 12f)) }
            up()
        }
        rule.waitForIdle()
        assertTrue(PreviewHaptics.log.toString(), PreviewHaptics.log.isEmpty())
        assertEquals(-1, state.scrubIndex)
    }

    @Test
    fun twoFingersCompareAWindow() {
        val data = ChartFixtures.stress(30)
        val state = LineChartState()
        setCharts {
            LineChartReadout(data, state, valueFormat = ChartFixtures.score, changeFormat = ChartFixtures.pts, nowLabel = "Mon 24 Nov")
            LineChart(data, modifier = Modifier.testTag("chart"), valueFormat = ChartFixtures.score, state = state)
        }
        var window: IntRange? = null
        rule.onNodeWithTag("chart").performTouchInput {
            down(0, Offset(width * 0.3f, height / 2f))
            down(1, Offset(width * 0.7f, height / 2f))
            moveBy(1, Offset(4f, 0f))
            window = state.compareRange
        }
        rule.waitForIdle()
        val w = window ?: state.compareRange
        assertTrue("window set: $w", w != null && w.first < w.last)
        rule.onNodeWithText("${data.labelAt(w!!.first)} to ${data.labelAt(w.last)}").assertExists()
        rule.onNodeWithTag("chart").performTouchInput {
            up(0)
            up(1)
        }
        rule.waitForIdle()
        assertEquals(null, state.compareRange)
        assertEquals(HapticKind.GestureStart, PreviewHaptics.log.first())
        assertEquals(HapticKind.GestureEnd, PreviewHaptics.log.last())
    }
}
