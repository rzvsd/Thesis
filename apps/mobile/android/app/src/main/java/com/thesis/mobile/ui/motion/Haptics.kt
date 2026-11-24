package com.thesis.mobile.ui.motion

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PlatformHaptics
import com.thesis.mobile.ui.platform.rememberPlatformHaptics

/**
 * The app's haptic vocabulary (docs/app-redesign/DESIGN-DIRECTION.md, section 4.7). Haptics mark commits,
 * thresholds and scrub boundaries only: never card taps, tab changes, back, scrolling or filter chips.
 * The Android calls (View.performHapticFeedback with SDK guards and the 28 ms tick throttle) live in
 * `ui/platform/PlatformHaptics.kt`; this class only names the moments. They respect the system setting and are
 * not turned off by reduce motion.
 */
@Stable
class ThesisHaptics(private val platform: PlatformHaptics) {
    /** Commit CTA: Build report, Run scenario, Subscribe, Follow (add ticker). */
    fun press() = platform.perform(HapticKind.Press)

    /** Commit succeeded: note saved, export done, Deep Dive ready. */
    fun confirm() = platform.perform(HapticKind.Confirm)

    /** Validation error, failed save/run, destructive confirm. */
    fun reject() = platform.perform(HapticKind.Reject)

    /** Follow/unfollow, notification toggle, reduce-motion toggle. */
    fun toggle(on: Boolean) = platform.perform(if (on) HapticKind.ToggleOn else HapticKind.ToggleOff)

    /** SegmentedControl / ChapterPills tap; scrub crossing a regime line. */
    fun segment() = platform.perform(HapticKind.Segment)

    /** Scrub crossing a week boundary (throttled by the platform). */
    fun tick() = platform.perform(HapticKind.Tick)

    /** Pull-to-refresh armed; alert swipe past its threshold. */
    fun threshold() = platform.perform(HapticKind.Threshold)

    /** Scrub start. */
    fun gestureStart() = platform.perform(HapticKind.GestureStart)

    /** Scrub end. */
    fun gestureEnd() = platform.perform(HapticKind.GestureEnd)

    /** Row long-press (opens the context sheet). */
    fun longPress() = platform.perform(HapticKind.LongPress)
}

/** The haptics for the current view. */
@Composable
fun rememberHaptics(): ThesisHaptics {
    val platform = rememberPlatformHaptics()
    return remember(platform) { ThesisHaptics(platform) }
}
