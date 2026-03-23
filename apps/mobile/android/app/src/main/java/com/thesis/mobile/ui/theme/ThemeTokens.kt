package com.thesis.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object ThesisColors {
    val AccentBlue = Color(0xFF4F8CFF)
    val AccentBlueDark = Color(0xFF2E68D9)
    val AccentBlueLight = Color(0xFF88B2FF)

    val DarkBackground = Color(0xFF0A0E1A)
    val DarkSurface = Color(0xFF141A2E)
    val DarkSurfaceHigh = Color(0xFF1B2238)
    val DarkCardAlt = Color(0xFF12182A)
    val DarkBorder = Color(0xFF2A344E)

    val LightBackground = Color(0xFFF5F7FB)
    val LightSurface = Color(0xFFFFFFFF)

    val SignalPositive = Color(0xFF00D68F)
    val SignalNegative = Color(0xFFFF5C5C)
    val SignalNeutral = Color(0xFF9CA3AF)
    val SignalWarning = Color(0xFFFFC857)

    val Error = Color(0xFFB42318)
    val ErrorDark = Color(0xFFFF6B6B)
    val OnError = Color.White

    val TextPrimaryDark = Color(0xFFE8ECF4)
    val TextSecondaryDark = Color(0xFFB6BECE)
    val TextTertiaryDark = Color(0xFF8B95A8)
    val TextPrimaryLight = Color(0xFF111827)
    val TextPrimary = TextPrimaryDark
    val TextMuted = TextTertiaryDark

    val ConfidenceRingBg = Color(0xFF24304B)
    val Shimmer = Color(0xFF1B2238)
    val ShimmerHighlight = Color(0xFF2B3550)
}

object ThesisDimens {
    val ScreenPaddingHorizontal = 20.dp
    val ScreenPaddingTop = 12.dp
    val ScreenPaddingBottom = 20.dp

    val CardCornerRadius = 20.dp
    val CardPadding = 18.dp

    val SpacingXs = 4.dp
    val SpacingSm = 8.dp
    val SpacingMd = 12.dp
    val SpacingLg = 16.dp
    val SpacingXxl = 24.dp

    val SignalBadgeCorner = 999.dp
    val SignalBadgePaddingH = 12.dp
    val SignalBadgePaddingV = 6.dp

    val ConfidenceRingSize = 56.dp
    val ConfidenceRingStroke = 6.dp
    val EvidenceDotSize = 7.dp
    val EvidenceDotSpacing = 4.dp
    val ShimmerLineHeight = 14.dp
}

private val thesisFont = FontFamily.Default

val ThesisTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Black,
        fontSize = 42.sp,
        lineHeight = 48.sp
    ),
    displayMedium = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 32.sp,
        lineHeight = 38.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 30.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 18.sp
    ),
    labelLarge = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelMedium = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
    labelSmall = TextStyle(
        fontFamily = thesisFont,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp
    )
)
