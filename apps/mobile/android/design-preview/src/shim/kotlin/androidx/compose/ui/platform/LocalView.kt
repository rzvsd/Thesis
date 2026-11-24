// Desktop stand-in for androidx.compose.ui.platform.LocalView (Android-only API).
package androidx.compose.ui.platform

import androidx.compose.runtime.staticCompositionLocalOf

class PreviewView {
    /** Always true: we are rendering a preview, not running inside an Activity. */
    val isInEditMode: Boolean = true
    val context: Any = Any()
}

val LocalView = staticCompositionLocalOf { PreviewView() }

val LocalContext = staticCompositionLocalOf { android.content.Context() }
