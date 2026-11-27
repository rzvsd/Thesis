package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.tween
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.theme.LocalReducedMotion

/*
 * Lazy list item motion (DESIGN-DIRECTION 4.4; PR-4b, Compose 1.7 `animateItem` with its fade specs turned on).
 *
 * - An item that joins the list (a name added, an alert coming back with Show quiet, a filter widened) fades in
 *   over `Base` with `EaseStandard`, after `CrossfadeDelay`, so the rows around it have started to make room and
 *   it never lands on top of one that is still moving.
 * - An item that leaves (a filter narrowed, Show quiet turned off, a day header whose rows all collapsed) fades out
 *   over `Quick`, the exit of small things, while the survivors close up. Removal by the user still collapses the
 *   row in place first (DismissibleItem), so by the time the item leaves the list it has no height left to fade.
 * - Every item glides to a new place with `spatial` (sort, filter, insertion above it).
 * - Compose only fades items whose key was not in the list's previous layout, so a list composed with its rows
 *   already there (a tab switch, a revisit, scrolling) shows them at once. A list whose first layout held a
 *   placeholder item instead (Names' "skeleton" item, also present, empty, during the 300 ms grace) is not a first
 *   paint for its rows: they are new keys and fade in (`Base` after `CrossfadeDelay`), which is 4.4's skeleton →
 *   content crossfade in place. The placeholder and state items do not use this modifier, so they leave in one
 *   frame with no fade of their own: skeleton bars and row text never show at once.
 * - Reduced motion (4.8): items fade (`Quick`) but never travel: no placement animation.
 */

/**
 * The 4.4 item motion for this lazy item (see the file comment). [placement] = false keeps the fades but lets the
 * item take its new place at once: for sticky headers, which the list pins and moves itself, and for every item of
 * a list that has them (Inbox), so rows and headers always move in the same frames.
 */
@Composable
fun LazyItemScope.thesisItemMotion(placement: Boolean = true): Modifier {
    val reduced = LocalReducedMotion.current
    return Modifier.animateItem(
        fadeInSpec = if (reduced) {
            ThesisMotion.quick()
        } else {
            tween(ThesisMotion.Base, ThesisMotion.CrossfadeDelay, ThesisMotion.EaseStandard)
        },
        placementSpec = if (placement && !reduced) ThesisMotion.spatial() else null,
        fadeOutSpec = ThesisMotion.quick(),
    )
}
