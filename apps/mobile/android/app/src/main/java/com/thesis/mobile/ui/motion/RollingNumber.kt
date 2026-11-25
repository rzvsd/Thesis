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
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.scale
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
import androidx.compose.ui.unit.Constraints
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
    // The fit-to-width scale chosen by the layout pass, for the draw pass (1 unless the figure is wider than its slot).
    val fit = remember { FloatArray(1) { 1f } }
    val committedPlan = remember { arrayOfNulls<RollPlan>(1) }
    val plan = remember(text, glyphs) {
        // A change mid-roll continues from where the figure is now (the NumberFlow model), not from the old target.
        val prior = committedPlan[0]?.takeIf { it.glyphs === glyphs }
        val priorMs = prior?.let { Snapshot.withoutReadObservation { it.clock.value } } ?: 0f
        RollPlan.build(
            previous = committed[0],
            text = text,
            trend = trend.sign,
            reduced = reduced,
            glyphs = glyphs,
            prior = prior?.takeIf { it.isMoving(priorMs) },
            priorMs = priorMs,
        )
    }
    SideEffect {
        committed[0] = text
        committedPlan[0] = plan
    }
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
                // Layout-phase read of the clock, and only when a column changes width (a tnum 41 -> 58 does not):
                // then the width glides; otherwise the slot keeps one width and the roll costs no relayout.
                val w = if (plan.hasWidthChange) plan.width(plan.clock.value) else plan.restingWidth
                // Never cut (rubric A4): a figure wider than the slot allows (large font scale on a narrow phone)
                // is drawn scaled down to fit, with its baseline scaled alike, instead of overflowing.
                val k = if (constraints.hasBoundedWidth && plan.maxWidth > constraints.maxWidth) {
                    constraints.maxWidth / plan.maxWidth
                } else {
                    1f
                }
                fit[0] = k
                val width = (w * k).roundToInt().coerceAtMost(constraints.maxWidth)
                val height = (glyphs.lineHeight * k).roundToInt()
                val baseline = (glyphs.baseline * k).roundToInt()
                val placeable = measurable.measure(Constraints.fixed(width, height))
                layout(width, height, mapOf(FirstBaseline to baseline, LastBaseline to baseline)) {
                    placeable.place(0, 0)
                }
            }
            // Offscreen only while rolling, so the DstIn edge mask cuts this layer alone; a static figure pays for
            // no offscreen buffer. Clipped to the slot.
            .graphicsLayer {
                clip = true
                compositingStrategy = if (plan.hasStrip && plan.isRolling(plan.clock.value)) {
                    CompositingStrategy.Offscreen
                } else {
                    CompositingStrategy.Auto
                }
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
                    val k = fit[0]
                    if (k < 1f) {
                        scale(k, k, pivot = Offset.Zero) { plan.draw(this, ms, ink, size.width / k, size.height / k) }
                    } else {
                        plan.draw(this, ms, ink, size.width, size.height)
                    }
                    if (plan.isRolling(ms)) drawRect(mask, blendMode = BlendMode.DstIn)
                }
            },
    )
}

/** Measured single-character layouts for one style (tabular digits share one advance). */
internal class Glyphs(private val measurer: TextMeasurer, private val style: TextStyle) {
    private val cache = HashMap<Char, TextLayoutResult>()
    private val zero = layout('0')
    val lineHeight: Int = zero.size.height
    val baseline: Int = zero.firstBaseline.roundToInt()

    fun layout(c: Char): TextLayoutResult = cache.getOrPut(c) { measurer.measure(c.toString(), style, maxLines = 1, softWrap = false) }

    fun width(c: Char?): Float = if (c == null) 0f else layout(c).size.width.toFloat()
}

internal enum class ColumnKind { Static, Roll, Fade }

/** A glyph on screen in one column: its opacity and its vertical offset in slot heights (non-zero on a strip). */
@Immutable
internal class ColumnGlyph(val char: Char, val alpha: Float, val offset: Float = 0f)

