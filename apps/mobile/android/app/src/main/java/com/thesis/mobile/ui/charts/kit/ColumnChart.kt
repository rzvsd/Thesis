package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.copy.ChartCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/*
 * ColumnChart (section 3 "Charts"; renderer charts 3 and 19): columns min(24 dp, 72% of the band) wide (grouped
 * columns share that width minus 2 dp gaps), a 4 dp rounded data end only (flat on the zero line), history at
 * alpha .42 when [highlightLast], the latest value labelled above its column, about 4 nice ticks with zero on the
 * axis, x labels thinned from the last.
 *
 * Motion: columns grow from the baseline once per data identity (`Draw`, `EaseCalm`); new values with the same
 * identity morph in height (`Morph`); reduced motion shows them complete and crossfades changes (`Quick`).
 */

/**
 * A column chart of [series] over [xLabels] (one value per label; gaps leave the slot empty). [scale] shares a
 * y scale between charts ([SmallMultiples]); [showYLabels] = false keeps the grid but drops the tick labels, and
 * [reserveYLabels] keeps their width anyway, so cells of a grid share one plot geometry (x labels line up).
 */
@Composable
fun ColumnChart(
    series: List<ChartSeries>,
    xLabels: List<String>,
    modifier: Modifier = Modifier,
    valueFormat: (Double) -> String = { Fmt.number(it, 1) },
    tickFormat: (Double) -> String = valueFormat,
    height: Dp = ChartHeights.Compact,
    highlightLast: Boolean = true,
    labelLast: Boolean = true,
    scale: NiceScale? = null,
    showYLabels: Boolean = true,
    reserveYLabels: Boolean = showYLabels,
    dataKey: Any? = null,
    summary: String? = null,
    emptyText: String = ChartCopy.NO_DATA,
) {
    val clean = remember(series) { series.map { it.values.sanitized() } }
    val count = max(xLabels.size, clean.maxOfOrNull { it.size } ?: 0)
    // Fixed plot height (section 3), plus what the user's font size adds to the x label line and, with
    // [labelLast], to the value label above the columns, so large text does not squeeze the plot.
    val growth = with(LocalDensity.current) { (ThesisType.tick.lineHeight.toDp() - ThesisType.tick.lineHeight.value.dp).coerceAtLeast(0.dp) }
    val extra = if (labelLast) growth * 2 else growth
    if (clean.all { s -> s.all { it == null } } || count == 0) {
        ChartEmpty(emptyText, modifier, minHeight = height + extra)
        return
    }
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val measurer = rememberTextMeasurer()
    val reveal = rememberDrawOn(DrawOnKind.Column, dataKey)
    val format by rememberUpdatedState(valueFormat)
    val ticks by rememberUpdatedState(tickFormat)
    val axis = scale ?: remember(clean) { ChartMath.niceScale(clean.flatten(), includeZero = true) }

    // Morph of heights (same identity, new values): from the previous values to the new ones. The start is
    // decided in composition, so the frame on which the values change still draws the old heights; the bookkeeping
    // is committed in a SideEffect, so a composition that is never applied leaves it untouched. Reduced motion
    // crossfades the old columns out and the new ones in (`Quick`) instead of moving them.
    val holder = remember { ColumnMorphHolder() }
    val morph = remember(clean) {
        val before = holder.last
        val running = holder.running
        val from = when {
            before == null || before == clean || reveal.value < 1f -> null
            running?.from != null && running.progress.value < 1f && !reduced -> lerpValues(running.from, before, running.progress.value)
            else -> before
        }
        ColumnMorph(from, Animatable(if (from == null) 1f else 0f))
    }
    SideEffect {
        holder.last = clean
        holder.running = morph
    }
    LaunchedEffect(morph) {
        if (morph.from != null) {
            morph.progress.animateTo(
                1f,
                if (reduced) ThesisMotion.timed(false, ThesisMotion.Quick) else ThesisMotion.timed(false, ThesisMotion.Morph, easing = ThesisMotion.EaseCalm),
            )
        }
    }

    val description = summary ?: remember(series, valueFormat) {
        series.indices.joinToString("; ") { i -> ChartMath.summary(series[i].name, clean[i], valueFormat) }
    }

    Spacer(
        modifier
            .fillMaxWidth()
            .height(height + extra)
            .semantics { contentDescription = description }
            .drawWithCache {
                val before = morph.from
                val tickStyle = ChartText.tick.copy(color = p.muted)
                val endStyle = ChartText.endLabel.copy(color = p.ink)
                val tickLayouts = axis.ticks.map { it to measurer.line(ticks(it), tickStyle) }
                val xLayouts = List(count) { measurer.line(xLabels.getOrNull(it).orEmpty(), tickStyle) }
                val lastIdx = clean.map { it.lastFiniteIndex() }
                val endLayouts = clean.mapIndexed { k, s -> if (labelLast && lastIdx[k] >= 0) measurer.line(format(s[lastIdx[k]]!!), endStyle) else null }
                // Reduced motion crossfades: the outgoing columns keep their own latest-value labels.
                val beforeLast = before?.map { it.lastFiniteIndex() }.orEmpty()
                val beforeLayouts = before?.mapIndexed { k, s -> if (labelLast && beforeLast[k] >= 0) measurer.line(format(s[beforeLast[k]]!!), endStyle) else null }.orEmpty()

                val tickGap = ChartDims.tickGap.toPx()
                val leftW = if (showYLabels || reserveYLabels) (tickLayouts.maxOfOrNull { it.second.size.width } ?: 0) + tickGap else 0f
                val xLabelH = xLayouts.first().size.height.toFloat()
                val labelH = endLayouts.firstOrNull { it != null }?.size?.height?.toFloat() ?: 0f
                val top = max(ChartDims.plotTop.toPx(), if (labelLast) labelH + ChartDims.columnLabelGap.toPx() else 0f)
                // Grouped columns: the later series' labels start at their column and run right (renderer chart
                // 19), so they never sit on a neighbour's column; keep room for them at the right edge.
                val k = clean.size
                val gap = ChartDims.columnGroupGap.toPx()
                val plotLeft = leftW.toFloat()
                // The room a series' label has from its column's left edge to the plot's right, in the last band.
                fun roomRight(right: Float, s: Int): Float {
                    val b = (right - plotLeft) / count
                    val w = ChartMath.columnWidth(b, ChartDims.columnMax.toPx(), k, gap)
                    val g = w * k + gap * (k - 1)
                    return (b - g) / 2f + (k - 1 - s) * (w + gap) + w
                }
                var labelRight = 0f
                if (k > 1 && labelLast) {
                    // Two passes: the reserve narrows the bands, which narrows the columns a little.
                    repeat(2) {
                        labelRight = (1 until k).maxOf { s ->
                            val w = endLayouts[s]?.size?.width?.toFloat() ?: 0f
                            if (lastIdx[s] != count - 1) 0f else w - roomRight(size.width - labelRight, s)
                        }.coerceAtLeast(0f)
                    }
                }
                val plot = Rect(
                    left = plotLeft,
                    top = top,
                    right = max(plotLeft + 1f, size.width - labelRight),
                    bottom = max(top + 1f, size.height - xLabelH - ChartDims.xLabelGap.toPx()),
                )
                val band = plot.width / count
                val colW = ChartMath.columnWidth(band, ChartDims.columnMax.toPx(), k, gap)
                val groupW = colW * k + gap * (k - 1)
                val radius = ChartDims.columnRadius.toPx()
                val gridW = ChartDims.hairline.toPx()
                val halo = ChartDims.halo.toPx()
                fun yOf(v: Double) = (plot.bottom - axis.fraction(v) * plot.height).toFloat()
                val zeroY = yOf(axis.baseline).coerceIn(plot.top, plot.bottom)
                fun colLeft(i: Int, s: Int) = plot.left + band * i + (band - groupW) / 2f + s * (colW + gap)

                val widest = xLayouts.maxOf { it.size.width }.toFloat()
                // The last label is pulled in from the right edge when it is wider than its band: count that in.
                val clampShift = max(0f, widest / 2f - band / 2f)
                val shown = ChartMath.thinnedLabels(count, band, widest + ChartDims.xLabelSpacing.toPx() + clampShift)
                val tickSpacing = if (axis.ticks.size > 1) abs(yOf(axis.ticks[1]) - yOf(axis.ticks[0])) else plot.height
                val labelledTicks = ChartMath.thinnedTicks(axis.ticks.size, tickSpacing, tickLayouts.first().second.size.height.toFloat()).toSet()
                val path = Path()

                onDrawBehind {
                    val r = reveal.value
                    val m = morph.progress.value
                    // Grid and ticks.
                    tickLayouts.forEachIndexed { t, (v, layout) ->
                        val y = yOf(v)
                        drawLine(p.grid, Offset(plot.left, y), Offset(plot.right, y), gridW)
                        if (showYLabels && t in labelledTicks) drawText(layout, topLeft = Offset(plot.left - tickGap - layout.size.width, tickLabelTop(y, layout.size.height.toFloat(), plot.bottom)))
                    }
                    // Columns: 4 dp rounded data end only.
                    fun columns(values: List<List<Double?>>, last: List<Int>, lerpFrom: List<List<Double?>>?, alpha: Float) {
                        if (alpha <= 0f) return
                        for (s in 0 until k) {
                            val color = p.colorOf(series[s], s)
                            for (i in 0 until count) {
                                val target = values.getOrNull(s)?.getOrNull(i) ?: continue
                                val from = lerpFrom?.getOrNull(s)?.getOrNull(i) ?: target
                                val v = if (lerpFrom != null) from + (target - from) * m else target
                                val h = (yOf(v) - zeroY) * r
                                if (abs(h) < 0.5f) continue
                                val x = colLeft(i, s)
                                val rect = Rect(x, min(zeroY, zeroY + h), x + colW, max(zeroY, zeroY + h))
                                val rr = min(radius, min(colW / 2f, rect.height))
                                val corner = CornerRadius(rr, rr)
                                val shape = if (h < 0) {
                                    RoundRect(rect, topLeft = corner, topRight = corner, bottomRight = CornerRadius.Zero, bottomLeft = CornerRadius.Zero)
                                } else {
                                    RoundRect(rect, topLeft = CornerRadius.Zero, topRight = CornerRadius.Zero, bottomRight = corner, bottomLeft = corner)
                                }
                                path.reset()
                                path.addRoundRect(shape)
                                val history = highlightLast && i != last.getOrNull(s)
                                drawPath(path, color, alpha = alpha * if (history) ChartAlpha.HISTORY else 1f)
                            }
                        }
                    }
                    // Latest value labels above (or below, for a negative) their column, pushed apart.
                    fun labels(values: List<List<Double?>>, last: List<Int>, layouts: List<TextLayoutResult?>, alpha: Float) {
                        if (alpha <= 0f) return
                        val placed = ArrayList<Rect>()
                        for (s in 0 until k) {
                            val layout: TextLayoutResult = layouts.getOrNull(s) ?: continue
                            val i = last[s]
                            val v = values[s][i] ?: continue
                            val cx = colLeft(i, s) + colW / 2f
                            val w = layout.size.width.toFloat()
                            val hgt = layout.size.height.toFloat()
                            var y = if (v >= 0) yOf(v) - ChartDims.columnLabelGap.toPx() - hgt else yOf(v) + ChartDims.columnLabelGap.toPx()
                            val anchor = if (s == 0) cx - w / 2f else colLeft(i, s)
                            val x = anchor.coerceIn(0f, max(0f, size.width - w))
                            // Two labels at about the same height: the later one stacks above the earlier one.
                            placed.forEach { other ->
                                if (Rect(x, y, x + w, y + hgt).overlaps(other)) y = other.top - hgt
                            }
                            y = y.coerceIn(0f, max(0f, size.height - hgt))
                            placed += Rect(x, y, x + w, y + hgt)
                            drawHaloText(layout, Offset(x, y), p.ink, p.surface, halo, alpha)
                        }
                    }
                    val changing = before != null && m < 1f
                    val a = labelAlpha(r)
                    if (changing && reduced) {
                        columns(before!!, beforeLast, null, 1f - m)
                        columns(clean, lastIdx, null, m)
                    } else {
                        columns(clean, lastIdx, if (changing) before else null, 1f)
                    }
                    drawLine(p.axis, Offset(plot.left, zeroY), Offset(plot.right, zeroY), gridW)
                    if (changing && reduced) {
                        labels(before!!, beforeLast, beforeLayouts, a * (1f - m))
                        labels(clean, lastIdx, endLayouts, a * m)
                    } else if (!changing || before!!.map { it.lastFiniteIndex() } == lastIdx) {
                        // A height morph: the label rides on top of its growing column.
                        labels(if (changing) lerpValues(before!!, clean, m) else clean, lastIdx, endLayouts, a)
                    } else {
                        labels(clean, lastIdx, endLayouts, a * m)
                    }
                    // X labels.
                    shown.forEach { i ->
                        val layout = xLayouts[i]
                        val w = layout.size.width.toFloat()
                        val x = (plot.left + band * i + band / 2f - w / 2f).coerceIn(0f, max(0f, size.width - w))
                        drawText(layout, topLeft = Offset(x, plot.bottom + ChartDims.xLabelGap.toPx()))
                    }
                }
            },
    )
}

private class ColumnMorphHolder {
    var last: List<List<Double?>>? = null
    var running: ColumnMorph? = null
}

private class ColumnMorph(val from: List<List<Double?>>?, val progress: Animatable<Float, AnimationVector1D>)

/** Where a running height morph from [a] toward [b] is at [t] (a gap on either side takes [b]'s value). */
private fun lerpValues(a: List<List<Double?>>, b: List<List<Double?>>, t: Float): List<List<Double?>> =
    b.mapIndexed { s, series ->
        series.mapIndexed { i, to ->
            val from = a.getOrNull(s)?.getOrNull(i)
            if (from == null || to == null) to else from + (to - from) * t
        }
    }
