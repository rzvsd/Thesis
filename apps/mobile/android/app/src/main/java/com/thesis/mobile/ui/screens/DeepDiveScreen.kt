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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.TrustMetadataView
import com.thesis.mobile.model.ValuationDisplayView
import com.thesis.mobile.ui.components.ConfidenceRing
import com.thesis.mobile.ui.components.DeepDiveUnavailableState
import com.thesis.mobile.ui.components.EvidenceDots
import com.thesis.mobile.ui.components.NoDeepDivesEmptyState
import com.thesis.mobile.ui.components.OfflineEmptyState
import com.thesis.mobile.ui.components.SectionAccordion
import com.thesis.mobile.ui.components.SignalBadge
import com.thesis.mobile.ui.components.ThesisButton
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun DeepDiveScreen(
    report: DeepDiveReportView?,
    isLoading: Boolean,
    errorMessage: String?,
    recentHistory: List<ReportHistoryItem>,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    convictionTimeline: List<ConvictionJournalEntryView>,
    convictionTimelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    onGenerateOppositeCase: () -> Unit,
    onRefreshConvictionTimeline: () -> Unit,
    scenarioResult: ScenarioResultView?,
    isRunningScenario: Boolean,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onSubmitReportFeedback: (String, String) -> Unit,
    onNotify: (String) -> Unit,
    onOpenHistoryReport: (String) -> Unit,
    onOpenPulseHistory: (String) -> Unit,
    tickerState: String,
    watchlist: List<String>,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    onBack: () -> Unit,
    padding: PaddingValues
) {
    if (report == null) {
        if (isLoading) {
            DeepDiveLoadingScreen(modifier = Modifier.padding(padding))
        } else {
            DeepDiveSearchState(
                tickerState = tickerState,
                isLoading = isLoading,
                errorMessage = errorMessage,
                recentHistory = recentHistory,
                onTickerChange = onTickerChange,
                onRunReport = onRunReport,
                onOpenHistoryReport = onOpenHistoryReport,
                onOpenPulseHistory = onOpenPulseHistory,
                padding = padding
            )
        }
        return
    }

    DeepDiveReportState(
        report = report,
        userTier = userTier,
        reportNoteDraft = reportNoteDraft,
        noteUpdatedAt = noteUpdatedAt,
        isSavingNote = isSavingNote,
        convictionTimeline = convictionTimeline,
        convictionTimelineError = convictionTimelineError,
        oppositeCase = oppositeCase,
        oppositeCaseError = oppositeCaseError,
        isGeneratingOppositeCase = isGeneratingOppositeCase,
        onReportNoteChange = onReportNoteChange,
        onSaveReportNote = onSaveReportNote,
        onGenerateOppositeCase = onGenerateOppositeCase,
        onRefreshConvictionTimeline = onRefreshConvictionTimeline,
        scenarioResult = scenarioResult,
        isRunningScenario = isRunningScenario,
        onRunScenario = onRunScenario,
        onRequireUpgrade = onRequireUpgrade,
        onSubmitReportFeedback = onSubmitReportFeedback,
        onNotify = onNotify,
        watchlist = watchlist,
        onBack = onBack,
        padding = padding
    )
}

@Composable
private fun DeepDiveSearchState(
    tickerState: String,
    isLoading: Boolean,
    errorMessage: String?,
    recentHistory: List<ReportHistoryItem>,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    onOpenHistoryReport: (String) -> Unit,
    onOpenPulseHistory: (String) -> Unit,
    padding: PaddingValues
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(ThesisDimens.ScreenPaddingHorizontal),
        contentAlignment = Alignment.Center
    ) {
        if (!errorMessage.isNullOrBlank()) {
            if (errorMessage.contains("No internet connection", ignoreCase = true)) {
                OfflineEmptyState(onRetry = onRunReport)
            } else {
                DeepDiveUnavailableState(
                    message = errorMessage,
                    onRetry = onRunReport
                )
            }
            return
        }

        NoDeepDivesEmptyState {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Start new research or reopen something you already explored.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))
                OutlinedTextField(
                    value = tickerState,
                    onValueChange = onTickerChange,
                    label = { Text("Ticker Symbol (e.g. AAPL)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = deepDiveFieldColors()
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))
                ThesisButton(
                    text = if (isLoading) "Running..." else "Run Deep Dive",
                    onClick = onRunReport,
                    enabled = !isLoading && tickerState.isNotBlank()
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = ThesisColors.TextInverse,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = "Run Deep Dive",
                            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextInverse
                        )
                    }
                }
                if (recentHistory.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXl))
                    Text(
                        text = "Continue Research",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    recentHistory
                        .sortedByDescending { it.createdAt }
                        .take(3)
                        .forEach { item ->
                            RecentResearchCard(
                                item = item,
                                onClick = {
                                    if (item.type == "deep_dive") {
                                        onOpenHistoryReport(item.reportId)
                                    } else {
                                        onOpenPulseHistory(item.createdAt.take(10))
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        }
                }
            }
        }
    }
}

