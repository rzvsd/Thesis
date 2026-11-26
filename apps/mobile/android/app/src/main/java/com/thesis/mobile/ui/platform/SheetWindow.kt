package com.thesis.mobile.ui.platform

import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.NonSkippableComposable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat

/*
 * System-bar icons while a ThesisSheet is open (docs/app-redesign/DESIGN-DIRECTION.md 2.7, 3 #20). Since M3 1.3
 * (compose-bom 2025.04.00, PR-4a) ModalBottomSheet runs in its own edge-to-edge dialog window, which owns the bar
 * icons while it is shown, and M3 picks them from the system dark setting, not from the app's ThemeMode. This keeps
 * them on the app palette, as SystemBarAppearance does for the activity window.
 * design-preview compiles its shim (no windows there) instead: keep the public API identical.
 */

/**
 * Wraps one ModalBottomSheet call ([sheet]) so the sheet window's bar icons follow the app: dark navigation-bar icons
 * when [light], and dark status-bar icons when [statusBarLight] (false over a HeroBand at rest, 2.7).
 *
 * Two layers, so it holds whichever way M3 sets the icons:
 * - Around the sheet, [LocalConfiguration] carries the night bit of the app palette instead of the system's, so
 *   M3's own `isSystemInDarkTheme()` read (when it creates the dialog) agrees with the app theme.
 * - [sheet] receives `inSheet`, which must wrap the sheet's content: it restores the real configuration for the
 *   content and sets the sheet window's icons through its insets controller (the content's view sits in a
 *   [DialogWindowProvider]) after every composition of the sheet's content, not only when [light] or
 *   [statusBarLight] change (the setter is non-skippable), so it runs after M3's own setup and wins again if M3
 *   re-applies its icons when the sheet recomposes. That also covers the HeroBand case.
 * When the sheet's window cannot be found (not a dialog, a layout preview) nothing is set; a debuggable build logs
 * that once (tag `SheetWindowBars`), since the HeroBand rule then silently falls back to M3's icons.
 */
@Composable
fun SheetWindowBars(
    light: Boolean,
    statusBarLight: Boolean,
    sheet: @Composable (inSheet: @Composable (@Composable () -> Unit) -> Unit) -> Unit,
) {
    val base = LocalConfiguration.current
    val night = if (light) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES
    val sheetConfiguration = remember(base, night) {
        if (base.uiMode and Configuration.UI_MODE_NIGHT_MASK == night) {
            base
        } else {
            Configuration(base).apply { uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or night }
        }
    }
    CompositionLocalProvider(LocalConfiguration provides sheetConfiguration) {
        sheet { content ->
            CompositionLocalProvider(LocalConfiguration provides base) {
                SheetWindowBarIcons(light = light, statusBarLight = statusBarLight)
                content()
            }
        }
    }
}

/**
 * Sets the icons of the dialog window that hosts this composition, if it is one. Non-skippable: its SideEffect runs
 * every time the sheet's content recomposes, even when [light] and [statusBarLight] are unchanged.
 */
@Composable
@NonSkippableComposable
private fun SheetWindowBarIcons(light: Boolean, statusBarLight: Boolean) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.parent as? DialogWindowProvider)?.window
            if (window == null) {
                val debuggable = (view.context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
                if (debuggable && !loggedMissingWindow) {
                    loggedMissingWindow = true
                    Log.w(
                        "SheetWindowBars",
                        "Sheet content's view parent is not a DialogWindowProvider; sheet bar icons left to Material3.",
                    )
                }
                return@SideEffect
            }
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.isAppearanceLightStatusBars = statusBarLight
            controller.isAppearanceLightNavigationBars = light
        }
    }
}

/** Main thread only (SideEffect). Logged once per process. */
private var loggedMissingWindow = false
