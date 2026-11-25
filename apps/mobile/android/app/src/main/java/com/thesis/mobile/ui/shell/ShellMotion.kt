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
import androidx.compose.animation.slideOutHorizontally
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
 *
 * No double exposure, no hard cut (4.5 "Screens are opaque, so nothing double-exposes"): two pages are never both
 * readable in the same frame, and a page that leaves is seen leaving.
 * - Shared-axis X runs its two halves in sequence: the old page slides to −24 dp and fades out (180 ms `EaseExit`),
 *   then the new page slides in from +24 dp and fades in (300 ms `EaseEnter`). The old page is drawn under the new
 *   one, which is fully transparent until the old one has gone, so the old page's exit (and a predictive back's
 *   .90 preview) is visible to its last frame and the new page never shows over it.
 * - Rise and Fall (the modal layer, over a tab page that stays): the page's background fades in place, over the
 *   whole window, while its content rises (or falls) 32 dp; the content fades in only once the background covers
 *   the page under it, and fades out before the background does ([ModalContentMotion]).
 */

/** The transitions of section 4.5, by name. Picked by [shellTransitionFor] and [modalTransitionFor]. */
internal enum class ShellTransition {
    /** Bottom tab ↔ tab: out fade 90 `EaseExit`; in fade + scale .985 → 1, 210 after 90 `EaseEnter`. */
    FadeThrough,

    /**
     * Push: old to −24 dp + fade out, 180 `EaseExit`; then new from +24 dp + fade, 300 `EaseEnter` (it starts when
     * the old page has gone, [SHARED_AXIS_IN_DELAY]).
     */
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

    /** Open a modal destination: rise 32 dp + fade, 300 `EaseEnter` ([ModalContentMotion.Rise]). */
    Rise,

    /** Close a modal destination: fall 32 dp + fade, 240 `EaseExit` ([ModalContentMotion.Fall]). */
    Fall,

    /** A replaced entry (a build becoming its report, 5.14) or a restore: 240 ms crossfade (`Base`), nothing moves. */
    Crossfade,

    /** Every move under reduced motion (4.8): 150 ms crossfade (`Quick`), nothing slides, rises or scales. */
    ReducedCrossfade,
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
 * The [ContentTransform] for [transition], applied to whole pages (background and content). Never animates size:
 * every layer is full size in every state. Rise and Fall only fade the page here: the modal layer moves and fades
 * the page's content itself ([ModalContentMotion]).
 */
internal fun ShellTransition.toContentTransform(px: ShellMotionPx): ContentTransform =
    contentTransformOf(this, px).withoutSizeAnimation()

/** Same enter and exit, no size animation and no clip (the scope's `using` exists only inside transitionSpec). */
private fun ContentTransform.withoutSizeAnimation(): ContentTransform =
    ContentTransform(targetContentEnter, initialContentExit, targetContentZIndex, SizeTransform(clip = false))

private fun contentTransformOf(transition: ShellTransition, px: ShellMotionPx): ContentTransform =
    when (transition) {
        ShellTransition.FadeThrough -> {
            val enter = motionSpec<Float>(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
            (fadeIn(enter) + scaleIn(enter, initialScale = ThesisMotion.TabScaleFrom))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        }
        ShellTransition.Forward, ShellTransition.ForwardOver -> sharedAxisXOf(forward = true, shiftPx = px.shiftPx)
        ShellTransition.Backward, ShellTransition.BackwardOver -> sharedAxisXOf(forward = false, shiftPx = px.shiftPx)
        // The page's background fades in over the whole window (it covers the tab page under it); its content
        // rises and fades in inside the page (ModalContentMotion.Rise). The initial "page" is the empty layer.
        ShellTransition.Rise ->
            fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        // The page's content falls and fades out first (ModalContentMotion.Fall), then its background.
        ShellTransition.Fall ->
            fadeIn(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseStandard))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)))
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
 * How long the incoming page of shared-axis X waits: the outgoing page's whole exit (`PushOut`, 180 ms), so the
 * two pages are never both visible.
 */
