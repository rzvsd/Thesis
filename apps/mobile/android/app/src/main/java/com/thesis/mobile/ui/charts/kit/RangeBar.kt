package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import kotlin.math.max
import kotlin.math.min

/*
 * RangeBar (section 3 "Charts"; replaces ScenarioFanChart; the renderer's "Bear to bull model range" box): an axis
 * track, the bear-to-bull band in series[0] at 35%, the base case as a full series[0] mark, an optional price
 * marker (ink, 2 dp line + label) and an optional "your value" marker (accent ring + label). Labels above the bar
 * name the scenarios; nice ticks below it give the scale.
 *
 * Motion: markers glide (`spatial`) when the price or your value changes (typing a price in the report moves the
 * marker); reduced motion moves them at once.
 */

/**
 * A range bar. [format] formats every figure ("$101"). [scenarioLabels] name the bear, base and bull marks;
 * [price] / [yourValue] are optional markers with [priceLabel] / [yourLabel]. [contentDescription] defaults to a
 * sentence built from the figures ("Bear $101, base $128, bull $157, price $142").
 */
@Composable
fun RangeBar(
    bear: Double,
    bull: Double,
    format: (Double) -> String,
    modifier: Modifier = Modifier,
    base: Double? = null,
    price: Double? = null,
    yourValue: Double? = null,
    scenarioLabels: Triple<String, String, String> = Triple("Bear", "Base", "Bull"),
    priceLabel: String = "Price",
    yourLabel: String = "Your value",
    showAxis: Boolean = true,
    contentDescription: String? = null,
    emptyText: String = CHART_NO_DATA,
) {
    val lo = min(bear.finiteOrNull() ?: Double.NaN, bull.finiteOrNull() ?: Double.NaN)
    val hi = max(bear.finiteOrNull() ?: Double.NaN, bull.finiteOrNull() ?: Double.NaN)
    if (lo.isNaN() || hi.isNaN()) {
        ChartEmpty(emptyText, modifier)
        return
    }
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val measurer = rememberTextMeasurer()
    val fmt by rememberUpdatedState(format)
    val baseV = base.finiteOrNull()
    val priceV = price.finiteOrNull()
    val yourV = yourValue.finiteOrNull()
    val axis = remember(lo, hi, baseV, priceV, yourV) { ChartMath.niceScale(listOf(lo, hi, baseV, priceV, yourV)) }

    // Markers glide between values (draw-phase reads).
    val priceAnim = remember { Animatable(priceV?.toFloat() ?: Float.NaN) }
    val yourAnim = remember { Animatable(yourV?.toFloat() ?: Float.NaN) }
    LaunchedEffect(priceV) { glide(priceAnim, priceV, reduced) }
    LaunchedEffect(yourV) { glide(yourAnim, yourV, reduced) }

    val density = LocalDensity.current
    val lineH = with(density) { ThesisType.tick.lineHeight.toDp() }
    val gap = ChartDims.tickGap
    val barZone = ChartDims.rangeBar + ChartDims.markerOverhang * 2
    val markerRow = if (priceV != null || yourV != null) lineH + gap else 0.dp
    val axisRow = if (showAxis) lineH + gap else 0.dp
    val total = lineH + gap + barZone + markerRow + axisRow

    val (bearName, baseName, bullName) = scenarioLabels
    val spoken = contentDescription ?: listOfNotNull(
        "$bearName ${format(lo)}",
        baseV?.let { "${baseName.lowercase()} ${format(it)}" },
        "${bullName.lowercase()} ${format(hi)}",
        priceV?.let { "${priceLabel.lowercase()} ${format(it)}" },
        yourV?.let { "${yourLabel.lowercase()} ${format(it)}" },
    ).joinToString(", ")

    Spacer(
        modifier
            .fillMaxWidth()
            .height(total)
            .semantics { this.contentDescription = spoken }
            .drawWithCache {
                val tickStyle = ChartText.tick.copy(color = p.muted)
                val nameStyle = ChartText.tick.copy(color = p.ink2)
                val markStyle = ChartText.endLabel.copy(color = p.ink)
                val yourStyle = ChartText.endLabel.copy(color = p.accent)
                val scenario = listOfNotNull(
                    lo to measurer.line("$bearName ${fmt(lo)}", nameStyle),
                    baseV?.let { it to measurer.line("$baseName ${fmt(it)}", nameStyle) },
                    hi to measurer.line("$bullName ${fmt(hi)}", nameStyle),
                )
                val tickLayouts = axis.ticks.map { it to measurer.line(fmt(it), tickStyle) }
                val lineHpx = lineH.toPx()
                val gapPx = gap.toPx()
                val over = ChartDims.markerOverhang.toPx()
                val barH = ChartDims.rangeBar.toPx()
                val barTop = lineHpx + gapPx + over
                val barMid = barTop + barH / 2f
                val markerTop = barTop + barH + over + gapPx
                val axisTop = markerTop + markerRow.toPx()
                val inset = max(ChartDims.yourRing.toPx() + ChartDims.markerStroke.toPx(), 1f)
                val left = inset
                val right = size.width - inset
                fun x(v: Double) = (left + axis.fraction(v) * (right - left)).toFloat()
                fun spread(items: List<Pair<Float, TextLayoutResult>>): List<Float> {
                    if (items.isEmpty()) return emptyList()
                    val widest = items.maxOf { it.second.size.width }.toFloat()
                    return ChartMath.spreadLabels(items.map { it.first }, widest + gapPx * 2, widest / 2f, size.width - widest / 2f)
                }
                val scenarioX = spread(scenario.map { x(it.first) to it.second })
                val radius = CornerRadius(ChartDims.trackRadius.toPx())
                val markW = ChartDims.markerStroke.toPx()
                val gridW = ChartDims.hairline.toPx()
                val gold = p.series[0]
                val priceLayout = priceV?.let { measurer.line("$priceLabel ${fmt(it)}", markStyle) }
                val yourLayout = yourV?.let { measurer.line("$yourLabel ${fmt(it)}", yourStyle) }

                onDrawBehind {
                    // Scenario names above the bar.
                    scenario.forEachIndexed { i, (_, layout) ->
                        val w = layout.size.width.toFloat()
                        drawText(layout, topLeft = Offset((scenarioX[i] - w / 2f).coerceIn(0f, size.width - w), 0f))
                    }
                    // Track, band, base.
                    drawRoundRect(p.grid, Offset(left, barTop), Size(right - left, barH), radius)
                    drawRoundRect(gold.copy(alpha = ChartAlpha.RANGE_BAND), Offset(x(lo), barTop), Size(x(hi) - x(lo), barH), radius)
                    if (baseV != null) {
                        val bx = x(baseV)
                        drawLine(gold, Offset(bx, barTop - over / 2f), Offset(bx, barTop + barH + over / 2f), ChartDims.baseTick.toPx(), StrokeCap.Round)
                    }
                    // Markers.
                    val labels = ArrayList<Pair<Float, TextLayoutResult>>()
                    val pv = priceAnim.value
                    if (!pv.isNaN() && priceLayout != null) {
                        val px = x(pv.toDouble())
                        drawLine(p.ink, Offset(px, barTop - over), Offset(px, barTop + barH + over), markW, StrokeCap.Round)
                        labels += px to priceLayout
                    }
                    val yv = yourAnim.value
                    if (!yv.isNaN() && yourLayout != null) {
                        val yx = x(yv.toDouble())
                        drawCircle(p.surface, ChartDims.yourRing.toPx(), Offset(yx, barMid))
                        drawCircle(p.accent, ChartDims.yourRing.toPx(), Offset(yx, barMid), style = Stroke(markW))
                        labels += yx to yourLayout
                    }
                    val labelX = spread(labels)
                    labels.forEachIndexed { i, (_, layout) ->
                        val w = layout.size.width.toFloat()
                        drawText(layout, topLeft = Offset((labelX[i] - w / 2f).coerceIn(0f, size.width - w), markerTop))
                    }
                    // Axis ticks below.
                    if (showAxis) {
                        tickLayouts.forEach { (v, layout) ->
                            val tx = x(v)
                            drawLine(p.axis, Offset(tx, axisTop - gapPx / 2f), Offset(tx, axisTop - gapPx), gridW)
                            val w = layout.size.width.toFloat()
                            drawText(layout, topLeft = Offset((tx - w / 2f).coerceIn(0f, size.width - w), axisTop))
                        }
                    }
                }
            },
    )
}

private suspend fun glide(anim: Animatable<Float, AnimationVector1D>, target: Double?, reduced: Boolean) {
    val t = target?.toFloat() ?: Float.NaN
    if (t.isNaN() || anim.value.isNaN() || reduced) anim.snapTo(t) else anim.animateTo(t, ThesisMotion.spatial())
}
