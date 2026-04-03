package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun SignalBadge(
    signalValue: String?,
    modifier: Modifier = Modifier
) {
    val uppercaseSignal = signalValue?.uppercase() ?: "NO_SIGNAL"

    val (bgColor, textColor, displayText) = when (uppercaseSignal) {
        "POSITIVE" -> Triple(
            ThesisColors.SignalPositive.copy(alpha = 0.12f),
            ThesisColors.SignalPositive,
            "POSITIVE"
        )
        "NEGATIVE" -> Triple(
            ThesisColors.SignalNegative.copy(alpha = 0.12f),
            ThesisColors.SignalNegative,
            "NEGATIVE"
        )
        "NEUTRAL" -> Triple(
            ThesisColors.SignalNeutral.copy(alpha = 0.12f),
            ThesisColors.TextSecondary,
            "NEUTRAL"
        )
        else -> Triple(
            ThesisColors.Border,
            ThesisColors.TextMuted,
            "NO SIGNAL"
        )
    }

    Text(
        text = displayText,
        color = textColor,
        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
        modifier = modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(bgColor)
            .padding(
                horizontal = ThesisDimens.SignalBadgePaddingH,
                vertical = ThesisDimens.SignalBadgePaddingV
            )
    )
}
