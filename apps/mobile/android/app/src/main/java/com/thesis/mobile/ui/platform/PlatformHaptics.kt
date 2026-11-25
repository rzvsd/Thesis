package com.thesis.mobile.ui.platform

import android.os.Build
import android.os.SystemClock
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalView

/*
 * Android haptics (docs/app-redesign/DESIGN-DIRECTION.md, section 4.7; playbook 3.3). Only
 * View.performHapticFeedback: it honours the system touch-feedback setting and needs no VIBRATE permission.
 * Never Vibrator / one-shot effects. ui/motion/Haptics.kt (ThesisHaptics) names the moments and calls this.
 * design-preview compiles its shim (PreviewHaptics records calls) instead: keep the public API identical.
 */

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
fun rememberPlatformHaptics(): PlatformHaptics {
    val view = LocalView.current
    return remember(view) { ViewHaptics(view) }
}

/** Scrub ticks closer than this are dropped, so a fast drag never buzzes. */
private const val TICK_INTERVAL_MS = 28L

private class ViewHaptics(private val view: View) : PlatformHaptics {
    private var lastTickAt = 0L

    override fun perform(kind: HapticKind) {
        if (kind == HapticKind.Tick) {
            val now = SystemClock.uptimeMillis()
            if (now - lastTickAt < TICK_INTERVAL_MS) return
            lastTickAt = now
        }
        view.performHapticFeedback(constantFor(kind))
    }
}

/** Platform constant per kind, with the section 4.7 fallbacks below API 30 / 34. */
private fun constantFor(kind: HapticKind): Int {
    val r = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
    val u = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    return when (kind) {
        HapticKind.Press -> HapticFeedbackConstants.VIRTUAL_KEY
        HapticKind.Confirm -> if (r) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
        HapticKind.Reject -> if (r) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        HapticKind.ToggleOn -> if (u) HapticFeedbackConstants.TOGGLE_ON else HapticFeedbackConstants.CONTEXT_CLICK
        HapticKind.ToggleOff -> if (u) HapticFeedbackConstants.TOGGLE_OFF else HapticFeedbackConstants.CONTEXT_CLICK
        HapticKind.Segment -> if (u) HapticFeedbackConstants.SEGMENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        HapticKind.Tick ->
            if (u) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        HapticKind.Threshold ->
            if (u) HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE else HapticFeedbackConstants.CONTEXT_CLICK
        HapticKind.GestureStart -> if (r) HapticFeedbackConstants.GESTURE_START else HapticFeedbackConstants.CLOCK_TICK
        HapticKind.GestureEnd -> if (r) HapticFeedbackConstants.GESTURE_END else HapticFeedbackConstants.CLOCK_TICK
        HapticKind.LongPress -> HapticFeedbackConstants.LONG_PRESS
    }
}
