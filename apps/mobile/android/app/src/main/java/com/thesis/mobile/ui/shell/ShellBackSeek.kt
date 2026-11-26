package com.thesis.mobile.ui.shell

import androidx.compose.animation.core.Animatable
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
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

/*
 * Seekable predictive back (DESIGN-DIRECTION 4.5 "Any push/transform", playbook 8c; PR-4b). The tab layer runs on a
 * SeekableTransitionState, so a back gesture over a page pushed within a tab drives the real pop transition with its
 * progress: shared-axis X (the page leaves toward +24 dp and fades, then the page under it comes in from −24 dp) or,
 * for a page opened from a row, the container transform shrinking it back into the row.
 *
 * - Commit: the navigator pops, and the transition runs on from where the finger left it to the end (the remaining
 *   share of its duration, linear in time as the transition itself is timed).
 * - Cancel (or a back the app did not take): the transition goes back to the page on top with `spatialSlow` and
 *   snaps there, so nothing is left half way.
 * - The entry point stays ThesisPredictiveBackHandler in ThesisShell (registered before the layers, so a report
 *   WebView's own back still wins while it has history and is uncovered). Only a plain pop inside the current tab
 *   seeks ([backSeekTarget]): a modal, a report on either side (its WebView lives in the base layer, which is not
 *   seekable), a tab root going back to Today and reduced motion keep the PR-2 behaviour (the .90 preview, then the
 *   move on commit).
 */

/** What a back gesture is doing to the tab layer. */
internal sealed interface BackGesture {
    /** The gesture runs: the tab layer seeks toward [peek] with [TabSeek.progress]. */
    data class Seeking(val peek: NavEntry) : BackGesture

    /** The gesture was cancelled: the tab layer goes back from [peek] to the page on top, then the gesture is over. */
    data class Cancelling(val peek: NavEntry) : BackGesture
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

    /** True while a back gesture is seeking (not once it has committed or is settling back). */
    val seeking: Boolean get() = gesture is BackGesture.Seeking

    fun begin(peek: NavEntry) {
        progress = 0f
        gesture = BackGesture.Seeking(peek)
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
        gesture = if (committed) null else BackGesture.Cancelling(current.peek)
    }

    /**
     * Drives [transitionState] for the navigator's [target] and the current [gesture] (TabLayer's effect, restarted
     * whenever either changes).
     */
    suspend fun drive(target: NavEntry) {
        when (val g = gesture) {
            is BackGesture.Seeking -> if (g.peek.entryId != target.entryId) {
                snapshotFlow { progress }.collect { p -> transitionState.seekTo(p, g.peek) }
            }
            is BackGesture.Cancelling -> {
                settleBack(target)
                if (gesture == g) gesture = null
            }
            null -> if (transitionState.currentState != target || transitionState.targetState != target) {
                transitionState.animateTo(target)
            }
        }
    }

    /** Takes a seek back to [top] with `spatialSlow` (4.5 "cancel settles back"), then snaps there. */
    private suspend fun settleBack(top: NavEntry) {
        if (transitionState.targetState != top && transitionState.currentState == top) {
            val fraction = Animatable(transitionState.fraction)
            coroutineScope {
                val follow = launch { snapshotFlow { fraction.value }.collect { transitionState.seekTo(it.coerceIn(0f, 1f)) } }
                fraction.animateTo(0f, ThesisMotion.spatialSlow())
                follow.cancel()
            }
        }
        transitionState.snapTo(top)
    }
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
