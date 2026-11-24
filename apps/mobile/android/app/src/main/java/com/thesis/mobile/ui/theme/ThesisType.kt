package com.thesis.mobile.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * Design system v2 type scale (docs/app-redesign/DESIGN-DIRECTION.md, section 2.3).
 *
 * Day-0 API stub: style names, sizes, weights and tracking follow the spec so that parallel work can
 * compile against them. Nothing reads them yet; ThesisTypography still holds the shipped styles.
 * F1 owns this file: it swaps the serif placeholders for the bundled Newsreader families
 * (ThesisFonts.kt), rebuilds ThesisTypography from these styles and adds ThesisTypeCapTest.
 */

// Placeholders until ThesisFonts.kt (Android-only, R.font) lands; the harness shims those families.
private val SerifDisplay: FontFamily = FontFamily.Serif // F1: NewsreaderDisplay
private val SerifText: FontFamily = FontFamily.Serif // F1: Newsreader
private val Sans: FontFamily = FontFamily.Default // Roboto on Android, as in the Deep Dive WebView

private val CenteredLines = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

private fun style(
    family: FontFamily,
    weight: FontWeight,
    size: TextUnit,
    lineHeight: TextUnit,
    tracking: TextUnit = 0.em,
    italic: Boolean = false,
    features: String? = null,
    heading: Boolean = false,
) = TextStyle(
    fontFamily = family,
    fontWeight = weight,
    fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
    fontSize = size,
    lineHeight = lineHeight,
    letterSpacing = tracking,
    fontFeatureSettings = features,
    lineHeightStyle = CenteredLines,
    lineBreak = if (heading) LineBreak.Heading else LineBreak.Unspecified,
)

/** Tabular figures: anything that changes value or sits in a column. */
fun TextStyle.tnum(): TextStyle = copy(fontFeatureSettings = "tnum")

object ThesisType {
    // Serif: meaning (titles, claims, story text, headline numbers)
    val display = style(SerifDisplay, FontWeight.Normal, 40.sp, 44.sp, (-0.015).em, heading = true)
    val title = style(SerifDisplay, FontWeight.Normal, 30.sp, 32.sp, (-0.018).em, heading = true)
    val headline = style(SerifDisplay, FontWeight.Normal, 24.sp, 28.sp, (-0.012).em, heading = true)
    val subhead = style(SerifText, FontWeight.Normal, 20.sp, 26.sp, (-0.005).em)
    val heroLine = style(SerifDisplay, FontWeight.Normal, 20.sp, 28.sp, italic = true)
    val numeral = style(SerifDisplay, FontWeight.Normal, 40.sp, 40.sp, (-0.02).em, italic = true)
    val cardTitle = style(SerifText, FontWeight.Medium, 18.sp, 23.sp, (-0.005).em, heading = true)
    val lede = style(SerifText, FontWeight.Normal, 18.sp, 27.sp)
    val story = style(SerifText, FontWeight.Normal, 17.sp, 27.5.sp)
    val figure = style(SerifText, FontWeight.Medium, 40.sp, 44.sp, (-0.02).em, features = "pnum")
    val kpiValue = style(SerifText, FontWeight.Medium, 24.sp, 28.sp, (-0.01).em, features = "pnum")

    // Sans: apparatus (labels, navigation, tables, axes, buttons)
    val body = style(Sans, FontWeight.Normal, 15.sp, 23.sp)
    val bodySmall = style(Sans, FontWeight.Normal, 13.5.sp, 20.sp)
    val rowTitle = style(Sans, FontWeight.SemiBold, 15.sp, 20.sp)
    val barTitle = style(Sans, FontWeight.SemiBold, 17.sp, 22.sp)
    val label = style(Sans, FontWeight.Medium, 13.sp, 18.sp, 0.01.em)
    val button = style(Sans, FontWeight.Medium, 14.sp, 20.sp, 0.01.em)
    val navLabel = style(Sans, FontWeight.Medium, 12.sp, 16.sp, 0.01.em)
    val statValue = style(Sans, FontWeight.SemiBold, 18.sp, 22.sp, features = "tnum")
    val tape = style(Sans, FontWeight.Medium, 13.sp, 18.sp, features = "tnum")
    val tableNum = style(Sans, FontWeight.Normal, 12.5.sp, 18.sp, features = "tnum")
    val tableHead = style(Sans, FontWeight.SemiBold, 11.5.sp, 16.sp, features = "tnum")
    val caption = style(Sans, FontWeight.Normal, 12.sp, 17.sp)
    /** Uppercase is applied by the component (Eyebrow), not by callers. */
    val eyebrow = style(Sans, FontWeight.SemiBold, 11.sp, 16.sp, 0.14.em)
    /** Uppercase is applied by the component (Kicker), not by callers. */
    val kicker = style(Sans, FontWeight.Bold, 11.5.sp, 16.sp, 0.18.em)
    val tick = style(Sans, FontWeight.Normal, 11.sp, 14.sp, features = "tnum")

    /** Largest growth allowed for display, title, figure and numeral under the user's font scale. */
    const val MAX_DISPLAY_SCALE = 1.3f

    /**
     * Caps [style]'s size at [MAX_DISPLAY_SCALE] x its base size, measured in dp (not by ratio: Compose 1.6
     * applies Android 14's non-linear font scaling). Use for display, title, figure and numeral only.
     */
    @Composable
    @ReadOnlyComposable
    fun capped(style: TextStyle): TextStyle {
        if (!style.fontSize.isSp) return style
        val base = style.fontSize.value
        val size = with(LocalDensity.current) {
            minOf(style.fontSize.toDp(), (base * MAX_DISPLAY_SCALE).dp).toSp()
        }
        // Keep the line-height ratio by expressing it in em of the capped size.
        val lineHeight = if (style.lineHeight.isSp) (style.lineHeight.value / base).em else style.lineHeight
        return style.copy(fontSize = size, lineHeight = lineHeight)
    }
}