@Composable
private fun RecentResearchCard(
    item: ReportHistoryItem,
    onClick: () -> Unit
) {
    val title = if (item.type == "deep_dive") {
        item.ticker?.let { "$it Deep Dive" } ?: "Deep Dive"
    } else {
        "Market Pulse"
    }
    val subtitle = if (item.type == "deep_dive") {
        "Open your last report"
    } else {
        "Open the saved pulse for ${item.createdAt.take(10)}"
    }
    val dateLabel = item.createdAt.take(10)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.Surface)
            .border(
                width = ThesisDimens.BorderWidth,
                color = ThesisColors.Border,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            )
            .clickable(onClick = onClick)
            .padding(ThesisDimens.SpacingMd),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = dateLabel,
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
        }
        Text(
            text = subtitle,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun DeepDiveReportState(
    report: DeepDiveReportView,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    convictionTimeline: List<ConvictionJournalEntryView>,
    convictionTimelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    onGenerateOppositeCase: () -> Unit,
    onRefreshConvictionTimeline: () -> Unit,
    scenarioResult: ScenarioResultView?,
    isRunningScenario: Boolean,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onSubmitReportFeedback: (String, String) -> Unit,
    onNotify: (String) -> Unit,
    watchlist: List<String>,
    onBack: () -> Unit,
    padding: PaddingValues
) {
    val ticker = report.ticker ?: "Ticker"
    val isWatched = report.ticker != null && watchlist.contains(report.ticker)
    val highlights = deriveHighlights(report)
    val context = LocalContext.current
    val isPro = userTier.equals("PRO", ignoreCase = true)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 56.dp + ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom + 96.dp,
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXxl)
        ) {
            item {
                HeaderSection(
                    ticker = ticker,
                    isWatched = isWatched,
                    schemaVersion = report.schemaVersion,
                    isLegacy = report.isLegacy
                )
            }

            report.trustMetadata?.let { trust ->
                item {
                    TrustOverviewSection(trust = trust)
                }
            }

            report.thesisStatement?.takeIf { it.isNotBlank() }?.let { thesis ->
                item {
                    SummarySection(
                        title = "Thesis Statement",
                        icon = Icons.Default.PushPin,
                        iconColor = ThesisColors.AccentBlue,
                        content = thesis
                    )
                }
            }

            item { SignalBlockSection(report = report) }

            item { ResearchSnapshotCard(report = report) }

            item {
                DeepDiveConvictionSection(
                    isPro = isPro,
                    timeline = convictionTimeline,
                    timelineError = convictionTimelineError,
                    oppositeCase = oppositeCase,
                    oppositeCaseError = oppositeCaseError,
                    isGeneratingOppositeCase = isGeneratingOppositeCase,
                    onGenerateOppositeCase = onGenerateOppositeCase,
                    onRefreshTimeline = onRefreshConvictionTimeline,
                    onRequireUpgrade = onRequireUpgrade
                )
            }

            items(highlights.size) { index ->
                val highlight = highlights[index]
                SummarySection(
                    title = highlight.title,
                    icon = highlight.icon,
                    iconColor = highlight.iconColor,
                    content = highlight.content,
                    isCaution = highlight.isCaution
                )
            }

            if (report.sections.isNotEmpty()) {
                item {
                    Text(
                        text = "Deep Dive Modules",
                        style = ThesisTypography.headlineLarge.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                }
            }

            items(report.sections.size) { index ->
                val section = report.sections[index]
                SectionAccordion(
                    title = section.title,
                    statusText = section.status ?: "UNKNOWN",
                    initiallyExpanded = section.status.equals("complete", ignoreCase = true),
                    content = {
                        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                            Text(
                                text = section.body.ifBlank { "No section summary returned." },
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextSecondary
                            )

                            if (section.evidence.isNotEmpty()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    EvidenceDots(count = section.evidence.size)
                                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
                                    Text(
                                        text = "${section.evidence.size} sources",
                                        style = ThesisTypography.labelSmall,
                                        color = ThesisColors.TextMuted
                                    )
                                }

                                EvidenceList(evidence = section.evidence)
                            }
                        }
                    },
                    modifier = Modifier.padding(bottom = ThesisDimens.SpacingSm)
                )
            }

            item {
                NotesSection(
                    noteDraft = reportNoteDraft,
                    noteUpdatedAt = noteUpdatedAt,
                    isSaving = isSavingNote,
                    onNoteChange = onReportNoteChange,
                    onSave = onSaveReportNote
                )
            }

            item {
                ScenarioSection(
                    isPro = isPro,
                    valuation = report.valuation,
                    isRunning = isRunningScenario,
                    scenarioResult = scenarioResult,
                    onRunScenario = onRunScenario,
                    onRequireUpgrade = onRequireUpgrade
                )
            }

            item {
                ReportFeedbackSection(
                    onSubmit = onSubmitReportFeedback
                )
            }

            item {
                ExportSection(
                    isPro = isPro,
                    onRequireUpgrade = onRequireUpgrade,
                    onNotify = onNotify,
                    onExportPdf = {
                        val artifact = createPdfExport(context, report, ReportExportType.FULL_REPORT)
                        shareExport(context, artifact)
                    },
                    onExportCard = {
                        val artifact = createShareCard(context, report)
                        shareExport(context, artifact)
                    },
                    onExportMemo = {
                        val artifact = createPdfExport(context, report, ReportExportType.INVESTMENT_MEMO)
                        shareExport(context, artifact)
                    }
                )
            }

            item {
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))
                Text(
                    text = "This is a research summary, not financial advice. Always do your own research.",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(ThesisColors.Background.copy(alpha = 0.97f))
                .padding(horizontal = ThesisDimens.SpacingSm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = ThesisColors.Primary
                    )
                }
                Text(
                    text = ticker,
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
            }

            SignalBadge(signalValue = report.signalValue)
        }
    }
}

