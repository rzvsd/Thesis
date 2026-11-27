package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisTransitions
import com.thesis.mobile.ui.motion.rememberDrawOn
import com.thesis.mobile.ui.motion.rewardPulse
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisFonts
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import kotlin.math.roundToInt

/*
 * Report prose and progress pieces (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #32, #33, #49, #50, #51).
 */

// ---------------------------------------------------------------------------------------------------------------
// HighlightText (#32)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Prose with the DD lead-phrase marker (#32): [lead] in SemiBold over a `highlight` band from 54% to 96% of each
 * line's height, then [rest]. With [dropCap] the first letter is set in `newsreader_display` accent, 3.25 lines
 * tall, and the text beside it is split at the line that clears the cap. Pure draw-phase.
 */
@Composable
fun HighlightText(
    lead: String,
    rest: String,
    modifier: Modifier = Modifier,
    style: TextStyle = ThesisType.story,
    dropCap: Boolean = false,
) {
    val p = LocalThesisPalette.current
    val full = buildAnnotatedString {
        withStyle(ThesisType.lead) { append(lead) }
        if (rest.isNotEmpty()) {
            if (lead.isNotEmpty() && !lead.endsWith(' ') && !rest.startsWith(' ')) append(' ')
            append(rest)
        }
    }
    val band = 0 until lead.length
    if (!dropCap || full.isEmpty()) {
        BandText(full, band, style.copy(color = p.ink), p, modifier)
    } else {
        DropCapText(full, band, style.copy(color = p.ink), p, modifier)
    }
}

/** Text that draws the highlight band behind [band] (character range). */
@Composable
private fun BandText(text: AnnotatedString, band: IntRange, style: TextStyle, p: ThesisPalette, modifier: Modifier) {
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    Text(
        text,
        modifier = modifier.drawBehind { layout?.let { drawBand(it, band, p.highlight) } },
        style = style,
        onTextLayout = { layout = it },
    )
}

private fun DrawScope.drawBand(layout: TextLayoutResult, band: IntRange, color: Color) {
    if (band.isEmpty()) return
    val end = minOf(band.last + 1, layout.layoutInput.text.length)
    if (end <= band.first) return
    val firstLine = layout.getLineForOffset(band.first)
    val lastLine = layout.getLineForOffset(end - 1)
    for (line in firstLine..lastLine) {
        val from = maxOf(band.first, layout.getLineStart(line))
        val to = minOf(end, layout.getLineEnd(line, visibleEnd = true))
        if (to <= from) continue
        val x1 = layout.getHorizontalPosition(from, usePrimaryDirection = true)
        val x2 = layout.getHorizontalPosition(to, usePrimaryDirection = true)
        val top = layout.getLineTop(line)
        val h = layout.getLineBottom(line) - top
        drawRect(
            color,
            topLeft = Offset(minOf(x1, x2), top + h * Kit.HIGHLIGHT_FROM),
            size = Size(kotlin.math.abs(x2 - x1), h * (Kit.HIGHLIGHT_TO - Kit.HIGHLIGHT_FROM)),
        )
    }
}

