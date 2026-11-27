package com.thesis.mobile.ui.shell

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import com.thesis.mobile.ui.motion.ThesisTransitions
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
 * - Shared-axis X fits in `Screen` (300 ms, the 4.2 push/pop total) and splits its halves as the tab row's
 *   fade-through does: the old page slides toward −24 dp and fades out (90 ms `EaseExit`), then the new page slides
 *   in from +24 dp and fades in (210 ms after 90, `EaseEnter`). The old page is drawn under the new one, which is
 *   fully transparent until the old one has gone, so the old page's exit (and a predictive back's .90 preview) is
 *   visible to its last frame and the new page never shows over it.
 * - Rise and Fall (the modal layer, over a tab page that stays): the page's background fades in place, over the
 *   whole window, while its content rises (or falls) 32 dp; the content rises and fades in only once the background
 *   all but covers the page under it, and fades out before the background does ([ModalContentMotion]). Each hands
 *   over with a slight overlap, so no frame shows the bare background for long.
 */

/** The transitions of section 4.5, by name. Picked by [shellTransitionFor] and [modalTransitionFor]. */
internal enum class ShellTransition {
    /** Bottom tab ↔ tab: out fade 90 `EaseExit`; in fade + scale .985 → 1, 210 after 90 `EaseEnter`. */
    FadeThrough,

    /**
     * Push, 300 ms in all: old to −24 dp + fade out, 90 `EaseExit`; then new from +24 dp + fade, 210 `EaseEnter`
     * (it starts when the old page has gone, [SHARED_AXIS_IN_DELAY]).
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

    /**
     * Open a modal destination, 300 ms in all: the page background covers the page under it (150 `EaseEnter`);
     * from 120 ms, when the page under it shows at under 1%, the content rises 32 dp and fades in (180 `EaseEnter`,
     * [ModalContentMotion.Rise]).
     */
    Rise,

    /**
     * Close a modal destination, 240 ms in all: the content falls 32 dp and fades out (90 `EaseExit`,
     * [ModalContentMotion.Fall]), then the page background uncovers the page under it (150 `EaseStandard`, which
     * brings that page back at once instead of after a blank moment).
     */
    Fall,

    /**
     * Container transform in (4.5, principle 8): a list row opens its detail. The page grows from the tapped row's
     * bounds to the whole layer (300 ms `EaseStandard`) over the list, which stays put under a scrim; the page's
     * content fades in over the last 70%. The page draws the reveal itself ([TabLayer]); the transition only keeps
     * both pages composed for `Screen`.
     */
    ContainerIn,

    /** Container transform out: the page shrinks back into its row (240 ms `EaseStandard`) over the list. */
    ContainerOut,

