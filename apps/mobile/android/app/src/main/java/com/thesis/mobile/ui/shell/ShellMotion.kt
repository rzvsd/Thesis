package com.thesis.mobile.ui.shell

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.snap
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.BackSwipeEdge
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/*
 * Shell motion (DESIGN-DIRECTION 4.5, 4.8): which transition each navigator move gets, the transitions themselves
 * (all [1.6 OK], all values from ThesisMotion), and the predictive-back preview.
 */

/** The transitions of section 4.5, by name. Picked by [shellTransitionFor] and [modalTransitionFor]. */
internal enum class ShellTransition {
    /** Bottom tab ↔ tab: out fade 90 `EaseExit`; in fade + scale .985 → 1, 210 after 90 `EaseEnter`. */
    FadeThrough,

    /** Push: new from +24 dp + fade, 300 `EaseEnter`; old to −24 dp + fade out, 180 `EaseExit`. */
    Forward,

    /** Pop: the mirror of [Forward]. */
    Backward,

    /**
     * [Forward] inside the modal layer, where no page lies under the two (only the tab layer, another screen):
     * the old page slides the same way but stays opaque under the new one until it has arrived, so the screen
     * under the modal never shows through. The new page arrives exactly as in [Forward].
     */
    ForwardOver,

    /** [Backward] inside the modal layer; see [ForwardOver]. */
    BackwardOver,

    /** Open a modal destination: rise 32 dp + fade, 300 `EaseEnter`. */
    Rise,

    /** Close a modal destination: fall 32 dp + fade, 240 `EaseExit`. */
    Fall,

    /** A replaced entry (a build becoming its report) or a restore: 150 ms crossfade, nothing moves. */
    Crossfade,
}

/**
 * The tab layer's and report base layer's transition for [move]. Reduced motion (4.8) turns every move into a
 * 150 ms crossfade: no slide, no scale.
 */
internal fun shellTransitionFor(move: NavMove, reducedMotion: Boolean): ShellTransition = when {
    reducedMotion -> ShellTransition.Crossfade
    move == NavMove.Tab -> ShellTransition.FadeThrough
    move == NavMove.Push -> ShellTransition.Forward
    move == NavMove.Pop -> ShellTransition.Backward
    else -> ShellTransition.Crossfade
}

/**
 * The modal layer's transition from [from] to [to] (either may be null: no modal). Opening or closing the modal
 * stack rises or falls; inside it (You → Appearance and back) pages move on the same X axis as a push. [forward]:
 * [from] is still on the modal stack, so [to] was pushed over it.
 */
internal fun modalTransitionFor(from: NavEntry?, to: NavEntry?, forward: Boolean, reducedMotion: Boolean): ShellTransition =
    when {
        reducedMotion -> ShellTransition.Crossfade
        from == null -> ShellTransition.Rise
        to == null -> ShellTransition.Fall
        forward -> ShellTransition.ForwardOver
        else -> ShellTransition.BackwardOver
    }

/** Pixel distances of the shell transitions at the current density. */
internal data class ShellMotionPx(val shiftPx: Int, val risePx: Int)

/** The [ContentTransform] for [transition]. Never animates size: every layer is full size in every state. */
internal fun ShellTransition.toContentTransform(px: ShellMotionPx): ContentTransform =
    contentTransformOf(this, px).withoutSizeAnimation()

/** Same enter and exit, no size animation and no clip (the scope's `using` exists only inside transitionSpec). */
private fun ContentTransform.withoutSizeAnimation(): ContentTransform =
    ContentTransform(targetContentEnter, initialContentExit, targetContentZIndex, SizeTransform(clip = false))

private fun contentTransformOf(transition: ShellTransition, px: ShellMotionPx): ContentTransform = when (transition) {
    ShellTransition.FadeThrough -> {
        val enter = motionSpec<Float>(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
        (fadeIn(enter) + scaleIn(enter, initialScale = ThesisMotion.TabScaleFrom))
            .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
    }
    ShellTransition.Forward -> sharedAxisX(forward = true, reducedMotion = false, shiftPx = px.shiftPx)
    ShellTransition.Backward -> sharedAxisX(forward = false, reducedMotion = false, shiftPx = px.shiftPx)
    ShellTransition.ForwardOver -> sharedAxisXOver(forward = true, shiftPx = px.shiftPx)
    ShellTransition.BackwardOver -> sharedAxisXOver(forward = false, shiftPx = px.shiftPx)
    ShellTransition.Rise ->
        (slideInVertically(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { px.risePx } +
            fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)))
            .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
    ShellTransition.Fall ->
        fadeIn(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseStandard))
            .togetherWith(
                slideOutVertically(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)) { px.risePx } +
                    fadeOut(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit))
            )
    ShellTransition.Crossfade -> reducedCrossfade()
}

/** Reduced motion (4.8) and replaced entries: a 150 ms crossfade instead of any slide, scale or rise. */
internal fun reducedCrossfade(): ContentTransform =
    fadeIn(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)) togetherWith
        fadeOut(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard))

/** The 4.5 shift of shared-axis X. */
internal val SHARED_AXIS_SHIFT: Dp = ThesisMotion.PushOffset

