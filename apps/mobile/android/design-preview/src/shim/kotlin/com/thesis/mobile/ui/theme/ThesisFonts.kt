// Preview stand-in for app/.../ui/theme/ThesisFonts.kt, which builds the families from R.font (Android-only).
// Same public API (docs/app-redesign/DESIGN-DIRECTION.md 2.1 and 2.3): object ThesisFonts with
// NewsreaderDisplay, Newsreader and Sans. The TTFs are read from res/font (system property preview.fontDir,
// set by build.gradle.kts). Missing files fall back to the system serif, so renders work before F1's fonts land.
package com.thesis.mobile.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font
import java.io.File

object ThesisFonts {
    /** Newsreader opsz 72: display, title, headline, numerals, hero line (400 roman and italic). */
    val NewsreaderDisplay: FontFamily = PreviewFontLoader.family(PreviewFontLoader.DisplayFaces)

    /** Newsreader opsz 16/36: story, lede, upshot (400, 600) and card titles, KPI values (500). */
    val Newsreader: FontFamily = PreviewFontLoader.family(PreviewFontLoader.TextFaces)

    /** The system sans (Roboto on Android, as in the Deep Dive WebView). */
    val Sans: FontFamily = FontFamily.Default
}

/** One bundled face: the res/font file name and the weight/style it is registered under. */
data class PreviewFontFace(val file: String, val weight: FontWeight, val style: FontStyle = FontStyle.Normal)

/** Loads res/font TTFs for the preview. Pure functions of a folder, so tests can point it anywhere. */
object PreviewFontLoader {
    /** Must match the R.font registration in the Android ThesisFonts.kt (table in section 2.3). */
    val DisplayFaces = listOf(
        PreviewFontFace("newsreader_display.ttf", FontWeight.Normal),
        PreviewFontFace("newsreader_display_italic.ttf", FontWeight.Normal, FontStyle.Italic),
    )
    val TextFaces = listOf(
        PreviewFontFace("newsreader_text.ttf", FontWeight.Normal),
        PreviewFontFace("newsreader_text_semibold.ttf", FontWeight.SemiBold),
        PreviewFontFace("newsreader_medium.ttf", FontWeight.Medium),
    )

    /** The folder named by -Dpreview.fontDir, or null when unset or missing. */
    val fontDir: File?
        get() = System.getProperty("preview.fontDir")?.let(::File)?.takeIf { it.isDirectory }

    /** The faces of [faces] whose files exist in [dir], as Compose Desktop fonts. */
    fun fonts(faces: List<PreviewFontFace>, dir: File?): List<Font> =
        if (dir == null) emptyList()
        else faces.mapNotNull { face ->
            File(dir, face.file).takeIf { it.isFile }?.let { Font(file = it, weight = face.weight, style = face.style) }
        }

    /** A family of the faces found in [dir]; [FontFamily.Serif] when none is there yet. */
    fun family(faces: List<PreviewFontFace>, dir: File? = fontDir): FontFamily {
        val found = fonts(faces, dir)
        if (found.size < faces.size) {
            val missing = faces.map { it.file }.filter { dir == null || !File(dir, it).isFile }
            System.err.println("[preview fonts] ${dir ?: "(no preview.fontDir)"}: missing $missing" +
                if (found.isEmpty()) ", using the system serif" else "")
        }
        return if (found.isEmpty()) FontFamily.Serif else FontFamily(found)
    }
}
