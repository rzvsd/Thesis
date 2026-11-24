package com.thesis.mobile.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/*
 * Design system v2 colour tokens (docs/app-redesign/DESIGN-DIRECTION.md, section 2.2).
 *
 * Day-0 API stub: the type, the two instances, heroOf() and LocalThesisPalette exist so that
 * parallel work can compile against them. Nothing reads them yet; ThesisColors still holds the
 * shipped values. F1 owns this file and finishes it (PaletteContrastTest, ThesisColors bridge).
 */

/** How market direction is coloured (You > Appearance). Default [Classic]. */
enum class UpDownScheme { Classic, ColourBlind }

@Immutable
data class ThesisPalette(
    val isLight: Boolean,
    // Surfaces
    val bg: Color,
    val bg2: Color,
    val surface: Color,
    val surface2: Color,
    val chip: Color,
    val callout: Color,
    // Text
    val ink: Color,
    val ink2: Color,
    val muted: Color,
    // Lines and controls
    val line: Color,
    val line2: Color,
    val control: Color,
    // Gold and focus
    val accent: Color,
    val highlight: Color,
    val glowGold: Color,
    val glowBlue: Color,
    val focus: Color,
    val selectedFill: Color,
    val onSelected: Color,
    // Status (thesis state, errors). Market direction uses up/down instead.
    val pos: Color,
    val neg: Color,
    val warn: Color,
    // Market direction, resolved from [upDown] by withUpDown() in ThesisTheme (marks and text).
    val upDown: UpDownScheme,
    val up: Color,
    val down: Color,
    val upText: Color,
    val downText: Color,
    // Charts: series in fixed order gold, plum, sage, blue, clay, teal.
    val series: List<Color>,
    val deemph: Color,
    val grid: Color,
    val axis: Color,
    // Overlays
    val scrim: Color,
    val cardShadow: Boolean,
    // Hero band (HeroBand, Deep Dive cover, closing band); see heroOf().
    val heroBg: Color,
    val heroBg2: Color,
    val heroInk: Color,
    val heroInk2: Color,
    val heroAccent: Color,
    val heroLine: Color,
    val heroChip: Color,
    val heroPos: Color,
    val heroNeg: Color,
    val bandSurface: Color,
    val bandCallout: Color,
)

private val PaperSeries = listOf(
    Color(0xFFB48226), Color(0xFF82498B), Color(0xFF6B8D38),
    Color(0xFF256BB1), Color(0xFFBE5737), Color(0xFF008E7F),
)

private val InkSeries = listOf(
    Color(0xFFBA882E), Color(0xFFA166AA), Color(0xFF779A45),
    Color(0xFF4C89CC), Color(0xFFCB6443), Color(0xFF1AA291),
)

/** Light theme: warm paper. */
val PaperLight = ThesisPalette(
    isLight = true,
    bg = Color(0xFFF5F1E8),
    bg2 = Color(0xFFEEE7D8),
    surface = Color(0xFFFFFDF8),
    surface2 = Color(0xFFF8F4EB),
    chip = Color(0xFFEFE9DD),
    callout = Color(0xFFF3EADB),
    ink = Color(0xFF1A2128),
    ink2 = Color(0xFF47525E),
    muted = Color(0xFF545E69),
    line = Color(0xFFE6DFD1),
    line2 = Color(0xFFD3C9B6),
    // F1: PaletteContrastTest sets the final value (needs >= 3:1 on chip/bg2; start from #857D6E).
    control = Color(0xFF8F8778),
    accent = Color(0xFF70572F),
    highlight = Color(0xFFB48226).copy(alpha = 0.20f),
    glowGold = Color(0xFFB48226).copy(alpha = 0.16f),
    glowBlue = Color(0xFF256BB1).copy(alpha = 0.10f),
    focus = Color(0xFF256BB1),
    selectedFill = Color(0xFF1A2128),
    onSelected = Color(0xFFFFFDF8),
    pos = Color(0xFF2F6A4F),
    neg = Color(0xFF9B4A4A),
    warn = Color(0xFF8C5E12),
    upDown = UpDownScheme.Classic,
    up = Color(0xFF2F6A4F),
    down = Color(0xFF9B4A4A),
    upText = Color(0xFF2F6A4F),
    downText = Color(0xFF9B4A4A),
    series = PaperSeries,
    deemph = Color(0xFFB9B1A4),
    grid = Color(0xFFEEE8DC),
    axis = Color(0xFFCDC3B1),
    scrim = Color(0xFF1A2128).copy(alpha = 0.40f),
    cardShadow = true,
    heroBg = Color(0xFF121A22),
    heroBg2 = Color(0xFF22303D),
    heroInk = Color(0xFFF6F2EA),
    heroInk2 = Color(0xFFB7BFC8),
    heroAccent = Color(0xFFD7B985),
    heroLine = Color(0xFFF6F2EA).copy(alpha = 0.16f),
    heroChip = Color(0xFFF6F2EA).copy(alpha = 0.08f),
    heroPos = Color(0xFF7FD3A2),
    heroNeg = Color(0xFFF2A0A0),
    bandSurface = Color(0xFF1B232A),
    bandCallout = Color(0xFF262B2E),
)