/** One character position, counted from the right. Null chars mean "absent" (the number got shorter or longer). */
@Immutable
internal class RollColumn(
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
    /** [ColumnKind.Fade]: the glyphs fading out, from their [ColumnGlyph.alpha]. Normally [from] at full opacity. */
    val leaving: List<ColumnGlyph> = if (kind == ColumnKind.Fade && from != null) listOf(ColumnGlyph(from, 1f)) else emptyList(),
    /** [ColumnKind.Fade]: the opacity [to] fades in from (above 0 when it was already partly on screen). */
    val enterFrom: Float = 0f,
) {
    /** Eased 0..1 progress at [ms] on the plan clock. */
    fun progress(ms: Float): Float {
        if (kind == ColumnKind.Static || durationMs <= 0) return 1f
        val t = ((ms - delayMs) / durationMs).coerceIn(0f, 1f)
        return ThesisMotion.EaseStandard.transform(t)
    }

    /** Odometer strip position at [ms] (meaningful for [ColumnKind.Roll]). */
    fun position(ms: Float): Float = lerp(start, end, progress(ms))

    /** This column on a clock that starts [elapsedMs] later: the same motion, continued from where it is now. */
    fun shiftedBy(elapsedMs: Float): RollColumn =
        RollColumn(from, to, kind, start, end, delayMs - elapsedMs.roundToInt(), durationMs, fromWidth, toWidth, leaving, enterFrom)

    fun width(ms: Float): Float = lerp(fromWidth, toWidth, progress(ms))

    /** Opacity of the [leaving] glyphs at eased progress [e], as a share of their own: they clear in the first ~60%. */
    fun leavingShare(e: Float): Float = (1f - e / EXIT_SHARE).coerceIn(0f, 1f)

    /** Opacity of [to] at eased progress [e] (Fade). */
    fun enteringAlpha(e: Float): Float = lerp(enterFrom, 1f, e)

    /** What this column shows at [ms]: each visible glyph with its opacity and strip offset (for a change mid-roll). */
    fun visibleAt(ms: Float): List<ColumnGlyph> {
        val e = progress(ms)
        val shown = when (kind) {
            ColumnKind.Static -> listOfNotNull(to?.let { ColumnGlyph(it, 1f) })
            ColumnKind.Fade -> {
                val share = leavingShare(e)
                leaving.map { ColumnGlyph(it.char, it.alpha * share, it.offset) } +
                    listOfNotNull(to?.let { ColumnGlyph(it, enteringAlpha(e)) })
            }
            ColumnKind.Roll -> {
                val p = lerp(start, end, e)
                val lo = floor(p).toInt()
                (lo..lo + 1).mapNotNull { v -> (v - p).takeIf { abs(it) < 1f }?.let { ColumnGlyph(stripDigit(v), 1f, it) } }
            }
        }
        return shown.filter { it.alpha > MIN_ALPHA }
    }
}

