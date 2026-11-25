// Desktop stand-ins for androidx.compose.ui.platform.LocalView and LocalContext (Android-only APIs).
// The compiled screens read LocalContext (DeepDiveScreen, DeepDiveWebReportState) and hand it to the export and
// WebView shims; nothing calls an Android service on it. The system-bar calls that needed an Activity live in
// ui/platform/SystemBars.kt, whose preview shim does nothing.
package androidx.compose.ui.platform

import androidx.compose.runtime.staticCompositionLocalOf

class PreviewView {
    /** Always true: we are rendering a preview, not running inside an Activity. */
    val isInEditMode: Boolean = true
    val context: Any = Any()
}

val LocalView = staticCompositionLocalOf { PreviewView() }

val LocalContext = staticCompositionLocalOf { android.content.Context() }
