package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.layout.FirstBaseline
import androidx.compose.ui.layout.LastBaseline
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.util.lerp
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.tnum
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sign

/*
 * RollingNumber (docs/app-redesign/DESIGN-DIRECTION.md 4.2 `Roll`, 4.6; playbook 6.1; the NumberFlow model in
 * research/browse-reference-sites.md).
 *
 * For app-computed values that refresh in place only (macro stress score, scenario results, monitor scores,
 * digest and inbox counts). Never for market values, frozen report figures or first paint: the first composition
 * shows the value static. On a change, each digit that changed rolls through the digits in between, in the
 * direction of the change (up rolls upward), like an odometer strip; positions are keyed from the right so
 * decimals stay aligned; the rightmost digit leads and every position to its left starts 18 ms later (cap 4).
 * Non-digits never roll: a changed sign or separator crossfades, and characters that appear or leave fade while
 * the width glides. The slot's top and bottom 18% fade out while rolling (DstIn mask). No colour wash.
 * Under reduced motion every changed character crossfades over 150 ms instead (4.8).
 *
 * One node, one Animatable per change: digits are drawn from cached glyph layouts in the draw phase, the width is
 * read in the layout phase; nothing recomposes per frame. TalkBack reads the whole value once.
 */

/**
 * A number that rolls when [value] changes after first paint. [format] must be the app's formatter (`Fmt`), so the
 * text is exactly what a static figure would show. The roll direction is the sign of the change of [value].
 * [color] defaults to the style's colour, then `LocalContentColor`. Tabular figures are forced ([tnum]).
 */
@Composable
fun RollingNumber(
    value: Double,
    format: (Double) -> String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    val last = remember { DoubleArray(1) { value } }
    val trend = sign(value - last[0]).toInt()
    SideEffect { last[0] = value }
    RollingText(text = format(value), trend = trend, style = style, modifier = modifier, color = color)
}

/** [RollingNumber] for whole numbers (counts, scores). */
@Composable
fun RollingNumber(
    value: Int,
    format: (Int) -> String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    val last = remember { IntArray(1) { value } }
    val trend = (value - last[0]).sign
    SideEffect { last[0] = value }
    RollingText(text = format(value), trend = trend, style = style, modifier = modifier, color = color)
}

/**
 * The rolling text itself, for callers that already hold the formatted text and the direction of the change:
 * [trend] > 0 rolls digits upward, < 0 downward, 0 crossfades the changed characters without a roll.
 */
@Composable
fun RollingText(
    text: String,
    trend: Int,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    val reduced = LocalReducedMotion.current
    val measurer = rememberTextMeasurer(cacheSize = GLYPH_CACHE)
    val tabular = remember(style) { style.tnum() }
    val ink = color.takeOrElse { tabular.color.takeOrElse { LocalContentColor.current } }
    val glyphs = remember(measurer, tabular) { Glyphs(measurer, tabular) }
    val committed = remember { arrayOfNulls<String>(1) }
    val plan = remember(text, glyphs) {
        RollPlan.build(previous = committed[0], text = text, trend = trend.sign, reduced = reduced, glyphs = glyphs)
    }
    SideEffect { committed[0] = text }
    LaunchedEffect(plan) {
        if (plan.durationMs > 0) {
            plan.clock.animateTo(plan.durationMs.toFloat(), tween(plan.durationMs, easing = ThesisMotion.Linear))
        }
    }
    Spacer(
        modifier
            .clearAndSetSemantics {
                contentDescription = text
                this.text = AnnotatedString(text)
            }
            .layout { measurable, constraints ->
                // Layout-phase read of the clock: only the width glides; the node never recomposes per frame.
                val width = plan.width(plan.clock.value).roundToInt()
                val height = glyphs.lineHeight
                val placeable = measurable.measure(constraints.copy(minWidth = width, maxWidth = width, minHeight = height, maxHeight = height))
                layout(width, height, mapOf(FirstBaseline to glyphs.baseline, LastBaseline to glyphs.baseline)) {
                    placeable.place(0, 0)
                }
            }
            // Offscreen so the DstIn edge mask only cuts this layer; clipped to the slot.
            .graphicsLayer {
                clip = true
                compositingStrategy = CompositingStrategy.Offscreen
            }
            .drawWithCache {
                val mask = Brush.verticalGradient(
                    0f to Color.Transparent,
                    ThesisMotion.RollMaskFraction to Color.Black,
                    1f - ThesisMotion.RollMaskFraction to Color.Black,
                    1f to Color.Transparent,
                )
                onDrawBehind {
                    val ms = plan.clock.value
                    plan.draw(this, ms, ink)
                    if (plan.isRolling(ms)) drawRect(mask, blendMode = BlendMode.DstIn)
                }
            },
    )
}

/** Measured single-character layouts for one style (tabular digits share one advance). */
private class Glyphs(private val measurer: TextMeasurer, private val style: TextStyle) {
    private val cache = HashMap<Char, TextLayoutResult>()
    private val zero = layout('0')
    val lineHeight: Int = zero.size.height
    val baseline: Int = zero.firstBaseline.roundToInt()

    fun layout(c: Char): TextLayoutResult = cache.getOrPut(c) { measurer.measure(c.toString(), style, maxLines = 1, softWrap = false) }

    fun width(c: Char?): Float = if (c == null) 0f else layout(c).size.width.toFloat()
}

