package com.thesis.mobile.ui.charts.kit

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.MACRO_STRESS_BALANCED_MAX
import com.thesis.mobile.ui.theme.MACRO_STRESS_CONTAINED_MAX
import com.thesis.mobile.ui.theme.macroStressLabel
import com.thesis.mobile.ui.theme.macroStressTone
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.markColor

/*
 * ScaleBar (section 3 "Charts"; replaces the Macro Stress semicircle gauge): a 0 to 100 bar in regime segments
 * (Favourable / Neutral / Unfavourable mark colours at 18%), a marker (ink, 2 dp) at the value, and the regime
 * names under their segments, the current one in ink. The marker glides (`spatial`) when a refresh changes the
 * value; it is final on first paint and moves at once under reduced motion.
 */

/** A regime segment from [from] to [to] with its [tone] and [label] ("Contained"). */
@Immutable
data class ScaleSegment(val from: Double, val to: Double, val tone: Tone, val label: String)

/**
 * The scale bar. [segments] must cover [min]..[max] in order. [contentDescription] is what TalkBack reads
 * ("Macro stress 58 of 100, Balanced"); a missing [value] shows no marker.
 */
@Composable
fun ScaleBar(
    value: Double?,
    segments: List<ScaleSegment>,
    contentDescription: String,
    modifier: Modifier = Modifier,
    min: Double = 0.0,
    max: Double = 100.0,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val span = (max - min).takeIf { it > 0.0 && it.isFinite() } ?: 1.0
    val v = value.finiteOrNull()
    val target = v?.let { ((it - min) / span).toFloat().coerceIn(0f, 1f) } ?: Float.NaN
    val marker = remember { Animatable(target) }
    LaunchedEffect(target) {
        if (target.isNaN() || marker.value.isNaN() || reduced) marker.snapTo(target) else marker.animateTo(target, ThesisMotion.spatial())
    }
    val current = v?.let { x -> segments.indexOfLast { x >= it.from }.coerceAtLeast(0) } ?: -1

    Column(modifier.fillMaxWidth().semantics(mergeDescendants = true) { this.contentDescription = contentDescription }) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(ChartDims.scaleBar + ChartDims.markerOverhang * 2)
                .drawBehind {
                    val over = ChartDims.markerOverhang.toPx()
                    val barH = ChartDims.scaleBar.toPx()
                    val gap = ChartDims.scaleSegmentGap.toPx()
                    val radius = CornerRadius(barH / 2f)
                    segments.forEachIndexed { i, s ->
                        val a = (((s.from - min) / span).toFloat().coerceIn(0f, 1f)) * size.width + if (i == 0) 0f else gap / 2f
                        val b = (((s.to - min) / span).toFloat().coerceIn(0f, 1f)) * size.width - if (i == segments.lastIndex) 0f else gap / 2f
                        if (b > a) {
                            drawRoundRect(
                                s.tone.markColor(p).copy(alpha = ChartAlpha.SCALE_SEGMENT),
                                topLeft = Offset(a, over),
                                size = Size(b - a, barH),
                                cornerRadius = radius,
                            )
                        }
                    }
                    val m = marker.value
                    if (!m.isNaN()) {
                        val x = (m * size.width).coerceIn(ChartDims.markerStroke.toPx(), size.width - ChartDims.markerStroke.toPx())
                        drawLine(p.ink, Offset(x, 0f), Offset(x, size.height), ChartDims.markerStroke.toPx(), StrokeCap.Round)
                    }
                },
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(ChartDims.scaleSegmentGap)) {
            segments.forEachIndexed { i, s ->
                val share = ((s.to - s.from) / span).toFloat().coerceAtLeast(MIN_SHARE)
                Text(
                    s.label,
                    Modifier.weight(share),
                    style = ThesisType.caption,
                    color = if (i == current) p.ink else p.muted,
                    textAlign = when (i) {
                        0 -> TextAlign.Start
                        segments.lastIndex -> TextAlign.End
                        else -> TextAlign.Center
                    },
                )
            }
        }
    }
}

private const val MIN_SHARE = 0.05f

/** Where the macro stress regimes meet on a continuous axis (scores round: 35 is Contained, 36 Balanced). */
private const val CONTAINED_EDGE = MACRO_STRESS_CONTAINED_MAX + 0.5
private const val BALANCED_EDGE = MACRO_STRESS_BALANCED_MAX + 0.5

/** The Macro stress regimes for a [ScaleBar], words and tones from Semantic.kt (0-35, 36-69, 70-100). */
fun macroStressSegments(): List<ScaleSegment> = listOf(
    0.0 to CONTAINED_EDGE,
    CONTAINED_EDGE to BALANCED_EDGE,
    BALANCED_EDGE to 100.0,
).map { (a, b) -> ScaleSegment(a, b, macroStressTone((a + b) / 2), macroStressLabel((a + b) / 2)) }

/** The same regimes as 6% bands behind a Macro stress [LineChart] (their edges are the scrub's regime lines). */
fun macroStressBands(): List<ChartBand> = macroStressSegments().map { ChartBand(it.from, it.to, it.tone, it.label) }
