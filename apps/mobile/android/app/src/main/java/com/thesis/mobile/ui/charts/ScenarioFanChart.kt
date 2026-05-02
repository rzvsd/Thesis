package com.thesis.mobile.ui.charts

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * Scenario Projection Fan — visualizes bull/base/bear price targets
 * as a fan chart spreading from current price to projected range.
 * Animated reveal from left to right.
 */
data class ScenarioData(
    val bullPrice: Float,
    val basePrice: Float,
    val bearPrice: Float,
    val currentPrice: Float? = null
)

@Composable
fun ScenarioFanChart(
    data: ScenarioData,
    modifier: Modifier = Modifier,
    bullColor: Color = ThesisColors.SignalPositive,
    baseColor: Color = ThesisColors.Primary,
    bearColor: Color = ThesisColors.SignalNegative
) {
    val animProgress = remember { Animatable(0f) }
    LaunchedEffect(data) {
        animProgress.snapTo(0f)
        animProgress.animateTo(1f, animationSpec = tween(1200, easing = FastOutSlowInEasing))
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = "Scenario Projections",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted,
            modifier = Modifier.padding(bottom = ThesisDimens.SpacingMd)
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
        ) {
            Canvas(modifier = Modifier.fillMaxWidth().height(120.dp)) {
                val w = size.width
                val h = size.height
                val progress = animProgress.value

                val maxPrice = maxOf(data.bullPrice, data.basePrice, data.bearPrice) * 1.05f
                val minPrice = minOf(data.bullPrice, data.basePrice, data.bearPrice) * 0.95f
                val priceRange = maxPrice - minPrice

                fun priceToY(price: Float): Float = h - ((price - minPrice) / priceRange * h)

                val startX = 0f
                val endX = w * progress
                val midY = priceToY(data.basePrice)

                // Fan area (bull to bear)
                val fanPath = Path().apply {
                    moveTo(startX, midY)
                    lineTo(endX, priceToY(data.bullPrice))
                    lineTo(endX, priceToY(data.bearPrice))
                    close()
                }
                drawPath(fanPath, baseColor.copy(alpha = 0.06f * progress))

                // Bull line
                drawLine(
                    color = bullColor.copy(alpha = 0.7f * progress),
                    start = Offset(startX, midY),
                    end = Offset(endX, priceToY(data.bullPrice)),
                    strokeWidth = 2.dp.toPx(),
                    cap = StrokeCap.Round
                )

                // Base line (center)
                drawLine(
                    color = baseColor.copy(alpha = 0.9f * progress),
                    start = Offset(startX, midY),
                    end = Offset(endX, priceToY(data.basePrice)),
                    strokeWidth = 2.5.dp.toPx(),
                    cap = StrokeCap.Round
                )

                // Bear line
                drawLine(
                    color = bearColor.copy(alpha = 0.7f * progress),
                    start = Offset(startX, midY),
                    end = Offset(endX, priceToY(data.bearPrice)),
                    strokeWidth = 2.dp.toPx(),
                    cap = StrokeCap.Round
                )

                // Endpoint dots
                if (progress > 0.9f) {
                    val dotAlpha = (progress - 0.9f) / 0.1f
                    drawCircle(bullColor.copy(alpha = dotAlpha), 4.dp.toPx(), Offset(endX, priceToY(data.bullPrice)))
                    drawCircle(baseColor.copy(alpha = dotAlpha), 4.dp.toPx(), Offset(endX, priceToY(data.basePrice)))
                    drawCircle(bearColor.copy(alpha = dotAlpha), 4.dp.toPx(), Offset(endX, priceToY(data.bearPrice)))
                }
            }
        }

        // Labels
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
        Row(modifier = Modifier.fillMaxWidth()) {
            ScenarioLabel("Bull", data.bullPrice, bullColor, Modifier.weight(1f))
            ScenarioLabel("Base", data.basePrice, baseColor, Modifier.weight(1f))
            ScenarioLabel("Bear", data.bearPrice, bearColor, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ScenarioLabel(label: String, price: Float, color: Color, modifier: Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = color,
            textAlign = TextAlign.Center
        )
        Text(
            text = "$${String.format("%.0f", price)}",
            style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary,
            textAlign = TextAlign.Center
        )
    }
}
