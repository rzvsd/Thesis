@file:OptIn(ExperimentalSharedTransitionApi::class)

package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.util.lerp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.ThesisShape
import kotlin.math.roundToInt

/*
 * The container transform (DESIGN-DIRECTION 4.5 "List item → its detail", playbook 8b; PR-4b): a page opened from a
 * list row grows out of that row over the list and shrinks back into it on the pop, as a Compose 1.7 shared-bounds
 * transition instead of PR-2's clip-reveal (playbook 8a).
 *
 * How it is wired, since the row and the page never meet in one screen:
 * - The navigator keeps the tapped row's window bounds per pushed entry (`AppNavigator.pushFrom`).
 * - The page carries `Modifier.sharedBounds` keyed by its entryId ([transformBounds]).
 * - The other side of the match is a placeholder the shell puts where the row was ([TransformOrigin]), in the
 *   page's own layer, in the other state of that layer's transition: in the list page (or the report layer's
 *   previous state) while the push runs, and in the page that comes back while the pop runs. It is placed before
 *   the page (AnimatedContent places the leaving content first), so on a push the bounds start at the row.
 * - Shared bounds render in the [ShellTransformScope]'s overlay while they move: above the report layer and the tab
 *   layer, under the bottom bar, the modal layer and snackbars (drawn after the scope). That is also what reorders
 *   a report (drawn in the base layer, under the tab layer) over the History or Research list it grows from
 *   (PR3-INTEGRATION, PR-4 list item 1). The list stays put under a scrim ([transformScrim]).
 * - Bounds: `Screen` 300 ms in, `ScreenOut` 240 ms out, `EaseStandard` ([ShellBoundsTransform]). The page is laid
 *   out once at its full size and scaled to the moving bounds, top-aligned and cropped (`ScaleToBounds(Crop)`): no
 *   relayout per frame and text is never stretched (the scale is uniform, about .92 at the row and 1 at rest, so the
 *   last frame equals the resting page: no jump). Corners go from the card radius to 0 ([TransformClip]); the fill
 *   goes from `surface` to `bg`, the container fades in over the first 30% (and out over the last 30% of the way
 *   back, so the row under it takes over without a pop) and the page's content fades in over the last 70%.
 * - Reduced motion (4.8) and pages with no origin (a restored stack, after a rotation) keep the crossfade or the
 *   shared axis: no placeholder, no shared bounds. A back gesture over a transformed page scrubs the shrink itself
 *   (no extra .90 scale, which would land the page off its row).
 */

/** The shell's shared-transition scope, or null outside [ShellTransformScope] (layer tests that skip it). */
internal val LocalShellTransformScope = compositionLocalOf<SharedTransitionScope?> { null }

/**
 * Hosts the report base layer and the tab layer in one `SharedTransitionLayout`, so a page can grow from a row in
 * either. Anything drawn after it (bars, modal layer, snackbars) stays above a page in transform.
 */
@Composable
internal fun ShellTransformScope(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    SharedTransitionLayout(modifier) {
        CompositionLocalProvider(LocalShellTransformScope provides this) { content() }
    }
}

/** [ShellTransformScope] unless one is already provided: a layer used on its own still transforms. */
@Composable
internal fun WithShellTransformScope(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    if (LocalShellTransformScope.current != null) {
        Box(modifier) { content() }
    } else {
        ShellTransformScope(modifier, content)
    }
}

/** The shared-bounds key of a transformed page: its entryId. */
@Immutable
internal data class TransformKey(val entryId: String)

/**
 * In (the target bounds are larger): `Screen` 300 ms; out: `ScreenOut` 240 ms; both `EaseStandard` (4.5). The
 * shared-transition scope asks once per transition, so a pop never reuses the push's duration.
 */
internal val ShellBoundsTransform = BoundsTransform { initial, target ->
    val growing = target.width * target.height >= initial.width * initial.height
    motionSpec(if (growing) ThesisMotion.Screen else ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard)
}

/**
 * Which entry of a layer's transition (from [current] to [target]) transforms, and how: [ShellTransition.ContainerIn]
 * when [target] was pushed from a row, [ShellTransition.ContainerOut] when [current] is popped back into one. Null
 * for any other move, under reduced motion, or when [drawnHere] says the page is drawn by another layer.
 */
@Immutable
internal data class LayerTransform(val transition: ShellTransition, val page: NavEntry, val origin: Rect)

internal fun layerTransformOf(
    current: NavEntry?,
    target: NavEntry?,
    move: NavMove,
    reducedMotion: Boolean,
    originOf: (NavEntry) -> Rect?,
): LayerTransform? {
    if (reducedMotion || current?.entryId == target?.entryId) return null
    val pushedFrom = target?.let(originOf)
    val poppedTo = current?.let(originOf)
    return when {
        move == NavMove.Push && target != null && pushedFrom != null -> LayerTransform(ShellTransition.ContainerIn, target, pushedFrom)
        move == NavMove.Pop && current != null && poppedTo != null -> LayerTransform(ShellTransition.ContainerOut, current, poppedTo)
        else -> null
    }
}

/**
 * The page side of the transform: shared bounds keyed by [entryId], in [visibility]'s transition, rendered in the
 * overlay while they move (clipped by [clip]) and scaled to the moving bounds without relayout.
 */