@Composable
private fun HeaderSection(
    ticker: String,
    isWatched: Boolean,
    schemaVersion: String,
    isLegacy: Boolean
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Text(
                text = ticker,
                style = ThesisTypography.displayLarge.copy(
                    fontFamily = HeadingFont,
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Normal
                ),
                color = ThesisColors.TextPrimary
            )

            if (isWatched) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                        .background(ThesisColors.Primary.copy(alpha = 0.1f))
                        .border(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Primary.copy(alpha = 0.2f),
                            RoundedCornerShape(ThesisDimens.SignalBadgeCorner)
                        )
                        .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = ThesisColors.Primary,
                        modifier = Modifier.size(12.dp)
                    )
                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingXs))
                    Text(
                        text = "IN MY NAMES",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary
                    )
                }
            }
        }

        Text(
            text = if (isLegacy) {
                "Legacy report surfaced in the emergent layout"
            } else {
                "Evidence-backed company research"
            },
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )

        Text(
            text = "Schema v$schemaVersion",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun TrustOverviewSection(trust: TrustMetadataView) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "Trust & Freshness",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                .padding(ThesisDimens.CardPadding)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
                ) {
                    TrustBadge(
                        label = "Freshness",
                        value = trust.freshnessState?.uppercase() ?: "UNKNOWN",
                        color = trustStateColor(trust.freshnessState),
                        modifier = Modifier.weight(1f)
                    )
                    TrustBadge(
                        label = "Evidence",
                        value = "${trust.evidenceCount ?: 0}",
                        color = ThesisColors.AccentBlue,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
                ) {
                    TrustBadge(
                        label = "Contradiction",
                        value = trust.contradictionState?.uppercase() ?: "UNKNOWN",
                        color = if (trust.contradictionState.equals("present", ignoreCase = true)) {
                            ThesisColors.SignalNegative
                        } else {
                            ThesisColors.SignalPositive
                        },
                        modifier = Modifier.weight(1f)
                    )
                    TrustBadge(
                        label = "Valuation",
                        value = trust.valuationState?.uppercase() ?: "UNKNOWN",
                        color = when {
                            trust.valuationState.equals("available", ignoreCase = true) -> ThesisColors.SignalPositive
                            trust.valuationState.equals("degraded", ignoreCase = true) -> ThesisColors.SignalWarning
                            else -> ThesisColors.TextMuted
                        },
                        modifier = Modifier.weight(1f)
                    )
                }

                trust.thesisDrift?.summary?.takeIf { it.isNotBlank() }?.let { summary ->
                    SnapshotRow(label = "THESIS DRIFT", value = summary)
                }

                if (trust.quoteProvenance.isNotEmpty()) {
                    val quote = trust.quoteProvenance.first()
                    SnapshotRow(
                        label = "QUOTE PROVENANCE",
                        value = "\"${quote.quote}\" — ${quote.sourceName}" +
                            (quote.sourcePeriod?.let { " ($it)" } ?: "")
                    )
                }

                trust.missingDataNotes.firstOrNull()?.takeIf { it.isNotBlank() }?.let { note ->
                    SnapshotRow(label = "LIMITS", value = note)
                }
            }
        }
    }
}

