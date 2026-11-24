package com.thesis.mobile.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisSurface
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.markColor
import com.thesis.mobile.ui.theme.tnum

/*
 * Small atoms (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #36): Eyebrow, Kicker, NoteMark, CountBadge, Meter,
 * StatusSquare, Avatar, plus PagerDots (#45), dividers and the arc spinner used by loading buttons.
 * Uppercase is applied here, never by callers.
 */

/**
 * Eyebrow label (`eyebrow`, 11 / 600, +0.14 em, UPPERCASE). Muted by default; inside a [HeroBand] it is heroAccent
 * and starts with the Deep Dive cover mark (a 28 x 1 dp rule, 8 dp gap). Pass [color] for a gold figure number
 * ("CHART 3").
 */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = Color.Unspecified, maxLines: Int = 2) {
    val p = LocalThesisPalette.current
    val inHero = LocalInHeroBand.current
    val resolved = when {
        color != Color.Unspecified -> color
        inHero -> p.accent
        else -> p.muted
    }
    if (inHero) {
        Row(modifier, verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .width(ThesisSurface.heroEyebrowRuleWidth)
                    .height(ThesisSpace.border)
                    .background(p.accent),
            )
            Spacer(Modifier.width(ThesisSurface.heroEyebrowRuleGap))
            Text(text.uppercase(), style = ThesisType.eyebrow, color = resolved, maxLines = maxLines)
        }
    } else {
        Text(text.uppercase(), modifier = modifier, style = ThesisType.eyebrow, color = resolved, maxLines = maxLines)
    }
}

/** Chapter / section kicker (`kicker`, 11.5 / 700, +0.18 em, UPPERCASE) in accent. */
@Composable
fun Kicker(text: String, modifier: Modifier = Modifier, color: Color = Color.Unspecified) {
    val p = LocalThesisPalette.current
    Text(
        text.uppercase(),
        modifier = modifier,
        style = ThesisType.kicker,
        color = if (color != Color.Unspecified) color else p.accent,
    )
}

/** The 7 dp radius-2 status square (thesis state, alert category, badge mark). */
@Composable
fun StatusSquare(color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(ThesisSpace.statusSquare)
            .clip(ThesisShape.statusSquare)
            .background(color),
    )
}

/** [StatusSquare] coloured by [tone] (mark colour). */
@Composable
fun StatusSquare(tone: Tone, modifier: Modifier = Modifier) {
    StatusSquare(tone.markColor(LocalThesisPalette.current), modifier)
}

/** "Has a note" mark: the notes glyph at 16 dp in muted. */
@Composable
fun NoteMark(modifier: Modifier = Modifier, contentDescription: String? = "Has a note") {
    Icon(
        ThesisIcons.Small.Notes,
        contentDescription = contentDescription,
        modifier = modifier.size(ThesisSpace.iconS),
        tint = LocalThesisPalette.current.muted,
    )
}

/** A small count ("3 new"): caption tnum, ink2, on chip fill, badge radius. */
@Composable
fun CountBadge(text: String, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Text(
        text,
        modifier = modifier
            .clip(ThesisShape.badge)
            .background(p.chip)
            .padding(horizontal = Kit.chipGap, vertical = ThesisSpace.xxs),
        style = ThesisType.caption.tnum(),
        color = p.ink2,
        maxLines = 1,
    )
}

/** [CountBadge] for a plain count. */
@Composable
fun CountBadge(count: Int, modifier: Modifier = Modifier) = CountBadge(count.toString(), modifier)

/**
 * A horizontal meter (0..1). In lists and grids the fill is `ink2` @ 60% on `grid` and 4 dp tall; [subject] = true
 * is the one subject meter on a screen (accent, 8 dp). [tone] colours the fill by meaning instead.
 * [contentDescription] should say the value and its scale ("Monitor score 62 of 100").
 */
