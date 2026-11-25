package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.StageProgress
import com.thesis.mobile.ui.components.ThesisDivider
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.screens.report.GenerationPhase
import com.thesis.mobile.ui.screens.report.GenerationStages
import com.thesis.mobile.ui.screens.report.PAGE_PROGRESS_UNKNOWN
import com.thesis.mobile.ui.screens.report.ReportHostFrame
import com.thesis.mobile.ui.screens.report.ReportOpeningBar
import com.thesis.mobile.ui.screens.report.ReportPageSkeleton
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/**
 * What shows before a report is on screen (docs/app-redesign/DESIGN-DIRECTION.md 5.13 and 5.14).
 *
 * Opening a stored report ([building] false): the report's own skeleton, hero first, so the page or the classic
 * view crossfades in without a jump. With [reportBar] the skeleton sits under the report's own bar
 * ([ReportHostFrame]: THESIS, the ticker, on `surface`), the same chrome the host draws next, so the open has one
 * bar throughout; the shell then shows no bar of its own for the entry (HANDOFF-C, WP-INT 6). Without it the hero
 * runs under the shell's back bar.
 *
 * Building one ([building] true): the generation screen. A HeroBand under the top bar ("Deep Dive · AAPL",
 * "Building the report"; "The report is ready" and "The build stopped" once it ends, so the heading never
 * contradicts the state), then [StageProgress] driven by [jobStatus] alone (the server's queued, running, complete,
 * failed; see [GenerationStages]), with no timers and no invented sub-steps. Below it the 13 chapters the report
 * will hold, so the wait teaches the structure. "You can leave this screen" shows only while the build is queued
 * or running. When the job completes the last ring fills with the kit's reward pulse and a confirm haptic; the
 * caller then crossfades into the report. A failed job shows [ErrorState] with [onRetry].
 *
 * [padding] is the shell's padding for the entry: the band runs under the status bar and the back bar (its top
 * padding), and the rest keeps clear of the system bars. Null (a render on its own) leaves no room for bars.
 */
@Composable
fun DeepDiveLoadingScreen(
    modifier: Modifier = Modifier,
    padding: PaddingValues? = null,
    building: Boolean = false,
    ticker: String? = null,
    jobStatus: String? = null,
    onRetry: (() -> Unit)? = null,
    retryLabel: String? = null,
    reportBar: ReportOpeningBar? = null,
) {
    val p = LocalThesisPalette.current
    if (!building && reportBar != null) {
        ReportHostFrame(
            ticker = reportBar.ticker,
            padding = padding ?: PaddingValues(),
            onBack = reportBar.onBack,
            following = reportBar.following,
            onFollowChange = reportBar.onFollowChange,
            onOverflow = reportBar.onOverflow,
            pageLoaded = false,
            progress = PAGE_PROGRESS_UNKNOWN,
            dockItems = emptyList(),
            dockVisible = false,
            modifier = modifier,
        ) { }
        return
    }
    val topInset = padding?.calculateTopPadding()
    if (padding != null) HeroUnderBars()
    Box(
        modifier
            .fillMaxSize()
            .background(p.bg)
            .then(if (padding != null) Modifier.padding(padding.exceptTop()) else Modifier),
    ) {
        if (building) {
            GenerationContent(topInset = topInset, ticker = ticker, jobStatus = jobStatus, onRetry = onRetry, retryLabel = retryLabel)
        } else {
            ShimmerHost {
                ReportPageSkeleton(Modifier.fillMaxSize(), heroTop = topInset)
            }
        }
    }
}

@Composable
private fun GenerationContent(
    topInset: Dp?,
    ticker: String?,
    jobStatus: String?,
    onRetry: (() -> Unit)?,
    retryLabel: String?,
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    val phase = GenerationStages.phaseOf(jobStatus)

    // The stage a failed build reached, and the confirm haptic once when the build completes (not on a screen that
    // opens on a finished job).
    var reached by remember { mutableStateOf(phase.takeIf { it != GenerationPhase.Failed } ?: GenerationPhase.Building) }
    var previous by remember { mutableStateOf(phase) }
    LaunchedEffect(phase) {
        if (phase != GenerationPhase.Failed) reached = phase
        if (phase == GenerationPhase.Ready && previous != GenerationPhase.Ready) haptics.confirm()
        previous = phase
    }

    val symbol = ticker?.trim()?.uppercase()?.ifBlank { null }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        HeroBand(
            contentPadding = PaddingValues(
                start = ThesisSpace.gutter,
                end = ThesisSpace.gutter,
                top = (topInset ?: ThesisSpace.headerTop) + ThesisSpace.x4,
                bottom = ThesisSpace.x3,
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        ) {
            val hero = LocalThesisPalette.current
            Eyebrow(if (symbol != null) ReportCopy.buildingEyebrow(symbol) else ReportCopy.EXPORT_REPORT_TITLE)
            Text(
                when (phase) {
                    GenerationPhase.Queued, GenerationPhase.Building -> ReportCopy.BUILDING_TITLE
                    GenerationPhase.Ready -> ReportCopy.READY_TITLE
                    GenerationPhase.Failed -> ReportCopy.STOPPED_TITLE
                },
                modifier = Modifier.semantics { heading() },
                style = ThesisType.title,
                color = hero.ink,
            )
            Text(ReportCopy.BUILDING_LEDE, style = ThesisType.lede, color = hero.ink2)
        }

        Column(
            Modifier
                .fillMaxWidth()
                .widthIn(max = ThesisSpace.contentMaxWidth)
                .align(Alignment.CenterHorizontally)
                .padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.xxl),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
        ) {
            if (phase == GenerationPhase.Failed) {
                ErrorState(
                    title = ReportCopy.buildFailedTitle(symbol),
                    cause = ReportCopy.BUILD_FAILED_CAUSE,
                    retryLabel = retryLabel ?: ReportCopy.TRY_AGAIN,
                    onRetry = onRetry,
                )
            } else {
                StageProgress(GenerationStages.stagesFor(phase, reached))
                if (phase == GenerationPhase.Queued || phase == GenerationPhase.Building) {
                    Text(ReportCopy.CAN_LEAVE, style = ThesisType.bodySmall, color = p.muted)
                }
            }
        }

        ChapterList(
            Modifier
                .fillMaxWidth()
                .widthIn(max = ThesisSpace.contentMaxWidth)
                .align(Alignment.CenterHorizontally)
                .padding(start = ThesisSpace.gutter, end = ThesisSpace.gutter, top = ThesisSpace.s, bottom = ThesisSpace.x5),
        )
    }
}

/** "What this report will contain": the 13 chapter names, muted, numbered as the page's chapter kickers. */
@Composable
private fun ChapterList(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Column(modifier) {
        SectionHeader(kicker = ReportCopy.CONTENTS_KICKER, headline = ReportCopy.CONTENTS_HEADLINE)
        Column(Modifier.padding(top = ThesisSpace.l)) {
            ReportCopy.chapters.forEachIndexed { index, name ->
                val number = (index + 1).toString().padStart(2, '0')
                if (index > 0) ThesisDivider()
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = ThesisSpace.m)
                        .clearAndSetSemantics { contentDescription = ReportCopy.chapterRow(index + 1, name) },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m),
                ) {
                    Text(
                        number,
                        modifier = Modifier.widthIn(min = ThesisSpace.leadingColumn),
                        style = ThesisType.heroLine,
                        // Text under 24 sp: muted (at least 4.5:1 on bg and bg2), never the control boundary token.
                        color = p.muted,
                    )
                    Text(name, style = ThesisType.body, color = p.muted)
                }
            }
        }
    }
}
