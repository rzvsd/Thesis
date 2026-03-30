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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.components.NoNamesEmptyState
import com.thesis.mobile.ui.components.NoPulseEmptyState
import com.thesis.mobile.ui.components.OfflineEmptyState
import com.thesis.mobile.ui.components.PulseUnavailableState
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.LocalTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@Composable
fun HomeScreen(
    pulse: PulseReportView?,
    watchlist: List<String>,
    padding: PaddingValues,
    lastViewedReport: LastViewedReport? = null,
    pulseError: String? = null,
    onOpenHistory: () -> Unit,
    onRunDeepDive: (String) -> Unit,
    onManageNames: () -> Unit,
    onRetryPulse: () -> Unit,
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
    val insight = deriveInsight(pulse, watchlist, lastViewedTicker)

    LazyColumn(
        modifier = Modifier
            .padding(padding)
            .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXxl),
        contentPadding = PaddingValues(bottom = ThesisDimens.ScreenPaddingBottom)
    ) {
        item {
            Spacer(modifier = Modifier.height(ThesisDimens.ScreenPaddingTop))
            GreetingSection(
                dateLabel = dateLabel,
                phaseTitle = phase.title,
                pulseLead = pulseLead,
                pulseTimestamp = pulseTimestamp
            )
        }

        if (lastViewedReport != null && onResumeLastViewed != null && onDismissResume != null) {
            item {
                ResumeCard(
                    title = resumeTitle(lastViewedReport),
                    onResume = { onResumeLastViewed(lastViewedReport) },
                    onDismiss = onDismissResume
                )
            }
        }

        when {
            pulse == null && !pulseError.isNullOrBlank() -> {
                item {
                    if (pulseError.contains("No internet connection", ignoreCase = true)) {
                        OfflineEmptyState(onRetry = onRetryPulse)
                    } else {
                        PulseUnavailableState(
                            message = pulseError,
                            onRetry = onRetryPulse
                        )
                    }
                }
            }

            pulse == null && watchlist.isEmpty() -> {
                item {
                    NoNamesEmptyState(onAddName = onManageNames)
                }
            }

            pulse == null -> {
                val fallbackTicker = lastViewedTicker ?: watchlist.firstOrNull()
                item {
                    NoPulseEmptyState(
                        onRunDeepDive = {
                            if (!fallbackTicker.isNullOrBlank()) {
                                onRunDeepDive(fallbackTicker)
                            }
                        }
                    )
                }
            }

            else -> {
                item {
                    WhatMovedSection(
                        subtitle = todayPlan.subtitle,
                        sections = todayPlan.prioritySections.take(4)
                    )
                }
            }
        }

        item {
            YourNamesSection(
                watchlist = watchlist,
                pulse = pulse,
                onManageNames = onManageNames,
                onRunDeepDive = onRunDeepDive
            )
        }

        if (insight != null) {
            item {
                InsightAlertSection(
                    insight = insight,
                    onRunDeepDive = onRunDeepDive
                )
            }
        }

        if (showFullPulse && pulse != null) {
            item {
                FullPulseSection(sections = pulseSections)
            }
        }

        item {
            BottomLinksSection(
                showFullPulse = showFullPulse,
                onToggleFullPulse = { showFullPulse = !showFullPulse },
                onOpenHistory = onOpenHistory
            )
        }
    }
}

@Composable
private fun GreetingSection(
    dateLabel: String,
    phaseTitle: String,
    pulseLead: String,
    pulseTimestamp: String?
) {
    Column {
        Text(
            text = dateLabel.uppercase(),
            style = ThesisTypography.labelSmall.copy(letterSpacing = 2.sp),
            color = ThesisColors.TextSecondaryDark
        )
        Text(
            text = phaseTitle,
            style = ThesisTypography.displayLarge,
            color = ThesisColors.TextPrimaryDark,
            modifier = Modifier.padding(top = ThesisDimens.SpacingXs, bottom = ThesisDimens.SpacingLg)
        )
        Text(
            text = pulseLead,
            style = ThesisTypography.bodyLarge,
            color = ThesisColors.TextSecondaryDark
        )
        if (!pulseTimestamp.isNullOrBlank()) {
            Text(
                text = "Updated $pulseTimestamp",
                style = ThesisTypography.labelMedium,
                color = ThesisColors.TextTertiaryDark,
                modifier = Modifier.padding(top = ThesisDimens.SpacingSm)
            )
        }
    }
}