    /**
     * A back gesture scrubbing a pop within a tab (PR-4b, [TabSeek]), 300 ms in all so a commit runs on from where
     * the finger left it. The gesture covers the first 120 ms only ([BACK_SEEK_PREVIEW_SHARE]): the page under fades
     * in place to [BACK_SEEK_UNDER_ALPHA] (linear, since the gesture's progress is already eased) under the page on
     * top, which keeps its .90 preview, stays opaque and stays put. The commit runs the last 180 ms (`PushOut`,
     * `EaseExit`): the page on top slides off toward the way the finger moves (the end edge for a swipe from the
     * left edge, the start edge for one from the right) while the page under comes up to full in its first 90 ms.
     * The page under shows around the page on top while it shrinks, and is uncovered by the slide, never seen
     * through it: no double exposure (4.5), as with the sequential halves of shared-axis X. (A 24 dp shift and
     * fade-out of the page on top, the plain pop, would show the page under through it, since it is already in.)
     */
    BackSeek,

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
 * [shellTransitionFor], with the container transform (4.5) for a push of an entry opened from a list row
 * ([pushedFromRow]: the entry has a transform origin) and for the pop of such an entry ([poppedToRow]). Reduced
 * motion keeps its crossfade.
 */
internal fun tabTransitionFor(
    move: NavMove,
    reducedMotion: Boolean,
    pushedFromRow: Boolean,
    poppedToRow: Boolean,
): ShellTransition = when {
    reducedMotion -> ShellTransition.ReducedCrossfade
    move == NavMove.Push && pushedFromRow -> ShellTransition.ContainerIn
    move == NavMove.Pop && poppedToRow -> ShellTransition.ContainerOut
    else -> shellTransitionFor(move, reducedMotion = false)
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
internal fun ShellTransition.toContentTransform(
    px: ShellMotionPx,
    swipeEdge: BackSwipeEdge = BackSwipeEdge.Left,
): ContentTransform = contentTransformOf(this, px, swipeEdge).withoutSizeAnimation()

/** Same enter and exit, no size animation and no clip (the scope's `using` exists only inside transitionSpec). */
private fun ContentTransform.withoutSizeAnimation(): ContentTransform =
    ContentTransform(targetContentEnter, initialContentExit, targetContentZIndex, SizeTransform(clip = false))

private fun contentTransformOf(transition: ShellTransition, px: ShellMotionPx, swipeEdge: BackSwipeEdge): ContentTransform =
    when (transition) {
        // The page fades; its content's .985 → 1 scale is applied inside the page by the tab layer, so the page
        // background does not move (4.3.4).
        ShellTransition.FadeThrough ->
            fadeIn(fadeThroughInSpec()).togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        ShellTransition.Forward, ShellTransition.ForwardOver -> sharedAxisXOf(forward = true, shiftPx = px.shiftPx)
        ShellTransition.Backward, ShellTransition.BackwardOver -> sharedAxisXOf(forward = false, shiftPx = px.shiftPx)
        // The page's background fades in over the whole window (it covers the tab page under it); its content
        // rises and fades in inside the page (ModalContentMotion.Rise). The initial "page" is the empty layer.
        ShellTransition.Rise ->
            fadeIn(motionSpec(MODAL_BACKGROUND_IN, easing = ThesisMotion.EaseEnter))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        // The page's content falls and fades out first (ModalContentMotion.Fall, 90 ms), then its background
        // uncovers the page under it (150 ms after 90, `EaseStandard`): 240 ms in all.
        ShellTransition.Fall ->
            fadeIn(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseStandard))
                .togetherWith(
                    fadeOut(
                        motionSpec(
                            ThesisMotion.ScreenOut - MODAL_FALL_CONTENT,
                            delayMillis = MODAL_FALL_CONTENT,
                            easing = ThesisMotion.EaseStandard
                        )
                    )
                )
        // The page under stays fully visible (a fade to alpha 1 only holds it for the move's length); the page on
        // top draws the reveal. Out, the list is drawn under the page that shrinks into it.
        ShellTransition.ContainerIn ->
            EnterTransition.None togetherWith
                fadeOut(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.Linear), targetAlpha = 1f)
        ShellTransition.ContainerOut ->
            ContentTransform(
                targetContentEnter = EnterTransition.None,
                initialContentExit = fadeOut(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.Linear), targetAlpha = 1f),
                targetContentZIndex = -1f,
            )
        ShellTransition.BackSeek -> {
            // Toward the way the finger moves: right for a swipe from the left edge, left for one from the right.
            val way = if (swipeEdge == BackSwipeEdge.Left) 1 else -1
            ContentTransform(
                // The page under stays in place (a slide would cut its gutter text at the window edge around the
                // .90 preview) and shows faintly while the finger is down: at most BACK_SEEK_UNDER_ALPHA, a `bg`
                // veil over it in effect. The commit brings it up as the page on top slides off it.
                targetContentEnter = fadeIn(
                    keyframes {
                        durationMillis = ThesisMotion.Screen
                        0f at 0 using ThesisMotion.Linear
                        BACK_SEEK_UNDER_ALPHA at BACK_SEEK_OUT_DELAY using ThesisMotion.EaseEnter
                        1f at BACK_SEEK_OUT_DELAY + ThesisMotion.PushOut / 2
                    }
                ),
                initialContentExit = slideOutHorizontally(
                    motionSpec(ThesisMotion.PushOut, delayMillis = BACK_SEEK_OUT_DELAY, easing = ThesisMotion.EaseExit)
                ) { width -> way * width },
                targetContentZIndex = -1f,
            )
        }
        ShellTransition.Crossfade ->
            fadeIn(motionSpec(ThesisMotion.Base, easing = ThesisMotion.EaseStandard)) togetherWith
                fadeOut(motionSpec(ThesisMotion.Base, easing = ThesisMotion.EaseStandard))
        ShellTransition.ReducedCrossfade -> reducedCrossfade()
    }

