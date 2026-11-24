// Preview implementation of app/.../ui/platform/Back.kt (Android: BackHandler / PredictiveBackHandler from
// activity-compose 1.9.1, BackEventCompat mapped to ThesisBackEvent). Same public API; see HANDOFF-F4.md.
//
// There is no system back in a render, so nothing fires on its own. Tests can simulate one with
// PreviewBack.press() (the innermost enabled handler wins, as with OnBackPressedDispatcher).
package com.thesis.mobile.ui.platform

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

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
    val current = rememberUpdatedState(onBack)
    val entry = remember { PreviewBack.Entry() }
    SideEffect {
        entry.enabled = enabled
        entry.onPress = { current.value() }
    }
    DisposableEffect(entry) {
        PreviewBack.register(entry)
        onDispose { PreviewBack.unregister(entry) }
    }
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
    val current = rememberUpdatedState(onBack)
    val entry = remember { PreviewBack.Entry() }
    SideEffect {
        entry.enabled = enabled
        entry.onPredictive = current.value
    }
    DisposableEffect(entry) {
        PreviewBack.register(entry)
        onDispose { PreviewBack.unregister(entry) }
    }
}

/** Test hook for the preview back dispatcher. Not part of the Android API. */
object PreviewBack {
    class Entry {
        @Volatile var enabled: Boolean = true
        @Volatile var onPress: (() -> Unit)? = null
        @Volatile var onPredictive: (suspend (Flow<ThesisBackEvent>) -> Unit)? = null
    }

    private val entries = mutableListOf<Entry>()

    internal fun register(entry: Entry) = synchronized(entries) { entries += entry }
    internal fun unregister(entry: Entry) = synchronized(entries) { entries -= entry }

    /** Number of handlers that would receive back right now. */
    val enabledCount: Int get() = synchronized(entries) { entries.count { it.enabled } }

    /**
     * Simulates a committed back press: runs the most recently registered enabled handler and returns true,
     * or returns false when nothing handles it (on a device the activity would finish). A predictive handler
     * receives a short 0 -> 1 progress flow and completes.
     */
    suspend fun press(edge: BackSwipeEdge = BackSwipeEdge.Left): Boolean {
        val target = synchronized(entries) { entries.lastOrNull { it.enabled } } ?: return false
        target.onPress?.invoke()
        target.onPredictive?.invoke(flowOf(0f, 0.5f, 1f).toEvents(edge))
        return true
    }

    private fun Flow<Float>.toEvents(edge: BackSwipeEdge): Flow<ThesisBackEvent> =
        kotlinx.coroutines.flow.flow { collect { emit(ThesisBackEvent(it, edge)) } }
}