@Composable
private fun WhatMovedSection(
    subtitle: String,
    sections: List<SectionView>
) {
    Column {
        SectionHeader(
            title = "What Moved",
            subtitle = subtitle
        )
        if (sections.isEmpty()) {
            PulseInfoCard(
                title = "Waiting on today’s pulse",
                body = "The daily cycle has not produced section output yet.",
                status = null
            )
            return
        }

        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)) {
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
    onManageNames: () -> Unit,
    onRunDeepDive: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "My Names",
                    style = ThesisTypography.headlineLarge,
                    color = ThesisColors.TextPrimaryDark
                )
                Text(
                    text = "Your watchlist, framed around today’s pulse.",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextTertiaryDark
                )
            }
            Text(
                text = "MANAGE",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
                color = ThesisColors.AccentBlueLight,
                modifier = Modifier.clickable { onManageNames() }
            )
        }

        if (watchlist.isEmpty()) {
            NoNamesEmptyState(onAddName = onManageNames)
            return
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurfaceHigh),
            border = androidx.compose.foundation.BorderStroke(1.dp, ThesisColors.DarkBorder)
        ) {
            Column(
                modifier = Modifier.padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
            ) {
                watchlist.take(5).forEach { ticker ->
                    val context = describeWatchlistContext(ticker, pulse)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onRunDeepDive(ticker) },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = ticker,
                                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                color = ThesisColors.TextPrimaryDark
                            )
                            Text(
                                text = context,
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextSecondaryDark,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
                        Text(
                            text = "OPEN",
                            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = ThesisColors.AccentBlue
                        )
                    }
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        border = androidx.compose.foundation.BorderStroke(1.dp, ThesisColors.AccentBlue.copy(alpha = 0.2f))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(ThesisColors.DarkSurfaceHigh, ThesisColors.DarkSurface)
                    )
                )
        ) {
            Column(modifier = Modifier.padding(ThesisDimens.SpacingXxl)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(percent = 50))
                        .background(ThesisColors.AccentBlue.copy(alpha = 0.1f))
                        .padding(horizontal = ThesisDimens.SpacingMd, vertical = ThesisDimens.SpacingXs)
                ) {
                    Icon(
                        imageVector = Icons.Default.Insights,
                        contentDescription = null,
                        tint = ThesisColors.AccentBlue,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingXs))
                    Text(
                        text = "DESERVES A DEEPER LOOK",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Black, letterSpacing = 1.5.sp),
                        color = ThesisColors.AccentBlue
                    )
                }

                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

                Text(
                    text = insight.title,
                    style = ThesisTypography.displayMedium,
                    color = ThesisColors.TextPrimaryDark
                )

                Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))

                Text(
                    text = insight.body,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondaryDark
                )

                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

                Button(
                    onClick = { onRunDeepDive(insight.ticker) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.AccentBlue,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = "Run ${insight.ticker} Deep Dive",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}

@Composable
private fun FullPulseSection(sections: List<SectionView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)) {
        SectionHeader(
            title = "Full Pulse",
            subtitle = "Every section from the current daily briefing."
        )
        sections.forEach { section ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface),
                border = androidx.compose.foundation.BorderStroke(1.dp, ThesisColors.DarkBorder)
            ) {
                Column(
                    modifier = Modifier.padding(ThesisDimens.CardPadding),
                    verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = section.title,
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = ThesisColors.TextPrimaryDark
                        )
                        StatusPill(status = section.status)
                    }
                    Text(
                        text = section.body.ifBlank { "No section text returned." },
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextSecondaryDark
                    )
                }
            }
        }
    }
}