@Composable
fun Meter(
    fraction: Float,
    modifier: Modifier = Modifier,
    subject: Boolean = false,
    tone: Tone? = null,
    contentDescription: String? = null,
) {
    val p = LocalThesisPalette.current
    val f = fraction.coerceIn(0f, 1f)
    val fill = when {
        tone != null -> tone.markColor(p)
        subject -> p.accent
        else -> p.ink2.copy(alpha = Kit.METER_FILL_ALPHA)
    }
    val track = if (subject) Kit.meterTrackSubject else Kit.meterTrack
    Box(
        modifier
            .fillMaxWidth()
            .height(track)
            .clip(ThesisShape.pill)
            .background(p.grid)
            .semantics {
                progressBarRangeInfo = ProgressBarRangeInfo(f, 0f..1f)
                if (contentDescription != null) this.contentDescription = contentDescription
            }
            .drawBehind {
                drawRoundRect(
                    fill,
                    size = Size(size.width * f, size.height),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2f),
                )
            },
    )
}

/**
 * The You avatar: a 32 dp circle with initials (chip fill, ink2 `label`). With [onClick] it is a 48 dp target
 * described as [contentDescription].
 */
@Composable
fun Avatar(
    initials: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentDescription: String = "You",
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    val outer = if (onClick != null) {
        modifier
            .minimumInteractiveComponentSize()
            .clickable(source, indication = null, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription }
    } else {
        modifier.clearAndSetSemantics { this.contentDescription = contentDescription }
    }
    Box(outer, contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(ThesisSpace.avatar)
                .thesisPress(source, shape = CircleShape, enabled = onClick != null)
                .clip(CircleShape)
                .background(p.chip),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                initials.take(2).uppercase(),
                style = ThesisType.label,
                color = p.ink2,
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
        }
    }
}

/** Pager position (#45): 6 dp dots, current in ink, others in line2; no stretching pill. */
@Composable
fun PagerDots(count: Int, current: Int, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Row(
        modifier.semantics { contentDescription = "Page ${current + 1} of $count" },
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(count) { i ->
            Box(
                Modifier
                    .size(Kit.pagerDot)
                    .clip(CircleShape)
                    .background(if (i == current) p.ink else p.line2),
            )
        }
    }
}

/** Hairline divider in `line`, starting [startInset] from the start edge. */
@Composable
fun ThesisDivider(modifier: Modifier = Modifier, startInset: Dp = 0.dp) {
    val p = LocalThesisPalette.current
    Box(
        modifier
            .fillMaxWidth()
            .padding(start = startInset)
            .height(ThesisSpace.hairline)
            .background(p.line),
    )
}

/** Chapter divider for long reads: 1 dp `line2` at 60%. */
@Composable
fun ChapterDivider(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Box(
        modifier
            .fillMaxWidth()
            .height(ThesisSpace.border)
            .background(p.line2.copy(alpha = ThesisSurface.CHAPTER_DIVIDER_ALPHA)),
    )
}

/**
 * A 90 degree arc turning once per [ThesisMotion.RefreshSpin] (loading buttons, refresh, export). Static under
 * reduced motion. Decorative: the caller describes the loading state.
 */
@Composable
fun ArcSpinner(modifier: Modifier = Modifier, color: Color = Color.Unspecified, size: Dp = ThesisSpace.iconS) {
    val p = LocalThesisPalette.current
    val tint = if (color != Color.Unspecified) color else p.ink
    val reduced = LocalReducedMotion.current
    val angle: State<Float> = if (reduced) {
        remember { mutableFloatStateOf(0f) }
    } else {
        rememberInfiniteTransition(label = "arcSpinner").animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(tween(ThesisMotion.RefreshSpin, easing = LinearEasing), RepeatMode.Restart),
            label = "arcAngle",
        )
    }
    Canvas(modifier.size(size)) {
        val stroke = Kit.ringStroke.toPx()
        rotate(angle.value) {
            drawArc(
                color = tint,
                startAngle = -90f,
                sweepAngle = Kit.REFRESH_SWEEP_SPINNING,
                useCenter = false,
                topLeft = Offset(stroke / 2f, stroke / 2f),
                size = Size(this.size.width - stroke, this.size.height - stroke),
                style = Stroke(stroke, cap = StrokeCap.Round),
            )
        }
    }
}