/** One change of the figure: its columns (from the right) on one clock. Internal for the plan tests. */
internal class RollPlan(
    val columns: List<RollColumn>,
    val glyphs: Glyphs,
    val durationMs: Int,
) {
    /** The plan's own clock, in ms: a new plan starts at 0, so its first frame is the "before" state. */
    val clock: Animatable<Float, AnimationVector1D> = Animatable(0f)

    /** True when glyphs move vertically: a rolling strip, or a strip glyph fading out where it stopped. */
    val hasStrip = columns.any { col -> col.kind == ColumnKind.Roll || col.leaving.any { it.offset != 0f } }

    /** True when any column changes width; otherwise the slot keeps [restingWidth] for the whole change. */
    val hasWidthChange = columns.any { it.fromWidth != it.toWidth }

    /** The width once every column has settled. */
    val restingWidth: Float = columns.sumOf { it.toWidth.toDouble() }.toFloat()

    /** An upper bound of the width at any moment of this change (for fitting the figure into its slot). */
    val maxWidth: Float = columns.sumOf { maxOf(it.fromWidth, it.toWidth).toDouble() }.toFloat()

    fun width(ms: Float): Float = columns.sumOf { it.width(ms).toDouble() }.toFloat()

    fun isRolling(ms: Float): Boolean = hasStrip && ms < durationMs

    /** True while any column still changes at [ms] (a roll, a fade or a width glide). */
    fun isMoving(ms: Float): Boolean = ms < durationMs

    /** Draws the figure right-aligned at [width] in a slot [slot] high (the caller's units, before any fit scale). */
    fun draw(scope: DrawScope, ms: Float, color: Color, width: Float, slot: Float) = with(scope) {
        var right = width
        for (col in columns) {
            val w = col.width(ms)
            val left = right - w
            val e = col.progress(ms)
            when (col.kind) {
                ColumnKind.Static -> glyph(col.to, left, w, 0f, color, 1f)
                ColumnKind.Fade -> {
                    // ColumnGlyph characters clear in the first ~60% of the column's time (exits run faster), each from
                    // the opacity it had when this change began.
                    val share = col.leavingShare(e)
                    for (g in col.leaving) glyph(g.char, left, w, g.offset * slot, color, g.alpha * share)
                    glyph(col.to, left, w, 0f, color, col.enteringAlpha(e))
                }
                ColumnKind.Roll -> {
                    // Odometer strip: digit v sits at y = (v - p) * slot; p runs from start to end.
                    val p = lerp(col.start, col.end, e)
                    val lo = floor(p).toInt()
                    for (v in lo..lo + 1) {
                        val dy = (v - p) * slot
                        if (abs(dy) < slot) glyph(stripDigit(v), left, w, dy, color, 1f)
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
        /**
         * The plan from [previous] to [text]. When [prior] is still moving at [priorMs] (the value changed again
         * mid-roll), each column continues from its current state: a column whose target is unchanged keeps its
         * motion on the new clock, a rolling digit with a new digit target rolls on from its current strip position,
         * and any other column crossfades from exactly what it shows (glyphs, opacities, strip offsets) to the new
         * character. The stagger counts digit positions from the rightmost changed one, so that digit always leads.
         */
        fun build(
            previous: String?,
            text: String,
            trend: Int,
            reduced: Boolean,
            glyphs: Glyphs,
            prior: RollPlan? = null,
            priorMs: Float = 0f,
        ): RollPlan {
            if (prior == null && (previous == null || previous == text)) {
                val columns = text.reversed().map { c ->
                    val w = glyphs.width(c)
                    RollColumn(c, c, ColumnKind.Static, 0f, 0f, 0, 0, w, w)
                }
                return RollPlan(columns, glyphs, durationMs = 0)
            }
            val from = (previous ?: text).reversed()
            val to = text.reversed()
            val count = maxOf(from.length, to.length, prior?.columns?.size ?: 0)
            val olds = List(count) { i -> prior?.columns?.getOrNull(i)?.takeIf { it.progress(priorMs) < 1f } }
            val starts = List(count) { i -> olds[i]?.to ?: from.getOrNull(i) }
            // Stagger positions: digit columns counted from the rightmost changed column (a suffix such as "%" or
            // " new" never delays the digits; the rightmost changed digit starts at 0 ms).
            val staggerAt = IntArray(count)
            var firstChange = -1
            var digitsLeft = 0
            for (i in 0 until count) {
                val a = starts[i]
                val b = to.getOrNull(i)
                if (firstChange < 0 && a != b) firstChange = i
                staggerAt[i] = digitsLeft
                if (firstChange >= 0 && (a?.isDigit() == true || b?.isDigit() == true)) digitsLeft++
            }
            var total = 0
            val columns = (0 until count).map { i ->
                val old = olds[i]
                val a = starts[i]
                val b = to.getOrNull(i)
                val aw = old?.width(priorMs) ?: glyphs.width(a)
                val bw = glyphs.width(b)
                when {
                    old != null && old.to == b -> {
                        // Same target: the motion already under way simply continues.
                        old.shiftedBy(priorMs).also { total = maxOf(total, it.delayMs + it.durationMs) }
                    }
                    old != null && !reduced && old.kind == ColumnKind.Roll && b != null && b.isDigit() -> {
                        // Mid-roll with a new target: roll on from the strip's current position, at once (no stagger
                        // delay, which would stall the strip), in the direction of the change.
                        val start = old.position(priorMs)
                        val direction = if (trend != 0) trend else (old.end - old.start).sign.toInt()
                        val end = nearestStop(start, (b - '0').toFloat(), direction)
                        total = maxOf(total, ThesisMotion.Roll)
                        RollColumn(a, b, ColumnKind.Roll, start, end, 0, ThesisMotion.Roll, aw, bw)
                    }
                    old != null -> {
                        // Mid-change with a new target that cannot roll on (a sign, separator or appearing digit
                        // still crossfading, or a rolling digit replaced by a non-digit): crossfade from exactly what
                        // is on screen, at once. A glyph already partly visible that is the new target keeps its
                        // opacity and fades the rest of the way in; strip glyphs fade out where they stopped.
                        val now = old.visibleAt(priorMs)
                        val stays = now.firstOrNull { it.char == b && it.offset == 0f }
                        val duration = if (reduced) ThesisMotion.Quick else ThesisMotion.Roll
                        total = maxOf(total, duration)
                        RollColumn(
                            a, b, ColumnKind.Fade, 0f, 0f, 0, duration,
                            fromWidth = if (reduced) bw else aw,
                            toWidth = bw,
                            leaving = if (stays == null) now else now - stays,
                            enterFrom = stays?.alpha ?: 0f,
                        )
                    }
                    a == b -> RollColumn(a, b, ColumnKind.Static, 0f, 0f, 0, 0, aw, bw)
                    reduced -> {
                        // Reduced motion: a 150 ms crossfade of what changed; widths take their new size at once.
                        total = maxOf(total, ThesisMotion.Quick)
                        RollColumn(a, b, ColumnKind.Fade, 0f, 0f, 0, ThesisMotion.Quick, bw, bw)
                    }
                    else -> {
                        val delay = ThesisMotion.rollDelay(staggerAt[i])
                        total = maxOf(total, delay + ThesisMotion.Roll)
                        if (a != null && b != null && a.isDigit() && b.isDigit() && trend != 0) {
                            val start = (a - '0').toFloat()
                            val end = nearestStop(start, (b - '0').toFloat(), trend)
                            RollColumn(a, b, ColumnKind.Roll, start, end, delay, ThesisMotion.Roll, aw, bw)
                        } else {
                            RollColumn(a, b, ColumnKind.Fade, 0f, 0f, delay, ThesisMotion.Roll, aw, bw)
                        }
                    }
                }
            }
            return RollPlan(columns, glyphs, durationMs = total)
        }

        /**
         * The strip position showing [digit] reached from [start] travelling in [direction] (> 0 upward, < 0
         * downward; 0 takes the nearest), at most one turn of the strip away.
         */
        fun nearestStop(start: Float, digit: Float, direction: Int): Float {
            val base = floor(start / DIGITS) * DIGITS + digit
            val candidates = floatArrayOf(base - DIGITS, base, base + DIGITS)
            return when {
                direction > 0 -> candidates.filter { it >= start }.min()
                direction < 0 -> candidates.filter { it <= start }.max()
                else -> candidates.minBy { abs(it - start) }
            }
        }

    }
}

/** The digit shown at strip position [v] (the strip repeats every ten positions). */
private fun stripDigit(v: Int): Char = '0' + ((v % DIGITS) + DIGITS) % DIGITS

private const val DIGITS = 10

/** ColumnGlyph glyphs clear in this share of a Fade column's time. */
private const val EXIT_SHARE = 0.6f

/** Glyphs fainter than this are dropped when a change mid-roll takes over what is on screen. */
private const val MIN_ALPHA = 0.01f

private const val GLYPH_CACHE = 24
