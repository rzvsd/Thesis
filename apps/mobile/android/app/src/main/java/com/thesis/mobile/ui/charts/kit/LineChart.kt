package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.inset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.ChartReadout
import com.thesis.mobile.ui.components.drawReadoutCursor
import com.thesis.mobile.ui.copy.ChartCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.markColor
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/*
 * LineChart (section 3 "Charts", 4.6): one y axis with about 4 nice ticks, horizontal grid lines, an axis
 * baseline, x labels thinned from the last, 2 dp lines with round caps, an end dot (r 4, 2 dp surface ring) and
 * only the latest value labelled (11 / 600 with a 3 dp halo). Optional regime bands (6% fills).
 *
 * Motion: draws on once per data identity ([dataKey]); a data change with the same identity (a range tap)
 * morphs: both versions resampled to 120 points, y lerped over `Morph` 500 ms `EaseCalm`, the axis domain lerped,
 * the tick labels crossfaded and the x labels handed over in sequence (old out, then new in). The end dots and the
 * latest-value labels ride the morphing ends (a changed figure crossfades). Reduced motion: complete on first
 * paint, range changes crossfade (`Quick`), labels included.
 *
 * Gestures (with a [LineChartState]): one-finger horizontal drag after the touch slop scrubs (vertical drags
 * still scroll the page); two fingers compare the window between them. `gestureStart()` / `gestureEnd()`,
 * `tick()` on week boundaries and `segment()` across a regime line (4.7).
 */

/** Scrub and compare state of a [LineChart]; read by [LineChartReadout]. Hoist it with [rememberLineChartState]. */
@Stable
class LineChartState {
    /** The scrubbed point, or -1. */
    var scrubIndex: Int by mutableIntStateOf(-1)
        private set

    /** The two-finger window, or null. */
    var compareRange: IntRange? by mutableStateOf(null)
        private set

    /** True while a finger rewrites the readout. */
    val active: Boolean get() = scrubIndex >= 0 || compareRange != null

    /** Scrubs to [index] (also for tests and previews). */
    fun scrubTo(index: Int) {
        compareRange = null
        scrubIndex = index
    }

    /** Compares the window from [a] to [b] (either order). */
    fun compare(a: Int, b: Int) {
        scrubIndex = -1
        compareRange = min(a, b)..max(a, b)
    }

    /** Lets go: the readout returns to "now". */
    fun release() {
        scrubIndex = -1
        compareRange = null
    }
}

@Composable
fun rememberLineChartState(): LineChartState = remember { LineChartState() }

/** What a line chart shows at rest: values (after indexing), the scale and the x labels. */
@Immutable
internal data class LineFrame(
    val names: List<String>,
    val colorSlots: List<Int>,
    val values: List<List<Double?>>,
    val scale: NiceScale,
    val labels: List<String>,
    val indexed: Boolean = false,
) {
    val count: Int get() = labels.size.coerceAtLeast(values.maxOfOrNull { it.size } ?: 0)
    val isEmpty: Boolean get() = values.all { s -> s.all { it == null } }

    /** The curves resampled for a morph. */
    fun curves(): Map<String, DoubleArray> = names.indices.associate { names[it] to ChartMath.resample(values[it]) }
}

/** A morph's starting point: resampled curves, the scale and labels it had. */
internal class MorphFrom(val curves: Map<String, DoubleArray>, val colorSlots: Map<String, Int>, val scale: NiceScale, val labels: List<String>) {
    /** Where a running morph from this toward [target] is at [t]. */
    fun toward(target: LineFrame, t: Float): MorphFrom {
        val to = target.curves()
        val merged = to.mapValues { (name, curve) -> curves[name]?.let { ChartMath.lerp(it, curve, t) } ?: curve }
        return MorphFrom(
            merged,
            target.names.indices.associate { target.names[it] to target.colorSlots[it] },
            scale.lerpTo(target.scale, t),
            if (t < 0.5f) labels else target.labels,
        )
    }