@Composable
private fun BottomLinksSection(
    showFullPulse: Boolean,
    onToggleFullPulse: () -> Unit,
    onOpenHistory: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = if (showFullPulse) "HIDE FULL PULSE" else "FULL PULSE",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Black, letterSpacing = 1.5.sp),
            color = ThesisColors.AccentBlueLight,
            modifier = Modifier.clickable { onToggleFullPulse() }
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingXxl))
        Box(
            modifier = Modifier
                .size(4.dp)
                .clip(CircleShape)
                .background(ThesisColors.DarkBorder)
        )
        Spacer(modifier = Modifier.size(ThesisDimens.SpacingXxl))
        Text(
            text = "HISTORY",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Black, letterSpacing = 1.5.sp),
            color = ThesisColors.AccentBlueLight,
            modifier = Modifier.clickable { onOpenHistory() }
        )
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = title,
            style = ThesisTypography.headlineLarge,
            color = ThesisColors.TextPrimaryDark
        )
        Text(
            text = subtitle,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextTertiaryDark
        )
    }
}

@Composable
private fun PulseInfoCard(
    title: String,
    body: String,
    status: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface),
        border = androidx.compose.foundation.BorderStroke(1.dp, ThesisColors.DarkBorder)
    ) {
        Column(
            modifier = Modifier.padding(ThesisDimens.CardPadding),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
                StatusPill(status = status)
            }
            Text(
                text = body,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondaryDark
            )
        }
    }
}

@Composable
private fun StatusPill(status: String?) {
    val (background, textColor, label) = when (status?.lowercase()) {
        "complete" -> Triple(
            ThesisColors.SignalPositive.copy(alpha = 0.15f),
            ThesisColors.SignalPositive,
            "COMPLETE"
        )
        "data_incomplete" -> Triple(
            ThesisColors.SignalWarning.copy(alpha = 0.15f),
            ThesisColors.SignalWarning,
            "PARTIAL"
        )
        "data_unavailable", "failed" -> Triple(
            ThesisColors.SignalNegative.copy(alpha = 0.15f),
            ThesisColors.SignalNegative,
            "UNAVAILABLE"
        )
        else -> Triple(
            ThesisColors.DarkBorder,
            ThesisColors.TextSecondaryDark,
            status?.uppercase() ?: "LIVE"
        )
    }

    Text(
        text = label,
        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
        color = textColor,
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(background)
            .padding(horizontal = ThesisDimens.SpacingMd, vertical = ThesisDimens.SpacingXs)
    )
}

@Composable
private fun ResumeCard(
    title: String,
    onResume: () -> Unit,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onResume() },
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkCardAlt),
        border = androidx.compose.foundation.BorderStroke(1.dp, ThesisColors.AccentBlue.copy(alpha = 0.35f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = ThesisDimens.SpacingLg, vertical = ThesisDimens.SpacingMd),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ThesisColors.AccentBlue.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.History,
                    contentDescription = null,
                    tint = ThesisColors.AccentBlue,
                    modifier = Modifier.size(18.dp)
                )
            }
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Pick up where you left off",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = title,
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Text(
                text = "DISMISS",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.AccentBlue,
                modifier = Modifier.clickable { onDismiss() }
            )
        }
    }
}

private fun resumeTitle(lastViewedReport: LastViewedReport): String =
    when (lastViewedReport.type) {
        "PULSE" -> "Morning Pulse"
        else -> "${lastViewedReport.label} Deep Dive"
    }

private data class InsightCardModel(
    val ticker: String,
    val title: String,
    val body: String
)

private enum class TodayPhase(val title: String) {
    PRE_MARKET("Pre-market"),
    MARKET_HOURS("Market hours"),
    AFTER_HOURS("After hours")
}

private data class TodayPlan(
    val subtitle: String,
    val prioritySections: List<SectionView>
)