@Composable
private fun DropCapText(text: AnnotatedString, band: IntRange, style: TextStyle, p: ThesisPalette, modifier: Modifier) {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val capStyle = style.copy(
        fontFamily = ThesisFonts.NewsreaderDisplay,
        fontWeight = FontWeight.Normal,
        fontSize = style.fontSize * Kit.DROP_CAP_SCALE,
        lineHeight = style.fontSize * Kit.DROP_CAP_SCALE,
        color = p.accent,
    )
    val cap = text.text.take(1)
    val body = text.subSequence(1, text.length)
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val capLayout = measurer.measure(cap, capStyle)
        val gap = with(density) { ThesisSpace.s.roundToPx() }
        val besideWidth = (constraints.maxWidth - capLayout.size.width - gap).coerceAtLeast(0)
        val beside = measurer.measure(body, style, constraints = Constraints(maxWidth = besideWidth))
        // Lines beside the cap: as many as fit in its height (at least one).
        var lines = 0
        while (lines < beside.lineCount && beside.getLineBottom(lines) <= capLayout.size.height + 1) lines++
        lines = lines.coerceAtLeast(1)
        val split = if (lines >= beside.lineCount) body.length else beside.getLineEnd(lines - 1)
        val first = body.subSequence(0, split)
        val second = body.subSequence(split, body.length).let { s ->
            val trimmed = s.text.trimStart().length
            s.subSequence(s.length - trimmed, s.length)
        }
        val bandAfterCap = (band.first - 1).coerceAtLeast(0) until (band.last).coerceAtLeast(0)
        // The cap sits on the baseline of the second line beside it (DD: a two-line drop cap), or of the only line.
        val capLine = (lines - 1).coerceAtMost(1)
        // Compose 1.7's per-line baseline (PR-4b; 1.6 derived it from the first baseline and the line tops, the same
        // value for the story style's fixed line height: drop-cap renders unchanged).
        val besideBaseline = beside.getLineBaseline(capLine)
        val capShift = (besideBaseline - capLayout.firstBaseline).roundToInt()
        Column(Modifier.semantics(mergeDescendants = true) { contentDescription = text.text }) {
            Layout(
                content = {
                    Text(cap, style = capStyle)
                    BandText(first, bandAfterCap, style, p, Modifier)
                },
            ) { measurables, c ->
                val capPlaceable = measurables[0].measure(Constraints())
                val textWidth = (c.maxWidth - capPlaceable.width - gap).coerceAtLeast(0)
                val textPlaceable = measurables[1].measure(Constraints(maxWidth = textWidth))
                // A negative shift (cap baseline below the line's) moves the text down instead of the cap up.
                val top = minOf(0, capShift)
                val capY = capShift - top
                val textY = -top
                val capBaseline = capY + capLayout.firstBaseline.roundToInt()
                val height = maxOf(textY + textPlaceable.height, capBaseline)
                layout(c.maxWidth, height) {
                    capPlaceable.place(0, capY)
                    textPlaceable.place(capPlaceable.width + gap, textY)
                }
            }
            if (second.isNotEmpty()) {
                val offset = split + (body.length - split - second.length)
                val bandSecond = (bandAfterCap.first - offset).coerceAtLeast(0) until (bandAfterCap.last + 1 - offset).coerceAtLeast(0)
                BandText(second, bandSecond, style, p, Modifier.fillMaxWidth())
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// StageProgress (#33)
// ---------------------------------------------------------------------------------------------------------------

enum class StageStatus { Done, Current, Waiting }

@Immutable
data class Stage(val label: String, val status: StageStatus, val caption: String? = null)

/**
 * Generation stages (#33): a 12 dp ring per stage (done = accent fill with a check, current = accent ring and a
 * [LoadingHairline] under its label, waiting = `line2` ring), the label in `body` and an optional caption. A changed
 * label crossfades with an 8 dp rise (Base, the motion kit's text swap). A stage that completes after first paint
 * fills its ring and draws its check on (`Base`, `EaseCalm`); the last stage completing gives the one reward pulse
 * (3 #33). Final on first paint and static under reduced motion.
 */
@Composable
fun StageProgress(stages: List<Stage>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        stages.forEachIndexed { index, stage -> StageLine(stage, isLastStage = index == stages.lastIndex) }
    }
}

@Composable
private fun StageLine(stage: Stage, isLastStage: Boolean) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val risePx = with(LocalDensity.current) { ThesisMotion.EnterOffset.roundToPx() }
    val statusWord = when (stage.status) {
        StageStatus.Done -> "done"
        StageStatus.Current -> "in progress"
        StageStatus.Waiting -> "waiting"
    }
    Row(
        Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = listOfNotNull(stage.label, stage.caption, statusWord).joinToString(", ")
            },
    ) {
        Box(Modifier.height(ThesisSpace.l * 1.5f), contentAlignment = Alignment.Center) {
            StageRing(stage.status, isLastStage)
        }
        Spacer(Modifier.width(ThesisSpace.m))
        Column(Modifier.weight(1f)) {
            AnimatedContent(
                targetState = stage.label,
                transitionSpec = { ThesisTransitions.textSwap(reduced, risePx) },
                label = "stage",
            ) { label ->
                Text(
                    label,
                    style = ThesisType.body,
                    color = if (stage.status == StageStatus.Waiting) p.ink2 else p.ink,
                )
            }
            if (stage.status == StageStatus.Current) {
                LoadingHairline(active = true, modifier = Modifier.padding(vertical = ThesisSpace.xxs))
            }
            if (stage.caption != null) Text(stage.caption, style = ThesisType.caption, color = p.muted)
        }
    }
}

