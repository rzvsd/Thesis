package com.thesis.mobile.preview

import com.thesis.mobile.ui.platform.BackSwipeEdge
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.platform.ThesisBackEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * A predictive back gesture held at any progress, for tests and frames of the seekable back (PR-4b). The harness
 * shim's `PreviewBack.press()` only runs a whole 0 → .5 → 1 gesture that commits; this drives the innermost
 * enabled predictive handler step by step: [start], any number of [progress] values, then [commit] (the flow
 * completes) or [cancel] (the handler's collect is cancelled, as on a device).
 *
 * Every call runs the handler inline (unconfined) on the calling thread: call it from the UI thread (runOnIdle).
 * It reads the shim's registry by reflection; see HANDOFF-M for a public hook.
 */
internal class BackGestureDriver(private val edge: BackSwipeEdge = BackSwipeEdge.Left) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
    private val events = Channel<Float>(Channel.UNLIMITED)
    private var job: Job? = null

    fun start() {
        val handler = checkNotNull(innermostPredictiveHandler()) { "no predictive back handler is enabled" }
        job = scope.launch { handler(events.consumeAsFlow().map { ThesisBackEvent(it, edge) }) }
    }

    fun progress(value: Float) {
        events.trySend(value)
    }

    fun commit() {
        events.close()
    }

    fun cancel() {
        job?.cancel()
        scope.cancel()
    }

    private companion object {
        @Suppress("UNCHECKED_CAST")
        fun innermostPredictiveHandler(): (suspend (kotlinx.coroutines.flow.Flow<ThesisBackEvent>) -> Unit)? {
            val field = PreviewBack::class.java.getDeclaredField("entries").apply { isAccessible = true }
            val entries = field.get(PreviewBack) as List<PreviewBack.Entry>
            val top = synchronized(entries) { entries.lastOrNull { it.enabled } } ?: return null
            return top.onPredictive
        }
    }
}