    companion object {
        fun of(frame: LineFrame) = MorphFrom(
            frame.curves(),
            frame.names.indices.associate { frame.names[it] to frame.colorSlots[it] },
            frame.scale,
            frame.labels,
        )
    }
}

/** Plot geometry shared between the draw pass and the gesture handler. */
private class PlotGeometry {
    var left = 0f
    var right = 0f
    var count = 0
}

/**
 * The morph bookkeeping a [LineChart] keeps across recompositions: the frame shown last and the running morph
 * (where it started, its progress), so a second range tap mid-morph starts from where the line is.
 */
private class MorphHolder {
    var last: LineFrame? = null
    var running: Morph? = null
}

/** One range change: [from] (null when there is nothing to morph from) and its progress 0 to 1. */
private class Morph(val from: MorphFrom?, val progress: Animatable<Float, AnimationVector1D>)

/**
 * The line chart. [data] holds the series, x labels (and optional dates); [valueFormat] formats the end labels
 * and readout, [tickFormat] the y ticks. [bands] paint regimes and are the scrub's regime lines. [yRange] pins
 * the axis (Macro stress 0 to 100); [includeZero] keeps 0 on it. With [state] the chart scrubs; pass
 * [LineChartData.dates] then, so the scrub ticks on real weeks. [dataKey] is the data identity for the draw-on
 * (the latest reading date, not the range); it is namespaced per chart kind, so a Sparkline of the same series can
 * use the same date, but two LineCharts on screen need keys of their own. [summary] is what TalkBack reads; by
 * default it is built from the data ("Gross margin, from 40.0% to 46.9%, now 46.9%").
 */
