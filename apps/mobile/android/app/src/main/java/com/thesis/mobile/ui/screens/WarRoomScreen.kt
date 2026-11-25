package com.thesis.mobile.ui.screens

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.model.WarRoomPhaseView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.LiveDot
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone

/*
 * War Room (DESIGN-DIRECTION 5.19): an earnings event read in three steps. Header on paper (a utility screen opened
 * often, so no hero band): eyebrow "Earnings · AAPL", the event title, a Pre-open · Live · After close stepper with
 * the live mark on Live only, "Updated 12 min ago", the summary as a lede. Phases follow as collapsible cards (the
 * current one open), each with its status badge in a wrapping row, a relative time and its highlights as plain
 * paragraphs. Related names are chips into Name; "Open the Deep Dive" opens the report the room reads against.
 * Room and report ids, routes and the grey/gold/green phase colours are gone.
 */

/** The three steps of an earnings room, in order. */
internal enum class WarRoomStep { Pre, Live, Post }

/** A phase word from the server ("pre", "pre_open", "live", "post", "after_close") as a step; null when unknown. */
internal fun warRoomStepOf(raw: String?): WarRoomStep? =
    when (raw?.trim()?.lowercase()?.replace('-', '_')?.replace(' ', '_')) {
        "pre", "pre_open", "preopen", "preparing", "ready" -> WarRoomStep.Pre
        "live" -> WarRoomStep.Live
        "post", "after_close", "post_close", "closed" -> WarRoomStep.Post
        else -> null
    }

/**
 * The room's current step: the room state when it names one ("preparing"/"ready" → Pre, "live" → Live,
 * "post"/"closed" → Post), else the furthest phase written so far; null when nothing says.
 */
internal fun warRoomCurrentStep(room: WarRoomView): WarRoomStep? =
    warRoomStepOf(room.status) ?: room.phases.mapNotNull { warRoomStepOf(it.phase) }.maxOrNull()

/** True when the room is in its Live step (the only time the live mark shows and pull-to-refresh is off). */
internal fun warRoomIsLive(room: WarRoomView): Boolean =
    room.status?.trim()?.lowercase() == "live"

/** True once the room has closed: every step is done. */
internal fun warRoomClosed(room: WarRoomView): Boolean =
    room.status?.trim()?.lowercase() == "closed"

/** Phases with something written: every phase whose status is not a scheduled/pending word. */
internal fun phasesWritten(phases: List<WarRoomPhaseView>): Int =
    phases.count { phaseBadge(it.status)?.text != ResearchCopy.PHASE_SCHEDULED }

/** Phases in step order (unknown phases last, in server order). */
internal fun warRoomPhasesInOrder(room: WarRoomView): List<WarRoomPhaseView> =
    room.phases.withIndex()
        .sortedWith(compareBy({ warRoomStepOf(it.value.phase)?.ordinal ?: Int.MAX_VALUE }, { it.index }))
        .map { it.value }

/** A phase status word as a badge: text and tone. Null when the phase carries none. */
@Immutable
internal data class PhaseBadge(val text: String, val tone: Tone)

internal fun phaseBadge(status: String?): PhaseBadge? {
    val key = status?.trim()?.lowercase()?.replace('-', '_')?.replace(' ', '_')?.ifBlank { null } ?: return null
    return when (key) {
        "complete", "completed", "done", "closed", "success" -> PhaseBadge(ResearchCopy.PHASE_COMPLETE, Tone.Neutral)
        // A status, not a figure: no up/down colour (T3); the live mark beside "Live" says it is live.
        "live", "in_progress", "running", "active" -> PhaseBadge(ResearchCopy.PHASE_IN_PROGRESS, Tone.Neutral)
        "pending", "scheduled", "queued", "upcoming", "preparing" -> PhaseBadge(ResearchCopy.PHASE_SCHEDULED, Tone.Unknown)
        "degraded", "timeout" -> PhaseBadge(ResearchCopy.humanize(key) ?: key, Tone.Attention)
        "failed", "failure" -> PhaseBadge(ResearchCopy.humanize(key) ?: key, Tone.Unfavourable)
        else -> PhaseBadge(ResearchCopy.humanize(key) ?: key, Tone.Unknown)
    }
}