/** Fade-through's incoming half (4.5): 210 ms `EaseEnter` after 90 (fade, and the content's scale .985 → 1). */
internal fun <T> fadeThroughInSpec(): FiniteAnimationSpec<T> =
    motionSpec(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)

/** No animation: a value that does not move in this transition. */
internal fun <T> snapSpec(): FiniteAnimationSpec<T> = motionSpec(0, easing = ThesisMotion.Linear)

/** Reduced motion (4.8): a 150 ms crossfade instead of any slide, scale or rise. */
internal fun reducedCrossfade(): ContentTransform =
    fadeIn(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)) togetherWith
        fadeOut(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard))

/**
 * When the page on top starts to slide off in [ShellTransition.BackSeek] (120 ms): it ends with the move, at
 * `Screen`. The page under comes in before it, over these 120 ms.
 */
internal const val BACK_SEEK_OUT_DELAY: Int = ThesisMotion.Screen - ThesisMotion.PushOut

/**
 * How much of the page under shows in [ShellTransition.BackSeek] while the gesture is held (at full progress): it
 * reads as the page the back will reveal, faint enough that its edges around the .90 preview stay quiet.
 */
internal const val BACK_SEEK_UNDER_ALPHA: Float = 0.4f

/**
 * The share of [ShellTransition.BackSeek] a held gesture covers (.4, the page under's part): the page on top only
 * slides off once the back commits (4.5 "commit runs the pop").
 */
internal const val BACK_SEEK_PREVIEW_SHARE: Float = BACK_SEEK_OUT_DELAY.toFloat() / ThesisMotion.Screen

/** The 4.5 shift of shared-axis X. */
internal val SHARED_AXIS_SHIFT: Dp = ThesisMotion.PushOffset

/**
 * How long the incoming page of shared-axis X waits: the outgoing page's whole exit (`TabOut`, 90 ms), so the two
 * pages are never both visible. With the incoming half ([SHARED_AXIS_IN]) the move takes `Screen`, 300 ms.
 */
internal const val SHARED_AXIS_IN_DELAY: Int = ThesisTransitions.SharedAxisInDelay

/** How long the incoming half of shared-axis X runs once it starts (`TabIn`, 210 ms). */
internal const val SHARED_AXIS_IN: Int = ThesisTransitions.SharedAxisIn

/**
 * The incoming half of shared-axis X (210 ms `EaseEnter` after [SHARED_AXIS_IN_DELAY]), also used for the report
 * base layer's uncover when the page over the report is popped.
 */
internal fun <T> sharedAxisInSpec(): FiniteAnimationSpec<T> = ThesisTransitions.sharedAxisInSpec()

/** The outgoing half of shared-axis X (90 ms `EaseExit`). */
internal fun <T> sharedAxisOutSpec(): FiniteAnimationSpec<T> = ThesisTransitions.sharedAxisOutSpec()

/**
 * When, in [this] move, the page in front changes for the status bar's icons (2.7): once the page that leaves has
 * gone (fade-through and shared-axis X: 90 ms), half way through a crossfade, once a rising modal's background
 * has covered the page under it and its content starts (120 ms), or once a falling modal's background is about
 * half gone (120 ms: 30 ms into its 150 ms `EaseStandard` fade, which starts at 90). Switching in the move's first
 * frame would put the new page's icons over the old one.
 */
