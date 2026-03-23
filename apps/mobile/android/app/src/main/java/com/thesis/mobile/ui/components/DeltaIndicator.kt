package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun DeltaIndicator(
    text: String,
    isPositive: Boolean,
    modifier: Modifier = Modifier
) {
    val color = if (isPositive) ThesisColors.SignalPositive else ThesisColors.SignalNegative
    val iconChar = if (isPositive) "▲" else "▼"

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = iconChar,
            color = color,
            style = ThesisTypography.labelMedium
        )
        Spacer(modifier = Modifier.width(ThesisDimens.SpacingXs))
        Text(
            text = text,
            color = color,
            style = ThesisTypography.labelMedium
        )
    }
}
