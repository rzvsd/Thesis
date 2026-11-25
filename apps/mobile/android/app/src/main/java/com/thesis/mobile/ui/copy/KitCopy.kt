package com.thesis.mobile.ui.copy

/**
 * Default strings of the component kit (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #25, #26 and #31).
 * Screens pass their own subject or sentence; these are the kit's fallbacks. Typographic apostrophes (U+2019).
 */
object KitCopy {
    /** The retry label on every error state and banner (#26). */
    const val TRY_AGAIN = "Try again"

    /** The empty state's fallback sentence when a screen gives none (#25). */
    const val NOTHING_HERE = "Nothing here yet."

    /** The error title (#26): "Couldn’t load your names"; "Couldn’t load this" without a [subject]. */
    fun couldNotLoad(subject: String? = null): String =
        "Couldn’t load ${subject?.takeIf { it.isNotBlank() } ?: "this"}"
}
