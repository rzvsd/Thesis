package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens

/**
 * A visual cluster of dots representing the number of evidence items attached to a section.
 */
@Composable
fun EvidenceDots(
    count: Int,
    modifier: Modifier = Modifier
) {
    if (count <= 0) return

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.EvidenceDotSpacing)
    ) {
        val displayCount = count.coerceAtMost(5) // Cap visually at 5 dots
        repeat(displayCount) { i ->
            val color = if (i == 4 && count > 5) {
                // Last dot if there are more
                ThesisColors.AccentBlue
            } else {
                ThesisColors.TextTertiaryDark.copy(alpha = 0.6f)
            }

            Box(
                modifier = Modifier
                    .size(if (i == 4 && count > 5) ThesisDimens.EvidenceDotSize * 1.2f else ThesisDimens.EvidenceDotSize)
                    .clip(CircleShape)
                    .background(color)
            )
        }
    }
}