private fun derivePulseLead(pulse: PulseReportView?, phase: TodayPhase): String {
    if (pulse == null) {
        return when (phase) {
            TodayPhase.PRE_MARKET -> "Build your plan before the opening bell."
            TodayPhase.MARKET_HOURS -> "Live market context will appear here as today unfolds."
            TodayPhase.AFTER_HOURS -> "Review what changed and prepare for tomorrow."
        }
    }
    val leadSection = pulse.sections.firstOrNull { !isWatchlistOverlay(it) } ?: return "Today’s pulse is ready."
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
    if (sections.isEmpty()) {
        return TodayPlan(
            subtitle = "Waiting for the next Pulse cycle.",
            prioritySections = emptyList()
        )
    }

    val fearGreed = sections.firstOrNull { containsAny(it, "fear", "greed", "sentiment") }
    val earnings = sections.firstOrNull { containsAny(it, "earnings", "calendar") }
    val contrarian = sections.firstOrNull { containsAny(it, "contrarian", "alert") }
    val marketMoves = sections.firstOrNull { containsAny(it, "market", "moves", "pulse") }
    val weeklyDigest = sections.firstOrNull { containsAny(it, "weekly", "digest") }

    val priorityOrder = when (phase) {
        TodayPhase.PRE_MARKET -> listOf(fearGreed, earnings, contrarian, marketMoves, weeklyDigest)
        TodayPhase.MARKET_HOURS -> listOf(marketMoves, fearGreed, contrarian, earnings, weeklyDigest)
        TodayPhase.AFTER_HOURS -> listOf(marketMoves, fearGreed, earnings, weeklyDigest, contrarian)
    }

    val prioritized = priorityOrder.filterNotNull()
    val remaining = sections.filterNot { prioritized.contains(it) }

    val subtitle = when (phase) {
        TodayPhase.PRE_MARKET -> "Priority: sentiment -> tomorrow reports -> overnight risk context."
        TodayPhase.MARKET_HOURS -> "Priority: current moves -> sentiment -> active risk context."
        TodayPhase.AFTER_HOURS -> "Priority: closing wrap -> sentiment -> tomorrow earnings setup."
    }

    return TodayPlan(
        subtitle = subtitle,
        prioritySections = prioritized + remaining
    )
}

private fun containsAny(section: SectionView, vararg tokens: String): Boolean {
    val haystack = "${section.title} ${section.body}".lowercase()
    return tokens.any { token -> haystack.contains(token.lowercase()) }
}

private fun deriveInsight(
    pulse: PulseReportView?,
    watchlist: List<String>,
    lastViewedTicker: String?
): InsightCardModel? {
    val candidateTicker = lastViewedTicker ?: watchlist.firstOrNull() ?: return null
    val matchingSection = pulse?.sections?.firstOrNull { sectionContainsTicker(it, candidateTicker) }
    val title = if (matchingSection != null) {
        "$candidateTicker showed up in ${matchingSection.title}"
    } else {
        "$candidateTicker is ready for a fresh look"
    }
    val body = matchingSection?.body?.let(::summarizeBody)
        ?: "Run a current Deep Dive to connect today’s pulse with the latest company-specific evidence."
    return InsightCardModel(candidateTicker, title, body)
}

private fun describeWatchlistContext(ticker: String, pulse: PulseReportView?): String {
    if (pulse == null) {
        return "Saved to your watchlist and ready for a Deep Dive."
    }

    val matchingSection = pulse.sections.firstOrNull { sectionContainsTicker(it, ticker) }
    if (matchingSection != null) {
        return "Mentioned in ${matchingSection.title.lowercase()}: ${summarizeBody(matchingSection.body)}"
    }

    val overlay = pulse.sections.firstOrNull(::isWatchlistOverlay)
    if (overlay != null && sectionContainsTicker(overlay, ticker)) {
        return summarizeBody(overlay.body)
    }

    return "Tracked in your watchlist and ready for a company Deep Dive."
}

private fun sectionContainsTicker(section: SectionView, ticker: String): Boolean {
    val pattern = Regex("\\b${Regex.escape(ticker.uppercase())}\\b")
    val haystack = buildString {
        append(section.title.uppercase())
        append(' ')
        append(section.body.uppercase())
        section.evidence.forEach { evidence ->
            append(' ')
            append(evidence.excerpt.uppercase())
        }
    }
    return pattern.containsMatchIn(haystack)
}

private fun isWatchlistOverlay(section: SectionView): Boolean =
    section.title.contains("watchlist", ignoreCase = true)

private fun summarizeBody(body: String, limit: Int = 140): String {
    val normalized = body.replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) {
        return "No section summary was returned."
    }
    val sentence = normalized.split(". ").firstOrNull().orEmpty().trim().trimEnd('.')
    val candidate = if (sentence.isNotBlank()) sentence else normalized
    return if (candidate.length <= limit) candidate else candidate.take(limit - 1).trimEnd() + "…"
}

private fun formatTimestamp(raw: String): String =
    runCatching {
        Instant.parse(raw)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("MMM d, HH:mm"))
    }.getOrElse { raw }
