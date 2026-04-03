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
        val displayCount = count.coerceAtMost(5)
        repeat(displayCount) { i ->
            val color = if (i == 4 && count > 5) {
                ThesisColors.Primary
            } else {
                ThesisColors.TextMuted.copy(alpha = 0.5f)
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
