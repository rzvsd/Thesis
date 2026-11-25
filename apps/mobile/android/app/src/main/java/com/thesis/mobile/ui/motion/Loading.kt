package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.node.CompositionLocalConsumerModifierNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.currentValueOf
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.platform.InspectorInfo
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import kotlinx.coroutines.delay

/*
 * Loading motion (docs/app-redesign/DESIGN-DIRECTION.md 3 #25 #28 #29, 4.2, 4.3 rule 10, 4.8; playbook section 12).
 *
 * The loops (LoadingHairline, shimmer, LiveDot) are the only infinite animations; at most one runs on a screen.
 * Each is a phase State read in the draw phase, so a loop never recomposes. Under reduced motion every loop is
 * static: the phase is a constant [STATIC_PHASE] and the drawing shows its resting state.
 */

/** Phase value meaning "no loop running": draw the resting state. */
const val STATIC_PHASE = -1f

/**
 * A 0..1 loop phase, or [STATIC_PHASE] while [running] is false or under reduced motion. One infinite transition;
 * it stops when it leaves composition. [reverse] makes it ping-pong (LiveDot); [restMillis] waits at 0 before each
 * sweep (shimmer).
 */
@Composable
fun rememberLoopPhase(
    running: Boolean,
    durationMillis: Int,
    easing: androidx.compose.animation.core.Easing = ThesisMotion.Linear,
    reverse: Boolean = false,
    restMillis: Int = 0,
    static: Float = STATIC_PHASE,
): State<Float> {
    if (!running || LocalReducedMotion.current) return remember(static) { mutableFloatStateOf(static) }
    return rememberInfiniteTransition(label = "loop").animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(durationMillis, delayMillis = restMillis, easing = easing),
            if (reverse) RepeatMode.Reverse else RepeatMode.Restart,
        ),
        label = "loopPhase",
    )
}

// ---------------------------------------------------------------------------------------------------------------
// LoadingHairline (#28) and the refresh hairline
// ---------------------------------------------------------------------------------------------------------------

/** The LoadingHairline phase: a linear 2.25 s loop while [active]; static (no highlight) under reduced motion. */
@Composable
fun rememberHairlinePhase(active: Boolean): State<Float> =
    rememberLoopPhase(active, ThesisMotion.HairlineLoop)

/**
 * Draws the travelling-hairline highlight over the content: a soft-edged band [widthFraction] of the width, in
 * [color], entering from the left edge and leaving at the right as [phase] goes 0 to 1. Nothing while the phase
 * is [STATIC_PHASE]. Draw-phase read only.
 */
fun Modifier.travellingHighlight(
    phase: State<Float>,
    color: Color,
    widthFraction: Float = Kit.HAIRLINE_HIGHLIGHT_WIDTH,
): Modifier = drawWithContent {
    drawContent()
    drawTravellingHighlight(phase.value, color, widthFraction)
}

/** [travellingHighlight] as a plain draw call, for components that draw their own line. */
fun DrawScope.drawTravellingHighlight(t: Float, color: Color, widthFraction: Float = Kit.HAIRLINE_HIGHLIGHT_WIDTH) {
    if (t < 0f || size.width <= 0f) return
    val w = size.width * widthFraction
    val x = -w + (size.width + w) * t
    val brush = Brush.horizontalGradient(
        0f to color.copy(alpha = 0f),
        0.5f to color,
        1f to color.copy(alpha = 0f),
        startX = x,
        endX = x + w,
    )
    clipRect { drawRect(brush, topLeft = Offset(x, 0f), size = Size(w, size.height)) }
}

/** The LoadingHairline highlight colour: `accent` at the hairline alpha (20%). */
fun hairlineHighlight(p: ThesisPalette): Color = p.accent.copy(alpha = Kit.HAIRLINE_HIGHLIGHT_ALPHA)

// ---------------------------------------------------------------------------------------------------------------
// LiveDot (#29)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The LiveDot ring phase: 0..1..0 over `LivePulse` (2 s each way, `EaseInOut`). Static at 0 under reduced motion.
 * Only for a War Room in its Live phase (principle 14).
 */
@Composable
fun rememberLivePulse(): State<Float> =
    rememberLoopPhase(true, ThesisMotion.LivePulse, ThesisMotion.EaseInOut, reverse = true, static = 0f)

// ---------------------------------------------------------------------------------------------------------------
// Shimmer (#25): one slow sweep per screen, lighting only the skeleton blocks
// ---------------------------------------------------------------------------------------------------------------

/** The screen's one shimmer phase, shared by every skeleton block under a [ShimmerHost]. */
@Stable
class ShimmerPhase internal constructor(internal val phase: State<Float>) {
    /** Current sweep position 0..1, or [STATIC_PHASE]. */
    val value: Float get() = phase.value
}

