package com.thesis.mobile.ui.animations

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.currentCompositeKeyHash
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.motion.rememberEntranceCoordinator
import com.thesis.mobile.ui.motion.staggeredEntrance

/**
 * Old "materialize" reveal (scale .85 + fade), kept so HomeScreen compiles until WP-A deletes it in PR-3
 * (docs/app-redesign/DESIGN-DIRECTION.md 3, "Composables deleted"). Scale from .85 broke 4.3 rule 8 and it
 * replayed on every tab return; it now runs the kit entrance once per entry (8 dp rise + fade, layer phase,
 * never replayed) and ignores [delayMs], [durationMs] and [initialScale].
 */
@Deprecated("Hero figures are final on first paint (4.6); use no reveal, or Modifier.staggeredEntrance on Home/Pulse.")
@Suppress("UNUSED_PARAMETER")
@Composable
fun RevealAnimation(
    modifier: Modifier = Modifier,
    delayMs: Long = 0L,
    durationMs: Int = 400,
    initialScale: Float = 0.85f,
    content: @Composable () -> Unit,
) {
    val coordinator = rememberEntranceCoordinator()
    Box(modifier.staggeredEntrance(RevealKey(currentCompositeKeyHash), coordinator)) { content() }
}

/**
 * Old gold "flash on reveal" slot. A colour wash is trading-app vocabulary (4.2, `Flash` removed), so the
 * progress is now always complete (1f): content draws its resting state. No callers today.
 */
@Deprecated("No flash on reveal (4.2): draw the resting state.")
@Suppress("UNUSED_PARAMETER")
@Composable
fun ShimmerReveal(
    modifier: Modifier = Modifier,
    delayMs: Long = 300L,
    content: @Composable (shimmerProgress: Float) -> Unit,
) {
    Box(modifier = modifier) { content(1f) }
}

private data class RevealKey(val site: Int)
