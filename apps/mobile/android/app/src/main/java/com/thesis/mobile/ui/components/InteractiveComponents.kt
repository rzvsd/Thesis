package com.thesis.mobile.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun ThesisButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isPrimary: Boolean = true,
    accessibilityLabel: String = text,
    minHeight: Dp = 52.dp,
    content: @Composable (() -> Unit)? = null
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed && enabled) 0.97f else 1f,
        animationSpec = tween(100, easing = FastOutSlowInEasing),
        label = "btnScale"
    )

    val containerColor by animateColorAsState(
        targetValue = when {
            !enabled && isPrimary -> ThesisColors.Primary.copy(alpha = 0.3f)
            !enabled -> ThesisColors.SurfaceElevated.copy(alpha = 0.5f)
            isPressed && isPrimary -> ThesisColors.PrimaryHover
            isPrimary -> ThesisColors.Primary
            isPressed -> ThesisColors.SurfaceOverlay
            else -> ThesisColors.SurfaceElevated
        },
        animationSpec = tween(150),
        label = "btnColor"
    )

    val textColor = if (isPrimary) ThesisColors.TextInverse else ThesisColors.TextPrimary

    Box(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = minHeight)
            .height(minHeight)
            .scale(scale)
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(containerColor)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                onClick = onClick
            )
            .semantics {
                contentDescription = accessibilityLabel
                role = Role.Button
            },
        contentAlignment = Alignment.Center
    ) {
        if (content != null) {
            content()
        } else {
            Text(
                text = text,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = if (enabled) textColor else textColor.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
fun InteractiveCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String? = null,
    borderColor: Color = ThesisColors.Border,
    content: @Composable () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val bgColor by animateColorAsState(
        targetValue = if (isPressed) ThesisColors.SurfaceElevated else ThesisColors.Surface,
        animationSpec = tween(120),
        label = "cardBg"
    )

    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clip(shape)
            .background(bgColor)
            .border(ThesisDimens.BorderWidth, borderColor, shape)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .then(
                if (accessibilityLabel != null) {
                    Modifier.semantics {
                        contentDescription = accessibilityLabel
                        role = Role.Button
                    }
                } else {
                    Modifier
                }
            )
            .padding(ThesisDimens.CardPadding)
    ) {
        content()
    }
}
