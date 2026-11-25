package com.thesis.mobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Loading pieces (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #25, #28, #29). Skeletons look like the final
 * layout (same line heights, same paddings) and are static here; the single slow shimmer sweep and the 300 / 400 ms
 * show-and-keep timing are PR-2 motion work (M1). LoadingHairline and LiveDot are the only loops, one at a time.
 */

/** A skeleton block: `surface2` (hero: `chip`), `badge` radius. */
@Composable
fun SkeletonBlock(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val fill = if (LocalInHeroBand.current) p.chip else p.surface2
    Box(modifier.clip(ThesisShape.badge).background(fill))
}

/**
 * One line of skeleton text for [style]: a box one line-height tall (so the final text takes the same room) with a
 * block of [widthFraction] across its middle.
 */
@Composable
fun SkeletonText(style: TextStyle, modifier: Modifier = Modifier, widthFraction: Float = 1f, lines: Int = 1) {
    val density = LocalDensity.current
    val block = with(density) { style.fontSize.toDp() }
    // Capped styles (ThesisType.capped) carry an em line height.
    val lineHeight: Dp = when {
        style.lineHeight.isSp -> with(density) { style.lineHeight.toDp() }
        style.lineHeight.isEm -> block * style.lineHeight.value
        else -> block * DEFAULT_LINE_HEIGHT
    }
    Column(modifier.fillMaxWidth()) {
        repeat(lines) { i ->
            Box(Modifier.fillMaxWidth().height(lineHeight), contentAlignment = Alignment.CenterStart) {
                val fraction = if (lines > 1 && i == lines - 1) widthFraction * 0.6f else widthFraction
                SkeletonBlock(Modifier.fillMaxWidth(fraction).height(block))
            }
        }
    }
}

/** Skeleton of a TickerRow / two-line list row inside a RowGroup segment (#25 SkeletonRow). */
@Composable
fun SkeletonRow(modifier: Modifier = Modifier, twoLine: Boolean = true) {
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = if (twoLine) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV)
            .clearAndSetSemantics { contentDescription = "Loading" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            SkeletonBlock(Modifier.size(ThesisSpace.statusSquare))
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            SkeletonText(ThesisType.rowTitle, widthFraction = 0.45f)
            if (twoLine) SkeletonText(ThesisType.bodySmall, widthFraction = 0.8f)
        }
        Spacer(Modifier.width(ThesisSpace.m))
        Column(horizontalAlignment = Alignment.End) {
            SkeletonBlock(Modifier.width(ThesisSpace.x4).height(ThesisSpace.l))
        }
    }
}

/** Skeleton of a ThesisCard with an eyebrow, a title and [bodyLines] of body (#25 SkeletonCard). */
@Composable
fun SkeletonCard(modifier: Modifier = Modifier, bodyLines: Int = 3) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .cardContainer(p, CardVariant.Plain)
            .padding(ThesisSpace.cardPadding)
            .clearAndSetSemantics { contentDescription = "Loading" },
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardInnerGap),
    ) {
        SkeletonText(ThesisType.eyebrow, widthFraction = 0.25f)
        SkeletonText(ThesisType.cardTitle, widthFraction = 0.75f)
        SkeletonText(ThesisType.bodySmall, lines = bodyLines)
    }
}

/** Skeleton of a KpiGrid with [cells] tiles (#25 SkeletonKpiGrid). */
@Composable
fun SkeletonKpiGrid(modifier: Modifier = Modifier, cells: Int = 4, featured: Boolean = false) {
    KpiGridLayout(cells, modifier.clearAndSetSemantics { contentDescription = "Loading" }) { _, _ ->
        // Same padding and rhythm as KpiTile, so the rows have the final grid's heights.
        KpiCellColumn(Modifier.fillMaxWidth()) {
            SkeletonText(ThesisType.caption, widthFraction = 0.6f)
            SkeletonText(kpiValueStyles(featured).first(), widthFraction = 0.5f)
            SkeletonText(ThesisType.caption, widthFraction = 0.4f)
        }
    }
}

