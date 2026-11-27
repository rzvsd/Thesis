package com.thesis.mobile.ui.shell

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.SeekableTransitionState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.platform.BackSwipeEdge
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * Seekable predictive back (DESIGN-DIRECTION 4.5 "Any push/transform", playbook 8c; PR-4b). The tab layer runs on a
 * SeekableTransitionState, so a back gesture over a page pushed within a tab previews the real pop with its
 * progress, and a commit runs the rest of that pop from there:
 *
 * - A plain pop (ShellTransition.BackSeek): while the finger is down the page under comes in from 24 dp beneath
 *   the page on top, which keeps its .90 preview and never moves off; only the commit slides it off, toward the
 *   way the finger moves ([backSeekFraction]: the gesture covers the first 40% of the move, the page under's part).
 * - A page opened from a row: the gesture shrinks it toward the row, at most 35% of the way (eased) at full
 *   progress, so the page stays whole and readable (content alpha ≥ .5) until the commit runs the shrink on.
 * - Cancel (or a back the app did not take): the transition goes back to the page on top with `spatialSlow` and
 *   snaps there, so nothing is left half way.
 * - The entry point stays ThesisPredictiveBackHandler in ThesisShell (registered before the layers, so a report
 *   WebView's own back still wins while it has history and is uncovered). Only a plain pop inside the current tab,
 *   from a layer at rest, seeks ([backSeekTarget], [TabSeek.atRestOn]): a modal, a report on either side (its
 *   WebView lives in the base layer, which is not seekable), a tab root going back to Today, a layer still moving
 *   and reduced motion keep the PR-2 behaviour (the .90 preview, then the move on commit).
 *
 * Interruptions stay continuous ([TabSeek.drive]): SeekableTransitionState.animateTo, retargeted mid-move, would
 * first run the old move to its end (the page the user went past flashes in full). Instead the move in progress is
 * rewound to where it started (or, once mostly done or after a committed back, run on to its end) within 90 ms,
 * by seeking, and the new move starts from rest.
 */

/** What a back gesture is doing to the tab layer. */
internal sealed interface BackGesture {
    /**
     * The gesture runs: the tab layer seeks toward [peek] with [TabSeek.progress]. [intoRow]: the page on top was
     * opened from a row and shrinks back into it; [edge]: where the swipe started.
     */
    data class Seeking(val peek: NavEntry, val intoRow: Boolean = false, val edge: BackSwipeEdge = BackSwipeEdge.Left) : BackGesture

    /** The gesture was cancelled: the tab layer goes back from [peek] to the page on top, then the gesture is over. */
    data class Cancelling(val peek: NavEntry) : BackGesture
}

/**
 * How far into the pop a held gesture at [progress] seeks: a plain pop only up to the point where the page on top
 * would start to leave ([BACK_SEEK_PREVIEW_SHARE]); a transformed page ([intoRow]) on the de-eased fraction where the
 * shrink (`EaseStandard`) has gone [ThesisMotion.TransformSeekMax] × [progress] of the way to the row.
 */
internal fun backSeekFraction(progress: Float, intoRow: Boolean): Float {
    val p = progress.coerceIn(0f, 1f)
    return if (intoRow) inverseEaseStandard(p * ThesisMotion.TransformSeekMax) else p * BACK_SEEK_PREVIEW_SHARE
}

/** The play-time fraction at which `EaseStandard` reaches [value] (bisection; the easing is monotonic). */
internal fun inverseEaseStandard(value: Float): Float {
    if (value <= 0f) return 0f
    if (value >= 1f) return 1f
    var lo = 0f
    var hi = 1f
    repeat(24) {
        val mid = (lo + hi) / 2f
        if (ThesisMotion.EaseStandard.transform(mid) < value) lo = mid else hi = mid
    }
    return (lo + hi) / 2f
}

/**
 * The tab layer's seekable transition and the back gesture that may be driving it. Owned by the shell (so the
 * report base layer and the bottom bar can follow what the tab layer shows: [shown]) and handed to [TabLayer].
 */
@Stable
internal class TabSeek(initial: NavEntry) {
    val transitionState = SeekableTransitionState(initial)

    /** The entry the tab layer shows, or is moving to (it follows the navigator a frame or two behind). */
    val shown: NavEntry get() = transitionState.targetState

    var gesture: BackGesture? by mutableStateOf(null)
        private set

    /** The gesture's progress, 0..1. */
    var progress: Float by mutableFloatStateOf(0f)
        private set

    /** The edge the last gesture started from: a plain pop's commit slides the page on top off toward the finger. */
    var edge: BackSwipeEdge by mutableStateOf(BackSwipeEdge.Left)
        private set

    /** True while a back gesture is seeking (not once it has committed or is settling back). */
    val seeking: Boolean get() = gesture is BackGesture.Seeking

    /** The entry a committed gesture popped to, while its pop still runs (an interruption then runs it on). */
    private var committedTo: NavEntry? = null

    /** The layer rests on [entry], with no move running: a gesture seeks only from rest. */
    fun atRestOn(entry: NavEntry): Boolean =
        transitionState.currentState.entryId == entry.entryId && transitionState.targetState.entryId == entry.entryId

    fun begin(peek: NavEntry, intoRow: Boolean = false, edge: BackSwipeEdge = BackSwipeEdge.Left) {
        progress = 0f
        this.edge = edge
        gesture = BackGesture.Seeking(peek, intoRow, edge)
    }

    fun update(progress: Float) {
        this.progress = progress.coerceIn(0f, 1f)
    }

    /**
     * The gesture ended. [committed]: the navigator popped (the tab layer then animates on to its new top); else it
     * goes back to the page on top.
     */
    fun end(committed: Boolean) {
        val current = gesture as? BackGesture.Seeking ?: return
        committedTo = if (committed) current.peek else null
        gesture = if (committed) null else BackGesture.Cancelling(current.peek)
    }

    /**
     * Drives [transitionState] for the navigator's [target] and the current [gesture] (TabLayer's effect, restarted
     * whenever either changes).
     */
    suspend fun drive(target: NavEntry) {
        when (val g = gesture) {
            is BackGesture.Seeking -> if (g.peek.entryId != target.entryId) {
                snapshotFlow { progress }.collect { p -> transitionState.seekTo(backSeekFraction(p, g.intoRow), g.peek) }
            }
            is BackGesture.Cancelling -> {
                settleBack(target)
                if (gesture == g) gesture = null
            }
            null -> follow(target)
        }
    }

    /** Moves the layer to [target], from rest or from wherever an interrupted move had got to (no jump). */
    private suspend fun follow(target: NavEntry) {
        val state = transitionState
        when {
            state.currentState == target && state.targetState == target -> Unit
            // Already moving there (a commit runs on, or the effect restarted mid-move): carry on.
            state.targetState == target -> state.animateTo(target)
            // At rest: the move.
            state.currentState == state.targetState -> state.animateTo(target)
            // The navigator moved again before the last move ended.
            else -> {
                val from = state.currentState
                val runOn = target != from && (state.fraction >= INTERRUPT_RUN_ON_FROM || committedTo == state.targetState)
                if (runOn) {
                    seekOver(1f, interruptSpec(1f - state.fraction))
                    state.snapTo(state.targetState)
                } else {
                    // Back to where the move started: the page it was leaving comes back as it left.
                    seekOver(0f, interruptSpec(state.fraction))
                    state.snapTo(from)
                }
                if (state.currentState != target) state.animateTo(target)
            }
        }
        if (state.currentState == state.targetState) committedTo = null
    }

    /** Takes a seek back to [top] with `spatialSlow` (4.5 "cancel settles back"), then snaps there. */
    private suspend fun settleBack(top: NavEntry) {
        if (transitionState.targetState != top && transitionState.currentState == top) {
            seekOver(0f, ThesisMotion.spatialSlow())
        }
        transitionState.snapTo(top)
    }

    /** Seeks the transition (same states) from its fraction to [to] along [spec], ending exactly on [to]. */
    private suspend fun seekOver(to: Float, spec: FiniteAnimationSpec<Float>) {
        val state = transitionState
        if (state.currentState == state.targetState) return
        val fraction = Animatable(state.fraction)
        coroutineScope {
            val follow = launch { snapshotFlow { fraction.value }.collect { state.seekTo(it.coerceIn(0f, 1f)) } }
            fraction.animateTo(to, spec)
            follow.cancel()
        }
        state.seekTo(to.coerceIn(0f, 1f))
    }
}

/** From this fraction of a move on, an interruption runs it on to its end instead of rewinding it. */
internal const val INTERRUPT_RUN_ON_FROM = 0.5f

/** The longest an interrupted move takes to rewind or run on before the next move starts (90 ms, `TabOut`). */
internal const val INTERRUPT_MAX_MILLIS: Int = ThesisMotion.TabOut

/** Rewinding or running on [share] of a `Screen` move: at its own pace, capped at [INTERRUPT_MAX_MILLIS], linear. */
private fun interruptSpec(share: Float): FiniteAnimationSpec<Float> {
    val millis = (abs(share) * ThesisMotion.Screen).roundToInt().coerceIn(1, INTERRUPT_MAX_MILLIS)
    return motionSpec(millis, easing = ThesisMotion.Linear)
}

/** A [TabSeek] for the shell's lifetime, starting at [initial]. */
@Composable
internal fun rememberTabSeek(initial: NavEntry): TabSeek = androidx.compose.runtime.remember { TabSeek(initial) }

/**
 * The page a back gesture would reveal by a plain pop inside the current tab, which the tab layer can scrub; null
 * when back does anything else (closes a modal, leaves a tab root for Today), when a report is on either side (it
 * is drawn by the base layer), or under reduced motion (4.8: back just crossfades on commit).
 */
internal fun AppNavigator.backSeekTarget(reducedMotion: Boolean): NavEntry? {
    if (reducedMotion || modalStack.isNotEmpty()) return null
    val stack = stack(currentTab)
    if (stack.size < 2) return null
    val top = stack[stack.lastIndex]
    val below = stack[stack.lastIndex - 1]
    if (top.destination is Destination.Report || below.destination is Destination.Report) return null
    return below
}

/**
 * The report the base layer shows under the tab layer's [shown] entry: the last `Report` at or below it on its
 * stack. While [shown] is on no stack (it was just popped or replaced and the tab layer has not moved yet), the
 * report it had stays, so the two layers always move in the same frames.
 */
@Composable
internal fun rememberShownReport(navigator: AppNavigator, shown: NavEntry): NavEntry? {
    val stack = ShellTab.entries.asSequence().map { navigator.stack(it) }.firstOrNull { s -> s.any { it.entryId == shown.entryId } }
    val report = stack?.let { s ->
        s.subList(0, s.indexOfFirst { it.entryId == shown.entryId } + 1).lastOrNull { it.destination is Destination.Report }
    }
    return heldWhile(hold = stack == null, value = report)
}
