package com.thesis.mobile.ui.charts.kit

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Chart geometry and chart text (docs/app-redesign/DESIGN-DIRECTION.md section 3 "Charts"; deep-dive-visual-language.md
 * sections 8 and 10.5). ui/charts/kit is a token home like ui/theme and ui/components (rubric T1), so the chart
 * numbers live here, once. Screens never write them: they pick [ChartHeights] and pass data.
 */

/** Plot heights a screen may choose (section 3: fixed 180 compact / 240 featured). */
object ChartHeights {
    /** Compact chart cards (Compare names "Show chart", most cards). */
    val Compact: Dp = 180.dp

    /** The one featured chart of a screen (Macro Stress trend). */
    val Featured: Dp = 240.dp

    /** One cell of [SmallMultiples]. */
    val Multiple: Dp = 112.dp

    /** Inline sparkline (Home macro card, Weekly digest). */
    val Sparkline: Dp = 40.dp
}

/** Internal chart geometry. */
internal object ChartDims {
    /** Line charts: 2 dp line, end dot r 4 with a 2 dp ring in the card surface. */
    val line: Dp = 2.dp
    val endDot: Dp = 4.dp
    val endRing: Dp = 2.dp

    /** Sparkline: 1.5 dp line, end dot r 2.5. */
    val sparkLine: Dp = 1.5.dp
    val sparkDot: Dp = 2.5.dp

    /** Grid lines, the axis baseline and tick marks (DD 1 px). */
    val hairline: Dp = 1.dp

    /** The zero line of diverging ranked bars runs this far above and below the track. */
    val zeroOverhang: Dp = 3.dp

    /** Halo behind labels drawn over marks (3 px stroke in the surface colour). */
    val halo: Dp = 3.dp

    /** Gap between the y tick labels and the plot (DD 6 px). */
    val tickGap: Dp = 6.dp

    /** Gap between the end dot and its label. */
    val endLabelGap: Dp = 8.dp

    /** Space above the plot so the top tick label and end labels are not cut. */
    val plotTop: Dp = 8.dp

    /** Gap between the plot and the x labels. */
    val xLabelGap: Dp = 6.dp

    /** A grid line closer than this to the reference line (indexed 100, the zero line) is left out. */
    val gridSkip: Dp = 8.dp

    /** Regime band names sit this far inside the top left of their band. */
    val bandLabelInset: Dp = 4.dp

    /** Gap between two x labels when thinning. */
    val xLabelSpacing: Dp = 12.dp

    /** Columns: at most 24 dp wide, 4 dp rounded data end, 2 dp between grouped columns. */
    val columnMax: Dp = 24.dp
    val columnRadius: Dp = 4.dp
    val columnGroupGap: Dp = 2.dp

    /** Gap between a column's top and its value label. */
    val columnLabelGap: Dp = 4.dp

    /** Ranked bars: 34 dp rows, 52 dp with a rationale line, 8 dp track radius 4, 52 dp value column. */
    val rankedRow: Dp = 34.dp
    val rankedRowTwoLine: Dp = 52.dp
    val track: Dp = 8.dp
    val trackRadius: Dp = 4.dp
    val valueColumn: Dp = 52.dp

    /** Range and scale bars. */
    val rangeBar: Dp = 8.dp
    val markerStroke: Dp = 2.dp
    val markerOverhang: Dp = 6.dp
    val yourRing: Dp = 5.dp
    val baseTick: Dp = 3.dp
    val scaleBar: Dp = 8.dp
    val scaleSegmentGap: Dp = 2.dp

    /** Timeline: 2 dp rail, 12 dp rings with a 2 dp border, items 16 dp apart. */
    val rail: Dp = 2.dp
    val ring: Dp = 12.dp
    val ringBorder: Dp = 2.dp
    val ringCore: Dp = 4.dp
    val timelineGap: Dp = 16.dp

    /** Legend swatches: 14 x 2 radius 2 (lines), 10 x 10 radius 3 (bars). */
    val swatchLineW: Dp = 14.dp
    val swatchLineH: Dp = 2.dp
    val swatchLineRadius: Dp = 2.dp
    val swatchBar: Dp = 10.dp
    val swatchBarRadius: Dp = 3.dp
    val legendGapH: Dp = 14.dp
    val legendGapV: Dp = 6.dp

    /** "No data" box (DD .nodata: dashed 1 px, radius 10, min height 120). */
    val noData: Dp = 120.dp

    /** Fignum to title, title to subtitle. */
    val fignumGap: Dp = 6.dp
    val subtitleGap: Dp = 2.dp
}

/** Chart alphas. */
internal object ChartAlpha {
    /** Regime bands behind a line (section 3: 6% fills). */
    const val BAND = 0.06f

    /** Grid lines over regime bands: `line2` at 70% (the plain `grid` colour vanishes into a 6% band). */
    const val BAND_GRID = 0.70f

    /** Scale bar regime segments (18%). */
    const val SCALE_SEGMENT = 0.18f

    /** History columns when the latest is highlighted (DD .42). */
    const val HISTORY = 0.42f

    /** Sparkline line in ink when it is not the subject. */
    const val SPARK_INK = 0.60f

    /** Sparkline area fill at its top (fades to 0). */
    const val SPARK_AREA = 0.18f

    /** Range bar: bear-to-bull band (the base mark is 100%). */
    const val RANGE_BAND = 0.35f

    /** The part of a line after the scrub cursor. */
    const val AFTER_CURSOR = 0.40f

    /** Two-finger range compare: the shaded window (ink). */
    const val COMPARE_SHADE = 0.06f

    /** Draw-on: end dots and labels fade in over the last part of the reveal. */
    const val LABELS_FROM = 0.85f
}

/**
 * Chart text: Roboto (sans) apparatus, tabular figures (deep-dive-visual-language.md section 8). The two weighted
 * tick styles are defined here, once, until `ThesisType.tickStrong` (11 / 600 tnum) and `ThesisType.tickMedium`
 * (11 / 500) land in ui/theme (handoff to the theme owner, rubric T2); then [endLabel] and [rankLabel] point at them.
 */
internal object ChartText {
    /** Axis ticks and x labels: 11 / 400 tnum, muted. */
    val tick: TextStyle get() = ThesisType.tick

    /** The latest-value label at a line end or on top of a column: 11 / 600 tnum, ink. */
    val endLabel: TextStyle get() = ThesisType.tick.copy(fontWeight = FontWeight.SemiBold)

    /** Ranked bar label: 11 / 500, ink. */
    val rankLabel: TextStyle get() = ThesisType.tick.copy(fontWeight = FontWeight.Medium, fontFeatureSettings = null)

    /** Ranked bar value: 11 / 600 tnum, ink. */
    val rankValue: TextStyle get() = endLabel

    /** Ranked bar rationale under the label: 11 / 400, ink2 (never larger than the label it explains). */
    val rankNote: TextStyle get() = ThesisType.tick.copy(fontFeatureSettings = null)
}
