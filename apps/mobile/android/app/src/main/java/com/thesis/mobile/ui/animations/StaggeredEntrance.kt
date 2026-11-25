package com.thesis.mobile.ui.animations

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.currentCompositeKeyHash
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.motion.rememberEntranceCoordinator
import com.thesis.mobile.ui.motion.staggeredEntrance

/**
 * Old staggered entrance, kept so existing call sites compile until PR-3 moves them
 * (docs/app-redesign/DESIGN-DIRECTION.md 4.3 rule 2, 6.2 M1).
 *
 * It now delegates to [staggeredEntrance]: the item rises 8 dp and fades in once, on the entry's first open, in the
 * layer phase, and **never replays** (not on scroll-back, tab return, refresh or recreation), because the "seen"
 * memory lives in the navigator's entrance registry for the current entry, keyed by this call site and [index].
 * Timing comes from `ThesisMotion` (`Enter`, `EaseEnter`, 35 ms per step); [baseDelayMs], [staggerMs],
 * [slideDistancePx] and [durationMs] are ignored. Under reduced motion the content appears at once.
 *
 * Pushed screens arrive whole: PR-3 removes this from Deep Dive and moves Home and Pulse to
 * `Modifier.staggeredEntrance(key, rememberEntranceCoordinator(issueId))`.
 */
@Deprecated(
    "Home and Pulse: Modifier.staggeredEntrance(key, rememberEntranceCoordinator(issueId)). Pushed screens: no entrance.",
    ReplaceWith(
        "Box(modifier.staggeredEntrance(index, rememberEntranceCoordinator())) { content() }",
        "androidx.compose.foundation.layout.Box",
        "com.thesis.mobile.ui.motion.staggeredEntrance",
        "com.thesis.mobile.ui.motion.rememberEntranceCoordinator",
    ),
)
@Suppress("UNUSED_PARAMETER")
@Composable
fun StaggeredEntrance(
    index: Int,
    modifier: Modifier = Modifier,
    baseDelayMs: Long = 100L,
    staggerMs: Long = 60L,
    slideDistancePx: Float = 24f,
    durationMs: Int = 350,
    content: @Composable () -> Unit,
) {
    val coordinator = rememberEntranceCoordinator()
    // The composite key hash identifies this call site (and its lazy item) stably across disposal and
    // recomposition, so two screens' "index 0" never share a key.
    val key = LegacyEntranceKey(currentCompositeKeyHash, index)
    Box(modifier.staggeredEntrance(key, coordinator)) { content() }
}

private data class LegacyEntranceKey(val site: Int, val index: Int)
