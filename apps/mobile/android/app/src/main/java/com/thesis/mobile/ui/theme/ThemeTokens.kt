package com.thesis.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val HeadingFont: FontFamily = FontFamily.Serif
val BodyFont: FontFamily = FontFamily.Default
val MonoFont: FontFamily = FontFamily.Monospace

object ThesisColors {
    val Background = Color(0xFF0A0A0A)
    val Surface = Color(0xFF121212)
    val SurfaceElevated = Color(0xFF1A1A1A)
    val SurfaceOverlay = Color(0xFF1E1E1E)

    val Border = Color(0xFF262626)
    val BorderSubtle = Color(0xFF1F1F1F)

    val Primary = Color(0xFFC5A059)
    val PrimaryHover = Color(0xFFD4AF37)
    val PrimaryMuted = Color(0xFFC5A059).copy(alpha = 0.15f)

    val TextPrimary = Color(0xFFF5F5F5)
    val TextSecondary = Color(0xFFAAAAAA)
    val TextMuted = Color(0xFF888888)
    val TextInverse = Color(0xFF0A0A0A)

    val SignalPositive = Color(0xFF4ADE80)
    val SignalNegative = Color(0xFFF87171)
    val SignalNeutral = Color(0xFF9CA3AF)
    val SignalWarning = Color(0xFFFBBF24)

    val Error = Color(0xFFF87171)
    val OnError = Color.White

    val Shimmer = Color(0xFF1A1A1A)
    val ShimmerHighlight = Color(0xFF2A2A2A)

    // Compatibility aliases for the existing UI surfaces we have not ported yet.
    val DarkBackground = Background
    val DarkSurface = Surface
    val DarkSurfaceHigh = SurfaceElevated
    val DarkCardAlt = SurfaceOverlay
    val DarkBorder = Border
    val TextPrimaryDark = TextPrimary
    val TextSecondaryDark = TextSecondary
    val TextTertiaryDark = TextMuted
    val AccentBlue = Primary
    val AccentBlueDark = PrimaryHover
    val AccentBlueLight = Primary
    val ConfidenceRingBg = Color(0xFF1A1A1A)
    val LightBackground = Color(0xFFF5F5F5)
    val LightSurface = Color(0xFFFFFFFF)
    val TextPrimaryLight = Color(0xFF111827)
    val ErrorDark = Error
}

object ThesisDimens {
    val ScreenPaddingHorizontal = 20.dp
    val ScreenPaddingTop = 16.dp
    val ScreenPaddingBottom = 24.dp

    val CardCornerRadius = 4.dp
    val CardCornerRadiusMd = 8.dp
    val CardPadding = 20.dp

    val SpacingXs = 4.dp
    val SpacingSm = 8.dp
    val SpacingMd = 12.dp
    val SpacingLg = 16.dp
    val SpacingXl = 20.dp
    val SpacingXxl = 28.dp
    val SpacingSection = 40.dp

    val SignalBadgeCorner = 2.dp
    val SignalBadgePaddingH = 10.dp
    val SignalBadgePaddingV = 4.dp

    val ConfidenceRingSize = 56.dp
    val ConfidenceRingStroke = 3.dp
    val EvidenceDotSize = 6.dp
    val EvidenceDotSpacing = 4.dp
    val ShimmerLineHeight = 14.dp

    val BorderWidth = 1.dp
}

val ThesisTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = HeadingFont,
        fontWeight = FontWeight.Normal,
        fontSize = 40.sp,
        lineHeight = 44.sp,
        letterSpacing = (-0.5).sp
    ),
    displayMedium = TextStyle(
        fontFamily = HeadingFont,
        fontWeight = FontWeight.Normal,
        fontSize = 30.sp,
        lineHeight = 36.sp,
        letterSpacing = (-0.3).sp
    ),
    headlineLarge = TextStyle(
        fontFamily = HeadingFont,
        fontWeight = FontWeight.Normal,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.2).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = BodyFont,
        fontWeight = FontWeight.Medium,
        fontSize = 18.sp,
        lineHeight = 24.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = BodyFont,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 26.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = BodyFont,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 22.sp
    ),
    bodySmall = TextStyle(
        fontFamily = BodyFont,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 18.sp
    ),
    labelLarge = TextStyle(
        fontFamily = BodyFont,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelMedium = TextStyle(
        fontFamily = MonoFont,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = MonoFont,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 1.sp
    )
)
