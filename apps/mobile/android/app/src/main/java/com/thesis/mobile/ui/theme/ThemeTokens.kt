package com.thesis.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/*
 * Compatibility layer (docs/app-redesign/DESIGN-DIRECTION.md, sections 2.2 and 2.3).
 *
 * ThesisColors keeps every name the screens use, but each property now reads the active ThesisPalette, so
 * the light theme and the hero band recolour existing screens. New code reads LocalThesisPalette directly.
 * ThesisTypography (Material3) is rebuilt from ThesisType: no monospace anywhere.
 */

/** The display serif. Prefer ThesisType.display / title / headline over setting a family by hand. */
val HeadingFont: FontFamily get() = ThesisFonts.NewsreaderDisplay

/** The UI sans (Roboto). Prefer ThesisType.body and friends. */
val BodyFont: FontFamily get() = ThesisFonts.Sans

object ThesisColors {
    val Background: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.bg
    val Surface: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface
    val SurfaceElevated: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface2
    val SurfaceOverlay: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.chip

    val Border: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.line
    val BorderSubtle: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.line

    val Primary: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent
    val PrimaryHover: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent
    val PrimaryMuted: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent.copy(alpha = 0.60f)

    val TextPrimary: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.ink
    val TextSecondary: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.ink2
    val TextMuted: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.muted
    val TextInverse: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.onSelected

    val SignalPositive: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.pos
    val SignalNegative: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.neg
    val SignalNeutral: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.muted
    val SignalWarning: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.warn

    val Error: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.neg
    val OnError: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface

    val Shimmer: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface2
    val ShimmerHighlight: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface2

    // Older aliases, mapped to the nearest token.
    @Deprecated("Use LocalThesisPalette.current.bg")
    val DarkBackground: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.bg

    @Deprecated("Use LocalThesisPalette.current.surface")
    val DarkSurface: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface

    @Deprecated("Use LocalThesisPalette.current.surface2")
    val DarkSurfaceHigh: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface2

    @Deprecated("Use LocalThesisPalette.current.chip")
    val DarkCardAlt: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.chip

    @Deprecated("Use LocalThesisPalette.current.line")
    val DarkBorder: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.line

    @Deprecated("Use LocalThesisPalette.current.ink")
    val TextPrimaryDark: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.ink

    @Deprecated("Use LocalThesisPalette.current.ink2")
    val TextSecondaryDark: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.ink2

    @Deprecated("Use LocalThesisPalette.current.muted")
    val TextTertiaryDark: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.muted

    @Deprecated("Use LocalThesisPalette.current.accent")
    val AccentBlue: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent

    @Deprecated("Use LocalThesisPalette.current.accent")
    val AccentBlueDark: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent

    @Deprecated("Use LocalThesisPalette.current.accent")
    val AccentBlueLight: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.accent

    @Deprecated("Use LocalThesisPalette.current.surface2")
    val ConfidenceRingBg: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface2

    @Deprecated("Use LocalThesisPalette.current.bg")
    val LightBackground: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.bg

    @Deprecated("Use LocalThesisPalette.current.surface")
    val LightSurface: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.surface

    @Deprecated("Use LocalThesisPalette.current.ink")
    val TextPrimaryLight: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.ink

    @Deprecated("Use LocalThesisPalette.current.neg")
    val ErrorDark: Color
        @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.neg
}

/**
 * Pre-v2 dimensions, kept so the existing screens compile. New code uses ThesisSpace and ThesisShape.
 * PR-1 moves the values that have a v2 token onto it (gutter 16, card padding 16, card radius 14, badge 6).
 */
object ThesisDimens {
    val ScreenPaddingHorizontal = ThesisSpace.gutter
    val ScreenPaddingTop = ThesisSpace.l
    val ScreenPaddingBottom = ThesisSpace.xxl

    val CardCornerRadius = ThesisShape.CardRadius
    val CardCornerRadiusMd = ThesisShape.TileRadius
    val CardPadding = ThesisSpace.cardPadding

    val SpacingXs = ThesisSpace.xs
    val SpacingSm = ThesisSpace.s
    val SpacingMd = ThesisSpace.m
    val SpacingLg = ThesisSpace.l
    val SpacingXl = ThesisSpace.xl
    val SpacingXxl = 28.dp
    val SpacingSection = 40.dp

    val SignalBadgeCorner = ThesisShape.BadgeRadius
    val SignalBadgePaddingH = 10.dp
    val SignalBadgePaddingV = ThesisSpace.xs

    val ConfidenceRingSize = 56.dp
    val ConfidenceRingStroke = 3.dp
    val EvidenceDotSize = 6.dp
    val EvidenceDotSpacing = ThesisSpace.xs
    val ShimmerLineHeight = 14.dp

    val BorderWidth = ThesisSpace.border
}

/**
 * Material3 typography, rebuilt from [ThesisType] (section 2.3) so the existing `ThesisTypography.*` reads
 * change in one place. The label styles were monospace before v2; they are sans now.
 */
val ThesisTypography = Typography(
    displayLarge = ThesisType.display,
    displayMedium = ThesisType.title,
    displaySmall = ThesisType.figure,
    headlineLarge = ThesisType.headline,
    headlineMedium = ThesisType.subhead,
    headlineSmall = ThesisType.cardTitle,
    titleLarge = ThesisType.barTitle,
    titleMedium = ThesisType.rowTitle,
    titleSmall = ThesisType.rowTitle.copy(fontSize = 13.sp, lineHeight = 18.sp),
    bodyLarge = ThesisType.body.copy(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = ThesisType.body,
    bodySmall = ThesisType.caption,
    labelLarge = ThesisType.button,
    labelMedium = ThesisType.navLabel.copy(letterSpacing = 0.02.em),
    labelSmall = ThesisType.eyebrow,
)
