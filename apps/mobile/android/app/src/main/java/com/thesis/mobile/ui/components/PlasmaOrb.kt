package com.thesis.mobile.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

private val OrbGoldBright = Color(0xFFD4AF37)
private val OrbGoldWarm = Color(0xFFC5A059)
private val OrbGoldMuted = Color(0xFFAA8844)
private val OrbAmber = Color(0xFFE8C566)
private val OrbWhite = Color(0xFFFFF8E7)
private val OrbCoreWhite = Color(0xFFFFFDF5)

private data class ArcSeed(
    val startAngle: Float,
    val endAngle: Float,
    val wobbleSpeed: Float,
    val wobbleAmount: Float,
    val thickness: Float,
    val color: Color
)

@Composable
fun PlasmaOrb(
    modifier: Modifier = Modifier,
    size: Dp = 180.dp,
    intensity: Float = 1f
) {
    val transition = rememberInfiniteTransition(label = "plasma")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )
    val phase2 by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(6500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase2"
    )
    val corePulse by transition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "corePulse"
    )
    val particleAngle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(8000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "particleOrbit"
    )

    val arcSeeds = remember {
        listOf(
            ArcSeed(0f, 160f, 1.0f, 0.35f, 2.5f, OrbGoldBright),
            ArcSeed(40f, 200f, 1.3f, 0.28f, 2.0f, OrbGoldWarm),
            ArcSeed(80f, 280f, 0.7f, 0.42f, 1.8f, OrbAmber),
            ArcSeed(120f, 310f, 1.5f, 0.30f, 2.2f, OrbGoldBright),
            ArcSeed(170f, 350f, 0.9f, 0.38f, 1.5f, OrbGoldMuted),
            ArcSeed(200f, 60f, 1.1f, 0.33f, 2.8f, OrbAmber),
            ArcSeed(250f, 100f, 1.4f, 0.25f, 1.6f, OrbGoldWarm),
            ArcSeed(290f, 140f, 0.8f, 0.40f, 2.0f, OrbGoldBright),
            ArcSeed(330f, 190f, 1.2f, 0.36f, 1.4f, OrbGoldMuted),
            ArcSeed(15f, 240f, 0.6f, 0.45f, 3.0f, OrbAmber.copy(alpha = 0.7f)),
            ArcSeed(55f, 320f, 1.6f, 0.20f, 1.2f, OrbGoldWarm.copy(alpha = 0.6f)),
            ArcSeed(145f, 30f, 1.0f, 0.32f, 2.4f, OrbGoldBright.copy(alpha = 0.8f))
        )
    }
    val particleSeeds = remember { listOf(0f, 60f, 120f, 180f, 240f, 300f) }

    Canvas(modifier = modifier.size(size)) {
        val canvasSize = this.size
        val centerX = canvasSize.width / 2f
        val centerY = canvasSize.height / 2f
        val radius = (canvasSize.minDimension / 2f) * 0.85f

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    OrbGoldWarm.copy(alpha = 0.08f * intensity * corePulse),
                    OrbGoldWarm.copy(alpha = 0.03f * intensity),
                    Color.Transparent
                ),
                center = Offset(centerX, centerY),
                radius = radius * 1.8f
            ),
            center = Offset(centerX, centerY),
            radius = radius * 1.8f
        )

        drawCircle(
            color = OrbGoldMuted.copy(alpha = 0.12f * intensity),
            center = Offset(centerX, centerY),
            radius = radius,
            style = Stroke(width = 1f)
        )

        arcSeeds.forEachIndexed { i, seed ->
            drawElectricalArc(
                centerX = centerX,
                centerY = centerY,
                radius = radius,
                seed = seed,
                phase = phase * seed.wobbleSpeed + (i * 0.5f),
                phase2 = phase2 * seed.wobbleSpeed * 0.7f + (i * 0.3f),
                intensity = intensity
            )
        }

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    OrbCoreWhite.copy(alpha = 0.25f * corePulse * intensity),
                    OrbGoldBright.copy(alpha = 0.15f * corePulse * intensity),
                    OrbGoldWarm.copy(alpha = 0.05f * intensity),
                    Color.Transparent
                ),
                center = Offset(centerX, centerY),
                radius = radius * 0.5f
            ),
            center = Offset(centerX, centerY),
            radius = radius * 0.5f
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    OrbWhite.copy(alpha = 0.4f * corePulse * intensity),
                    OrbGoldBright.copy(alpha = 0.15f * intensity),
                    Color.Transparent
                ),
                center = Offset(centerX, centerY),
                radius = radius * 0.15f
            ),
            center = Offset(centerX, centerY),
            radius = radius * 0.15f
        )

        particleSeeds.forEachIndexed { i, baseDeg ->
            val deg = baseDeg + particleAngle + (i * 7f)
            val rad = Math.toRadians(deg.toDouble())
            val orbitRadius = radius * (0.7f + 0.2f * sin(phase.toDouble() + i * 1.1).toFloat())
            val px = centerX + (orbitRadius * cos(rad)).toFloat()
            val py = centerY + (orbitRadius * sin(rad)).toFloat()
            val particleAlpha =
                (0.3f + 0.4f * sin(phase.toDouble() * 2 + i).toFloat()).coerceIn(0f, 1f) * intensity
            val particleSize = 1.5f + sin(phase.toDouble() * 1.5 + i * 0.8).toFloat() * 1f

            drawCircle(
                color = OrbAmber.copy(alpha = particleAlpha),
                center = Offset(px, py),
                radius = particleSize + 2f
            )
            drawCircle(
                color = OrbWhite.copy(alpha = particleAlpha * 0.8f),
                center = Offset(px, py),
                radius = particleSize
            )
        }
    }
}

