package com.thesis.mobile.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens

/**
 * A beautiful animated skeleton loader for reports and sections.
 * Gives the impression that Dexter is building the report live.
 */
@Composable
fun ShimmerCard(
    modifier: Modifier = Modifier,
    isLarge: Boolean = false
) {
    val shimmerColors = listOf(
        ThesisColors.Shimmer,
        ThesisColors.ShimmerHighlight,
        ThesisColors.Shimmer
    )

    val transition = rememberInfiniteTransition(label = "shimmer_transition")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1500,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate_anim"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnim.value, y = translateAnim.value)
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface)
    ) {
        Column(modifier = Modifier.padding(ThesisDimens.CardPadding)) {
            // Title skeleton
            Box(
                modifier = Modifier
                    .fillMaxWidth(if (isLarge) 0.8f else 0.4f)
                    .height(ThesisDimens.ShimmerLineHeight * 1.5f)
                    .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

            // Body lines
            repeat(if (isLarge) 4 else 2) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(if (it == (if (isLarge) 3 else 1)) 0.6f else 1f)
                        .height(ThesisDimens.ShimmerLineHeight)
                        .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            }
        }
    }
}