/** Skeleton of a hero block: eyebrow, two serif bars and a KPI grid. Put it inside a HeroBand (#25 SkeletonHero). */
@Composable
fun SkeletonHero(modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = "Loading" },
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        SkeletonText(ThesisType.eyebrow, widthFraction = 0.4f)
        SkeletonText(ThesisType.capped(ThesisType.display), widthFraction = 0.7f)
        SkeletonText(ThesisType.lede, widthFraction = 0.9f, lines = 2)
        Spacer(Modifier.height(ThesisSpace.s))
        SkeletonKpiGrid(featured = true)
    }
}

/** Skeleton of a chart card: fignum, title, a chart area of the compact chart height (#25 SkeletonChart). */
@Composable
fun SkeletonChart(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .cardContainer(p, CardVariant.Plain)
            .padding(ThesisSpace.cardPadding)
            .clearAndSetSemantics { contentDescription = "Loading chart" },
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardInnerGap),
    ) {
        SkeletonText(ThesisType.eyebrow, widthFraction = 0.2f)
        SkeletonText(ThesisType.cardTitle, widthFraction = 0.7f)
        SkeletonBlock(Modifier.fillMaxWidth().height(Kit.chartCompact))
        SkeletonText(ThesisType.caption, widthFraction = 0.3f)
    }
}

/**
 * The "refreshing in background" signal (#28): a 1 dp `line` divider; while [active] a 20% accent highlight
 * travels across it every 2.25 s (linear). Static `line` under reduced motion. Announced as "Refreshing".
 */
@Composable
fun LoadingHairline(active: Boolean, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val phase: State<Float> = if (active && !reduced) {
        rememberInfiniteTransition(label = "hairline").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(ThesisMotion.HairlineLoop, easing = LinearEasing), RepeatMode.Restart),
            label = "hairlinePhase",
        )
    } else {
        remember { mutableFloatStateOf(-1f) }
    }
    val highlight = p.accent.copy(alpha = Kit.HAIRLINE_HIGHLIGHT_ALPHA)
    Box(
        modifier
            .fillMaxWidth()
            .height(ThesisSpace.border)
            .then(
                if (active) {
                    Modifier.clearAndSetSemantics {
                        contentDescription = "Refreshing"
                        progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
                    }
                } else {
                    Modifier
                },
            )
            .drawBehind {
                drawRect(p.line)
                val t = phase.value
                if (t >= 0f) {
                    val w = size.width * Kit.HAIRLINE_HIGHLIGHT_WIDTH
                    val x = -w + (size.width + w) * t
                    drawRect(highlight, topLeft = Offset(x, 0f), size = Size(w, size.height))
                }
            },
    )
}

/**
 * Live mark (#29): a 6 dp dot in the `up` colour with a ring growing 3 to 5 dp while fading .18 to .06 over 2 s.
 * Only for a War Room in its Live phase; never next to market data. Still under reduced motion.
 */
@Composable
fun LiveDot(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val pulse: State<Float> = if (reduced) {
        remember { mutableFloatStateOf(0f) }
    } else {
        rememberInfiniteTransition(label = "liveDot").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(ThesisMotion.LivePulse, easing = ThesisMotion.EaseInOut), RepeatMode.Reverse),
            label = "livePulse",
        )
    }
    Box(
        modifier
            .size(ThesisSpace.liveDot + Kit.liveRingTo * 2)
            .clearAndSetSemantics { contentDescription = "Live" }
            .drawBehind {
                val t = pulse.value
                val dot = ThesisSpace.liveDot.toPx() / 2f
                val ring = Kit.liveRingFrom.toPx() + (Kit.liveRingTo.toPx() - Kit.liveRingFrom.toPx()) * t
                val alpha = Kit.LIVE_RING_ALPHA_FROM + (Kit.LIVE_RING_ALPHA_TO - Kit.LIVE_RING_ALPHA_FROM) * t
                drawCircle(p.up.copy(alpha = alpha), radius = dot + ring)
                drawCircle(p.up, radius = dot)
            },
    )
}

private const val DEFAULT_LINE_HEIGHT = 1.3f