@Composable
private fun TrustBadge(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(color.copy(alpha = 0.12f))
            .border(
                ThesisDimens.BorderWidth,
                color.copy(alpha = 0.3f),
                RoundedCornerShape(ThesisDimens.SignalBadgeCorner)
            )
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingSm)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
            Text(
                text = label.uppercase(),
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted
            )
            Text(
                text = value,
                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = color
            )
        }
    }
}

private fun trustStateColor(state: String?): Color {
    return when {
        state.equals("fresh", ignoreCase = true) -> ThesisColors.SignalPositive
        state.equals("degraded", ignoreCase = true) -> ThesisColors.SignalWarning
        state.equals("stale", ignoreCase = true) -> ThesisColors.SignalNegative
        else -> ThesisColors.TextMuted
    }
}

@Composable
private fun SignalBlockSection(report: DeepDiveReportView) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)

        Box(
            modifier = Modifier
                .weight(1f)
                .height(140.dp)
                .clip(shape)
                .background(signalContainerColor(report.signalValue))
                .border(ThesisDimens.BorderWidth, signalBorderColor(report.signalValue), shape)
                .padding(ThesisDimens.CardPadding)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "SIGNAL",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = signalTextColor(report.signalValue)
                )
                SignalBadge(signalValue = report.signalValue)
                Text(
                    text = report.signalValue?.uppercase() ?: "NO SIGNAL",
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = signalTextColor(report.signalValue)
                )
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .height(140.dp)
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                .padding(ThesisDimens.CardPadding),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                ConfidenceRing(
                    score = (report.confidenceScore ?: 0.0).toFloat(),
                    modifier = Modifier.size(56.dp)
                )
                Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
                Column {
                    Text(
                        text = "CONFIDENCE",
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.TextMuted
                    )
                    Text(
                        text = report.confidenceLabel?.uppercase() ?: "UNKNOWN",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                }
            }
        }
    }
}

