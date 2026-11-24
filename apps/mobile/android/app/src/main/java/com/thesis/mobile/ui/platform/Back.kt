package com.thesis.mobile.ui.platform

import androidx.activity.BackEventCompat
import androidx.activity.compose.BackHandler
import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/*
 * Back handling for every ui/ file (docs/app-redesign/DESIGN-DIRECTION.md, section 4 preamble and 4.5).
 * Android-only: wraps activity-compose 1.9.1's BackHandler / PredictiveBackHandler and maps BackEventCompat to
 * ThesisBackEvent, so code outside ui/platform never imports androidx.activity. design-preview compiles
 * design-preview/src/shim/kotlin/com/thesis/mobile/ui/platform/Back.kt instead: keep the public API identical.
 */

/** Which screen edge the back swipe started from (BackEventCompat.EDGE_LEFT / EDGE_RIGHT). */
enum class BackSwipeEdge { Left, Right }

/** One predictive-back progress event: [progress] 0..1 plus the touch position in px. */
@Immutable
data class ThesisBackEvent(
    val progress: Float,
    val swipeEdge: BackSwipeEdge,
    val touchX: Float = 0f,
    val touchY: Float = 0f,
)

/** Calls [onBack] on system back while [enabled]. Enable it only while it has work to do. */
@Composable
fun ThesisBackHandler(enabled: Boolean = true, onBack: () -> Unit) {
    BackHandler(enabled = enabled, onBack = onBack)
}

/**
 * Predictive back: [onBack] collects the gesture's progress; it returns normally when back commits and is
 * cancelled (CancellationException from collect) when the user cancels the gesture. Enable it only while it has
 * work to do, so the system back-to-home animation still runs at the root.
 */
@Composable
fun ThesisPredictiveBackHandler(
    enabled: Boolean = true,
    onBack: suspend (progress: Flow<ThesisBackEvent>) -> Unit,
) {
    PredictiveBackHandler(enabled = enabled) { events: Flow<BackEventCompat> ->
        onBack(events.map { it.toThesisBackEvent() })
    }
}

private fun BackEventCompat.toThesisBackEvent(): ThesisBackEvent = ThesisBackEvent(
    progress = progress,
    swipeEdge = if (swipeEdge == BackEventCompat.EDGE_RIGHT) BackSwipeEdge.Right else BackSwipeEdge.Left,
    touchX = touchX,
    touchY = touchY,
)
