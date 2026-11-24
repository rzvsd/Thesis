// Preview implementation of app/.../ui/platform/PlatformHaptics.kt (Android: View.performHapticFeedback with
// SDK-guarded HapticFeedbackConstants, section 4.7). Same public API; see HANDOFF-F4.md.
// Renders have no vibrator: calls are recorded in PreviewHaptics.log so tests can assert the 4.7 map.
package com.thesis.mobile.ui.platform

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable

/** The haptic vocabulary of section 4.7. ui/motion/Haptics.kt (ThesisHaptics) maps its calls onto these. */
enum class HapticKind {
    Press, Confirm, Reject, ToggleOn, ToggleOff, Segment, Tick, Threshold, GestureStart, GestureEnd, LongPress,
}

/** Performs one haptic. Implementations honour the system touch-feedback setting and throttle [HapticKind.Tick]. */
@Stable
fun interface PlatformHaptics {
    fun perform(kind: HapticKind)
}

/** The platform haptics for the current view. */
@Composable
fun rememberPlatformHaptics(): PlatformHaptics = PreviewHaptics

/** Test hook: every haptic performed in previews and semantics tests, in order. Not part of the Android API. */
object PreviewHaptics : PlatformHaptics {
    private val events = mutableListOf<HapticKind>()

    val log: List<HapticKind> get() = synchronized(events) { events.toList() }

    fun clear() = synchronized(events) { events.clear() }

    override fun perform(kind: HapticKind) {
        synchronized(events) { events += kind }
    }
}
