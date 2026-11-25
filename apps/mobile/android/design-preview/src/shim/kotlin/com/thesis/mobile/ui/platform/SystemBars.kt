// Preview implementation of app/.../ui/platform/SystemBars.kt (Android: the window's insets controller sets the
// status- and navigation-bar icon appearance). Same public API. A desktop render has no system bars: no-op.
package com.thesis.mobile.ui.platform

import androidx.compose.runtime.Composable

/**
 * Dark system-bar icons when [light]; [statusBarLight] overrides the status bar alone (light icons over a HeroBand).
 * Previews draw no system bars, so this does nothing.
 */
@Composable
@Suppress("UNUSED_PARAMETER")
fun SystemBarAppearance(light: Boolean, statusBarLight: Boolean = light) = Unit
