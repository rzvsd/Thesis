package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisFonts
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.heroOf
import org.junit.Test

/**
 * Kit gallery renders (section 3). Foundation sheets live here today: palette, hero palette, type scale and the
 * bundled fonts. F2 adds one test per kit component (every state, both themes; 1.3x and 2.0x where text is
 * involved) using [renderGallery] from KitGallery.kt.
 *
 * Run: render.sh '^kit-'   (PNGs: kit-<name>-dark.png / kit-<name>-light.png)
 */
class KitGalleryRenders {

    @Test
    fun palette() {
        renderGallery("kit-palette") {
            Section("Palette")
            Specimen("Tokens", "ThesisPalette as provided by ThesisTheme") { Swatches(LocalThesisPalette.current) }
            Specimen("Series", "gold, plum, sage, blue, clay, teal") { SeriesRow(LocalThesisPalette.current.series) }
        }
    }

    @Test
    fun heroPalette() {
        renderGallery("kit-hero-palette") {
            Section("Hero palette")
            Specimen("heroOf(palette)", "HeroBand, Deep Dive cover, closing band") {
                val hero = heroOf(LocalThesisPalette.current)
                CompositionLocalProvider(LocalThesisPalette provides hero) {
                    Column(Modifier.fillMaxWidth().background(hero.bg).padding(12.dp)) { Swatches(hero) }
                }
            }
        }
    }

    @Test
    fun typeScale() {
        renderGallery("kit-type-scale") {
            Section("Type scale")
            typeStyles().forEach { (name, style) ->
                Specimen(name, describe(style)) {
                    Text(sampleFor(name), style = style, color = LocalThesisPalette.current.ink)
                }
            }
        }
    }

    @Test
    fun typeScaleAtTwiceFontSize() {
        renderGallery("kit-type-scale-fs2", fontScale = 2f, themes = listOf(PreviewTheme.LIGHT)) {
            Section("Type scale at 2.0x")
            typeStyles().forEach { (name, style) ->
                Specimen(name) {
                    val capped = if (name in CappedStyles) ThesisType.capped(style) else style
                    Text(sampleFor(name), style = capped, color = LocalThesisPalette.current.ink)
                }
            }
        }
    }

    @Test
    fun bundledFonts() {
        renderGallery("kit-fonts") {
            Section("Bundled fonts")
            val ink = LocalThesisPalette.current.ink
            Specimen("NewsreaderDisplay 400", "newsreader_display.ttf (opsz 72)") {
                Text("Services now carries the margin", color = ink,
                    style = TextStyle(fontFamily = ThesisFonts.NewsreaderDisplay, fontSize = 30.sp))
            }
            Specimen("NewsreaderDisplay 400 italic", "newsreader_display_italic.ttf") {
                Text("01  The morning line", color = ink, style = TextStyle(
                    fontFamily = ThesisFonts.NewsreaderDisplay, fontStyle = FontStyle.Italic, fontSize = 30.sp))
            }
            listOf(
                FontWeight.Normal to "newsreader_text.ttf (opsz 16)",
                FontWeight.Medium to "newsreader_medium.ttf (opsz 36)",
                FontWeight.SemiBold to "newsreader_text_semibold.ttf (opsz 16)",
            ).forEach { (weight, file) ->
                Specimen("Newsreader ${weight.weight}", file) {
                    Text("Revenue grew 6.4% to \$416B in FY2025 − 1,234.56", color = ink,
                        style = TextStyle(fontFamily = ThesisFonts.Newsreader, fontWeight = weight, fontSize = 18.sp))
                }
            }
            Specimen("Sans (system)", "FontFamily.Default = Roboto") {
                Text("Names · Research · Inbox  0123456789", color = ink,
                    style = TextStyle(fontFamily = ThesisFonts.Sans, fontSize = 15.sp))
            }
        }
    }

    @Test
    fun icons() {
        renderGallery("kit-icons") {
            Section("Icons")
            Specimen("ThesisIcons, opsz 24", "24 dp, ink2; filled variants in ink") {
                IconGrid(iconsOf(ThesisIcons), 24)
            }
            Specimen("ThesisIcons.Small, opsz 20", "20 dp in rows, 16 dp in chips") {
                IconGrid(iconsOf(ThesisIcons.Small), 20)
                IconGrid(iconsOf(ThesisIcons.Small), 16, labels = false)
            }
        }
    }

    @Test
    fun iconsMirrorInRtl() {
        renderGallery("kit-icons-rtl", themes = listOf(PreviewTheme.LIGHT)) {
            Specimen("Right to left", "Back, Forward, OpenExternal, Names and Sort mirror; the rest do not") {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    IconGrid(iconsOf(ThesisIcons).filter { it.second.autoMirror }, 24)
                }
            }
        }
    }

    // ---- F2: kit components go below, one @Test per component (section 3 rows 1-52).
}

