package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * An expandable card to hold the "FULL SECTIONS" of a report, allowing detail readers to dig in
 * without overwhelming the delta-first presentation layer.
 */
@Composable
fun SectionAccordion(
    title: String,
    statusText: String?,
    content: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    initiallyExpanded: Boolean = false
) {
    var isExpanded by rememberSaveable { mutableStateOf(initiallyExpanded) }
    val rotateAnim by animateFloatAsState(
        targetValue = if (isExpanded) 180f else 0f,
        label = "accordion_arrow_rotation"
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.DarkSurface)
    ) {
        // Header Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(ThesisDimens.CardPadding),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = ThesisTypography.headlineMedium,
                    color = ThesisColors.TextPrimaryDark
                )
                if (!statusText.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                    Text(
                        text = "Status: $statusText",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextTertiaryDark
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                tint = ThesisColors.TextSecondaryDark,
                modifier = Modifier.rotate(rotateAnim)
            )
        }

        // Expanded Content
        AnimatedVisibility(visible = isExpanded) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        start = ThesisDimens.CardPadding,
                        end = ThesisDimens.CardPadding,
                        bottom = ThesisDimens.CardPadding
                    )
            ) {
                content()
            }
        }
    }
}
