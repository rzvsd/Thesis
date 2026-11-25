package com.thesis.mobile.ui.theme

import com.thesis.mobile.model.MarketTapeFamily
import org.junit.Assert.assertEquals
import org.junit.Test

class SemanticTest {

    @Test
    fun indicesAndCommoditiesFollowTheSign() {
        assertEquals(Tone.Favourable, marketTone("core_index", 0.4))
        assertEquals(Tone.Unfavourable, marketTone("core_index", -0.4))
        assertEquals(Tone.Favourable, marketTone("commodity", 1.0))
        assertEquals(Tone.Unfavourable, marketTone("sector", -1.0))
        assertEquals(Tone.Neutral, marketTone("core_index", 0.0))
        assertEquals(Tone.Favourable, marketTone("S&P 500", 0.4))
        assertEquals(Tone.Unfavourable, marketTone("Brent crude", -2.0))
    }

    @Test
    fun volatilityYieldsDollarAndSpreadsAreAlwaysNeutral() {
        for (change in listOf(-3.0, 3.0)) {
            for (key in listOf("volatility", "rates", "currency", "credit", "VIX", "US 10Y", "2Y yield", "DXY", "HY spread")) {
                assertEquals("$key $change", Tone.Neutral, marketTone(key, change))
            }
        }
        assertEquals(Tone.Neutral, marketTone("something new", 2.0))
        assertEquals(Tone.Unknown, marketTone("core_index", Double.NaN))
    }

    @Test
    fun macroStressRegimesAndDirection() {
        assertEquals(Tone.Favourable, macroStressTone(35.0))
        assertEquals(Tone.Neutral, macroStressTone(35.6))
        assertEquals(Tone.Neutral, macroStressTone(69.0))
        assertEquals(Tone.Unfavourable, macroStressTone(70.0))
        assertEquals("Contained", macroStressLabel(12.0))
        assertEquals("Balanced", macroStressLabel(58.0))
        assertEquals("Elevated", macroStressLabel(88.0))
        // rising stress is bad news (MS1)
        assertEquals(Tone.Unfavourable, macroStressDeltaTone(6.0))
        assertEquals(Tone.Favourable, macroStressDeltaTone(-6.0))
        assertEquals(Tone.Neutral, macroStressDeltaTone(0.4))
    }

    @Test
    fun thesisStatesMapToTones() {
        assertEquals(Tone.Favourable, thesisStateTone("intact"))
        assertEquals(Tone.Attention, thesisStateTone("WATCH"))
        assertEquals(Tone.Attention, thesisStateTone("drifting"))
        assertEquals(Tone.Unfavourable, thesisStateTone("At Risk"))
        assertEquals(Tone.Unfavourable, thesisStateTone("at_risk"))
        assertEquals(Tone.Unfavourable, thesisStateTone("broken"))
        assertEquals(Tone.Unknown, thesisStateTone("DATA_INCOMPLETE"))
        assertEquals(Tone.Unknown, thesisStateTone(null))
    }

    @Test
    fun toneColoursComeFromThePalette() {
        val p = PaperLight.withUpDown(UpDownScheme.ColourBlind)
        assertEquals(p.upText, Tone.Favourable.textColor(p))
        assertEquals(p.downText, Tone.Unfavourable.textColor(p))
        assertEquals(p.ink2, Tone.Neutral.textColor(p))
        assertEquals(p.warn, Tone.Attention.textColor(p))
        assertEquals(p.muted, Tone.Unknown.textColor(p))
        assertEquals(p.series[3], Tone.Favourable.markColor(p))
    }

    @Test
    fun alertCategoriesHaveFixedColours() {
        val p = InkDark
        assertEquals(p.series[1], alertCategoryColor("thesis_drift", p))
        assertEquals(p.series[3], alertCategoryColor("Earnings", p))
        assertEquals(p.series[4], alertCategoryColor("macro", p))
        assertEquals(p.series[0], alertCategoryColor("PULSE", p))
        assertEquals(p.muted, alertCategoryColor("system", p))
        assertEquals(p.muted, alertCategoryColor(null, p))
    }

    @Test
    fun parsedTapeFamiliesDecideTheTone() {
        MarketTapeFamily.entries.forEach { family ->
            val expectedUp = if (family.directionNeutral) Tone.Neutral else Tone.Favourable
            val expectedDown = if (family.directionNeutral) Tone.Neutral else Tone.Unfavourable
            assertEquals("$family up", expectedUp, marketTone(family, 1.2))
            assertEquals("$family down", expectedDown, marketTone(family, -1.2))
        }
    }
}
