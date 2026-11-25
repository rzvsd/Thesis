package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.ui.components.dashedBorder
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Shared chart pieces: draw-on per data identity, palette colours by series slot, halo labels, the legend and the
 * honest "no data" box.
 */

/** The draw-on registry charts consult (section 4.6). The app uses the process-wide one. */
val LocalChartDrawOn = staticCompositionLocalOf { ChartDrawOnRegistry.Process }

/**
 * Draw-on progress for [dataKey] (0 to 1 over `Draw` 900 ms, `EaseCalm`), once per data identity: a key that has
 * drawn before (on this or an earlier visit) starts complete, and so does a null key and reduced motion.
 * Read `.value` in the draw phase only.
 */
@Composable
internal fun rememberDrawOn(dataKey: Any?): Animatable<Float, AnimationVector1D> {
    val registry = LocalChartDrawOn.current
    val reduced = LocalReducedMotion.current
    val progress = remember(dataKey) {
        val fresh = dataKey != null && !reduced && !registry.isSeen(dataKey)
        Animatable(if (fresh) 0f else 1f)
    }
    LaunchedEffect(progress) {
        if (progress.value < 1f && dataKey != null && registry.claim(dataKey)) {
            progress.animateTo(1f, ThesisMotion.timed(false, ThesisMotion.Draw, easing = ThesisMotion.EaseCalm))
        } else {
            progress.snapTo(1f)
        }
    }
    return progress
}

/** The mark colour of series slot [index] (fixed order; wraps after six). */
internal fun ThesisPalette.seriesColor(index: Int): Color = series[Math.floorMod(index, series.size)]

/** The colour of [s] at position [position] in its chart. */
internal fun ThesisPalette.colorOf(s: ChartSeries, position: Int): Color = seriesColor(s.colorIndex ?: position)

/** Draw-on: alpha of end dots and labels, which fade in over the last 15% of the reveal. */
internal fun labelAlpha(reveal: Float): Float =
    ((reveal - ChartAlpha.LABELS_FROM) / (1f - ChartAlpha.LABELS_FROM)).coerceIn(0f, 1f)

/** Draws [layout] at [topLeft] with a [halo]-wide stroke of [haloColor] under it (labels over marks). */
internal fun DrawScope.drawHaloText(
    layout: TextLayoutResult,
    topLeft: Offset,
    color: Color,
    haloColor: Color,
    halo: Float,
    alpha: Float = 1f,
) {
    if (alpha <= 0f) return
    drawText(layout, color = haloColor, topLeft = topLeft, alpha = alpha, drawStyle = Stroke(width = halo))
    drawText(layout, color = color, topLeft = topLeft, alpha = alpha)
}

/**
 * Top of a y tick label centred on its grid line at [y], lifted so it never hangs more than a quarter of its
 * height below the plot's [bottom] (where it would meet the x labels at large font scales).
 */
internal fun tickLabelTop(y: Float, height: Float, bottom: Float): Float = minOf(y - height / 2f, bottom - height * 0.75f)

/** Measures one line of chart text (no wrapping). */
internal fun TextMeasurer.line(text: String, style: TextStyle): TextLayoutResult =
    measure(text, style, softWrap = false, maxLines = 1)

/** Legend entry: a line swatch (14 x 2) or a bar swatch (10 x 10). */
@Immutable
data class LegendEntry(val label: String, val colorIndex: Int, val bar: Boolean = false)

/** Legend entries for [series] (only shown when there are two or more, deep-dive-visual-language.md section 8). */
fun legendFor(series: List<ChartSeries>, bars: Boolean = false): List<LegendEntry> =
    if (series.size < 2) emptyList() else series.mapIndexed { i, s -> LegendEntry(s.name, s.colorIndex ?: i, bars) }

/** The chart legend: `caption` ink2 labels with their swatches, wrapping, 6 x 14 dp gaps. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChartLegend(entries: List<LegendEntry>, modifier: Modifier = Modifier) {
    if (entries.isEmpty()) return
    val p = LocalThesisPalette.current
    FlowRow(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ChartDims.legendGapH),
        verticalArrangement = Arrangement.spacedBy(ChartDims.legendGapV),
    ) {
        entries.forEach { e ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                val swatch = if (e.bar) {
                    Modifier.size(ChartDims.swatchBar).clip(RoundedCornerShape(ChartDims.swatchBarRadius))
                } else {
                    Modifier.size(ChartDims.swatchLineW, ChartDims.swatchLineH)
                        .clip(RoundedCornerShape(ChartDims.swatchLineRadius))
                }
                Box(swatch.background(p.seriesColor(e.colorIndex)))
                Spacer(Modifier.width(ThesisSpace.s))
                Text(e.label, style = ThesisType.caption, color = p.ink2)
            }
        }
    }
}

/**
 * The honest absence (DD `.nodata`): a dashed `line2` box, `stat` radius, centred muted [text], at least
 * [minHeight] tall. Charts show it when there is nothing to draw.
 */
@Composable
fun ChartEmpty(text: String, modifier: Modifier = Modifier, minHeight: androidx.compose.ui.unit.Dp = ChartDims.noData) {
    val p = LocalThesisPalette.current
    Box(
        modifier
            .fillMaxWidth()
            .heightIn(min = minHeight)
            .dashedBorder(p.line2, ThesisShape.StatRadius, ThesisSpace.border)
            .padding(ThesisSpace.l)
            .semantics { contentDescription = text },
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = ThesisType.bodySmall, color = p.muted, textAlign = TextAlign.Center)
    }
}

/** Default "no data" sentence. */
const val CHART_NO_DATA = "No readings yet"