/** Dark theme: graphite. */
val InkDark = ThesisPalette(
    isLight = false,
    bg = Color(0xFF0A0A0A),
    bg2 = Color(0xFF121212),
    surface = Color(0xFF161616),
    surface2 = Color(0xFF1C1C1C),
    chip = Color(0xFF1F1F1F),
    callout = Color(0xFF1C1913),
    ink = Color(0xFFF2F2F0),
    ink2 = Color(0xFFBDBDB8),
    muted = Color(0xFF8E8E89),
    line = Color(0xFF262626),
    line2 = Color(0xFF363636),
    control = Color(0xFF6B6B66),
    accent = Color(0xFFC5A059),
    highlight = Color(0xFFC5A059).copy(alpha = 0.22f),
    glowGold = Color(0xFFC5A059).copy(alpha = 0.16f),
    glowBlue = Color(0xFF4C89CC).copy(alpha = 0.14f),
    focus = Color(0xFFC5A059),
    selectedFill = Color(0xFFF2F2F0),
    onSelected = Color(0xFF0A0A0A),
    pos = Color(0xFF7FD3A2),
    neg = Color(0xFFF2A0A0),
    warn = Color(0xFFD9A441),
    upDown = UpDownScheme.Classic,
    up = Color(0xFF7FD3A2),
    down = Color(0xFFF2A0A0),
    upText = Color(0xFF7FD3A2),
    downText = Color(0xFFF2A0A0),
    series = InkSeries,
    deemph = Color(0xFF5B5B58),
    grid = Color(0xFF222222),
    axis = Color(0xFF3A3A3A),
    scrim = Color(0xFF000000).copy(alpha = 0.60f),
    cardShadow = false,
    heroBg = Color(0xFF121212),
    heroBg2 = Color(0xFF1A1A1A),
    heroInk = Color(0xFFF2F2F0),
    heroInk2 = Color(0xFFA9A9A4),
    heroAccent = Color(0xFFC5A059),
    heroLine = Color(0xFFFFFFFF).copy(alpha = 0.10f),
    heroChip = Color(0xFFFFFFFF).copy(alpha = 0.06f),
    heroPos = Color(0xFF7FD3A2),
    heroNeg = Color(0xFFF2A0A0),
    bandSurface = Color(0xFF1B1B1B),
    bandCallout = Color(0xFF24211B),
)

/**
 * Resolves [ThesisPalette.up]/[ThesisPalette.down] (marks) and [ThesisPalette.upText]/[ThesisPalette.downText]
 * for [scheme]. Classic: pos/neg. ColourBlind: blue/clay (series[3]/series[4] for marks; AA text values).
 */
fun ThesisPalette.withUpDown(scheme: UpDownScheme): ThesisPalette = when (scheme) {
    UpDownScheme.Classic -> copy(upDown = scheme, up = pos, down = neg, upText = pos, downText = neg)
    UpDownScheme.ColourBlind -> copy(
        upDown = scheme,
        up = series[3],
        down = series[4],
        upText = if (isLight) Color(0xFF256BB1) else Color(0xFF5A95D6),
        downText = if (isLight) Color(0xFFA84B2E) else Color(0xFFD97757),
    )
}

/**
 * The hero palette, used inside a HeroBand, the Deep Dive cover and the closing band (section 2.2).
 * The band is dark in both themes, so its text tokens are the hero ones.
 */
fun heroOf(p: ThesisPalette): ThesisPalette = p.copy(
    isLight = false,
    bg = p.heroBg,
    bg2 = p.heroBg2,
    surface = p.bandSurface,
    callout = p.bandCallout,
    ink = p.heroInk,
    ink2 = p.heroInk2,
    muted = p.heroInk2,
    line = p.heroLine,
    chip = p.heroChip,
    accent = p.heroAccent,
    pos = p.heroPos,
    neg = p.heroNeg,
    glowGold = p.heroAccent.copy(alpha = 0.24f),
    glowBlue = p.series[3].copy(alpha = 0.22f),
    cardShadow = false,
).withUpDown(p.upDown)

/** The active palette. Static: it changes only when the theme changes, which recomposes everything anyway. */
val LocalThesisPalette = staticCompositionLocalOf { InkDark }
