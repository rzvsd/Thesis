package com.thesis.mobile.ui.shell

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animate
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
     * [Forward] inside the modal layer (You → Appearance). Same motion; the modal layer puts the page background
     * under the two pages while it runs, so the tab layer under the modal never shows through.
     */
    ForwardOver,

    /** [Backward] inside the modal layer; see [ForwardOver]. */
    BackwardOver,

    /** Open a modal destination: rise 32 dp + fade, 300 `EaseEnter`. */
    Rise,

    /** Close a modal destination: fall 32 dp + fade, 240 `EaseExit`. */
    Fall,

    /** A replaced entry (a build becoming its report, 5.14) or a restore: 240 ms crossfade (`Base`), nothing moves. */
    Crossfade,

    /** Every move under reduced motion (4.8): 150 ms crossfade (`Quick`), nothing slides, rises or scales. */
    ReducedCrossfade;

    /**
     * Shared-axis X: the incoming page is opaque (2.7) from its first frame and only its content fades in, so the
     * page it covers never shows through it (4.5 "Screens are opaque, so nothing double-exposes"). Layers whose
     * pages carry their own background apply that fade inside the page ([pageContentFadeSpec]).
     */
    val incomingPageOpaque: Boolean
        get() = this == Forward || this == Backward || this == ForwardOver || this == BackwardOver
}

/**
 * The tab layer's and report base layer's transition for [move]. Reduced motion (4.8) turns every move into a
 * 150 ms crossfade: no slide, no scale.
 */
internal fun shellTransitionFor(move: NavMove, reducedMotion: Boolean): ShellTransition = when {
    reducedMotion -> ShellTransition.ReducedCrossfade
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
        reducedMotion -> ShellTransition.ReducedCrossfade
        from == null -> ShellTransition.Rise
        to == null -> ShellTransition.Fall
        forward -> ShellTransition.ForwardOver
        else -> ShellTransition.BackwardOver
    }

/** Pixel distances of the shell transitions at the current density. */
internal data class ShellMotionPx(val shiftPx: Int, val risePx: Int)

/**
 * The [ContentTransform] for [transition]. Never animates size: every layer is full size in every state.
 * [pageFadesItsContent]: the layer's pages draw their own opaque background and fade their content themselves
 * when [ShellTransition.incomingPageOpaque] ([pageContentFadeSpec]), so the incoming page only slides here.
 */
internal fun ShellTransition.toContentTransform(px: ShellMotionPx, pageFadesItsContent: Boolean = false): ContentTransform =
    contentTransformOf(this, px, pageFadesItsContent && incomingPageOpaque).withoutSizeAnimation()

/** Same enter and exit, no size animation and no clip (the scope's `using` exists only inside transitionSpec). */
private fun ContentTransform.withoutSizeAnimation(): ContentTransform =
    ContentTransform(targetContentEnter, initialContentExit, targetContentZIndex, SizeTransform(clip = false))

private fun contentTransformOf(transition: ShellTransition, px: ShellMotionPx, opaqueIncoming: Boolean): ContentTransform =
    when (transition) {
        ShellTransition.FadeThrough -> {
            val enter = motionSpec<Float>(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
            (fadeIn(enter) + scaleIn(enter, initialScale = ThesisMotion.TabScaleFrom))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        }
        ShellTransition.Forward, ShellTransition.ForwardOver ->
            sharedAxisXOf(forward = true, shiftPx = px.shiftPx, fadeIncoming = !opaqueIncoming)
        ShellTransition.Backward, ShellTransition.BackwardOver ->
            sharedAxisXOf(forward = false, shiftPx = px.shiftPx, fadeIncoming = !opaqueIncoming)
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
        ShellTransition.Crossfade ->
            fadeIn(motionSpec(ThesisMotion.Base, easing = ThesisMotion.EaseStandard)) togetherWith
                fadeOut(motionSpec(ThesisMotion.Base, easing = ThesisMotion.EaseStandard))
        ShellTransition.ReducedCrossfade -> reducedCrossfade()
    }

/** Reduced motion (4.8): a 150 ms crossfade instead of any slide, scale or rise. */
internal fun reducedCrossfade(): ContentTransform =
    fadeIn(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)) togetherWith
        fadeOut(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard))

/** The 4.5 shift of shared-axis X. */
internal val SHARED_AXIS_SHIFT: Dp = ThesisMotion.PushOffset

/**
 * The incoming page's content fade of shared-axis X (300 ms `EaseEnter`), for a page whose background is drawn
 * outside the fade ([ShellTransition.incomingPageOpaque]).
 */
internal fun pageContentFadeSpec(): FiniteAnimationSpec<Float> = motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)

/**
 * Shared-axis X (4.5): forward, the new screen comes in from +[shiftPx] with a fade (300 ms) while the old one
 * leaves toward −[shiftPx] with a fade (180 ms); backward mirrors it. A 150 ms crossfade when motion is reduced.
 * Used by Auth ↔ Password reset in `ThesisApp`; the shell's layers use the same motion with an opaque incoming page.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform =
    if (reducedMotion) reducedCrossfade() else sharedAxisXOf(forward, shiftPx, fadeIncoming = true)

/**
 * Shared-axis X. [fadeIncoming] false: the incoming page fades its own content over its opaque background
 * ([pageContentFadeSpec]), so the transform only slides it; the page it covers is hidden at once, except the
 * 24 dp strip it slides in from, where the old page leaves as specified.
 */
private fun sharedAxisXOf(forward: Boolean, shiftPx: Int, fadeIncoming: Boolean): ContentTransform {
    val direction = if (forward) 1 else -1
    val slideIn = slideInHorizontally(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { direction * shiftPx }
    val enter = if (fadeIncoming) slideIn + fadeIn(pageContentFadeSpec()) else slideIn
    return enter.togetherWith(
        slideOutHorizontally(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)) { -direction * shiftPx } +
            fadeOut(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit))
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