@Composable
private fun ResearchSnapshotCard(report: DeepDiveReportView) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "Research Snapshot",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                .padding(ThesisDimens.CardPadding)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                if (report.signalReasons.isNotEmpty()) {
                    SnapshotRow(
                        label = "WHY THIS SIGNAL",
                        value = report.signalReasons.joinToString(separator = " | ")
                    )
                }

                report.valuation?.let { valuation ->
                    SnapshotRow(
                        label = "VALUATION",
                        value = valuationSummary(valuation)
                    )
                }

                report.historical?.let { historical ->
                    SnapshotRow(
                        label = "HISTORICAL CONTEXT",
                        value = historicalSummary(historical)
                    )
                }

                report.confidence?.limitingFactors?.takeIf { it.isNotEmpty() }?.let { factors ->
                    SnapshotRow(
                        label = "LIMITING FACTORS",
                        value = factors.joinToString(separator = " | ")
                    )
                }
            }
        }
    }
}

@Composable
private fun SnapshotRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
        Text(
            text = label,
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted
        )
        Text(
            text = value,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextPrimary
        )
    }
}

@Composable
private fun SummarySection(
    title: String,
    icon: ImageVector,
    iconColor: Color,
    content: String,
    isCaution: Boolean = false
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = ThesisDimens.SpacingSm)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
            Text(
                text = title.uppercase(),
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(
                    ThesisDimens.BorderWidth,
                    if (isCaution) ThesisColors.SignalWarning.copy(alpha = 0.2f) else iconColor.copy(alpha = 0.2f),
                    shape
                )
                .padding(ThesisDimens.CardPadding)
        ) {
            Text(
                text = content,
                style = ThesisTypography.bodyLarge,
                color = if (isCaution) ThesisColors.TextSecondary else ThesisColors.TextPrimary,
                fontStyle = if (isCaution) FontStyle.Italic else FontStyle.Normal
            )
        }
    }
}

