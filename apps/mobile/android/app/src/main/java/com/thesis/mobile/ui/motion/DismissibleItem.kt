package com.thesis.mobile.ui.motion

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.theme.LocalReducedMotion
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

/**
 * A lazy-list item that can leave and come back (docs/app-redesign/DESIGN-DIRECTION.md 3 #42, 4.4: Remove name,
 * Quiet alert). `animateItemPlacement` (Compose 1.6) moves the survivors but does not animate the removed item;
 * this does.
 *
 * The screen keeps a `pendingRemoval` set and passes [removing] = key in it. The item then collapses (shrinks
 * toward its top and fades, `Base`), and [onRemoved] is called once the collapse has finished: commit the removal
 * there (or when the undo snackbar times out). Undo = take the key out of the set before committing: the item
 * expands back in place. First paint never animates. Reduced motion: a 150 ms fade, then the space closes at once.
 */
@Composable
fun DismissibleItem(
    removing: Boolean,
    onRemoved: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val reduced = LocalReducedMotion.current
    val state = remember { MutableTransitionState(!removing) }
    state.targetState = !removing
    val removed by rememberUpdatedState(onRemoved)
    LaunchedEffect(state) {
        snapshotFlow { state.isIdle && !state.currentState }
            .distinctUntilChanged()
            .filter { it }
            .collect { removed() }
    }
    AnimatedVisibility(
        visibleState = state,
        modifier = modifier,
        enter = if (reduced) {
            fadeIn(tween(ThesisMotion.Quick))
        } else {
            expandVertically(ThesisMotion.spatial(), expandFrom = Alignment.Top) +
                fadeIn(tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard))
        },
        exit = if (reduced) {
            fadeOut(tween(ThesisMotion.Quick))
        } else {
            shrinkVertically(tween(ThesisMotion.Base, easing = ThesisMotion.EaseStandard), shrinkTowards = Alignment.Top) +
                fadeOut(tween(ThesisMotion.Quick, easing = ThesisMotion.EaseExit))
        },
        label = "dismissible",
    ) { content() }
}
