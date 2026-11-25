package com.thesis.mobile.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Surface, glow and elevation tokens (docs/app-redesign/DESIGN-DIRECTION.md, section 2.7; geometry from the
 * renderer, deep-dive-visual-language.md 5.1, 5.2 and 10.3). The kit's `pageBackground`, `HeroBand`,
 * bars and card shadow read these; colours come from [ThesisPalette] (glowGold, glowBlue, hero tokens).
 *
 * Glows are static: no drift, no breathing, no grain. Gold sits top right, blue bottom left.
 */
object ThesisSurface {
    /** Page base gradient angle (CSS degrees): `bg` at the top to `bg2` at the bottom, slightly right. */
    const val PAGE_ANGLE_DEG = 165f

    /** Page glow: an ellipse centred on a corner, fading from the glow colour to transparent at [stop]. */
    data class Glow(
        /** Horizontal radius as a fraction of the box width (capped by [maxRadiusX] when set). */
        val radiusXFraction: Float,
        /** Absolute cap on the horizontal radius, or [Dp.Unspecified]. */
        val maxRadiusX: Dp,
        /** Vertical radius in dp, or [Dp.Unspecified] when [radiusYFraction] applies. */
        val radiusY: Dp,
        /** Vertical radius as a fraction of the box height (hero glows). */
        val radiusYFraction: Float,
        /** Gradient stop where the glow reaches 0 alpha. */
        val stop: Float,
    )

    /** Page: gold ellipse at the top right, rx = min(0.70 w, 900 dp), ry = 560 dp, gone at 70%. */
    val PageGold = Glow(radiusXFraction = 0.70f, maxRadiusX = 900.dp, radiusY = 560.dp, radiusYFraction = 0f, stop = 0.70f)

    /** Page: blue ellipse at the bottom left, rx = min(0.60 w, 760 dp), ry = 480 dp, gone at 70%. */
    val PageBlue = Glow(radiusXFraction = 0.60f, maxRadiusX = 760.dp, radiusY = 480.dp, radiusYFraction = 0f, stop = 0.70f)

    /** HeroBand: gold (heroAccent @ 24%) at the top right, 0.70 w x 1.20 h, gone at 60%. */
    val HeroGold = Glow(radiusXFraction = 0.70f, maxRadiusX = Dp.Unspecified, radiusY = Dp.Unspecified, radiusYFraction = 1.20f, stop = 0.60f)

    /** HeroBand: blue (series[3] @ 22%) at the bottom left, 0.60 w x 0.90 h, gone at 65%. */
    val HeroBlue = Glow(radiusXFraction = 0.60f, maxRadiusX = Dp.Unspecified, radiusY = Dp.Unspecified, radiusYFraction = 0.90f, stop = 0.65f)

    /** HeroBand bottom hairline: heroAccent between 30% and 70% of the width, fading out at both ends. */
    const val HERO_HAIRLINE_FROM = 0.30f
    const val HERO_HAIRLINE_TO = 0.70f
    const val HERO_HAIRLINE_ALPHA = 0.55f

    /** HeroBand eyebrow mark: a heroAccent rule before the text (`.hero .eyebrow::before`). */
    val heroEyebrowRuleWidth: Dp = 28.dp
    val heroEyebrowRuleGap: Dp = ThesisSpace.s

    /** Bars (collapsed top bar, sticky ChapterPills, bottom bar, RunBar, DayHeader) draw the page bitmap at this alpha. */
    const val BAR_ALPHA = 0.92f
    /** Bottom dock and floating pills: `surface` at this alpha. */
    const val DOCK_ALPHA = 0.94f
    /** DockPanel: `surface` at this alpha. */
    const val DOCK_PANEL_ALPHA = 0.98f
    /** Long-read chapter divider: `line2` at this alpha. */
    const val CHAPTER_DIVIDER_ALPHA = 0.60f

    /**
     * Light-theme card shadow (Deep Dive `0 10px 28px -20px`): a soft shadow under the bottom edge only, drawn
     * on a rect inset [cardShadowInsetX] horizontally. Only when `ThesisPalette.cardShadow` is true; never in dark.
     */
    val cardShadowBlur: Dp = 28.dp
    val cardShadowOffsetY: Dp = 10.dp
    val cardShadowInsetX: Dp = 20.dp
    /** Shadow colour = `ink` at this alpha. */
    const val CARD_SHADOW_ALPHA = 0.35f
}