internal const val SHARED_AXIS_IN_DELAY: Int = ThesisMotion.PushOut

/**
 * The incoming half of shared-axis X (300 ms `EaseEnter` after [SHARED_AXIS_IN_DELAY]), also used for the report
 * base layer's uncover when the page over the report is popped.
 */
internal fun <T> sharedAxisInSpec(): FiniteAnimationSpec<T> =
    motionSpec(ThesisMotion.Screen, delayMillis = SHARED_AXIS_IN_DELAY, easing = ThesisMotion.EaseEnter)

/** The outgoing half of shared-axis X (180 ms `EaseExit`). */
internal fun <T> sharedAxisOutSpec(): FiniteAnimationSpec<T> = motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)

/**
 * Shared-axis X (4.5) for Auth ↔ Password reset in `ThesisApp`: the same motion as the shell's push and pop.
 * A 150 ms crossfade when motion is reduced.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform =
    if (reducedMotion) reducedCrossfade() else sharedAxisXOf(forward, shiftPx)

/**
 * Shared-axis X, in sequence: forward, the old page leaves toward −[shiftPx] with a fade (180 ms `EaseExit`), then
 * the new page comes in from +[shiftPx] with a fade (300 ms `EaseEnter`); backward mirrors it. The new page is
 * drawn over the old one but is fully transparent until the old one has gone.
 */
private fun sharedAxisXOf(forward: Boolean, shiftPx: Int): ContentTransform {
    val direction = if (forward) 1 else -1
    return (slideInHorizontally(sharedAxisInSpec()) { direction * shiftPx } + fadeIn(sharedAxisInSpec()))
        .togetherWith(slideOutHorizontally(sharedAxisOutSpec()) { -direction * shiftPx } + fadeOut(sharedAxisOutSpec()))
}

/**
 * How a modal page's content moves inside the page while the page itself only fades ([ShellTransition.Rise],
 * [ShellTransition.Fall]): the background is the window-fixed page bitmap, so only the content shows the rise.
 * Offsets are in multiples of the rise distance (32 dp); alphas multiply the page's own fade.
 */
internal enum class ModalContentMotion {
    /** Rise: the content comes up from +32 dp (300 ms `EaseEnter`) and fades in 210 ms after 90 (`EaseEnter`). */
    Rise,

    /**
     * Fall: the content drops 32 dp (240 ms `EaseExit`) and fades out in 90 ms (`EaseExit`, the fade-through out),
     * so it has gone before the page's own 240 ms fade uncovers the page under it.
     */
    Fall,

    /** Any other move: the content stays put at full alpha (the page's own transition does the work). */
    None;

    companion object {
        fun of(transition: ShellTransition?): ModalContentMotion = when (transition) {
            ShellTransition.Rise -> Rise
            ShellTransition.Fall -> Fall
            else -> None
        }
    }
}

/** The content's alpha spec for an entering ([entering]) or leaving page moving by [motion]. */
internal fun modalContentAlphaSpec(motion: ModalContentMotion, entering: Boolean): FiniteAnimationSpec<Float> = when {
    entering && motion == ModalContentMotion.Rise ->
        motionSpec(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
    !entering && motion == ModalContentMotion.Fall -> motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)
    else -> motionSpec(0, easing = ThesisMotion.Linear)
}

/** The content's offset spec (in rise distances) for an entering ([entering]) or leaving page moving by [motion]. */
internal fun modalContentOffsetSpec(motion: ModalContentMotion, entering: Boolean): FiniteAnimationSpec<Float> = when {
    entering && motion == ModalContentMotion.Rise -> motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)
    !entering && motion == ModalContentMotion.Fall -> motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)
    else -> motionSpec(0, easing = ThesisMotion.Linear)
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
 * - Commit ([commit]): the pop runs and the leaving page keeps its previewed transform into its exit transition,
 *   which is visible to its end (shared-axis X draws nothing over it until it has gone); then the page under it
 *   comes in at full size. The preview ends when the leaving page leaves the composition ([onLeft]); if the back
 *   did not take the page off screen, it settles back instead.
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
