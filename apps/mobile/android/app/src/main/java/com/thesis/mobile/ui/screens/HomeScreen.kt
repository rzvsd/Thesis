package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.animations.AnimatedCounter
import com.thesis.mobile.ui.animations.RevealAnimation
import com.thesis.mobile.ui.animations.StaggeredEntrance
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.copy.StateCopy
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun HomeScreen(
    pulse: PulseReportView?,
    pulseLoadedFromCache: Boolean,
    pulseFreshnessText: String?,
    sentimentCurrent: SentimentSnapshotView?,
    sentimentHistory: List<SentimentSnapshotView>,
    sentimentError: String?,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    morningBriefing: AlertLedgerItemView? = null,
    padding: PaddingValues,
    lastViewedReport: LastViewedReport? = null,
    pulseError: String? = null,
    onOpenHistory: () -> Unit,
    onRunDeepDive: (String) -> Unit,
    onManageNames: () -> Unit,
    onRetryPulse: () -> Unit,
    onOpenMacroStressDashboard: () -> Unit,
    onOpenWeeklyDigest: () -> Unit,
    onOpenPulseBrief: () -> Unit,
    onOpenMorningBriefing: (AlertLedgerItemView) -> Unit = {},
    onResumeLastViewed: ((LastViewedReport) -> Unit)? = null,
    onDismissResume: (() -> Unit)? = null
) {
    var showFullPulse by rememberSaveable { mutableStateOf(false) }
    val dateLabel = remember { LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMM d")) }
    val phase = remember { resolveTodayPhase() }
    val pulseSections = pulse?.sections.orEmpty()
    val visiblePulseSections = pulseSections.filterNot { isWatchlistOverlay(it) }
    val todayPlan = remember(phase, visiblePulseSections) {
        buildTodayPlan(phase, visiblePulseSections)
    }
    val pulseLead = derivePulseLead(pulse, phase)
    val pulseTimestamp = pulse?.generatedAt?.let(::formatTimestamp)
    val lastViewedTicker = lastViewedReport?.takeIf { it.type == "DEEP_DIVE" }?.label
    val insight = deriveInsight(pulse, watchlist, monitorSnapshots, lastViewedTicker)

    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRetryPulse()
            scope.launch {
                delay(1800L)
                isRefreshing = false
            }
        }
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .pullRefresh(pullRefreshState)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSection),
            contentPadding = PaddingValues(bottom = ThesisDimens.ScreenPaddingBottom)
        ) {
            item {
                StaggeredEntrance(index = 0, baseDelayMs = 50L) {
                    Spacer(modifier = Modifier.height(ThesisDimens.ScreenPaddingTop))
                    Column {
                        Text(
                            text = dateLabel.uppercase(),
                            style = ThesisTypography.labelSmall,
                            color = ThesisColors.TextMuted
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        Text(
                            text = phase.title,
                            style = ThesisTypography.displayLarge.copy(
                                fontFamily = HeadingFont,
                                fontWeight = FontWeight.Normal
                            ),
                            color = ThesisColors.TextPrimary
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
                        Text(
                            text = pulseLead,
                            style = ThesisTypography.bodyLarge,
                            color = ThesisColors.TextSecondary
                        )
                        if (!pulseTimestamp.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                            Text(
                                text = "Updated $pulseTimestamp",
                                style = ThesisTypography.labelSmall,
                                color = ThesisColors.TextMuted
                            )
                        }
                        if (!pulseFreshnessText.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                            Text(
                                text = pulseFreshnessText,
                                style = ThesisTypography.labelSmall,
                                color = if (pulseLoadedFromCache) ThesisColors.SignalWarning else ThesisColors.TextMuted
                            )
                        }
                    }
                }
            }

            item {
                StaggeredEntrance(index = 1) {
                    MacroStressSummaryCard(
                        current = sentimentCurrent,
                        history = sentimentHistory,
                        sentimentError = sentimentError,
                        onOpenDashboard = onOpenMacroStressDashboard,
                        onOpenWeeklyDigest = onOpenWeeklyDigest
                    )
                }
            }

            if (morningBriefing != null) {
                item {
                    StaggeredEntrance(index = 2) {
                        MorningBriefingCard(
                            alert = morningBriefing,
                            onOpen = { onOpenMorningBriefing(morningBriefing) }
                        )
                    }
                }
            }

            if (lastViewedReport != null && onResumeLastViewed != null && onDismissResume != null) {
                item {
                    StaggeredEntrance(index = 3) {
                        ResumeCard(
                            title = resumeTitle(lastViewedReport),
                            onResume = { onResumeLastViewed(lastViewedReport) },
                            onDismiss = onDismissResume
                        )
                    }
                }
            }

            when {
                pulse == null && !pulseError.isNullOrBlank() -> {
                    item {
                        if (pulseError.contains("No internet connection", ignoreCase = true)) {
                            ErrorState(
                                title = StateCopy.OFFLINE_TITLE,
                                cause = StateCopy.OFFLINE_CAUSE,
                                onRetry = onRetryPulse
                            )
                        } else {
                            ErrorState(title = StateCopy.pulseUnavailable, cause = pulseError, onRetry = onRetryPulse)
                        }
                    }
                }

                pulse == null && watchlist.isEmpty() -> {
                    item { NoNamesState(onAddName = onManageNames) }
                }

                pulse == null -> {
                    val fallbackTicker = lastViewedTicker ?: watchlist.firstOrNull()
                    item {
                        EmptyState(
                            sentence = StateCopy.NO_PULSE,
                            how = StateCopy.NO_PULSE_HOW,
                            icon = ThesisIcons.Pulse,
                            actionLabel = StateCopy.NO_PULSE_ACTION,
                            onAction = {
                                if (!fallbackTicker.isNullOrBlank()) {
                                    onRunDeepDive(fallbackTicker)
                                }
                            }
                        )
                    }
                }

                else -> {
                    item {
                        StaggeredEntrance(index = 4) {
                            WhatMovedSection(
                                subtitle = todayPlan.subtitle,
                                sections = todayPlan.prioritySections.take(4)
                            )
                        }
                    }
                }
            }

            item {
                StaggeredEntrance(index = 5) {
                    YourNamesSection(
                        watchlist = watchlist,
                        pulse = pulse,
                        monitorSnapshots = monitorSnapshots,
                        onManageNames = onManageNames,
                        onRunDeepDive = onRunDeepDive
                    )
                }
            }

            if (insight != null) {
                item {
                    StaggeredEntrance(index = 6) {
                        InsightAlertSection(insight = insight, onRunDeepDive = onRunDeepDive)
                    }
                }
            }

            if (showFullPulse && pulse != null) {
                item {
                    FullPulseSection(sections = pulseSections)
                }
            }

            item {
                StaggeredEntrance(index = 7) {
                    BottomLinksSection(
                        showFullPulse = showFullPulse,
                        onToggleFullPulse = { showFullPulse = !showFullPulse },
                        onOpenPulseBrief = onOpenPulseBrief,
                        onOpenHistory = onOpenHistory
                    )
                }
            }
        }

        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
            backgroundColor = ThesisColors.Surface,
            contentColor = ThesisColors.Primary
        )
    }
}

