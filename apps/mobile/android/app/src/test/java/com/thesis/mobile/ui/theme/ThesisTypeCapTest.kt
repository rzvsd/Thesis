package com.thesis.mobile.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.TextUnitType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Section 2.3: display, title, figure and numeral grow with the user's font scale up to 1.3x of their base size
 * and no further, measured in dp. Checked with a linear converter and with a non-linear one shaped like
 * Android 14's (large sizes grow less than small ones), where a ratio formula would shrink the title at 2.0x.
 */
class ThesisTypeCapTest {

    /** Font scaling that is linear ([curve] = null) or follows [curve] (sp size -> dp size at this scale). */
    private class TestDensity(
        override val fontScale: Float,
        private val curve: ((Float) -> Float)? = null,
    ) : Density {
        override val density: Float = 2.625f

        override fun TextUnit.toDp(): Dp {
            check(type == TextUnitType.Sp)
            return (curve?.invoke(value) ?: (value * fontScale)).dp
        }

        override fun Dp.toSp(): TextUnit {
            val f = curve ?: return (value / fontScale).sp
            // Invert the monotonic curve numerically.
            var lo = 0f
            var hi = value
            repeat(60) {
                val mid = (lo + hi) / 2
                if (f(mid) < value) lo = mid else hi = mid
            }
            return ((lo + hi) / 2).sp
        }
    }

    /** Android 14-like: at 2.0x, 8 sp doubles but 40 sp only grows to ~1.4x (approximation of the platform table). */
    private fun nonLinear(scale: Float): (Float) -> Float = { sp ->
        val small = sp * scale
        val large = sp * (1f + (scale - 1f) * 0.4f)
        val t = ((sp - 8f) / (40f - 8f)).coerceIn(0f, 1f)
        small + (large - small) * t
    }

    private val capped = listOf(ThesisType.display, ThesisType.title, ThesisType.figure, ThesisType.numeral)

    private fun renderedDp(style: TextStyle, d: Density): Float =
        with(d) { ThesisType.cappedFor(style, d).fontSize.toDp().value }

    @Test
    fun atOneXTheSizeIsTheBaseSize() {
        val d = TestDensity(1f)
        capped.forEach { s ->
            assertEquals(s.fontSize.value, renderedDp(s, d), 0.01f)
        }
    }

    @Test
    fun atOnePointThreeXTheSizeGrowsToTheCap() {
        val d = TestDensity(1.3f)
        capped.forEach { s ->
            assertEquals(s.fontSize.value * 1.3f, renderedDp(s, d), 0.05f)
        }
    }

    @Test
    fun atTwoXTheSizeIsCappedAtOnePointThree() {
        val d = TestDensity(2f)
        capped.forEach { s ->
            assertEquals(s.fontSize.value * ThesisType.MAX_DISPLAY_SCALE, renderedDp(s, d), 0.05f)
        }
    }

    @Test
    fun nonLinearScalingNeverShrinksBelowTheBaseSize() {
        for (scale in listOf(1f, 1.3f, 1.5f, 2f)) {
            val d = TestDensity(scale, nonLinear(scale))
            capped.forEach { s ->
                val base = s.fontSize.value
                val dp = renderedDp(s, d)
                val uncapped = nonLinear(scale)(base)
                assertTrue("$scale: $dp < base $base", dp >= base - 0.05f)
                assertTrue("$scale: $dp > cap", dp <= base * ThesisType.MAX_DISPLAY_SCALE + 0.05f)
                assertEquals("$scale: follows the platform below the cap", minOf(uncapped, base * 1.3f), dp, 0.05f)
            }
        }
    }

    @Test
    fun lineHeightKeepsItsRatio() {
        val d = TestDensity(2f)
        val s = ThesisType.title
        val c = ThesisType.cappedFor(s, d)
        assertEquals(TextUnitType.Em, c.lineHeight.type)
        assertEquals(s.lineHeight.value / s.fontSize.value, c.lineHeight.value, 0.001f)
    }

    @Test
    fun scaleKeepsTheSpecSizes() {
        assertEquals(40.sp, ThesisType.display.fontSize)
        assertEquals(30.sp, ThesisType.title.fontSize)
        assertEquals(24.sp, ThesisType.headline.fontSize)
        assertEquals(20.sp, ThesisType.subhead.fontSize)
        assertEquals(18.sp, ThesisType.cardTitle.fontSize)
        assertEquals(17.sp, ThesisType.story.fontSize)
        val all = listOf(
            ThesisType.display, ThesisType.title, ThesisType.headline, ThesisType.subhead, ThesisType.heroLine,
            ThesisType.numeral, ThesisType.cardTitle, ThesisType.lede, ThesisType.story, ThesisType.figure,
            ThesisType.kpiValue, ThesisType.body, ThesisType.bodySmall, ThesisType.rowTitle, ThesisType.barTitle,
            ThesisType.label, ThesisType.button, ThesisType.navLabel, ThesisType.statValue, ThesisType.tape,
            ThesisType.tableNum, ThesisType.tableHead, ThesisType.caption, ThesisType.eyebrow, ThesisType.kicker,
            ThesisType.tick,
        )
        all.forEach { assertTrue("${it.fontSize} below the 11 sp minimum", it.fontSize.value >= 11f) }
    }

    @Test
    fun materialTypographyUsesOnlyNewsreaderAndTheSans() {
        val t = ThesisTypography
        val allowed = setOf(ThesisFonts.Newsreader, ThesisFonts.NewsreaderDisplay, ThesisFonts.Sans)
        listOf(
            t.displayLarge, t.displayMedium, t.displaySmall, t.headlineLarge, t.headlineMedium, t.headlineSmall,
            t.titleLarge, t.titleMedium, t.titleSmall, t.bodyLarge, t.bodyMedium, t.bodySmall,
            t.labelLarge, t.labelMedium, t.labelSmall,
        ).forEach { assertTrue("${it.fontFamily}", it.fontFamily in allowed) }
        assertEquals(ThesisType.eyebrow, t.labelSmall)
        assertEquals(ThesisType.display, t.displayLarge)
    }

    @Test
    fun tnumSwitchesSansToTabularAndSerifToDefault() {
        assertEquals("tnum", ThesisType.body.tnum().fontFeatureSettings)
        assertEquals("pnum", ThesisType.figure.fontFeatureSettings)
        assertEquals(null, ThesisType.figure.tnum().fontFeatureSettings)
    }

    @Test
    fun spacingAndShapeTokensMatchTheSpec() {
        assertEquals(listOf(2, 4, 8, 12, 16, 20, 24, 32, 40, 56).map { it.dp }, with(ThesisSpace) {
            listOf(xxs, xs, s, m, l, xl, xxl, x3, x4, x5)
        })
        assertEquals(16.dp, ThesisSpace.gutter)
        assertEquals(listOf(16.dp, 32.dp, 68.dp), listOf(ThesisSpace.edge0, ThesisSpace.edge1, ThesisSpace.edge2))
        assertEquals(14.dp, ThesisShape.CardRadius)
        assertEquals(14.dp, ThesisDimens.CardCornerRadius)
        assertEquals(6.dp, ThesisDimens.SignalBadgeCorner)
    }
}
