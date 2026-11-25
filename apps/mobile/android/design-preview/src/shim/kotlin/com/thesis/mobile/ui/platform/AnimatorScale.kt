// Preview implementation of app/.../ui/platform/AnimatorScale.kt (Android: Settings.Global
// ANIMATOR_DURATION_SCALE observed with a ContentObserver, playbook 3.2). Same public API; see F4 HANDOFF.
// Not @ReadOnlyComposable: the Android version remembers an observer.
// The preview has no system setting: the scale is 0 when -Dpreview.reducedMotion=true, else 1.
package com.thesis.mobile.ui.platform

import androidx.compose.runtime.Composable

/** The system animator duration scale (developer options / "Remove animations"); 0 means animations are off. */
@Composable
fun rememberAnimatorDurationScale(): Float = if (PreviewMotion.reducedMotion) 0f else 1f

/**
 * True when the system asks for no animation (animator duration scale 0). ThesisTheme ORs this with the in-app
 * "Reduce motion" setting to provide LocalReducedMotion (section 4.8).
 */
@Composable
fun rememberSystemReducedMotion(): Boolean = rememberAnimatorDurationScale() == 0f

/** Preview switch behind the shim. Not part of the Android API. */
object PreviewMotion {
    val reducedMotion: Boolean get() = System.getProperty("preview.reducedMotion") == "true"
}