private fun stepLabel(step: WarRoomStep): String = when (step) {
    WarRoomStep.Pre -> ResearchCopy.STEP_PRE
    WarRoomStep.Live -> ResearchCopy.STEP_LIVE
    WarRoomStep.Post -> ResearchCopy.STEP_POST
}

/**
 * The War Room. Draws its own top bar ("War Room", subtitle the ticker); the shell gives it none (HANDOFF-E).
 * Pull-to-refresh is on except while Live, when the shell refreshes every 60 s. A failed refresh keeps the room on
 * screen under a banner. [onOpenName] opens a related ticker's Name page and [onOpenReport] the Deep Dive the room
 * reads against. With [onBack] null (the shell's own bar still showing, until WP-INT wires it) there is no back
 * arrow, so no arrow that does nothing.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WarRoomScreen(
    warRoom: WarRoomView?,
    errorMessage: String?,
    onRefresh: () -> Unit,
    padding: PaddingValues,
    onBack: (() -> Unit)? = null,
    isLoading: Boolean = false,
    refreshing: Boolean = false,
    onOpenName: (ticker: String) -> Unit = {},
    onOpenReport: ((reportId: String) -> Unit)? = null,
) {
    val fmt = LocalFmt.current
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    val live = warRoom != null && warRoomIsLive(warRoom)

    ResearchBarPage(
        title = ResearchCopy.WAR_ROOM_TITLE,
        subtitle = warRoom?.ticker?.ifBlank { null },
        titleAlwaysVisible = true,
        onBack = onBack,
        padding = padding,
        collapsed = collapsed,
    ) { inner ->
        ThesisRefreshBox(
            refreshing = refreshing,
            onRefresh = onRefresh,
            enabled = warRoom != null && !live,
            modifier = Modifier.padding(top = inner.calculateTopPadding()),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll)
                    .researchWidth(data = false)
                    .padding(top = ThesisSpace.headerTop, bottom = inner.calculateBottomPadding())
                    .padding(horizontal = ThesisSpace.gutter),
            ) {
                when {
                    warRoom == null && (isLoading || (refreshing && errorMessage == null)) -> WarRoomSkeleton()
                    warRoom == null && !errorMessage.isNullOrBlank() -> {
                        ScreenHeader(title = ResearchCopy.WAR_ROOM_TITLE, eyebrow = ResearchCopy.warRoomEyebrow(null))
                        Spacer(Modifier.height(ThesisSpace.headerToSection))
                        ErrorState(
                            title = KitCopy.couldNotLoad(ResearchCopy.WAR_ROOM_FAILED),
                            cause = errorMessage,
                            onRetry = onRefresh,
                        )
                    }
                    warRoom == null -> {
                        ScreenHeader(title = ResearchCopy.WAR_ROOM_TITLE, eyebrow = ResearchCopy.warRoomEyebrow(null))
                        Spacer(Modifier.height(ThesisSpace.headerToSection))
                        EmptyState(
                            sentence = ResearchCopy.WAR_ROOM_EMPTY,
                            how = ResearchCopy.WAR_ROOM_EMPTY_HOW,
                            icon = ThesisIcons.WarRoom,
                        )
                    }
                    else -> WarRoomBody(
                        room = warRoom,
                        refreshError = errorMessage?.ifBlank { null },
                        onRetry = onRefresh,
                        onOpenName = onOpenName,
                        onOpenReport = onOpenReport,
                        fmt = fmt,
                    )
                }
            }
        }
    }
}

@Composable
private fun WarRoomSkeleton() {
    ScreenHeader(title = ResearchCopy.WAR_ROOM_TITLE, eyebrow = ResearchCopy.warRoomEyebrow(null), refreshing = true)
    Spacer(Modifier.height(ThesisSpace.l))
    SkeletonRow()
    Spacer(Modifier.height(ThesisSpace.headerToSection))
    SkeletonCard(bodyLines = 4)
    Spacer(Modifier.height(ThesisSpace.cardGap))
    SkeletonCard(bodyLines = 2)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WarRoomBody(
    room: WarRoomView,
    refreshError: String?,
    onRetry: () -> Unit,
    onOpenName: (String) -> Unit,
    onOpenReport: ((String) -> Unit)?,
    fmt: Fmt,
) {
    val p = LocalThesisPalette.current
    val current = warRoomCurrentStep(room)
    val closed = warRoomClosed(room)
    val live = warRoomIsLive(room)
    val phases = warRoomPhasesInOrder(room)
    // Which phase cards are open: the current step's by default; the reader's taps override it.
    val open = remember(room.warRoomId) { mutableStateMapOf<Int, Boolean>() }

    ScreenHeader(
        eyebrow = ResearchCopy.warRoomEyebrow(room.ticker),
        title = room.title?.ifBlank { null } ?: ResearchCopy.WAR_ROOM_FALLBACK_TITLE,
    )
    Spacer(Modifier.height(ThesisSpace.l))
    PhaseStepper(current = current, closed = closed, live = live)
    parseInstant(room.generatedAt)?.let { at ->
        Spacer(Modifier.height(ThesisSpace.m))
        Text(ResearchCopy.updated(fmt.relative(at)), style = ThesisType.caption, color = p.muted)
    }
    if (refreshError != null) {
        Spacer(Modifier.height(ThesisSpace.m))
        InlineBanner(
            text = ResearchCopy.WAR_ROOM_REFRESH_FAILED,
            tone = BannerTone.Attention,
            actionLabel = KitCopy.TRY_AGAIN,
            onAction = onRetry,
        )
    }
    room.summary?.ifBlank { null }?.let { summary ->
        Spacer(Modifier.height(ThesisSpace.l))
        Text(summary, style = ThesisType.lede, color = p.ink)
    }

    Spacer(Modifier.height(ThesisSpace.sectionGapReading))
    SectionHeader(
        kicker = ResearchCopy.PHASES_KICKER,
        headline = ResearchCopy.phasesHeadline(phasesWritten(phases), closed),
    )
    Spacer(Modifier.height(ThesisSpace.m))
    if (phases.isEmpty()) {
        Text(ResearchCopy.PHASES_EMPTY, style = ThesisType.body, color = p.ink2)
    }
    phases.forEachIndexed { index, phase ->
        if (index > 0) Spacer(Modifier.height(ThesisSpace.cardGap))
        val step = warRoomStepOf(phase.phase)
        val isCurrent = step != null && step == current
        val defaultOpen = isCurrent || (current == null && index == phases.lastIndex)
        val expanded = open[index] ?: defaultOpen
        PhaseCard(
            phase = phase,
            step = step,
            expanded = expanded,
            // No haptic: toggle() is for follow and notification switches (4.7); opening a card is a plain tap.
            onToggle = { open[index] = !expanded },
            fmt = fmt,
        )
    }

    val related = room.relatedTickers.filter { it.isNotBlank() }.distinct()
    if (related.isNotEmpty()) {
        Spacer(Modifier.height(ThesisSpace.sectionGapReading))
        SectionHeader(kicker = ResearchCopy.RELATED_KICKER, headline = ResearchCopy.relatedHeadline(related.size))
        Spacer(Modifier.height(ThesisSpace.m))
        ChipRow(contentPadding = PaddingValues()) {
            related.forEach { ticker ->
                item(key = ticker) {
                    ThesisChip(label = ticker, selected = false, onClick = { onOpenName(ticker) }, role = Role.Button)
                }
            }
        }
    }

    val reportId = phases.lastOrNull { !it.reportId.isNullOrBlank() }?.reportId
    if (reportId != null && onOpenReport != null) {
        Spacer(Modifier.height(ThesisSpace.l))
        ActionRow(
            icon = ThesisIcons.DeepDive,
            title = ResearchCopy.OPEN_DEEP_DIVE,
            caption = ResearchCopy.OPEN_DEEP_DIVE_CAPTION,
            onClick = { onOpenReport(reportId) },
        )
    }
}

/**
 * Horizontal three-step stepper: a ring per step on a `line2` rail, the label under it. The current step in `ink`
 * (filled ring and label, 5.19), done steps as muted filled rings, upcoming as `line2` rings; done and upcoming
 * labels muted. No phase colours. The live mark sits beside "Live" only while the room is live. One TalkBack stop
 * per step with its state.
 * (The kit Timeline is vertical only; a horizontal variant is requested from WP-K in HANDOFF-E.)
 */
