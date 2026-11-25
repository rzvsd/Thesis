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
import com.thesis.mobile.ui.copy.ChartCopy
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
 * name the scenarios, each over its own mark and moved only as far as its neighbour needs (the base name gives way
 * when the three do not fit); the marker labels sit under their markers, one line each when both are shown, so a
 * label never drifts from its marker. Nice ticks below give the scale. Bear equal to bull shows one label and the
 * gold tick (a zero-width band would be invisible). Any width, including 0, draws without throwing.
 *
 * Motion: markers glide (`spatial`) when the price or your value changes (typing a price in the report moves the
 * marker), the axis domain glides with them and changed ticks and marker figures crossfade; reduced motion moves
 * them at once and keeps the crossfades (`Quick`).
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
    scenarioLabels: Triple<String, String, String> = Triple(ChartCopy.BEAR, ChartCopy.BASE, ChartCopy.BULL),
    priceLabel: String = ChartCopy.PRICE,
    yourLabel: String = ChartCopy.YOUR_VALUE,
    showAxis: Boolean = true,
    contentDescription: String? = null,
    emptyText: String = ChartCopy.NO_DATA,
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

    // Markers glide between values (draw-phase reads), and the axis glides with them on the same spring, so a
    // price that moves outside the range widens the scale smoothly instead of the band and ticks jumping on the
    // first frame. Changed tick labels crossfade. Reduced motion moves everything at once and crossfades the
    // ticks (`Quick`).
    val priceAnim = remember { Animatable(priceV?.toFloat() ?: Float.NaN) }
    val yourAnim = remember { Animatable(yourV?.toFloat() ?: Float.NaN) }
    LaunchedEffect(priceV) { glide(priceAnim, priceV, reduced) }
    LaunchedEffect(yourV) { glide(yourAnim, yourV, reduced) }
    val axisHolder = remember { AxisMoveHolder() }
    val axisMove = remember(axis) {
        val prev = axisHolder.last
        val running = axisHolder.running
        val from = when {
            prev == null || prev == axis -> null
            running?.from != null && running.progress.value < 1f && !reduced -> {
                val t = running.progress.value
                running.from.lerpTo(prev, t).copy(ticks = if (t < 0.5f) running.from.ticks else prev.ticks)
            }
            else -> prev
        }
        AxisMove(from, Animatable(if (from == null) 1f else 0f))
    }
    SideEffect {
        axisHolder.last = axis
        axisHolder.running = axisMove
    }
    LaunchedEffect(axisMove) {
        if (axisMove.from != null) axisMove.progress.animateTo(1f, if (reduced) ThesisMotion.quick<Float>() else ThesisMotion.spatial<Float>())
    }
    // A marker's label rides its marker; a changed figure hands over (`Quick`, old out then new in) instead of jumping.
    val priceFade = rememberTextFade(priceV?.let { "$priceLabel ${format(it)}" })
    val yourFade = rememberTextFade(yourV?.let { "$yourLabel ${format(it)}" })

    val density = LocalDensity.current
    val lineH = with(density) { ThesisType.tick.lineHeight.toDp() }
    val gap = ChartDims.tickGap
    val barZone = ChartDims.rangeBar + ChartDims.markerOverhang * 2
    // One line per marker label: price, then your value under it (never pushed sideways off its marker).
    val markerLines = listOfNotNull(priceV, yourV).size
    val markerRow = if (markerLines > 0) lineH * markerLines + gap else 0.dp
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
                val same = lo == hi
                val scenarioAll = if (same) {
                    listOfNotNull(
                        lo to measurer.line(ChartCopy.sameRange(bearName, bullName, fmt(lo)), nameStyle),
                        baseV?.takeIf { it != lo }?.let { it to measurer.line("$baseName ${fmt(it)}", nameStyle) },
                    )
                } else {
                    listOfNotNull(
                        lo to measurer.line("$bearName ${fmt(lo)}", nameStyle),
                        baseV?.let { it to measurer.line("$baseName ${fmt(it)}", nameStyle) },
                        hi to measurer.line("$bullName ${fmt(hi)}", nameStyle),
                    )
                }
                val from = axisMove.from
                val tickLayouts = axis.ticks.map { it to measurer.line(fmt(it), tickStyle) }
                val fromTickLayouts = from?.ticks?.map { it to measurer.line(fmt(it), tickStyle) }.orEmpty()
                val sameTicks = from != null && from.ticks == axis.ticks
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
                val right = max(left, size.width - inset)
                // Left edge of a label of width [w] centred on [c], kept inside the canvas (any width, even 0).
                fun leftOf(c: Float, w: Float) = (c - w / 2f).coerceIn(0f, max(0f, size.width - w))
                val labelGap = gapPx * 2
                // The base name gives way first when the three names do not fit side by side.
                val scenario = if (scenarioAll.size == 3 && !ChartMath.fitsInRow(scenarioAll.map { it.second.size.width.toFloat() }, labelGap, size.width)) {
                    listOf(scenarioAll[0], scenarioAll[2])
                } else {
                    scenarioAll
                }
                val radius = CornerRadius(ChartDims.trackRadius.toPx())
                val markW = ChartDims.markerStroke.toPx()
                val gridW = ChartDims.hairline.toPx()
                val gold = p.series[0]
                val priceLayout = priceFade.text?.let { measurer.line(it, markStyle) }
                val priceOld = priceFade.from?.let { measurer.line(it, markStyle) }
                val yourLayout = yourFade.text?.let { measurer.line(it, yourStyle) }
                val yourOld = yourFade.from?.let { measurer.line(it, yourStyle) }

                onDrawBehind {
                    val m = axisMove.progress.value
                    val moving = from != null && m < 1f
                    val sc = if (moving && !reduced) from!!.lerpTo(axis, m) else axis
                    fun x(v: Double) = (left + sc.fraction(v) * (right - left)).toFloat()
                    /** [layout] centred on [c] at [top]; a changed figure hands over from [old] in sequence by [mix]. */
                    fun label(layout: TextLayoutResult, old: TextLayoutResult?, mix: Float, c: Float, top: Float) {
                        if (old != null && mix < 1f) drawText(old, topLeft = Offset(leftOf(c, old.size.width.toFloat()), top), alpha = MorphFrom.outgoing(mix))
                        drawText(layout, topLeft = Offset(leftOf(c, layout.size.width.toFloat()), top), alpha = if (old != null) MorphFrom.incoming(mix) else 1f)
                    }
                    // Scenario names above the bar, each over its mark.
                    val scenarioX = ChartMath.spreadSpans(
                        scenario.map { x(it.first) },
                        scenario.map { it.second.size.width.toFloat() },
                        labelGap,
                        0f,
                        size.width,
                    )
                    scenario.forEachIndexed { i, (_, layout) ->
                        drawText(layout, topLeft = Offset(leftOf(scenarioX[i], layout.size.width.toFloat()), 0f))
                    }
                    // Track, band, base.
                    drawRoundRect(p.grid, Offset(left, barTop), Size(right - left, barH), radius)
                    val bandW = x(hi) - x(lo)
                    if (bandW >= markW) {
                        drawRoundRect(gold.copy(alpha = ChartAlpha.RANGE_BAND), Offset(x(lo), barTop), Size(bandW, barH), radius)
                    } else {
                        // Bear equals bull: a zero-width band would vanish, so the range is the gold tick itself.
                        drawLine(gold, Offset(x(lo), barTop - over / 2f), Offset(x(lo), barTop + barH + over / 2f), ChartDims.baseTick.toPx(), StrokeCap.Round)
                    }
                    if (baseV != null) {
                        val bx = x(baseV)
                        drawLine(gold, Offset(bx, barTop - over / 2f), Offset(bx, barTop + barH + over / 2f), ChartDims.baseTick.toPx(), StrokeCap.Round)
                    }
                    // Markers, each label on its own line under its marker.
                    var line = 0
                    val pv = priceAnim.value
                    if (!pv.isNaN() && priceLayout != null) {
                        val px = x(pv.toDouble())
                        drawLine(p.ink, Offset(px, barTop - over), Offset(px, barTop + barH + over), markW, StrokeCap.Round)
                        label(priceLayout, priceOld, priceFade.progress.value, px, markerTop + line * lineHpx)
                        line++
                    }
                    val yv = yourAnim.value
                    if (!yv.isNaN() && yourLayout != null) {
                        val yx = x(yv.toDouble())
                        drawCircle(p.surface, ChartDims.yourRing.toPx(), Offset(yx, barMid))
                        drawCircle(p.accent, ChartDims.yourRing.toPx(), Offset(yx, barMid), style = Stroke(markW))
                        label(yourLayout, yourOld, yourFade.progress.value, yx, markerTop + line * lineHpx)
                    }
                    // Axis ticks below: unchanged ticks glide with the axis, changed ones crossfade.
                    fun ticksLayer(layouts: List<Pair<Double, TextLayoutResult>>, alpha: Float) {
                        if (alpha <= 0f) return
                        layouts.forEach { (v, layout) ->
                            val tx = x(v)
                            if (tx < left - 0.5f || tx > right + 0.5f) return@forEach
                            drawLine(p.axis.copy(alpha = p.axis.alpha * alpha), Offset(tx, axisTop - gapPx / 2f), Offset(tx, axisTop - gapPx), gridW)
                            drawText(layout, topLeft = Offset(leftOf(tx, layout.size.width.toFloat()), axisTop), alpha = alpha)
                        }
                    }
                    if (showAxis) {
                        if (!moving || sameTicks) {
                            ticksLayer(tickLayouts, 1f)
                        } else {
                            ticksLayer(fromTickLayouts, 1f - m)
                            ticksLayer(tickLayouts, m)
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

/** The axis a [RangeBar] glides from ([from], null when it is not moving) and the glide's progress. */
private class AxisMove(val from: NiceScale?, val progress: Animatable<Float, AnimationVector1D>)

private class AxisMoveHolder {
    var last: NiceScale? = null
    var running: AxisMove? = null
}

/** A label whose text changed: [from] (the old text, crossfading out) to [text] over [progress]. */
private class TextFade(val from: String?, val text: String?, val progress: Animatable<Float, AnimationVector1D>)

@Composable
private fun rememberTextFade(text: String?): TextFade {
    val last = remember { arrayOfNulls<String>(1) }
    val fade = remember(text) {
        val prev = last[0]
        val from = prev?.takeIf { text != null && it != text }
        TextFade(from, text, Animatable(if (from == null) 1f else 0f))
    }
    SideEffect { last[0] = text }
    LaunchedEffect(fade) {
        if (fade.from != null) fade.progress.animateTo(1f, ThesisMotion.quick())
    }
    return fade
}