@Composable
private fun MorningBriefingCard(
    alert: AlertLedgerItemView,
    onOpen: () -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val mode = alert.briefingContext?.mode?.trim()?.lowercase()
    val exceptionsCount = alert.briefingContext?.count ?: 0
    val watchlistCount = alert.briefingContext?.watchlistCount ?: 0
    val leadTicker = alert.briefingContext?.leadTicker?.trim()?.uppercase()?.ifBlank { null }
    val related = alert.briefingContext
        ?.relatedTickers
        .orEmpty()
        .filter { it.isNotBlank() }
        .map { it.trim().uppercase() }
    val contextLine = when {
        mode == "no_change" && watchlistCount > 0 ->
            "Checked $watchlistCount name(s). No thesis-level exceptions were found."
        mode == "no_change" -> "No thesis-level exceptions were found in the latest cycle."
        !leadTicker.isNullOrBlank() && exceptionsCount > 1 ->
            "Lead name: $leadTicker. ${exceptionsCount - 1} more name(s) flagged."
        !leadTicker.isNullOrBlank() -> "Lead name: $leadTicker."
        exceptionsCount > 0 -> "$exceptionsCount name(s) need review."
        else -> null
    }
    val relatedLine = if (related.isNotEmpty()) {
        "Also flagged: ${related.joinToString(separator = ", ")}"
    } else {
        null
    }
    val actionLabel = if (mode == "no_change") {
        Phase4Copy.morningBriefingNoChangeAction
    } else {
        Phase4Copy.morningBriefingExceptionAction
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Primary.copy(alpha = 0.3f), shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.TrendingUp,
                contentDescription = null,
                tint = ThesisColors.Primary,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
            Text(
                text = Phase4Copy.morningBriefingEyebrow.uppercase(),
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary
            )
        }
        Text(
            text = alert.title,
            style = ThesisTypography.headlineLarge.copy(
                fontFamily = HeadingFont,
                fontWeight = FontWeight.Normal
            ),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = alert.body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
        if (!contextLine.isNullOrBlank()) {
            Text(
                text = contextLine,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
        if (!relatedLine.isNullOrBlank()) {
            Text(
                text = relatedLine,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
        Button(
            onClick = onOpen,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = ButtonDefaults.buttonColors(
                containerColor = ThesisColors.Primary,
                contentColor = ThesisColors.TextInverse
            )
        ) {
            Text(
                text = actionLabel,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
            )
        }
    }
}

@Composable
private fun MacroStressSummaryCard(
    current: SentimentSnapshotView?,
    history: List<SentimentSnapshotView>,
    sentimentError: String?,
    onOpenDashboard: () -> Unit,
    onOpenWeeklyDigest: () -> Unit
) {
    val macroStressLabel = formatMacroStressLabel(current?.label)
    val direction = if (sentimentError.isNullOrBlank()) {
        deriveMacroStressDirection(current, history)
    } else {
        null
    }
    val scoreValue = current?.score?.toInt()
    val marketDate = current?.marketDate

    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = Phase4Copy.todayMacroStressTitle,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                Text(
                    text = when {
                        !sentimentError.isNullOrBlank() -> "Temporarily unavailable"
                        marketDate.isNullOrBlank() -> "No macro snapshot yet"
                        else -> marketDate
                    },
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                Text(
                    text = Phase4Copy.todayMacroStressSourceNote,
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                RevealAnimation(delayMs = 200L) {
                    if (scoreValue != null) {
                        AnimatedCounter(
                            targetValue = scoreValue,
                            style = ThesisTypography.displayLarge.copy(
                                fontFamily = HeadingFont,
                                fontWeight = FontWeight.Normal
                            ),
                            color = ThesisColors.TextPrimary,
                            durationMs = 900,
                            delayMs = 100L
                        )
                    } else {
                        Text(
                            text = "--",
                            style = ThesisTypography.displayLarge.copy(
                                fontFamily = HeadingFont,
                                fontWeight = FontWeight.Normal
                            ),
                            color = ThesisColors.TextPrimary
                        )
                    }
                }
                Text(
                    text = macroStressLabel,
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = macroStressColor(current?.label)
                )
            }
        }

        if (!direction.isNullOrBlank()) {
            Text(
                text = direction,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
        if (!sentimentError.isNullOrBlank()) {
            Text(
                text = sentimentError,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.SignalWarning
            )
        }

        HorizontalDivider(color = ThesisColors.Border, thickness = ThesisDimens.BorderWidth)

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            Button(
                onClick = onOpenDashboard,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.Primary,
                    contentColor = ThesisColors.TextInverse
                )
            ) {
                Text(
                    text = Phase4Copy.todayMacroStressDashboardLabel,
                    style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                )
            }
            Button(
                onClick = onOpenWeeklyDigest,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.SurfaceElevated,
                    contentColor = ThesisColors.TextPrimary
                )
            ) {
                Text(
                    text = "Weekly Digest",
                    style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                )
            }
        }
    }
}

@Composable
private fun WhatMovedSection(
    subtitle: String,
    sections: List<SectionView>
) {
    Column {
        SectionHeader(title = "What Moved", subtitle = subtitle)
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))
        if (sections.isEmpty()) {
            PulseInfoCard(
                title = "Waiting on today's pulse",
                body = "The daily cycle has not produced output yet.",
                status = null
            )
            return
        }
        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            sections.forEach { section ->
                PulseInfoCard(
                    title = section.title,
                    body = summarizeBody(section.body),
                    status = section.status
                )
            }
        }
    }
}

