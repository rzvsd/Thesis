package com.thesis.mobile.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Section 2.2 contrast test: every text token against every surface and against the worst-case glow
 * composites (the gold glow at its peak over `bg`, top right; the blue glow at its peak over `bg2`, bottom
 * left) is at least 4.5:1, `control` at least 3:1, in both themes and both up/down schemes, and the hero
 * pairs inside a HeroBand likewise.
 */
class PaletteContrastTest {

    private fun lin(c: Float): Double = if (c <= 0.04045f) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)

    private fun luminance(c: Color): Double = 0.2126 * lin(c.red) + 0.7152 * lin(c.green) + 0.0722 * lin(c.blue)

    private fun contrast(a: Color, b: Color): Double {
        val la = luminance(a)
        val lb = luminance(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
    }

    /** [top] (with its alpha) composited over opaque [bottom]. */
    private fun over(top: Color, bottom: Color): Color {
        val a = top.alpha
        return Color(
            red = top.red * a + bottom.red * (1 - a),
            green = top.green * a + bottom.green * (1 - a),
            blue = top.blue * a + bottom.blue * (1 - a),
        )
    }

    private fun surfaces(p: ThesisPalette): Map<String, Color> = mapOf(
        "bg" to p.bg,
        "bg2" to p.bg2,
        "surface" to p.surface,
        "surface2" to p.surface2,
        "chip" to p.chip,
        "callout" to p.callout,
        "bg+glowGold" to over(p.glowGold, p.bg),
        "bg2+glowBlue" to over(p.glowBlue, p.bg2),
    )

    private fun textTokens(p: ThesisPalette): Map<String, Color> = mapOf(
        "ink" to p.ink,
        "ink2" to p.ink2,
        "muted" to p.muted,
        "accent" to p.accent,
        "upText" to p.upText,
        "downText" to p.downText,
        "pos" to p.pos,
        "neg" to p.neg,
        "warn" to p.warn,
    )

    private fun palettes(): Map<String, ThesisPalette> = buildMap {
        for ((name, base) in listOf("light" to PaperLight, "dark" to InkDark)) {
            for (scheme in UpDownScheme.entries) put("$name/$scheme", base.withUpDown(scheme))
        }
    }

    private fun failures(
        palette: String,
        texts: Map<String, Color>,
        on: Map<String, Color>,
        minimum: Double,
    ): List<String> = texts.flatMap { (t, tc) ->
        on.mapNotNull { (s, sc) ->
            val r = contrast(tc, sc)
            if (r < minimum) "$palette $t on $s = ${"%.2f".format(r)} (< $minimum)" else null
        }
    }

    @Test
    fun textTokensAreAaOnEverySurfaceAndGlowPeak() {
        val failed = palettes().flatMap { (name, p) -> failures(name, textTokens(p), surfaces(p), 4.5) }
        assertTrue(failed.joinToString("\n"), failed.isEmpty())
    }

    @Test
    fun controlBoundariesAreThreeToOne() {
        val failed = palettes().flatMap { (name, p) -> failures(name, mapOf("control" to p.control), surfaces(p), 3.0) }
        assertTrue(failed.joinToString("\n"), failed.isEmpty())
    }

    @Test
    fun heroPairsAreAaInsideTheBand() {
        val failed = palettes().flatMap { (name, base) ->
            val h = heroOf(base)
            val on = mapOf(
                "heroBg" to h.bg,
                "heroBg2" to h.bg2,
                "heroBg+gold" to over(h.glowGold, h.bg),
                "heroBg2+blue" to over(h.glowBlue, h.bg2),
                "bandSurface" to h.surface,
                "bandCallout" to h.callout,
            )
            val texts = mapOf(
                "heroInk" to h.ink,
                "heroInk2" to h.ink2,
                "heroAccent" to h.accent,
                "heroPos" to h.pos,
                "heroNeg" to h.neg,
                "upText" to h.upText,
                "downText" to h.downText,
                "warn" to h.warn,
            )
            failures("hero/$name", texts, on, 4.5) + failures("hero/$name", mapOf("control" to h.control), on, 3.0)
        }
        assertTrue(failed.joinToString("\n"), failed.isEmpty())
    }

    @Test
    fun selectedAndInverseRolesAreReadable() {
        val failed = palettes().flatMap { (name, p) ->
            val scheme = schemeOf(p)
            listOfNotNull(
                ("onSelected on selectedFill" to contrast(p.onSelected, p.selectedFill)),
                ("inversePrimary on inverseSurface" to contrast(scheme.inversePrimary, scheme.inverseSurface)),
                ("inverseOnSurface on inverseSurface" to contrast(scheme.inverseOnSurface, scheme.inverseSurface)),
                ("onError on error" to contrast(scheme.onError, scheme.error)),
            ).filter { it.second < 4.5 }.map { "$name ${it.first} = ${"%.2f".format(it.second)}" }
        }
        assertTrue(failed.joinToString("\n"), failed.isEmpty())
    }

    @Test
    fun lightGoldTextIsTheBronzeAccent() {
        // Text gold in light mode is #70572F; the bright #B48226 (series[0]) is for marks only.
        assertEquals(Color(0xFF70572F), PaperLight.accent)
        assertEquals(Color(0xFFB48226), PaperLight.series[0])
        assertTrue(contrast(PaperLight.series[0], PaperLight.bg) < 4.5)
    }

    @Test
    fun upDownSchemesResolve() {
        val classic = PaperLight.withUpDown(UpDownScheme.Classic)
        assertEquals(classic.pos, classic.upText)
        assertEquals(classic.neg, classic.downText)
        val cb = InkDark.withUpDown(UpDownScheme.ColourBlind)
        assertEquals(InkDark.series[3], cb.up)
        assertEquals(InkDark.series[4], cb.down)
        assertEquals(Color(0xFF5A95D6), cb.upText)
        assertEquals(Color(0xFFD97757), cb.downText)
    }
}
