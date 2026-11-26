package com.thesis.mobile.preview.harness

import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LocalRippleConfiguration
import androidx.compose.material3.RippleConfiguration
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.InkDark
import com.thesis.mobile.ui.theme.PaperLight
import com.thesis.mobile.ui.theme.ThesisMaterialTheme
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.heroOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlinx.coroutines.runBlocking
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * PR-4a (compose-bom 2025.04.00, Material3 1.3): the kit's `RippleTheme` became a `RippleConfiguration`
 * (DESIGN-DIRECTION 4.4, 6.4). The residual M3 ripple (Switch thumb, text fields, sheets) must still read as the
 * one press language: `ink` at the PressTint alpha, 6% on paper and 8% on graphite, inside a HeroBand too.
 */
@OptIn(ExperimentalMaterial3Api::class)
class RippleConfigurationTest {

    @get:Rule
    val rule = createComposeRule()

    private fun configurationUnder(p: ThesisPalette): RippleConfiguration? {
        var seen: RippleConfiguration? = null
        rule.setContent { ThesisMaterialTheme(p) { seen = LocalRippleConfiguration.current } }
        rule.waitForIdle()
        return seen
    }

    private fun assertPressTint(p: ThesisPalette, alpha: Float) {
        val c = assertNotNullConfig(configurationUnder(p))
        assertEquals(p.ink, c.color)
        val a = c.rippleAlpha!!
        assertEquals(alpha, a.pressedAlpha, 0f)
        assertEquals(alpha, a.focusedAlpha, 0f)
        assertEquals(alpha, a.hoveredAlpha, 0f)
        assertEquals(alpha, a.draggedAlpha, 0f)
    }

    private fun assertNotNullConfig(c: RippleConfiguration?): RippleConfiguration {
        assertNotNull("ThesisMaterialTheme must provide a RippleConfiguration (null would remove the ripple)", c)
        return c!!
    }

    @Test
    fun graphiteRippleIsInkAtEightPercent() = assertPressTint(InkDark, ThesisMotion.PressTintAlphaDark)

    @Test
    fun paperRippleIsInkAtSixPercent() = assertPressTint(PaperLight, ThesisMotion.PressTintAlphaLight)

    @Test
    fun heroBandRippleFollowsTheHeroInk() {
        val hero = heroOf(PaperLight)
        assertPressTint(hero, if (hero.isLight) ThesisMotion.PressTintAlphaLight else ThesisMotion.PressTintAlphaDark)
    }

    /**
     * End to end through the M3 1.3 ripple node: the theme's [LocalIndication] (what the M3 Switch and text fields
     * draw), shown a press and given time to grow, paints `ink` over the surface at the PressTint alpha at its
     * centre. The press is emitted on the interaction source directly: a synthetic click on desktop also focuses the
     * node (keyboard input mode), which would add the focus layer on top.
     */
    @Test
    fun pressedM3RippleDrawsTheInkTint() {
        val p = InkDark
        val source = MutableInteractionSource()
        rule.mainClock.autoAdvance = false
        rule.setContent {
            ThesisMaterialTheme(p) {
                Box(Modifier.size(96.dp).background(p.surface).testTag("target").indication(source, LocalIndication.current))
            }
        }
        rule.mainClock.advanceTimeByFrame()
        val bare = rule.onNodeWithTag("target").captureToImage().toPixelMap().let { it[it.width / 2, it.height / 2] }
        val centrePx = with(rule.density) { (96.dp.toPx() / 2) }
        runBlocking { source.emit(PressInteraction.Press(Offset(centrePx, centrePx))) }
        repeat(60) { rule.mainClock.advanceTimeByFrame() } // about 1 s, frame by frame: the ripple is fully grown
        val pixels = rule.onNodeWithTag("target").captureToImage().toPixelMap()
        val centre = pixels[pixels.width / 2, pixels.height / 2]
        val a = ThesisMotion.PressTintAlphaDark
        val expected = Color(
            red = bare.red * (1 - a) + p.ink.red * a,
            green = bare.green * (1 - a) + p.ink.green * a,
            blue = bare.blue * (1 - a) + p.ink.blue * a,
        )
        fun ch(v: Float) = (v * 255).roundToInt()
        val diffs = listOf(
            ch(centre.red) - ch(expected.red), ch(centre.green) - ch(expected.green), ch(centre.blue) - ch(expected.blue),
        )
        assertTrue("pressed centre $centre, expected ink at $a over $bare ($expected), diff $diffs", diffs.all { abs(it) <= 3 })
    }
}
