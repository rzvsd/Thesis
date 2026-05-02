package com.thesis.mobile.ui.navigation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlin.math.roundToInt

data class ThesisNavItem(
    val label: String,
    val icon: ImageVector,
    val tag: String
)

@Composable
fun ThesisBottomBar(
    items: List<ThesisNavItem>,
    selectedTag: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val selectedIndex = items.indexOfFirst { it.tag == selectedTag }.coerceAtLeast(0)
    val indicatorOffset = remember { Animatable(selectedIndex.toFloat()) }

    LaunchedEffect(selectedIndex) {
        indicatorOffset.animateTo(
            selectedIndex.toFloat(),
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow
            )
        )
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(ThesisColors.Background)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border)
            .navigationBarsPadding()
    ) {
        if (items.isNotEmpty()) {
            GoldIndicator(items = items, indicatorOffset = indicatorOffset.value)
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = ThesisDimens.SpacingSm),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEachIndexed { index, item ->
                val isSelected = index == selectedIndex
                val itemColor = if (isSelected) ThesisColors.Primary else ThesisColors.TextMuted

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .height(64.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onSelect(item.tag) }
                        )
                        .semantics {
                            contentDescription = "${item.label} tab${if (isSelected) ", selected" else ""}"
                            role = Role.Tab
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = null,
                        tint = itemColor,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.label,
                        style = ThesisTypography.labelSmall.copy(
                            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
                        ),
                        color = itemColor
                    )
                }
            }
        }
    }
}

@Composable
private fun GoldIndicator(items: List<ThesisNavItem>, indicatorOffset: Float) {
    val density = LocalDensity.current
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .height(2.dp)
    ) {
        val itemWidth = maxWidth / items.size
        val offsetPx = with(density) { (itemWidth * indicatorOffset).toPx() }
        Box(
            modifier = Modifier
                .offset { IntOffset(offsetPx.roundToInt(), 0) }
                .size(width = itemWidth, height = 2.dp)
                .background(ThesisColors.Primary)
        )
    }
}
