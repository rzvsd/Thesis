package com.thesis.mobile.ui.platform

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/*
 * System-bar icon appearance (docs/app-redesign/DESIGN-DIRECTION.md, sections 2.7 and 5.1). The activity draws edge
 * to edge (`enableEdgeToEdge()` in MainActivity): the bars stay transparent and only their icons follow the palette.
 * design-preview compiles its shim (no system bars there) instead: keep the public API identical.
 */

/** The Activity behind [this] context, unwrapping ContextWrappers (Hilt, AppCompat, a themed wrapper); null if none. */
private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * Dark status- and navigation-bar icons when [light] (paper), light icons otherwise (graphite). [statusBarLight]
 * overrides the status bar alone: false over a HeroBand at rest, whose ground is dark in both themes (2.7); the
 * navigation bar keeps the theme's icons. Applied after every successful composition. Does nothing in a layout
 * preview or when the view is not hosted by an Activity (a dialog window's context, a test host), instead of
 * failing on a cast.
 */
@Composable
fun SystemBarAppearance(light: Boolean, statusBarLight: Boolean = light) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = view.context.findActivity()?.window ?: return@SideEffect
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = statusBarLight
            controller.isAppearanceLightNavigationBars = light
        }
    }
}
