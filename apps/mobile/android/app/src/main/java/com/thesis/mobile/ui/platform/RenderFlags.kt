package com.thesis.mobile.ui.platform

/**
 * Render switches that only design-preview turns off (its shim reads -Dpreview.glow). On Android every flag is on.
 * Keeps preview switches out of kit code (docs/app-redesign/DESIGN-DIRECTION.md, section 2.7).
 */
object RenderFlags {
    /** False only in design-preview bulk renders; pageBackground then paints the gradient without the glows. */
    val pageGlow: Boolean get() = true
}
