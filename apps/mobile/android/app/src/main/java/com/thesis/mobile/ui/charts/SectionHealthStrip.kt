package com.thesis.mobile.ui.charts

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * Section Health Strip — horizontal bar of colored blocks showing section statuses.
 * At a glance: "how thorough was this analysis?"
 * Gold = complete, Amber = partial, Red = failed/unavailable
 */
data class SectionHealthItem(
    val label: String,
    val status: String? // "complete", "data_incomplete", "data_unavailable", "failed", etc.
)

@Composable
fun SectionHealthStrip(
    sections: List<SectionHealthItem>,
    modifier: Modifier = Modifier
) {
    if (sections.isEmpty()) return

    val animProgress = remember { Animatable(0f) }
    LaunchedEffect(sections) {
        animProgress.snapTo(0f)
        animProgress.animateTo(1f, animationSpec = tween(800, easing = FastOutSlowInEasing))
    }

    val completeCount = sections.count { it.status.equals("complete", ignoreCase = true) }
    val totalCount = sections.size

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Analysis Coverage",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted
            )
            Text(
                text = "$completeCount / $totalCount complete",
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
        }

        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))

        // The strip
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            sections.forEachIndexed { index, section ->
                val color = statusColor(section.status)
                val blockAlpha = if (index.toFloat() / sections.size <= animProgress.value) 1f else 0.15f

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(color.copy(alpha = blockAlpha))
                )
            }
        }

        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))

        // Legend
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
        ) {
            LegendDot(color = ThesisColors.Primary, label = "Complete")
            LegendDot(color = ThesisColors.SignalWarning, label = "Partial")
            LegendDot(color = ThesisColors.SignalNegative, label = "Unavailable")
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .width(8.dp)
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
    }
}

private fun statusColor(status: String?): Color = when (status?.lowercase()) {
    "complete" -> ThesisColors.Primary
    "data_incomplete" -> ThesisColors.SignalWarning
    "data_unavailable", "failed" -> ThesisColors.SignalNegative
    else -> ThesisColors.Border
}