@Composable
private fun YourNamesSection(
    watchlist: List<String>,
    pulse: PulseReportView?,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    onManageNames: () -> Unit,
    onRunDeepDive: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Text(
                text = "My Names",
                style = ThesisTypography.headlineLarge.copy(
                    fontFamily = HeadingFont,
                    fontWeight = FontWeight.Normal
                ),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = "MANAGE",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary,
                modifier = Modifier
                    .clickable { onManageNames() }
                    .padding(ThesisDimens.SpacingMd)
                    .semantics {
                        contentDescription = "Manage watchlist names"
                        role = Role.Button
                    }
            )
        }

        if (watchlist.isEmpty()) {
            NoNamesState(onAddName = onManageNames)
            return
        }

        val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
        ) {
            watchlist.take(5).forEachIndexed { index, ticker ->
                val context = describeWatchlistContext(ticker, pulse, monitorSnapshots)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onRunDeepDive(ticker) }
                        .padding(
                            horizontal = ThesisDimens.CardPadding,
                            vertical = ThesisDimens.SpacingLg
                        )
                        .semantics { contentDescription = "Open $ticker deep dive" },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .height(42.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(ThesisColors.Primary)
                    )
                    Spacer(modifier = Modifier.width(ThesisDimens.SpacingMd))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = ticker,
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                        Text(
                            text = context,
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextMuted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
                    Text(
                        text = "OPEN",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary
                    )
                }
                if (index < watchlist.take(5).lastIndex) {
                    HorizontalDivider(
                        color = ThesisColors.Border,
                        thickness = ThesisDimens.BorderWidth,
                        modifier = Modifier.padding(horizontal = ThesisDimens.CardPadding)
                    )
                }
            }
        }
    }
}