@Composable
private fun EvidenceList(evidence: List<EvidenceView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        evidence.forEach { item ->
            Column {
                Text(
                    text = "Source: ${item.sourceName}",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
                if (item.excerpt.isNotBlank()) {
                    Text(
                        text = item.excerpt,
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                if (!item.url.isNullOrBlank()) {
                    Text(
                        text = item.url,
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.Primary
                    )
                }
            }
        }
    }
}

@Composable
private fun NotesSection(
    noteDraft: String,
    noteUpdatedAt: String?,
    isSaving: Boolean,
    onNoteChange: (String) -> Unit,
    onSave: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "My Notes",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        OutlinedTextField(
            value = noteDraft,
            onValueChange = onNoteChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            maxLines = 8,
            label = { Text("Add your notes for this report") },
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = deepDiveFieldColors()
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = noteUpdatedAt?.let { "Last saved: $it" } ?: "No saved note yet.",
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
            ThesisButton(
                text = if (isSaving) "Saving..." else "Save Note",
                onClick = onSave,
                enabled = !isSaving,
                modifier = Modifier.fillMaxWidth().weight(0.45f, fill = false)
            )
        }
    }
}

@Composable
private fun ScenarioSection(
    isPro: Boolean,
    valuation: ValuationDisplayView?,
    isRunning: Boolean,
    scenarioResult: ScenarioResultView?,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit
) {
    var projectionYearsText by remember(valuation?.assumptions?.projectionYears) {
        mutableStateOf(valuation?.assumptions?.projectionYears?.toString().orEmpty())
    }
    var terminalGrowthText by remember(valuation?.assumptions?.terminalGrowthRate) {
        mutableStateOf(valuation?.assumptions?.terminalGrowthRate?.toString().orEmpty())
    }
    var waccText by remember(valuation?.assumptions?.wacc) {
        mutableStateOf(valuation?.assumptions?.wacc?.toString().orEmpty())
    }

    LaunchedEffect(valuation?.assumptions?.projectionYears, valuation?.assumptions?.terminalGrowthRate, valuation?.assumptions?.wacc) {
        projectionYearsText = valuation?.assumptions?.projectionYears?.toString().orEmpty()
        terminalGrowthText = valuation?.assumptions?.terminalGrowthRate?.toString().orEmpty()
        waccText = valuation?.assumptions?.wacc?.toString().orEmpty()
    }

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "What-If Scenario",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = "Adjust DCF assumptions and compare outputs.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )

        if (valuation == null) {
            Text(
                text = "Valuation data unavailable.",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
            return@Column
        }

        OutlinedTextField(
            value = projectionYearsText,
            onValueChange = { projectionYearsText = it },
            label = { Text("Projection years") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = deepDiveFieldColors()
        )
        OutlinedTextField(
            value = terminalGrowthText,
            onValueChange = { terminalGrowthText = it },
            label = { Text("Terminal growth rate") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = deepDiveFieldColors()
        )
        OutlinedTextField(
            value = waccText,
            onValueChange = { waccText = it },
            label = { Text("WACC") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = deepDiveFieldColors()
        )

        ThesisButton(
            text = if (isRunning) "Running..." else "Run Scenario",
            onClick = {
                if (!isPro) {
                    onRequireUpgrade("what_if_scenario")
                    return@ThesisButton
                }
                onRunScenario(
                    projectionYearsText.toIntOrNull(),
                    terminalGrowthText.toDoubleOrNull(),
                    waccText.toDoubleOrNull()
                )
            },
            enabled = !isRunning
        )

        scenarioResult?.let { result ->
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                    Text(
                        text = "Scenario Result",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = "Base fair value: ${formatMaybeNumber(result.base.fairValueMid)}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                    Text(
                        text = "Scenario fair value: ${formatMaybeNumber(result.scenario.fairValueMid)}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                    Text(
                        text = "Implied upside: ${formatMaybePercent(result.scenario.impliedUpsidePct)}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.SignalPositive
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportFeedbackSection(
    onSubmit: (String, String) -> Unit
) {
    val options = listOf(
        "useful" to "Useful",
        "confusing" to "Confusing",
        "generic" to "Too Generic",
        "stale" to "Stale",
        "bug_report" to "Bug Report"
    )
    var selectedCode by remember { mutableStateOf("useful") }
    var feedbackMessage by remember { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "Report Feedback",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = "Tell us if this report was helpful or what needs fixing.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            options.take(3).forEach { (code, label) ->
                OutlinedButton(
                    onClick = { selectedCode = code },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    border = androidx.compose.foundation.BorderStroke(
                        ThesisDimens.BorderWidth,
                        if (selectedCode == code) ThesisColors.Primary else ThesisColors.Border
                    )
                ) {
                    Text(
                        text = label,
                        color = if (selectedCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            options.drop(3).forEach { (code, label) ->
                OutlinedButton(
                    onClick = { selectedCode = code },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    border = androidx.compose.foundation.BorderStroke(
                        ThesisDimens.BorderWidth,
                        if (selectedCode == code) ThesisColors.Primary else ThesisColors.Border
                    )
                ) {
                    Text(
                        text = label,
                        color = if (selectedCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                    )
                }
            }
        }

        OutlinedTextField(
            value = feedbackMessage,
            onValueChange = { feedbackMessage = it },
            label = { Text("Optional details") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 4,
            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
            colors = deepDiveFieldColors()
        )

        ThesisButton(
            text = "Send Feedback",
            onClick = {
                onSubmit(selectedCode, feedbackMessage)
                feedbackMessage = ""
            }
        )
    }
}

@Composable
private fun ExportSection(
    isPro: Boolean,
    onRequireUpgrade: (String) -> Unit,
    onNotify: (String) -> Unit,
    onExportPdf: () -> Unit,
    onExportCard: () -> Unit,
    onExportMemo: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "Export",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = "PDF, share card, or investment memo.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )

        fun runExport(action: () -> Unit) {
            if (!isPro) {
                onRequireUpgrade("report_export")
                return
            }
            runCatching { action() }
                .onSuccess { onNotify("Export generated.") }
                .onFailure { onNotify(it.message ?: "Export failed.") }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            OutlinedButton(
                onClick = { runExport(onExportPdf) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                )
            ) {
                Text(text = "PDF", color = ThesisColors.TextPrimary)
            }
            OutlinedButton(
                onClick = { runExport(onExportCard) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                )
            ) {
                Text(text = "Card", color = ThesisColors.TextPrimary)
            }
            OutlinedButton(
                onClick = { runExport(onExportMemo) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                )
            ) {
                Text(text = "Memo", color = ThesisColors.TextPrimary)
            }
        }
    }
}

private data class HighlightCard(
    val title: String,
    val content: String,
    val icon: ImageVector,
    val iconColor: Color,
    val isCaution: Boolean = false
)

private fun deriveHighlights(report: DeepDiveReportView): List<HighlightCard> {
    val sections = report.sections.filter { it.body.isNotBlank() }
    val lead = sections.getOrNull(0)?.body?.let(::summarize)
        ?: "Report available. Lead section did not return a usable summary."
    val support = sections.getOrNull(1)?.body?.let(::summarize)
        ?: "Review modules below for supporting evidence."
    val caution = sections
        .filter { !it.status.isNullOrBlank() && !it.status.equals("complete", ignoreCase = true) }
        .joinToString(separator = ", ") { it.title }
        .ifBlank {
            report.confidenceLabel?.let {
                "Confidence is ${it.lowercase()}. Review evidence before acting."
            } ?: "Confidence details limited. Review evidence."
        }

    return listOf(
        HighlightCard(
            title = "Lead Finding",
            content = lead,
            icon = Icons.Default.PushPin,
            iconColor = ThesisColors.Primary
        ),
        HighlightCard(
            title = "Supporting Context",
            content = support,
            icon = Icons.Default.Bolt,
            iconColor = ThesisColors.SignalPositive
        ),
        HighlightCard(
            title = "Read With Caution",
            content = caution,
            icon = Icons.Default.HelpOutline,
            iconColor = ThesisColors.SignalWarning,
            isCaution = true
        )
    )
}

private fun summarize(text: String, limit: Int = 180): String {
    val normalized = text.replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) {
        return "No summary returned."
    }
    return if (normalized.length <= limit) {
        normalized
    } else {
        normalized.take(limit - 3).trimEnd() + "..."
    }
}

private fun valuationSummary(valuation: ValuationDisplayView): String {
    val parts = buildList {
        valuation.spotPrice?.let { add("Spot ${formatMaybeNumber(it)}") }
        valuation.fairValueMid?.let { add("Fair value ${formatMaybeNumber(it)}") }
        valuation.impliedUpsidePct?.let { add("Upside ${formatMaybePercent(it)}") }
        valuation.degradedReason?.takeIf { it.isNotBlank() }?.let { add(it) }
    }
    return parts.joinToString(separator = " | ").ifBlank { "Valuation data unavailable." }
}

private fun historicalSummary(historical: com.thesis.mobile.model.HistoricalDisplayView): String {
    val parts = buildList {
        historical.latestPeriod?.let { add("Latest $it") }
        historical.priorQuarterPeriod?.let { add("QoQ ref $it") }
        historical.yearAgoPeriod?.let { add("YoY ref $it") }
        add("${historical.financialSnapshotCount} financial snapshots")
        add("${historical.transcriptCount} transcripts")
    }
    return parts.joinToString(separator = " | ")
}

private fun formatMaybeNumber(value: Double?): String {
    return value?.let { String.format("%.2f", it) } ?: "n/a"
}

private fun formatMaybePercent(value: Double?): String {
    return value?.let { String.format("%.2f%%", it) } ?: "n/a"
}

@Composable
private fun deepDiveFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = ThesisColors.Surface,
    unfocusedContainerColor = ThesisColors.Surface,
    focusedBorderColor = ThesisColors.Primary,
    unfocusedBorderColor = ThesisColors.Border,
    focusedTextColor = ThesisColors.TextPrimary,
    unfocusedTextColor = ThesisColors.TextPrimary,
    cursorColor = ThesisColors.Primary,
    focusedLabelColor = ThesisColors.Primary,
    unfocusedLabelColor = ThesisColors.TextMuted
)

private fun signalContainerColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive.copy(alpha = 0.08f)
    "NEGATIVE" -> ThesisColors.SignalNegative.copy(alpha = 0.08f)
    else -> ThesisColors.Surface
}

private fun signalBorderColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive.copy(alpha = 0.2f)
    "NEGATIVE" -> ThesisColors.SignalNegative.copy(alpha = 0.2f)
    else -> ThesisColors.Border
}

private fun signalTextColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive
    "NEGATIVE" -> ThesisColors.SignalNegative
    else -> ThesisColors.TextPrimary
}