/** The shimmer of the nearest [ShimmerHost]; null means skeletons stay static. */
val LocalShimmer = staticCompositionLocalOf<ShimmerPhase?> { null }

/**
 * The sweep: 1400 ms `EaseInOut` across the screen, then a 600 ms rest. Static under reduced motion.
 * Create one per screen (or use [ShimmerHost]) so all blocks are lit by the same light.
 */
@Composable
fun rememberShimmerPhase(running: Boolean = true): ShimmerPhase {
    val phase = rememberLoopPhase(running, ThesisMotion.ShimmerSweep, ThesisMotion.EaseInOut, restMillis = ThesisMotion.ShimmerRest)
    return remember(phase) { ShimmerPhase(phase) }
}

/** Provides one shimmer phase to the skeletons in [content] (one per screen: 4.3 rule 10). */
@Composable
fun ShimmerHost(running: Boolean = true, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalShimmer provides rememberShimmerPhase(running), content = content)
}

/**
 * Lights this skeleton block with the screen's shimmer: a soft band 45% of the screen wide, placed in root
 * coordinates, so one continuous light crosses every block at once (playbook 12) and nothing outside the blocks
 * (card fills, borders) is lit. Put it after the block's clip and fill. Without a [ShimmerHost] above, or under
 * reduced motion, it draws nothing.
 */
fun Modifier.shimmerSweep(): Modifier = this then ShimmerSweepElement

private object ShimmerSweepElement : ModifierNodeElement<ShimmerSweepNode>() {
    override fun create() = ShimmerSweepNode()
    override fun update(node: ShimmerSweepNode) = Unit
    override fun hashCode(): Int = javaClass.hashCode()
    override fun equals(other: Any?): Boolean = other === this
    override fun InspectorInfo.inspectableProperties() {
        name = "shimmerSweep"
    }
}

private class ShimmerSweepNode :
    Modifier.Node(), DrawModifierNode, GlobalPositionAwareModifierNode, CompositionLocalConsumerModifierNode {
    private var xInRoot = 0f
    private var rootWidth = 0f

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        val x = coordinates.positionInRoot().x
        val w = coordinates.findRootCoordinates().size.width.toFloat()
        if (x != xInRoot || w != rootWidth) {
            xInRoot = x
            rootWidth = w
            invalidateDraw()
        }
    }

    override fun ContentDrawScope.draw() {
        drawContent()
        val shimmer = currentValueOf(LocalShimmer) ?: return
        val t = shimmer.value
        if (t < 0f || rootWidth <= 0f) return
        val band = rootWidth * ThesisMotion.ShimmerBandFraction
        val left = -band + (rootWidth + band) * t - xInRoot
        if (left > size.width || left + band < 0f) return
        val highlight = shimmerHighlight(currentValueOf(LocalThesisPalette))
        val brush = Brush.horizontalGradient(
            0f to highlight.copy(alpha = 0f),
            0.5f to highlight,
            1f to highlight.copy(alpha = 0f),
            startX = left,
            endX = left + band,
        )
        clipRect { drawRect(brush) }
    }
}

/** Shimmer light: `ink` at 6% on graphite (and in a HeroBand), `surface` at 85% on paper (skeletons are `surface2`). */
fun shimmerHighlight(p: ThesisPalette): Color =
    if (p.isLight) p.surface.copy(alpha = ThesisMotion.ShimmerHighlightAlphaLight)
    else p.ink.copy(alpha = ThesisMotion.ShimmerHighlightAlphaDark)

// ---------------------------------------------------------------------------------------------------------------
// Skeleton timing (#25)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Whether to show a skeleton for a load: only after [graceMs] (300 ms) of [loading], so fast loads never flash
 * one, and once shown for at least [minShowMs] (400 ms), so it never flickers. `delay()` is correct here: it is
 * about perception, not animation timing (4.3 rule 9). Times come from the frame clock.
 *
 * Typical use, for a first load (a refresh of loaded content never shows a skeleton, 4.3 rule 5):
 * `when { showSkeleton -> Skeleton…(); loading -> Unit /* grace: nothing yet */; else -> Content() }`.
 */
@Composable
fun rememberShowSkeleton(
    loading: Boolean,
    graceMs: Long = ThesisMotion.SkeletonGrace,
    minShowMs: Long = ThesisMotion.SkeletonMinShow,
): Boolean {
    var show by remember { mutableStateOf(false) }
    var shownAt by remember { mutableLongStateOf(0L) }
    LaunchedEffect(loading) {
        if (loading) {
            if (!show) {
                delay(graceMs)
                shownAt = withFrameMillis { it }
                show = true
            }
        } else if (show) {
            val remaining = minShowMs - (withFrameMillis { it } - shownAt)
            if (remaining > 0) delay(remaining)
            show = false
        }
    }
    return show
}