/** Every ImageVector property of an icon object, in declaration order (lazy delegates resolved by getter). */
internal fun iconsOf(holder: Any): List<Pair<String, ImageVector>> =
    holder::class.java.declaredMethods
        .filter { it.name.startsWith("get") && it.returnType == ImageVector::class.java && it.parameterCount == 0 }
        .sortedBy { m ->
            val delegate = m.name.removePrefix("get") + "\$delegate" // `val X by lazy` backs onto field X$delegate
            holder::class.java.declaredFields.indexOfFirst { it.name == delegate }
        }
        .map { m -> m.name.removePrefix("get") to (m.invoke(holder) as ImageVector) }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IconGrid(icons: List<Pair<String, ImageVector>>, sizeDp: Int, labels: Boolean = true) {
    val p = LocalThesisPalette.current
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        icons.forEach { (name, icon) ->
            Column(
                Modifier.width(if (labels) 84.dp else (sizeDp + 12).dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(icon, contentDescription = name, Modifier.size(sizeDp.dp),
                    tint = if (name.endsWith("Filled")) p.ink else p.ink2)
                if (labels) Text(name, style = ThesisType.caption, color = p.muted, maxLines = 1)
            }
        }
    }
}

/** Styles that ThesisType.capped() limits to 1.3x (section 2.3). */
private val CappedStyles = setOf("display", "title", "figure", "numeral")

/** Every TextStyle on ThesisType, in declaration order (reflection keeps the sheet in sync with F1's scale). */
internal fun typeStyles(): List<Pair<String, TextStyle>> =
    ThesisType::class.java.declaredFields
        .filter { it.type == TextStyle::class.java }
        .map { field -> field.isAccessible = true; field.name to field.get(ThesisType) as TextStyle }

private fun sampleFor(name: String): String = when (name) {
    "display" -> "AAPL Deep Dive"
    "title", "headline" -> "2 of your names need a review"
    "numeral" -> "01"
    "figure" -> "\$416B"
    "kpiValue", "statValue" -> "28.4×"
    "eyebrow", "kicker" -> "THE UPSHOT"
    "tape" -> "S&P 500 5,948.71 +0.4%"
    "tableNum", "tick" -> "1,234.56  −35 bps"
    else -> "Margins held while services grew"
}

private fun describe(style: TextStyle): String {
    val family = when (style.fontFamily) {
        ThesisFonts.NewsreaderDisplay -> "NewsreaderDisplay"
        ThesisFonts.Newsreader -> "Newsreader"
        null -> "inherit"
        else -> style.fontFamily.toString().substringAfterLast('.').substringBefore('@')
    }
    val italic = if (style.fontStyle == FontStyle.Italic) " italic" else ""
    val features = style.fontFeatureSettings?.let { " · $it" } ?: ""
    return "$family ${style.fontWeight?.weight ?: 400}$italic · ${style.fontSize.value} / " +
        "${style.lineHeight.value} · ${style.letterSpacing}$features"
}

/** Every Color token of [p] (Java field order = declaration order), as a name / hex / chip grid. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Swatches(p: ThesisPalette) {
    val tokens = ThesisPalette::class.java.declaredFields
        .filter { it.type == java.lang.Long.TYPE } // Color is an inline class over a Long
        .map { field -> field.isAccessible = true; field.name to Color(field.getLong(p).toULong()) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tokens.forEach { (name, color) -> Swatch(name, color, p) }
    }
}

@Composable
private fun Swatch(name: String, color: Color, p: ThesisPalette) {
    Row(Modifier.width(182.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(28.dp).background(color, RoundedCornerShape(6.dp))
                .border(1.dp, p.line2, RoundedCornerShape(6.dp)),
        )
        Column(Modifier.padding(start = 8.dp)) {
            Text(name, style = ThesisType.label, color = p.ink)
            Text(hex(color), style = ThesisType.caption, color = p.muted)
        }
    }
}

@Composable
private fun SeriesRow(series: List<Color>) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        series.forEachIndexed { i, c ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(48.dp, 24.dp).background(c, RoundedCornerShape(4.dp)))
                Text("$i", style = ThesisType.caption, color = LocalThesisPalette.current.muted)
            }
        }
    }
}

private fun hex(c: Color): String {
    val argb = c.toArgb()
    val alpha = (argb ushr 24) and 0xFF
    val rgb = "#%06X".format(argb and 0xFFFFFF)
    return if (alpha == 0xFF) rgb else "$rgb @ ${(alpha * 100 + 127) / 255}%"
}