@Composable
private fun StageRing(status: StageStatus, isLastStage: Boolean) {
    val p = LocalThesisPalette.current
    // 0..1: the fill grows and the check draws on when the stage completes after first paint (final otherwise).
    val drawn = rememberDrawOn(status == StageStatus.Done)
    Box(
        Modifier
            .size(Kit.stageRing)
            .rewardPulse(trigger = status, enabled = isLastStage && status == StageStatus.Done)
            .drawWithCache {
                val stroke = Kit.ringStroke.toPx()
                val r = size.minDimension / 2f
                val check = Path().apply {
                    moveTo(size.width * 0.27f, size.height * 0.52f)
                    lineTo(size.width * 0.44f, size.height * 0.68f)
                    lineTo(size.width * 0.74f, size.height * 0.34f)
                }
                val measure = PathMeasure().apply { setPath(check, false) }
                val part = Path()
                onDrawBehind {
                    when (status) {
                        StageStatus.Done -> {
                            val t = drawn.value
                            if (t < 1f) drawCircle(p.accent, r - stroke / 2f, style = Stroke(stroke))
                            drawCircle(p.accent, r * t)
                            part.reset()
                            measure.getSegment(0f, measure.length * t, part, true)
                            drawPath(part, p.surface, style = Stroke(stroke, cap = StrokeCap.Round))
                        }
                        StageStatus.Current -> drawCircle(p.accent, r - stroke / 2f, style = Stroke(stroke))
                        StageStatus.Waiting -> drawCircle(p.line2, r - stroke / 2f, style = Stroke(stroke))
                    }
                }
            },
    )
}

// ---------------------------------------------------------------------------------------------------------------
// TapeRow (#50)
// ---------------------------------------------------------------------------------------------------------------

/** One tape item: "S&P 500 5,948.71 +0.4%" (all strings already formatted). */
@Immutable
data class TapeItem(val name: String, val level: String, val change: String, val tone: Tone)

/**
 * The market tape (#50): a 44 dp horizontally scrolling row; a leading [caption] ("Pre-market tape · as of
 * 06:15"), then items (`tape` style: name ink2, level ink, change in Tone) 16 dp apart. A refreshed item crossfades
 * (Base); no roll, no wash, no dot. [onClick] opens Pulse at the Markets chapter.
 */
