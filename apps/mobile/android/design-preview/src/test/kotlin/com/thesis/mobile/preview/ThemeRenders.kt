package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisMaterialTheme
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.color
import com.thesis.mobile.ui.theme.heroOf
import com.thesis.mobile.ui.theme.macroStressLabel
import com.thesis.mobile.ui.theme.macroStressTone
import com.thesis.mobile.ui.theme.tnum
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F1 token renders: palette swatches, the type scale (with the bundled Newsreader cuts), the hero palette,
 * the Material3 bridge (no stock purple anywhere) and the display-size cap at 2.0x font scale.
 * Specimen layout uses literal dp on purpose: it is a test sheet, not a screen.
 */
class ThemeRenders {

    @Test
    fun tokens() {
        renderScreen("f1-tokens", heightDp = 1500) { TokenSheet() }.forEach { assertTrue(it.length() > 0) }
    }

    @Test
    fun typeScale() {
        renderScreen("f1-type", heightDp = 1700) { TypeSheet() }.forEach { assertTrue(it.length() > 0) }
    }

    @Test
    fun typeScaleAtTwoX() {
        renderScreen("f1-type-2x", heightDp = 1500) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, fontScale = 2f)) { TypeSheet(cappedOnly = true) }
        }.forEach { assertTrue(it.length() > 0) }
    }

    @Test
    fun hero() {
        renderScreen("f1-hero", heightDp = 640) {
            val p = LocalThesisPalette.current
            ThesisMaterialTheme(heroOf(p)) { HeroSpecimen() }
        }.forEach { assertTrue(it.length() > 0) }
    }

    @Test
    fun materialBridge() {
        renderScreen("f1-m3", heightDp = 1000) { MaterialSheet() }.forEach { assertTrue(it.length() > 0) }
    }
}

@Composable
private fun Sheet(content: @Composable () -> Unit) {
    val p = LocalThesisPalette.current
    Box(
        Modifier.fillMaxSize().background(Brush.linearGradient(listOf(p.bg, p.bg2)))
            .padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.xxl)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) { content() }
    }
}

@Composable
private fun Kicker(text: String) {
    Text(text.uppercase(), style = ThesisType.kicker, color = LocalThesisPalette.current.accent)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Swatches(title: String, items: List<Pair<String, Color>>) {
    val p = LocalThesisPalette.current
    Kicker(title)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { (name, c) ->
            Column(Modifier.width(88.dp)) {
                Box(Modifier.fillMaxWidth().height(36.dp).background(c, ThesisShape.badge).border(1.dp, p.line, ThesisShape.badge))
                Text(name, style = ThesisType.caption, color = p.ink2)
            }
        }
    }
}

private fun swatchesOf(p: ThesisPalette) = listOf(
    "bg" to p.bg, "bg2" to p.bg2, "surface" to p.surface, "surface2" to p.surface2, "chip" to p.chip,
    "callout" to p.callout, "line" to p.line, "line2" to p.line2, "control" to p.control,
)

