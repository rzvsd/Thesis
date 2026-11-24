package androidx.core.view

import android.app.Window
import androidx.compose.ui.platform.PreviewView

class WindowInsetsControllerCompat {
    var isAppearanceLightStatusBars: Boolean = false
    var isAppearanceLightNavigationBars: Boolean = false
}

object WindowCompat {
    fun getInsetsController(window: Window, view: PreviewView): WindowInsetsControllerCompat =
        WindowInsetsControllerCompat()
}