@Composable
fun LineChart(
    data: LineChartData,
    modifier: Modifier = Modifier,
    valueFormat: (Double) -> String = { Fmt.number(it, 1) },
    tickFormat: (Double) -> String = valueFormat,
    height: Dp = ChartHeights.Compact,
    bands: List<ChartBand> = emptyList(),
    yRange: ClosedFloatingPointRange<Double>? = null,
    includeZero: Boolean = false,
    state: LineChartState? = null,
    dataKey: Any? = null,
    summary: String? = null,
    emptyText: String = ChartCopy.NO_DATA,
) {
    val density = LocalDensity.current
    // Fixed plot height (section 3), plus whatever the user's font size adds to the x label line.
    val extra = with(density) { (ThesisType.tick.lineHeight.toDp() - ThesisType.tick.lineHeight.value.dp).coerceAtLeast(0.dp) }
    if (data.isEmpty) {
        ChartEmpty(emptyText, modifier, minHeight = height + extra)
        return
    }
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val measurer = rememberTextMeasurer()
    val haptics = rememberHaptics()
    val currentHaptics by rememberUpdatedState(haptics)
    val reveal = rememberDrawOn(DrawOnKind.Line, dataKey)
    val holder = remember { MorphHolder() }
    val geometry = remember { PlotGeometry() }

    val target = remember(data, yRange, includeZero, bands) {
        LineFrame(
            names = data.series.map { it.name },
            colorSlots = data.series.mapIndexed { i, s -> s.colorIndex ?: i },
            values = data.plotted,
            scale = ChartMath.niceScale(data.plotted.flatten(), includeZero = includeZero, fixed = yRange),
            labels = List(data.count) { data.labelAt(it) },
            indexed = data.indexed,
        )
    }
    // The morph's start is decided in composition (not in an effect), so the frame on which the data changes
    // already draws the old line: no one-frame flash of the new data before the morph starts. It reads only what
    // applied compositions committed (the SideEffect below), so a discarded composition cannot skew the next morph.
    val morph = remember(target) {
        val prev = holder.last
        val before = holder.running
        val from = when {
            prev == null || prev == target || prev.isEmpty || reveal.value < 1f -> null
            before?.from != null && before.progress.value < 1f -> before.from.toward(prev, before.progress.value)
            else -> MorphFrom.of(prev)
        }
        Morph(from, Animatable(if (from == null) 1f else 0f))
    }
    SideEffect {
        holder.last = target
        holder.running = morph
    }
    LaunchedEffect(morph) {
        if (morph.from == null) return@LaunchedEffect
        morph.progress.animateTo(
            1f,
            if (reduced) ThesisMotion.timed(false, ThesisMotion.Quick) else ThesisMotion.timed(false, ThesisMotion.Morph, easing = ThesisMotion.EaseCalm),
        )
    }

    val boundaries = remember(bands) { bands.flatMap { listOf(it.from, it.to) }.distinct().sorted() }
    val description = summary ?: remember(data, valueFormat) {
        data.series.indices.joinToString("; ") { i -> ChartMath.summary(data.series[i].name, data.plotted[i], valueFormat) }
    }
    val values by rememberUpdatedState(data)
    val format by rememberUpdatedState(valueFormat)
    val ticks by rememberUpdatedState(tickFormat)

    val gestures = if (state == null) {
        Modifier
    } else {
        Modifier.pointerInput(state, boundaries) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                var mode = GestureMode.Undecided
                val slop = viewConfiguration.touchSlop
                fun indexAt(x: Float) = ChartMath.indexAt(x, geometry.left, geometry.right, geometry.count)
                while (true) {
                    val event = awaitPointerEvent()
                    val pressed = event.changes.filter { it.pressed }
                    if (pressed.isEmpty()) break
                    if (pressed.size >= 2) {
                        if (mode == GestureMode.Undecided) currentHaptics.gestureStart()
                        mode = GestureMode.Compare
                        state.compare(indexAt(pressed[0].position.x), indexAt(pressed[1].position.x))
                        pressed.forEach { it.consume() }
                        continue
                    }
                    if (mode == GestureMode.Compare) {
                        // One finger lifted: keep the window until both are up.
                        pressed.forEach { it.consume() }
                        continue
                    }
                    val change = pressed[0]
                    if (mode == GestureMode.Undecided) {
                        if (change.isConsumed) break
                        val d = change.position - down.position
                        if (abs(d.x) > slop && abs(d.x) > abs(d.y)) {
                            mode = GestureMode.Scrub
                            currentHaptics.gestureStart()
                            state.scrubTo(indexAt(change.position.x))
                            change.consume()
                        } else if (abs(d.y) > slop) {
                            break // a vertical drag belongs to the page
                        }
                    } else {
                        val prev = state.scrubIndex
                        val next = indexAt(change.position.x)
                        if (next != prev) {
                            when (ChartMath.scrubHaptic(prev, next, values.primaryValues, boundaries, values.weekKeys)) {
                                ScrubHaptic.Segment -> currentHaptics.segment()
                                ScrubHaptic.Tick -> currentHaptics.tick()
                                ScrubHaptic.None -> Unit
                            }
                            state.scrubTo(next)
                        }
                        change.consume()
                    }
                }
                if (mode != GestureMode.Undecided) {
                    currentHaptics.gestureEnd()
                    state.release()
                }
            }
        }
    }

    Spacer(
        modifier
            .fillMaxWidth()
            .height(height + extra)
            .semantics { contentDescription = description }
            .then(gestures)
            .drawWithCache {
                val from = morph.from
                val tickStyle = ChartText.tick.copy(color = p.muted)
                val endStyle = ChartText.endLabel.copy(color = p.ink)
                val tickLayouts = target.scale.ticks.map { it to measurer.line(ticks(it), tickStyle) }
                val fromTickLayouts = from?.scale?.ticks?.map { it to measurer.line(ticks(it), tickStyle) }.orEmpty()
                val xLayouts = target.labels.map { measurer.line(it, tickStyle) }
                val fromXLayouts = from?.labels?.map { measurer.line(it, tickStyle) }.orEmpty()
                val endTexts = target.values.map { s -> s.lastOrNull { it != null }?.let { format(it) } }
                val endLayouts = endTexts.map { t -> t?.let { measurer.line(it, endStyle) } }
                // The figures the outgoing frame showed at its ends (a morph crossfades them when they change).
                val fromEndTexts = from?.curves?.mapValues { (_, c) -> c.lastOrNull { !it.isNaN() }?.let { format(it) } }.orEmpty()
                val fromEndLayouts = fromEndTexts.mapValues { (_, t) -> t?.let { measurer.line(it, endStyle) } }
                val bandStyle = ChartText.tick.copy(color = p.muted)
                val bandLayouts = bands.map { b -> b.label?.let { measurer.line(it, bandStyle) } }
                val refLayout = if (target.indexed) measurer.line(ticks(INDEX_BASE), tickStyle) else null

                val tickGap = ChartDims.tickGap.toPx()
                val leftW = (tickLayouts + fromTickLayouts).maxOfOrNull { it.second.size.width }?.toFloat()?.plus(tickGap) ?: 0f
                val dotR = ChartDims.endDot.toPx()
                val ringW = ChartDims.endRing.toPx()
                val endW = endLayouts.maxOfOrNull { it?.size?.width ?: 0 }?.toFloat() ?: 0f
                val rightW = dotR + ringW + if (endW > 0f) ChartDims.endLabelGap.toPx() + endW else 0f
                val xLabelH = (xLayouts.firstOrNull() ?: measurer.line("0", tickStyle)).size.height.toFloat()
                val plot = Rect(
                    left = leftW,
                    top = ChartDims.plotTop.toPx(),
                    right = max(leftW + 1f, size.width - rightW),
                    bottom = max(ChartDims.plotTop.toPx() + 1f, size.height - xLabelH - ChartDims.xLabelGap.toPx()),
                )
                geometry.left = plot.left
                geometry.right = plot.right
                geometry.count = target.count

                val lineW = ChartDims.line.toPx()
                val stroke = Stroke(lineW, cap = StrokeCap.Round, join = StrokeJoin.Round)
                val halo = ChartDims.halo.toPx()
                val xSpacing = ChartDims.xLabelSpacing.toPx()
                val gridW = ChartDims.hairline.toPx()
                // Over 6% regime bands the plain grid colour all but vanishes (dark: 1 to 3 levels): line2 there.
                val gridColor = if (bands.isEmpty()) p.grid else p.line2.copy(alpha = ChartAlpha.BAND_GRID)
                val gridSkip = ChartDims.gridSkip.toPx()
                val labelGap = ChartDims.endLabelGap.toPx()
                val bandInset = ChartDims.bandLabelInset.toPx()

                fun xOf(i: Int, count: Int): Float =
                    if (count <= 1) plot.right else plot.left + i * plot.width / (count - 1)

                fun yOf(v: Double, scale: NiceScale): Float =
                    (plot.bottom - scale.fraction(v) * plot.height).toFloat()

                fun thin(layouts: List<TextLayoutResult>, count: Int): List<Int> {
                    val widest = layouts.maxOfOrNull { it.size.width }?.toFloat() ?: 0f
                    val slot = if (count <= 1) plot.width else plot.width / (count - 1)
                    return ChartMath.thinnedLabels(count, slot, widest + xSpacing)
                }
                val xShown = thin(xLayouts, target.count)
                val fromXShown = if (from != null) thin(fromXLayouts, from.labels.size) else emptyList()

                // Exact paths at rest (gaps break the line; an isolated point is drawn as a dot).
                val restPaths = target.values.map { s -> linePath(s.size, { xOf(it, target.count) }, { i -> s[i]?.let { yOf(it, target.scale) } }) }
                val endPoints = target.values.map { s ->
                    val i = s.indexOfLast { it != null }
                    if (i < 0) null else Offset(xOf(i, target.count), yOf(s[i]!!, target.scale))
                }
                val targetCurves = if (from != null) target.curves() else emptyMap()
                val scratch = Path()

                /** A line's end: its dot, its latest-value label and, while a changed figure crossfades, the old one. */
                class EndMark(val point: Offset, val color: Color, val layout: TextLayoutResult?, val alt: TextLayoutResult?, val alpha: Float)

                // End dots and latest-value labels. Labels of lines that end close together are pushed apart; a label
                // pushed off its dot gets a short leader in the line's colour. The primary series is drawn last (on top).
                fun DrawScope.drawEnds(marks: List<EndMark>, dotAlpha: Float, textAlpha: Float, mix: Float) {
                    if (marks.isEmpty()) return
                    val h = marks.firstNotNullOfOrNull { it.layout ?: it.alt }?.size?.height?.toFloat() ?: 0f
                    val ys = ChartMath.spreadLabels(marks.map { it.point.y }, h, plot.top, plot.bottom)
                    marks.forEachIndexed { j, mk ->
                        val a = mk.alpha * textAlpha
                        if (a <= 0f || abs(ys[j] - mk.point.y) <= h / 2f) return@forEachIndexed
                        drawLine(
                            mk.color.copy(alpha = mk.color.alpha * a),
                            Offset(mk.point.x + dotR + ringW, mk.point.y),
                            Offset(mk.point.x + dotR + labelGap - ringW, ys[j]),
                            gridW,
                        )
                    }
                    marks.forEach { mk ->
                        val a = mk.alpha * dotAlpha
                        if (a > 0f) drawEndDot(mk.point, mk.color.copy(alpha = mk.color.alpha * a), p.surface.copy(alpha = a), dotR, ringW)
                    }
                    marks.forEachIndexed { j, mk ->
                        val a = mk.alpha * textAlpha
                        fun place(l: TextLayoutResult) = Offset(mk.point.x + dotR + labelGap, ys[j] - l.size.height / 2f)
                        if (mk.alt != null && mix < 1f) drawHaloText(mk.alt, place(mk.alt), p.ink, p.surface, halo, a * (1f - mix))
                        if (mk.layout != null) drawHaloText(mk.layout, place(mk.layout), p.ink, p.surface, halo, if (mk.alt != null) a * mix else a)
                    }
                }
                val order = target.values.indices.sortedBy { if (it == data.primary) 1 else 0 }

                onDrawBehind {
                    val r = reveal.value
                    val m = morph.progress.value
                    val morphing = from != null && m < 1f
                    val crossfade = morphing && reduced
                    val scale = if (morphing && !crossfade) from!!.scale.lerpTo(target.scale, m) else target.scale
                    val scrub = state?.scrubIndex ?: -1
                    val window = state?.compareRange

                    // Regime bands, clipped to the plot.
                    clipRect(plot.left, plot.top, plot.right, plot.bottom) {
                        bands.forEach { b ->
                            val top = yOf(max(b.from, b.to), scale)
                            val bottom = yOf(min(b.from, b.to), scale)
                            drawRect(
                                b.tone.markColor(p).copy(alpha = ChartAlpha.BAND),
                                topLeft = Offset(plot.left, top),
                                size = androidx.compose.ui.geometry.Size(plot.width, bottom - top),
                            )
                        }
                    }

                    // Indexed mode: the reference line is 100 (the first common value), else zero or the bottom.
                    val reference = if (target.indexed && INDEX_BASE in scale.min..scale.max) INDEX_BASE else scale.baseline
                    val baseY = yOf(reference, scale).coerceIn(plot.top, plot.bottom)

                    // Grid lines and y ticks (crossfaded during a morph). A grid line a few px from the reference
                    // line is left out with its label (no double baseline in indexed mode).
                    val labelledYs = ArrayList<Float>()
                    fun ticksLayer(layouts: List<Pair<Double, TextLayoutResult>>, alpha: Float) {
                        if (alpha <= 0f || layouts.isEmpty()) return
                        val spacing = if (layouts.size > 1) abs(yOf(layouts[1].first, scale) - yOf(layouts[0].first, scale)) else plot.height
                        val labelled = ChartMath.thinnedTicks(layouts.size, spacing, layouts[0].second.size.height.toFloat()).toSet()
                        layouts.forEachIndexed { i, (v, layout) ->
                            val y = yOf(v, scale)
                            if (y < plot.top - 0.5f || y > plot.bottom + 0.5f) return@forEachIndexed
                            if (v != reference && abs(y - baseY) < gridSkip) return@forEachIndexed
                            drawLine(gridColor.copy(alpha = gridColor.alpha * alpha), Offset(plot.left, y), Offset(plot.right, y), gridW)
                            if (i in labelled) {
                                drawText(layout, topLeft = Offset(plot.left - tickGap - layout.size.width, tickLabelTop(y, layout.size.height.toFloat(), plot.bottom)), alpha = alpha)
                                labelledYs += y
                            }
                        }
                    }
                    if (morphing) {
                        ticksLayer(fromTickLayouts, 1f - m)
                        ticksLayer(tickLayouts, m)
                    } else {
                        ticksLayer(tickLayouts, 1f)
                    }
                    drawLine(p.axis, Offset(plot.left, baseY), Offset(plot.right, baseY), gridW)
                    // Indexed mode labels its reference line "100" when no tick does and there is room for it.
                    if (refLayout != null && reference == INDEX_BASE && INDEX_BASE !in target.scale.ticks) {
                        val h = refLayout.size.height.toFloat()
                        if (labelledYs.none { abs(it - baseY) < h }) {
                            drawText(refLayout, topLeft = Offset(plot.left - tickGap - refLayout.size.width, tickLabelTop(baseY, h, plot.bottom)))
                        }
                    }

                    // X labels, thinned from the last, kept inside the canvas.
                    fun xLayer(layouts: List<TextLayoutResult>, shown: List<Int>, count: Int, alpha: Float) {
                        if (alpha <= 0f) return
                        shown.forEach { i ->
                            val layout = layouts.getOrNull(i) ?: return@forEach
                            val w = layout.size.width.toFloat()
                            val x = (xOf(i, count) - w / 2f).coerceIn(0f, max(0f, size.width - w))
                            drawText(layout, topLeft = Offset(x, plot.bottom + ChartDims.xLabelGap.toPx()), alpha = alpha)
                        }
                    }
                    if (morphing) {
                        // In sequence, not at once: two label sets at 50% read as one overprinted line.
                        xLayer(fromXLayouts, fromXShown, from!!.labels.size, (1f - 2f * m).coerceIn(0f, 1f))
                        xLayer(xLayouts, xShown, target.count, (2f * m - 1f).coerceIn(0f, 1f))
                    } else {
                        xLayer(xLayouts, xShown, target.count, 1f)
                    }

                    // Two-finger window.
                    if (window != null && target.count > 1) {
                        val a = xOf(window.first, target.count)
                        val b = xOf(window.last, target.count)
                        drawRect(
                            p.ink.copy(alpha = ChartAlpha.COMPARE_SHADE),
                            topLeft = Offset(a, plot.top),
                            size = androidx.compose.ui.geometry.Size(b - a, plot.height),
                        )
                    }

                    // Lines.
                    val cursorX = if (scrub >= 0) xOf(scrub, target.count) else Float.NaN
                    val labelsAlpha = labelAlpha(r) * (if (state?.active == true) ChartAlpha.AFTER_CURSOR else 1f)
                    if (morphing && !crossfade) {
                        val marks = ArrayList<EndMark>()
                        order.forEach { k ->
                            val name = target.names[k]
                            val to = targetCurves[name] ?: return@forEach
                            val fromCurve = from!!.curves[name]
                            val curve = if (fromCurve != null) ChartMath.lerp(fromCurve, to, m) else to
                            val color = p.seriesColor(target.colorSlots[k])
                            val alpha = if (fromCurve != null) 1f else m
                            curvePath(scratch, curve, plot, scale)
                            drawPath(scratch, color, alpha = alpha, style = stroke)
                            val changed = fromEndTexts[name] != endTexts[k]
                            lastPoint(curve, plot, scale)?.let {
                                marks += EndMark(it, color, endLayouts[k], if (changed) fromEndLayouts[name] else null, alpha)
                            }
                        }
                        from!!.curves.forEach { (name, curve) ->
                            if (name in target.names) return@forEach
                            curvePath(scratch, curve, plot, scale)
                            drawPath(scratch, p.seriesColor(from.colorSlots[name] ?: 0), alpha = 1f - m, style = stroke)
                        }
                        // The ends ride the morph: the latest value never blinks out on a range tap.
                        drawEnds(marks, 1f, labelsAlpha, m)
                    } else {
                        if (crossfade) {
                            val outgoing = ArrayList<EndMark>()
                            from!!.curves.forEach { (name, curve) ->
                                val color = p.seriesColor(from.colorSlots[name] ?: 0)
                                curvePath(scratch, curve, plot, from.scale)
                                drawPath(scratch, color, alpha = 1f - m, style = stroke)
                                lastPoint(curve, plot, from.scale)?.let { outgoing += EndMark(it, color, fromEndLayouts[name], null, 1f - m) }
                            }
                            drawEnds(outgoing, 1f, labelsAlpha, 1f)
                        }
                        val alpha = if (crossfade) m else 1f
                        val revealRight = plot.left + (plot.width + dotR * 2) * r
                        if (r > 0f) target.values.forEachIndexed { k, _ ->
                            val color = p.seriesColor(target.colorSlots[k])
                            val (path, dots) = restPaths[k]
                            clipRect(right = if (r < 1f) revealRight else size.width) {
                                if (cursorX.isNaN()) {
                                    drawPath(path, color, alpha = alpha, style = stroke)
                                    dots.forEach { drawCircle(color, lineW, it, alpha = alpha) }
                                } else {
                                    clipRect(right = cursorX) { drawPath(path, color, alpha = alpha, style = stroke) }
                                    clipRect(left = cursorX) {
                                        drawPath(path, color, alpha = alpha * ChartAlpha.AFTER_CURSOR, style = stroke)
                                    }
                                    dots.forEach { drawCircle(color, lineW, it, alpha = alpha) }
                                }
                            }
                        }
                        val marks = order.mapNotNull { k ->
                            endPoints[k]?.let { EndMark(it, p.seriesColor(target.colorSlots[k]), endLayouts[k], null, alpha) }
                        }
                        drawEnds(marks, labelAlpha(r), labelsAlpha, 1f)
                    }

                    // Regime names, muted, inside the top left of each band (over the line, with a halo).
                    bands.forEachIndexed { i, b ->
                        val layout = bandLayouts[i] ?: return@forEachIndexed
                        val top = yOf(max(b.from, b.to), scale).coerceIn(plot.top, plot.bottom)
                        val bottom = yOf(min(b.from, b.to), scale).coerceIn(plot.top, plot.bottom)
                        if (bottom - top < layout.size.height + bandInset * 2) return@forEachIndexed
                        drawHaloText(layout, Offset(plot.left + bandInset, top + bandInset), p.muted, p.surface, halo, labelAlpha(r))
                    }

                    // Scrub cursor on the primary series; two cursors for a window.
                    val primary = target.values.getOrNull(data.primary).orEmpty()
                    fun cursorAt(i: Int) {
                        val v = primary.getOrNull(i) ?: return
                        val x = xOf(i, target.count)
                        inset(0f, plot.top, 0f, size.height - plot.bottom) {
                            drawReadoutCursor(x, yOf(v, scale) - plot.top, p)
                        }
                    }
                    if (scrub >= 0) cursorAt(scrub)
                    if (window != null) {
                        cursorAt(window.first)
                        cursorAt(window.last)
                    }
                }
            },
    )
}