/**
 * Shared-axis X (4.5): forward, the new screen comes in from +[shiftPx] with a fade (300 ms) while the old one
 * leaves toward −[shiftPx] with a fade (180 ms); backward mirrors it. A 150 ms crossfade when motion is reduced.
 * Used by pushes and pops in the shell and by Auth ↔ Password reset in `ThesisApp`.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform {
    if (reducedMotion) return reducedCrossfade()
    val direction = if (forward) 1 else -1
    return (slideInHorizontally(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { direction * shiftPx } +
        fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)))
        .togetherWith(
            slideOutHorizontally(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)) { -direction * shiftPx } +
                fadeOut(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit))
        )
}

/**
 * [sharedAxisX] for a layer with nothing of its own under it (the modal layer): the new page is drawn on top and
 * arrives as in a push; the old page slides out but keeps full opacity until the new one is in, then goes. The
 * two pages cover the screen between them at every frame, so the tab layer under the modal never shows through.
 */
private fun sharedAxisXOver(forward: Boolean, shiftPx: Int): ContentTransform {
    val direction = if (forward) 1 else -1
    return ContentTransform(
        targetContentEnter = slideInHorizontally(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) {
            direction * shiftPx
        } + fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)),
        initialContentExit = slideOutHorizontally(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)) {
            -direction * shiftPx
        } + fadeOut(snap(delayMillis = ThesisMotion.Screen)),
        targetContentZIndex = 1f
    )
}

/** A 4.2 timed spec (never snapped: the reduced-motion paths above pick their own crossfade). */
internal fun <T> motionSpec(durationMillis: Int, delayMillis: Int = 0, easing: Easing): FiniteAnimationSpec<T> =
    ThesisMotion.timed(reduced = false, durationMillis = durationMillis, delayMillis = delayMillis, easing = easing)

/** Predictive back preview (4.5): the page scales to this and shifts [PREDICTIVE_BACK_SHIFT] at full progress. */
internal const val PREDICTIVE_BACK_SCALE = 0.90f
internal val PREDICTIVE_BACK_SHIFT: Dp = ThesisMotion.EnterOffset

/**
 * The predictive-back preview (4.5 "Any push/transform"): while the gesture runs, the page it would close (the
 * entry [entryId]) scales toward .90 and shifts 8 dp away from the swipe edge, with progress. Only that page
 * moves: the layers under it stay put.
 *
 * - Commit ([commit]): the pop runs and the leaving page keeps its previewed transform into its exit transition;
 *   the page under it enters at full size. The preview ends when the leaving page leaves the composition
 *   ([onLeft]); if the back did not take the page off screen, it settles back instead.
 * - Cancel ([cancel]): the page settles back to full size with `spatialSlow`.
 *
 * Read only in the draw phase ([backPreview]), so a gesture never recomposes the page.
 */
@Stable
internal class BackPreview {
    var entryId: String? by mutableStateOf(null)
        private set
    var progress: Float by mutableFloatStateOf(0f)
        private set
    var edge: BackSwipeEdge by mutableStateOf(BackSwipeEdge.Left)
        private set

    private var settleJob: Job? = null

    /** The gesture started on [id]: any settle still running from the last gesture stops where it is. */
    fun start(id: String) {
        settleJob?.cancel()
        settleJob = null
        if (entryId != id) progress = 0f
        entryId = id
    }

    fun update(progress: Float, edge: BackSwipeEdge) {
        this.progress = progress.coerceIn(0f, 1f)
        this.edge = edge
    }

    /** Back committed. [stillOnScreen]: the back left [entryId] in place (nothing to exit), so settle it back. */
    fun commit(scope: CoroutineScope, stillOnScreen: Boolean) {
        if (stillOnScreen) settle(scope)
    }

    fun cancel(scope: CoroutineScope) = settle(scope)

    /** The entry [id] left the composition: if it was the previewed page, the preview is over. */
    fun onLeft(id: String) {
        if (entryId == id) {
            settleJob?.cancel()
            settleJob = null
            entryId = null
            progress = 0f
        }
    }

    private fun settle(scope: CoroutineScope) {
        val from = progress
        settleJob?.cancel()
        settleJob = scope.launch {
            animate(from, 0f, animationSpec = ThesisMotion.spatialSlow()) { value, _ -> progress = value }
            entryId = null
        }
    }
}

/**
 * Applies [preview] to the page of [entryId] (scale toward [PREDICTIVE_BACK_SCALE], shift [backShiftPx] away from
 * the swipe edge). Nothing under reduced motion (4.8): back still commits, the page just does not move.
 */
internal fun Modifier.backPreview(preview: BackPreview, entryId: String, backShiftPx: Float, reducedMotion: Boolean): Modifier =
    if (reducedMotion) {
        this
    } else {
        graphicsLayer {
            if (preview.entryId == entryId) {
                val progress = preview.progress
                val scale = 1f - (1f - PREDICTIVE_BACK_SCALE) * progress
                scaleX = scale
                scaleY = scale
                translationX = progress * backShiftPx * if (preview.edge == BackSwipeEdge.Left) 1f else -1f
            }
        }
    }