@Composable
fun TapeRow(
    items: List<TapeItem>,
    modifier: Modifier = Modifier,
    caption: String? = null,
    onClick: (() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val source = remember { MutableInteractionSource() }
    val spoken = (listOfNotNull(caption) + items.map { "${it.name} ${it.level}, ${it.change}" }).joinToString("; ")
    LazyRow(
        modifier
            .fillMaxWidth()
            // 44 dp tape; a tappable tape keeps the 48 dp target (A1).
            .heightIn(min = if (onClick != null) maxOf(ThesisSpace.tapeRow, ThesisSpace.touchMin) else ThesisSpace.tapeRow)
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(source, indication = null, role = Role.Button, onClickLabel = "Open markets", onClick = onClick)
                        .thesisPress(source)
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) { contentDescription = spoken },
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l),
        verticalAlignment = Alignment.CenterVertically,
        contentPadding = PaddingValues(horizontal = ThesisSpace.gutter),
    ) {
        if (caption != null) {
            item(key = "caption") { Text(caption, style = ThesisType.caption, color = p.muted, maxLines = 1) }
        }
        itemsIndexed(items, key = { _, it -> it.name }) { _, item ->
            AnimatedContent(
                targetState = item,
                transitionSpec = {
                    fadeIn(ThesisMotion.timed(reduced, ThesisMotion.Base)) togetherWith
                        fadeOut(ThesisMotion.timed(reduced, ThesisMotion.Quick))
                },
                label = "tape",
            ) { it ->
                Text(
                    buildAnnotatedString {
                        withStyle(ThesisType.tape.toSpanStyle().copy(color = p.ink2)) { append(it.name) }
                        append(' ')
                        withStyle(ThesisType.tape.toSpanStyle().copy(color = p.ink)) { append(it.level) }
                        append(' ')
                        withStyle(ThesisType.tape.toSpanStyle().copy(color = it.tone.textColor(p))) { append(it.change) }
                    },
                    style = ThesisType.tape,
                    maxLines = 1,
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// SinceLastReport (#51)
// ---------------------------------------------------------------------------------------------------------------

/** One top change: [title], its [direction] (up, down or null for neither) with a text [directionLabel]. */
@Immutable
data class ReportChange(
    val title: String,
    val directionLabel: String,
    val up: Boolean? = null,
    val tone: Tone = Tone.Neutral,
    val whyItMatters: String? = null,
)

@Immutable
data class SinceLastReportModel(
    val previousView: String,
    val previousFiling: String,
    val currentView: String,
    val currentFiling: String,
    val changes: List<ReportChange> = emptyList(),
    val drift: BadgeSpec? = null,
)

/**
 * "Since the last report" (#51): the previous view (ink2) above the current one (ink), each with its filing and
 * date; up to three changes (title, ▲/▼ icon plus text, then why it matters, wrapping rather than cut); the
 * thesis-drift badge. With
 * a null [model] (first report) it shows the caption "The comparison appears after the next filing".
 */
@Composable
fun SinceLastReport(
    model: SinceLastReportModel?,
    modifier: Modifier = Modifier,
    onChangeClick: ((Int) -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // The kicker colour, as the SectionHeader kickers around it on Name and in a Deep Dive.
            Eyebrow("Since the last report", Modifier.weight(1f), color = p.accent)
            model?.drift?.let { StatusBadge(it.text, it.tone) }
        }
        if (model == null) {
            Text("The comparison appears after the next filing.", style = ThesisType.caption, color = p.muted)
            return@Column
        }
        ViewLine(model.previousFiling, model.previousView, p.ink2)
        Icon(
            ThesisIcons.Small.Down,
            contentDescription = "then",
            modifier = Modifier.size(ThesisSpace.iconS),
            tint = p.muted,
        )
        ViewLine(model.currentFiling, model.currentView, p.ink)
        if (model.changes.isNotEmpty()) {
            RowGroup(Modifier.padding(top = ThesisSpace.xs)) {
                model.changes.take(MAX_CHANGES).forEachIndexed { i, change ->
                    row { ChangeRow(change, onChangeClick?.let { { it(i) } }) }
                }
            }
        }
    }
}

private const val MAX_CHANGES = 3

@Composable
private fun ViewLine(filing: String, view: String, color: Color) {
    val p = LocalThesisPalette.current
    Column(Modifier.semantics(mergeDescendants = true) { }) {
        Text(filing, style = ThesisType.caption, color = p.muted)
        Text(view, style = ThesisType.body, color = color)
    }
}

@Composable
private fun ChangeRow(change: ReportChange, onClick: (() -> Unit)?) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Column(
        Modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(source, indication = null, role = Role.Button, onClick = onClick)
                        .thesisPress(source)
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) { }
            .heightIn(min = ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(change.title, style = ThesisType.rowTitle, color = p.ink)
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (change.up != null) {
                Icon(
                    if (change.up) ThesisIcons.Small.Up else ThesisIcons.Small.Down,
                    contentDescription = null,
                    modifier = Modifier.size(ThesisSpace.iconS),
                    tint = change.tone.textColor(p),
                )
                Spacer(Modifier.width(ThesisSpace.xxs))
            }
            Text(change.directionLabel, style = ThesisType.caption, color = change.tone.textColor(p))
        }
        // Its own line, whole: a sentence cut at the row edge loses its meaning (rubric A4, 360 dp and 2.0x).
        if (change.whyItMatters != null) {
            Text(change.whyItMatters, style = ThesisType.caption, color = p.ink2)
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// ChartReadout (#49)
// ---------------------------------------------------------------------------------------------------------------

/**
 * A chart card's header line (#49): [value] (`statValue`), the [date] caption and the [change] from the window start
 * in its Tone. While [scrubbing] the chart rewrites these in place; releasing crossfades back to "now".
 */
@Composable
fun ChartReadout(
    value: String,
    date: String,
    modifier: Modifier = Modifier,
    change: String? = null,
    changeTone: Tone = Tone.Neutral,
    scrubbing: Boolean = false,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = scrubbing,
        modifier = modifier.semantics(mergeDescendants = true) { },
        transitionSpec = {
            fadeIn(ThesisMotion.timed(reduced, ThesisMotion.Quick)) togetherWith fadeOut(ThesisMotion.timed(reduced, ThesisMotion.Quick))
        },
        label = "readout",
    ) { _ ->
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Text(value, style = ThesisType.statValue, color = p.ink)
            if (change != null) Text(change, style = ThesisType.caption.tnumStyle(), color = changeTone.textColor(p))
            Text(date, style = ThesisType.caption, color = p.muted)
        }
    }
}

private fun TextStyle.tnumStyle(): TextStyle = copy(fontFeatureSettings = "tnum")

/** Draws the scrub cursor (#49): a 1 dp `ink2` vertical line at [x] and a 4 dp dot at ([x], [y]). Chart kit helper. */
fun DrawScope.drawReadoutCursor(x: Float, y: Float, p: ThesisPalette) {
    drawLine(p.ink2, Offset(x, 0f), Offset(x, size.height), strokeWidth = ThesisSpace.border.toPx())
    drawCircle(p.surface, radius = Kit.readoutDot.toPx() / 2f + ThesisSpace.border.toPx(), center = Offset(x, y))
    drawCircle(p.ink, radius = Kit.readoutDot.toPx() / 2f, center = Offset(x, y))
}