private enum class GestureMode { Undecided, Scrub, Compare }

/** Indexed mode's reference value. */
private const val INDEX_BASE = 100.0

/** A polyline over [count] points with gaps; isolated points come back as dots. */
private fun linePath(count: Int, x: (Int) -> Float, y: (Int) -> Float?): Pair<Path, List<Offset>> {
    val path = Path()
    val dots = ArrayList<Offset>()
    var open = false
    for (i in 0 until count) {
        val yi = y(i)
        if (yi == null) {
            open = false
            continue
        }
        if (!open) {
            path.moveTo(x(i), yi)
            val nextMissing = i + 1 >= count || y(i + 1) == null
            if (nextMissing) dots += Offset(x(i), yi)
            open = true
        } else {
            path.lineTo(x(i), yi)
        }
    }
    return path to dots
}

/** Rebuilds [path] from a resampled curve (NaN breaks it). */
private fun curvePath(path: Path, curve: DoubleArray, plot: Rect, scale: NiceScale) {
    path.reset()
    var open = false
    val n = curve.size
    for (j in 0 until n) {
        val v = curve[j]
        if (v.isNaN()) {
            open = false
            continue
        }
        val x = if (n <= 1) plot.right else plot.left + j * plot.width / (n - 1)
        val y = (plot.bottom - scale.fraction(v) * plot.height).toFloat()
        if (open) path.lineTo(x, y) else path.moveTo(x, y)
        open = true
    }
}