internal val ShellTransition.frontChangeMillis: Int
    get() = when (this) {
        ShellTransition.FadeThrough, ShellTransition.Forward, ShellTransition.Backward,
        ShellTransition.ForwardOver, ShellTransition.BackwardOver -> SHARED_AXIS_IN_DELAY
        ShellTransition.Rise -> MODAL_CONTENT_DELAY
        ShellTransition.Fall -> MODAL_FALL_CONTENT + (ThesisMotion.ScreenOut - MODAL_FALL_CONTENT) / 5
        // Half way through the reveal, when the page covers most of the list.
        ShellTransition.ContainerIn -> ThesisMotion.Screen / 2
        ShellTransition.ContainerOut -> ThesisMotion.ScreenOut / 2
        // Half way through the page on top's slide off.
        ShellTransition.BackSeek -> BACK_SEEK_OUT_DELAY + ThesisMotion.PushOut / 2
        ShellTransition.Crossfade -> ThesisMotion.Base / 2
        ShellTransition.ReducedCrossfade -> ThesisMotion.Quick / 2
    }

/**
 * Shared-axis X (4.5) for Auth ↔ Password reset in `ThesisApp`: the same motion as the shell's push and pop.
 * A 150 ms crossfade when motion is reduced.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform =
    ThesisTransitions.sharedAxisX(forward, reducedMotion, shiftPx)

/**
 * Shared-axis X, in sequence within 300 ms ([ThesisTransitions.sharedAxisX], the one spec of the app): the old
 * page leaves toward ∓[shiftPx] with a fade (90 ms `EaseExit`), then the new page comes in from ±[shiftPx] with a
 * fade (210 ms `EaseEnter`). The new page is drawn over the old one but is fully transparent until the old one has gone.
 */
private fun sharedAxisXOf(forward: Boolean, shiftPx: Int): ContentTransform =
    ThesisTransitions.sharedAxisX(forward, reduced = false, shiftPx = shiftPx)

/**
 * How a modal page's content moves inside the page while the page itself only fades ([ShellTransition.Rise],
 * [ShellTransition.Fall]): the background is the window-fixed page bitmap, so only the content shows the rise.
 * Offsets are in multiples of the rise distance (32 dp); alphas multiply the page's own fade.
 */
internal enum class ModalContentMotion {
    /**
     * Rise: the content comes up from +32 dp and fades in, 180 ms after 120 (`EaseEnter`): it starts once the page
     * background (150 ms `EaseEnter`) lets under 1% of the page under it through, so no text of that page shows
     * through, and the rise takes `Screen`, 300 ms in all.
     */
    Rise,