private fun DrawScope.drawElectricalArc(
    centerX: Float,
    centerY: Float,
    radius: Float,
    seed: ArcSeed,
    phase: Float,
    phase2: Float,
    intensity: Float
) {
    val startRad = Math.toRadians(seed.startAngle.toDouble())
    val endRad = Math.toRadians(seed.endAngle.toDouble())
    val sx = centerX + radius * cos(startRad).toFloat()
    val sy = centerY + radius * sin(startRad).toFloat()
    val ex = centerX + radius * cos(endRad).toFloat()
    val ey = centerY + radius * sin(endRad).toFloat()

    val wobbleX = sin(phase.toDouble()) * seed.wobbleAmount * radius
    val wobbleY = cos(phase2.toDouble()) * seed.wobbleAmount * radius

    val cp1x = centerX + (radius * 0.3f * cos(startRad + 0.5).toFloat()) + wobbleX.toFloat()
    val cp1y = centerY + (radius * 0.3f * sin(startRad + 0.5).toFloat()) + wobbleY.toFloat()

    val cp2x = centerX + (radius * 0.3f * cos(endRad - 0.5).toFloat()) - wobbleY.toFloat() * 0.7f
    val cp2y = centerY + (radius * 0.3f * sin(endRad - 0.5).toFloat()) + wobbleX.toFloat() * 0.7f

    val path = Path().apply {
        moveTo(sx, sy)
        cubicTo(cp1x, cp1y, cp2x, cp2y, ex, ey)
    }

    drawPath(
        path = path,
        color = seed.color.copy(alpha = 0.15f * intensity),
        style = Stroke(width = seed.thickness * 4f, cap = StrokeCap.Round)
    )
    drawPath(
        path = path,
        color = seed.color.copy(alpha = (0.5f + 0.3f * sin(phase.toDouble()).toFloat()) * intensity),
        style = Stroke(width = seed.thickness, cap = StrokeCap.Round)
    )
    drawPath(
        path = path,
        color = OrbWhite.copy(alpha = (0.2f + 0.15f * sin(phase.toDouble() * 1.5).toFloat()) * intensity),
        style = Stroke(width = seed.thickness * 0.4f, cap = StrokeCap.Round)
    )
}