private enum class ColumnKind { Static, Roll, Fade }

/** One character position, counted from the right. Null chars mean "absent" (the number got shorter or longer). */
@Immutable
private class RollColumn(
    val from: Char?,
    val to: Char?,
    val kind: ColumnKind,
    /** Strip positions for [ColumnKind.Roll]: digit values, [end] may be beyond 0..9 to keep the direction. */
    val start: Float,
    val end: Float,
    val delayMs: Int,
    val durationMs: Int,
    val fromWidth: Float,
    val toWidth: Float,
) {
    /** Eased 0..1 progress at [ms] on the plan clock. */
    fun progress(ms: Float): Float {
        if (kind == ColumnKind.Static || durationMs <= 0) return 1f
        val t = ((ms - delayMs) / durationMs).coerceIn(0f, 1f)
        return ThesisMotion.EaseStandard.transform(t)
    }

    fun width(ms: Float): Float = lerp(fromWidth, toWidth, progress(ms))
}

private class RollPlan(
    private val columns: List<RollColumn>,
    private val glyphs: Glyphs,
    val durationMs: Int,
) {
    /** The plan's own clock, in ms: a new plan starts at 0, so its first frame is the "before" state. */
    val clock: Animatable<Float, AnimationVector1D> = Animatable(0f)

    private val hasRoll = columns.any { it.kind == ColumnKind.Roll }

    fun width(ms: Float): Float = columns.sumOf { it.width(ms).toDouble() }.toFloat()

    fun isRolling(ms: Float): Boolean = hasRoll && ms < durationMs

    fun draw(scope: DrawScope, ms: Float, color: Color) = with(scope) {
        val slot = size.height
        var right = size.width
        for (col in columns) {
            val w = col.width(ms)
            val left = right - w
            val e = col.progress(ms)
            when (col.kind) {
                ColumnKind.Static -> glyph(col.to, left, w, 0f, color, 1f)
                ColumnKind.Fade -> {
                    // The leaving character clears in the first ~60% of the column's time (exits run faster).
                    glyph(col.from, left, w, 0f, color, (1f - e / EXIT_SHARE).coerceIn(0f, 1f))
                    glyph(col.to, left, w, 0f, color, e)
                }
                ColumnKind.Roll -> {
                    // Odometer strip: digit v sits at y = (v - p) * slot; p runs from start to end.
                    val p = lerp(col.start, col.end, e)
                    val lo = floor(p).toInt()
                    for (v in lo..lo + 1) {
                        val dy = (v - p) * slot
                        if (abs(dy) < slot) glyph(digit(v), left, w, dy, color, 1f)
                    }
                }
            }
            right = left
        }
    }

    private fun DrawScope.glyph(c: Char?, left: Float, columnWidth: Float, dy: Float, color: Color, alpha: Float) {
        if (c == null || alpha <= 0f) return
        val layout = glyphs.layout(c)
        val x = left + (columnWidth - layout.size.width) / 2f
        drawText(layout, color = color, topLeft = Offset(x, dy), alpha = alpha)
    }

    companion object {
        fun build(previous: String?, text: String, trend: Int, reduced: Boolean, glyphs: Glyphs): RollPlan {
            if (previous == null || previous == text) {
                val columns = text.reversed().map { c ->
                    val w = glyphs.width(c)
                    RollColumn(c, c, ColumnKind.Static, 0f, 0f, 0, 0, w, w)
                }
                return RollPlan(columns, glyphs, durationMs = 0)
            }
            val from = previous.reversed()
            val to = text.reversed()
            val count = maxOf(from.length, to.length)
            var total = 0
            val columns = (0 until count).map { i ->
                val a = from.getOrNull(i)
                val b = to.getOrNull(i)
                val aw = glyphs.width(a)
                val bw = glyphs.width(b)
                when {
                    a == b -> RollColumn(a, b, ColumnKind.Static, 0f, 0f, 0, 0, aw, bw)
                    reduced -> {
                        // Reduced motion: a 150 ms crossfade of what changed; widths take their new size at once.
                        total = maxOf(total, ThesisMotion.Quick)
                        RollColumn(a, b, ColumnKind.Fade, 0f, 0f, 0, ThesisMotion.Quick, bw, bw)
                    }
                    else -> {
                        val delay = ThesisMotion.rollDelay(i)
                        total = maxOf(total, delay + ThesisMotion.Roll)
                        if (a != null && b != null && a.isDigit() && b.isDigit() && trend != 0) {
                            val start = (a - '0').toFloat()
                            var end = (b - '0').toFloat()
                            if (trend > 0 && end < start) end += DIGITS
                            if (trend < 0 && end > start) end -= DIGITS
                            RollColumn(a, b, ColumnKind.Roll, start, end, delay, ThesisMotion.Roll, aw, bw)
                        } else {
                            RollColumn(a, b, ColumnKind.Fade, 0f, 0f, delay, ThesisMotion.Roll, aw, bw)
                        }
                    }
                }
            }
            return RollPlan(columns, glyphs, durationMs = total)
        }

        private fun digit(v: Int): Char = '0' + ((v % DIGITS) + DIGITS) % DIGITS

        private const val DIGITS = 10
        private const val EXIT_SHARE = 0.6f
    }
}

private const val GLYPH_CACHE = 24
