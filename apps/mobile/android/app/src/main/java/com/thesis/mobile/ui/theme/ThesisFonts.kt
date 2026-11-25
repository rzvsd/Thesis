package com.thesis.mobile.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import com.thesis.mobile.R

/**
 * The bundled type families (docs/app-redesign/DESIGN-DIRECTION.md, section 2.3).
 *
 * Android-only (R.font): design-preview excludes this file and loads the same res/font TTFs in its shim, so
 * keep this file to these three declarations. Newsreader is OFL 1.1 (assets/licenses/OFL-Newsreader.txt);
 * the five static instances bake in their optical size because Android does not apply opsz on its own.
 */
object ThesisFonts {
    /** Text cut: story, lede, upshot (400, opsz 16), lead phrases (600, opsz 16), card titles and KPIs (500, opsz 36). */
    val Newsreader: FontFamily = FontFamily(
        Font(R.font.newsreader_text, FontWeight.Normal),
        Font(R.font.newsreader_text_semibold, FontWeight.SemiBold),
        Font(R.font.newsreader_medium, FontWeight.Medium),
    )

    /** Display cut (opsz 72): display, title, headline; italic for chapter numerals and hero lines. */
    val NewsreaderDisplay: FontFamily = FontFamily(
        Font(R.font.newsreader_display, FontWeight.Normal),
        Font(R.font.newsreader_display_italic, FontWeight.Normal, FontStyle.Italic),
    )

    /** Roboto, the same sans the Deep Dive page shows inside the Android WebView. */
    val Sans: FontFamily = FontFamily.Default
}