@Composable
private fun TokenSheet() {
    val p = LocalThesisPalette.current
    Sheet {
        Text("Tokens", style = ThesisType.title, color = p.ink)
        Swatches("Surfaces and lines", swatchesOf(p))
        Swatches(
            "Text",
            listOf("ink" to p.ink, "ink2" to p.ink2, "muted" to p.muted, "accent" to p.accent, "upText" to p.upText,
                "downText" to p.downText, "warn" to p.warn, "focus" to p.focus, "selectedFill" to p.selectedFill),
        )
        Swatches("Series (marks only)", p.series.mapIndexed { i, c -> "series[$i]" to c } +
            listOf("deemph" to p.deemph, "grid" to p.grid, "axis" to p.axis))
        Kicker("Text on surfaces")
        listOf(p.bg to "bg", p.surface to "surface", p.surface2 to "surface2", p.chip to "chip", p.callout to "callout")
            .forEach { (bg, name) ->
                Row(
                    Modifier.fillMaxWidth().background(bg, ThesisShape.panel).border(1.dp, p.line, ThesisShape.panel)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(name, style = ThesisType.rowTitle, color = p.ink)
                    Text("Secondary", style = ThesisType.bodySmall, color = p.ink2)
                    Text("Muted", style = ThesisType.caption, color = p.muted)
                    Text("GOLD", style = ThesisType.eyebrow, color = p.accent)
                    Text(Fmt.signedPct(6.4), style = ThesisType.body.tnum(), color = Tone.Favourable.color())
                    Text(Fmt.signedPct(-2.2), style = ThesisType.body.tnum(), color = Tone.Unfavourable.color())
                }
            }
        Kicker("Shapes")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf(ThesisShape.card, ThesisShape.panel, ThesisShape.stat, ThesisShape.tile, ThesisShape.badge, ThesisShape.pill)
                .forEach { s -> Box(Modifier.size(52.dp).background(p.surface, s).border(1.dp, p.line2, s)) }
        }
        Kicker("Macro stress words")
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            listOf(22.0, 58.0, 81.0).forEach { s ->
                Text("${Fmt.score(s)} ${macroStressLabel(s)}", style = ThesisType.statValue, color = macroStressTone(s).color())
            }
        }
    }
}

@Composable
private fun TypeSheet(cappedOnly: Boolean = false) {
    val p = LocalThesisPalette.current
    val serif = listOf(
        "display" to ThesisType.display, "title" to ThesisType.title, "headline" to ThesisType.headline,
        "subhead" to ThesisType.subhead, "heroLine" to ThesisType.heroLine, "numeral" to ThesisType.numeral,
        "cardTitle" to ThesisType.cardTitle, "lede" to ThesisType.lede, "story" to ThesisType.story,
        "figure" to ThesisType.figure, "kpiValue" to ThesisType.kpiValue,
    )
    val sans = listOf(
        "body" to ThesisType.body, "bodySmall" to ThesisType.bodySmall, "rowTitle" to ThesisType.rowTitle,
        "barTitle" to ThesisType.barTitle, "label" to ThesisType.label, "button" to ThesisType.button,
        "navLabel" to ThesisType.navLabel, "statValue" to ThesisType.statValue, "tape" to ThesisType.tape,
        "tableNum" to ThesisType.tableNum, "tableHead" to ThesisType.tableHead, "caption" to ThesisType.caption,
        "eyebrow" to ThesisType.eyebrow, "kicker" to ThesisType.kicker, "tick" to ThesisType.tick,
    )
    val sample = mapOf(
        "display" to "Apple", "title" to "Services now carries the margin", "headline" to "2 of your names need a review",
        "subhead" to "Nothing here yet", "heroLine" to "A quiet quarter that changed the story", "numeral" to "01 06",
        "cardTitle" to "Margins widened for a third year", "figure" to Fmt.money(416.2e9), "kpiValue" to Fmt.money(98.76e9),
        "statValue" to "${Fmt.pct(46.2)}  ${Fmt.multiple(28.43)}", "tape" to "S&P 500 5,948.71 +0.4%",
        "tableNum" to "1,204.50  ${Fmt.MINUS}35 bps", "eyebrow" to "CHART 3", "kicker" to "SUMMARY",
    )
    Sheet {
        val capped = setOf("display", "title", "figure", "numeral")
        serif.filter { !cappedOnly || it.first in capped }.forEach { (name, style) ->
            Specimen(name, style, sample[name] ?: "Ștefan reads the 10-K: revenue grew 6.4%, ţinta e clară", p)
        }
        if (!cappedOnly) {
            Text(
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, color = p.ink)) {
                        append("The lead clause is set in 600. ")
                    }
                    append("The rest of the verdict continues in 400 and ink2, as on the Deep Dive page.")
                },
                style = ThesisType.lede, color = p.ink2,
            )
            HorizontalDivider(color = p.line)
            sans.forEach { (name, style) -> Specimen(name, style, sample[name] ?: "Names, Inbox and You 0123456789", p) }
        }
    }
}