    /**
     * Fall: the content drops 32 dp and fades out together in 90 ms (`EaseExit`, the fade-through out), so it has
     * gone before the page's background uncovers the page under it (150 ms after 90): 240 ms in all.
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
    entering && motion == ModalContentMotion.Rise -> modalContentRiseSpec()
    !entering && motion == ModalContentMotion.Fall -> motionSpec(MODAL_FALL_CONTENT, easing = ThesisMotion.EaseExit)
    else -> motionSpec(0, easing = ThesisMotion.Linear)
}

/** The content's offset spec (in rise distances) for an entering ([entering]) or leaving page moving by [motion]. */
internal fun modalContentOffsetSpec(motion: ModalContentMotion, entering: Boolean): FiniteAnimationSpec<Float> = when {
    entering && motion == ModalContentMotion.Rise -> modalContentRiseSpec()
    !entering && motion == ModalContentMotion.Fall -> motionSpec(MODAL_FALL_CONTENT, easing = ThesisMotion.EaseExit)
    else -> motionSpec(0, easing = ThesisMotion.Linear)
}

/**
 * How long a rising modal page's background takes to cover the page under it (150 ms `EaseEnter`). Measured on
 * pixels, a 300 ms background was still letting 6-12% of the page under it through when the content arrived
 * (ShellDoubleExposureTest).
 */
internal const val MODAL_BACKGROUND_IN: Int = ThesisMotion.Quick

/**
 * When a rising modal page's content starts (120 ms): 80% into the background's `EaseEnter` fade, when the page
 * under it shows at 0.6%, so the content overlaps the background's last 30 ms instead of following a blank page.
 * The content then runs `PushOut` (180 ms) and the rise ends at `Screen`.
 */
internal const val MODAL_CONTENT_DELAY: Int = ThesisMotion.Screen - ThesisMotion.PushOut

/** How long a falling modal page's content takes to drop and fade out (90 ms), before its background goes. */
internal const val MODAL_FALL_CONTENT: Int = ThesisMotion.TabOut

/** A rising modal page's content: rise and fade together, 180 ms `EaseEnter` after [MODAL_CONTENT_DELAY]. */
private fun <T> modalContentRiseSpec(): FiniteAnimationSpec<T> =
    motionSpec(ThesisMotion.Screen - MODAL_CONTENT_DELAY, delayMillis = MODAL_CONTENT_DELAY, easing = ThesisMotion.EaseEnter)

/** A 4.2 timed spec (never snapped: the reduced-motion paths above pick their own crossfade). */
internal fun <T> motionSpec(durationMillis: Int, delayMillis: Int = 0, easing: Easing): FiniteAnimationSpec<T> =
    ThesisMotion.timed(reduced = false, durationMillis = durationMillis, delayMillis = delayMillis, easing = easing)

/** Predictive back preview (4.5): the page scales to this and shifts [PREDICTIVE_BACK_SHIFT] at full progress. */
internal const val PREDICTIVE_BACK_SCALE = ThesisMotion.BackScaleTo
internal val PREDICTIVE_BACK_SHIFT: Dp = ThesisMotion.BackShift

/**
 * The predictive-back preview (4.5 "Any push/transform"): while the gesture runs, the page it would close (the
 * entry [entryId]) scales toward .90 and shifts 8 dp away from the swipe edge, with progress. Only that page
 * moves: the layers under it stay put.
 *
 * - Commit ([commit]): the pop runs and the leaving page keeps its previewed transform into its exit transition,
 *   which is visible to its end (shared-axis X draws nothing over it until it has gone); then the page under it
 *   comes in at full size. The preview ends when the leaving page leaves the composition ([onLeft]); if the back
 *   did not take the page off screen, or the page is back on top before it has left ([onTopAgain]), it settles
 *   back instead. A page that shrinks back into its row (a report opened from a History or Research row) drops
 *   its preview along the shrink (`ScreenOut`, `EaseStandard`, the bounds' own timing), so it lands on the row.
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

    /** A gesture is in progress (between [start] and its [commit] or [cancel]). */
    private var gestureRunning = false

    /** The gesture started on [id]: any settle still running from the last gesture stops where it is. */
    fun start(id: String) {
        settleJob?.cancel()
        settleJob = null
        gestureRunning = true
        if (entryId != id) progress = 0f
        entryId = id
    }

    fun update(progress: Float, edge: BackSwipeEdge) {
        this.progress = progress.coerceIn(0f, 1f)
        this.edge = edge
    }

    /**
     * Back committed. [stillOnScreen]: the back left [entryId] in place (nothing to exit), so settle it back.
     * [intoRow]: the page leaves by shrinking into the row it was opened from, so the preview goes with the shrink.
     */
    fun commit(scope: CoroutineScope, stillOnScreen: Boolean, intoRow: Boolean = false) {
        gestureRunning = false
        when {
            stillOnScreen -> settle(scope)
            intoRow -> settle(scope, motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard))
        }
    }

    fun cancel(scope: CoroutineScope) {
        gestureRunning = false
        settle(scope)
    }

    /**
     * [id] is the top page again. If it is the page a committed back was closing and it has not left yet (its tab
     * re-selected inside the exit: AnimatedContent reuses the leaving page, so [onLeft] never runs), the preview
     * settles back to full size here instead of staying at .90 and keeping the shared root bar off.
     */
    fun onTopAgain(id: String, scope: CoroutineScope) {
        if (!gestureRunning && entryId == id && settleJob?.isActive != true) settle(scope)
    }

    /** The entry [id] left the composition: if it was the previewed page, the preview is over. */
    fun onLeft(id: String) {
        if (entryId == id) {
            settleJob?.cancel()
            settleJob = null
            entryId = null
            progress = 0f
        }
    }

    private fun settle(scope: CoroutineScope, spec: AnimationSpec<Float> = ThesisMotion.spatialSlow()) {
        val from = progress
        settleJob?.cancel()
        settleJob = scope.launch {
            animate(from, 0f, animationSpec = spec) { value, _ -> progress = value }
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