internal fun Modifier.transformBounds(
    shared: SharedTransitionScope,
    visibility: AnimatedVisibilityScope,
    state: SharedTransitionScope.SharedContentState,
    clip: Shape,
): Modifier = with(shared) {
    this@transformBounds.sharedBounds(
        sharedContentState = state,
        animatedVisibilityScope = visibility,
        // The page's own fade and the list's hold are the layers' business; the bounds only move.
        enter = EnterTransition.None,
        exit = ExitTransition.None,
        boundsTransform = ShellBoundsTransform,
        resizeMode = SharedTransitionScope.ResizeMode.ScaleToBounds(ContentScale.Crop, Alignment.TopCenter),
        clipInOverlayDuringTransition = OverlayClip(clip),
    )
}

/**
 * The row side of the transform: an empty box at [origin] (window px; [layerTopLeft] is the layer's window position)
 * with the page's key, in [visibility]'s transition. Placed inside the layer state that is leaving on a push (so the
 * bounds start at the row) or arriving on a pop (so they end there).
 */
@Composable
internal fun TransformOrigin(
    shared: SharedTransitionScope,
    visibility: AnimatedVisibilityScope,
    key: TransformKey,
    origin: Rect,
    layerTopLeft: Offset,
) {
    val state = with(shared) { rememberSharedContentState(key) }
    Box(
        Modifier
            .layout { measurable, _ ->
                val w = origin.width.roundToInt().coerceAtLeast(1)
                val h = origin.height.roundToInt().coerceAtLeast(1)
                val placeable = measurable.measure(Constraints.fixed(w, h))
                layout(w, h) {
                    placeable.place((origin.left - layerTopLeft.x).roundToInt(), (origin.top - layerTopLeft.y).roundToInt())
                }
            }
            .transformBounds(shared, visibility, state, RectangleClip)
    )
}

/**
 * The transform's progress on [visibility]'s page, 0 = the row, 1 = the whole layer: `Screen` 300 ms `EaseStandard`
 * in ([revealIn]), `ScreenOut` 240 ms out ([revealOut]), 1 otherwise. The bounds run on the same clock and spec, so
 * corner, fill and fade stay in step with them, and a seek (predictive back) moves both.
 */
@Composable
internal fun AnimatedVisibilityScope.transformProgress(revealIn: Boolean, revealOut: Boolean, label: String): State<Float> =
    transition.animateFloat(
        transitionSpec = {
            when {
                targetState == EnterExitState.Visible && revealIn -> motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseStandard)
                targetState == EnterExitState.PostExit && revealOut -> motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard)
                else -> snapSpec()
            }
        },
        label = label
    ) { state ->
        when (state) {
            EnterExitState.PreEnter -> if (revealIn) 0f else 1f
            EnterExitState.Visible -> 1f
            EnterExitState.PostExit -> if (revealOut) 0f else 1f
        }
    }

/**
 * The scrim over the list a page grows from (or shrinks back into), on the list page's own transition: 0 → 1 while
 * it leaves under a pushed page ([under] = ContainerIn), 1 → 0 while it comes back under a popped one
 * (ContainerOut), with the bounds' timing.
 */
@Composable
internal fun AnimatedVisibilityScope.transformScrim(under: ShellTransition?): State<Float> =
    transition.animateFloat(
        transitionSpec = {
            when {
                targetState == EnterExitState.PostExit && under == ShellTransition.ContainerIn ->
                    motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseStandard)
                targetState == EnterExitState.Visible && under == ShellTransition.ContainerOut ->
                    motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard)
                else -> snapSpec()
            }
        },
        label = "transform-scrim"
    ) { state ->
        when (state) {
            EnterExitState.PreEnter -> if (under == ShellTransition.ContainerOut) 1f else 0f
            EnterExitState.Visible -> 0f
            EnterExitState.PostExit -> if (under == ShellTransition.ContainerIn) 1f else 0f
        }
    }

/** The content alpha of a transformed page: 0 over the first 30% of the transform, then up to 1 (4.5). */
internal fun transformContentAlpha(progress: Float): Float =
    ((progress - ThesisMotion.TransformContentFrom) / (1f - ThesisMotion.TransformContentFrom)).coerceIn(0f, 1f)

/**
 * The alpha of a page's container in transform: it fades in over the first 30% of the move, while its content has
 * not started yet, so the row under it gives way to the container instead of being covered in one frame; on the way
 * back it fades over the last 30%, so the row (in place under it) takes over without a pop.
 */
internal fun transformContainerAlpha(progress: Float): Float =
    (progress / ThesisMotion.TransformContentFrom).coerceIn(0f, 1f)

/** The clip of a page in transform: the card radius at the row, square at rest ([progress] read at draw time). */
internal class TransformClip(private val progress: () -> Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val radius = with(density) { lerp(ThesisShape.CardRadius.toPx(), 0f, progress().coerceIn(0f, 1f)) }
        return if (radius <= 0f) {
            Outline.Rectangle(Rect(Offset.Zero, size))
        } else {
            Outline.Rounded(RoundRect(Rect(Offset.Zero, size), CornerRadius(radius)))
        }
    }
}

private val RectangleClip: Shape = TransformClip { 1f }

/** The transform of a layer's move from [current] to [target], decided once per move. */
@Composable
internal fun rememberLayerTransform(
    current: NavEntry?,
    target: NavEntry?,
    move: () -> NavMove,
    reducedMotion: Boolean,
    originOf: (NavEntry) -> Rect?,
): LayerTransform? = remember(current?.entryId, target?.entryId, reducedMotion) {
    layerTransformOf(current, target, move(), reducedMotion, originOf)
}