private fun lastPoint(curve: DoubleArray, plot: Rect, scale: NiceScale): Offset? {
    val j = curve.indexOfLast { !it.isNaN() }
    if (j < 0) return null
    val n = curve.size
    val x = if (n <= 1) plot.right else plot.left + j * plot.width / (n - 1)
    return Offset(x, (plot.bottom - scale.fraction(curve[j]) * plot.height).toFloat())
}

/** End dot: r 4 in the line colour with a 2 dp ring in the card surface. */
private fun DrawScope.drawEndDot(center: Offset, color: Color, ring: Color, radius: Float, ringWidth: Float) {
    drawCircle(ring, radius + ringWidth, center)
    drawCircle(color, radius, center)
}

/**
 * The card header line of a scrubbable [LineChart] (#49): the latest primary value, [nowLabel] and the change
 * since the window start; while scrubbing the scrubbed point; with two fingers the window's change. [changeTone]
 * maps a change to its meaning (rising stress is Unfavourable; up is not automatically good), Neutral by default.
 */
@Composable
fun LineChartReadout(
    data: LineChartData,
    state: LineChartState,
    modifier: Modifier = Modifier,
    valueFormat: (Double) -> String = { Fmt.number(it, 1) },
    changeFormat: (Double) -> String = { (if (it > 0) "+" else "") + Fmt.number(it, 1) },
    nowLabel: String? = null,
    changeTone: (Double) -> Tone = { Tone.Neutral },
) {
    val format by rememberUpdatedState(valueFormat)
    val changeFmt by rememberUpdatedState(changeFormat)
    val text by remember(data, nowLabel) {
        derivedStateOf {
            ChartReadouts.readout(data, format, changeFmt, nowLabel, state.scrubIndex, state.compareRange)
        }
    }
    ChartReadout(
        value = text.value,
        date = text.date,
        modifier = modifier,
        change = text.change,
        changeTone = text.delta?.let(changeTone) ?: Tone.Neutral,
        scrubbing = state.active,
    )
}
