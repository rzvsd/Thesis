// Preview implementation of app/.../ui/platform/RenderFlags.kt (Android: every flag is on). Same public API;
// see HANDOFF-F4.md. The harness turns the page glows off for bulk state renders (-Dpreview.glow=false,
// section 2.7): Skia's software raster costs about 0.4 s per glow frame.
package com.thesis.mobile.ui.platform

object RenderFlags {
    /** False only in design-preview bulk renders; pageBackground then paints the gradient without the glows. */
    val pageGlow: Boolean get() = System.getProperty("preview.glow") != "false"
}