@Composable
private fun InsightAlertSection(
    insight: InsightCardModel,
    onRunDeepDive: (String) -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.SurfaceElevated)
            .border(ThesisDimens.BorderWidth, ThesisColors.Primary.copy(alpha = 0.45f), shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(2.dp)
                .background(ThesisColors.Primary)
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.Insights,
                contentDescription = null,
                tint = ThesisColors.Primary,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
            Text(
                text = "DESERVES A DEEPER LOOK",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary
            )
        }
        Text(
            text = insight.title,
            style = ThesisTypography.headlineLarge.copy(
                fontFamily = HeadingFont,
                fontWeight = FontWeight.Normal
            ),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = insight.body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextMuted
        )
        Button(
            onClick = { onRunDeepDive(insight.ticker) },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = ButtonDefaults.buttonColors(
                containerColor = ThesisColors.Primary,
                contentColor = ThesisColors.TextInverse
            )
        ) {
            Text(
                text = "Run ${insight.ticker} Deep Dive",
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
            )
        }
    }
}

@Composable
private fun FullPulseSection(sections: List<SectionView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        SectionHeader(
            title = "Full Pulse",
            subtitle = "Every section from the current daily briefing."
        )
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingMd))
        sections.forEach { section ->
            PulseInfoCard(
                title = section.title,
                body = section.body.ifBlank { "No section text returned." },
                status = section.status
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BottomLinksSection(
    showFullPulse: Boolean,
    onToggleFullPulse: () -> Unit,
    onOpenPulseBrief: () -> Unit,
    onOpenHistory: () -> Unit
) {
    // Wraps whole links onto a second line instead of breaking a word letter by letter (the tracked label
    // style is wider since the PR-1 type remap; rubric A4).
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = "MORNING BRIEF",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier
                .align(Alignment.CenterVertically)
                .clickable { onOpenPulseBrief() }
                .padding(ThesisDimens.SpacingMd)
                .semantics {
                    contentDescription = "Open the full Pulse morning brief"
                    role = Role.Button
                }
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
        Text(
            text = "/",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.Border,
            modifier = Modifier.align(Alignment.CenterVertically)
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
        Text(
            text = if (showFullPulse) "HIDE SECTIONS" else "SHOW SECTIONS",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier
                .align(Alignment.CenterVertically)
                .clickable { onToggleFullPulse() }
                .padding(ThesisDimens.SpacingMd)
                .semantics {
                    contentDescription = if (showFullPulse) "Hide pulse sections" else "Show pulse sections"
                    role = Role.Button
                }
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
        Text(
            text = "/",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.Border,
            modifier = Modifier.align(Alignment.CenterVertically)
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
        Text(
            text = "HISTORY",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier
                .align(Alignment.CenterVertically)
                .clickable { onOpenHistory() }
                .padding(ThesisDimens.SpacingMd)
                .semantics {
                    contentDescription = "Open report history"
                    role = Role.Button
                }
        )
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String) {
    Column {
        Text(
            text = title,
            style = ThesisTypography.headlineLarge.copy(
                fontFamily = HeadingFont,
                fontWeight = FontWeight.Normal
            ),
            color = ThesisColors.TextPrimary
        )
        Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
        Text(
            text = subtitle,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun PulseInfoCard(
    title: String,
    body: String,
    status: String?
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary,
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
            StatusPill(status = status)
        }
        Text(
            text = body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
    }
}

@Composable
private fun StatusPill(status: String?) {
    val (background, textColor, label) = when (status?.lowercase()) {
        "complete" -> Triple(ThesisColors.SignalPositive.copy(alpha = 0.1f), ThesisColors.SignalPositive, "COMPLETE")
        "data_incomplete" -> Triple(ThesisColors.SignalWarning.copy(alpha = 0.1f), ThesisColors.SignalWarning, "PARTIAL")
        "data_unavailable", "failed" -> Triple(ThesisColors.SignalNegative.copy(alpha = 0.1f), ThesisColors.SignalNegative, "UNAVAILABLE")
        else -> Triple(ThesisColors.SurfaceElevated, ThesisColors.TextMuted, status?.uppercase() ?: "LIVE")
    }
    Text(
        text = label,
        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
        color = textColor,
        modifier = Modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(background)
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
    )
}

@Composable
private fun ResumeCard(title: String, onResume: () -> Unit, onDismiss: () -> Unit) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onResume() }
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Primary.copy(alpha = 0.2f), shape)
            .padding(horizontal = ThesisDimens.CardPadding, vertical = ThesisDimens.SpacingLg),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.History,
            contentDescription = null,
            tint = ThesisColors.Primary,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Pick up where you left off",
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
            Text(
                text = title,
                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Text(
            text = "DISMISS",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary,
            modifier = Modifier.clickable { onDismiss() }
        )
    }
}

private fun resumeTitle(lastViewedReport: LastViewedReport): String =
    when (lastViewedReport.type) {
        "PULSE" -> "Morning Pulse"
        else -> "${lastViewedReport.label} Deep Dive"
    }

private data class InsightCardModel(val ticker: String, val title: String, val body: String)

private enum class TodayPhase(val title: String) {
    PRE_MARKET("Pre-market"),
    MARKET_HOURS("Market hours"),
    AFTER_HOURS("After hours")
}

private data class TodayPlan(val subtitle: String, val prioritySections: List<SectionView>)

private fun derivePulseLead(pulse: PulseReportView?, phase: TodayPhase): String {
    if (pulse == null) return when (phase) {
        TodayPhase.PRE_MARKET -> "Build your plan before the opening bell."
        TodayPhase.MARKET_HOURS -> "Live market context will appear here as today unfolds."
        TodayPhase.AFTER_HOURS -> "Review what changed and prepare for tomorrow."
    }
    val leadSection = pulse.sections.firstOrNull { !isWatchlistOverlay(it) } ?: return "Today's pulse is ready."
    return "${leadSection.title}: ${summarizeBody(leadSection.body)}"
}

private fun resolveTodayPhase(now: ZonedDateTime = ZonedDateTime.now(ZoneId.of("America/New_York"))): TodayPhase {
    val time = now.toLocalTime()
    return when {
        time.isBefore(LocalTime.of(9, 30)) -> TodayPhase.PRE_MARKET
        time.isBefore(LocalTime.of(16, 0)) -> TodayPhase.MARKET_HOURS
        else -> TodayPhase.AFTER_HOURS
    }
}

private fun buildTodayPlan(phase: TodayPhase, sections: List<SectionView>): TodayPlan {
    if (sections.isEmpty()) return TodayPlan("Waiting for the next Pulse cycle.", emptyList())
    val macroStress = sections.firstOrNull { containsAny(it, "macro stress", "macro", "pressure", "fear", "greed", "sentiment") }
    val earnings = sections.firstOrNull { containsAny(it, "earnings", "calendar") }
    val contrarian = sections.firstOrNull { containsAny(it, "contrarian", "alert") }
    val marketMoves = sections.firstOrNull { containsAny(it, "market", "moves", "pulse") }
    val weeklyDigest = sections.firstOrNull { containsAny(it, "weekly", "digest") }
    val priorityOrder = when (phase) {
        TodayPhase.PRE_MARKET -> listOf(macroStress, earnings, contrarian, marketMoves, weeklyDigest)
        TodayPhase.MARKET_HOURS -> listOf(marketMoves, macroStress, contrarian, earnings, weeklyDigest)
        TodayPhase.AFTER_HOURS -> listOf(marketMoves, macroStress, earnings, weeklyDigest, contrarian)
    }
    val prioritized = priorityOrder.filterNotNull()
    val remaining = sections.filterNot { prioritized.contains(it) }
    val subtitle = when (phase) {
        TodayPhase.PRE_MARKET -> "Macro pressure, tomorrow reports, overnight risk."
        TodayPhase.MARKET_HOURS -> "Current moves, macro pressure, active risk."
        TodayPhase.AFTER_HOURS -> "Closing wrap, macro pressure, tomorrow setup."
    }
    return TodayPlan(subtitle, prioritized + remaining)
}

private fun containsAny(section: SectionView, vararg tokens: String): Boolean {
    val haystack = "${section.title} ${section.body}".lowercase()
    return tokens.any { haystack.contains(it.lowercase()) }
}

private fun formatMacroStressLabel(label: String?): String = when (label?.lowercase()) {
    "extreme_fear", "fear", "high_stress", "elevated", "elevated_pressure" -> "Elevated Pressure"
    "neutral", "balanced", "moderate" -> "Balanced"
    "greed", "extreme_greed", "low_stress", "risk_on", "low_pressure" -> "Contained Pressure"
    else -> "Unavailable"
}

@Composable
@ReadOnlyComposable
private fun macroStressColor(label: String?): Color = when (label?.lowercase()) {
    "extreme_fear", "fear", "high_stress", "elevated", "elevated_pressure" -> ThesisColors.SignalNegative
    "greed", "extreme_greed", "low_stress", "risk_on", "low_pressure" -> ThesisColors.SignalPositive
    "neutral", "balanced", "moderate" -> ThesisColors.SignalNeutral
    else -> ThesisColors.TextMuted
}

private fun deriveMacroStressDirection(current: SentimentSnapshotView?, history: List<SentimentSnapshotView>): String {
    if (current == null) return "No material macro change detected yet."
    if (history.size < 2) return "No material macro change vs prior read."
    val sorted = history.sortedByDescending { it.marketDate }
    val baseline = sorted.firstOrNull { it.marketDate != current.marketDate } ?: sorted.getOrNull(1)
        ?: return "No material macro change vs prior read."
    val delta = current.score - baseline.score
    val deltaText = kotlin.math.abs(delta).toInt()
    return when {
        delta > 0.5 -> "Macro pressure up $deltaText pt vs prior read."
        delta < -0.5 -> "Macro pressure down $deltaText pt vs prior read."
        else -> "No material macro change vs prior read."
    }
}

private fun deriveInsight(
    pulse: PulseReportView?,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    lastViewedTicker: String?
): InsightCardModel? {
    val candidateTicker = lastViewedTicker ?: watchlist.firstOrNull() ?: return null
    val monitor = monitorSnapshots.firstOrNull { it.ticker.equals(candidateTicker, ignoreCase = true) }
    val matchingSection = pulse?.sections?.firstOrNull { sectionContainsTicker(it, candidateTicker) }
    val title = when {
        monitor != null -> "$candidateTicker thesis is ${monitor.state}"
        matchingSection != null -> "$candidateTicker appeared in ${matchingSection.title}"
        else -> "$candidateTicker is ready for a fresh look"
    }
    val body = when {
        monitor != null -> monitor.reason
        matchingSection != null -> summarizeBody(matchingSection.body)
        else -> "Run a current Deep Dive to connect today's pulse with the latest evidence."
    }
    return InsightCardModel(candidateTicker, title, body)
}

private fun describeWatchlistContext(
    ticker: String,
    pulse: PulseReportView?,
    monitorSnapshots: List<ThesisMonitorSnapshotView>
): String {
    val monitor = monitorSnapshots.firstOrNull { it.ticker.equals(ticker, ignoreCase = true) }
    if (monitor != null) {
        val label = monitor.state.replaceFirstChar { it.uppercase() }
        return "$label: ${monitor.reason}"
    }
    if (pulse == null) return "On your watchlist. Ready for a Deep Dive."
    val matchingSection = pulse.sections.firstOrNull { sectionContainsTicker(it, ticker) }
    if (matchingSection != null) return "In ${matchingSection.title.lowercase()}: ${summarizeBody(matchingSection.body)}"
    val overlay = pulse.sections.firstOrNull(::isWatchlistOverlay)
    if (overlay != null && sectionContainsTicker(overlay, ticker)) return summarizeBody(overlay.body)
    return "Tracked. Ready for a Deep Dive."
}

private fun sectionContainsTicker(section: SectionView, ticker: String): Boolean {
    val pattern = Regex("\\b${Regex.escape(ticker.uppercase())}\\b")
    val haystack = buildString {
        append(section.title.uppercase())
        append(' ')
        append(section.body.uppercase())
        section.evidence.forEach {
            append(' ')
            append(it.excerpt.uppercase())
        }
    }
    return pattern.containsMatchIn(haystack)
}

private fun isWatchlistOverlay(section: SectionView): Boolean = section.title.contains("watchlist", ignoreCase = true)

private fun summarizeBody(body: String, limit: Int = 140): String {
    val normalized = body.replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) return "No section summary was returned."
    val sentence = normalized.split(". ").firstOrNull().orEmpty().trim().trimEnd('.')
    val candidate = if (sentence.isNotBlank()) sentence else normalized
    return if (candidate.length <= limit) candidate else candidate.take(limit - 1).trimEnd() + "\u2026"
}

private fun formatTimestamp(raw: String): String = runCatching {
    Instant.parse(raw).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("MMM d, HH:mm"))
}.getOrElse { raw }

/** No followed names yet (the kit's EmptyState, 3 #25), with the one way forward. */
@Composable
private fun NoNamesState(onAddName: () -> Unit) {
    EmptyState(
        sentence = StateCopy.NO_NAMES,
        how = StateCopy.noNamesHow,
        icon = ThesisIcons.Names,
        actionLabel = StateCopy.NO_NAMES_ACTION,
        onAction = onAddName,
        primaryAction = true
    )
}