@Composable
private fun PhaseStepper(current: WarRoomStep?, closed: Boolean, live: Boolean) {
    val p = LocalThesisPalette.current
    val steps = WarRoomStep.entries
    val ring = ThesisSpace.m
    val border = ThesisSpace.xxs
    Row(Modifier.fillMaxWidth()) {
        steps.forEachIndexed { index, step ->
            val done = closed || (current != null && step < current)
            val isCurrent = !closed && step == current
            val state = when {
                isCurrent -> ResearchCopy.STEP_STATE_CURRENT
                done -> ResearchCopy.STEP_STATE_DONE
                else -> ResearchCopy.STEP_STATE_UPCOMING
            }
            val first = index == 0
            val last = index == steps.lastIndex
            Column(
                Modifier
                    .weight(1f)
                    .semantics(mergeDescendants = true) { stateDescription = state },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(ring)
                        .drawBehind {
                            val cy = size.height / 2f
                            val cx = size.width / 2f
                            val r = ring.toPx() / 2f
                            val rail = border.toPx()
                            if (!first) drawLine(p.line2, Offset(0f, cy), Offset(cx - r, cy), rail)
                            if (!last) drawLine(p.line2, Offset(cx + r, cy), Offset(size.width, cy), rail)
                            val mark = when {
                                isCurrent -> p.ink
                                done -> p.muted
                                else -> p.line2
                            }
                            drawCircle(p.surface, r, Offset(cx, cy))
                            drawCircle(mark, r - rail / 2f, Offset(cx, cy), style = Stroke(rail))
                            if (isCurrent || done) drawCircle(mark, r / 2f, Offset(cx, cy))
                        },
                )
                Spacer(Modifier.height(ThesisSpace.s))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (step == WarRoomStep.Live && live) {
                        LiveDot()
                        Spacer(Modifier.width(ThesisSpace.xs))
                    }
                    Text(
                        stepLabel(step),
                        style = ThesisType.caption,
                        color = if (isCurrent) p.ink else p.muted,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

/**
 * One phase: a card whose header (step and time as a muted caption, the phase title, a Show/Hide word) toggles it;
 * open, it shows the status badge in a wrapping row, the summary and each highlight as its own paragraph.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PhaseCard(
    phase: WarRoomPhaseView,
    step: WarRoomStep?,
    expanded: Boolean,
    onToggle: () -> Unit,
    fmt: Fmt,
) {
    val p = LocalThesisPalette.current
    val interaction = remember { MutableInteractionSource() }
    val stepWord = step?.let(::stepLabel) ?: ResearchCopy.humanize(phase.phase)
    val at = parseInstant(phase.updatedAt)?.let(fmt::relative)
    val eyebrow = listOfNotNull(stepWord, at).joinToString(" · ")
    val badge = phaseBadge(phase.status)
    ThesisCard {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = ThesisSpace.touchMin)
                .thesisPress(interaction)
                .toggleable(
                    value = expanded,
                    interactionSource = interaction,
                    indication = null,
                    role = Role.Button,
                    onValueChange = { onToggle() },
                )
                .semantics(mergeDescendants = true) {
                    stateDescription = if (expanded) ResearchCopy.EXPANDED else ResearchCopy.COLLAPSED
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                if (eyebrow.isNotBlank()) {
                    // Sentence case and a relative time: a caption, not the letter-spaced eyebrow.
                    Text(eyebrow, style = ThesisType.caption, color = p.muted)
                    Spacer(Modifier.height(ThesisSpace.xs))
                }
                Text(
                    phase.title.ifBlank { stepWord ?: ResearchCopy.WAR_ROOM_FALLBACK_TITLE },
                    style = ThesisType.cardTitle,
                    color = p.ink,
                    modifier = Modifier.semantics { heading() },
                )
            }
            Spacer(Modifier.width(ThesisSpace.m))
            Text(
                if (expanded) ResearchCopy.HIDE else ResearchCopy.SHOW,
                style = ThesisType.caption,
                color = p.accent,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
        if (expanded) {
            if (badge != null) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                    verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                ) {
                    StatusBadge(badge.text, badge.tone)
                }
            }
            phase.summary.ifBlank { null }?.let { Text(it, style = ThesisType.story, color = p.ink) }
            phase.highlights.filter { it.isNotBlank() }.forEach { highlight ->
                Text(highlight, style = ThesisType.story, color = p.ink2)
            }
        }
    }
}
