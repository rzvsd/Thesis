package com.thesis.mobile.ui.charts

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Evidence Strength Radar — spider chart showing evidence source distribution.
 * Each axis represents a section, value is evidence count normalized.
 * Animates from center outward on appear.
 */
data class RadarDataPoint(
    val label: String,
    val value: Float, // 0..1 normalized
    val rawCount: Int
)

@Composable
fun EvidenceRadar(
    data: List<RadarDataPoint>,
    modifier: Modifier = Modifier,
    chartColor: Color = ThesisColors.Primary,
    gridColor: Color = ThesisColors.Border,
    labelColor: Color = ThesisColors.TextMuted
) {
    if (data.size < 3) return // Need at least 3 axes for a radar

    val animProgress = remember { Animatable(0f) }
    LaunchedEffect(data) {
        animProgress.snapTo(0f)
        animProgress.animateTo(1f, animationSpec = tween(1000, easing = FastOutSlowInEasing))
    }

    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Evidence Coverage",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted,
            modifier = Modifier.padding(bottom = ThesisDimens.SpacingSm)
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .padding(horizontal = 32.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxWidth().height(200.dp)) {
                val cx = size.width / 2
                val cy = size.height / 2
                val radius = min(cx, cy) - 24.dp.toPx()
                val n = data.size
                val angleStep = (2 * PI / n).toFloat()

                // Grid rings (3 levels)
                for (ring in 1..3) {
                    val r = radius * ring / 3f
                    val gridPath = Path()
                    for (i in 0 until n) {
                        val angle = -PI.toFloat() / 2 + i * angleStep
                        val x = cx + r * cos(angle)
                        val y = cy + r * sin(angle)
                        if (i == 0) gridPath.moveTo(x, y) else gridPath.lineTo(x, y)
                    }
                    gridPath.close()
                    drawPath(gridPath, gridColor.copy(alpha = 0.3f), style = Stroke(1.dp.toPx()))
                }

                // Axis lines
                for (i in 0 until n) {
                    val angle = -PI.toFloat() / 2 + i * angleStep
                    drawLine(
                        color = gridColor.copy(alpha = 0.2f),
                        start = Offset(cx, cy),
                        end = Offset(cx + radius * cos(angle), cy + radius * sin(angle)),
                        strokeWidth = 1.dp.toPx()
                    )
                }

                // Data polygon (animated)
                val progress = animProgress.value
                val dataPath = Path()
                for (i in 0 until n) {
                    val angle = -PI.toFloat() / 2 + i * angleStep
                    val r = radius * data[i].value * progress
                    val x = cx + r * cos(angle)
                    val y = cy + r * sin(angle)
                    if (i == 0) dataPath.moveTo(x, y) else dataPath.lineTo(x, y)
                }
                dataPath.close()

                // Fill
                drawPath(dataPath, chartColor.copy(alpha = 0.12f * progress))
                // Stroke
                drawPath(dataPath, chartColor.copy(alpha = 0.8f * progress), style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))

                // Data points (dots)
                for (i in 0 until n) {
                    val angle = -PI.toFloat() / 2 + i * angleStep
                    val r = radius * data[i].value * progress
                    val x = cx + r * cos(angle)
                    val y = cy + r * sin(angle)
                    drawCircle(chartColor, radius = 3.dp.toPx() * progress, center = Offset(x, y))
                }

                // Labels
                for (i in 0 until n) {
                    val angle = -PI.toFloat() / 2 + i * angleStep
                    val labelR = radius + 16.dp.toPx()
                    val x = cx + labelR * cos(angle)
                    val y = cy + labelR * sin(angle)
                    drawLabelDot(x, y, labelColor.copy(alpha = 0.6f), 2.dp.toPx())
                }
            }
        }

        // Legend row
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
        Text(
            text = data.joinToString("  ·  ") { "${it.label}: ${it.rawCount}" },
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
    }
}

private fun DrawScope.drawLabelDot(x: Float, y: Float, color: Color, radius: Float) {
    drawCircle(color, radius = radius, center = Offset(x, y))
}
