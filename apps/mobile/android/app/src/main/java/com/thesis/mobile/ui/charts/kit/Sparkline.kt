package com.thesis.mobile.ui.charts.kit

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette

/*
 * Sparkline (section 3 "Charts"): a 1.5 dp line, monochrome `ink` @ 60% (gold `series[0]` only for the subject: marks
 * take the bright gold, the text gold `accent` is for words), an optional
 * area fill from 18% to 0, an end dot r 2.5. Draws on left to right once per data identity ([dataKey]). Not
 * scrubbable (section 4.6: the Weekly digest sparkline is not).
 */

/**
 * A sparkline of [values] (gaps break the line; a reading alone between gaps is a dot). [subject] = true draws it
 * in the subject gold (the one subject on a screen). [dataKey] is the data identity for the draw-on (the latest
 * reading date); it is kept apart from a LineChart's, so both can use the same date. [contentDescription] is what TalkBack reads ("Macro stress, 30 days, from 41 to 58, now 58"); build it
 * with [ChartMath.summary]. With no finite value it draws a dashed `line2` midline (an honest absence).
 */
@Composable
fun Sparkline(
    values: List<Double?>,
    contentDescription: String,
    modifier: Modifier = Modifier,
    subject: Boolean = false,
    fill: Boolean = false,
    height: Dp = ChartHeights.Sparkline,
    dataKey: Any? = null,
) {
    val p = LocalThesisPalette.current
    val reveal = rememberDrawOn(DrawOnKind.Sparkline, dataKey)
    val clean = values.sanitized()
    val color = if (subject) p.series[0] else p.ink.copy(alpha = ChartAlpha.SPARK_INK)
    Spacer(
        modifier
            .fillMaxWidth()
            .height(height)
            .then(reveal.modifier)
            .semantics { this.contentDescription = contentDescription }
            .drawWithCache {
                val lineW = ChartDims.sparkLine.toPx()
                val dotR = ChartDims.sparkDot.toPx()
                val pad = dotR + lineW
                val scale = ChartMath.niceScale(clean).let { s ->
                    // Fit the data, not the nice ticks: a sparkline has no axis.
                    val f = clean.finiteValues()
                    if (f.isEmpty()) s else NiceScale(f.min(), f.max(), 1.0, emptyList()).takeIf { f.max() > f.min() } ?: s
                }
                val n = clean.size
                val left = pad
                val right = size.width - pad
                val top = pad
                val bottom = size.height - pad
                fun x(i: Int) = if (n <= 1) right else left + i * (right - left) / (n - 1)
                fun y(v: Double) = (bottom - scale.fraction(v) * (bottom - top)).toFloat()
                val line = Path()
                val area = Path()
                val dots = ArrayList<Offset>()
                var open = false
                var runStart = -1
                fun closeArea(end: Int) {
                    if (runStart >= 0 && end > runStart) {
                        area.lineTo(x(end), size.height)
                        area.lineTo(x(runStart), size.height)
                        area.close()
                    }
                    runStart = -1
                }
                for (i in 0 until n) {
                    val v = clean[i]
                    if (v == null) {
                        if (open) closeArea(i - 1)
                        open = false
                        continue
                    }
                    if (!open) {
                        line.moveTo(x(i), y(v))
                        area.moveTo(x(i), y(v))
                        runStart = i
                        // A reading with a gap (or the end) on both sides has no segment: draw it as a dot.
                        if (i + 1 >= n || clean[i + 1] == null) dots += Offset(x(i), y(v))
                    } else {
                        line.lineTo(x(i), y(v))
                        area.lineTo(x(i), y(v))
                    }
                    open = true
                }
                if (open) closeArea(n - 1)
                val lastIndex = clean.lastFiniteIndex()
                val end = if (lastIndex >= 0) Offset(x(lastIndex), y(clean[lastIndex]!!)) else null
                val stroke = Stroke(lineW, cap = StrokeCap.Round, join = StrokeJoin.Round)
                val areaBrush = Brush.verticalGradient(listOf(color.copy(alpha = ChartAlpha.SPARK_AREA), Color.Transparent))
                val dash = PathEffect.dashPathEffect(floatArrayOf(Kit.dash.toPx(), Kit.dashGap.toPx()))
                onDrawBehind {
                    if (end == null) {
                        drawLine(p.line2, Offset(0f, size.height / 2f), Offset(size.width, size.height / 2f), lineW, pathEffect = dash)
                        return@onDrawBehind
                    }
                    val r = reveal.value
                    clipRect(right = if (r < 1f) left + (right - left + pad) * r else size.width) {
                        if (fill) drawPath(area, areaBrush)
                        drawPath(line, color, style = stroke)
                        dots.forEach { drawCircle(color, lineW, it) }
                    }
                    val a = labelAlpha(r)
                    if (a > 0f) drawCircle(color, dotR, end, alpha = a)
                }
            },
    )
}