@Composable
private fun Specimen(name: String, style: TextStyle, text: String, p: ThesisPalette) {
    Column {
        Text(
            "$name · ${style.fontSize.value.toString().removeSuffix(".0")} sp",
            style = ThesisType.caption, color = p.muted,
        )
        val upper = name == "eyebrow" || name == "kicker"
        val capped = name in setOf("display", "title", "figure", "numeral")
        Text(
            if (upper) text.uppercase() else text,
            style = if (capped) ThesisType.capped(style) else style,
            color = if (name == "numeral" || name == "kicker") p.accent else p.ink,
        )
    }
}

@Composable
private fun HeroSpecimen() {
    val p = LocalThesisPalette.current
    Box(
        Modifier.fillMaxSize().background(Brush.linearGradient(listOf(p.bg, p.bg2)))
            .padding(horizontal = ThesisSpace.gutter, vertical = 40.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(28.dp).height(1.dp).background(p.accent))
                Spacer(Modifier.width(ThesisSpace.s))
                Text("DEEP DIVE · 10-K FY2025", style = ThesisType.eyebrow, color = p.accent)
            }
            Text("Apple", style = ThesisType.display, color = p.ink)
            Text("Services now carries the margin while hardware stays flat", style = ThesisType.heroLine, color = p.ink)
            Row(horizontalArrangement = Arrangement.spacedBy(1.dp), modifier = Modifier.background(p.line, ThesisShape.panel)) {
                listOf("Revenue, FY2025" to Fmt.money(416.2e9), "Operating margin" to Fmt.pct(31.97)).forEach { (l, v) ->
                    Column(Modifier.background(p.bg, ThesisShape.badge).padding(horizontal = 14.dp, vertical = 12.dp)) {
                        Text(l, style = ThesisType.caption, color = p.ink2)
                        Text(v, style = ThesisType.kpiValue, color = p.ink)
                        Text("${Fmt.signedPct(6.4)} vs FY2024", style = ThesisType.caption, color = Tone.Favourable.color())
                    }
                }
            }
            Button(onClick = {}) { Text("Open report", style = ThesisType.button) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(checked = true, onCheckedChange = {})
                Spacer(Modifier.width(ThesisSpace.m))
                Text("Inside the band M3 reads the hero scheme", style = ThesisType.bodySmall, color = p.ink2)
            }
        }
    }
}

@Composable
private fun MaterialSheet() {
    val p = LocalThesisPalette.current
    Sheet {
        Text("Material3 bridge", style = ThesisType.title, color = p.ink)
        Text("Stock components on the v2 scheme: no purple, warm surfaces.", style = ThesisType.body, color = p.ink2)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {}) { Text("Button") }
            OutlinedButton(onClick = {}) { Text("Outlined") }
            TextButton(onClick = {}) { Text("Text") }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Switch(checked = true, onCheckedChange = {})
            Switch(checked = false, onCheckedChange = {})
            Checkbox(checked = true, onCheckedChange = {})
            Checkbox(checked = false, onCheckedChange = {})
            RadioButton(selected = true, onClick = {})
        }
        OutlinedTextField(value = "AAPL", onValueChange = {}, label = { Text("Ticker") }, modifier = Modifier.fillMaxWidth())
        Snackbar(action = { TextButton(onClick = {}) { Text("Undo", color = MaterialTheme.colorScheme.inversePrimary) } }) {
            Text("Removed MSFT from your names")
        }
        Box(Modifier.fillMaxWidth().height(320.dp)) {
            AlertDialog(
                onDismissRequest = {},
                confirmButton = { TextButton(onClick = {}) { Text("Remove") } },
                dismissButton = { TextButton(onClick = {}) { Text("Cancel") } },
                title = { Text("Remove MSFT?") },
                text = { Text("Your notes stay in Notes. You can follow it again at any time.") },
            )
        }
    }
}
