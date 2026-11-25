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
 * The screen keeps a `pendingRemoval` set and passes [removing] = key in it. The item then collapses (its content
 * fades over `Quick`; 60 ms in, the row starts shrinking toward its top over `Base`), and [onRemoved] is called
 * once the collapse has finished: commit the removal there (or when the undo snackbar times out). Undo = take the
 * key out of the set before committing: the item expands back in place. First paint never animates. Reduced
 * motion: a 150 ms fade, then the space closes at once.
 *
 * Inside a RowGroup, pass the row's container (`Modifier.rowGroupSegment(position)`) as [modifier] rather than
 * wrapping [content] in it: the card surface then closes up with the row while only the content fades, so the
 * page background never shows through a gap in the card.
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
            fadeIn(ThesisMotion.quick())
        } else {
            expandVertically(ThesisMotion.spatial(), expandFrom = Alignment.Top) +
                fadeIn(tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard))
        },
        exit = if (reduced) {
            fadeOut(ThesisMotion.quick())
        } else {
            // The content clears first (Quick, EaseStandard: most of the fade is in its first 60 ms), and the row
            // starts closing only after CrossfadeDelay, so the clip never cuts through text that is still legible.
            shrinkVertically(
                tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard),
                shrinkTowards = Alignment.Top,
            ) + fadeOut(ThesisMotion.quick())
        },
        label = "dismissible",
    ) { content() }
}
